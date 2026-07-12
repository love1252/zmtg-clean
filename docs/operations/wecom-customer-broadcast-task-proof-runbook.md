# 企业微信单客户群发任务 proof 运行手册

## 能力边界

05B-B1 选择的官方能力路线是“创建单客户企业群发任务 proof”，不是通用的服务端直接单客户私聊发送。

创建任务后，员工仍需在企业微信客户端内确认。`task_created` 只表示群发任务已被创建，不表示客户已收到消息，也不得将 proof operation 标记为 `succeeded`。只有后续发送结果查询明确返回 `status=1`，才可作为成功终态的候选证据；发送结果查询本身不属于 05B-B1。

## 05B-B1 范围

本阶段只提供：

- `demo_session` 与 `server_session` provenance 基础；
- 客户群发任务的低敏 domain contract；
- provider contract 和受保护 recipient binding resolver contract；
- 真实发送 API 壳和 fail-closed execution shell；
- route、权限、请求体和低敏响应测试。

本阶段不提供 provider adapter，不获取 access token，不调用企业微信接口，不读取 secret，不执行真实网络请求，也不真实发送。

`create_task_once` 必须返回 `provider_disabled` 或等价的固定阻断结果。阻断发生在 confirmation token 被消费之前，因此 operation 不得进入 `attempted`，`attempt_count` 不得增加。

## Provider contract

能力固定为：

- `capabilityKind=customer_broadcast_task`
- `directSend=false`
- `requiresEmployeeConfirmation=true`
- `messageKind=text`
- `acceptanceKind=task_created`

Provider input 只允许低敏字段：operation reference、recipient binding reference/digest/version、content reference/hash 和两个固定 kind。任务创建结果只使用以下固定分类：

- `accepted / task_created`
- `rejected`
- `timeout`
- `transport_error`
- `indeterminate`

不得把 `accepted / task_created` 直接传给现有 success finalize；该路径会错误地把任务创建当成客户已收到，并可能错误增加 `completedCount`。

## Protected recipient resolver

Resolver 必须同时绑定 `tenantId`、`institutionId` 和 `operationRef`，并核对 recipient binding reference 与 digest。它只返回低敏 binding reference、digest 和 version，不能把真实接收目标暴露给 API route、execution shell、audit、timeline 或日志。

当前 0036 operation ledger 没有独立的 recipient binding version 字段。本阶段不得使用 operation version 冒充 binding version，也不得为此新增 migration。后续 adapter 只能通过另行复核的受保护 resolver 获取当前 binding version。

## Session 与机构范围

`demo_session` 永远不能获得 `real_channel / execute_once`。`server_session` 还必须同时具备 tenant scope、`tenantId`、权威 `institutionId` 和 `tenant_admin` 权限。

当前正式账号 membership 没有权威 `institutionId` 时，执行路径必须保持 fail-closed。禁止从请求体、draft、customer、演示常量或“租户只有一个机构”的假设中推导机构范围。

## 敏感数据禁令

以下内容不得进入 contract、数据库新增字段、请求或响应日志、audit、timeline、错误消息和测试快照：

- `external_userid`、`UserID` 或真实 recipient 原文；
- 原始 `msgid`、provider URL、provider raw response；
- 消息内容原文；
- `access_token`、secret、密码或数据库连接信息。

Confirmation token 明文只允许在签发成功响应中返回一次；持久化仍只保存 digest。不得记录、重放或在 existing operation 响应中返回旧 token。

## 后续阶段

- 05B-B2 只允许在获得独立授权后增加 mock adapter，用于验证 contract 和 unknown-outcome 分支；不得真实出网。
- 05B-B3 才可能在独立安全复核和明确授权后实现真实 provider，并必须补齐员工确认后的发送结果查询。
- 0037 只在真实任务 outcome proof 的数据需求获得单独审批后再规划。本阶段不得新增 0037，也不得修改 0034、0035 或 0036。
- 05C、05D 不属于本手册授权范围。

## B1 验收检查

1. GET preflight 不签发 token、不读取 body，并返回 `Cache-Control: no-store`。
2. POST 在读取 body 前完成 401/403 判断，请求体限制为 1024 UTF-8 bytes 且使用 exact-key parser。
3. `issue_confirmation` 最多签发一次 token，不调用 provider。
4. `create_task_once` 固定 fail-closed，不消费 token、不进入 `attempted`。
5. 服务端 `fetch=0`，无 provider client、worker、queue、scheduler、webhook 或自动重试。
6. 不运行 migration 或 seed，不配置 secret，不读取 `.env.local`。
