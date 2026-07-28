# zmtg-secret-migration-guard：Secret / Migration / Smoke 门禁规则

## 使用场景

Codex 或任何经当前任务明确授权的执行者，在涉及数据库、环境变量、Smoke 或真实环境前，都必须检查本规则。

## 必须检查

### 默认禁止

普通开发任务（实现功能、写测试、改 UI、写文档）默认禁止：

- 执行 `pnpm db:migrate`
- 运行真实 smoke test
- 读取 `.env.local`
- 读取或输出 `DATABASE_URL`
- 读取或输出数据库密码
- 读取或输出 `ZMTG_SECRET_ENCRYPTION_KEY`
- 读取或输出任何厂商 API Key（DeepSeek、豆包、千问、Kimi、智谱等）
- 输出任何 secret 到日志、PR body、测试快照、错误提示或 console

### 授权后允许

只有在用户**明确在当前任务中授权**后，才允许：

1. **migration 前必须检查**：
   - `.env.local` 是否存在：只报存在 / 缺失，不输出内容。
   - `DATABASE_URL` 是否存在：只报存在 / 缺失，不输出值。
   - 是否能确认数据库是开发 / 测试库，不是生产库：只根据"变量名 / host 标识 / 项目名"判断，不输出完整值。
   - 如无法确认是开发 / 测试库，**必须停止**。
   - `ZMTG_SECRET_ENCRYPTION_KEY` 是否存在：只报存在 / 缺失，不输出值。

2. **真实环境验收时**：
   - 即使授权，也只能回报 **存在 / 缺失 / 通过 / 失败**，不得输出具体值。
   - API Key 只能通过表单或 curl body 传入，不能出现在日志、PR body 或测试快照中。
   - 如果调用接口需要认证 cookie/token 而当前没有安全方式，**不要绕过 guard**，停止并回报。

### 日志安全

- 开发服务器日志、测试输出、错误信息中不得出现：
  - `DATABASE_URL` 完整值
  - 数据库密码
  - `ZMTG_SECRET_ENCRYPTION_KEY`
  - 厂商 API Key
  - `encryptedApiKey`、`ciphertext`、`authTag`、`iv`
- 如需提到变量，只允许写"存在 / 缺失 / 已确认"。

## 禁止事项

- 禁止在未授权情况下执行 `pnpm db:migrate`。
- 禁止在未确认数据库类型的情况下执行 migration。
- 禁止把 API Key、DATABASE_URL、密码写入任何 git tracked 文件。
- 禁止把 secret 写入 PR body 或 commit message。
- 禁止在测试中硬编码真实 secret。
- 禁止绕过权限 guard 调用 API。

## 停止条件

- 需要执行 migration 但未获授权 → 停止。
- 无法确认数据库是开发 / 测试库 → 停止。
- 发现 secret 可能已被写入日志或 PR body → 停止并报告。
- 不确定是否有权限读取环境变量 → 停止。

## 回报模板

```
Secret/Migration 门禁检查：
- .env.local 是否存在:
- DATABASE_URL 是否存在:
- 是否确认数据库为开发 / 测试:
- ZMTG_SECRET_ENCRYPTION_KEY 是否存在:
- 是否已授权 migration:
- 是否已授权 smoke:
- 是否输出 secret 值:
- 结论: PASS / FAIL
```
