# Agent 规则（AGENTS.md）

## 环境约束（最高优先级）

1. **严禁在主环境（系统 Python / 全局 pip / conda base）安装任何依赖。**
   - 所有依赖安装、`pip install`、`uv pip install` 等操作必须**先在项目内创建并激活 venv 虚拟环境**，在 venv 内执行。

   - 启动后端、跑测试、跑脚本一律使用 venv 内的 Python/工具，禁止直接调用系统 Python。

## 其余约定
- 涉及 LightRAG 的安装与实验全部在 venv 内进行。
- 敏感信息（API Key、token）只进 `.env`，不写进代码或提交。
- 测试一律用独立临时用户（如 `test_xxx`），绝不碰真实账号数据。
- 清理类操作先确认数据归属（是否为真实用户数据），确认后再执行。
