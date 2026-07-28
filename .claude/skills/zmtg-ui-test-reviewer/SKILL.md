---
name: zmtg-ui-test-reviewer
description: UI 测试质量审查 — 空 waitFor、加载失败 disabled、安全断言、覆盖度。
---

# zmtg-ui-test-reviewer

本 Skill 是 Claude Code 的可选兼容规则，不代表 Claude Code 是默认开发者。只有用户在当前任务中明确启用 Claude Code 时才使用。

执行时必须服从 `AGENTS.md`、`docs/ai-agent-governance.md` 和 `docs/agent-guardrails/zmtg-ui-test-reviewer.md`；发生冲突时以上级规则为准。

## 使用场景

用户明确授权 Claude Code 实现 UI 测试时，完成后使用此 Skill 自检；用户只授权独立复核时，仅报告发现和阻断项，不修改测试。不得假定 Codex 只负责 Claude 完成后的复核。

## 必须执行的检查

1. 是否存在空 `waitFor`（只有注释、没有 `expect`）。
2. 每个 `it` 块是否至少有一个 `expect`。
3. 加载失败场景（401/403）是否断言：
   - 所有输入框 disabled
   - 保存/删除按钮 disabled
   - 无 POST/PUT/DELETE mutation
4. 是否覆盖 401 和 403 两种错误。
5. 是否断言不展示 `apiKey` / `encryptedApiKey` / `ciphertext` / `authTag` / `iv`。
6. API Key 保存后是否清空输入框。
7. 全局 mock 是否有 `afterEach`/`beforeEach` 清理。

## 禁止事项

- 不得有空 `waitFor`。
- 不得只有注释没有断言。
- 不得删除关键安全断言。
- 不得只覆盖成功路径。
- 不得与 Codex 并发修改同一分支、文件或 Git 索引。
- 单次启用 Claude Code 不改变 Codex 的默认主开发地位。

## 停止条件

- 独立复核模式发现空 `waitFor`、安全断言缺失或覆盖不足 → 报告阻断项，不修改测试。
- 用户明确授权的实现范围包含测试修改 → 由当前写入执行者修正或补充后重新检查。

## 回报模板

```
- 测试文件:
- 测试数:
- 空 waitFor:
- disabled 断言:
- 401/403 覆盖:
- mutation 断言:
- secret 断言:
- API Key 清空断言:
- 结论:
```
