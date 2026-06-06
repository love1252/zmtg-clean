# Phase 23 HIS 连接配置凭证 provider 失败补偿与审计边界规划

> 日期：2026-06-06
> 状态：Phase 23 HIS 连接配置凭证 provider failure / compensation / audit Plan Mode 文档。本 PR 只做 docs-only 规划，不写代码、不新增 API、不修改 `src/**`、不接真实 KMS / Vault / provider、不处理真实凭证、不做测试连接、不接真实 HIS、不新增 schema / migration。

## 本次范围

本 PR 只规划 Phase 23 HIS 连接配置凭证 provider failure、compensation 和 audit 一致性边界，承接已完成的凭证 provider 抽象接口最小边界。

本 PR 明确只做：

- docs-only Plan Mode。
- 规划 provider failure 分类和稳定处理口径。
- 规划 provider 与 repository / audit 之间无法同事务时的补偿边界。
- 规划 compensation 触发条件、状态、幂等、重试和人工处理边界。
- 规划 provider failure / compensation 是否需要新增 audit reason / action / query whitelist。
- 规划 audit metadata 允许记录的安全摘要和禁止记录的敏感字段。
- 规划 route / service / provider 的未来调用顺序。
- 规划 DTO / error mapping 和测试拆分建议。
- 同步 README、roadmap 和当天 devlog。

本 PR 明确不做：

- 不写代码。
- 不新增 API。
- 不修改现有 API 行为。
- 不修改 `src/**`。
- 不修改 route、service、parser、DTO、provider、storage、repository、权限实现、权限测试、audit domain、audit reason、audit query whitelist、audit repository、schema、migration、测试或 demo seed。
- 不实现 provider failure handling。
- 不实现 compensation job / queue。
- 不新增 audit reason 或 action。
- 不接真实 KMS / Vault / cloud secret manager。
- 不保存、处理或演示任何真实凭证。
- 不保存 token、secret、API key、connection string、OAuth token、basic auth、private key、signing key 或 raw credential。
- 不让 HTTP route 接收真实凭证明文。
- 不改造 parser 放行真实凭证材料。
- 不做测试连接。
- 不接真实 HIS 或机构系统。
- 不保存 raw HIS payload。
- 不创建治疗摘要。
- 不创建随访任务。
- 不自动触达客户。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做经营智能中心、图表或导出。

如果后续实现必须新增 provider failure result、compensation 状态持久化、audit reason / query whitelist、schema / migration、job queue、真实 provider、真实凭证 parser、测试连接或真实 HIS adapter，必须进入独立 Plan Mode 或独立实现 PR，不能混入当前 docs-only PR。

## 前置状态

当前已完成：

- HIS 连接配置凭证 repository / storage 最小边界。
- repository 安全 `credentialRef` 写入、轮换、清空和撤销最小方法。
- `credentialConfigured` 从安全 read model / summary 派生。
- fake in-memory storage 测试抽象。
- HIS 连接配置凭证 parser / service / DTO 最小实现。
- parser 只接受合成 `synthetic_placeholder_*`，拒绝 token、secret、API key、connection string、raw credential、raw payload 和 external secret path。
- service 只接收服务端可信 `accessContext`、path `connectionId`、database、repository、provider-like storage 和 parsed input。
- DTO 只返回 `{ ok, credentialConfigured }` 或稳定 code / error，不返回 `credentialRef`、idempotencyKey、scoped key、provider path 或敏感字段。
- HIS 连接配置凭证 API route / permission / audit 最小实现。
- create / update / rotate / clear / revoke 五个凭证 API route。
- `open_connection:manage_credentials` 最小权限动作。
- route denied audit 和 service allowed audit。
- 凭证加密与真实 secret manager Plan Mode。
- provider 抽象接口最小边界。
- `HisConnectionCredentialProvider` 最小接口。
- `createInMemoryHisConnectionCredentialProvider()` test-only provider。
- provider health / describe 安全摘要。
- `createInMemoryHisConnectionCredentialStorage()` route 兼容入口仍保持 test-only。

当前仍未完成：

- provider failure handling。
- compensation job / queue。
- provider failure audit reason。
- compensation audit reason。
- 真实 KMS / Vault / cloud secret manager provider。
- 真实凭证 one-time material 接收。
- 真实凭证 parser / service。
- schema / migration。
- provider failure / compensation 状态持久化。
- 测试连接。
- 连接健康检查。
- 真实 HIS adapter。

当前 provider 抽象接口最小实现只说明系统已有内部 server-side provider 形状和 test-only provider，不代表系统可以接收真实凭证明文，不代表已接入真实 secret manager，不代表已实现 provider failure 补偿，不代表已能测试连接，也不代表真实 HIS adapter 可以读取凭证发起外部调用。

## provider failure 分类

下表只规划未来处理口径，不实现。

| failure 分类 | 是否可重试 | 是否可安全返回稳定错误 | 是否需要 compensation | 是否需要 audit | 是否允许业务继续 | 是否 fail closed | orphan secret 风险 | `credentialConfigured` 展示风险 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| provider unavailable | 是，限次重试和退避 | 是，映射 `service_unavailable` | 通常不需要，因 provider 未写入 | 需要记录安全摘要 | 否 | 是 | 低 | 应保持原状态，不得展示新配置成功 |
| timeout | 是，限次重试；超时后停止 | 是，映射 `service_unavailable` | 需要评估，因为写入结果可能未知 | 需要记录 timeout 摘要 | 否 | 是 | 中，provider 可能已完成写入 | 不得切换为 configured，必要时进入 pending / manual review |
| retry exhausted | 否，当次请求停止 | 是，映射 `service_unavailable` | 视最后一次 provider 状态是否未知而定 | 需要记录 retry count | 否 | 是 | 中 | 不得展示新配置成功 |
| circuit open | 否，不应继续打 provider | 是，映射 `service_unavailable` | 通常不需要 | 需要记录 circuit open 摘要 | 否 | 是 | 低 | 应保持原状态 |
| validation failed | 否 | 是，映射 `validation_failed` | 不需要 | 可记录 denied 或 service failure 摘要，不能写输入 | 否 | 是 | 低 | 不改变 |
| tenant / connection mismatch | 否 | 是，映射 `not_found` 或 `validation_failed`，具体以后续服务边界为准 | 不需要 | 需要安全 audit，避免暴露是否存在 | 否 | 是 | 低 | 不改变 |
| idempotency conflict | 通常否，除非冲突来源可证明同一请求 | 是，可规划为 `conflict` 或 `validation_failed` | 可能需要人工确认 | 需要记录冲突摘要 | 否 | 是 | 中，可能已有不同版本 | 不得静默展示 configured |
| provider store succeeded but repository failed | provider 写入不重试；repository 可按事务结果处理 | 是，通常映射 `service_unavailable` | 需要，清理或禁用 orphan secret | 需要记录 provider succeeded / repository failed 摘要 | 否 | 是 | 高 | 高；repository 不应展示 configured，但 provider 存在孤儿 secret |
| repository succeeded but provider failed | 不应先 repository 成功再 provider 写入；如真实流程发生则需修复流程 | 是，映射 `service_unavailable` 或进入 manual review | 需要，撤销 repository 引用或标记不可用 | 需要记录一致性异常摘要 | 否 | 是 | 低到中 | 高；可能错误展示 configured |
| provider succeeded but audit failed | provider 和 repository 成功后 audit 失败 | 是，当前 allowed audit 失败口径应 fail closed；补偿需后续评估 | 可能需要，取决于是否允许撤销本次 provider / repository 结果 | 需要，但 audit 自身失败时只能写补偿或后续告警 | 否或进入受控不可用状态 | 是 | 中 | 中；若 repository 已成功但响应失败，前端可能重试 |
| provider revoke failed | 是，限次重试 | 是，映射 `service_unavailable` | 需要，避免已撤销连接仍可用凭证 | 需要记录 revoke failure 摘要 | 否 | 是 | 中 | 高；不能展示 revoked / missing 已完成 |
| provider describe failed | 是，限次重试 | 是，内部 describe 不应影响公开 DTO，除非用于关键流程 | 通常不需要 | 可记录 provider health / describe 摘要 | 视调用场景；写入路径通常否 | 关键路径 fail closed | 低 | 低到中，不得因 describe 失败猜测 configured |
| provider health failed | 是，按 health 轮询策略 | 是，前端只可看稳定 health / unavailable 摘要 | 通常不需要 | 可记录 health failure 摘要 | 不应允许依赖 provider 的写入继续 | 写入 fail closed | 低 | 低；health 不等于测试连接 |

通用原则：

- 所有 provider failure 默认 fail closed。
- provider 原始错误不得进入 DTO、audit metadata、日志、devlog、PR 描述或截图。
- provider failure 不得自动降级为明文存储。
- provider failure 不得跳过权限、parser、repository 租户边界或 audit 安全边界。
- 任何可能产生 orphan secret 或错误 `credentialConfigured` 展示的场景，都必须进入 compensation 或 manual review 规划。

## compensation 边界

本 PR 只规划 compensation，不实现 job、queue、schema、migration 或后台管理 UI。

建议触发条件：

- provider store 成功但 repository set / rotate 失败。
- provider rotate 新版本成功但 repository 切换失败。
- repository 已引用新凭证但 allowed audit 失败，并且当前策略要求 audit fail closed。
- repository clear / revoke 成功但 provider revoke / disable 失败。
- provider timeout 后无法判断 store / revoke 是否完成。
- retry exhausted 后 provider 状态未知。
- idempotency conflict 无法安全判定同一请求。
- provider describe / health 暴露出 repository 与 provider 状态不一致。

建议状态枚举，仅规划不实现：

- `compensation_pending`：已识别不一致，等待处理。
- `compensation_running`：补偿流程正在执行。
- `compensation_succeeded`：补偿成功，已清理或禁用风险状态。
- `compensation_failed`：补偿失败，可重试或等待人工介入。
- `manual_review_required`：无法自动判断，必须人工复核。

建议幂等 key：

- 必须绑定 `tenantId + connectionId + operation + safeOperationId`。
- 可包含 provider 类型摘要、operation 类型和不可逆 version digest 短摘要。
- 不得包含真实 secret、provider internal path、`credentialRef`、idempotencyKey、scoped idempotency key、synthetic placeholder 或 request body。
- 同一 compensation key 多次执行必须安全返回同一状态或继续已有处理，不得重复创建 provider secret version。

建议 retry 策略：

- 只对明确可重试错误重试，例如 provider unavailable、timeout、429、5xx 或临时网络错误。
- validation failed、tenant / connection mismatch、明显权限错误和不可恢复 provider policy 错误不得自动重试。
- 必须设置次数上限、退避上限和总时长上限。
- retry count 只能作为安全摘要进入 audit metadata，不得携带 provider 原始错误。
- retry exhausted 后进入 `compensation_failed` 或 `manual_review_required`。

人工处理边界：

- 人工处理只能看到安全摘要：tenantId、connectionId、operation、failure category、provider 类型摘要、version digest 短摘要、compensation state、retry count 和时间戳。
- 人工处理不得看到真实凭证、provider internal path、KMS key material、完整 `credentialRef`、idempotencyKey、scoped key、request body、response body、SQL、stack 或 provider error full text。
- 人工处理操作必须二次审计，后续如实现需单独定义权限和 audit reason。
- 人工处理不得绕过 tenant / connection 绑定。

tenant / connection 绑定：

- compensation 必须绑定可信 `tenantId + connectionId`。
- compensation 不得接受前端 body / query / header 提供的 tenantId 覆盖。
- compensation 不得跨租户查询或清理 provider secret。
- 如果 provider namespace 无法证明 tenant / connection 绑定，必须进入 manual review，不得自动清理。

orphan secret 检测与清理：

- orphan secret 指 provider 已创建或保留 secret，但 repository 没有安全引用，或 repository 操作失败导致业务不可见的 secret。
- 检测只能使用 provider 安全摘要、不可逆 digest、tenant / connection 绑定和操作 id。
- 清理优先 disable / revoke，物理删除是否允许必须按合规保留和备份策略单独评估。
- orphan cleanup job 是否需要后续单独 Plan Mode：需要。
- cleanup job 如需持久化扫描游标、状态、锁、重试次数或人工处理记录，必须后续单独评估 schema / migration。

schema / migration 边界：

- 如果只在 service 内同步补偿并不持久化状态，可能暂不新增 schema / migration。
- 如果需要保存 compensation state、failure category、retry count、operation id、version digest、manual review 状态或 outbox 记录，必须后续单独 Plan Mode 评估 schema / migration。
- 当前 PR 不新增 schema / migration。

## audit reason / action 边界

本 PR 只规划 audit reason / action，不实现 domain、query whitelist 或 repository 改造。

action 边界：

- 凭证管理主流程建议继续复用 `manage_credentials` action。
- provider failure 与 compensation 是否新增独立 action 需后续评估；v1 可优先复用 `manage_credentials` 并通过 reason / metadata 表达失败分类。
- 如果后续需要平台或安全运营视角的补偿处理 action，必须单独评估权限、audit query whitelist 和 UI 展示。

候选 reason，仅规划不实现：

- `provider_unavailable`
- `provider_timeout`
- `provider_retry_exhausted`
- `provider_circuit_open`
- `provider_write_failed`
- `provider_revoke_failed`
- `repository_after_provider_failed`
- `audit_after_provider_failed`
- `compensation_scheduled`
- `compensation_succeeded`
- `compensation_failed`
- `manual_review_required`

reason 使用建议：

- provider unavailable / timeout / retry exhausted / circuit open 可以独立 reason，方便运营和告警聚合。
- provider store succeeded but repository failed 建议使用 `repository_after_provider_failed`。
- provider succeeded but audit failed 建议使用 `audit_after_provider_failed`。
- revoke / clear provider 失败建议使用 `provider_revoke_failed`。
- compensation 进入队列、成功、失败和人工处理建议使用独立 reason。
- idempotency conflict 是否新增 reason 需后续评估；如不新增，可先映射到稳定 `validation_failed` / `conflict` 业务结果并在安全 metadata 中记录 failure category。

query whitelist 边界：

- 如果新增 provider / compensation reason，audit query parser 必须同步白名单。
- 如果新增 action，audit action 白名单必须同步。
- 不允许出现 domain 已写入但 query whitelist 无法查询的半成品状态。
- 本 PR 不修改 audit domain / reason / query whitelist。

audit repository 边界：

- 现有 audit repository 只保存标准 event 字段，尚无 metadata 字段。
- 如果后续要记录 provider 类型摘要、version digest、failure category、compensation state 或 retry count，可能需要 metadata schema / migration。
- 在没有 metadata 持久化前，不能把安全摘要挤进 `reason`、`resourceId` 或错误文本中。
- 本 PR 不修改 audit repository。

## audit metadata 边界

如果后续引入 audit metadata，只允许记录安全摘要。

允许记录：

- actor id / role / scope / source。
- tenantId。
- resource。
- resourceId。
- action。
- result。
- reason。
- provider 类型摘要。
- provider mode。
- credential type。
- version digest 短摘要。
- failure category。
- compensation state。
- retry count。
- occurredAt。

禁止记录：

- 真实凭证。
- token。
- secret。
- API key。
- connection string。
- OAuth access token。
- OAuth refresh token。
- basic auth 用户名密码组合。
- private key。
- signing key。
- raw credential。
- raw HIS payload。
- external secret path。
- provider internal path。
- KMS key material。
- `credentialRef`。
- idempotencyKey。
- scoped idempotency key。
- synthetic placeholder。
- SQL。
- stack。
- DATABASE_URL。
- request body。
- response body。
- provider error full text。

metadata 脱敏原则：

- provider 类型可记录为枚举摘要，例如 `in_memory_test_only`、`external_secret_manager`、`database_encrypted_store`，不得记录 endpoint、path、policy、secret id 或 key id。
- version digest 必须是不可逆短摘要，不得能反推出 `credentialRef` 或 provider path。
- retry count 只能是数字摘要。
- failure category 必须来自白名单枚举，不得使用 provider 原始 message。
- compensation state 必须来自白名单枚举，不得包含人工备注原文中的敏感信息。

## transaction / consistency 边界

provider 与 database 无法同事务：

- provider 写入、数据库 repository 写入和 audit 写入无法天然组成单一 ACID 事务。
- 后续实现必须明确操作顺序、失败后可补偿路径和响应语义。
- 不得用“假事务”描述 provider 与 database 的一致性。
- 任何跨系统写入都必须接受 unknown outcome，并设计 timeout / retry / manual review。

provider store 成功、repository 失败：

- 风险：产生 orphan secret。
- 响应：返回稳定 `service_unavailable`，不得回显 provider 细节。
- 补偿：应进入 `compensation_pending`，尝试 disable / revoke orphan secret。
- audit：应记录安全 failure 摘要；如果 audit 也失败，需要 outbox 或后续人工告警规划。
- read model：repository 未成功时不得展示 `credentialConfigured=true`。

repository 成功、provider revoke 失败：

- 风险：业务 read model 可能显示已清除 / 已撤销，但 provider 中 secret 仍可用。
- 响应：应 fail closed；如 repository 已提交，需补偿状态或人工复核。
- 补偿：应重试 provider revoke / disable；失败后进入 manual review。
- audit：应记录 `provider_revoke_failed` 或 compensation failure 摘要。
- read model：不得展示“凭证已安全撤销”这种强语义；如需要展示，应另有受控状态。

provider 成功、audit 失败：

- 当前 service allowed audit 失败会 fail closed。
- 后续真实 provider 下，如果 provider 与 repository 已成功但 audit 失败，需要决定是否补偿撤销 provider / repository，或写入 outbox 后返回失败。
- allowed audit 是否必须 fail closed：建议继续 fail closed，除非后续有可靠 outbox 保证 audit 最终一致。
- audit 失败不得导致敏感 provider 信息进入错误响应。

audit 成功、repository 失败：

- 风险：audit 记录了 allowed 或 failure，但 repository 没有完成。
- allowed audit 应尽量在 repository 成功后写入。
- 如果出现 audit 成功、repository 失败，应写后续 correction / compensation audit，避免审计误导。
- 当前 PR 不实现 correction audit。

route denied audit：

- route 权限拒绝和 parser 失败仍建议 fail closed。
- permission denied 不应调用 provider。
- parser failure 不应调用 provider。
- route denied audit 不应携带真实凭证、request body、provider 信息或外部错误。

provider failure 返回：

- provider unavailable、timeout、retry exhausted、circuit open 和未知 provider error 应返回 `service_unavailable`。
- provider validation failed 可返回 `validation_failed`。
- provider 原始错误不得进入 DTO。

compensation 记录写入失败：

- 如果 compensation 状态需要持久化但写入失败，请求必须 fail closed。
- 如果 provider 已发生写入且 compensation 记录失败，应触发高优先级人工告警或 outbox fallback；具体实现需后续单独规划。
- 不得因为 compensation 记录失败而把凭证标记为成功可用。

outbox / inbox / job queue：

- 如需要跨 provider、database、audit 的最终一致性，建议单独规划 outbox / inbox / job queue。
- outbox 需要 schema / migration、锁、重试、去重、状态流转、监控和人工处理边界。
- 当前 PR 不实现 outbox / inbox / job queue。

schema / migration：

- provider failure 与 compensation 如果只停留在同步 service 返回，可能暂不需要 schema / migration。
- 只要需要持久化 compensation state、failure category、retry count、operation id、outbox event、manual review 或 provider version digest，就必须单独 Plan Mode 评估 schema / migration。
- 当前 PR 不新增 schema / migration。

## route / service / provider 调用顺序

未来实现建议顺序：

1. 读取 path `connectionId`，空值直接返回稳定 not found。
2. 从服务端 session / access context 获取 actor 和 tenant。
3. 执行 `open_connection:manage_credentials` 权限判断。
4. 权限拒绝写 route denied audit；audit 失败 fail closed。
5. 权限通过后才读取 body。
6. parser 解析 body；parser failure 写 route denied audit。
7. route 调用 service，只传 access context、path connectionId、parsed input、database、provider / repository / audit factory。
8. service 内部标准化可信 tenantId、actorUserId、connectionId。
9. service 调用 provider store / rotate / revoke / describe；provider failure 只返回稳定 result 或抛出后由 service 脱敏映射。
10. provider store / rotate 成功后，service 写 repository 安全引用或版本摘要。
11. repository 成功后，service 写 allowed audit。
12. 任一跨系统失败时，service 按规划触发 compensation fallback 或返回稳定错误。
13. service 返回稳定 result。
14. route 做 DTO mapping。

必须明确：

- route 不接触 provider internal path。
- route 不接触真实 secret。
- route 不接触完整 `credentialRef`，只接收 service result / DTO。
- parser failure 不调用 provider。
- permission denied 不调用 provider。
- service failure 不重复 route denied audit。
- provider failure 不返回原始错误。
- provider health 不等于 HIS 测试连接。
- test connection 必须后续单独 Plan Mode，不得混入 provider failure 实现。

## DTO / error mapping 边界

建议映射：

- provider unavailable -> `service_unavailable`
- timeout -> `service_unavailable`
- retry exhausted -> `service_unavailable`
- circuit open -> `service_unavailable`
- provider validation failed -> `validation_failed`
- tenant / connection mismatch -> `not_found` 或 `validation_failed`，以避免暴露跨租户存在性为准。
- idempotency conflict -> 后续评估是否使用 `conflict`；如果无法安全表达，先 fail closed 为 `service_unavailable` 或 `validation_failed`。
- invalid state -> `invalid_state_transition`
- provider store succeeded but repository failed -> `service_unavailable`
- provider succeeded but audit failed -> `service_unavailable`
- provider revoke failed -> `service_unavailable`
- compensation pending -> v1 可继续返回 `service_unavailable`；如未来需要公开状态，必须新增独立安全 DTO。
- manual review required -> v1 对前端隐藏为 `service_unavailable`，内部安全审计记录 manual review 摘要。

响应必须继续：

- 只返回稳定 code / error。
- 不返回 provider path。
- 不返回 provider internal path。
- 不返回 `credentialRef`。
- 不返回 idempotencyKey。
- 不返回 scoped idempotency key。
- 不返回 token、secret、API key、connection string、raw credential 或 raw HIS payload。
- 不返回 stack、SQL、DATABASE_URL。
- 不回显输入。
- 不返回 provider error full text。
- 不返回 compensation 内部 key。

## 测试拆分建议

后续实现时建议拆为独立测试，不在本 PR 编写。

- provider failure mapping tests：覆盖 unavailable、timeout、retry exhausted、circuit open 到稳定 service result。
- provider timeout tests：覆盖 unknown outcome 不展示配置成功。
- retry exhausted tests：覆盖 retry count 安全摘要和最终 fail closed。
- circuit open tests：覆盖不继续调用 provider。
- provider store success + repository failure tests：覆盖 orphan secret compensation scheduled。
- repository success + provider revoke failure tests：覆盖 revoke compensation 和 read model 风险。
- provider success + audit failure tests：覆盖 allowed audit fail closed 和无敏感泄露。
- compensation state tests：覆盖 pending、running、succeeded、failed、manual review。
- compensation idempotency tests：覆盖 `tenantId + connectionId + operation + safeOperationId` 去重。
- audit metadata sensitive field tests：覆盖 provider path、secret、placeholder、idempotencyKey、`credentialRef` 不进入 audit。
- DTO no leak tests：覆盖 provider error、stack、SQL、DATABASE_URL 不进入响应。
- route no provider call on permission denied：权限拒绝时 provider 不被调用。
- route no provider call on parser failure：parser 失败时 provider 不被调用。
- service no raw provider error leak：service 捕获 provider error 后只返回稳定 code。
- no real provider call tests：确保测试中不访问真实 KMS / Vault / cloud provider。
- no real HIS call tests：确保 provider failure 测试不调用 HIS。
- no test connection tests：确保 provider health / failure 不等同测试连接。

## 后续阶段边界

本 PR 不进入：

- provider failure 实现。
- compensation 实现。
- audit reason / action 实现。
- audit query whitelist 扩展。
- audit repository 改造。
- schema / migration。
- job queue。
- outbox / inbox。
- real provider。
- parser 真实凭证材料。
- API route 改造。
- service failure handling 改造。
- provider storage 改造。
- 测试连接。
- 连接健康检查。
- 真实 HIS adapter。
- webhook / 同步任务。
- 患者身份匹配。
- 自动治疗摘要。
- 自动随访任务。
- 自动触达。
- 企微。
- AI / RAG / Agent。
- 经营智能中心。
- 图表 / 导出。

## 下一阶段建议

建议顺序：

1. provider failure / compensation domain 最小实现 Plan Mode 或实现 PR。
2. audit reason / query whitelist 扩展 Plan Mode。
3. real credential one-time material parser / service Plan Mode。
4. 测试连接 Plan Mode。
5. 真实 HIS adapter Plan Mode。

真实凭证材料、测试连接和真实 HIS adapter 不应混入 provider failure / compensation / audit 的同一个实现 PR。

## 边界确认

- 是否 docs-only：是。
- 是否修改 `src/**`：否。
- 是否新增 API route：否。
- 是否修改 route / service / parser / DTO / provider / repository：否。
- 是否修改权限：否。
- 是否修改 audit domain / reason / query whitelist：否。
- 是否修改 schema / migration：否。
- 是否修改测试：否。
- 是否实现 provider failure / compensation / audit：否。
- 是否接真实 KMS / Vault / provider：否。
- 是否处理真实凭证：否。
- 是否保存 token / secret / API key / connection string：否。
- 是否做测试连接：否。
- 是否接真实 HIS：否。
- 是否保存 raw HIS payload：否。
