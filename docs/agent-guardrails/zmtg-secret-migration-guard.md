# zmtg-secret-migration-guard：Secret / Migration / Smoke 门禁规则

## 使用场景

Codex 或任何经当前任务明确授权的执行者，在涉及数据库、环境变量、Smoke 或真实环境前，都必须检查本规则。

## 必须检查

### 已授权功能的离线变更与隔离测试

功能必需的 schema、离线 Migration 文件、合成 seed 和隔离数据库测试包含在开发授权内，不重复申请。可以执行约束、事务、并发与回滚测试，并清理本任务创建的临时实例和数据目录。执行前确认：

- 数据库或实例由本任务新建，使用空库、合成数据和专用连接参数。
- 不加载项目真实 `.env`，不继承真实连接串或凭证，不使用真实业务数据副本。
- 连接及清理对象有明确的本任务标识，不影响其他实例。
- 既有数据库即使名称含 dev／test，也不自动属于隔离库；无法确认目标时暂停连接。

隔离测试不要求读取 `.env.local`、真实 `DATABASE_URL` 或真实加密密钥。以下凭证与真实环境门禁不应套用到纯离线变更；按目标环境及副作用判断，而非仅凭命令名称。

### 默认禁止

普通开发任务（实现功能、写测试、改 UI、写文档）默认禁止：

- 向已有或非隔离数据库执行 Migration／seed（包括 `pnpm db:migrate`）
- 运行真实 smoke test
- 读取 `.env.local`
- 读取或输出 `DATABASE_URL`
- 读取或输出数据库密码
- 读取或输出 `ZMTG_SECRET_ENCRYPTION_KEY`
- 读取或输出任何厂商 API Key（DeepSeek、豆包、千问、Kimi、智谱等）
- 输出任何 secret 到日志、PR body、测试快照、错误提示或 console

### 授权后允许

向已有或真实环境执行迁移、读取凭证及真实验收，只有在用户授权明确覆盖对象、环境与操作后才允许；已有授权无需重复申请：

1. **migration 前必须检查**：
   - `.env.local` 是否存在：只报存在 / 缺失，不输出内容。
   - `DATABASE_URL` 是否存在：只报存在 / 缺失，不输出值。
   - 确认数据库身份、授权环境及备份／回滚办法；仅凭变量名、host 或项目名称不足以确认可以操作，不输出完整连接值。
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

- 禁止在未授权情况下向已有或非隔离环境执行迁移；本任务新建隔离库的测试按上文执行。
- 禁止在未确认数据库类型的情况下执行 migration。
- 禁止把 API Key、DATABASE_URL、密码写入任何 git tracked 文件。
- 禁止把 secret 写入 PR body 或 commit message。
- 禁止在测试中硬编码真实 secret。
- 禁止绕过权限 guard 调用 API。

## 停止条件

- 需要向已有或非隔离环境执行 migration 但未获授权 → 暂停该动作，独立安全工作继续。
- 无法确认数据库是开发 / 测试库 → 停止。
- 发现 secret 可能已被写入日志或 PR body → 停止并报告。
- 不确定是否有权限读取环境变量 → 停止。

## 回报模板

以下模板仅用于真实环境操作。离线与隔离测试只报告对象、隔离依据、实际结果、未验证范围和是否影响真实数据，不填写真实凭证检查表。

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
