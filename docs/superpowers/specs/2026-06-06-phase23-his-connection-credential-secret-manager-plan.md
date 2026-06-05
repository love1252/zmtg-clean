# Phase 23 HIS 连接配置凭证加密与密钥管理边界规划

> 日期：2026-06-06
> 状态：Phase 23 HIS 连接配置凭证加密与真实 secret manager Plan Mode 文档。本 PR 只做 docs-only 规划，不写代码、不新增 API、不修改 `src/**`、不接真实 secret manager、不保存真实凭证、不做测试连接、不接真实 HIS、不新增 schema / migration。

## 本次范围

本 PR 只规划 Phase 23 HIS 连接配置凭证加密、真实 secret manager、provider 抽象、密钥轮换、审计和回滚边界，承接已完成的凭证 API route / permission / audit 最小实现。

本 PR 明确只做：

- docs-only Plan Mode。
- 规划 secret manager provider 抽象和 fake / real provider 边界。
- 规划真实 one-time credential material 的进入、短暂驻留和泄露禁区。
- 规划 `credentialRef` 的生产语义、版本摘要、digest 和对外禁止暴露边界。
- 规划数据库加密存储、外部 secret manager、envelope encryption、KMS key rotation、secret value rotation 和 provider key rotation 的取舍边界。
- 规划 rotate / clear / revoke 在真实 provider 下的生产一致性、补偿和回滚边界。
- 规划 audit、DTO / error mapping、测试拆分和后续阶段顺序。
- 同步 README、roadmap 和当天 devlog。

本 PR 明确不做：

- 不写代码。
- 不新增 API。
- 不修改现有 API 行为。
- 不修改 `src/**`。
- 不修改 route、service、repository、parser、DTO、权限实现、权限测试、audit domain、audit reason、audit query whitelist、audit repository、schema、migration、测试或 demo seed。
- 不接真实 KMS / Vault / cloud secret manager。
- 不实现 secret manager provider 抽象。
- 不改造现有 fake in-memory storage。
- 不保存、处理或演示任何真实凭证。
- 不保存 token、secret、API key、connection string、OAuth token、basic auth、private key、signing key 或 raw credential。
- 不做测试连接。
- 不接真实 HIS 或机构系统。
- 不保存 raw HIS payload。
- 不创建治疗摘要。
- 不创建随访任务。
- 不自动触达客户。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做经营智能中心、图表或导出。

如果后续实现必须新增 provider interface、真实 provider、schema / migration、真实凭证 parser、service 改造、测试连接或真实 HIS adapter，必须进入独立 Plan Mode 或独立实现 PR，不能混入当前 docs-only PR。

## 前置状态

当前已完成：

- HIS 连接配置凭证管理总边界 Plan Mode。
- HIS 连接配置凭证 repository / storage 边界 Plan Mode。
- HIS 连接配置凭证 repository / storage 最小实现。
- fake in-memory storage 测试抽象。
- repository 安全 `credentialRef` set / rotate / clear / revoke 最小方法。
- `credentialConfigured` 从安全 read model / summary 派生。
- HIS 连接配置凭证 parser / service / DTO Plan Mode。
- HIS 连接配置凭证 parser / service / DTO 最小实现。
- parser 只接受合成 `synthetic_placeholder_*`，拒绝真实凭证材料。
- service 只接收服务端可信 `accessContext`、path `connectionId`、database、repository、storage 和 parsed input。
- DTO 不返回 `credentialRef`、idempotencyKey、scoped key、storage provider 内部信息或敏感字段。
- HIS 连接配置凭证 API route / permission / audit Plan Mode。
- HIS 连接配置凭证 API route / permission / audit 最小实现。
- create / update / rotate / clear / revoke 五个凭证 API route。
- `open_connection:manage_credentials` 最小权限动作。
- route denied audit。
- service allowed audit。
- 稳定 DTO / error mapping。

当前仍未完成：

- 真实 secret manager。
- 加密存储。
- KMS / Vault / cloud secret manager / database encrypted storage provider 抽象。
- 真实凭证 one-time material 接收。
- 凭证轮换生产策略。
- 凭证撤销生产策略。
- provider failure 补偿策略。
- 连接健康检查。
- 测试连接。
- 真实 HIS adapter。

当前凭证 API 最小实现只说明“HTTP route 已能把合成 placeholder 编排到安全 `credentialRef` 最小闭环”，不代表系统可以接收真实凭证明文，不代表已接入真实 secret manager，不代表已能测试连接，也不代表真实 HIS adapter 可以读取凭证发起外部调用。

## secret manager provider 边界

后续实现前必须先定义 provider 抽象，但本 PR 不实现。

建议 provider 抽象表达的能力：

- store：接收服务端可信租户、连接、一次性凭证材料和幂等键，返回内部安全 handle 或安全结果。
- rotate：为既有连接创建新 secret version，返回新版本安全摘要。
- revoke：禁用或撤销当前 secret version。
- clear：解除连接与 secret 的可用关系，必要时触发删除、禁用或补偿。
- describe：只返回安全摘要，例如 provider 类型、版本摘要、状态、digest 和安全时间戳；不返回 secret value。
- health：只用于内部 provider 可用性评估，不等同于 HIS 测试连接。

fake provider 与 real provider 边界：

- fake provider 只能用于测试和本地最小闭环。
- fake provider 不得被描述为真实加密能力。
- fake provider 不得保存真实凭证 fixture。
- fake provider 可使用合成占位符、不可逆 digest 和 deterministic failure hook 来覆盖测试。
- real provider 必须有明确配置来源、超时、重试、熔断、错误脱敏和审计边界。
- real provider 不得从前端传入，不得由 body / query / header 控制，不得由 localStorage、外部 HIS payload 或厂商返回内容控制。

候选方案只规划，不实现：

- 外部 Vault：适合集中 secret 生命周期、版本、撤销和审计，但需要部署、权限、网络、可用性和灾备规划。
- 云厂商 secret manager：适合托管版本、KMS 集成和审计，但需要供应商绑定、区域、成本和权限边界。
- KMS + database encrypted storage：适合数据留在本系统数据库内，但需要 envelope encryption、key rotation、备份安全和最小读取面。
- 独立 KMS envelope encryption：适合把 data key 与 secret value 分离，但需要 key hierarchy、tenant isolation 和恢复流程。

provider 初始化与配置来源：

- provider 类型只能来自服务端环境配置或受控后台配置。
- provider 配置不得来自 request body、query、header、cookie、localStorage 或外部 HIS payload。
- provider 初始化失败必须 fail closed，不得降级为明文存储。
- provider 配置不得写入前端 bundle、DTO、audit metadata 或错误响应。
- provider 错误只映射稳定 code / reason，不回显 provider path、access policy、token、endpoint、stack 或外部错误全文。

provider 运行时边界：

- 必须设置 timeout，避免凭证 route 无限等待。
- retry 只能针对明确可重试错误，必须有次数和退避上限。
- circuit breaker 只能影响 provider 调用，不得让系统改为保存明文。
- provider 操作必须幂等，避免 retry 产生孤儿 secret version。
- provider 绝不记录真实 secret value、raw credential、external secret path、KMS key material 或 provider internal path。

## 凭证材料输入边界

后续是否允许真实 one-time credential material 进入 parser，必须单独实现前评审。本 PR 只规划默认边界。

如果后续允许真实材料进入：

- 真实材料只能通过已认证、已授权的凭证 route 进入。
- 权限检查必须发生在读取和解析 body 之前。
- parser 只能在权限通过后处理真实材料。
- 真实材料只能短暂存在于 route / parser / service 调用栈内存中。
- 真实材料必须立即交给 provider store / rotate，不得进入 repository command。
- 真实材料不得进入 DTO。
- 真实材料不得进入 audit metadata。
- 真实材料不得进入 logs。
- 真实材料不得进入 tests fixture。
- 真实材料不得进入 docs sample。
- 真实材料不得进入 read model。
- 真实材料不得进入 route denied audit。
- 真实材料不得进入错误响应。
- 真实材料不得进入 devlog、PR 描述或截图。

parser 边界：

- parser 失败不得回显输入。
- malformed body 不得记录原文。
- body 不是普通 JSON object 时返回稳定 `validation_failed`。
- 未知字段、body `tenantId`、`credentialRef`、`credentialConfigured`、status、healthStatus、raw HIS payload、external secret path 和 provider internal path 继续拒绝。
- 真实材料字段必须有字段名白名单、字段数量上限、总长度上限和类型限制。
- basic auth、OAuth、API key、signature key、mtls、sftp 等类型不得共享同一任意 object 透传模型。
- OAuth access token / refresh token、basic auth 用户名密码组合、private key、signing key 等必须在 parser 内被视为敏感材料，不能出现在任何错误上下文中。

service / repository 边界：

- service 可以接收短生命周期的 `credentialMaterial` value object，但不得把它传给 repository。
- repository command 只能接收 `tenantId`、`connectionId`、actor、安全 `credentialRef` 或版本摘要。
- provider 返回前不得先写 repository `credentialConfigured=true`。
- provider 写入失败时 service 必须 fail closed。

## credentialRef 生产语义

`credentialRef` 是内部安全引用，只用于连接配置侧关联 provider 中受控凭证材料。

必须明确：

- `credentialRef` 不等于 secret path。
- `credentialRef` 不等于 KMS key id。
- `credentialRef` 不等于 provider internal path。
- `credentialRef` 不等于真实 provider path。
- `credentialRef` 不等于 token、secret、API key、connection string 或 raw credential。
- `credentialRef` 必须不可预测。
- `credentialRef` 必须与 `tenantId + connectionId` 绑定。
- `credentialRef` 不得包含租户名、连接名、厂商账号、机构号、门店号或外部系统敏感标识。
- `credentialRef` 默认不得暴露给 route / DTO / read model / 前端 / audit metadata / 日志。

后续需要评估：

- 是否引入 provider namespace，例如 `providerType + tenant scoped handle` 的内部结构，但只在服务端使用。
- 是否引入 version summary，例如 `currentVersionDigest`、`previousVersionDigest`、`rotationState`。
- 是否引入不可逆 digest，用于排障和审计安全摘要。
- 是否需要保存 provider 类型摘要，例如 `external_secret_manager` 或 `database_encrypted_store`，但不得保存完整路径。
- 是否允许 service 层短暂持有 `credentialRef`。默认允许 service 内部持有，但不返回给 route DTO。
- 是否允许 route helper 看到 `credentialRef`。默认禁止；route 只看到 service result / DTO。
- 是否允许 read model 暴露 `credentialConfigured`。默认允许继续暴露布尔安全摘要，但禁止暴露 `credentialRef`。

如果未来必须为内部排障显示摘要，只能显示不可逆 digest 的短摘要，不显示完整引用、provider path、secret id 或 KMS key id。

## 加密与存储边界

后续可以评估两类主方案，但本 PR 不决定实现。

数据库加密存储方案：

- 可使用专用凭证表保存 encrypted secret blob、encrypted data key、credential version、provider type summary 和状态摘要。
- 必须使用 envelope encryption 或等价机制，不得用应用固定明文 key 直接加密。
- KMS data key、master key 和 encrypted value 必须分层。
- 数据库备份不得具备单独解密能力。
- 读取 secret value 的代码路径必须最小化，只允许 future adapter / test connection 的专用服务通过受控接口读取。
- 如果必须新增 schema / migration，必须后续单独 Plan Mode，本 PR 不新增。

外部 secret manager 方案：

- 连接配置数据库只保存内部 `credentialRef`、provider 类型摘要、版本摘要和安全时间戳。
- 外部 provider 持有真实 secret value 和版本。
- provider path、secret id、KMS key id 不能进入 DTO、read model、audit metadata 或错误响应。
- 外部 provider 权限必须按租户、环境和操作最小化。
- provider 不可用时凭证写入、轮换、撤销必须 fail closed 或进入受控补偿，不得改为明文落库。

envelope encryption 与 key rotation：

- KMS key rotation：轮换 master key 或 key encryption key 时，不应要求前端重传真实凭证。
- secret value rotation：业务凭证轮换，应创建新 secret version，并保留旧版本受控撤销窗口。
- provider key rotation：provider 访问凭据自身轮换必须单独规划，不得影响业务 secret 泄露边界。
- tenant isolation：不同 tenant 的 secret namespace、policy 或 encryption context 必须隔离。
- connection isolation：不同 connection 的 secret version 和 idempotency key 必须隔离。
- backup / restore：恢复数据库后不能让已撤销 secret 重新可用；恢复 provider 后不能让数据库引用孤儿状态静默成功。
- disaster recovery：必须规划 provider 与数据库状态不一致时的只读检测、补偿队列和人工修复口径。

secret 生命周期：

- clear 后默认解除连接可用引用，是否物理删除 secret 需后续按合规保留评估。
- revoke 后默认禁用 secret version 或全部版本，不允许继续用于测试连接或 adapter。
- soft delete / revoke connection 后必须阻断 secret 用于外部调用。
- provider delete / revoke 失败时必须保留不可用状态或补偿状态，不能继续展示为安全可用。

不新增 schema / migration 的条件：

- 仅规划 provider 抽象和接口口径。
- 仅复用现有 `credentialRef` 安全引用。
- 不需要保存 provider 状态摘要、版本摘要、补偿状态或 encrypted blob。

如果实现需要保存 provider namespace、version summary、digest、rotation state、compensation state 或 encrypted blob，必须单独 Plan Mode 评估 schema / migration。

## rotate / clear / revoke 生产边界

rotate 生产边界：

- rotate 应创建新 secret version，不应覆盖旧版本明文。
- rotate 失败时旧版本必须保留并继续作为当前可用版本，除非旧版本已被明确撤销。
- provider store 新版本成功后，repository 才能切换当前 `credentialRef` 或 version summary。
- rotate 成功后旧版本应进入 pending retirement、retired 或 revoked 状态。
- 旧版本撤销窗口、回滚窗口、人工复核和双人审批需后续单独评估。
- rotate 不得返回新旧 secret value、新旧 provider path 或完整 `credentialRef`。

clear 生产边界：

- clear 表达解除连接凭证配置，不等同于删除连接元数据。
- clear 可选择只解除 repository 引用，或同步 provider disable / delete；具体策略必须后续评估。
- clear 成功后 `credentialConfigured` 应为 false 或进入明确不可用摘要。
- clear 失败不得让 read model 展示配置成功。

revoke 生产边界：

- revoke 表达禁用 secret，不允许后续测试连接或 adapter 继续使用。
- revoke 可以作用于当前版本或全部版本；v1 默认建议全部可用版本不可用。
- revoke 失败应进入补偿或安全失败状态，不得静默成功。
- revoke 不得硬删审计历史。

跨系统一致性：

- provider delete / revoke 失败时，需要补偿记录或人工修复队列；本 PR 不实现补偿任务。
- repository 成功但 provider 失败：不得标记 `credentialConfigured=true`；如已写入必须回滚或写补偿状态。
- provider 成功但 repository 失败：必须撤销新 secret 或记录补偿，避免孤儿 secret。
- audit 成功 / 失败必须和 repository / provider 一致性一起规划。
- audit 失败是否 fail closed：默认延续当前敏感操作 fail closed 倾向，后续实现前需按外部 provider 不可事务化场景细化。
- 不在本 PR 实现补偿任务、重放任务、人工修复台或 provider cleanup job。

## audit 边界

后续真实 secret manager 场景必须覆盖 allowed audit、provider failure audit 和 compensation audit，但本 PR 不新增 action / reason。

建议审计覆盖：

- create credential 与 secret manager store 成功后的 allowed audit。
- update credential 与 secret manager store 成功后的 allowed audit。
- rotate credential 与 new secret version 成功后的 allowed audit。
- clear credential 与引用解除 / provider disable 的 allowed audit。
- revoke credential 与 provider revoke 的 allowed audit。
- provider failure audit。
- compensation scheduled / compensation succeeded / compensation failed audit。
- provider timeout / retry exhausted / circuit open 的安全 reason。
- audit metadata 只能记录安全摘要。

audit metadata 可记录：

- actor id / role / scope / source。
- tenantId 来自 access context。
- resource 固定 `open_connection`。
- resourceId 使用 path `connectionId`。
- action 使用已接入的 `manage_credentials` 或后续评审后的动作。
- result 使用 allowed / denied。
- reason 使用既有或后续评审后的稳定 reason。
- provider 类型摘要。
- credential type 枚举。
- secret version digest 短摘要。
- rotation state。
- compensation state。
- 安全时间戳。

audit metadata 禁止记录：

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

audit failure 边界：

- 权限拒绝和 parser failure 的 route denied audit 继续保持 fail closed 倾向。
- provider 成功后 audit 失败，若数据库事务尚未提交，应优先回滚。
- provider 已成功但 audit / repository 无法回滚时，必须记录补偿或撤销 provider secret。
- audit 失败不得把 provider 错误、secret path、SQL、stack 或输入原文写入响应。
- audit 与 repository / provider 的一致性在实现前必须单独设计测试，不得凭口头约定上线。

是否新增 reason / action：

- 本 PR 不实现新增 reason。
- 本 PR 不实现新增 action。
- 当前 `manage_credentials` 已可表达凭证管理动作。
- provider failure、compensation、timeout、circuit breaker 是否需要新 reason，必须后续单独评审 audit domain、query parser、repository / DTO 测试和审计查询文档。

## DTO / error mapping 边界

成功响应继续最小化：

```json
{ "ok": true, "credentialConfigured": true }
```

clear / revoke 成功继续可返回：

```json
{ "ok": true, "credentialConfigured": false }
```

成功响应不得返回：

- provider。
- provider path。
- provider internal path。
- KMS key id。
- `credentialRef`。
- idempotencyKey。
- scoped idempotency key。
- secret metadata 明细。
- version full id。
- digest full value。
- token、secret、API key、connection string。
- raw credential。
- raw HIS payload。

错误响应边界：

- 只返回稳定 code / error。
- provider 错误脱敏。
- storage 错误脱敏。
- 不回显输入。
- 不返回外部系统错误全文。
- 不返回 secret manager path。
- 不返回 provider endpoint。
- 不返回 SQL / stack / `DATABASE_URL`。
- 不返回 KMS access policy、key material、namespace 或 internal path。

候选错误码只规划，不实现：

- `validation_failed`：parser failure、malformed body、禁止字段。
- `not_found`：连接不存在或不属于当前租户。
- `invalid_state_transition`：连接或凭证状态不允许操作。
- `service_unavailable`：provider unavailable、timeout、audit failure 或 database unavailable 的脱敏结果。
- `conflict`：幂等冲突、轮换冲突或补偿冲突；是否使用需后续评估。

## 测试拆分建议

本 PR 不写测试，只规划后续测试拆分。

建议后续覆盖：

- provider 抽象接口测试。
- fake provider 测试。
- real provider adapter contract 测试。
- provider failure mapping 测试。
- provider timeout / retry / circuit breaker 测试。
- KMS / secret manager unavailable 测试。
- secret material 不泄露测试。
- parser 不回显输入测试。
- malformed body 不记录原文测试。
- service 不返回 `credentialRef` 测试。
- DTO 不返回 provider / path / secret metadata 测试。
- audit metadata 敏感信息禁区测试。
- create / update store success 测试。
- rotate success / failure 测试。
- clear / revoke success / failure 测试。
- provider success + repository failure compensation 测试。
- repository success + provider failure compensation 测试。
- provider success + audit failure compensation 测试。
- idempotency key 绑定 `tenantId + connectionId` 测试。
- tenant isolation / connection isolation 测试。
- 不调用真实 provider 测试。
- 不调用真实 HIS 测试。
- 不做测试连接测试。

测试 fixture 必须使用合成占位符，不得出现真实 token、secret、API key、connection string、OAuth token、basic auth、private key、signing key、provider path 或 raw HIS payload。

## 后续阶段边界

本 PR 不进入：

- secret manager 实现。
- provider interface 实现。
- KMS / Vault / cloud provider 接入。
- database encrypted storage 实现。
- schema / migration。
- API route 改造。
- parser 改造为真实凭证材料。
- service 改造为真实 provider。
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

如后续进入任何一项，必须单独 Plan Mode，重新确认权限、审计、数据最小化、测试和回滚边界。

## 下一阶段建议

建议后续顺序：

1. secret manager provider 抽象接口 Plan Mode 或最小实现。
2. real credential one-time material parser / service Plan Mode。
3. provider failure / compensation / audit tests。
4. 测试连接 Plan Mode。
5. 真实 HIS adapter Plan Mode。

测试连接和真实 HIS adapter 不应混入 secret manager provider 抽象实现。真实 provider 接入前，也不应让 HTTP route 接收真实凭证明文。
