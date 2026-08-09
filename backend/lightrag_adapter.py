"""LightRAG 适配层 — 让 LightRAG 复用用户自配的 LLM / Embedding 服务。

设计：
- 每个用户一个独立 workspace：data/users/{user_id}/lightrag/，数据天然隔离。
- llm_model_func / embedding_func 都从 backend.llm_provider 解析用户配置，
  绕开 LightRAG 的全局配置，保持「每用户自配 key」的既有架构。
- 延迟创建实例（首次用时才初始化），避免启动时做昂贵的 embedding 校验。
"""
import asyncio
import logging
import threading
from functools import partial

from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import openai_complete_if_cache, openai_embed
from lightrag.utils import EmbeddingFunc

from backend.config import settings
from backend.llm_provider import (
    ProviderNotConfigured,
    get_embedding,
    resolve_embedding_config,
    resolve_llm_config,
)

logger = logging.getLogger("uvicorn")

_instances: dict[str, LightRAG] = {}
_lock = threading.Lock()


def _workspace_dir(user_id: str) -> str:
    return str(settings.user_data_dir(user_id) / "lightrag")


def _make_llm_func(user_id: str):
    c = resolve_llm_config(user_id)
    if not c["api_key"] or not c["model"]:
        raise ProviderNotConfigured("LLM")

    async def llm_model_func(
        prompt,
        system_prompt=None,
        history_messages=None,
        **kwargs,
    ) -> str:
        return await openai_complete_if_cache(
            c["model"],
            prompt,
            system_prompt=system_prompt,
            history_messages=history_messages or [],
            api_key=c["api_key"],
            base_url=c["api_base"],
            **kwargs,
        )

    return llm_model_func


def _make_embedding_func(user_id: str) -> EmbeddingFunc:
    ec = resolve_embedding_config(user_id)
    if not ec.get("api_key") or ec.get("backend") not in ("api", ""):
        # 本地 embedding 也走 llm_provider 的统一入口
        embedder = get_embedding(user_id)

        def local_embed(texts: list[str]) -> list[list[float]]:
            return embedder.get_text_embedding_batch(texts)

        return EmbeddingFunc(
            embedding_dim=1024,
            max_token_size=8192,
            func=local_embed,
        )

    model = ec.get("api_model") or "bge-m3"
    return EmbeddingFunc(
        embedding_dim=1024,
        max_token_size=8192,
        func=partial(
            openai_embed,
            model=model,
            base_url=ec.get("api_base"),
            api_key=ec.get("api_key"),
        ),
    )


def get_rag(user_id: str) -> LightRAG:
    """Get (lazily creating) the user's LightRAG instance."""
    with _lock:
        if user_id not in _instances:
            rag = LightRAG(
                working_dir=_workspace_dir(user_id),
                llm_model_func=_make_llm_func(user_id),
                embedding_func=_make_embedding_func(user_id),
                # 单用户自用，用默认轻量存储即可
                kv_storage="JsonKVStorage",
                vector_storage="NanoVectorDBStorage",
                graph_storage="NetworkXStorage",
            )
            # 初始化各 storage 与 pipeline_status；异步接口，同步包装一次
            asyncio.run(rag.initialize_storages())
            _instances[user_id] = rag
        return _instances[user_id]


async def ainsert_text(user_id: str, text: str, doc_id: str | None = None) -> None:
    """Insert a document into the user's LightRAG index."""
    rag = get_rag(user_id)
    kwargs = {"id": doc_id} if doc_id else {}
    await rag.ainsert(text, **kwargs)


async def aquery(
    user_id: str,
    question: str,
    mode: str = "local",
    top_k: int = 5,
) -> str:
    """Query the user's LightRAG index. mode: naive / local / global / hybrid."""
    rag = get_rag(user_id)
    param = QueryParam(mode=mode, top_k=top_k, only_need_context=False)
    return await rag.aquery(question, param=param)


def insert_text(user_id: str, text: str, doc_id: str | None = None) -> None:
    asyncio.run(ainsert_text(user_id, text, doc_id))


def query(user_id: str, question: str, mode: str = "local", top_k: int = 5) -> str:
    return asyncio.run(aquery(user_id, question, mode=mode, top_k=top_k))
