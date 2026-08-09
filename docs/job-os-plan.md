# 求职操作系统整体规划（More-JD-More-Offer）

> 基于 TechSpar 改造：从"面试训练工具"升级为"JD 进 → 简历出"的求职工作流。
> 简历 = 个人经历结构化数据的"查询导出结果"。

## 1. 核心数据流

```
经历资产库(RAG) ──检索──> JD 匹配 / 差距分析 ──重组──> 定制简历 / 母版简历 ──> 投递
      ▲                      │                              │
      └── 补强新经历写入 ─────┘                              └── 前端多模板渲染 → PDF
```

## 2. 四大功能

### A. 经历资产库（地基，✅ 已实现）
每段经历是一个资产，同时存"真实回忆"和"已整理好的简历片段"两个视角；另有 JD、面试问题两类内容（轻量模型）。

资产数据模型（`backend/assets.py`，已扩展为 6 类 + 教育独立字段 + 富文本 snippet）：

```python
class Asset(BaseModel):
    id: str
    type: Literal["internship", "project", "education", "research", "award", "highlight"]
    title: str            # 名称（职位/项目名/专业/论文/奖项/优势标题）
    company: str          # 公司 / 组织 / 角色 / 学校
    time: str             # 时间段
    raw_memory: str       # 真实回忆（口头语言总结实际工作）
    resume_snippet: str   # 已整理好的简历片段（HTML 富文本：<b>加粗、<u>下划线、<ul>分点）
    tags: list[str]
    # 教育背景独立字段（education 类型使用）
    school: str; major: str; degree: str
    created_at: str
    updated_at: str
```

另两类内容（轻量模型，不入 Asset）：
- `JD`：`title`、`company`、`content`（岗位描述，供提取特性/匹配/聚类）
- `面试问题`：`question`、`jd_id`（关联 JD）

- 存储：`data/users/{user_id}/assets/{asset_id}.json`（沿用 [config.py](file:///Users/Zhuanz/Desktop/TechSpar/backend/config.py) 的 `user_*_path` 模式，已在 .gitignore 内）
- 接口：统一 CRUD `/api/assets`，按 `type` 过滤
- 检索：复用 [indexer.py](file:///Users/Zhuanz/Desktop/TechSpar/backend/indexer.py) 的 RAG 机制，新增 `asset_chunk` 类型（同 `resume_chunk`/`topic_chunk` 走 `memory_vectors` 表）
- 前端：资产库管理页（6 类 tab + 列表 + 富文本编辑 + 导出备份）

### A2. 资产导入通道（人工审核后入库，✅ 已实现）

资产来源支持三种输入，都走「解析 → 审核 → 入库」流程，不自动落库：

| 输入通道 | 解析方式 | 说明 |
| --- | --- | --- |
| 简历 PDF | 复用 `/resume/parse`（LLM 结构化 JSON）→ 转资产草稿 | ✅ `POST /api/assets/import-from-resume` + 前端审核弹窗 |
| **文本段** | LLM 从自由文本中抽取经历条目 → 转资产草稿 | ✅ `POST /api/assets/parse-text` + 前端文本导入弹窗 |
| 外部文档 | 确定性解析（LaTeX/md 等） | 一次性脚本录入（如简历库 md → 资产）；量大时可做通用入口 |

- 解析用**低温度 LLM**（`get_parse_llm`，温度 0.1），与主 LLM 分离，保证结构化抽取稳定 ✅
- 审核：前端展示草稿列表，可勾选/编辑字段/补 raw_memory/加标签，确认后逐条 `POST /api/assets` ✅
- `resume_snippet` 已支持 HTML 富文本（`<b>`/`<u>`/`<ul>`），前端 RichEditor 编辑，导出自动转纯文本

### A3. 解析模型选型（✅ 已解决）
- 解析走独立低温度 LLM（`get_parse_llm`，温度 0.1），不再用主 LLM 的 0.7
- PDF 文本提取已从 pypdf 升级为 PyMuPDF（修复中文 CID 字体乱码），pypdf 仅兜底

### B. JD 匹配 → 定制简历（主线产出）
- 输入 JD（+ 公司/岗位）→ LLM 提取关键词（硬技能/软技能/行业术语）
- 在资产库检索最匹配的条目 → 按 JD 优先级重排 → 生成结构化简历数据
- 渲染到现有简历多模板（复用 `frontend/src/resume/templates`）→ 导出 PDF
- 复用：现有 [job_prep.py](file:///Users/Zhuanz/Desktop/TechSpar/backend/graphs/job_prep.py) 的 JD 分析 + `query_resume`；本次让它**产出简历数据**而非只产备面问题

> **Cover Letter：明确砍掉。** 目标用户是技术岗（国内为主），投递流程无 cover letter 环节，开发收益≈0。真有需要时用 JD 匹配产出 + 通用 LLM 一句话生成即可，不做产品功能。

### C. 差距分析与动态补强
- 输入 JD → 输出 `gap`：缺失项（技能/经验维度）、风险等级、补强建议
- 补强闭环：挖隐性经历（从完整简历/历史资料检索"有但没写"的描述）→ 若真没有，提示用户造 Demo 后写入资产库
- 复用：现有 copilot 提示词里的 gap/风险/应对结构（`backend/copilot/prompts.py`），做成用户可见的独立功能页

### D. JD 聚类与母版简历（批量投递）
- JD 收藏夹 → 自动聚类（如：算法岗/基建岗/大模型应用岗）
- 每类生成 2-3 份母版简历（共性关键词 + 高频资产条目）
- 日常投递 80% 用母版微调，20% 核心岗走 B 深度定制

## 3. 分期计划

| 阶段 | 内容 | 依赖 |
| --- | --- | --- |
| Phase 0 | 规划落地（本文档）+ 数据模型 + 资产库骨架 | ✅ 完成 |
| Phase 1 | A 经历资产库（6 类内容 CRUD + 富文本 + 导入通道） | ✅ 完成 |
| Phase 2 | B JD→定制简历（生成管线 + 前端预览/导出） | 下一步 |
| Phase 3 | C 差距分析与补强闭环 | Phase 2 |
| Phase 4 | D JD 收藏/聚类/母版 | Phase 2 |

## 4. 新增清单 vs 复用清单

**复用**：indexer RAG、vector_memory、llm_provider、job_prep 的 JD 分析、copilot 的 gap 结构、前端多模板渲染/PDF 导出、config 路径模式、.gitignore 隔离

**新增**：
- 后端：`assets.py`（四类资产 CRUD + 检索）、`resume_gen.py`（JD→简历生成）、`gap_analysis.py`、`jd_cluster.py`；routers：`assets.py`、`job_match.py`
- 前端：资产库页面（四类 tab）、JD→简历工作台、差距分析页、JD 收藏/聚类页
- 数据：资产库目录、聚类结果

## 5. 检索后端：LightRAG 渐进引入路线

> 目标：实现难度尽量低 + 充分学习 LightRAG。
> 策略：**不替换现有检索，新增独立通道** —— 现有 `indexer.py` / `vector_memory.py`（面试记忆、弱点评分、题目图谱）保持不变；LightRAG 作为独立检索后端，从"经历资产库"这个新功能开始用起。单用户自用，每用户一个 workspace（`data/users/{user_id}/lightrag/`），天然隔离，无 LLM key 冲突。

| 步骤 | 做什么 | 学到什么 |
| --- | --- | --- |
| Step 1 最小接入 | `pip install lightrag-hku`；写 `lightrag_adapter.py` 封装 init/insert/query，拿资产文本跑通 | LightRAG 初始化、LLM/Embedding 函数注入、insert/query 基本用法 |
| Step 2 资产库联动 | 资产 CRUD 时同步写入 LightRAG，资产检索走 LightRAG | workspace/namespace 隔离、增量 upsert |
| Step 3 对照实验 | 在检索抽象层后，简历检索也从 numpy 切到 LightRAG | 图增强 vs 纯向量的真实差异 |
| Step 4 深度定制 | 实体抽取 prompt、图可视化、自定义 chunker / rerank | GraphRAG 内部机制、prompt 工程 |

约束：
- 每步独立可回退，不影响现有功能
- 检索抽象层：资产库/简历检索统一走 `retriever.py` 接口，内部可切换 numpy / LightRAG，上层业务代码不动
- 多用户 LLM key 隔离问题暂不处理（单用户自用；将来多人用再按 workspace 实例化）

## 6. 隐私注意

- 所有用户数据落在 `data/users/{user_id}/` 下，已 .gitignore 隔离，不入库
- Cover Letter / 简历生成走用户自配的 LLM（设置页密钥），不新增共享服务
- 证据链接仅存 URL，不存私有内容
