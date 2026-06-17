# zmtg-ui-test-reviewer：UI 测试质量审查规则

## 使用场景

Claude 写好 UI 测试后，Codex/ChatGPT 复核前，必须先自查本规则。

## 必须检查

### 空测试体

- 禁止存在空 `waitFor`（只有注释、没有 `expect` 的 `waitFor`/`await` 块）。
- 禁止用注释替代断言。
- 每个 `it` 块至少包含一个 `expect`。

### 加载失败 / 错误状态

UI 组件在数据加载失败（401 / 403 / 网络错误）时，必须：

1. 断言所有输入框 disabled（`Base URL`、`Model`、`API Key` 等）。
2. 断言保存按钮 disabled。
3. 断言删除按钮 disabled（如果存在）。
4. 断言没有发出 POST / PUT / DELETE mutation 请求。
5. 断言页面显示清晰的低敏错误提示。
6. 不通过点击 disabled 按钮来"证明"没有请求，应该直接检查按钮 disabled 状态并检查 fetch calls。

### 安全边界

- 必须断言页面不展示 `apiKey`、`encryptedApiKey`、`ciphertext`、`authTag`、`iv`。
- 必须断言 API Key 输入框 type="password"。
- 必须断言保存成功后 API Key 输入框清空。
- 不能为了通过测试而删除关键安全断言。
- 安全边界不能只靠函数 early return，必须有可见的 disabled / error state。

### 覆盖度

- 401 和 403 两种错误状态必须都覆盖（可以参数化）。
- 不能只覆盖 401 而跳过 403。

### 无污染

- 测试必须通过 `afterEach` / `beforeEach` 清理全局状态。
- 测试之间不能互相影响（每个测试有独立的 mock）。

## 禁止事项

- 禁止保留空 `waitFor`。
- 禁止只有注释没有断言的测试。
- 禁止为了通过而删除关键断言（如安全边界断言）。
- 禁止只覆盖成功路径，不覆盖错误路径。

## 停止条件

- 发现空 `waitFor` 或空测试体，必须修正。
- 发现关键安全断言被删除，必须恢复并补充。
- 不确定测试是否覆盖充分，停止并汇报。

## 回报模板

```
UI 测试审查：
- 测试文件:
- 测试数量:
- 是否有空 waitFor:
- 是否断言加载失败 disabled 状态:
- 是否覆盖 401 / 403:
- 是否断言无 mutation:
- 是否断言不展示 secret:
- API Key 保存后是否清空:
- 结论: PASS / FAIL
```
