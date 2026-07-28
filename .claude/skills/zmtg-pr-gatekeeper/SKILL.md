---
name: zmtg-pr-gatekeeper
description: PR 门禁检查 — 分支基线、PR 描述一致性、文件数量、测试结果、草稿状态。
---

# zmtg-pr-gatekeeper

本 Skill 是 Claude Code 的可选兼容规则，不代表 Claude Code 是默认开发者。只有用户在当前任务中明确启用 Claude Code，并授权其处理 PR 时才使用。

执行时必须服从 `AGENTS.md`、`docs/ai-agent-governance.md` 和 `docs/agent-guardrails/zmtg-pr-gatekeeper.md`；发生冲突时以上级规则为准。

该 Skill 的状态说明、PR 文案和面向用户的回报默认使用中文。GitHub 原生状态需要精确引用时，采用“中文说明（英文原始状态）”，例如“草稿（Draft）”和“已进入正式审查（Ready）”。不要求固定英文草稿（Draft）状态句；历史 Skill 模板与上级中文治理规则冲突时，以上级规则为准。

## 使用场景

用户明确授权 Claude Code 作为临时备用执行者创建或更新 PR 时，使用此 Skill 自检。若只授权独立复核，则只报告门禁结果，不修改分支、PR 描述（body）或 PR 状态。

## 必须执行的检查

1. 确认当前分支从最新 `main` 创建，`main = origin/main`。
2. `gh pr diff --name-only` 与 PR 描述标注的修改文件（changed files）数量一致。
3. 测试通过数与 PR 描述一致。
4. PR 状态与 GitHub 一致；面向人报告时写为草稿（Draft）、已进入正式审查（Ready）或已合并（Merged）。
5. PR 描述的状态说明以中文为主，不包含与 GitHub 实际状态冲突的草稿、正式审查或合并描述。
6. 回报中的 HEAD / 分支 / PR 编号与实际一致。
7. 修改文件（changed files）必须逐项属于当前任务允许范围，不能只比较数量。
8. PR 标题、描述和回报中的面向人内容符合上级中文优先规则，且中文化没有改写代码、测试数据或技术契约。

## 禁止事项

- 不得写假测试数。
- 不得写完“不做测试文件”但实际有。
- 不得在 PR 描述中写为草稿（Draft），但 GitHub 实际已进入正式审查（Ready）。
- 未经当前任务明确授权，不得进入正式审查（Ready）、合并（Merge）、推送 `main` 或启动下一任务。
- 单次启用 Claude Code 不改变 Codex 的默认主开发地位。

## 停止条件

- 独立复核发现不一致或越界文件 → 停止并报告，不修改仓库或 PR。
- 用户已明确授权 Claude Code 更新 PR，且问题位于允许范围内 → 修正后重新检查。
- 进入正式审查（Ready）、合并（Merge）、推送 `main` 或启动下一任务 → 即使已授权更新 PR，也必须取得对应动作的单独明确授权。

## 回报模板

```
- 分支／HEAD：
- 实际修改文件（changed files）：
- PR 描述中的修改文件：
- 是否一致：
- 实际测试结果：
- PR 描述中的测试结果：
- 是否一致：
- 实际草稿／正式审查状态（Draft／Ready）：
- PR 描述中的状态：
- 是否有越界文件：
- 结论：
```
