"""经历资产库 — 每段经历是一个资产，双视角存储（真实回忆 / 已整理简历片段）。

存储：data/users/{user_id}/assets/{asset_id}.json（每资产一个 JSON 文件）。
不落任何共享数据库，天然与现有 memory_vectors / interviews.db 隔离。

resume_snippet 存 HTML 富文本（<b>加粗、<u>下划线、<ul><li>分点），
与前端简历编辑器(RichEditor)一致；导出/生成简历时按需转纯文本。
"""
import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

AssetType = Literal["internship", "project", "education", "research", "award", "highlight"]


class Asset(BaseModel):
    id: str
    type: AssetType
    title: str            # 名称（职位 / 项目名 / 专业 / 论文名 / 奖项名 / 优势标题）
    company: str = ""     # 公司 / 组织 / 角色 / 学校
    time: str = ""        # 时间段
    raw_memory: str = ""  # 真实回忆（口头语言总结实际工作）
    resume_snippet: str = ""  # 已整理好的简历片段（HTML 富文本）
    tags: list[str] = Field(default_factory=list)
    # 教育背景独立字段（education 类型使用；其他类型留空）
    school: str = ""
    major: str = ""
    degree: str = ""
    created_at: str = ""
    updated_at: str = ""


class AssetCreate(BaseModel):
    type: AssetType
    title: str
    company: str = ""
    time: str = ""
    raw_memory: str = ""
    resume_snippet: str = ""
    tags: list[str] = Field(default_factory=list)
    school: str = ""
    major: str = ""
    degree: str = ""


class AssetUpdate(BaseModel):
    title: str | None = None
    company: str | None = None
    time: str | None = None
    raw_memory: str | None = None
    resume_snippet: str | None = None
    tags: list[str] | None = None
    school: str | None = None
    major: str | None = None
    degree: str | None = None


def _assets_dir(user_id: str) -> Path:
    from backend.config import settings

    return settings.user_data_dir(user_id) / "assets"


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _asset_path(user_id: str, asset_id: str) -> Path:
    return _assets_dir(user_id) / f"{asset_id}.json"


def create_asset(user_id: str, data: AssetCreate) -> Asset:
    asset = Asset(
        id=uuid.uuid4().hex,
        **data.model_dump(),
        created_at=_now(),
        updated_at=_now(),
    )
    path = _asset_path(user_id, asset.id)
    path.parent.mkdir(parents=True, exist_ok=True)
    _write_asset(path, asset)
    return asset


def get_asset(user_id: str, asset_id: str) -> Asset | None:
    path = _asset_path(user_id, asset_id)
    if not path.exists():
        return None
    try:
        return Asset(**json.loads(path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, ValueError):
        return None


def list_assets(user_id: str, asset_type: AssetType | None = None) -> list[Asset]:
    d = _assets_dir(user_id)
    if not d.exists():
        return []
    assets: list[Asset] = []
    for path in sorted(d.glob("*.json")):
        try:
            asset = Asset(**json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, ValueError):
            continue
        if asset_type is None or asset.type == asset_type:
            assets.append(asset)
    # 新建的在前（列表页常按最近录入排序）
    assets.sort(key=lambda a: a.updated_at, reverse=True)
    return assets


def update_asset(user_id: str, asset_id: str, data: AssetUpdate) -> Asset | None:
    existing = get_asset(user_id, asset_id)
    if existing is None:
        return None
    changes = data.model_dump(exclude_unset=True)
    updated = existing.model_copy(update={**changes, "updated_at": _now()})
    _write_asset(_asset_path(user_id, asset_id), updated)
    return updated


def delete_asset(user_id: str, asset_id: str) -> bool:
    path = _asset_path(user_id, asset_id)
    if path.exists():
        path.unlink()
        return True
    return False


def _write_asset(path: Path, asset: Asset):
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(
        asset.model_dump_json(indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    tmp.replace(path)


# ── 简历解析 → 资产草稿（人工审核入库）──

def parsed_resume_to_drafts(parsed: dict) -> list[AssetCreate]:
    """把 /resume/parse 返回的结构化 JSON 转成候选资产草稿（不落库）。

    映射规则：
    - experience[] → type=internship, title=position, company=company, time=date
    - projects[]   → type=project,   title=name,   company=role,    time=date
    - education[]  → type=education, school/major/degree/time（独立字段）
    resume_snippet 来自要点数组（HTML）；raw_memory 留空（待用户补口头回忆）。
    空条目（无 title 且无 company）跳过。
    """
    drafts: list[AssetCreate] = []

    for item in parsed.get("experience") or []:
        if not isinstance(item, dict):
            continue
        company = str(item.get("company") or "").strip()
        position = str(item.get("position") or "").strip()
        if not company and not position:
            continue
        drafts.append(
            AssetCreate(
                type="internship",
                title=position or company,
                company=company,
                time=str(item.get("date") or "").strip(),
                resume_snippet=_points_to_html(item.get("details")),
            )
        )

    for item in parsed.get("projects") or []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        role = str(item.get("role") or "").strip()
        if not name and not role:
            continue
        drafts.append(
            AssetCreate(
                type="project",
                title=name or role,
                company=role,
                time=str(item.get("date") or "").strip(),
                resume_snippet=_points_to_html(item.get("description")),
            )
        )

    for item in parsed.get("education") or []:
        if not isinstance(item, dict):
            continue
        school = str(item.get("school") or "").strip()
        major = str(item.get("major") or "").strip()
        degree = str(item.get("degree") or "").strip()
        if not school and not major:
            continue
        start = str(item.get("startDate") or "").strip()
        end = str(item.get("endDate") or "").strip()
        time = f"{start} - {end}" if start or end else ""
        drafts.append(
            AssetCreate(
                type="education",
                title=major or school,
                school=school,
                major=major,
                degree=degree,
                time=time,
                resume_snippet=_points_to_html(item.get("description")),
            )
        )

    return drafts


def _points_to_html(points: list | None) -> str:
    """要点数组 → HTML <ul><li>（分点 + 去行首符号）。"""
    items = []
    for p in points or []:
        if isinstance(p, str):
            s = p.strip().lstrip("•-·*#>").strip()
            if s:
                items.append(f"<li>{s}</li>")
    if not items:
        return ""
    return "<ul>" + "".join(items) + "</ul>"


# ── HTML 富文本 → 纯文本（导出 markdown / 展示用）──

_TAG_RE = re.compile(r"<[^>]+>")

def html_to_plain(html: str) -> str:
    """HTML → 纯文本：保留 <li> 换行、去掉其余标签。"""
    if not html:
        return ""
    s = re.sub(r"<li[^>]*>", "\n- ", html)
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"</(ul|ol|li|p)>", "\n", s)
    s = _TAG_RE.sub("", s)
    s = s.replace("&nbsp;", " ")
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


# ── 汇总导出 Markdown（备份）──

TYPE_SECTION = {
    "internship": "实习经历",
    "project": "项目经历",
    "education": "教育背景",
    "research": "科研经历",
    "award": "获奖经历",
    "highlight": "个人优势",
}

# 导出时按此顺序分节
_TYPE_ORDER = ("internship", "project", "research", "award", "education", "highlight")


def assets_to_markdown(user_id: str) -> str:
    """把所有经历资产汇总成一份 Markdown，按类型分节，作为备份/浏览用。"""
    assets = list_assets(user_id)
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines = [
        "# 经历资产备份",
        "",
        f"> 导出时间：{now}　共 {len(assets)} 条资产",
        "",
    ]

    for asset_type in _TYPE_ORDER:
        section = [a for a in assets if a.type == asset_type]
        if not section:
            continue
        lines.append(f"## {TYPE_SECTION.get(asset_type, asset_type)}（{len(section)}）")
        lines.append("")
        for a in section:
            title = a.title or "(未命名)"
            if a.type == "education" and a.major:
                title = a.major or a.school
            company = f" — {a.company}" if a.company else ""
            time = f"　({a.time})" if a.time else ""
            lines.append(f"### {title}{company}{time}")
            lines.append("")
            if a.type == "education":
                detail = []
                if a.school:
                    detail.append(f"学校：{a.school}")
                if a.major:
                    detail.append(f"专业：{a.major}")
                if a.degree:
                    detail.append(f"学历：{a.degree}")
                if detail:
                    lines.append("；".join(detail))
                    lines.append("")
            if a.raw_memory:
                lines.append("**真实回忆**")
                lines.append("")
                lines.append(a.raw_memory)
                lines.append("")
            if a.resume_snippet:
                lines.append("**简历片段**")
                lines.append("")
                lines.append(html_to_plain(a.resume_snippet))
                lines.append("")
            if a.tags:
                lines.append(f"标签：{'、'.join(a.tags)}")
                lines.append("")
    return "\n".join(lines)
