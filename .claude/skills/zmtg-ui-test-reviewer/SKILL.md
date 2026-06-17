---
name: zmtg-ui-test-reviewer
description: UI 测试质量审查 — 空 waitFor、加载失败 disabled、安全断言、覆盖度。
---

# zmtg-ui-test-reviewer

## 使用场景

Claude 写好 UI 测试后，Codex 复核前，使用此 Skill 自检。

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

## 停止条件

- 发现空 `waitFor` → 修正。
- 发现安全断言缺失 → 补充。
- 401/403 未覆盖 → 补充。

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
