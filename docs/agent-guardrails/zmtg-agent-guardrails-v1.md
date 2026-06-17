# zmtg-agent-guardrails-v1：规则包总览

## 目的

为 zmtg-clean 项目建立 Claude 专属规则与 Skills，强化 Claude 在本项目中的边界控制、PR 自查、UI 测试质量和 secret/migration/smoke 门禁。

V1 只做文档和 skills，不做脚本 / hooks。V2 考虑 `scripts/agent-guards/*` 和自动检查脚本。

## 三个 guardrail

### 1. zmtg-pr-gatekeeper

PR 门禁规则，覆盖：

- 分支与 main 基线检查
- PR body 与 changed files / 测试结果一致性
- Draft / Ready 状态一致性
- PR 体量控制（一个功能点一个 PR）
- 回报内容与实际情况一致性

### 2. zmtg-ui-test-reviewer

UI 测试质量审查规则，覆盖：

- 禁止空 `waitFor` 和 comment-only 测试体
- 加载失败（401/403）时必须断言输入框和按钮 disabled
- 必须断言无 POST/PUT/DELETE mutation
- 必须断言不展示 secret 字段
- 401 和 403 都要覆盖

### 3. zmtg-secret-migration-guard

Secret / Migration / Smoke 门禁规则，覆盖：

- 默认禁止 migration / smoke / secret 读取
- 授权后必须确认数据库类型才可执行
- 只能回报存在 / 缺失 / 通过 / 失败，不输出具体值
- 发现泄漏风险必须停止

## Claude / ChatGPT / Codex 新协作流程

### Claude（主开发）

- 从最新 `main` 创建功能分支
- 按任务目标完整实现功能
- 补齐必要测试
- 运行 `tsc` 和相关测试
- 创建 Draft PR
- 回报 changed files、验证结果、是否越界、PR 链接
- 停止，等待审查

### ChatGPT（任务边界与 PR 审查）

- 审查 Claude 产出的 PR
- 检查任务边界是否越界
- 检查 PR body 与实际是否一致
- 检查测试覆盖是否充分
- 决定是否转 Ready

### Codex（深度复核）

- 仅在 Ready 前做最终复核
- 高风险任务（migration/smoke/secret）做深度检查
- 不做日常开发，不重复 Claude 已完成的工作

## V1 范围

| 文件 | 说明 |
|------|------|
| `CLAUDE.md` | 项目顶级规则入口 |
| `docs/agent-guardrails/zmtg-agent-guardrails-v1.md` | 本文件，规则包总览 |
| `docs/agent-guardrails/zmtg-pr-gatekeeper.md` | PR 门禁规则 |
| `docs/agent-guardrails/zmtg-ui-test-reviewer.md` | UI 测试质量审查规则 |
| `docs/agent-guardrails/zmtg-secret-migration-guard.md` | Secret/Migration/Smoke 门禁规则 |
| `.claude/skills/zmtg-pr-gatekeeper/SKILL.md` | PR 门禁 Skill |
| `.claude/skills/zmtg-ui-test-reviewer/SKILL.md` | UI 测试审查 Skill |
| `.claude/skills/zmtg-secret-migration-guard/SKILL.md` | Secret/Migration 门禁 Skill |

## 禁止事项

- 不改业务代码（`src/**`）
- 不改 schema / migration
- 不改 package.json / lockfile
- 不输出任何 secret
- 不执行 `pnpm db:migrate`
- 不运行 smoke
