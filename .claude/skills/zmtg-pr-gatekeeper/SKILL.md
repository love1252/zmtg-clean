---
name: zmtg-pr-gatekeeper
description: PR 门禁检查 — 分支基线、PR body 一致性、文件数量、测试结果、Draft 状态。
---

# zmtg-pr-gatekeeper

## 使用场景

每次 Claude 创建或更新 PR 时使用此 Skill 进行自检。

## 必须执行的检查

1. 确认当前分支从最新 `main` 创建，`main = origin/main`。
2. `gh pr diff --name-only` 与 PR body 标注的 changed files 数量一致。
3. 测试通过数与 PR body 一致。
4. PR 状态（Draft/Ready）与 GitHub 一致。
5. PR body 不包含矛盾描述（如已 Ready 但写"not Ready for merge"）。
6. 回报中的 HEAD / 分支 / PR 编号与实际一致。

## 禁止事项

- 不得写假测试数。
- 不得写完"不做测试文件"但实际有。
- 不得在 body 写 Draft 但 GitHub 已 Ready。

## 停止条件

- 任何一项检查不一致 → 修正后再回报。

## 回报模板

```
- 分支/HEAD:
- changed files (实际):
- changed files (PR body):
- 是否一致:
- 测试结果 (实际):
- 测试结果 (PR body):
- 是否一致:
- Draft/Ready (实际):
- Draft/Ready (PR body):
- 是否有越界文件:
- 结论:
```
