# Phase 23 HIS 连接配置凭证 parser / service / DTO 边界规划

> 日期：2026-06-05
> 状态：Phase 23 HIS 连接配置凭证 parser / service / DTO Plan Mode 文档。本 PR 只做 docs-only 规划，不写代码、不新增 API、不修改 `src/**`、不处理真实凭证、不做测试连接、不接真实 HIS、不接真实 secret manager、不新增 schema / migration。

## 本次范围

本 PR 只规划 HIS 连接配置凭证 parser / service / DTO 的后续实现边界，用于承接已完成的凭证 repository / storage 最小边界。

本 PR 明确只做：

- docs-only Plan Mode。
- 规划 create / update / rotate / clear / revoke credential payload 的 parser 边界。
- 规划 parser 校验、service 编排、DTO 最小响应、audit 衔接和测试拆分。
- 规划 fake in-memory storage 与现有 repository 最小方法的协作方式。
- 规划后续实现时的敏感信息禁区和失败脱敏边界。

本 PR 明确不做：

- 不写代码。
- 不新增 API。
- 不修改现有 API。
- 不修改 `src/**`。
- 不修改 route、service、repository、parser、权限实现、audit domain、audit reason、audit query whitelist、audit repository、schema、migration 或测试。
- 不实现 parser / service / DTO helper。
- 不保存、处理或演示真实凭证。
- 不保存 token、secret、API key、connection string 或外部 secret path。
- 不做测试连接。
- 不接真实 HIS 或机构系统。
- 不接真实 KMS / Vault / secret manager。
- 不保存 raw HIS payload。
- 不创建治疗摘要。
- 不创建随访任务。
- 不自动触达客户。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做经营智能中心、图表或导出。

如果后续实现需要新增 API route、权限动作、audit action / reason / domain、schema / migration、真实 secret manager、测试连接或真实 HIS adapter，必须进入单独 Plan Mode 或独立实现 PR，不能混入当前 docs-only PR。

## 前置状态

当前已完成：

- HIS 连接配置凭证管理总边界 Plan Mode。
- HIS 连接配置凭证 repository / storage 边界 Plan Mode。
- HIS 连接配置凭证 repository / storage 最小边界实现。
- fake in-memory storage 测试抽象。
- repository 层安全 `credentialRef` set / rotate / clear / revoke 最小方法。
- `credentialConfigured` 安全派生。
- read model / summary 不暴露 `credentialRef`。
- fake storage 的 idempotency key 已绑定 `tenantId + connectionId + idempotencyKey`，避免跨租户 / 跨连接复用安全引用。
- repository 已拒绝 `sk_live`、`sk_test`、raw credential、token、secret、API key、connection string 和 raw payload 形态的伪装 ref。

当前仍未完成：

- 凭证 parser / validation。
- 凭证 service orchestration。
- 凭证 DTO helper。
- 凭证 API route。
- 凭证权限实现。
- 凭证 audit action / reason / domain。
- 测试连接。
- 真实 HIS adapter。
- 真实 secret manager。

当前 repository / storage 最小实现只说明“连接配置侧可保存安全引用”和“测试用 fake storage 可生成安全 ref”，不代表可以接收 HTTP 凭证明文、不代表已能测试连接、不代表已能调用真实 HIS。

## parser 边界

后续 parser 只负责把 HTTP body 或 route 层传入的普通 JSON object 解析为受控命令输入。parser 不做权限判断，不读取租户来源，不调用 repository，不调用 storage，不调用真实 HIS，也不记录输入明文。

建议后续拆分为五类 parser：

- create credential payload parser。
- update credential payload parser。
- rotate credential payload parser。
- clear credential payload parser。
- revoke credential payload parser。

create credential payload 建议只允许：

- `credentialType`：稳定枚举值。
- `idempotencyKey`：用于 storage 重试幂等的安全短字符串。
- `credentialMaterial` 或 `syntheticPlaceholder`：一次性输入材料；v1 如仍使用 fake storage，只允许 `synthetic_placeholder_*` 合成占位值。
- `reasonCode`：可选安全短字符串。

update credential payload 建议只允许：

- `credentialType`：稳定枚举值。
- `idempotencyKey`：安全短字符串。
- `credentialMaterial` 或 `syntheticPlaceholder`：用于替换或补充当前凭证的一次性材料。
- `reasonCode`：可选安全短字符串。

rotate credential payload 建议只允许：

- `credentialType`：稳定枚举值。
- `idempotencyKey`：安全短字符串。
- `credentialMaterial` 或 `syntheticPlaceholder`：新版本一次性材料。
- `reasonCode`：可选安全短字符串。

clear credential payload 建议只允许：

- `reasonCode`：可选安全短字符串。

revoke credential payload 建议只允许：

- `reasonCode`：可选安全短字符串。

字段白名单边界：

- 顶层只接受普通 JSON object。
- 顶层未知字段必须拒绝。
- 嵌套凭证材料如进入 v1，也必须有字段白名单、字段数量上限、字段名限制和总长度限制。
- body `tenantId` 禁止参与租户判断，出现时应拒绝。
- `credentialRef` 禁止由前端传入。
- `credentialConfigured` 禁止由前端传入。
- `status` 禁止由前端传入。
- `healthStatus` 禁止由前端传入。
- raw HIS payload 禁止进入 payload。
- external secret path 禁止进入 payload。
- storage provider 内部字段禁止进入 payload。
- actor、role、permission、audit action、audit reason 禁止由前端传入。

parser 必须明确：

- 不做权限判断。
- 不读取 request header。
- 不读取 query。
- 不读取 localStorage。
- 不调用 repository。
- 不调用 storage。
- 不调用真实 HIS。
- 不做测试连接。
- 不记录明文。
- 不把输入原文写入错误对象。
- 失败只返回稳定 code / error。
- 失败不得回显输入原文。
- 失败不得回显 token、secret、API key、connection string、raw credential、raw HIS payload、external secret path、SQL、stack 或 `DATABASE_URL`。

## 校验边界

credentialType 枚举建议后续单独收敛，候选值只能表达凭证类型，不表达真实厂商授权成功：

- `api_key`
- `oauth_client`
- `oauth_token`
- `basic_auth`
- `signature_key`
- `mtls`
- `sftp`
- `other`

idempotencyKey 建议：

- 必填于 create / update / rotate。
- trim 后非空。
- 长度建议不超过 128。
- 只允许字母、数字、下划线、短横线和点号等安全字符。
- 不允许包含 placeholder 明文。
- 不允许包含 token、secret、API key、connection string、raw credential、raw payload 或 external secret path。
- parser 不生成 scoped idempotency key；scoped key 只能由 service / storage 内部根据可信 `tenantId + connectionId + idempotencyKey` 形成。

reasonCode 建议：

- clear / revoke 建议允许可选 reasonCode。
- create / update / rotate 可按 audit 需要允许可选 reasonCode。
- trim 后非空。
- 长度建议不超过 96 或 160，最终与现有 repository 限制对齐。
- 只允许安全短码，不允许自由文本正文。
- 不允许包含凭证明文、SQL、stack、`DATABASE_URL`、raw payload 或医疗正文。

placeholder / future credential material 总长度限制：

- v1 fake storage 只允许 `synthetic_placeholder_*` 合成占位输入。
- 合成 placeholder 长度建议不超过 128。
- future credential material 如进入后续真实 storage，必须有总长度上限、字段数量上限和字段级长度上限。
- future credential material 只能作为一次性输入进入 service / storage，不得进入 repository command、DTO、audit metadata、日志或测试 fixture。

对 token / secret / API key / connection string 的处理原则：

- parser 可以识别真实敏感形态并返回 `validation_failed`，但不能回显输入原文。
- 当前阶段不接真实 secret manager，因此后续最小实现如仍是 fake storage，应继续拒绝真实 token / secret / API key / connection string。
- 如果未来要接受真实 one-time credential material，必须单独规划 storage 加密、日志禁区、测试 fixture 和安全审计，不能只改 parser 放行。

空凭证处理：

- create / update / rotate 不允许空凭证。
- 普通 update 不允许用空值表达清空。
- clear 必须走清空语义。
- revoke 必须走撤销语义。

update 与 rotate 差异：

- update 表达替换或补充当前凭证材料，不应暗含版本轮换窗口。
- rotate 表达生成新安全引用或新版本，并要求 idempotency、旧版本处理和补偿边界。
- rotate 不接受旧 `credentialRef` 或旧凭证明文由前端传入。

clear 与 revoke 差异：

- clear 表达清空当前连接的凭证引用，让 `credentialConfigured=false`。
- revoke 表达撤销当前凭证引用或凭证版本，使其不可再用于测试连接或 adapter。
- 两者都不得删除连接元数据或审计历史。
- 两者都不得返回 `credentialRef`。

parser 失败错误码建议：

- `validation_failed`：结构、字段、类型、长度、未知字段、禁止字段或敏感形态失败。
- `unsupported_credential_type`：如后续需要把枚举不支持与普通 validation 分开，必须先评估 HTTP 映射和 audit reason。

parser 失败是否进入 route denied audit：

- 本 PR 只规划，不实现。
- 后续 route PR 应单独决定 parser 失败是否写 denied audit。
- 如写 denied audit，metadata 只能记录稳定 reason code、连接 ID、动作类型和安全字段，不得记录 payload 原文。

## service 边界

后续 service 负责可信输入编排，不负责 HTTP 读取，不负责角色权限判断，不负责真实 HIS 调用。

service 只接收：

- 服务端可信 accessContext。
- path 或 route 层可信 `connectionId`。
- database 或 transaction entry。
- storage dependency。
- repository dependency。
- audit dependency。
- parser 输出的 parsed input。

service 不读取：

- request。
- header。
- query。
- localStorage。
- 完整 body。
- body tenantId。
- 外部 HIS payload。

service 租户边界：

- 只使用 accessContext 中可信 `tenantId`。
- 不接受 body `tenantId` 参与租户判断。
- 不接受厂商机构号、门店号、外部账号或 HIS 返回值参与租户判断。

service 权限边界：

- v1 建议权限判断由 route / access layer 负责。
- service 不判断角色权限，避免与 route/access layer 产生重复权限逻辑。
- service 可防御性校验 accessContext 是否包含可信 tenantId 与 actorUserId；缺失时返回稳定 failure result。
- 如后续需要 service 内防御性权限校验，必须说明它只做兜底，并与 route/access layer、权限测试和 denied audit 边界保持一致。

service 输出边界：

- 不返回明文凭证。
- 不返回 `credentialRef`。
- 不返回 scoped idempotency key。
- 不返回 storage provider 内部定位信息。
- 不返回 SQL、stack、`DATABASE_URL`。
- 不返回 raw HIS payload。
- service result 最小化，成功优先返回 `{ ok: true }` 或最小安全状态。
- service error mapping 稳定化，例如 `validation_failed`、`not_found`、`conflict`、`invalid_state_transition`、`service_unavailable`。

service 明确不做：

- 不调用真实 HIS。
- 不做测试连接。
- 不创建治疗摘要。
- 不创建随访任务。
- 不自动触达客户。
- 不接企微。
- 不接 AI / RAG / Agent。

## service flow 边界

### create credential service flow

- 输入来源：accessContext.tenantId、accessContext.userId、path `connectionId`、parser 输出的 credentialType、idempotencyKey、一次性材料和可选 reasonCode。
- parser 结果：只包含安全枚举、短字符串和一次性材料；不包含 body tenantId、credentialRef、credentialConfigured、status、healthStatus 或 raw payload。
- storage 调用：调用 fake storage 的 store 方法时传入可信 tenantId、connectionId、合成 placeholder 和 idempotencyKey；真实 storage 后续单独规划。
- repository 调用：storage 返回安全 `credentialRef` 后，调用现有 set credential reference 方法。
- audit 调用：allowed audit 和 failure audit 是否进入后续 PR；本 PR只规划不实现。
- 成功 DTO：优先 `{ ok: true, credentialConfigured: true }` 或 `{ ok: true }`。
- 失败 DTO：只返回稳定 code / error。
- 失败回滚 / 补偿边界：storage 成功但 repository 失败时，应规划撤销 storage ref 或补偿记录；本 PR 不实现补偿逻辑。
- 不进入测试连接。
- 不进入真实 HIS。

### update credential service flow

- 输入来源：accessContext、path `connectionId`、parser 输出的 credentialType、idempotencyKey、一次性材料和可选 reasonCode。
- parser 结果：不允许空凭证表达清空，不允许前端传 credentialRef。
- storage 调用：写入新受控材料或合成 placeholder，得到安全 `credentialRef`。
- repository 调用：调用现有 set credential reference 方法，更新当前安全引用。
- audit 调用：建议后续记录 update credential allowed audit；失败路径是否 denied audit 单独规划。
- 成功 DTO：优先 `{ ok: true, credentialConfigured: true }` 或 `{ ok: true }`。
- 失败 DTO：稳定 code / error，不返回输入原文或 storage 细节。
- 失败回滚 / 补偿边界：storage 成功但 repository 失败时应撤销新 ref 或记录补偿；repository 成功但 audit 失败时建议 fail closed 或事务回滚，外部 storage 场景需补偿。
- 不进入测试连接。
- 不进入真实 HIS。

### rotate credential service flow

- 输入来源：accessContext、path `connectionId`、parser 输出的新 credentialType、idempotencyKey、新一次性材料和可选 reasonCode。
- parser 结果：只表达新材料，不接受旧凭证明文、旧 `credentialRef` 或外部 secret path。
- storage 调用：写入新安全引用，idempotencyKey 必须绑定 tenantId + connectionId。
- repository 调用：调用现有 rotate credential reference 方法，把连接指向新安全引用。
- audit 调用：建议后续记录 rotate credential allowed audit；storage / repository failure audit 单独规划。
- 成功 DTO：优先 `{ ok: true, credentialConfigured: true }` 或 `{ ok: true }`。
- 失败 DTO：稳定 code / error，不返回新旧引用。
- 失败回滚 / 补偿边界：新 storage 成功但 repository 失败时撤销新 ref 或记录补偿；旧引用处理窗口、回滚和双人复核不进入本 PR。
- 不进入测试连接。
- 不进入真实 HIS。

### clear credential service flow

- 输入来源：accessContext、path `connectionId` 和 parser 输出的可选 reasonCode。
- parser 结果：不包含凭证材料、不包含 credentialRef、不包含 external secret path。
- storage 调用：本轮规划可不先调用 storage；如后续需要同步撤销 storage，应单独规划。
- repository 调用：调用现有 clear credential reference 方法。
- audit 调用：建议后续记录 clear credential allowed audit；repository failure 是否 denied audit 单独规划。
- 成功 DTO：优先 `{ ok: true, credentialConfigured: false }` 或 `{ ok: true }`。
- 失败 DTO：稳定 code / error。
- 失败回滚 / 补偿边界：repository 失败不应修改 storage；audit 失败建议 fail closed 或事务回滚。
- 不进入测试连接。
- 不进入真实 HIS。

### revoke credential service flow

- 输入来源：accessContext、path `connectionId` 和 parser 输出的可选 reasonCode。
- parser 结果：不包含明文凭证、不包含前端 credentialRef、不包含 raw HIS payload。
- storage 调用：如已有安全 ref 且后续 service 可以通过受控方式定位，应调用 storage revoke；当前最小 repository 不暴露 `credentialRef` 给 service 的读取路径需单独评估。
- repository 调用：调用现有 revoke credential reference 方法，让 `credentialConfigured=false`。
- audit 调用：建议后续记录 revoke credential allowed audit；storage revoke failure、repository failure 和 permission denied audit 单独规划。
- 成功 DTO：优先 `{ ok: true, credentialConfigured: false }` 或 `{ ok: true }`。
- 失败 DTO：稳定 code / error，不返回 storage provider 内部信息。
- 失败回滚 / 补偿边界：storage revoke 失败时 fail closed 或记录补偿；repository 成功但 audit 失败时建议 fail closed 或事务回滚。
- 不进入测试连接。
- 不进入真实 HIS。

## repository / storage 协作边界

后续 parser / service 调用现有 fake storage 的建议边界：

- parser 只输出经过校验的合成 placeholder 或 future one-time material。
- service 从 accessContext 和 path 组装可信 tenantId、connectionId。
- service 调用 storage 时传入可信 tenantId、connectionId、placeholder 和 idempotencyKey。
- storage 内部用 tenantId + connectionId + idempotencyKey 形成 scoped idempotency key。
- placeholder 不进入 scoped key。
- scoped key 不进入 response、DTO、audit metadata 或日志。
- storage 返回安全 `credentialRef` 给 service。
- service 只把安全 `credentialRef` 传给 repository set / rotate。
- repository 只保存安全 `credentialRef`，并通过 read model / summary 派生 `credentialConfigured`。
- read model / summary 不返回 `credentialRef`。

失败协作边界：

- storage 成功但 repository 失败：只规划撤销 storage ref 或补偿记录，本 PR 不实现。
- repository 成功但 audit 失败：只规划 fail closed、事务回滚或补偿，本 PR 不实现。
- storage revoke 失败：只规划稳定失败、audit 和补偿，本 PR 不实现。
- repository failure 不得把 SQL、constraint、stack 或 `DATABASE_URL` 暴露到 DTO。
- storage failure 不得把 provider path、secret id、token、secret、stack 或外部错误全文暴露到 DTO。

本 PR 不新增 storage provider，不接真实 secret manager，不实现补偿逻辑。

## DTO 边界

成功响应建议：

- create credential：优先 `{ ok: true }`，如产品需要可返回 `{ ok: true, credentialConfigured: true }`。
- update credential：优先 `{ ok: true }`，如产品需要可返回 `{ ok: true, credentialConfigured: true }`。
- rotate credential：优先 `{ ok: true }`，如产品需要可返回安全 credentialStatus 摘要。
- clear credential：优先 `{ ok: true, credentialConfigured: false }` 或 `{ ok: true }`。
- revoke credential：优先 `{ ok: true, credentialConfigured: false }` 或 `{ ok: true }`。
- `updatedAt` 是否返回需后续评估；如返回，只能是连接配置安全更新时间。
- credentialStatus 如返回，只能是 `configured`、`missing`、`revoked`、`deleted` 等安全摘要，不代表外部授权成功。

成功 DTO 禁止返回：

- 明文凭证。
- `credentialRef`。
- scoped idempotency key。
- idempotencyKey 原文是否返回需默认禁止。
- storage provider 内部信息。
- external secret path。
- token、secret、API key、connection string。
- raw credential。
- raw HIS payload。
- SQL、stack、`DATABASE_URL`。

错误响应建议：

- 只返回稳定 code / error。
- 不返回输入原文。
- 不返回 token、secret、API key、connection string。
- 不返回 raw credential。
- 不返回 `credentialRef`。
- 不返回 scoped idempotency key。
- 不返回 storage provider 内部信息。
- 不返回 SQL、stack、`DATABASE_URL`。
- 不返回 raw HIS payload。
- 不返回外部 HIS 或 secret manager 的完整错误全文。

## audit 边界

本 PR 只规划，不实现 audit 改动。

后续建议评估的 audit 场景：

- create credential allowed audit。
- update credential allowed audit。
- rotate credential allowed audit。
- clear credential allowed audit。
- revoke credential allowed audit。
- parser failure denied audit。
- permission denied audit。
- storage failure audit。
- repository failure audit。

必须明确：

- 本 PR 不新增 audit action。
- 本 PR 不新增 audit reason。
- 本 PR 不修改 audit domain。
- 本 PR 不修改 query whitelist。
- 本 PR 不修改 audit repository。
- 如果后续需要 `manage_credentials` action 或新 reason，必须单独 Plan Mode 或实现 PR。
- 如果复用既有 action / reason，必须说明如何区分凭证管理与普通连接更新，避免审计语义混乱。

audit metadata 只允许安全摘要，例如：

- connectionId。
- credential action 类型。
- credentialType 枚举。
- credentialConfigured 布尔值。
- 安全 reason code。
- 安全时间戳。
- 不可逆版本摘要。

audit metadata 不得包含：

- payload 原文。
- 明文凭证。
- `credentialRef`。
- scoped idempotency key。
- external secret path。
- token、secret、API key、connection string。
- raw credential。
- raw HIS payload。
- SQL、stack、`DATABASE_URL`。
- 完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。

## 敏感信息禁区

以下内容禁止进入 response / DTO / read model / audit metadata / logs / test fixture / docs sample：

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
- scoped idempotency key。
- SQL。
- stack。
- `DATABASE_URL`。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- 图片 / 文件原文。

文档示例只能使用合成占位值，例如 `synthetic_placeholder_*`、`cred_ref_*` 的形态说明或安全枚举；不得使用看起来像真实密钥、真实路径、真实账号、真实厂商 token 或真实连接串的样例。

## 测试拆分建议

本 PR 只规划，不写测试。

后续 parser 测试建议覆盖：

- 字段白名单。
- 拒绝未知字段。
- 拒绝 `tenantId`。
- 拒绝 `credentialRef`。
- 拒绝 `credentialConfigured`。
- 拒绝 `status`。
- 拒绝 `healthStatus`。
- 拒绝 raw HIS payload。
- 拒绝 external secret path。
- 拒绝 token / secret / API key / connection string。
- 错误不回显输入原文。
- credentialType 枚举。
- idempotencyKey 格式与长度。
- reasonCode 格式与长度。
- placeholder / future credential material 总长度限制。

后续 service 测试建议覆盖：

- create credential flow。
- update credential flow。
- rotate credential flow。
- clear credential flow。
- revoke credential flow。
- service 不读取 request / header / query / localStorage。
- service 不接受 body tenantId 参与租户判断。
- service 不调用真实 HIS。
- service 不做测试连接。
- storage 成功但 repository 失败的稳定映射。
- repository 成功但 audit 失败的稳定映射。
- storage revoke 失败的稳定映射。
- idempotencyKey 不泄露。
- `credentialRef` 不暴露。

后续 DTO / audit 测试建议覆盖：

- DTO 不暴露 `credentialRef`。
- DTO 不暴露 scoped idempotency key。
- DTO 不暴露 token / secret / API key / connection string。
- DTO 不暴露 raw credential 或 raw HIS payload。
- audit metadata 不包含敏感字段。
- audit metadata 不包含输入原文。
- denied audit 是否写入需与 route plan 保持一致。

## 后续阶段边界

本 PR 不进入：

- parser 实现。
- service 实现。
- DTO helper 实现。
- API route。
- 权限实现。
- audit action / reason / domain。
- schema / migration。
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

## 下一阶段建议

建议后续顺序：

1. 凭证 parser / service / DTO 最小实现。
2. 凭证 API route / permission / audit Plan Mode。
3. 凭证 API route / audit / tests 最小实现。
4. 测试连接 Plan Mode。
5. 真实 HIS adapter Plan Mode。

不要把 API route、权限、测试连接或真实 HIS adapter 混入当前 PR。parser / service / DTO 最小实现也应继续保持不处理真实凭证、不接真实 secret manager、不做测试连接、不接真实 HIS，直到专门的存储与连接阶段完成安全评审。
