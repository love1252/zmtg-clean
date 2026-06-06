# Phase 23 HIS 连接配置凭证补偿 operation repository 边界规划

> 日期：2026-06-06
> 状态：docs-only Plan Mode。本文只规划 Phase 23 HIS 连接配置凭证补偿 operation repository 边界，不写实现代码，不修改 `src/**`，不修改 `drizzle/**`，不新增 schema / migration，不修改已存在 compensation operation 表，不实现 repository，不实现 outbox / job queue，不实现 compensation audit，不接真实 provider，不处理真实凭证，不做测试连接，不接真实 HIS。

## 本次范围

本 PR 只做 compensation operation repository 边界规划。

- 只新增规划文档并轻量同步 README、roadmap 和当天 devlog。
- 不写代码。
- 不修改 `src/**`。
- 不新增 schema / migration。
- 不修改现有 `his_connection_credential_compensation_operations` 表。
- 不实现 compensation operation repository。
- 不实现 outbox / job queue。
- 不实现 compensation audit。
- 不修改 audit repository。
- 不修改 route / service / parser / DTO。
- 不修改 provider / storage。
- 不接真实 KMS / Vault / provider。
- 不处理真实凭证。
- 不做测试连接。
- 不接真实 HIS。

## 前置状态

已完成：

- compensation metadata / operationId schema 最小边界。
- `his_connection_credential_compensation_operations` 表。
- server-generated safe operationId。
- `node:crypto randomUUID` 默认随机来源。
- compensation state enum：`compensation_pending`、`compensation_running`、`compensation_succeeded`、`compensation_failed`、`manual_review_required`。
- operation type enum：`credential_compensation`。
- provider failure category enum。
- schema / migration / type / test 准备层。
- provider failure audit / service audit 最小实现。

仍未完成：

- compensation operation repository。
- compensation operation service integration。
- outbox / job queue。
- compensation audit。
- audit repository metadata 写入。
- query parser metadata filter。
- real provider。
- real credential parser / service。
- 测试连接。
- 真实 HIS adapter。

## repository 职责边界

后续 repository 最小职责只围绕 `his_connection_credential_compensation_operations` 表：

- create operation。
- get by tenant + operationId。
- get by tenant + connectionId + operationId。
- mark running。
- mark succeeded。
- mark failed。
- mark manual review required。
- increment retry count。
- update lastAttemptAt。
- update completedAt。
- list pending by tenant / state，供后续 job 使用。
- list stale running，供后续 job 恢复使用。

repository 必须保持的边界：

- 只操作 compensation operation 表。
- 不写 audit。
- 不决定 audit reason。
- 不决定 audit result。
- 不调用 provider。
- 不调用 service。
- 不读取 request / header / query / localStorage。
- 不判断权限。
- 不返回真实凭证。
- 不返回 provider path。
- 不返回 secret path。
- 不返回 `credentialRef`。
- 不返回 idempotencyKey。
- 不保存 provider raw error。
- 不保存 request / response body。

## tenant / connection 隔离边界

所有 read / write 必须带可信 `tenantId`。

- connection 相关操作必须绑定 `tenantId + connectionId`。
- 不允许只按 operationId 跨租户读取。
- operationId 虽然有全局唯一约束，但不能替代 tenant scope。
- not found 与 cross tenant 必须统一稳定结果，例如 `not_found`。
- 不暴露 connection 是否存在。
- 不暴露 operation 是否属于其他 tenant。
- 不信任 body / query / header tenantId。
- repository 只接收 service / job 层传入的可信 tenant scope。

建议后续 repository result：

- `ok`：操作成功。
- `not_found`：目标不存在、跨租户、connection 不属于 tenant 或 operation 不属于 tenant。
- `conflict`：operationId 唯一冲突或状态并发冲突。
- `invalid_state_transition`：状态流转不允许。
- `validation_failed`：输入不是安全白名单。

## operationId 边界

operationId 必须由 server helper 生成。

- 默认随机来源继续使用 `node:crypto randomUUID`。
- repository 不接受 request 传入 operationId 作为可信来源。
- 如果 create operation 接受 operationId，必须是服务端已生成并通过 safe operationId 校验的值。
- repository 必须拒绝或不写入危险 operationId。
- operationId 不包含 tenantId。
- operationId 不包含 connectionId。
- operationId 不包含 `credentialRef`。
- operationId 不包含 provider path。
- operationId 不包含 secret path。
- operationId 不包含 idempotencyKey。
- operationId 不进入现有 audit event 字段。
- operationId 不进入 query parser。
- operationId 默认不返回前端。
- operationId 可以作为内部 service / job 的安全关联 key。

## state transition 边界

后续 repository 应规划保守状态机：

| 当前状态 | 允许目标状态 | 用途 |
| --- | --- | --- |
| `compensation_pending` | `compensation_running` | job 领取或 service 标记开始处理 |
| `compensation_running` | `compensation_succeeded` | 自动补偿完成 |
| `compensation_running` | `compensation_failed` | 自动补偿失败且由上层决定停止 |
| `compensation_running` | `manual_review_required` | 自动补偿不安全或无法判断 |
| `compensation_failed` | `compensation_running` | 上层确认允许重试后重新运行 |
| `manual_review_required` | `compensation_running` | 人工复核后由上层确认允许重试 |

必须禁止：

- `compensation_succeeded` 回退到其他状态，除非后续人工复核 Plan Mode 单独规划。
- 任意自由文本状态。
- 跳过 pending 直接 succeeded，除非同步补偿最小实现另行规划。
- 未校验 tenant / connection 的状态流转。
- repository 自动触发 provider。
- repository 自动写 audit。

状态更新必须使用当前状态条件，避免并发下重复完成、重复失败或重复进入人工复核。

## retry / stale running / manual review 边界

repository 只提供原子状态更新方法，不做业务策略判断。

- retryCount 递增应由显式方法完成，例如 increment retry count。
- retryCount 最大值是否达到，应由 service / job 层判断。
- repository 可以支持按 tenant / state / updatedAt 或 lastAttemptAt 查询 stale running。
- stale running 的阈值由 job / service 层传入，不在 repository 内写死。
- lastAttemptAt 在 mark running 或 retry attempt 开始时更新。
- completedAt 在 mark succeeded、mark failed 或 mark manual review required 时写入。
- manualReviewRequired 在进入 `manual_review_required` 时设置为 true。
- manual review 是否需要 actor，需要后续 service / audit / 权限规划。
- manual review 是否需要独立权限，需要后续 Plan Mode。
- manual review 是否需要独立表或 audit，需要后续 Plan Mode。
- 本 PR 不实现这些逻辑。

建议口径：

- repository 只保证原子写入、tenant scope、状态条件和安全字段。
- 是否重试、何时进入 manual review、是否 dead letter，由 service / job 层决定。
- repository 不读取 provider raw error，也不根据错误文本判断策略。

## failure category 边界

failureCategory 只允许安全 provider failure category 白名单：

- `provider_unavailable`
- `timeout`
- `retry_exhausted`
- `circuit_open`
- `validation_failed`
- `tenant_connection_mismatch`
- `idempotency_conflict`
- `invalid_state`
- `provider_write_failed`
- `provider_revoke_failed`
- `provider_describe_failed`
- `provider_health_failed`
- `repository_after_provider_failed`
- `audit_after_provider_failed`

禁止保存：

- provider raw error。
- stack。
- SQL。
- `DATABASE_URL`。
- raw HIS payload。
- secret path。
- `credentialRef`。
- idempotencyKey。
- request / response body。
- token。
- secret。
- API key。
- connection string。

## DTO / read model 边界

repository 可以返回内部安全 read model，供 service / job 使用。

允许返回：

- operationId，内部 service / job 可用，前端默认不暴露。
- tenantId。
- connectionId。
- operationType。
- state。
- failureCategory。
- retryCount。
- manualReviewRequired。
- createdAt。
- updatedAt。
- lastAttemptAt。
- completedAt。

禁止返回：

- provider path。
- secret path。
- `credentialRef`。
- idempotencyKey。
- scoped key。
- synthetic placeholder。
- raw credential。
- raw HIS payload。
- provider raw error。
- SQL。
- stack。
- `DATABASE_URL`。
- request body。
- response body。

read model 不应被直接当作 HTTP DTO。任何前端 DTO 暴露必须后续单独规划，并默认不暴露 operationId。

## transaction / consistency 边界

repository create / update 可以接收外部 transaction database，也可以使用当前 tenant database，但不能假装覆盖 provider / audit 的跨系统事务。

必须明确：

- compensation operation repository 与 credential repository 不天然同事务。
- compensation operation repository 与 provider 不在同一事务。
- compensation operation repository 与 audit repository 不在同一事务。
- create operation 成功但 provider / audit 失败时，只能由 service / job 层决定后续状态。
- provider cleanup 成功但 operation 更新失败时，需要后续 outbox / job / manual review 承载。
- audit 写入失败不能由 repository 自行补偿。
- outbox 引入前，repository 只提供状态表和安全读写，不承诺后台补偿完成。
- outbox 引入后，operation 表可作为状态事实表，outbox / job 负责领取、锁定、执行和重试。
- 本 PR 不实现事务编排。

## outbox / job queue 关系边界

compensation operation repository 不等同于 outbox。

- operation repository 负责状态事实表读写。
- outbox / job queue 负责任务投递、领取、锁定、执行、重试和 dead letter。
- outbox / job queue 仍需单独 Plan Mode。
- operation repository 可以为后续 outbox / job 提供 pending / stale running 查询。
- job 领取 pending operation 需要额外 claim / lock 边界。
- stale running 恢复需要后续 job 规划。
- 本 PR 不实现 outbox。
- 本 PR 不实现 worker。
- 本 PR 不实现 claim。
- 本 PR 不实现 lock。

## audit 边界

repository 不写 audit。

- repository 不决定 audit reason。
- repository 不决定 audit result。
- repository 不决定 actor。
- repository 不写 audit metadata。
- compensation audit 必须后续单独实现。
- audit repository metadata 写入仍未实现。
- query parser metadata filter 仍未实现。
- operationId 不进入现有 audit event 字段。
- 如未来要关联 audit，需要 metadata schema 或 safe operation association。
- provider failure audit / service audit 维持已完成的最小边界，不在本阶段改造。

## 测试拆分建议

后续 repository 实现建议先写测试，再写实现。

建议测试覆盖：

- create operation success。
- operationId 唯一冲突。
- tenant isolation。
- connection tenant FK / not found。
- get by tenant + operationId。
- get by tenant + connectionId + operationId。
- state transition valid。
- state transition invalid。
- retry count increment。
- manual review required。
- stale running query。
- pending query。
- no sensitive fields returned。
- forbidden operationId rejected。
- forbidden failure category rejected。
- repository 不写 audit。
- repository 不调用 provider。
- repository 不读 request / header / query / localStorage。

建议测试文件：

- `src/modules/institution/tests/HisConnectionCredentialCompensationOperationRepository.test.ts`
- 只在后续实现 PR 中新增，本 PR 不新增测试文件。

## 后续阶段边界

本 PR 不进入：

- repository 实现。
- service integration。
- route / API。
- compensation audit。
- outbox / job queue。
- audit metadata。
- query parser metadata filter。
- real provider。
- real credential parser / service。
- 测试连接。
- 真实 HIS adapter。
- webhook / sync。
- 患者身份匹配。
- 自动摘要 / 自动任务 / 自动触达。
- 企微。
- AI / RAG / Agent。
- 经营智能中心、图表、导出。

## 下一阶段建议

建议顺序：

1. compensation operation repository 最小实现。
2. repository tests。
3. outbox / job queue Plan Mode。
4. compensation audit Plan 或最小实现。
5. real credential one-time material parser / service Plan Mode。
6. 测试连接 Plan Mode。
7. 真实 HIS adapter Plan Mode。

## 边界确认

- 是否 docs-only：是。
- 是否修改 `src/**`：否。
- 是否修改 `drizzle/**`：否。
- 是否新增 API route：否。
- 是否修改 route / service / parser / DTO / provider / repository：否。
- 是否修改权限：否。
- 是否修改 audit domain / reason / query whitelist：否。
- 是否修改 audit repository：否。
- 是否修改 schema / migration：否。
- 是否修改测试：否。
- 是否实现 repository：否。
- 是否实现 outbox / job queue：否。
- 是否实现 compensation audit：否。
- 是否接真实 KMS / Vault / provider：否。
- 是否处理真实凭证：否。
- 是否做测试连接：否。
- 是否接真实 HIS：否。
- 是否保存 raw HIS payload：否。
