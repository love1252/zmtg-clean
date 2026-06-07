# Phase 23 HIS 周期健康检查候选查询与 audit 边界规划

> 日期：2026-06-07
> 状态：docs-only Plan Mode。本文只规划 Phase23-TC-12A 周期健康检查 candidate query 与 audit action / reason 边界，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不实现 candidate query runtime，不实现 repository query runtime，不实现 audit action runtime，不修改 audit runtime，不实现 runner runtime，不实现 scheduler runtime，不新增 cron / queue / worker，不接真实 credential provider，不读取真实凭证，不接真实 HIS adapter，不发起外部网络请求，不回到 compensation / recovery runtime，不修改 package / lockfile。

## 只读盘点结论

1. 当前本地 `main` 与 `origin/main` 均位于 `0ae8799bb44330f62069ffc39079eb867d27974d`，工作区 clean。
2. TC-12 已明确周期健康检查 runner / scheduler 只应在完成 candidate query、scheduled audit、system actor、lock / lease / backoff 等边界后再进入 runtime。
3. 当前 `his_connections` schema 已有 `status`、`credentialRef`、`healthStatus`、`lastCheckedAt`、`lastErrorCode`、`updatedAt` 和 `deletedAt`。
4. 当前 repository read model 已返回 `status`、`credentialConfigured`、`healthStatus`、`lastCheckedAt`、`lastErrorCode`、`updatedAt` 和 `deletedAt`。
5. 当前 repository 已有 `listHisConnectionsByTenant`、`getHisConnectionByTenant`、`getHisConnectionCredentialSummaryByTenant` 和 `writeHisConnectionHealthSummaryForTenant`。
6. 当前 repository 没有专用健康检查 candidate query runtime。
7. 当前 audit action 来自 `ProtectedAction`，已有 `test_connection`，但没有 `scheduled_health_check`。
8. 当前 audit reason whitelist 位于 `src/modules/audit/domain/audit-events.ts` 与 `src/modules/audit/domain/audit-event-query.ts`，测试集中在 `src/modules/audit/tests/AuditEventsDomain.test.ts` 与 `src/modules/audit/tests/AuditEventQueryParser.test.ts`。
9. TC-09 已实现手动测试连接 `test_connection` audit reason，包括 requested、provider result、connection not active、completed 等稳定 reason。
10. 当前 `AccessRole` 不包含 `system`，`AccessContext.source` 也不包含 `scheduled_health_check`，因此 system actor / service actor 需要后续单独规划。
11. 当前 compensation 旧文档和 runtime 已有 job queue、claim、lock、retry、backoff、manual review 等概念，但这些只服务凭证补偿链路，不能直接复用到周期健康检查。
12. 当前缺少 health task durable lock、lease owner、lease expires、run source、连续失败次数和 backoff 到期字段；若生产级多实例运行需要这些能力，应后续单独规划 schema / migration。
13. 本轮可继续只写 Plan，不需要改 schema / migration，不需要写 runtime，不需要接真实 provider，也不需要读取真实凭证。

## 本轮范围

本轮只规划三类边界：

- 周期健康检查候选连接查询边界。
- 周期健康检查 audit action / reason / query whitelist 边界。
- 二者与后续 runner / scheduler runtime 的拆分关系。

本轮明确不做：

- 不实现 candidate query runtime。
- 不新增 repository query runtime。
- 不实现 audit action runtime。
- 不修改 audit runtime。
- 不新增 runner runtime。
- 不新增 scheduler runtime。
- 不新增 cron / queue / worker。
- 不新增 durable lock / lease / backoff runtime。
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

## candidate query 定位

candidate query 是未来周期健康检查 runner 的前置候选筛选能力，只负责从服务端可信数据中选择“可能需要检查”的 HIS connection。

candidate query 应负责：

- 根据服务端调度上下文确定 tenant 范围。
- 根据服务端 allowlist 确定 source / vendor / system 范围。
- 根据连接状态、软删除状态、凭证配置状态和检查到期时间筛选候选连接。
- 返回最小安全候选摘要。
- 为后续 runner 提供批次候选，不直接执行检查。

candidate query 不是：

- 不是 runner runtime。
- 不是 scheduler runtime。
- 不是真实 HIS adapter。
- 不是 credential provider。
- 不是 secret manager / KMS / Vault。
- 不是前端查询接口。
- 不是手动测试连接 route。
- 不是 audit writer。
- 不是 compensation / recovery candidate query。
- 不是人工复核 worker。
- 不是 HIS 数据同步任务。

## candidate query 输入边界

candidate query 的输入只能来自服务端配置与 system actor / service actor 上下文。

建议后续类型：

```ts
type HealthCheckCandidateQueryInput = {
  tenantId?: string;
  now: Date;
  dueBefore: Date;
  limit: number;
  sourceSystemAllowlist: string[];
  vendorTypeAllowlist: string[];
  systemTypeAllowlist: string[];
  excludeRecentlyManualChecked?: boolean;
  backoffPolicy?: ServerOnlyBackoffPolicy;
};
```

输入字段建议：

- `tenantId` 可选，只能由服务端 scheduler / runner 配置决定。
- `now` 由服务端时间源提供。
- `dueBefore` 由服务端检查周期计算得到。
- `limit` 来自服务端 batch 配置。
- `sourceSystemAllowlist` 来自服务端配置。
- `vendorTypeAllowlist` 来自服务端配置。
- `systemTypeAllowlist` 来自服务端配置。
- `excludeRecentlyManualChecked` 来自服务端策略。
- `backoffPolicy` 来自服务端策略，且只包含安全配置值。

输入禁止：

- 不从前端 body 接收 `tenantId`。
- 不从前端 query 接收 `tenantId`。
- 不从前端 header 接收 `tenantId`。
- 不从前端接收 candidate list。
- 不从前端接收 `limit`。
- 不从前端接收 batch size。
- 不从前端接收 concurrency。
- 不从前端接收 vendor allowlist。
- 不从前端接收 source allowlist。
- 不从前端接收 retry 参数。
- 不从前端接收 backoff 参数。
- 不读取真实凭证。
- 不调用 credential provider。
- 不调用 HIS adapter。
- 不返回候选列表给前端。
- tenant 范围不能由 request lifecycle 决定。

## candidate query 条件边界

必须满足的候选条件：

- `status = active`。
- `deletedAt is null`。
- `credentialConfigured = true`。
- `sourceSystem` 命中服务端 allowlist。
- `vendorType` 命中服务端 allowlist。
- `systemType` 命中服务端 allowlist。
- `lastCheckedAt is null` 或 `lastCheckedAt <= dueBefore`。
- `healthStatus` 不作为唯一筛选条件，但可用于排序、限流或 backoff 策略。
- 同一连接没有 running health task。
- 同一连接没有未释放 durable lock 或 lease。
- 当前连接不在 backoff 窗口内。
- 当前连接没有刚被手动测试连接检查过，或服务端策略允许覆盖。

必须排除：

- `draft`。
- `paused`。
- `revoked`。
- `error`，除非后续专门规划 error 状态修复策略。
- `deleted`。
- `deletedAt` 非空。
- `credentialConfigured = false`。
- source / vendor / system 任一维度不在 allowlist 内。
- 凭证缺失或 credential provider 后续确认不可用的连接。
- 处于 backoff 窗口的连接。
- 同连接已有 running health task 的连接。
- 最近刚完成手动测试连接且未超过阈值的连接。

当前字段风险：

- 当前 `his_connections` 字段足以支撑 active、deleted、credentialConfigured、allowlist、lastCheckedAt 到期和健康摘要排序规划。
- 当前没有 health task 表或字段，无法表达 running health task。
- 当前没有 durable lock / lease 字段，无法证明多实例互斥。
- 当前没有连续失败次数和 backoff 到期字段，无法做生产级 backoff 过滤。
- 当前没有手动测试与周期检查来源分离字段，无法稳定判断“近期手动测试刚检查过”是否应排除。
- 本轮不新增 schema / migration。
- 首期 runtime 如无 lock schema，只能声明单实例或 best-effort，不得声称多实例安全。

## candidate query 返回边界

candidate query 只返回最小候选摘要，不返回敏感字段。

建议后续类型：

```ts
type HealthCheckCandidate = {
  tenantId: string;
  connectionId: string;
  sourceSystem: string;
  vendorType: string;
  systemType: string;
  healthStatus: 'unknown' | 'healthy' | 'degraded' | 'failed';
  lastCheckedAt: Date | null;
  lastErrorCode: string | null;
  updatedAt: Date;
};
```

允许返回：

- `tenantId`。
- `connectionId`。
- `sourceSystem`。
- `vendorType`。
- `systemType`。
- `healthStatus`。
- `lastCheckedAt`。
- `lastErrorCode`。
- `updatedAt`。

禁止返回：

- `credentialRef`。
- credential material。
- secret path。
- endpoint。
- headers。
- raw HIS payload。
- provider raw error。
- external response body。
- patient data。
- appointment data。
- medical record data。
- SQL。
- stack。
- `DATABASE_URL`。

后续 per-candidate 执行约束：

- 如果未来 service 需要 credential lookup，只能在 per-candidate 重新读取 server-only connection snapshot 后进行。
- candidate query 不返回 `credentialRef` 原文。
- candidate query 不返回 endpoint 原文。
- candidate query 不返回 adapter class。
- candidate query 不返回可直接用于外部请求的凭证或地址材料。

## 排序 / 限流 / 分页边界

查询必须有 `limit`：

- `limit` 来自服务端配置。
- `limit` 必须有最小值和最大值保护。
- 不允许无限扫描。
- 不允许前端覆盖 `limit`。
- 不允许前端覆盖 batch size。
- 不允许前端覆盖 concurrency。

排序建议：

- `lastCheckedAt null first`。
- 最旧 `lastCheckedAt` 优先。
- `failed / degraded` 可按服务端策略调整顺序。
- tenant fairness 优先，防止单一 tenant 吃满全局 batch。
- vendor fairness 优先，防止单一 vendor 吃满外部请求容量。
- 同一 tenant 内可按 `lastCheckedAt` 与 `connectionId` 稳定排序。

限流建议：

- 全局候选上限。
- 租户级候选上限。
- vendor 级候选上限。
- system type 级候选上限。
- 单连接互斥。
- 单 run 最大候选数。
- 单 run 最大持续时间。

分页边界：

- offset 分页在高并发写入下容易跳过或重复候选，只能用于低风险只读排查。
- cursor 分页应只包含安全字段，例如 `lastCheckedAt` 与 `connectionId`。
- cursor 不应包含 credentialRef、secret path、endpoint、tenant bulk list 或 SQL。
- cursor 应可验证格式并限制长度。
- 本轮不实现分页 runtime。

## audit action 边界

建议结论：

- 手动测试连接继续使用 `test_connection`。
- 周期健康检查建议规划独立 action：`scheduled_health_check`。

建议独立 action 的原因：

- actor 不同：manual user vs system actor。
- trigger 不同：route request vs scheduler。
- 风险不同：周期检查是批量、后台、可重复执行。
- 查询分析需要区分来源。
- 手动按钮失败与后台批次失败应有不同运营解释。
- 后续限流、backoff、lock conflict 和 batch summary 不能自然归入手动测试。

后续新增 action 必须同步：

- access action 或 audit action 白名单。
- audit event domain。
- audit query parser allowlist。
- audit domain tests。
- audit query parser tests。
- 相关 service / runner tests。

当前风险：

- 当前 `ProtectedAction` 同时服务 access action 与 audit action。
- 当前项目没有独立的非权限 audit action 类型。
- 如果新增 `scheduled_health_check`，需要先评估 audit action 与 access action 的绑定方式。
- 不建议直接把 `scheduled_health_check` 加成普通用户权限 action。
- 本轮只规划，不实现 action runtime。
- 不得只写不可查；新增 action 后必须能被 audit query allowlist 查询。

## audit reason 边界

建议周期健康检查专用 reason：

```text
scheduled_health_check_requested
scheduled_health_check_candidate_selected
scheduled_health_check_candidate_skipped
scheduled_health_check_started
scheduled_health_check_provider_healthy
scheduled_health_check_missing_credential
scheduled_health_check_credential_unavailable
scheduled_health_check_credential_revoked
scheduled_health_check_external_auth_failed
scheduled_health_check_provider_timeout
scheduled_health_check_external_unreachable
scheduled_health_check_external_rate_limited
scheduled_health_check_external_service_unavailable
scheduled_health_check_unsupported_vendor
scheduled_health_check_limited_health_probe
scheduled_health_check_repository_write_failed
scheduled_health_check_completed
scheduled_health_check_failed
scheduled_health_check_backoff_applied
scheduled_health_check_lock_conflict
```

reason 规则：

- reason 是内部稳定枚举。
- reason 不保存 raw error。
- reason 不保存 credentialRef。
- reason 不保存 endpoint。
- reason 不保存 raw HIS payload。
- reason 不保存 external response body。
- reason 不保存 SQL、stack 或 query plan。
- 新增 reason 必须进入 whitelist。
- 新增 reason 必须补 domain tests。
- 新增 reason 必须补 query parser tests。
- 本轮不修改 audit runtime。

reason 分层建议：

- candidate query summary reason 只记录被选中数量、跳过数量和稳定跳过分类计数。
- per-connection execution reason 记录 selected、started、provider result、repository write failed、completed 或 failed。
- backoff 与 lock conflict 单独 reason，避免混入 provider failure。
- repository write failed 只记录稳定原因，不记录数据库错误原文。

## system actor / service actor 边界

周期健康检查不得伪装成人类用户。

推荐语义：

- `actorId = system:his-health-check-runner`。
- `actorRole = system`。
- `scope = system` 或现有可支持的最小安全等价值。
- `source = scheduled_health_check`。
- `tenantId` 来自服务端 runner 当前处理的 tenant。
- `resource = open_connection`。
- `resourceId = connectionId` 或 batch summary 的安全资源 id。
- `action = scheduled_health_check`。

当前风险：

- 当前 `AccessRole` 不含 `system`。
- 当前 `AccessScope` 只有 `platform | tenant`。
- 当前 `AccessContext.source` 只有 `demo_session | server_session | trusted_gateway`。
- 当前 audit event 直接使用 `AccessContext` 构造 actor 字段。
- 因此 system actor / service actor 需要先单独规划 runtime 或 schema 边界。
- 若短期不能改 schema，应规划一个明确的 service actor 兼容表达，且不能冒充普通用户。
- 本轮不改 schema / runtime。

## candidate query 与 audit 的关系

待后续决定：

- candidate query 本身是否写 audit。
- runner 是否在每次 batch 开始写 summary audit。
- runner 是否为每个被选中的 candidate 写 selected audit。
- 被跳过 candidate 是否只记录 summary 计数。

建议口径：

- runner 按批次写 summary audit，而不是为每个被排除候选写大量 audit。
- 被选中的 candidate 可在 per-connection execution 写 audit。
- 被跳过原因如果需要记录，应做采样或 summary，不应大量写入。
- audit 不保存完整 candidate query 参数。
- audit 不保存完整候选列表。
- audit 不保存 tenant 批量清单。
- audit 不保存 raw SQL。
- audit 不保存 query plan。
- audit 不保存 allowlist 原始配置全量。
- 本轮只规划，不实现。

候选跳过 summary 建议只包含安全计数：

- `not_due_count`。
- `not_active_count`。
- `missing_credential_count`。
- `backoff_count`。
- `lock_conflict_count`。
- `allowlist_mismatch_count`。
- `recent_manual_check_count`。

## 与现有手动测试 audit 的关系

现状：

- TC-09 已完成手动测试连接 audit runtime。
- 手动测试连接 action 为 `test_connection`。
- 手动测试连接 reason 已进入 audit domain 与 query parser whitelist。
- 手动测试连接 actor 来自当前 access context。
- 手动测试连接 source 来自当前 access context source。

周期健康检查建议：

- 不复用人工 actor。
- 可复用 provider result 到 reason 的映射思路。
- action 建议使用 `scheduled_health_check`。
- source 建议使用 `scheduled_health_check` 或后续 system actor 可支持的等价值。
- 查询页面可按 action 区分 manual vs scheduled。
- 如果复用 `test_connection` action，会导致手动和周期事件混在一起，因此不建议。
- 如出于兼容短期复用，必须补 `source = scheduled` 或等价字段，但当前是否支持需先盘点和规划。

## 与 runner / scheduler runtime 的关系

candidate query 和 audit boundary 是 runner runtime 的前置规划。

不完成以下边界，不应直接进入 runner runtime：

- system actor / service actor。
- scheduled audit action 与 reason whitelist。
- candidate query 输入、条件、返回、排序和限流。
- lock / lease / backoff 策略。
- batch limit。
- 与手动测试连接结果冲突时的优先级。
- real credential provider runtime。
- real HIS adapter runtime。
- observability。

runner runtime 后续仍需：

- 每个 candidate 执行前重新读取 connection snapshot。
- 只用 server-only credential provider 读取凭证。
- 只通过 real HIS adapter 执行受控健康 probe。
- 只通过 health repository 写健康摘要。
- 只通过 scheduled audit 写安全审计。
- 不把 candidate query 结果直接暴露给前端。

本轮不实现 runner / scheduler。下一步也不建议直接做 runner runtime。

## 安全 denylist

禁止在 candidate query result、audit、日志、错误、devlog、README、测试快照、runner summary 中出现：

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
- raw SQL。
- query plan。
- SQL。
- stack。

## 后续 PR 拆分建议

建议后续拆分：

1. Phase23-TC-12B：system actor / service actor 审计上下文 Plan Mode。
2. Phase23-TC-12C：周期健康检查 durable lock / lease / backoff schema Plan Mode。
3. Phase23-TC-12D：周期健康检查 candidate query runtime。
4. Phase23-TC-12E：周期健康检查 audit action / reason runtime。
5. Phase23-TC-12F：周期健康检查单实例 runner 最小 runtime。
6. Phase23-TC-12G：scheduler trigger Plan Mode。
7. Phase23-TC-12H：scheduler trigger runtime。
8. 真实 credential provider runtime 独立推进。
9. real HIS adapter runtime 独立推进。

后续顺序建议：

- 不要下一步直接实现 runner runtime。
- 先做 system actor / service actor 审计上下文 Plan Mode。
- 再评估 durable lock / lease / backoff 是否需要 schema / migration。
- candidate query runtime 必须在输入、字段、排序、限流、分页和安全返回边界明确后再做。
- audit action / reason runtime 必须在 action 与 access action 绑定方式明确后再做。
