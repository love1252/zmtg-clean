# zmtg-agent-guardrails-v1：规则包总览

## 目的

为 zmtg-clean 项目建立 Agent 共用的边界控制、PR 自查、UI 测试质量和 Secret／Migration／Smoke 门禁。

V1 只做文档和 skills，不做脚本 / hooks。V2 考虑 `scripts/agent-guards/*` 和自动检查脚本。

本文件保留原路径，避免既有引用失效；当前执行口径已更新为 Codex 默认主开发模式。规则权威顺序以 `AGENTS.md` 和 `docs/ai-agent-governance.md` 为准。

## 中文优先规则

- 所有 Agent 共用 `AGENTS.md` 定义的中文优先与技术原文保留规则。
- Codex、ChatGPT 网页版和被用户明确启用的 Claude Code，其面向人的标题、说明、PR 描述、审查结果、状态和回报默认使用中文。
- 代码、路径、命令、分支、Commit SHA、API、字段、枚举、环境变量、库、工具、协议和技术契约可以保留英文原文；GitHub 或 Git 原生状态需要精确引用时采用“中文说明（英文原始状态）”。
- 历史文件只有进入当前任务允许范围后才可以安全中文化，不得为了翻译历史文件扩大任务范围。
- 不得对历史事实、直接引语、原始日志、测试锁定字符串或兼容契约进行失真改写；不能安全翻译时保留原文并补充中文说明。
- 历史 Skill 或模板不得覆盖上级中文治理规则，也不得据此要求整段英文状态说明。

## 三个 guardrail

### 1. zmtg-pr-gatekeeper

PR 门禁规则，覆盖：

- 分支与 main 基线检查
- PR 描述（body）与修改文件（changed files）／测试结果一致性
- 草稿（Draft）／正式审查（Ready）状态一致性
- PR 体量控制（一个功能点一个 PR）
- 回报内容与实际情况一致性

### 2. zmtg-ui-test-reviewer

UI 测试质量审查规则，覆盖：

- 禁止空 `waitFor` 和仅含注释（comment-only）的测试体
- 加载失败（401/403）时必须断言输入框和按钮 disabled
- 必须断言没有 POST／PUT／DELETE 变更请求（mutation）
- 必须断言不展示 secret 字段
- 401 和 403 都要覆盖

### 3. zmtg-secret-migration-guard

Secret / Migration / Smoke 门禁规则，覆盖：

- 默认禁止 migration / smoke / secret 读取
- 授权后必须确认数据库类型才可执行
- 只能回报存在 / 缺失 / 通过 / 失败，不输出具体值
- 发现泄漏风险必须停止

## Codex 主开发协作流程

### Codex（默认主开发与仓库执行者）

- 从最新 `main` 创建功能分支
- 按任务目标完整实现功能
- 补齐必要测试
- 运行当前任务要求的必要验证
- 创建草稿 PR（Draft PR）
- 回报修改文件（changed files）、验证结果、是否越界和 PR 链接
- 未经当前任务明确授权，不进入正式审查（Ready）、不合并（Merge）、不启动下一任务
- 在当前任务分别明确授权对应动作后，才可以进入正式审查（Ready）、合并（Merge）和执行本地 `main` 收口

### ChatGPT 网页版（任务设计与审查）

- 设计任务目标、拆分范围并参与架构讨论
- 审查 Codex 回报和 PR 证据
- 检查任务边界是否越界
- 检查 PR body 与实际是否一致
- 检查测试覆盖是否充分
- 协助用户判断进入正式审查（Ready）、合并（Merge）和后续任务
- 不根据计划或 backlog 自动授权 Codex 开发

### Claude Code（可选兼容工具）

- 默认不参与
- 只有用户在当前任务中明确点名时，才作为临时备用执行者或独立复核工具
- 必须服从 `AGENTS.md`、统一治理规则和本规则包
- 不得与 Codex 并发写入同一工作树、分支或 Git 索引；并行参与时只能只读复核
- 单次启用不改变 Codex 的默认主开发地位

### 用户（授权与发布决策）

- 决定架构、任务范围和停止条件
- 明确授权 Migration、真实外部系统、进入正式审查（Ready）、合并（Merge）和正式发布

所有 Agent 共用 PR、UI 测试、Secret、Migration 和 Smoke 门禁。“默认主开发”只表示默认执行者，不构成对未列入当前任务内容的长期授权。

## V1 范围

| 文件 | 说明 |
|------|------|
| `CLAUDE.md` | Claude Code 被明确启用时的可选兼容入口 |
| `docs/agent-guardrails/zmtg-agent-guardrails-v1.md` | 本文件，规则包总览 |
| `docs/agent-guardrails/zmtg-pr-gatekeeper.md` | PR 门禁规则 |
| `docs/agent-guardrails/zmtg-ui-test-reviewer.md` | UI 测试质量审查规则 |
| `docs/agent-guardrails/zmtg-secret-migration-guard.md` | Secret/Migration/Smoke 门禁规则 |
| `.claude/skills/zmtg-pr-gatekeeper/SKILL.md` | Claude Code 显式启用时的 PR 门禁兼容 Skill |
| `.claude/skills/zmtg-ui-test-reviewer/SKILL.md` | Claude Code 显式启用时的 UI 测试审查兼容 Skill |
| `.claude/skills/zmtg-secret-migration-guard/SKILL.md` | Claude Code 显式启用时的 Secret/Migration 门禁兼容 Skill |

## 禁止事项

以下是 V1 规则包建设任务自身的交付边界，不构成对以后经当前任务明确授权的 Runtime 开发的长期禁止；后续任务仍以 `AGENTS.md` 和统一治理规则为准。

- 不改业务代码（`src/**`）
- 不改 schema / migration
- 不改 package.json / lockfile
- 不输出任何 secret
- 不执行 `pnpm db:migrate`
- 不运行 smoke
