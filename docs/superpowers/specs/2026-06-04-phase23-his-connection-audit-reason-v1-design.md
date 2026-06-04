# Phase 23 HIS 连接配置审计 reason 补强设计

> 日期：2026-06-04
> 状态：Plan Mode 文档。本 PR 只规划后续 HIS 连接配置 create / update API 失败路径所需的审计 reason，不修改 `src/**`，不修改 audit domain / reason，不实现 denied audit，不新增 API route，不修改 service、parser、repository、权限、schema 或 migration。

## 本次定位

当前 HIS 连接配置写入链路已经完成以下基础能力：

- 写入 payload parser 只接受 `connectionName`、`sourceSystem`、`vendorType`、`systemType` 四个安全元数据字段。
- repository 已提供 `createHisConnectionForTenant` 和 `updateHisConnectionForTenant`，并返回稳定 `ok`、`validation_failed`、`conflict`、`not_found`。
- 权限模型已为 `tenant_admin` 最小授予 `open_connection:create` 和 `open_connection:update`。
- service 已提供 `createHisConnectionForTenantService` 和 `updateHisConnectionForTenantService`。
- service 成功路径已在同一事务内写 allowed audit，使用 `open_connection:create` / `open_connection:update` 和 `allowed_by_policy`。
- service 对 `validation_failed`、`conflict`、`not_found`、thrown error 已返回稳定 service result。

当前缺口是 create / update API 失败路径接入 denied audit 之前，HIS 连接配置专用失败 reason 尚未补强。为了避免 route 或 service 在没有稳定 reason 的情况下随意复用不准确 reason，本 PR 先规划 reason 命名、复用策略、敏感信息禁区和后续实现拆分。

本 PR 不进入运行时代码：

- 不写代码。
- 不修改 `src/**`。
- 不修改 audit domain。
- 不修改 audit reason union 或 query 白名单。
- 不修改 audit repository。
- 不新增 API route。
- 不修改 service。
- 不修改 parser。
- 不修改 repository。
- 不修改权限实现或权限测试。
- 不修改 schema / migration。
- 不实现 denied audit。
- 不处理凭证管理。
- 不做测试连接。
- 不接真实 HIS、机构系统、企微、AI、RAG、Agent 或自动触达。
- 不创建治疗摘要或随访任务。
- 不修改 demo seed 数据。
- 不修改 `package.json` 或 lockfile。
- 不修改 `.codex`、Superpowers 缓存目录或技能文件。

## 只读检查结论

本次只读检查范围：

- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/audit/server/audit-event-repository.ts`
- `src/modules/audit/tests/*`
- `src/modules/security/domain/access-control.ts`
- `src/modules/institution/server/his-connection-write-input.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/server/his-connection-write-service.ts`
- `src/modules/institution/tests/HisConnectionWriteInput.test.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/tests/HisConnectionWriteService.test.ts`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-write-service-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-write-service-v1.md`
- `docs/devlog/2026-06-04.md`
- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`

已确认：

- `ACCESS_RESOURCES` 已包含 `open_connection`。
- `ACCESS_ACTIONS` 已包含 `create` 和 `update`。
- `AuditReason` 已包含 access decision reason：`role_denied`、`missing_tenant`、`cross_tenant_denied`、`sensitive_detail_denied`。
- `AuditReason` 已包含通用资源归属 reason：`not_found_or_not_owned`。
- `AuditReason` 已包含治疗摘要 payload 类 reason：`invalid_treatment_summary_payload`。
- `AUDIT_REASON_VALUES` 是审计查询 reason 白名单，后续新增 reason 必须同步。
- `audit_events.reason` 目前不是数据库 enum，新增 reason 通常不需要 schema / migration，但仍必须以实际代码为准。
- `createAuditEvent` 和 `createDeniedAccessAuditEvent` 只记录结构化字段，不携带 payload 原文。
- `createAuditEventRepository.record` 只持久化 `TenantAuditEvent` 字段。
- HIS 写入 service 当前只写成功 allowed audit；denied audit 未实现。

## 当前审计现状

当前可以表达的 HIS 连接配置成功事件：

| 场景 | resource | action | result | reason |
| --- | --- | --- | --- | --- |
| create 成功 | `open_connection` | `create` | `allowed` | `allowed_by_policy` |
| update 成功 | `open_connection` | `update` | `allowed` | `allowed_by_policy` |

当前可复用的拒绝 reason：

| 场景 | 建议 reason | 说明 |
| --- | --- | --- |
| 无写入权限 | `role_denied` | 来自 `canAccessResource` |
| 机构上下文缺失 `tenantId` | `missing_tenant` | 来自 `canAccessResource` |
| 明确跨租户 targetTenantId | `cross_tenant_denied` | 来自 `canAccessResource` |
| update 不存在、跨租户或已软删除 | `not_found_or_not_owned` | 可复用，避免暴露目标是否存在 |

当前缺少的 HIS 连接配置专用 reason：

- parser payload 非法。
- repository 防御性 `validation_failed`。
- 租户内未删除连接名冲突。
- 是否需要把 update `not_found` 单独区分为 HIS 专用 reason。

## reason 设计原则

后续 reason 应遵守以下原则：

- 使用稳定英文枚举值，便于审计查询、测试和长期兼容。
- reason 只表达失败类别，不包含用户输入、外部系统响应、SQL、stack、连接串或凭证明文。
- 优先复用已有 access decision reason，避免重复引入 `open_connection_role_denied` 之类变体。
- 对不存在、跨租户、已删除统一处理，避免通过审计侧信道暴露资源存在性。
- payload 类 reason 与现有 `invalid_treatment_summary_payload` 风格一致。
- 冲突类 reason 只表达业务冲突，不暴露数据库 constraint、索引名或冲突行。
- service unavailable 类内部异常默认不写 denied audit，避免记录内部异常或制造误导性失败审计。

## 需要补强的 reason 候选

建议后续实现 PR 至少评审以下候选：

| 候选 reason | 建议结论 | 适用场景 | 说明 |
| --- | --- | --- | --- |
| `invalid_his_connection_payload` | 建议新增 | JSON 可解析但 parser 拒绝 payload；字段缺失、未知字段、禁止字段、敏感内容、空字符串、超长字符串 | 对齐 `invalid_treatment_summary_payload` 命名风格 |
| `his_connection_name_conflict` | 建议新增 | create / update 遇到租户内未删除连接名冲突 | 比通用 `conflict` 更适合审计查询 |
| `invalid_his_connection_repository_result` | 谨慎评审 | repository 返回 `validation_failed`，表示 service 传入命令或 parser 输出外还有防御性校验失败 | 可作为服务层防御性失败 reason；必须避免记录 command |
| `his_connection_not_found_or_not_owned` | 暂不推荐优先新增 | update 目标不存在、跨租户或已软删除 | 现有 `not_found_or_not_owned` 已覆盖语义，新增会增加查询和测试成本 |

本轮推荐的最小集合：

- 新增 `invalid_his_connection_payload`。
- 新增 `his_connection_name_conflict`。
- 评审是否新增 `invalid_his_connection_repository_result`。
- 优先复用 `not_found_or_not_owned`，暂不新增 `his_connection_not_found_or_not_owned`。

## 可复用的 reason

权限和租户边界：

- `role_denied`：角色没有 `open_connection:create` 或 `open_connection:update`。
- `missing_tenant`：机构上下文缺失可信 `tenantId`。
- `cross_tenant_denied`：如后续 route 明确构造 targetTenantId 且与 access context 不一致。

目标不可见：

- `not_found_or_not_owned`：update 目标不存在、属于其他租户或已软删除统一使用。

成功：

- `allowed_by_policy`：create / update 成功路径继续使用。

不建议复用的 reason：

- 不复用 `invalid_treatment_summary_payload` 表达 HIS 连接配置 payload 非法。
- 不复用 `invalid_treatment_summary_reference` 表达连接名冲突。
- 不复用 `invalid_transition` 表达 create / update 元数据写入失败。
- 不使用 `stale_transition` 表达连接名唯一约束冲突。

## 不需要新增 reason 的场景

| 场景 | 处理建议 |
| --- | --- |
| 未登录且无 access context | 可不写 tenant audit；如需安全审计，后续单独规划 platform / security audit |
| 权限拒绝 | 复用 access decision reason |
| 缺失 tenantId | 复用 `missing_tenant` |
| 跨租户 targetTenantId | 复用 `cross_tenant_denied` |
| update 不存在、跨租户、已软删除 | 优先复用 `not_found_or_not_owned` |
| service thrown error / 数据服务异常 | 本轮建议不写 denied audit，避免记录内部异常；API 仍返回稳定 `service_unavailable` |
| audit repository 自身失败 | 不再嵌套写审计；返回稳定失败并让事务回滚 |

## 需要新增或评审 reason 的场景

| 场景 | 建议 reason | HTTP / service 对应 |
| --- | --- | --- |
| parser payload 非法 | `invalid_his_connection_payload` | `400 validation_failed` |
| repository `validation_failed` | `invalid_his_connection_repository_result` 或 `invalid_his_connection_payload` | `400 validation_failed` |
| create 连接名冲突 | `his_connection_name_conflict` | `409 conflict` |
| update 连接名冲突 | `his_connection_name_conflict` | `409 conflict` |
| update not found / not owned / deleted | `not_found_or_not_owned` | `404 not_found` |

repository `validation_failed` 的 reason 需要重点评审：

- 如果它只代表 parser 之外的防御性 payload 校验失败，可复用 `invalid_his_connection_payload`。
- 如果它代表 service 组装命令失效或内部调用契约不满足，建议新增 `invalid_his_connection_repository_result`。
- 无论选择哪种，都不得把 repository command、values 或内部错误写入 audit。

## denied audit 写入边界

后续 denied audit 只能记录结构化审计字段：

- actor id。
- actor role。
- tenantId。
- scope。
- source。
- resource。
- resourceId。
- action。
- result。
- reason。
- occurredAt。

严禁记录：

- 完整 payload。
- 原始 request body。
- response body。
- body / query / header 中的 `tenantId`。
- `credentialRef`。
- `credentialConfigured`。
- token、secret、API key、OAuth token、basic auth、签名密钥、私钥、连接串。
- raw HIS payload。
- SQL、stack、`DATABASE_URL`。
- 完整病历。
- 完整治疗正文。
- 咨询全文。
- 图片 / 文件原文。
- 外部系统错误全文。
- 数据库 constraint 名、索引名或冲突行详情。

resourceId 建议：

- payload 非法且无可信 connectionId 时不写 resourceId。
- update path 有 trim 后 `connectionId` 时可记录 resourceId，但不得说明目标是否存在或属于其他租户。
- create 冲突没有已创建资源 id，建议不写 resourceId。
- update 冲突可使用 path `connectionId`，但不写连接名原文以外的冲突细节。

## 后续 audit reason 实现 PR 最小范围

后续 reason 补强实现 PR 建议只包含：

- 修改 `src/modules/audit/domain/audit-events.ts`，新增 HIS 连接配置 reason 到 `AuditReason`。
- 修改 `src/modules/audit/domain/audit-event-query.ts`，同步 `AUDIT_REASON_VALUES`。
- 修改 `src/modules/audit/tests/AuditEventsDomain.test.ts`，覆盖新增 reason 可创建 denied audit 且不携带敏感数据。
- 修改 `src/modules/audit/tests/AuditEventQueryParser.test.ts`，覆盖新增 reason 可被审计查询 parser 接受。
- 如 repository 查询或 API route 测试中有 reason 白名单断言，按最小范围同步测试。

后续 reason 补强实现 PR 不应包含：

- 不新增 API route。
- 不修改 HIS connection service 业务逻辑。
- 不修改 HIS connection repository。
- 不修改 parser。
- 不修改权限模型。
- 不修改 schema / migration，除非实际发现 `audit_events.reason` 已变成数据库 enum；若出现此情况必须停止并拆分。
- 不处理凭证、测试连接或真实 HIS。
- 不实现 denied audit 接入。

## 后续 denied audit 接入拆分

建议拆为独立 PR：

1. service denied audit 接入。
   - create / update service 在 repository 非 ok 结果或 parser 失败传入的安全错误码场景写 denied audit。
   - 不记录 payload 原文。
   - audit 失败时保持事务回滚和稳定 `service_unavailable`。
2. service denied audit tests。
   - 覆盖 payload 非法、repository `validation_failed`、`conflict`、`not_found`。
   - 覆盖 sensitive terms 不进入 audit event。
3. API route denied audit 或 permission denied audit 接入。
   - 未登录仍可不写 tenant audit。
   - 权限拒绝写 access decision reason。
   - parser 失败时写 `invalid_his_connection_payload`。
4. API route tests。
   - 覆盖 HTTP 状态、audit reason、无 payload 泄露、无凭证、无 raw HIS。

## 当前验收清单

- 本文档明确当前 PR 是 Plan Mode。
- 本文档明确只规划审计 reason，不实现代码。
- 本文档记录当前 audit domain、query whitelist、repository 和 service 审计现状。
- 本文档规划需要补强的 HIS 连接配置 reason。
- 本文档明确可复用的 reason。
- 本文档明确不需要新增 reason 的场景。
- 本文档明确 denied audit 敏感信息禁区。
- 本文档规划后续 reason 实现 PR 最小范围。
- 本文档规划后续 denied audit 接入拆分。
- 本文档明确不新增 API、不改 service / route / repository / parser、不改权限、不改 schema / migration、不实现 denied audit、不处理凭证或真实 HIS。
