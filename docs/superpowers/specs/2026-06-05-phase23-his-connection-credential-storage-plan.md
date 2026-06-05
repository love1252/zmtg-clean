# Phase 23 HIS 连接配置凭证 repository / storage 边界规划

> 日期：2026-06-05
> 状态：Phase 23 HIS 连接配置凭证 repository / storage 边界 Plan Mode 文档。本 PR 只规划凭证 repository / storage 边界，不写代码、不新增 API、不修改 `src/**`、不处理真实凭证、不做测试连接、不接真实 HIS、不引入真实 secret manager、不新增 schema / migration。

## 本次范围

本 PR 是 docs-only Plan Mode，只在 Phase 23 HIS 连接配置凭证管理总边界之后，细化未来凭证 repository / storage 的职责、数据最小化、一致性、版本轮换、删除 / 撤销、audit、DTO / read model 和测试拆分边界。

本 PR 明确不做：

- 不写代码。
- 不新增 API。
- 不修改现有 API。
- 不修改 `src/**`。
- 不修改 route、service、repository、parser、权限实现、audit domain、audit reason、audit query whitelist、audit repository、schema、migration 或测试。
- 不写凭证 repository 实现。
- 不写凭证 storage 实现。
- 不新增加密逻辑。
- 不接入外部 secret manager。
- 不保存、处理或演示真实凭证。
- 不保存 token、secret、API key、connection string 或外部密钥管理系统完整路径。
- 不做测试连接。
- 不接真实 HIS 或机构系统。
- 不保存 raw HIS payload。
- 不调用真实外部机构系统。
- 不创建治疗摘要。
- 不创建随访任务。
- 不自动触达客户。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做经营智能中心、图表或导出。

如果后续必须改代码、建表、加 API、接真实 secret manager、保存加密材料或调用外部系统，必须停止当前 docs-only 范围，并拆独立 Plan Mode 或实现 PR。

## 前置状态

当前已完成：

- HIS 连接配置凭证管理总边界 Plan Mode。
- 凭证对象、权限、service、repository / storage、audit、DTO、parser / validation 总体边界已规划。
- 状态 API 已闭环，但状态 API 只表达连接配置生命周期动作。

当前仍未完成：

- repository / storage 的细化实现边界仍未收敛。
- 凭证管理仍未实现。
- 凭证 repository / storage 仍未实现。
- 测试连接仍未开始。
- 真实 HIS adapter 仍未开始。

本 PR 承接凭证管理总边界，只把“连接配置侧保存什么”和“凭证明文进入什么 storage”进一步拆清楚，不改变运行时行为。

## repository 职责边界

未来 repository 建议只负责连接配置侧的安全引用和安全摘要写入，不接触凭证明文。

repository 可以规划保存：

- `credentialRef`：内部安全引用或短引用。
- `credentialConfigured` 的派生依据，或由 read model 从 `credentialRef` 与 credential status 派生。
- credential version summary，例如当前版本号、版本摘要或不可逆版本标识。
- credential status summary，例如 `configured`、`rotating`、`revoked`、`missing`、`storage_unavailable` 等候选安全状态；具体枚举后续单独评估。
- `configuredAt`、`rotatedAt`、`revokedAt` 等安全时间戳。
- storage provider 类型摘要，例如 `internal_encrypted_store`、`external_secret_manager`、`unconfigured`；只记录类型，不记录完整路径。
- 与连接配置绑定所需的安全外键或内部 ID。

repository 不应保存：

- 凭证明文。
- token。
- secret。
- API key。
- connection string。
- OAuth access token / refresh token。
- basic auth 用户名和密码组合。
- 签名密钥。
- 私钥。
- 外部 secret manager 完整路径、完整 secret id 或可直接定位明文的路径。
- raw HIS payload。
- 外部连接返回全文。
- SQL、stack 或 `DATABASE_URL`。

repository 必须明确不做：

- 不调用真实 HIS。
- 不做测试连接。
- 不解析凭证明文。
- 不返回明文凭证。
- 不返回外部密钥完整路径。
- 不记录 raw HIS payload。
- 不把 `credentialRef` 暴露给普通 read model。
- 不把 storage provider 的完整定位信息暴露给前端。

repository 是否把 `credentialConfigured` 持久化为列，还是由 `credentialRef + credentialStatus` 派生，后续实现前必须单独评估。默认推荐 read model 派生，以减少状态不同步风险。

## storage 职责边界

凭证明文必须进入专用 storage 层，不能散落在 service、repository、audit、日志或测试 fixture 中。

storage 可以后续评估两类方案：

- 数据库加密存储：例如专用凭证表加密保存，配合信封加密、密钥轮换、最小读取面和备份安全策略。
- 外部 secret manager：例如 KMS、Vault 或云厂商 secret manager，通过受控引用保存和读取凭证材料。

本 PR 不决定最终 storage 实现方案。

storage 后续设计必须规划：

- storage 抽象必须单独存在，不应直接散落在 service / repository 中。
- storage 写入需要幂等 key，避免重试时产生多个孤儿凭证版本。
- storage 写入成功但 DB 写入失败时，需要回滚、撤销、清理或补偿记录。
- DB 写入成功但 storage 写入失败时，应 fail closed，不得标记 `credentialConfigured=true`。
- storage 删除 / 撤销失败时，需要保留安全失败状态、audit 和后续补偿路径。
- storage 写入、读取、删除 / 撤销都必须禁止日志记录明文。
- storage 测试 fixture 必须使用假凭证占位符或合成值，不得出现真实凭证。
- storage 异常不得把外部错误全文、路径、token、secret、stack、SQL 或 `DATABASE_URL` 传到响应或 audit metadata。

本 PR 明确不做：

- 不接入真实 KMS / Vault / secret manager。
- 不新增真实加密逻辑。
- 不保存真实凭证。
- 不定义真实密钥层级、真实 secret path 或真实 provider 配置。
- 不验证任何外部凭证可用性。

## credentialRef 语义

`credentialRef` 是内部安全引用，用于把连接配置和专用凭证 storage 中的材料关联起来。

必须明确：

- `credentialRef` 不是明文。
- `credentialRef` 不是 token。
- `credentialRef` 不是 secret。
- `credentialRef` 不是 API key。
- `credentialRef` 不是 connection string。
- `credentialRef` 不是外部 secret manager 完整路径。
- `credentialRef` 不能包含厂商账号、机构号、门店号或外部系统敏感标识。
- `credentialRef` 不能可预测，不能用简单递增值、租户名、连接名或厂商名拼接生成。
- `credentialRef` 默认不直接暴露给 read model、普通 DTO、前端、audit metadata 或日志。

后续可以评估：

- `credentialRef` 是否短 ID 化，只保存不可逆短引用。
- `credentialRef` 是否绑定 `tenantId + connectionId`，避免跨租户或跨连接复用。
- `credentialRef` 是否绑定 credential version，避免轮换后旧引用被误用。
- `credentialRef` 是否需要独立 `rotated`、`revoked`、`retired` 状态。
- `credentialRef` 是否使用随机 ID、哈希摘要或 storage 返回的安全 handle；具体生成方式必须在实现前单独规划。

read model 默认不暴露 `credentialRef`。如后续为了内部排障需要显示摘要，只能显示不可逆安全摘要，不显示完整引用。

## credentialConfigured 语义

`credentialConfigured` 只表达当前连接是否存在受控凭证引用或可评估的安全凭证状态。

`credentialConfigured` 不代表：

- 不代表凭证有效。
- 不代表测试连接成功。
- 不代表真实 HIS adapter 可用。
- 不代表外部系统授权通过。
- 不代表健康检查通过。
- 不代表外部同步已启用。
- 不代表凭证没有过期。

派生建议：

- 默认由 `credentialRef + credentialStatus` 派生。
- 当 credential status 为 configured / active / rotating 时，可评估为 true；具体口径后续实现前确定。
- 当凭证删除 / 撤销成功后必须变为 false。
- 当连接被 revoked 或 deleted 后，必须阻断凭证用于测试连接和 adapter；`credentialConfigured` 是否立即 false 取决于凭证是否被撤销 / 删除，后续需要明确状态机。
- 轮换过程中是否需要 pending 状态，后续单独规划；本 PR 不实现 pending。

前端、DTO 和文档不得把 `credentialConfigured=true` 描述成“已连通”“已授权”“已同步”或“已接入真实 HIS”。

## 凭证版本与轮换边界

凭证管理后续应支持版本化，但本 PR 不实现。

版本规划：

- 建议每次创建生成初始 credential version。
- 每次轮换生成新 version。
- 当前可用版本与旧版本必须可区分。
- version summary 可以进入 repository 安全摘要，但不得包含明文或可定位明文的路径。
- version 标识应与 `tenantId + connectionId + credentialRef` 绑定。

旧版本处理：

- 旧 version 可进入 `pending_retirement`、`retired` 或 `revoked`。
- 旧凭证是否允许短期回滚，默认不规划实现，只标注后续高风险评估。
- 如允许回滚，必须单独规划权限、双人复核、audit、时限和安全状态。
- 轮换成功后旧凭证应在受控窗口后撤销或销毁。

轮换失败处理：

- storage 写入新凭证失败时，不应改动当前可用版本。
- 新 storage 写入成功但 DB 更新失败时，需要撤销新凭证或记录补偿。
- DB 标记新版本成功但 audit 失败时，建议 fail closed 或在同事务内回滚；外部 storage 场景需补偿。
- 轮换失败不能暴露新旧凭证明文。
- 轮换失败不能把新旧引用完整路径写入响应、日志或 audit metadata。

轮换 audit：

- 轮换成功应写 allowed audit。
- 轮换失败是否写 denied audit 需要后续实现前规划。
- audit metadata 只允许记录动作类型、安全 reason code、版本摘要、安全时间戳和是否存在补偿状态。
- 轮换过程不得返回或记录新旧明文。

## 删除 / 撤销边界

删除凭证、撤销凭证和撤销连接必须分清。

建议语义：

- 删除凭证：让连接不再具备受控凭证引用，但保留连接元数据和审计历史。
- 撤销凭证：让某个 credential version 或全部版本不可再用于测试连接和 adapter。
- 撤销连接：连接生命周期进入 revoked；必须阻断凭证继续用于测试连接和 adapter。
- 软删除连接：连接 read model 默认不可见；凭证是否撤销 / 清理必须有独立状态或补偿策略。

删除 / 撤销必须规划：

- 是否写 audit：默认成功和失败都应评估审计，且 metadata 最小化。
- 是否更新 `credentialConfigured`：删除 / 撤销成功后应为 false，或进入明确不可用状态。
- 是否清理 storage：默认需要清理或撤销 storage 中受控材料；物理销毁与合规保留后续评估。
- storage 清理失败是否需要补偿任务：只规划，不实现。
- 删除 / 撤销不得硬删审计历史。
- 删除凭证不得硬删连接元数据。
- 撤销连接不得依赖前端传入的租户信息。

删除 / 撤销不得返回：

- 明文凭证。
- 完整 `credentialRef`。
- 外部 secret manager 完整路径。
- 外部系统完整错误。
- SQL、stack 或 `DATABASE_URL`。

## 事务与一致性边界

凭证 repository / storage 会横跨数据库与可能的外部 storage，一致性必须先规划。

数据库内边界：

- repository 写入与 audit 写入建议同事务。
- audit 失败默认 fail closed，不返回业务成功。
- repository 写入失败不得留下 `credentialConfigured=true` 的假状态。
- repository 不应先暴露 read model 再等待 audit 异步补齐。

外部 storage 边界：

- 外部 secret manager 无法与数据库同事务时，必须规划幂等 key。
- storage 成功但 DB 失败时，必须撤销 storage 材料或记录补偿。
- DB 成功但 storage 失败时，不得标记凭证已配置；应返回稳定失败。
- audit 成功但 storage / DB 失败时，audit metadata 应表达失败安全 reason，不记录明文或外部路径。
- storage 删除 / 撤销失败时，需要补偿记录或后续修复任务；本 PR 不实现补偿任务。

状态规划：

- 是否需要 pending 状态：后续实现前评估。
- 是否需要 compensation 记录：后续实现前评估。
- 是否需要 storage operation id：后续实现前评估，但不得暴露给前端。
- 是否需要幂等 key：建议需要，尤其是 create / rotate / revoke。
- 不一致状态如何修复：只规划为后续运维或补偿流程，不在本 PR 实现。

错误映射建议：

- storage unavailable -> 稳定 `service_unavailable` 或后续凭证专用稳定 code。
- storage conflict / duplicate idempotency -> 稳定 `conflict`。
- repository validation failed -> 稳定 `validation_failed`。
- audit failure -> fail closed，稳定 `service_unavailable`。

## 安全与敏感信息边界

必须禁止：

- 明文凭证落库。
- token 落库。
- secret 落库。
- API key 落库。
- connection string 落库。
- OAuth access token / refresh token 落库到普通连接配置表。
- basic auth 用户名密码组合进入 read model。
- 签名密钥 / 私钥进入 read model。
- raw HIS payload 落库。
- SQL / stack / `DATABASE_URL` 进入 audit metadata。
- 外部密钥管理完整路径返回前端。
- 凭证明文进入日志。
- 凭证明文进入测试 fixture。
- 凭证明文进入 PR 描述或文档示例。

文档、PR 描述、测试 fixture、演示数据只能使用占位符或假值，例如 `<REDACTED>`、`***` 或合成字符串。不得复制真实机构凭证、真实 token、真实连接串或真实 secret path。

## audit 与 metadata 边界

后续 repository / storage 相关操作需要审计，但本 PR 不新增 audit reason、不新增 audit action、不修改 audit domain / query whitelist。

后续需评估的 audit 场景：

- repository / storage 成功写入是否写 allowed audit。
- storage 失败是否写 denied audit。
- rotate 成功是否写 allowed audit。
- rotate 失败是否写 denied audit。
- revoke / delete 成功是否写 allowed audit。
- revoke / delete 失败是否写 denied audit。
- compensation 创建、补偿成功或补偿失败是否需要 audit。

audit action / reason：

- 沿用 #154 的后续评估口径。
- 如新增 `open_connection:manage_credentials`，audit action 是否同步新增需单独评估。
- 如复用既有 `update` 或其他 action，必须说明如何避免与普通连接元数据 update 混淆。
- reason 是否新增凭证 storage 专用 reason，后续单独评估。
- 当前 PR 不新增 audit reason。
- 当前 PR 不新增 audit action。
- 当前 PR 不修改 audit domain / query whitelist。

audit metadata 可记录的安全摘要：

- `connectionId`。
- 凭证动作类型，例如 create / update / rotate / revoke / delete 的安全枚举。
- credential type 安全枚举。
- version summary。
- credential status summary。
- storage provider 类型摘要。
- 幂等 key 的不可逆摘要。
- compensation 状态摘要。
- 安全 reason code。
- 安全时间戳。

audit metadata 禁止记录：

- 明文凭证。
- token。
- secret。
- API key。
- OAuth access token / refresh token。
- basic auth 用户名密码组合。
- 签名密钥。
- 私钥。
- connection string。
- 完整 `credentialRef`。
- 外部 secret manager 完整路径。
- raw HIS payload。
- 外部系统响应全文。
- SQL。
- stack。
- `DATABASE_URL`。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- 图片 / 文件原文。

## DTO / read model 边界

read model 默认只暴露最小安全状态。

建议可暴露：

- `credentialConfigured`。
- 安全 credential status summary。
- `configuredAt`。
- `rotatedAt`。
- `revokedAt`。
- credential type 安全枚举。
- 是否存在轮换 pending 的安全状态；如需进入 v1，后续单独规划。

默认隐藏：

- `credentialRef`。
- storage provider 完整信息。
- external secret path。
- 内部存储位置。
- 外部系统完整错误。
- actor 字段。
- 明文凭证。
- token / secret / API key / connection string。
- raw HIS payload。

成功响应建议继续最小化：

- create / update / rotate / revoke / delete 成功优先返回 `{ ok: true }`。
- 如必须返回状态，只返回 `credentialConfigured` 和安全状态摘要。

错误响应建议：

- 只返回稳定 code / error。
- 不返回 storage provider 异常全文。
- 不返回外部密钥管理系统完整路径。
- 不返回 SQL、stack、`DATABASE_URL`。
- 不返回凭证输入原文。

## 测试拆分建议

本 PR 不写测试，只规划后续覆盖。

建议后续拆分：

- repository 不保存明文测试。
- repository 只保存安全引用测试。
- `credentialConfigured` 派生测试。
- `credentialRef` 不暴露测试。
- credential version / rotation 边界测试。
- revoke / delete 边界测试。
- storage failure 映射测试。
- transaction / compensation 边界测试。
- audit metadata 敏感信息禁区测试。
- DTO / read model 敏感字段回归测试。
- 日志泄露回归测试。

测试 fixture 必须使用合成占位符，不得出现真实凭证、真实连接串、真实 secret path 或真实机构系统返回。

## 后续阶段边界

本 PR 不进入：

- 凭证 repository 实现。
- 凭证 storage 实现。
- 凭证 parser / service / DTO 实现。
- 凭证 API route。
- 凭证 audit 实现。
- 测试连接。
- 连接健康检查。
- 真实 HIS adapter。
- webhook / 同步任务。
- 患者身份匹配。
- 人工复核 / 预览。
- 自动治疗摘要。
- 自动随访任务。
- 自动触达。
- 企微。
- AI / RAG / Agent。
- 经营智能中心。
- 图表 / 导出。

任何需要真实凭证、真实 secret manager、外部调用、真实 HIS adapter、raw payload 或业务副作用的工作，都必须单独进入后续 Plan Mode。

## 下一阶段建议

建议后续顺序：

1. 凭证 repository / storage 最小实现 Plan Mode 或实现 PR。
2. 凭证 parser / service / DTO Plan Mode。
3. 凭证 API route / audit / tests。
4. 测试连接 Plan Mode。
5. 真实 HIS adapter Plan Mode。

不要把测试连接或真实 HIS adapter 混入当前 PR。当前文档只规划“安全引用如何落到连接配置侧、明文如何进入专用 storage、失败如何补偿、read model 如何最小化”，不证明凭证可用或外部系统已接入。

## 收口结论

Phase 23 HIS 连接配置凭证 repository / storage 需要先确定 repository 只保存安全引用和摘要、storage 单独承载明文、`credentialRef` 不暴露、`credentialConfigured` 不等于连通、轮换 / 删除 / 撤销必须可审计且不泄露敏感信息。当前 PR 仅规划这些边界，不改变运行时行为。
