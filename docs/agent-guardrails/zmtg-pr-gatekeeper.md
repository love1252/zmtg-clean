# zmtg-pr-gatekeeper：PR 门禁规则

## 使用场景

每次 Claude 创建或更新 PR 时，都必须检查本规则。

## 必须检查

### 分支与基线

- 功能分支必须从最新 `main` 创建。
- `main` 必须与 `origin/main` 一致。
- working tree 在创建分支前必须 clean。

### PR 状态

- Claude 默认只能创建 **Draft PR**。
- 未经用户明确授权，**禁止自动转 Ready**。
- 未经用户明确授权，**禁止自动合并**。
- PR 的 Draft / Ready / Merged 状态必须与 `gh pr view` 实际返回一致。

### PR body 一致性

PR body 必须与以下内容一致：

1. **文件数**：body 写的 changed files 数量必须等于 `gh pr diff --name-only` 的行数。
2. **测试数**：body 写的测试结果（如"8/8 passed"）必须与实际 `npx vitest run` 结果一致。
3. **未包含内容**：body 必须写清本次 PR 未包含的内容（不改 schema / migration / smoke / UI 等）。
4. **状态行**：Draft 必须写明"Draft — not Ready for merge. Awaiting review."，不允许出现矛盾描述（如已 Ready 但还写 Draft）。

### PR 体量

- 一个 PR 只解决一个功能点。
- 禁止在一个 PR 中混入无关功能、配置修复、文档清理。
- 运行时 PR 原则上最多 5 个核心文件。
- docs-only PR 原则上最多 3 个文档文件。

### 回报一致性

每次任务结束后，回报中的：

- changed files 必须等于 `git diff --stat` 的实际文件；
- 测试结果必须等于实际运行结果；
- 分支 / HEAD / PR 编号必须等于实际值。

## 禁止事项

- 禁止 PR body 写"不做测试文件"但实际有测试文件。
- 禁止 PR body 写"8/8"但实际只有 7 个测试。
- 禁止回报中说"不改 smoke"但实际 diff 包含 smoke 文件。
- 禁止 body 写 Draft 但 GitHub 上已经是 Ready。

## 停止条件

- 发现 PR body 与实际不一致，必须先修正再继续。
- 发现 diff 包含未授权文件，必须停止并回报。
- 不确定文件是否在本任务允许范围内，必须停止。

## 回报模板

```
PR 门禁检查：
- 分支/HEAD:
- changed files (实际):
- changed files (PR body):
- 是否一致:
- 测试结果 (实际):
- 测试结果 (PR body):
- 是否一致:
- Draft/Ready 状态 (实际):
- Draft/Ready 状态 (PR body):
- 是否有越界文件:
- 结论: PASS / FAIL
```
