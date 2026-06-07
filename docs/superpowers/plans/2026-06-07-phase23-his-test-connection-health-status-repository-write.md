# Phase 23 HIS 测试连接健康状态 repository 写回边界规划

## 范围声明

- 本文档只规划 Phase23-TC-06：健康状态 repository 写回边界。
- 本轮只做 docs-only Plan Mode，不实现 repository runtime、route runtime、service runtime、parser runtime、DTO runtime、audit runtime、fake provider runtime、real provider、真实凭证读取、真实 secret manager / KMS / Vault、真实 HIS adapter、Webhook / 同步任务、runner / scheduler / cron、compensation runtime 或 recovery runtime。
- 本轮不修改 `src/**`、`drizzle/**`、schema / migration、package / lockfile、`.env` 或 `.codex/**`。
- 本文档承接 Phase23-TC-05：HIS 测试连接 route parser / DTO 边界规划。后续进入 runtime 前，仍必须单独实现 repository、fake provider service、route 和 audit。

## 开始前只读盘点结论

1. 本地 `main` 已同步 `origin/main`，两者均位于 `bffd772407df2d37d071bf313731527f34e0c950`。
2. 建分支前 working tree 为 clean。
3. `his_connections` schema 已存在健康状态枚举 `unknown / healthy / degraded / failed`。
4. `his_connections` schema 已存在 `healthStatus`、`lastCheckedAt`、`lastErrorCode` 和 `updatedAt`。
5. `his_connections` 已有 `tenantId + id` 唯一约束、`tenantId + deletedAt` 索引和 `tenantId + lastCheckedAt` 索引，健康写回可以继续绑定可信 `tenantId + connectionId`。
6. 当前 repository read model 已返回 `healthStatus`、`lastCheckedAt`、`lastErrorCode` 和 `updatedAt`。
7. 当前 repository 已有 create / update / pause / resume / revoke / softDelete / credential reference 写入方法。
8. 当前 `updateHisConnectionForTenant` 只允许写连接元数据，明确不适合复用为健康状态写回入口。
9. 当前 credential reference 写入 / 清空方法只处理 `credentialRef`、`updatedAt` 和 `updatedBy`，尚未重置健康状态。
10. 当前没有专门的健康状态 repository 写回方法。
11. 当前没有测试连接 service、fake provider service、测试连接 route runtime 或测试连接 audit runtime。
12. 既有 TC-01 到 TC-05 文档均将健康状态写回留作后续独立边界，本轮满足 docs-only 条件。
13. 因既有字段已经足够，本轮不需要规划新增 schema / migration；后续 runtime 也应优先复用现有字段。

## 写回职责结论

健康状态写回应由 service 调用 repository。

不允许 route 直接写 repository：

- route 只负责认证、权限、path `connectionId`、极薄 parser、route denied audit 和 HTTP 映射。
- route 不掌握 provider result、凭证可用性、连接状态快照、写回时机或 audit 顺序。
- route 直接写健康状态会绕过 service 对凭证、状态、provider result、错误脱敏和 audit 的统一编排。

repository 只负责持久化已归一化的健康摘要：

- 绑定可信 `tenantId + connectionId`。
- 确认连接未软删除。
- 校验健康状态枚举。
- 校验 `lastErrorCode` 是内部稳定 code。
- 只写健康摘要字段和 `updatedAt`。
- 返回稳定 repository result，不泄露数据库错误细节。

## repository 方法规划

后续 runtime 建议新增窄语义方法，例如：

```ts
writeHisConnectionHealthSummaryForTenant(command)
```

推荐 command 由 service 构造，不由 route 或前端构造。候选输入：

```ts
{
  tenantId: string;
  connectionId: string;
  healthStatus: 'unknown' | 'healthy' | 'degraded' | 'failed';
  checkedAt: Date | null;
  lastErrorCode: string | null;
  actorUserId: string;
  expectedUpdatedAt?: Date;
}
```

字段来源：

- `tenantId`：只能来自服务端 access context。
- `connectionId`：只能来自 route path，经 service 传入。
- `healthStatus`：只能来自 service 对 provider / fake provider result 的归一化结果。
- `checkedAt`：只能由服务端生成。
- `lastErrorCode`：只能来自内部 allowlist。
- `actorUserId`：只能来自服务端 access context。
- `expectedUpdatedAt`：来自 provider 调用前的连接快照，用于避免并发状态变化后写入过期健康结果。

repository 不接受：

- 前端传入的 `healthStatus`。
- 前端传入的 `checkedAt`、`lastCheckedAt` 或任意时间戳。
- 前端传入的 `lastErrorCode`。
- `status`、`credentialRef`、`tenantId` 覆盖、名称或厂商字段变更。
- 外部响应体、provider raw error、raw HIS payload、SQL、stack 或 `DATABASE_URL`。

## 不复用现有 update 方法

不建议复用 `updateHisConnectionForTenant`。

原因：

- 现有 update 方法只服务连接元数据：`connectionName`、`sourceSystem`、`vendorType`、`systemType`。
- 现有 update parser / service / tests 已把健康字段列为禁止写入字段。
- 复用普通 update 会让健康写回和人工编辑元数据共享入口，增加误写 `status`、凭证字段或租户字段的风险。
- 测试连接写回需要并发保护、状态约束、provider result 归一化和 audit 顺序，语义不同于普通配置编辑。

后续 runtime 可以复用底层安全 helper，例如行可见性检查、read model mapper 和脱敏错误构造，但不应把健康字段加入普通 update 的 values。

## 只允许写入字段

健康状态 repository 方法只允许写：

- `healthStatus`。
- `lastCheckedAt`。
- `lastErrorCode`。
- `updatedAt`。
- 可选 `updatedBy`，如果后续需要标记手动测试 actor；若保留，应只来自服务端 actor。

不允许写：

- `tenantId`。
- `connectionName`。
- `sourceSystem`。
- `vendorType`。
- `systemType`。
- `status`。
- `credentialRef`。
- `createdBy`、`createdAt`。
- `revokedAt`、`deletedAt`。
- compensation operation / job queue 字段。
- audit 表字段。
- 任意真实凭证、外部请求、外部响应或 raw payload。

## 状态枚举语义

后续 runtime 必须复用现有集合：

```text
unknown
healthy
degraded
failed
```

不新增平行枚举，不新增临时字符串，不把 provider 原始状态直接保存到 `healthStatus`。

推荐语义：

- `unknown`：从未检测、凭证清空、凭证撤销、连接状态不允许检测、或 service 明确需要重置健康状态。
- `healthy`：测试连接成功，且 provider / fake provider 返回可归一化的成功结果。
- `degraded`：连接可达但存在非致命异常、部分能力不可用、超时重试后成功，或后续 provider 明确支持降级状态。
- `failed`：测试连接失败，且可归因于明确失败。

## 成功写回规划

测试连接成功时，service 归一化为：

```text
healthStatus = healthy
lastCheckedAt = 服务端 checkedAt
lastErrorCode = null
updatedAt = repository 写入时服务端时间
```

要求：

- `checkedAt` 由 service 在测试连接流程中生成，不接受客户端时间。
- provider result 必须先归一化为安全结果，再调用 repository。
- repository 不保存 provider response body。
- repository 不保存外部 endpoint、header、trace、签名或 raw HIS payload。
- repository 写回成功后，DTO 可返回 `healthStatus` 和 `checkedAt` 的安全摘要。

## 失败写回规划

明确失败时，service 归一化为：

```text
healthStatus = failed
lastCheckedAt = 服务端 checkedAt
lastErrorCode = 内部稳定失败 code
updatedAt = repository 写入时服务端时间
```

`lastErrorCode` 只允许保存内部归一化 code，例如：

- `missing_credential`。
- `credential_provider_unavailable`。
- `credential_unavailable`。
- `credential_revoked`。
- `provider_timeout`。
- `external_unreachable`。
- `external_auth_failed`。
- `external_rate_limited`。
- `external_service_unavailable`。
- `unsupported_vendor`。
- `unsafe_external_response`。
- `connection_not_active`。
- `service_unavailable`。

禁止保存：

- provider raw error message。
- 外部响应体。
- 外部请求体。
- 外部 HTTP header。
- 外部 trace id。
- 凭证明文或 `credentialRef`。
- SQL、stack、`DATABASE_URL`。
- 患者、预约、治疗、病历或门店原始业务数据。

## degraded 写回规划

`degraded` 不应作为“说不清”的兜底状态。

只有满足以下场景之一，才允许写回 `degraded`：

- provider 明确返回连接可达但部分能力不可用。
- provider 明确返回非致命告警，且 warning 已被内部 allowlist 映射。
- 首次调用超时或短暂失败，受控重试后成功，但需要保留降级信号。
- 外部系统可达但只支持有限健康探测，无法覆盖关键能力，且后续 provider 明确标记为降级。

`degraded` 推荐同时写 `lastErrorCode`，例如：

- `partial_capability_unavailable`。
- `provider_retry_succeeded`。
- `provider_warning`。
- `limited_health_probe`。

如果没有安全 code，service 应优先选择 `unknown` 或 `failed`，不得把 raw warning 写入数据库。

## unknown 写回规划

`unknown` 主要用于未检测或健康状态重置。

推荐场景：

- 连接新建时默认 `unknown`。
- 凭证清空后重置为 `unknown`。
- 凭证撤销后重置为 `unknown`。
- 连接状态不允许检测时，service 可明确触发健康重置。
- provider result 无法安全分类时，可返回稳定失败或重置为 `unknown`，但不得保存 raw result。

推荐 reset 写法：

```text
healthStatus = unknown
lastCheckedAt = null
lastErrorCode = null
updatedAt = repository 写入时服务端时间
```

如果是一次手动测试请求已经被 service 判断为不可测试，例如缺失凭证，是否写 `lastCheckedAt` 需要在对应 runtime PR 中通过测试固定。默认建议：缺失凭证可记录 `checkedAt + missing_credential`；暂停、撤销、删除等生命周期不允许状态则不在测试连接流程中推进健康写回。

## 生命周期状态边界

测试连接 provider 调用默认只允许 `active` 连接。

`draft`：

- v1 默认不发起 provider 调用。
- 如果后续允许草稿预检，必须单独规划 `manual_preflight` 或同等白名单模式。
- 默认不因为草稿测试请求写回 `healthy / degraded / failed`。

`paused`：

- 不发起 provider 调用。
- 不写回 `healthy / degraded / failed`。
- 如业务需要重置健康状态，只能由 service 明确调用 reset unknown，不由 route 直接写。

`revoked`：

- 不发起 provider 调用。
- 不写回 `healthy / degraded / failed`。
- 凭证撤销或连接撤销流程可由 service 明确重置为 `unknown`。

`deleted`：

- 视为不可见资源。
- repository 必须继续绑定 `deletedAt is null`。
- 不允许测试连接写回任何健康字段。

`error`：

- v1 是否允许测试需后续 runtime PR 明确。
- 默认建议先不发起 provider 调用，避免把生命周期错误和外部连通性混在一起。

## 凭证清空与撤销后的重置

凭证清空 / 撤销后，健康状态应重置为 `unknown`。

推荐后续拆分：

- 本轮只规划，不修改 credential repository runtime。
- 后续健康写回 repository 方法落地后，再评估 credential service 是否在清空 / 撤销成功后调用 reset unknown。
- reset unknown 不读取真实凭证，不调用 provider，不写外部失败 code。
- reset unknown 不应保存 `credentialRef`、provider path 或 secret manager path。

如果 credential service 调用 reset unknown 失败：

- 不应吞掉错误。
- 不应泄露数据库错误细节。
- 应由 credential service 使用既有 fail closed 或稳定错误映射收口。
- audit 顺序需在后续 runtime PR 中明确，避免凭证清空成功但健康重置失败时产生误导记录。

## 并发与 updatedAt 保护

健康写回涉及 provider 调用，调用前后的连接状态可能变化。

后续 runtime 建议支持 `expectedUpdatedAt`：

1. service 在 provider 调用前读取连接快照。
2. service 记录快照中的 `updatedAt`、`status` 和 `credentialConfigured` 摘要。
3. provider / fake provider 返回后，service 调用 repository 写回时传入 `expectedUpdatedAt`。
4. repository 在 `tenantId + connectionId + deletedAt is null` 基础上增加 `updatedAt = expectedUpdatedAt` 条件。
5. 如果写不到行，返回稳定并发结果，例如 `stale_connection_state` 或 `conflict`。
6. service 不重试覆盖旧结果，返回稳定错误并写安全 audit。

这样可以避免以下竞态：

- 用户测试连接期间，另一人清空或撤销凭证。
- 用户测试连接期间，连接被暂停、撤销或删除。
- 用户测试连接期间，连接元数据被修改，provider result 已不再对应最新配置。

如果首个 runtime 为降低复杂度暂不做 `expectedUpdatedAt`，必须在计划、测试和 devlog 中明确风险，并至少保证 `tenantId + connectionId + deletedAt is null`。

## repository result 边界

后续 repository result 建议保持稳定：

- `ok`：写回成功，返回安全 read model 或健康摘要。
- `not_found`：连接不存在、跨租户或已删除。
- `validation_failed`：命令字段不满足白名单。
- `invalid_state_transition`：连接状态不允许该类健康写回。
- `stale_connection_state` 或 `conflict`：`expectedUpdatedAt` 不匹配。

数据库异常：

- repository 可抛出脱敏错误，例如 `Failed to write HIS connection health summary`。
- service 必须映射为稳定 `service_unavailable`。
- 不返回 SQL 约束名、表名细节、stack、数据库 URL 或原始异常消息。

## audit 顺序规划

audit runtime 后置，但顺序需要提前固定。

推荐顺序：

1. test requested：权限通过并进入 service 后记录请求发起。
2. provider result normalized：provider / fake provider result 被 service 归一化为安全状态和 code。
3. repository health write attempted：service 尝试写回健康摘要。
4. success audit：健康写回成功后记录安全成功摘要。
5. failure audit：provider 失败、repository 写回失败或无法安全分类时记录稳定失败摘要。

边界：

- route denied audit 仍由 route 层负责，覆盖权限拒绝、缺失可信 tenant、跨租户 target 和 parser failure。
- service 层负责业务成功、业务失败、provider 失败和 health write 失败 audit。
- route 不重复写 service 业务失败 audit。
- repository 不直接写 audit。
- audit metadata 不写 raw provider result、raw HIS payload、外部响应体或凭证明文。

## 写回失败收口

健康写回失败不得吞掉。

推荐处理：

- provider 尚未执行时，如果 audit 或 repository 前置失败，应 fail closed。
- provider 已执行但 repository 写回失败时，service 返回稳定 `service_unavailable`。
- audit 使用安全 reason，例如 `repository_after_provider_failed`，但不写数据库错误细节。
- DTO 不声称测试成功，也不返回 raw provider 成功结果。
- 不在失败路径把健康状态伪装成 `healthy`。

如果 provider 结果为成功但 repository 写回失败，前端应看到稳定内部服务不可用，而不是“连接正常”。否则 UI 会与数据库健康状态不一致。

## 与 route parser / DTO 的关系

route parser / DTO 不产生健康写回值。

禁止：

- body / query / header 传 `healthStatus`。
- body / query / header 传 `lastCheckedAt` 或 `checkedAt`。
- body / query / header 传 `lastErrorCode`。
- body / query / header 传 provider result。
- body / query / header 传 endpoint override。

DTO 可以返回：

- `ok`。
- `code`。
- `error`。
- `healthStatus`。
- `checkedAt`。

DTO 不返回完整连接详情；连接详情仍由既有 read API 提供。

## schema / migration 判断

本轮不新增 schema / migration。

理由：

- 现有 schema 已有 `healthStatus`。
- 现有 schema 已有 `lastCheckedAt`。
- 现有 schema 已有 `lastErrorCode`。
- 现有 schema 已有 `updatedAt`。
- 现有健康状态枚举已覆盖 `unknown / healthy / degraded / failed`。
- 现有索引已经覆盖 `tenantId + lastCheckedAt`，足够支撑后续健康列表排序或运营查询的基础需求。

如果后续真实 HIS adapter 需要保存更丰富诊断摘要，必须另开 Plan Mode；默认仍不保存 raw payload。

## 后续实现拆分建议

后续 PR 至少拆分为：

1. repository write runtime：新增健康摘要写回 repository 方法和 tests。
2. fake provider service Plan Mode：规划 fake provider service 输入、输出、状态归一化和错误 code。
3. fake provider route runtime：接入 route、parser / DTO、安全响应和 fake provider service。
4. audit runtime：接入 test requested、provider result、repository write success / failure audit。
5. real credential provider boundary Plan Mode：规划真实凭证读取边界。
6. real HIS adapter Plan Mode：规划真实 HIS adapter 测试连接。
7. runner / scheduler Plan Mode：规划周期健康检查。

不要把真实 provider、真实凭证读取、真实 HIS adapter 或 runner / scheduler 混入 repository write runtime。

## 本轮交付边界

本轮只交付：

- 一份健康状态 repository 写回边界规划文档。
- 当天 devlog 记录。

本轮不交付：

- repository 写回代码。
- repository tests。
- service 代码。
- route 代码。
- parser / DTO 代码。
- audit runtime。
- fake provider。
- real provider。
- schema / migration。
- package / lockfile 变更。

