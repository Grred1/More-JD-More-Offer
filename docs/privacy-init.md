# 隐私安全初始化方案（clone 后第一步）

> 用途：把公共项目 clone 下来改成自用时，先执行本方案，避免隐私数据（简历、录音、画像、API Key）泄露到远程仓库。
> 记录时间：2026-08-06

## 一、现状核对（已确认）

- 远程仓库：`https://github.com/AnnaSuSu/TechSpar.git`（公共仓库，当前 `origin` 指向它且可 push）
- 工作区干净，无未提交内容
- `.gitignore` 已拦截：`.env`、`data/users/`、`data/resume/*`、`data/user_profile/*`、`data/knowledge/**/*.md`、`data/high_freq/*`、`data/topics.json`、`*.db` / `*.sqlite`
- 仓库内无真实密钥，只有示例占位符（`sk-your-*`）；CI 工作流无硬编码密钥

## 二、执行步骤

### 1. 切断到公共仓库的推送通道（最关键）✅ 已完成

```bash
git remote remove origin
```

已完成绑定私有仓库：

```bash
git remote add origin https://github.com/Grred1/More-JD-More-Offer.git
```

> 说明：本项目只作为底子自用，不需要同步上游更新，因此不加 upstream。

### 2. 初始化环境变量与账号

```bash
cp .env.example .env
```

编辑 `.env`，务必改掉默认值：`JWT_SECRET`、`DEFAULT_EMAIL`、`DEFAULT_PASSWORD`。模型 API Key 等敏感密钥按文档填进 `.env`（已被 .gitignore 拦截，不会进 git）。

### 3. 是否需要创建私有仓库？

取决于你的使用方式：

- **只在本地跑，不上传任何远程**：不需要建仓库。执行完 `git remote remove origin` 即可，本地 git 照常提交/回滚，只是没有远程。
- **想备份到云端 / 走 GitHub 部署 / 多设备同步 / 协作**：需要。先在 GitHub 上创建仓库并选 **Private**（不要用 fork —— fork 公共仓库默认也是公开的，且会保留与上游的关联），然后：
  ```bash
  git remote add origin git@github.com:<你的用户名>/<仓库名>.git
  git push -u origin main
  ```

### 4. 设置项目级 git 身份（避免真实邮箱进提交记录）

```bash
git config user.name "你的昵称"
git config user.email "你的邮箱"
```

只设置项目级（不加 `--global`），提交记录里就不会带原项目作者信息或暴露你的默认身份。

### 5. 历史处理（二选一）

- **保留原始历史**：改动最少，直接在自己的仓库上继续提交。
- **清空历史重新开始**：让仓库完全属于你，且不携带原作者邮箱等元数据：

```bash
git checkout --orphan fresh
git add -A
git commit -m "init: 基于 TechSpar 的私有化版本"
git branch -D main
git branch -m main
```

### 6. 提交前自检（养成习惯）

每次提交前确认没有隐私数据混入：

```bash
git status --short
git diff --cached --name-only
```

敏感文件清单（出现即禁止提交）：`.env`、`data/` 下除 `.gitkeep`/`topics.example.json` 外的所有文件、任何 `*.db` / `*.sqlite`。

## 三、隐私数据落盘位置（了解即可，均已隔离）

| 数据 | 目录 | git 状态 |
| --- | --- | --- |
| 用户账号/设置 | `data/users/` | 已忽略 |
| 简历 PDF | `data/resume/` | 已忽略 |
| 个人画像 | `data/user_profile/` | 已忽略 |
| 知识库/面试记录 | `data/knowledge/`、`data/interviews.db` 等 | 已忽略 |
