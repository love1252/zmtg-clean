# Phase 23 HIS 周期健康检查 system actor 审计上下文边界规划

> 日期：2026-06-07
> 状态：docs-only Plan Mode。本文只规划 Phase23-TC-12B system actor / service actor 审计上下文边界，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不实现 system actor runtime，不实现 service actor runtime，不修改 `AccessRole` / `AccessScope` / `AccessContext` runtime，不新增 audit runtime，不实现 candidate query runtime，不实现 runner runtime，不实现 scheduler runtime，不新增 cron / queue / worker，不接真实 credential provider，不读取真实凭证，不接真实 HIS adapter，不发起外部网络请求，不回到 compensation / recovery runtime，不修改 package / lockfile。

## 只读盘点结论

1. 当前本地 `main` 与 `origin/main` 均位于 `38d03db81a2ce334f686be8ab022f00133cc7b54`，工作区 clean。
2. 当前 `AccessRole` 只有 `tenant_admin / tenant_operator / consultant / customer_service / platform_admin / platform_operator / security_auditor`，不支持 `system`。
3. 当前 `AccessScope` 只有 `platform | tenant`，不支持 `system`。
4. 当前 `AccessContext.source` 只有 `demo_session | server_session | trusted_gateway`，不支持 `scheduled_health_check`。
5. 当前 `TenantAuditEvent` 的 `actorId / actorRole / tenantId / scope / source` 均从 `AccessContext` 推导。
6. 当前 `createAuditEvent` 与 `createDeniedAccessAuditEvent` 都绑定 `AccessContext`，没有单独的 system audit factory。
7. 当前手动测试连接 route / service 均使用人工用户 `AccessContext` 写 `test_connection` audit。
8. 当前 audit action 使用 `ProtectedAction`，与 access action 共用 `ACCESS_ACTIONS`，因此新增 `scheduled_health_check` 需要先评估是否会污染权限模型。
9. 当前 audit query parser 支持 `action / reason / actorId` 查询，不支持 `actorRole / scope / source` 查询。
10. TC-12A 已明确周期健康检查建议使用 `scheduled_health_check` action，且 system actor / service actor 需要单独规划。
11. 旧 compensation 文档与 worker runtime 有后台 worker、claim、lock、retry、backoff 概念，但不提供周期健康检查的一等 system actor 表达。
12. 本轮可以只做 Plan，不需要改 schema / migration，不需要改 runtime type，不需要写 audit runtime，不需要写 runner runtime。

## 本轮范围

本轮只规划：

- system actor / service actor 的语义边界。
- system actor 如何用于周期健康检查 audit。
- system actor 与人工用户 access context 的边界。
- system actor 与 scheduled health check action / reason 的关系。
- 后续 runtime / schema 是否需要拆分评估。

本轮明确不做：

- 不实现 system actor runtime。
- 不实现 service actor runtime。
- 不修改 `AccessRole` runtime。
- 不修改 `AccessScope` runtime。
- 不修改 `AccessContext` runtime。
- 不新增 audit runtime。
- 不新增 audit action runtime。
- 不实现 candidate query runtime。
- 不实现 runner runtime。
- 不实现 scheduler runtime。
- 不新增 cron / queue / worker。
- 不新增 schema。
- 不新增 migration。
- 不修改 `src/**`。
- 不修改 `drizzle/**`。
- 不修改 package / lockfile。
- 不接真实 credential provider。
- 不读取真实凭证。
- 不接真实 HIS adapter。
- 不发起外部网络请求。
- 不保存 raw HIS payload、provider raw error 或 external response body。
- 不回到 compensation / recovery runtime。

## system actor / service actor 定位

system actor / service actor 是后台系统任务在 audit 中的可信执行主体表达，用于区分“系统自动执行”和“人工用户触发”。

system actor / service actor 应负责表达：

- 后台任务由系统调度触发。
- 执行主体不是人工用户。
- 执行来源来自服务端 runner / scheduler。
- 审计事件可追踪到稳定系统主体。
- per-tenant 或 per-connection 执行仍受 tenant guard 约束。
- 执行主体不携带真实凭证、endpoint 或外部响应。

system actor / service actor 不是：

- 不是 tenant admin。
- 不是 platform admin。
- 不是 audit viewer。
- 不是前端用户。
- 不是 route access context。
- 不是真实 HIS adapter。
- 不是 credential provider。
- 不是 runner runtime。
- 不是 scheduler runtime。
- 不是 cron / queue / worker runtime。
- 不是 compensation / recovery worker。
- 不是可以绕过租户隔离的万能身份。

## 与人工 access context 的区别

手动测试连接：

- 由 HTTP route 触发。
- 使用当前登录用户的 `AccessContext`。
- 需要 `open_connection:test_connection` 权限。
- audit actor 是人工用户。
- audit source 来自用户请求上下文。
- tenantId 来自人工用户 access context。

周期健康检查：

- 由服务端 scheduler / runner 触发。
- 不应伪装成人工用户。
- 不应使用某个 `tenant_admin` 的 userId。
- 不应使用 `platform_admin` 冒充系统任务。
- 权限来源应来自服务端调度配置和任务上下文，不来自 HTTP 请求。
- system actor 只能在服务端 runner / scheduler 内部构造。
- system actor 不能从前端 body / query / header 传入。
- system actor 不能被 route 直接使用来绕过用户权限。
- system actor 的 tenant 作用域应来自 candidate query / runner 上下文，不来自客户端。

推荐约束：

- 人工 access context 与 system actor context 应是不同类型或至少不同 factory。
- route 层不得接受 `actorId = system:*` 作为输入。
- demo session / server session / trusted gateway 不应被直接当成 scheduled health check source。
- 如果短期需要兼容旧 audit event shape，也必须显式标记为降级方案。

## 推荐上下文字段

建议后续规划 system actor / service actor 上下文语义：

```ts
type SystemActorContext = {
  actorId: 'system:his-health-check-runner';
  actorType: 'system';
  actorRole: 'system';
  scope: 'system' | 'tenant';
  source: 'scheduled_health_check';
  tenantId?: string;
  runId: string;
  jobId?: string;
};
```

字段边界：

- `actorId` 必须是稳定 server-defined 字符串。
- `actorId` 推荐使用 `system:his-health-check-runner`。
- `actorType` 如当前模型没有，应列为后续类型扩展候选。
- `actorRole = system` 如当前 `AccessRole` 不支持，应列为后续类型扩展候选。
- `scope = system` 如当前 `AccessScope` 不支持，应列为后续类型扩展候选。
- `scope = tenant` 可用于 per-tenant / per-connection 执行阶段，但仍必须区分系统执行主体。
- `source = scheduled_health_check` 如当前 source 不支持，应列为后续类型扩展候选。
- `tenantId` 只能在 per-tenant / per-connection execution 阶段绑定。
- `runId` 由服务端生成，必须稳定、可追踪、不可包含敏感字段。
- `jobId` 可选，只能是服务端生成的安全 id。
- 不允许使用 credentialRef、endpoint、secret path 作为 actor 相关字段。
- 不允许把系统 actor 写成真实用户 ID。

## 当前类型差距

当前类型不支持一等 system actor：

- `AccessRole` 不支持 `system`。
- `AccessScope` 不支持 `system`。
- `AccessContext.source` 不支持 `scheduled_health_check`。
- `TenantAuditEvent.actorRole` 使用 `AccessContext['role']`。
- `TenantAuditEvent.scope` 使用 `AccessContext['scope']`。
- `TenantAuditEvent.source` 使用 `AccessContext['source']`。
- `createAuditEvent` 必须接收 `AccessContext`。
- `createDeniedAccessAuditEvent` 也必须接收 `AccessContext`。

当前 audit query 能力差距：

- 已支持按 `action` 查询。
- 已支持按 `reason` 查询。
- 已支持按 `actorId` 查询。
- 不支持按 `actorRole` 查询。
- 不支持按 `scope` 查询。
- 不支持按 `source` 查询。

当前 action 类型风险：

- audit action 与 access action 共用 `ProtectedAction`。
- `ACCESS_ACTIONS` 是用户权限模型的一部分。
- 如果直接把 `scheduled_health_check` 加入 `ACCESS_ACTIONS`，可能把后台系统动作误放进人工权限模型。
- 如果强行复用 `test_connection`，会混淆 manual 与 scheduled。
- 如果强行复用 `tenant_admin`，会污染审计可信度。
- 如果强行复用 `platform_admin`，会把系统自动执行误导成平台人工操作。

本轮只规划差距，不修改类型。

## audit event 创建边界

建议后续不要把 `createDeniedAccessAuditEvent` 作为 system actor 的唯一入口。

建议后续规划单独 factory：

```ts
type CreateSystemAuditEventInput = {
  eventId: string;
  actor: SystemActorContext;
  tenantId: string | null;
  resource: 'open_connection';
  resourceId?: string | null;
  action: 'scheduled_health_check';
  result: 'allowed' | 'denied' | 'transitioned';
  reason: ScheduledHealthCheckAuditReason;
  occurredAt: string;
};
```

system audit event 仍需包含：

- `eventId`。
- `tenantId`。
- `actorId`。
- `actorRole` 或 `actorType`。
- `scope`。
- `source`。
- `resource`。
- `resourceId`。
- `action`。
- `result`。
- `reason`。
- `occurredAt`。

创建边界：

- 不允许 audit factory 从 HTTP request 中读取 system actor。
- 不允许从前端 header 读取 system actor。
- 不允许从前端 query 读取 system actor。
- 不允许从前端 body 读取 system actor。
- 不允许把前端 tenantId 写入 system audit。
- 不允许 audit event 保存 raw runner input。
- 不允许 audit event 保存 candidate bulk list。
- 不允许 audit event 保存 tenant bulk list。
- 不允许 audit event 保存 connection bulk list。
- 不允许 audit event 保存 credentialRef、endpoint、raw HIS payload、SQL 或 stack。
- system audit event 写入失败的 fail open / fail closed 策略应在后续 runtime PR 单独确定。

## action / reason 关系

建议结论：

- 手动测试连接继续使用 `test_connection`。
- 周期健康检查建议使用 `scheduled_health_check`。
- `scheduled_health_check` 更像 audit action，不一定是用户 permission action。
- 如果项目当前 action 类型来自 `ACCESS_ACTIONS`，需要后续评估是否拆出 audit action 类型。
- 不建议为了写 audit 把 `scheduled_health_check` 加进人工权限模型。
- 如果短期只能复用 `test_connection`，必须用 `source = scheduled_health_check` 或等价字段区分，但这是降级方案。
- 新 action / reason 必须进入 query whitelist。
- 不允许只写不可查。

reason 关系：

- TC-12A 已规划周期健康检查专用 reason。
- system actor 只表达执行主体，不替代 reason。
- reason 仍表达行为阶段或结果，例如 requested、started、provider healthy、repository write failed、completed、failed、backoff applied、lock conflict。
- actor 与 reason 不应混用；不能用 `actorId` 塞跳过原因，也不能用 reason 塞系统身份。

## tenant 绑定边界

scheduler 触发阶段：

- 可以是 global / system scope。
- 不应绑定完整 tenant 清单。
- 不应写完整 connection 清单。
- 只应记录安全 run summary。

runner 批次阶段：

- 可以按 tenant 分片。
- 必须受服务端 tenant allowlist 或分片配置约束。
- 不允许跨 tenant 混跑后写入单个 tenant audit。
- 不允许把 tenant bulk list 保存到 audit。

per-connection 执行阶段：

- 必须绑定具体 `tenantId`。
- 必须绑定具体 `connectionId`。
- audit 事件应写入具体 tenantId。
- repository query 仍必须绑定 `tenantId + connectionId`。
- health write 仍必须绑定 `tenantId + connectionId`。
- system actor 不能绕过 repository 的 tenant 条件。

全局 summary audit：

- 如后续需要全局 summary audit，应避免包含 tenant 清单和连接清单。
- 全局 summary 只能包含安全计数、runId、稳定状态和稳定错误码。
- 如当前 audit schema 不适合全局 summary，应后续单独规划。

## 安全 denylist

禁止在 system actor、audit event、runner summary、日志、错误、devlog、README、测试快照中出现：

- credentialRef 原值。
- secret path。
- token。
- api key。
- password。
- authorization header。
- basic auth。
- oauth token。
- private key。
- client_secret。
- connection string。
- `DATABASE_URL`。
- KMS key id。
- Vault path。
- secret manager path。
- HIS 账号。
- HIS 密码。
- HIS 厂商认证响应体。
- HIS 原始响应体。
- HIS 请求体。
- endpoint 原文。
- external headers。
- raw credential。
- raw HIS payload。
- provider raw error。
- patient data。
- appointment data。
- medical record data。
- prescription data。
- billing data。
- tenant bulk list。
- connection bulk list。
- raw SQL。
- query plan。
- SQL。
- stack。

## 与 candidate query 的关系

TC-12A 已规划 candidate query。

关系边界：

- candidate query 的 tenant scope 应来自 scheduler / runner 的服务端配置。
- system actor 不应作为 candidate query 的 tenant 过滤来源。
- system actor 只表达“谁执行任务”。
- system actor 不是“可以查全部 tenant 的凭证”的能力。
- candidate query 仍需显式 tenant guard。
- candidate query 仍需 batch guard。
- candidate query 不返回 credentialRef。
- candidate query 不返回 endpoint。
- candidate query 不返回可直接用于外部请求的凭证或地址材料。
- 本轮不实现 candidate query runtime。

## 与 runner / scheduler 的关系

TC-12B 是 runner / scheduler runtime 的前置边界。

没有 system actor / service actor 边界，不应直接实现 runner runtime。

runner runtime 至少还依赖：

- candidate query runtime。
- scheduled audit action / reason runtime。
- system actor factory。
- lock / lease / backoff 设计。
- real credential provider runtime。
- real HIS adapter runtime。

本轮不实现：

- runner runtime。
- scheduler runtime。
- cron / queue / worker。
- system actor factory runtime。
- scheduled audit runtime。

## 后续 PR 拆分建议

建议后续拆分：

1. Phase23-TC-12C：周期健康检查 durable lock / lease / backoff schema Plan Mode。
2. Phase23-TC-12D：周期健康检查 candidate query runtime。
3. Phase23-TC-12E：周期健康检查 audit action / reason runtime。
4. Phase23-TC-12F：system actor / service actor 最小 runtime。
5. Phase23-TC-12G：周期健康检查单实例 runner 最小 runtime。
6. Phase23-TC-12H：scheduler trigger Plan Mode。
7. Phase23-TC-12I：scheduler trigger runtime。
8. 真实 credential provider runtime 独立推进。
9. real HIS adapter runtime 独立推进。

顺序建议：

- 不要下一步直接实现 runner runtime。
- 下一步先做 durable lock / lease / backoff schema Plan Mode。
- 在 system actor runtime 前，应先决定 audit action 与 access action 是否拆分。
- 在 runner runtime 前，应完成 candidate query runtime、scheduled audit runtime、system actor factory、lock / lease / backoff 设计、真实 credential provider runtime 和 real HIS adapter runtime。
