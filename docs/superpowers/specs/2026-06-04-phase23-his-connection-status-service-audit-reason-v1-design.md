# Phase 23 HIS 连接配置状态 service audit reason v1 设计

> 日期：2026-06-04
> 状态：Phase 23 Plan Mode 文档。本 PR 只规划 HIS 连接配置状态 service 的 repository 非 ok 结果到 denied audit reason 的映射，不实现代码，不新增 audit reason，不修改 audit domain、query whitelist、repository、parser、权限、schema、migration、service 或 API route。

## 本次定位

本 PR 聚焦 **HIS 连接配置状态 service denied audit reason 映射**。前序状态 API、状态权限和状态 service Plan Mode 已确认路径、权限动作、service 边界、事务边界、allowed audit 和稳定 service result。本轮只收敛 repository 非 ok 结果在状态 service 中应落到哪些既有 audit reason。

本 PR 不进入：

- 不写代码。
- 不修改 `src/**`。
- 不新增 service。
- 不新增 API route。
- 不修改现有 API route。
- 不修改 parser。
- 不修改 repository。
- 不修改权限实现或权限测试。
- 不修改 audit domain / reason / query whitelist。
- 不修改 audit repository。
- 不修改 schema / migration。
- 不新增 audit reason。
- 不新增 audit action。
- 不新增 pause / resume / revoke / soft_delete action。
- 不处理凭证管理。
- 不做测试连接。
- 不接真实 HIS、机构系统、企微、AI、RAG、Agent 或自动触达。

## 只读检查结论

本次从最新 `main` 执行只读检查，确认当前 main commit 为：

```text
5bd226807f304950e6c7b04ef83644f80101486c
```

已执行基础检查：

```bash
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
git status --short
```

检查结论：

- `git rev-parse HEAD` 等于 `5bd226807f304950e6c7b04ef83644f80101486c`。
- 建分支前工作区干净。
- 当前分支为 `docs/phase23-his-connection-status-service-audit-reason-plan`。

已只读检查：

- `src/modules/audit/domain/audit-events.ts`
- `src/modules/audit/domain/audit-event-query.ts`
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
- `src/modules/audit/tests/AuditEventQueryParser.test.ts`
- `src/modules/institution/server/his-connection-repository.ts`
- `src/modules/institution/tests/HisConnectionRepository.test.ts`
- `src/modules/institution/server/his-connection-write-service.ts`
- `src/modules/institution/tests/HisConnectionWriteService.test.ts`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-service-v1-design.md`
- `docs/superpowers/plans/2026-06-04-phase23-his-connection-status-service-v1.md`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-api-v1-design.md`
- `docs/superpowers/specs/2026-06-04-phase23-his-connection-status-permission-v1-design.md`

已执行指定 reason 搜索：

```bash
grep -R "invalid_transition\|not_found_or_not_owned\|invalid_his_connection_payload\|his_connection_name_conflict\|conflict\|validation_failed" src/modules/audit src/modules/institution docs/superpowers --exclude-dir=node_modules || true
```

已确认代码事实：

- `AuditReason` 与 `AUDIT_REASON_VALUES` 已包含 `invalid_transition`、`not_found_or_not_owned`、`invalid_his_connection_payload` 和 `his_connection_name_conflict`。
- 当前 audit query whitelist 已允许上述既有 reason。
- 当前 audit domain tests 明确不包含 `his_connection_not_found_or_not_owned` 和 `invalid_his_connection_repository_result`。
- 当前 create / update service 已把 repository `validation_failed` 映射为 `invalid_his_connection_payload`，把 update `not_found` 映射为 `not_found_or_not_owned`。
- 当前 create / update service 对 repository thrown error 返回 `service_unavailable`，且不写 denied audit。
- 当前状态 repository 方法已存在，且状态 command 只需要 `tenantId`、`connectionId`、`actorUserId` 和可选 `reasonCode`。
- 当前状态 repository 不写 audit，不处理凭证，不调用真实 HIS，不做测试连接。

## 当前 repository 稳定结果

状态 repository 方法包括：

- `pauseHisConnectionForTenant`
- `resumeHisConnectionForTenant`
- `revokeHisConnectionForTenant`
- `softDeleteHisConnectionForTenant`

状态 repository 稳定结果为：

- `ok`
- `not_found`
- `conflict`
- `invalid_state_transition`
- `validation_failed`
- thrown error

说明：

- `not_found` 表示目标不存在、跨租户、已软删除或默认不可见。
- `conflict` 表示重复动作或当前状态造成的可预期生命周期冲突。
- `invalid_state_transition` 表示当前状态不允许执行该生命周期动作。
- `validation_failed` 表示状态 command 输入未通过 repository 防御性校验。
- thrown error 表示 repository 内部异常，不属于稳定业务结果。

## service 稳定结果规划

状态 service v1 推荐稳定结果为：

- `paused`
- `resumed`
- `revoked`
- `deleted`
- `not_found`
- `conflict`
- `invalid_transition`
- `validation_failed`
- `service_unavailable`

映射原则：

- repository `ok` 按操作映射为 `paused`、`resumed`、`revoked` 或 `deleted`。
- repository `invalid_state_transition` 映射为 service `invalid_transition`。
- repository thrown error 映射为 service `service_unavailable`。
- service result 只作为 route 后续 HTTP 映射输入，不回传 repository read model。

## 推荐 denied reason 映射

| repository result | service result | denied audit reason | 说明 |
| --- | --- | --- | --- |
| `not_found` | `not_found` | `not_found_or_not_owned` | 不存在、跨租户、已删除统一不可见。 |
| `invalid_state_transition` | `invalid_transition` | `invalid_transition` | 使用既有 reason，不新增 reason；repository result 名称和 service result 名称做稳定映射。 |
| `validation_failed` | `validation_failed` | `invalid_his_connection_payload` | 状态 service 只接收安全解析后的 path / reasonCode / access context；validation_failed 表示状态命令输入不合法，可复用既有 HIS payload / input 非法 reason；不得记录 payload 原文。 |
| `conflict` | `conflict` | `invalid_transition` | 状态 API 中 conflict 本质为当前状态不适合重复或继续执行该生命周期动作，v1 先复用既有 `invalid_transition`，不新增 status conflict reason。 |
| thrown error | `service_unavailable` | 不写 denied audit | 不把内部异常、SQL、stack、`DATABASE_URL`、数据库错误全文写入 audit。 |

`conflict` 的后续增强边界：

- 当前 v1 不新增 `his_connection_status_conflict`。
- 如果后续产品需要区分“重复动作冲突”和“非法流转”，必须单独进入 audit reason / query whitelist 增强 PR。
- 增强 PR 必须同步评估 `AuditReason`、`AUDIT_REASON_VALUES`、query parser、domain tests、query parser tests、service tests 和文档。

## 不新增 reason 和 action

本 PR 不新增：

- `his_connection_status_conflict`
- `invalid_his_connection_status_transition`
- `invalid_his_connection_status_payload`
- `his_connection_status_validation_failed`
- 任何其他 audit reason
- 任何 audit action
- `pause`
- `resume`
- `revoke`
- `soft_delete`

本 PR 不修改：

- `AuditReason` 类型。
- `AUDIT_REASON_VALUES` / query whitelist。
- audit repository。
- audit domain tests。
- service。
- repository。
- parser。
- API route。
- 权限模型。
- schema / migration。

## 后续 service reason 使用范围

后续状态 service 实现 PR 只能使用既有 reason：

- `allowed_by_policy`
- `not_found_or_not_owned`
- `invalid_transition`
- `invalid_his_connection_payload`

后续状态 service 实现 PR 不能：

- 使用不存在的 reason。
- 把 repository error message 作为 reason。
- 把 database constraint 作为 reason。
- 把 status 写进 audit。
- 把 credentialRef 写进 audit。
- 把 healthStatus 写进 audit。
- 把 raw payload 写进 audit。

权限拒绝 audit 不由状态 service 负责；route / access layer 可继续按权限决策使用既有 access decision reason，例如 `missing_tenant`、`cross_tenant_denied` 或 `role_denied`。

## allowed audit 不受影响

状态 service 成功路径继续按前序状态 service Plan Mode 规划写 allowed audit：

| 操作 | resource | action | result | reason |
| --- | --- | --- | --- | --- |
| pause 成功 | `open_connection` | `manage_status` | `allowed` | `allowed_by_policy` |
| resume 成功 | `open_connection` | `manage_status` | `allowed` | `allowed_by_policy` |
| revoke 成功 | `open_connection` | `manage_status` | `allowed` | `allowed_by_policy` |
| delete / softDelete 成功 | `open_connection` | `delete` | `allowed` | `allowed_by_policy` |

allowed audit 不记录状态变化前后值，不记录凭证，不返回 read model。

## denied audit 敏感信息禁区

denied audit 不得记录：

- payload。
- request body。
- response body。
- body / query / header tenantId。
- `credentialRef`。
- `credentialConfigured`。
- token / secret / API key / OAuth token / basic auth。
- 签名密钥 / 私钥 / 连接串。
- raw HIS payload。
- SQL / stack / `DATABASE_URL`。
- 完整治疗正文 / 完整病历正文 / 咨询全文。
- 图片 / 文件原文。
- 数据库 constraint、索引名或冲突行详情。

错误响应同样不得回显上述内容。

## 后续 service tests 必须覆盖

后续状态 service 实现测试必须覆盖 reason 映射：

- `not_found -> not_found_or_not_owned`。
- `invalid_state_transition -> invalid_transition`。
- `validation_failed -> invalid_his_connection_payload`。
- `conflict -> invalid_transition`。
- thrown error 不写 denied audit。
- audit 失败返回 `service_unavailable`。
- audit event 不包含敏感信息。

还应覆盖：

- pause / resume / revoke 成功写 `manage_status + allowed_by_policy`。
- delete / softDelete 成功写 `delete + allowed_by_policy`。
- repository command 只包含 `tenantId`、`connectionId`、`actorUserId` 和可选安全 `reasonCode`。
- 不调用真实 HIS、不调用 fetch、不处理凭证、不创建治疗摘要或随访任务。

## 后续拆分

建议后续独立 PR 顺序：

1. 当前 PR：状态 service audit reason 映射 Plan Mode。
2. 下一 PR：状态 service 最小实现。
3. 再后续：pause / resume route。
4. 再后续：revoke / delete route。
5. 再后续：状态 API route tests。
6. 如 reason 不足，再进入 audit reason / query whitelist 增强。

## 当前验收清单

- [x] 明确当前 PR 是 Plan Mode，只规划状态 service denied audit reason 映射，不实现代码。
- [x] 明确当前 repository 状态方法稳定结果。
- [x] 明确 service 稳定结果规划。
- [x] 明确推荐 reason 映射方案。
- [x] 明确本 PR 不新增 audit reason。
- [x] 明确本 PR 不修改 audit domain / query whitelist / service / repository / parser / API route / 权限 / schema / migration。
- [x] 明确后续状态 service 实现 PR 的 reason 使用范围。
- [x] 明确 allowed audit 不受影响。
- [x] 明确 denied audit 敏感信息禁区。
- [x] 明确后续 service tests 必须覆盖 reason 映射。
- [x] 明确后续拆分。
