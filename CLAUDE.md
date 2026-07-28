# Claude Code 可选兼容规则

本文件保留为 Claude Code 的备用兼容入口，不再定义项目默认主开发。项目默认主执行入口是 `AGENTS.md`。

## 启用条件与权威顺序

- Claude Code 默认不参与开发。
- 只有用户在当前任务中明确点名 Claude Code 时，本文件才生效。
- 启用后必须依次服从：
  1. 用户对当前任务的明确授权；
  2. `AGENTS.md`；
  3. `docs/ai-agent-governance.md`；
  4. `docs/agent-guardrails/**`；
  5. 本文件与 `.claude/skills/**`。
- 单次启用只对当前任务有效，不改变 Codex 的默认主开发地位。
- 历史计划、验证报告、devlog、旧对话和模型输出不构成当前开发授权。

## 项目身份

- 项目名：智美天工 / zmtg-clean
- 仓库：love1252/zmtg-clean（私有）
- 技术栈：Next.js 16 + React 19 + TypeScript + PostgreSQL + Drizzle ORM + Tailwind CSS v4
- 默认语言：中文

## 中文优先兼容规则

- Claude Code 被用户明确启用时，必须遵守 `AGENTS.md` 的中文优先与技术原文保留规则。
- 面向用户的任务回报、PR 标题与描述、审查报告、状态、风险和结论默认使用中文。
- 代码、命令、路径、分支、Commit SHA、API、字段、枚举、环境变量、工具名称和技术契约可以保留英文原文。
- 需要引用 GitHub 或 Git 原生状态时，优先采用“中文说明（英文原始状态）”，例如“草稿（Draft）”和“已进入正式审查（Ready）”。
- 历史 Skill 或模板中的英文文案不得覆盖当前中文优先规则，也不得要求固定英文状态句。

## Claude Code 可选角色

- 用户可明确委托 Claude Code 承担临时独立复核，或作为备用执行者完成指定实现。
- 独立复核默认只报告发现，不修改仓库、Git 状态或 PR。
- 作为备用执行者时，只能完成当前任务明确列出的文件、验证和交付动作，不得顺手修复范围外问题。
- Claude Code 不得与 Codex 并发写入同一工作树、分支或 Git 索引；并行参与时只能进行只读复核。
- 切换执行者前，必须确认 Codex 已停止写入，并交接当前分支、HEAD、工作树（working tree）、暂存区和 PR 状态。
- Git 仓库、已合并文档、代码、测试、Schema 和 Migration 是事实源；模型输出不是事实源。

## 与 Codex 和 ChatGPT 的关系

- Codex 是默认主开发和仓库执行者。
- ChatGPT 网页版负责任务目标设计、范围控制、架构讨论、执行回报与 PR 证据审查，以及用户决策支持。
- Claude Code 只在用户明确启用时承担临时复核或备用执行。
- 架构、任务授权、Migration、外部系统、进入正式审查（Ready）、合并（Merge）和正式发布均由用户决定。

## 每次启用前必须检查

先只读确认：

```bash
date "+%Y-%m-%d"
git branch --show-current
git rev-parse HEAD
git rev-parse main
git rev-parse origin/main
git status --short
```

同时确认任务编号、基线、允许文件、禁止范围、验证要求和停止条件。

- 新任务明确要求从最新 `main` 开始时，才切换和同步 `main`。
- 处理现有分支或 PR 时，必须停留在用户指定分支并核对冻结 Head。
- 工作树（working tree）出现未授权、未交接或与任务冻结状态不符的改动，或分支／基线不符时立即停止，不执行 `stash`、`reset`、`restore` 或覆盖本地内容。
- 当前任务要求提交、推送或 PR 操作时，必须先完成 `AGENTS.md` 规定的同步能力检查。

## 禁止事项

除非用户在当前任务中明确授权，否则：

- 不修改 schema 或 migration；
- 不执行 `pnpm db:migrate`；
- 不运行真实 smoke；
- 不读取 `.env.local` 或检查环境变量；
- 不连接数据库、真实第三方系统、测试服务器或生产环境；
- 不进入正式审查（Ready）；
- 不合并；
- 不推送 `main`；
- 不混入多个功能点；
- 不自动开始下一任务、backlog 或 Runtime；
- 不处理当前授权范围外的顺手修复。

无论是否获得高风险任务授权，都不得输出 `.env.local` 内容、`DATABASE_URL`、数据库密码、`ZMTG_SECRET_ENCRYPTION_KEY`、API Key、Token、Secret 或私钥的具体值。经明确授权的检查也只能按统一 Secret 门禁回报存在／缺失或通过／失败。

## PR 规则

1. 默认只创建或更新草稿 PR（Draft PR）。
2. PR 描述（body）必须与实际修改文件（changed files）、验证结果和状态一致。
3. 一个 PR 只允许一个明确主题。
4. 进入正式审查（Ready）、合并（Merge）、Migration、真实凭证和外部连接必须由用户在当前任务中明确授权。
5. 用户只授权独立复核时，不得修改 PR body、状态、评论或代码。
6. 用户明确授权 Claude Code 作为备用执行者时，也不得自动进入正式审查（Ready）、合并（Merge）或启动下一任务。

## 任务完成回报模板

1. 日期／时区：
2. 当前分支／HEAD：
3. 任务编号与授权角色：
4. PR 编号：
5. 修改文件（changed files）：
6. 实现或复核内容：
7. 未包含内容：
8. 验证命令和结果：
9. 是否触碰 Schema／Migration／Secret／Smoke／外部连接：
10. 是否进入正式审查（Ready）／合并（Merge）：
11. 停止状态与待用户决策：

## 停止条件

- 当前分支、Head 或基线不符合任务冻结值；
- 工作树（working tree）出现非本任务允许的改动；
- 需要 Schema、Migration、真实凭证、外部系统或高风险操作但未获当前任务授权；
- 与 Codex 或其他执行者存在并发写入；
- 需要修改用户未列入范围的文件；
- 不确定是否越界。

## 详细规则

统一规则见 `AGENTS.md` 和 `docs/ai-agent-governance.md`。专项门禁见 `docs/agent-guardrails/`；`.claude/skills/` 仅在用户显式启用 Claude Code 时提供兼容执行提示，不得覆盖上级规则。
