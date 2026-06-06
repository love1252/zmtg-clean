# Phase 23 HIS 连接配置凭证补偿审计边界规划

> 日期：2026-06-06
> 状态：Phase 23 HIS 连接配置凭证 compensation audit Plan Mode 文档。本 PR 只做 docs-only 规划，不写代码、不修改 `src/**`、不新增 audit reason / action / result、不新增 metadata schema、不修改 audit repository、不新增 schema / migration、不实现 compensation audit、不实现 job queue / outbox / cleanup、不处理真实凭证、不做测试连接、不接真实 HIS。

## 本次范围

本 PR 只规划 HIS 连接配置凭证 compensation audit 的职责、状态、metadata、schema、outbox、fail closed 和后续测试拆分边界，承接已完成的 provider failure audit / service audit 最小实现。

本 PR 明确只做：

- docs-only Plan Mode。
- 规划 compensation audit 状态语义。
- 规划 compensation audit 职责归属。
- 规划 metadata / schema 前置边界。
- 规划 outbox / job queue 前置边界。
- 规划 audit reason / result 复用边界。
- 规划 provider failure audit 与 compensation audit 的关联边界。
- 规划 fail closed / best effort 取舍。
- 规划后续测试拆分建议。
- 同步 README、roadmap 和当天 devlog。

本 PR 明确不做：

- 不写代码。
- 不修改 `src/**`。
- 不新增 API route。
- 不修改 route、service、parser、DTO、provider、storage、repository 或权限。
- 不修改 audit domain / reason / query whitelist。
- 不修改 audit repository。
- 不新增 audit reason。
- 不新增 audit action。
- 不新增 audit result。
- 不新增 metadata schema。
- 不新增 schema / migration。
- 不修改测试。
- 不实现 compensation audit。
- 不修改 provider failure audit。
- 不修改 service allowed audit。
- 不修改 route denied audit。
- 不实现 job queue / outbox / cleanup。
- 不接真实 KMS / Vault / provider。
- 不处理真实凭证。
- 不保存 token、secret、API key、connection string 或 raw HIS payload。
- 不让 HTTP route 接收真实凭证明文。
- 不改造 parser 放行真实凭证材料。
- 不做测试连接。
- 不接真实 HIS。
- 不创建自动治疗摘要、自动随访任务或自动触达。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做经营智能中心、图表或导出。

## 前置状态

当前已完成：

- HIS 连接配置凭证 API route / permission / audit 最小实现。
- `open_connection:manage_credentials` 权限动作。
- route denied audit：权限拒绝和 parser failure 写 `manage_credentials` / `denied` audit。
- service allowed audit：凭证 repository 成功后写 `manage_credentials` / `allowed` audit。
- 凭证 provider abstraction。
- provider failure / compensation domain 最小实现。
- provider failure 白名单分类。
- domain-only compensation summary。
- provider failure 到现有 service result code 的稳定映射。
- audit reason / query whitelist 最小实现。
- provider failure audit / service audit Plan Mode。
- provider failure audit / service audit 最小实现。
- service 层已对 known safe provider failure 写 `open_connection` / `manage_credentials` / `denied` audit。

当前仍未完成：

- compensation audit 写入。
- compensation state 持久化。
- compensation job / outbox。
- audit metadata schema。
- audit repository 改造。
- schema / migration。
- real provider。
- real credential parser / service。
- 测试连接。
- 真实 HIS adapter。

当前审计事件仍只有标准字段：actor、tenant、resource、resourceId、action、result、reason、occurredAt、source。当前没有 metadata 字段，也没有 compensation state 表、outbox 表或 job queue。

## compensation audit 状态边界

下表只规划状态语义，不实现写入。

| compensation 状态 | 触发场景 | 是否写 audit | reason | result | 用户侧可见 | 平台侧可筛选 | 是否需要 metadata | 是否需要持久化 state | 是否需要 schema / migration | 是否需要 outbox / job queue | 是否可能人工复核 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `compensation_pending` | 已识别 provider / repository / audit 不一致，但尚未开始处理。例如 provider store 成功、repository set 失败；provider timeout 后结果未知；allowed audit fail closed 后需要追踪一致性。 | 建议写，但必须有可追踪 state 或 operation id 后再实现。 | `compensation_pending` | `denied` | 不直接对普通机构用户展示，只返回稳定错误。 | 是，可通过现有 reason 查询。 | 需要，至少 operation、failure category、state、occurredAt。 | 需要，否则无法表达 pending 生命周期。 | 需要，除非只做同步一次性补偿且不追踪 pending。 | 通常需要。 | 是，若自动补偿风险不明。 |
| `compensation_running` | outbox/job 已领取补偿任务并开始执行。 | 有 job / outbox 后才适合写。 | `compensation_running` | `denied` | 不直接对普通机构用户展示。 | 是。 | 需要 retry count、operation、state。 | 需要。 | 需要。 | 需要。 | 可能，若运行中发现状态不可判定。 |
| `compensation_succeeded` | 自动补偿已完成，例如 orphan secret 被 revoke / disable，或 repository 引用已回滚到安全状态。 | 建议写。 | `compensation_succeeded` | `allowed` | 普通机构用户仍只看稳定业务状态，不看 provider 内部细节。 | 是。 | 需要，至少 operation、state、safe digest、completedAt。 | 需要。 | 需要，若需要可追踪闭环。 | 通常需要。 | 通常否，但人工补偿成功也应有独立人工操作审计。 |
| `compensation_failed` | 自动补偿失败，达到重试上限或遇到不可恢复 provider / repository / audit 错误。 | 建议写。 | `compensation_failed` | `denied` | 不展示原始失败；可在后续安全运营界面展示稳定摘要。 | 是。 | 需要 failure category、retry count、state、lastAttemptAt。 | 需要。 | 需要。 | 需要 dead letter 或等价状态。 | 是。 |
| `manual_review_required` | 无法自动判断或自动补偿不安全，例如 provider timeout 后状态未知、idempotency conflict 无法证明同一请求、tenant / connection 绑定无法证明、自动清理可能删除有效凭证。 | 建议写。 | `manual_review_required` | `denied` | 普通机构用户不看内部细节；后续平台 / 安全运营角色可看安全摘要。 | 是。 | 需要 manual review flag、operation、state、reason。 | 需要。 | 需要。 | 需要人工处理队列或等价状态。 | 是。 |

状态通用边界：

- compensation audit 不得把 state 拼进 action、resourceId 或 source。
- `compensation_succeeded` 可规划使用 `allowed`，其他 compensation 状态优先使用 `denied`。
- 所有状态都必须继续复用 `open_connection` resource 和 `manage_credentials` action。
- 当前没有 metadata schema 和持久化 state，因此不应在本阶段实现完整 compensation audit。

## compensation audit 职责边界

职责归属建议：

- compensation audit 应由 compensation domain / job 层写入。
- service 层当前只负责 provider failure audit，以及返回稳定 service status。
- provider layer 不允许直接写 compensation audit。
- route layer 不允许写 compensation audit。
- route layer 继续只处理 permission denied、parser failure 和 malformed JSON 的 route denied audit。
- provider failure audit 与 compensation audit 不应互相递归触发。

当前没有 job queue / outbox 时：

- 暂不实现完整 compensation audit。
- service 不应假装拥有 pending / running / retry / manual review 生命周期。
- 若只在 service 内同步尝试一次补偿，只能表达同步结果，不能表达 pending / running / retry / dead letter。
- 同步补偿如果需要写 audit，也必须先明确 audit 失败后的 fail closed / manual review 行为。

helper 规划：

- 后续可新增独立 compensation audit helper。
- helper 输入必须来自可信 server context：tenantId、connectionId、actor、operation、safe operation id、compensation state、failure category。
- helper 不得接收 provider raw error、request body、response body、真实凭证、provider path、`credentialRef`、idempotencyKey 或 scoped idempotency key。
- helper 应保证同一 operation / state transition 不重复写 audit。

operationId / 幂等 / retry / manual review：

- compensation audit 需要 operationId 或等价 safe operation key 来关联同一补偿链路。
- operationId 需要 metadata schema 或 compensation state 表承载，不允许塞进 `resourceId`。
- 幂等 key 必须绑定可信 `tenantId + connectionId + operation + safeOperationId`。
- 幂等 key 不得包含 provider path、`credentialRef`、idempotencyKey、synthetic placeholder 或 request body。
- retry count 可作为未来安全 metadata，但当前没有 metadata schema，不得塞入 reason 或 resourceId。
- manual review 状态需要可追踪 state 和权限边界，后续必须单独 Plan Mode。

## metadata / schema 边界

当前无 audit metadata schema，因此不得把以下内容塞进现有字段：

- compensation state。
- failure category。
- provider path。
- `credentialRef`。
- idempotencyKey。
- operationId。
- retry count。
- manual review state。
- request body。
- response body。
- provider raw error。

不得滥用字段：

- 不把 operationId 塞进 `resourceId`。
- 不把 compensation state 拼进 action。
- 不把 failure category 拼进 reason 之外的自由文本。
- 不把 provider internal path、secret path 或 digest 塞进 source。
- 不把 retry count、manual review flag 或 job id 写进 actor、resourceId 或 reason。

未来允许的安全 metadata 摘要可包括：

- operation。
- compensation state。
- failure category。
- retry count。
- provider type。
- provider mode。
- version digest 短摘要。
- occurredAt。
- manual review flag。

禁止 metadata 字段包括：

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
- `DATABASE_URL`。
- request body。
- response body。
- provider error full text。

如果后续需要 metadata schema，必须单独 Plan Mode，并同时评估 audit repository、query parser、DTO、权限和敏感字段测试。

## outbox / job queue 边界

本 PR 只规划 outbox / job queue，不实现。

是否需要 outbox / job queue：

- 如果 compensation audit 需要表达 pending、running、retry、dead letter 或 manual review，建议需要 outbox / job queue。
- 如果只做同步一次性 compensation，可能暂不需要 outbox，但无法完整表达补偿生命周期。
- 真实 provider、真实凭证和测试连接进入后，outbox / job queue 的必要性会显著提高。

operation id：

- compensation operation id 应用于关联 provider failure audit、compensation state 和后续 job execution。
- operation id 必须是安全随机值或不可逆摘要，不得包含 `credentialRef`、provider path、idempotencyKey 或 request body。
- operation id 需要 metadata schema 或 compensation state 表，不允许塞进 `resourceId`。

dead letter / manual review：

- 自动补偿超过 retry 上限后应进入 `compensation_failed` 或 `manual_review_required`。
- dead letter payload 只能保存安全摘要。
- manual review 只能展示 tenantId、connectionId、operation、failure category、state、retry count、时间戳和 provider 类型摘要。
- manual review 不得展示真实凭证、provider path、`credentialRef`、idempotencyKey、SQL、stack 或 provider error full text。

outbox payload 安全边界：

- 允许：tenantId、connectionId、operation、safe operation id、failure category、provider type、provider mode、version digest 短摘要、retry count、createdAt、lastAttemptAt。
- 禁止：真实凭证、token、secret、API key、connection string、OAuth token、private key、raw credential、raw HIS payload、provider internal path、external secret path、KMS key material、`credentialRef`、idempotencyKey、scoped key、synthetic placeholder、request body、response body、provider raw error、SQL、stack、`DATABASE_URL`。

job retry 边界：

- 只对 provider unavailable、timeout、429、5xx、临时网络失败等可重试场景重试。
- validation failed、tenant / connection mismatch、policy denial、不可恢复 provider 错误不得自动重试。
- retry 必须有限次、有限退避、有限总时长。
- retry count 只能作为安全 metadata / state，不能进现有 audit 字段。

job 幂等边界：

- 同一 safe operation id 多次执行必须幂等。
- job 成功 / 失败 audit 必须按 state transition 去重。
- 重复 job 不得重复创建 provider secret version，不得重复清理其他租户资源。

schema / migration：

- outbox / job queue 基本必然需要 schema / migration。
- 如果要保存 compensation operation、state、retry count、dead letter 或 manual review 状态，也需要 schema / migration。
- 本 PR 不新增 schema / migration；后续必须单独 Plan Mode。

## audit reason / result 边界

已存在 compensation reason：

- `compensation_pending`
- `compensation_running`
- `compensation_succeeded`
- `compensation_failed`
- `manual_review_required`

本 PR 要求：

- 不新增 reason。
- 不新增 action。
- 不新增 result。
- 不修改 audit query whitelist。
- 继续复用 `manage_credentials` action。
- 继续复用 `allowed` / `denied` / `transitioned` result。
- 不新增 `failure` result。
- 不把 compensation state 拼进 action / resourceId / source。

建议 result 口径：

- `compensation_pending` 使用 `denied`。
- `compensation_running` 使用 `denied`。
- `compensation_succeeded` 使用 `allowed`。
- `compensation_failed` 使用 `denied`。
- `manual_review_required` 使用 `denied`。

query 边界：

- 现有 reason 已进入 query whitelist，平台侧可按 reason 筛选。
- 当前没有 metadata query，不能按 operationId、failure category、retry count 或 manual review flag 查询。
- 后续如新增 metadata query，必须单独评估 query parser 白名单和敏感字段过滤。

## provider failure audit 关联边界

当前 provider failure audit 已由 service 层最小实现，compensation audit 需要规划关联方式。

当前无 metadata schema 时：

- 只能通过 `tenantId + resourceId(connectionId) + action(manage_credentials) + occurredAt 时间窗口 + reason` 做粗略排查。
- 这种关联只能用于人工排查，不是正式数据模型。
- 不保证一对一，也不适合自动化补偿状态机。

后续建议：

- 引入 safe operationId 或 compensation operation 表。
- operationId 应关联 provider failure audit、compensation state 和 job execution。
- operationId 需要 metadata schema 或 compensation 表承载。
- 不允许把 operationId 塞进 `resourceId`。
- 不允许把 `credentialRef`、provider path、secret path 或 idempotencyKey 作为关联 id。
- 不允许用 provider raw error 文本作为关联条件。

是否需要后续 metadata schema Plan Mode：

- 如果 compensation audit 只做粗粒度人工排查，可以暂不新增 metadata schema，但能力有限。
- 如果需要正式关联、自动重试、状态流转、manual review 或运营筛选，必须先做 metadata schema / outbox Plan Mode。

## fail closed / best effort 边界

当前 provider failure audit 已按安全敏感路径 fail closed。compensation audit 需要单独规划失败策略。

compensation audit 写入失败：

- 不得假装 compensation 已成功。
- 不得吞掉 audit repository 错误后展示安全完成。
- 不得把 audit repository 原始错误返回给用户或写入另一个 audit 字段。
- 如果 provider cleanup 成功但 compensation audit 失败，需要进入 `manual_review_required` 或 operator alert 的后续规划。
- 如果 compensation audit 自身失败，直接再次写 audit 可能递归失败，应考虑 outbox / alert / dead letter。

没有 outbox 前：

- 不建议 best effort 写 compensation audit。
- 如果补偿动作是安全关键路径，应 fail closed 或进入 manual review。
- 如果只是辅助观测 audit，必须明确不会被业务依赖，且不能用于表示补偿成功。

有 outbox 后：

- 可规划 eventual consistency。
- service 可以记录 pending / enqueue，后台 job 处理 running / succeeded / failed。
- audit 写入失败可进入 outbox retry 或 operator alert。
- eventual consistency 仍不得泄露 provider raw error、凭证材料或 raw HIS payload。

provider cleanup 成功但 compensation audit 失败：

- provider cleanup 成功不能因为 audit 失败而再次创建风险状态。
- 需要记录安全告警或 manual review。
- 如果无 outbox / alert 能力，必须在下一阶段明确是否 fail closed、阻断响应或人工补录。

operator alert：

- compensation audit 失败可能需要 operator alert。
- alert payload 只能包含安全摘要。
- alert 不得包含真实凭证、provider path、`credentialRef`、idempotencyKey、SQL、stack、provider raw error 或 `DATABASE_URL`。

本 PR 不实现上述逻辑。

## 测试拆分建议

后续实现前建议拆分测试：

- compensation pending audit tests。
- compensation running audit tests。
- compensation succeeded audit tests。
- compensation failed audit tests。
- manual review audit tests。
- compensation audit uses `manage_credentials` tests。
- compensation audit uses existing reason tests。
- compensation succeeded uses `allowed` result tests。
- other compensation states use `denied` result tests。
- no metadata schema regression tests。
- no schema migration regression tests。
- no provider path / `credentialRef` / idempotencyKey in audit tests。
- no request body / response body / provider raw error in audit tests。
- outbox required boundary tests。
- job retry count safe summary tests。
- job idempotency key safe boundary tests。
- no duplicate compensation audit tests。
- provider failure audit 与 compensation audit 关联边界 tests。
- audit failure fail closed / manual review tests。
- route does not write compensation audit tests。
- provider layer does not write compensation audit tests。
- unknown thrown error does not leak into compensation audit tests。

## 后续阶段边界

本 PR 不进入：

- compensation audit 实现。
- metadata schema。
- audit repository 改造。
- schema / migration。
- job queue / outbox。
- real provider。
- real credential parser / service。
- 测试连接。
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

1. compensation audit 最小实现前置评估：判断是否必须先做 metadata schema / outbox。
2. 如果不需要 metadata / outbox，做 compensation audit 最小实现，只写现有字段和既有 reason。
3. 如果需要 metadata / outbox，先做 metadata schema / outbox Plan Mode。
4. real credential one-time material parser / service Plan Mode。
5. 测试连接 Plan Mode。
6. 真实 HIS adapter Plan Mode。

真实凭证材料、测试连接或真实 HIS adapter 不得混入 compensation audit docs-only PR，也不得混入未来 compensation audit 最小实现 PR。
