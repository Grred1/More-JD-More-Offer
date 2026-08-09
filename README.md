<div align="center">

<img src="images/techspar-horizontal-logo.svg" alt="More-JD-More-Offer" width="520" />


**把"个人经历资产库"与"JD 匹配"串成一条"JD 进 → 简历出"的求职工作流。**

[GitHub](https://github.com/Grred1/More-JD-More-Offer) · [快速开始](#快速开始) · [English](README.en.md)


[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Powered-1C3C3C.svg)](https://www.langchain.com/langgraph)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](LICENSE)


![TechSpar 产品总览](images/techspar-overview.png)
</div>

> More-JD-More-Offer 基于 TechSpar 改造：从"面试训练工具"升级为"求职工作流"。
> 核心思想：**简历 = 个人经历结构化数据的"查询导出结果"**。
> 先把每段经历沉淀成结构化资产（真实回忆 + 已整理简历片段双视角），再按 JD 检索重组出定制简历。

---

## 核心数据流

```
经历资产库(RAG) ──检索──> JD 匹配 / 差距分析 ──重组──> 定制简历 / 母版简历 ──> 投递
      ▲                      │                              │
      └── 补强新经历写入 ─────┘                              └── 前端多模板渲染 → PDF
```

---

## 经历资产库：一切的地基

每段经历是一个**资产**，同时存两个视角：

- **真实回忆（raw_memory）**：大白话总结，想到啥补啥，只增不改
- **简历片段（resume_snippet）**：已整理好的投递版本，支持 **HTML 富文本**（加粗 `<b>`、下划线 `<u>`、分点 `<ul>`）

六类资产：

| 类型 | 内容 |
| --- | --- |
| 实习经历 | 公司 / 职位 / 时间 / 要点（含加粗、下划线） |
| 项目经历 | 项目名 / 角色 / 时间 / 要点 |
| 科研经历 | 论文名 / 期刊会议 / 要点 |
| 获奖经历 | 奖项名 / 颁发机构 / 时间 |
| 教育背景 | 学校 / 专业 / 学历 / 时间（独立字段） |
| 个人优势 | 技能栈 / 自我评价 |

### 多种导入通道（人工审核后入库，不自动落库）

| 通道 | 方式 |
| --- | --- |
| **简历 PDF** | PyMuPDF 提取文本（修复中文乱码）→ 低温度 LLM 结构化 → 审核弹窗勾选入库 |
| **文本段** | 粘贴口头回忆 / 笔记，LLM 自动拆成多条候选资产 → 审核入库 |
| **外部文档** | 一次性脚本确定性解析（LaTeX / Markdown 简历库），富文本保真 |

### 导出备份

一键把全部资产汇总为 Markdown（按类型分节），本地留存。

---

## 这不是"刷题工具"

大多数 AI 面试产品的死穴是**没有闭环**：今天答得差，明天再来它当你是第一次。

More-JD-More-Offer 的资产库把散落的经历、口头回忆、简历版本统一沉淀成结构化数据，让后续的 JD 匹配、差距分析、定制简历都建立在**同一份长期资产**上，而不是每次从零开始。

---

## 适合谁

- 正在准备后端、算法、AI 应用、Agent、RAG 等技术岗位面试的人
- 经历多但散落各处（简历 / 笔记 / 口头回忆），想要一份统一资产库的人
- 想针对不同 JD 快速定制简历，而不是每次手动重排的人
- 想长期跟踪自己能力变化，而不是做一次性问答的人

---

## 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
```

`.env` 里**不放任何 API Key**——只有启动引导项（管理员账号、`JWT_SECRET`、是否开放注册等）。所有模型与服务密钥都是**每个用户自己的**，登录后在「设置」里填；首次登录会有两步引导带你配好 **LLM + Embedding**（Embedding 必需，简历 / 知识库 / 记忆的向量化都靠它）。

设置页里填什么：

- **LLM**：任意 OpenAI 兼容接口（API Base + Key + Model）。
- **Embedding**：`api` 模式走兼容接口；或 `local` 模式用本地 HuggingFace 模型（需额外 `pip install -r requirements.local-embedding.txt`）。

没有 key 也能零成本跑通，免费示例（两家都有免费额度，可分开用）：

- 主 LLM：ModelScope 的 `ZhipuAI/GLM-5`，Base `https://api-inference.modelscope.cn/v1`，Key 填 ModelScope SDK Token（<https://modelscope.cn/home>）
- Embedding：SiliconFlow 的 `BAAI/bge-large-zh-v1.5`，Base `https://api.siliconflow.cn/v1`，Key 填 SiliconFlow API Key（<https://cloud.siliconflow.cn/>）

认证默认值如下，不配置也能启动：

```env
JWT_SECRET=change-me-in-production
DEFAULT_EMAIL=admin@techspar.local
DEFAULT_PASSWORD=admin123
DEFAULT_NAME=admin
ALLOW_REGISTRATION=false
```

**可选服务**也都是 per-user，在「设置 → 可选服务 / 声纹识别」按需填，不填则对应功能关闭：

- **DashScope**（阿里云百炼，<https://bailian.console.aliyun.com/>，有免费额度）：答题语音输入 / 录音复盘转写 / Copilot 实时语音识别。
- **Tavily**（<https://tavily.com/>，免费每月 `1,000 credits`）：Copilot 联网搜索公司情报。
- **阿里云 OSS**：录音复盘上传长音频（答题短语音走同步链路，不需要）。
- **腾讯云 VPR 声纹识别**（<https://console.cloud.tencent.com/vpr>）：Copilot 自动区分 HR 与候选人音色，不填则手动按钮切换。

Copilot 不再单独配模型，直接用你的主 LLM。

### 2. Docker 启动

```bash
docker compose up --build
```

启动后访问：

```text
http://localhost
```

### 3. 手动启动

后端：

```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

如果你要使用本地 embedding，再额外安装：

```bash
pip install -r requirements.local-embedding.txt
```

前端：

```bash
cd frontend
npm install
npm run dev
```

访问：

```text
http://localhost:5173
```

登录后可从侧栏进入 `面试 Copilot`，或直接访问：

```text
http://localhost:5173/copilot
```

---

## 技术栈

| Component | Technology |
| --- | --- |
| Backend | FastAPI, LangChain, LangGraph |
| Frontend | React 19, React Router v7, Vite, Tailwind CSS v4 |
| Storage | SQLite, semantic embeddings, JSON assets（data/users/） |
| PDF 解析 | PyMuPDF（中文 CID 字体正确解码），pypdf 兜底 |
| Auth | JWT, bcrypt |
| LLM | Any OpenAI-compatible API（per-user key，解析走低温度专用 LLM） |

---

## 项目结构

为了避免文档继续变成过时快照，这里只保留稳定结构：

- `backend/main.py`：FastAPI 入口和主要接口
- `backend/assets.py`：经历资产库数据模型 + 转换/导出（简历解析 → 资产草稿、HTML↔纯文本、Markdown 备份）
- `backend/prompts/`：解析提示词（简历 PDF → JSON、文本段 → 资产草稿）
- `backend/routers/assets.py`：资产 CRUD + 导入通道（import-from-resume / parse-text）+ 导出备份
- `backend/graphs/`：简历面试、专项训练、JD 备面、录音复盘、Copilot 预处理等核心流程
- `backend/copilot/`：实时辅助相关的策略树、方向预测、回答建议、语音流处理
- `backend/storage/`：会话、Copilot prep 等持久化
- `frontend/src/pages/`：经历资产库（6 类 tab + 富文本编辑 + 导入审核 + 导出）、训练、画像、图谱、题库、Copilot、设置、复盘等页面
- `frontend/src/api/`、`frontend/src/contexts/`、`frontend/src/hooks/`：接口封装、全局状态和实时交互逻辑
- `data/users/{user_id}/`：每个用户的画像、简历、知识库、题库、设置与各项 API 密钥（provider.json / voiceprint.json）
- `docs/job-os-plan.md`：求职操作系统整体规划（阶段计划）
- `docker-compose.yml`、`requirements*.txt`、`.env.example`：部署和运行入口

---

## 数据迁移（跨电脑同步）

换机器或重装时，可以在 **设置 → 数据迁移** 卡片里点导出 / 导入；或用 `scripts/` 下的脚本（适合脚本化、批量、跨用户）：

```bash
# 旧机器：导出（生成 techspar-backup-<timestamp>.tar.gz）
python3 scripts/export_data.py

# 新机器：先按 README 部署好，再导入
python3 scripts/import_data.py techspar-backup-<timestamp>.tar.gz
```

UI 导入会把归档中的数据全部归到当前登录账户（即使原 `user_id` 不同），适合个人换机；CLI 默认保留原 `user_id`，适合管理员级整库迁移。

打包内容：`data/interviews.db` + `data/users/<user_id>/`（画像/简历/知识库/题库/训练偏好）。
**不打包**：`.index_cache/`（导入后会自动重建）、`langgraph_checkpoints*`（运行时状态）、`.env`（只剩 `JWT_SECRET`/管理员账号等引导项，需手工同步；模型密钥已存在 `data/users/` 里随包迁移）。

可选参数：
- `--user-id <id>`：仅导出指定用户（多用户部署时使用）
- `--db-strategy overwrite`：导入时同一 `session_id` 用归档版本覆盖本地（默认保留本地）
- `--overwrite-files`：导入时覆盖 `data/users/` 已存在的文件（默认保留本地）

---

## 参与贡献
开发环境、代码约定和 PR 流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## License

CC BY-NC 4.0


