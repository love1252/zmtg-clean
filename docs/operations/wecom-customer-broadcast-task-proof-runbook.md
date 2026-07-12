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

## 05B-B2 mock-only 范围

05B-B2 只增加可在测试或显式 service 注入中使用的 mock provider contract 和 protected recipient resolver mock。它用于验证低敏 contract、固定 outcome 分类及 fail-closed 分支，不接入运行时 API route，也不构成真实 provider 实现。

Mock provider 必须保持纯本地、低敏且无副作用：不读取环境变量或 `.env.local`，不读取 secret，不获取 access token，不执行 `fetch`，不调用企业微信，也不保存真实 recipient、消息原文、原始 `msgid`、provider URL 或 raw response。

Mock provider 返回 `accepted / task_created` 时，execution shell 只能将其映射为 `task_created_mock`。该结果只证明 mock provider 接受了“创建任务”意图，明确不代表：

- 真实企业微信任务已创建；
- 客户已收到消息；
- proof operation 已 `succeeded`；
- `completedCount` 可以增加。

05B-B2 不得调用 0036 success finalize。当前也没有经审批的数据结构可持久化真实 `task_created` 或 `awaiting_member_confirmation` 状态，因此本阶段不新增 0037。

运行时 API 边界保持不变：`create_task_once` 固定返回 `provider_disabled`，不调用 mock provider，不消费 confirmation token，不进入 `attempted`，也不执行 `fetch`。Mock provider 只能由测试或显式 service 注入路径调用，不能通过 route 激活。

## 05B-B3-A 真实任务创建准入地基

05B-B3-A 只解除后续真实任务创建所需的数据与身份准入阻断，不实现真实 provider。0037 只新增三类 sidecar 基础：正式账号机构绑定、客户群发任务 outcome、受保护 recipient binding metadata；不修改 0034、0035 或 0036。

正式 `server_session` 的 `institutionId` 只能来自当前租户下唯一、未撤销、未过期且已生效的 active institution binding。无绑定、多 active 绑定、revoked 绑定、`migration_placeholder` 或非法时间/版本都返回 `institutionId=null` 并对 `execute_once` 失败关闭。禁止从请求体、客户、draft、租户单机构假设或演示常量推断；`demo_session` 不使用正式绑定。

Outcome sidecar 将真实任务创建与后续发送结果分离：

- `task_create_attempted` 最多一次；
- `task_created` 只保存 64 位 `task_ref_digest`，仍需员工确认；
- `awaiting_member_confirmation` 不表示客户已收到；
- `target_sent` 只是后续 `succeeded` 的候选证据；
- `task_create_failed`、`task_create_unknown`、`target_failed` 和 `target_unknown` 都不能增加 `completedCount`；
- unknown 或 `manual_review_required` 固定禁止自动重试。

05B-B3-A 的 outcome service 只接受闭合的九类 action，并通过完整 tenant/institution/customer/operation ID/operation reference scope 与 version CAS 写 sidecar；调用方不能注入任意 transition callback。它不调用 0036 success finalizer；即使得到 `target_sent`，也保持 `not_finalized`。只有后续独立授权任务确认精确发送结果 `status=1` 后，才可评估 0036 成功终态与 `completedCount` 回写。

真实 recipient resolver 只按 tenant、institution、customer、operation、mapping、binding reference/digest/version 解析低敏 metadata，并最多返回 binding reference、digest、version 与 opaque handle。数据库不保存或返回真实 recipient 标识；revoked、stale、多条匹配、scope/digest/version 不一致及 resolver 不可用都失败关闭。

本阶段运行时代码不配置或主动读取 secret，不获取 access token，不调用企业微信，不创建真实任务，不查询发送结果，也不真实发送。运行时 API 的 `create_task_once` 继续固定 `provider_disabled`。05B-B3-B、05B-B3-C、05C 和 05D 均需独立授权。

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

- 05B-B2 仅覆盖 mock adapter、resolver mock 和显式 service 注入，不得真实出网。
- 05B-B3-A 仅提供 formal institution binding、0037 sidecar 与 resolver 边界，不得调用真实 provider。
- 05B-B3-B / B3-C 才可能在独立安全复核和明确授权后分别实现 provider 与 outcome proof；此前不得调用真实 `add_msg_template` 或发送结果查询。
- 0037 只承载本手册所述准入地基，不授权真实任务创建，也不修改 0034、0035 或 0036。
- 05C、05D 不属于本手册授权范围。

## B1 验收检查

1. GET preflight 不签发 token、不读取 body，并返回 `Cache-Control: no-store`。
2. POST 在读取 body 前完成 401/403 判断，请求体限制为 1024 UTF-8 bytes 且使用 exact-key parser。
3. `issue_confirmation` 最多签发一次 token，不调用 provider。
4. `create_task_once` 固定 fail-closed，不消费 token、不进入 `attempted`。
5. 服务端 `fetch=0`，无 provider client、worker、queue、scheduler、webhook 或自动重试。
6. 不运行 migration 或 seed，不配置 secret，不读取 `.env.local`。

## B2 验收检查

1. Mock provider 只接受低敏 contract 字段，并覆盖 `accepted`、`rejected`、`timeout`、`transport_error` 和 `indeterminate` 固定分类。
2. Resolver mock 只校验 binding reference、digest 和 version，不返回真实 recipient 标识。
3. Mock provider 只有显式注入 service 时可执行；默认 execution shell 和运行时 API 均保持 `provider_disabled`。
4. `task_created_mock` 不进入 `succeeded`，不增加 `completedCount`，不调用 success finalize。
5. API route 不 import 或调用 mock provider，不消费 token、不进入 `attempted`，服务端 `fetch=0`。
6. 不读取环境变量、secret 或 `.env.local`，不获取 access token，不调用企业微信，不真实创建任务或发送。

## 05B-E 功能化接入

05B-E 将既有 0037 outcome sidecar 接入受控系统工作流，但仍不是企业微信
真实执行发布。新增 runtime adapter 壳默认 `provider_disabled`：它不读取
`.env.local` 或环境变量、不获取 access token、不执行网络请求，也不保存原始
任务标识、provider 响应、真实 recipient 或消息正文。未来真实 adapter 必须在
独立授权下显式注入 fetcher、token provider、recipient resolver 和 executor。

受控执行服务仅允许把 sidecar 推进为：

- `task_create_attempted`；
- `task_created`；
- `awaiting_member_confirmation`；
- 因失败或不可判定而进入 `manual_review_required`。

`task_created` 只代表企业微信任务创建被接受；它不等于客户已收到。05B-E 不自动
查询发送结果，不进入 `succeeded`，不增加 `completedCount`，也不自动重试。

POST route 继续默认让 `create_task_once` 返回 `provider_disabled`，不消费
confirmation token、不进入 attempted。新增 `mark_manual_review_required` 仅接受
固定低敏 reason code：`task_digest_not_found`、`provider_result_unmatched` 或
`employee_confirmation_reported_by_user`；不接受人工自由文本。该动作按
tenant + institution + draft + operation scope 解析 sidecar，并只写
`manual_review_required` 状态，不能把人工反馈直接视为送达或成功。
