"""经历资产库 REST 接口 — CRUD + 按 type 过滤。"""
import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.assets import (
    AssetCreate,
    AssetUpdate,
    assets_to_markdown,
    create_asset,
    delete_asset,
    get_asset,
    list_assets,
    parsed_resume_to_drafts,
    update_asset,
)
from backend.auth import get_current_user
from backend.config import settings
from backend.indexer import _read_pdf

router = APIRouter(prefix="/api")


class ParseTextRequest(BaseModel):
    text: str = Field(..., description="自由文本：口头回忆/笔记，可含多段经历")


def _find_resume_pdf(user_id: str):
    resume_dir = settings.user_resume_path(user_id)
    if not resume_dir.exists():
        return None
    for p in resume_dir.glob("*.pdf"):
        return p
    return None


@router.get("/assets")
def get_assets(
    type: str | None = None,
    user_id: str = Depends(get_current_user),
):
    """List assets. Optional ?type=internship|project|education filter."""
    return [a.model_dump() for a in list_assets(user_id, type)]


@router.post("/assets")
def post_asset(body: AssetCreate, user_id: str = Depends(get_current_user)):
    """Create a new asset."""
    return create_asset(user_id, body).model_dump()


@router.get("/assets/export")
def export_assets(user_id: str = Depends(get_current_user)):
    """把所有经历资产汇总成 Markdown（备份）。返回 text/markdown 供下载。"""
    from fastapi.responses import PlainTextResponse

    md = assets_to_markdown(user_id)
    return PlainTextResponse(
        md,
        media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="assets-backup.md"'},
    )


@router.post("/assets/import-from-resume")
async def import_from_resume(user_id: str = Depends(get_current_user)):
    """解析已上传的简历 PDF → 返回候选资产草稿列表（不落库，供前端人工审核）。

    复用 /resume/parse 的 LLM 解析逻辑：读 PDF → 结构化 JSON → 转资产草稿。
    草稿可编辑，确认后再由前端逐条 POST /api/assets 入库。
    """
    from backend.llm_provider import get_parse_llm
    from backend.prompts.resume_import import RESUME_PARSE_PROMPT
    from backend.routers.resume import MAX_PARSE_CHARS
    from langchain_core.messages import HumanMessage, SystemMessage

    pdf = _find_resume_pdf(user_id)
    if pdf is None:
        raise HTTPException(400, "请先上传简历")

    text = (await asyncio.to_thread(_read_pdf, pdf)).strip()
    if not text:
        raise HTTPException(500, "无法从 PDF 提取文本(可能是扫描件或图片型简历)")

    llm = get_parse_llm(user_id)
    prompt = RESUME_PARSE_PROMPT.format(resume_text=text[:MAX_PARSE_CHARS])
    messages = [
        SystemMessage(content="你是简历解析引擎。只返回 JSON，不要其他内容。"),
        HumanMessage(content=prompt),
    ]

    parsed = None
    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = await asyncio.to_thread(llm.invoke, messages)
            candidate = json.loads(response.content)
            if not isinstance(candidate, dict):
                raise ValueError(f"expected dict, got {type(candidate)}")
            parsed = candidate
            break
        except (json.JSONDecodeError, ValueError) as exc:
            last_error = exc
    if parsed is None:
        raise HTTPException(500, f"简历解析失败，请重试（{last_error}）")

    drafts = parsed_resume_to_drafts(parsed)
    return {"ok": True, "drafts": [d.model_dump() for d in drafts]}


@router.post("/assets/parse-text")
async def parse_text(body: ParseTextRequest, user_id: str = Depends(get_current_user)):
    """从一段自由文本中抽取经历资产草稿（不落库，供前端人工审核）。

    文本可以是口头回忆、笔记、聊天记录等，可能包含多段经历。
    LLM 按"一条经历一条资产"抽取，返回候选草稿列表。
    """
    from backend.llm_provider import get_parse_llm
    from backend.prompts.text_to_assets import TEXT_TO_ASSETS_PROMPT
    from langchain_core.messages import HumanMessage, SystemMessage

    text = body.text.strip()
    if not text:
        raise HTTPException(400, "请输入要解析的文本")

    llm = get_parse_llm(user_id)
    prompt = TEXT_TO_ASSETS_PROMPT.format(text=text[:20000])
    messages = [
        SystemMessage(content="你是经历资产抽取引擎。只返回 JSON 数组，不要其他内容。"),
        HumanMessage(content=prompt),
    ]

    drafts = None
    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = await asyncio.to_thread(llm.invoke, messages)
            candidate = json.loads(response.content)
            if not isinstance(candidate, list):
                raise ValueError(f"expected list, got {type(candidate)}")
            drafts = []
            for item in candidate:
                if not isinstance(item, dict):
                    continue
                asset_type = str(item.get("type") or "").strip()
                if asset_type not in (
                    "internship", "project", "education", "research", "award", "highlight",
                ):
                    continue
                title = str(item.get("title") or "").strip()
                if not title:
                    continue
                drafts.append(
                    AssetCreate(
                        type=asset_type,
                        title=title,
                        company=str(item.get("company") or "").strip(),
                        time=str(item.get("time") or "").strip(),
                        raw_memory=str(item.get("raw_memory") or "").strip(),
                        resume_snippet=str(item.get("resume_snippet") or "").strip(),
                        school=str(item.get("school") or "").strip(),
                        major=str(item.get("major") or "").strip(),
                        degree=str(item.get("degree") or "").strip(),
                        tags=[t for t in (item.get("tags") or []) if isinstance(t, str)],
                    )
                )
            break
        except (json.JSONDecodeError, ValueError) as exc:
            last_error = exc
    if drafts is None:
        raise HTTPException(500, f"文本解析失败，请重试（{last_error}）")

    return {"ok": True, "drafts": [d.model_dump() for d in drafts]}


@router.get("/assets/{asset_id}")
def get_single_asset(asset_id: str, user_id: str = Depends(get_current_user)):
    """Fetch one asset."""
    asset = get_asset(user_id, asset_id)
    if asset is None:
        raise HTTPException(404, "asset not found")
    return asset.model_dump()


@router.put("/assets/{asset_id}")
def put_asset(
    asset_id: str,
    body: AssetUpdate,
    user_id: str = Depends(get_current_user),
):
    """Update an asset (partial fields)."""
    asset = update_asset(user_id, asset_id, body)
    if asset is None:
        raise HTTPException(404, "asset not found")
    return asset.model_dump()


@router.delete("/assets/{asset_id}")
def remove_asset(asset_id: str, user_id: str = Depends(get_current_user)):
    """Delete an asset."""
    if not delete_asset(user_id, asset_id):
        raise HTTPException(404, "asset not found")
    return {"ok": True}
