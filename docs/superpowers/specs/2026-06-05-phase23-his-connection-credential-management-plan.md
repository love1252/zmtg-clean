# Phase 23 HIS 连接配置凭证管理边界规划

> 日期：2026-06-05
> 状态：Phase 23 HIS 连接配置凭证管理 Plan Mode 文档。本 PR 只规划凭证管理边界，不写代码、不新增 API、不修改 `src/**`、不处理真实凭证、不做测试连接、不接真实 HIS。

## 本次范围

本 PR 只做 docs-only Plan Mode，用于在状态 API 闭环之后，规划 HIS 连接配置凭证管理的对象、权限、service、repository / storage、audit、DTO、parser / validation 和测试拆分边界。

本 PR 明确不做：

- 不写代码。
- 不新增 API。
- 不修改现有 API。
- 不修改 `src/**`。
- 不修改 route、service、repository、parser、权限实现、audit domain、audit reason、audit query whitelist、schema、migration 或测试。
- 不保存、处理或演示任何真实凭证。
- 不保存 token、secret、API key、连接串或外部密钥管理系统完整路径。
- 不做测试连接。
- 不接真实 HIS 或机构系统。
- 不保存 raw HIS payload。
- 不创建治疗摘要。
- 不创建随访任务。
- 不自动触达客户。
- 不接企微。
- 不接 AI / RAG / Agent。
- 不做经营智能中心、图表或导出。

如果后续实现凭证管理需要改代码、加 API、改权限、改 audit domain、改 schema、保存加密材料或调用外部系统，必须进入后续独立 Plan Mode 或独立实现 PR，不能混入当前 docs-only PR。

## 当前前置状态

Phase 23 当前已完成 HIS 连接配置状态 API 闭环：

- 状态权限已完成。
- 状态 service 已完成。
- pause / resume route 已完成。
- revoke / DELETE route 已完成。
- 403 权限拒绝 route denied audit 已完成。
- parser 失败 route denied audit 已完成。
- route tests、status service tests、权限和 audit domain 回归已覆盖。

状态 API 仍只表达连接配置生命周期动作，不表达凭证可用、测试连接通过或真实 HIS 已接入。凭证管理应先于测试连接和真实 HIS adapter，因为后两者都依赖受控凭证引用、凭证状态、凭证明文禁止展示、凭证审计和错误降级边界。

## 凭证管理对象边界

本轮只规划对象语义，不实现。

后续凭证管理建议覆盖：

- 凭证创建：为某个服务端可信租户下的连接配置录入一次性凭证材料，成功后只形成受控 `credentialRef` 或等价安全引用。
- 凭证更新：更新现有凭证的安全元数据或替换受控凭证材料，不改变连接配置低风险元数据。
- 凭证轮换：生成新版本凭证引用，旧版本进入受控失效或撤销流程，轮换过程可审计。
- 凭证删除 / 撤销：让连接配置不再可使用相关凭证，必要时同步清理外部密钥管理系统中的受控材料。
- `credentialRef` 语义：内部存储引用，不是凭证明文，不是外部系统调用能力，也不是前端可解释路径。
- `credentialConfigured` 语义：只表达“当前连接是否存在可用或待评估的凭证引用”，不表达凭证有效、不表达测试连接成功、不表达真实 HIS adapter 可调用。
- 凭证状态与连接状态关系：凭证状态可以影响连接是否可启用或测试，但连接 `active` 不应被解释为凭证一定有效；连接 `revoked` 或 `deleted` 不应继续允许凭证被业务调用。
- 凭证是否允许被清空：v1 建议不允许通过普通更新传空值清空凭证；清空必须走删除 / 撤销语义，并要求 reasonCode 和 audit。
- 凭证轮换后旧凭证处理：旧版本应进入受控失效窗口，窗口结束后撤销或销毁；旧版本不得再通过普通读取或 DTO 暴露。
- 撤销连接与删除凭证关系：撤销连接应至少阻断凭证继续用于测试连接和 adapter；删除凭证不等于删除连接元数据，连接元数据和审计仍需保留追溯。

必须明确：

- 不返回明文凭证。
- read model 不暴露敏感字段。
- 凭证不是 HIS 真实调用能力。
- 凭证管理完成也不代表测试连接完成。
- 凭证管理完成也不代表真实 HIS adapter 完成。
- `credentialConfigured` 不能作为健康检查结果、外部授权成功或数据同步可用的替代口径。

## 权限边界

后续凭证管理写入权限必须与只读权限、低风险元数据更新权限和状态权限分开评估。

建议 v1 权限口径：

- v1 默认仅允许 `tenant_admin` 管理本租户 HIS 连接配置凭证。
- `open_connection:read_own_tenant` 只允许读取安全连接配置摘要，不可替代凭证写入权限。
- `open_connection:update` 当前语义偏向连接低风险元数据更新，不建议默认复用为凭证管理权限。
- 推荐后续单独规划 `open_connection:manage_credentials`，用于凭证创建、更新、轮换、删除 / 撤销。
- 如果后续为了最小实现临时复用 `open_connection:update`，必须先单独 Plan Mode 评审，并明确 audit action、权限测试、拒绝原因和敏感信息禁区。
- 平台管理员默认不允许代管写入机构凭证；如确需平台代管，必须单独 Plan Mode，规划平台侧受控审批、租户选择、双人复核和更严格 audit。
- 普通机构角色、顾问、客服、平台 operator、安全审计角色默认不得管理凭证。

权限判断边界：

- 权限判断只使用服务端 access context。
- 租户来源只使用服务端可信 `tenantId`。
- 不接受 body、query、header、localStorage 或外部 payload 中的 `tenantId` 参与租户判断。
- 不接受外部 HIS payload、厂商机构号、门店号或连接返回内容作为内部授权依据。
- route 应在解析或处理凭证材料前完成认证和授权，避免无权限请求触发敏感解析、副作用或日志风险。

## service 边界

后续凭证管理 service 应保持当前架构边界：route / access layer 负责权限判断，service 负责可信输入编排、repository / storage 调用、audit 和稳定结果映射。

service 建议：

- service 不判断角色权限，避免与当前 route / access layer 架构冲突。
- service 可以防御性拒绝缺失可信 `tenantId`、缺失 actor、缺失 `connectionId` 或缺失必要输入，并返回稳定 `validation_failed`。
- service 不读取 request、header、query、localStorage 或完整 body。
- service 只接收服务端可信 accessContext、connectionId、database 或 transaction entry、必要输入和 repository / audit / storage factory。
- service 不接受 body / query / header / localStorage `tenantId`。
- service 不返回明文凭证。
- service 不返回 `credentialRef` 的真实含义或内部存储位置。
- service 不调用真实 HIS。
- service 不做测试连接。
- service 不创建治疗摘要。
- service 不创建随访任务。
- service 不触达客户。
- service result / DTO 最小化，成功优先返回 `{ ok: true }` 或最小安全状态。
- service 对错误只映射稳定结果，例如 `validation_failed`、`not_found`、`conflict`、`invalid_transition`、`service_unavailable`。
- service 不把 storage 异常、外部密钥管理系统异常、SQL、stack、`DATABASE_URL`、凭证明文或连接串写入响应或 audit metadata。

如后续确需 service 内做二次权限判断，必须先说明为什么当前 route / access layer 不能满足，并单独评估是否会造成权限逻辑重复、测试分散或 audit reason 不一致。

## repository / storage 边界

后续 repository / storage 规划必须先回答凭证材料放在哪里、连接配置表只保存什么、audit 与写入是否同事务。

建议边界：

- `his_connections` 或连接配置 read model 只保存 `credentialRef`、`credentialConfigured` 派生依据、凭证状态摘要和安全时间戳，不保存凭证明文。
- 明文禁止落库。
- 明文禁止进入普通 repository command、read model、DTO、audit metadata、日志、测试 fixture 或文档示例。
- 凭证材料应进入专门的加密存储或外部密钥管理系统；具体方案必须单独 Plan Mode。
- 如果使用数据库加密存储，必须评估信封加密、密钥轮换、最小读取面和备份安全。
- 如果依赖外部密钥管理系统，连接配置表只保存不可逆业务引用或短引用，不保存完整路径、完整密钥名、完整 secret id 或可直接定位明文的路径。
- `credentialRef` 不应包含租户可猜测路径、真实 token、连接串、厂商账号或外部系统敏感标识。
- 凭证轮换后旧凭证应标记为 revoked、retired 或 pending_retirement，并在受控窗口后销毁或失效。
- 软删除 / 撤销连接后，凭证应至少被标记为不可用于 adapter 或测试连接；是否物理销毁需单独评估审计追溯、合规保留和外部系统吊销能力。
- repository 写入与 audit 写入建议同事务；如果 storage 位于外部系统且无法纳入同一数据库事务，后续必须单独规划补偿、幂等键、失败回滚和不一致修复口径。
- 不保存 raw HIS payload。
- 不保存真实连接返回全文。
- 不保存外部系统错误响应全文。

凭证 storage 与真实 HIS adapter 是两个能力。即使后续能安全保存凭证，也不代表 adapter 可以读取它发起真实调用；adapter 读取凭证、scope、出站请求、重试、限流和错误脱敏必须另行规划。

## audit 边界

后续凭证管理动作必须可审计，但 audit 只能记录安全元数据。

建议审计覆盖：

- 凭证创建写 audit。
- 凭证更新写 audit。
- 凭证轮换写 audit。
- 凭证删除 / 撤销写 audit。
- 权限拒绝写 denied audit。
- parser 失败是否写 route denied audit 需要后续单独规划。
- storage 写入失败、外部密钥管理系统失败是否写 denied audit 需要后续单独评估，默认不得记录异常细节。

audit action / reason：

- 如果后续新增 `open_connection:manage_credentials`，audit action 建议与该权限动作保持一致，但必须单独评估 audit domain、query whitelist 和测试。
- 如果复用既有 action，必须在后续 Plan Mode 明确为什么复用、如何区分凭证管理与普通 update、是否影响审计查询。
- audit reason 是否复用既有 reason 需要后续单独评估。
- 候选 reason 可评估 `invalid_his_connection_payload`、`not_found_or_not_owned`、`role_denied`、`missing_tenant`、`cross_tenant_denied`、`credential_storage_unavailable`、`credential_rotation_conflict` 等；本 PR 不新增 reason。

audit metadata 必须最小化，禁止记录：

- 明文凭证。
- token。
- secret。
- API key。
- OAuth access token。
- OAuth refresh token。
- basic auth 用户名和密码组合。
- 签名密钥。
- 私钥。
- 连接串。
- `credentialRef` 的真实含义。
- 外部密钥管理系统完整路径。
- raw HIS payload。
- SQL。
- stack。
- `DATABASE_URL`。
- 完整治疗正文。
- 完整病历正文。
- 咨询全文。
- 图片 / 文件原文。
- 外部系统完整响应。

audit metadata 可评估记录的安全字段仅限：

- 连接配置 ID。
- 凭证动作类型。
- 安全 reason code。
- 凭证类型枚举。
- 凭证版本摘要。
- 轮换窗口状态。
- 是否已配置的布尔状态。
- 安全时间戳。

## DTO / 敏感信息边界

后续凭证管理 DTO 必须采用最小返回。

成功响应建议：

- 创建成功：优先 `{ ok: true }`，或 `{ ok: true, credentialConfigured: true }`。
- 更新成功：优先 `{ ok: true }`。
- 轮换成功：优先 `{ ok: true }`，如必须返回状态，只返回安全状态码。
- 删除 / 撤销成功：优先 `{ ok: true, credentialConfigured: false }` 或 `{ ok: true }`。

错误响应建议：

- 只返回稳定 `code` / `error`。
- 不返回用户输入原文。
- 不返回 storage 异常细节。
- 不返回外部系统错误全文。
- 不返回数据库约束、SQL、stack 或 `DATABASE_URL`。

DTO 不得返回：

- token。
- secret。
- API key。
- connection string。
- raw credential。
- OAuth access token。
- OAuth refresh token。
- basic auth 用户名和密码组合。
- 签名密钥。
- 私钥。
- `credentialRef` 的真实含义。
- `credentialConfigured` 之外的敏感状态。
- actor 字段。
- 内部存储位置。
- 外部密钥管理系统路径全量信息。
- raw HIS payload。
- 外部系统响应全文。

read model 应继续只暴露安全摘要，例如连接名称、来源系统、状态、健康状态、安全时间戳和 `credentialConfigured`。`credentialConfigured` 只表达是否存在受控凭证引用，不表达凭证有效或外部系统可用。

## parser / validation 边界

后续 parser 只做输入结构和安全约束，不做权限判断，不读取租户来源，不调用 storage 或外部系统。

建议 future payload 规划：

| 动作 | 允许字段规划 | 不允许字段 |
| --- | --- | --- |
| 创建凭证 | `credentialType`、一次性凭证材料对象、可选 `expiresAt`、可选 `reasonCode` | `tenantId`、`credentialRef`、`credentialConfigured`、连接状态、健康状态、raw HIS payload、连接返回、actor、SQL、stack |
| 更新凭证 | `credentialType`、一次性凭证材料对象、可选 `expiresAt`、可选 `reasonCode` | `tenantId`、状态字段、内部存储位置、外部密钥路径、raw HIS payload |
| 轮换凭证 | `credentialType`、新的一次性凭证材料对象、可选 `reasonCode`、可选轮换窗口参数 | 旧凭证明文、旧 `credentialRef`、内部路径、状态强制覆盖 |
| 删除 / 撤销凭证 | 可选 `reasonCode` | 明文凭证、`tenantId`、内部路径、raw HIS payload |

字段限制建议：

- 顶层 payload 只接受普通 JSON object。
- 禁止数组、null、函数、Date、class instance、空原型对象和未知字段。
- `credentialType` 使用稳定枚举，例如 api_key、oauth_token、basic_auth、signature_key、mtls、sftp、other；具体枚举需后续评审。
- `reasonCode` 只允许安全短字符串，trim 后非空，长度建议不超过 160。
- `expiresAt` 如进入 v1，必须是 ISO 时间字符串并通过服务端解析。
- 一次性凭证材料对象必须有总长度上限、字段数量上限和字段名白名单。
- 空凭证不能被普通 update 当作清空；清空必须使用删除 / 撤销动作。
- update 与 rotate 必须区分：update 适合替换或补充当前凭证材料；rotate 应产生新版本并保留旧版本受控失效流程。
- 删除 / 撤销 payload 是否允许 reasonCode 需要后续 route / parser Plan Mode 细化，默认允许安全 reasonCode。
- parser 失败错误码建议稳定为 `validation_failed`。
- parser 失败 route denied audit 是否接入需要后续单独规划，不能在当前 PR 中实现。
- 禁止 body `tenantId` 参与租户判断；即使 payload 中出现 `tenantId`，也只能作为非法字段拒绝，不能用于授权或数据范围选择。

parser、route、service、storage 和 audit 的测试应共同覆盖敏感字段不回显，避免凭证材料在错误响应、测试快照或审计 fixture 中泄露。

## 测试拆分建议

本 PR 不写测试，只规划后续拆分。

建议后续独立覆盖：

- parser 测试：字段白名单、类型限制、长度限制、空凭证、update 与 rotate 差异、reasonCode、`tenantId` 注入拒绝、敏感字段不回显。
- permission 测试：`tenant_admin` 允许、普通机构角色拒绝、平台角色默认拒绝、`read_own_tenant` 不可替代写入、`update` 是否可替代的明确决策、缺失 tenant 和跨租户拒绝。
- service 测试：可信 accessContext、connectionId、storage / repository command 最小化、稳定 result、错误脱敏、无真实 HIS 调用、无测试连接、无治疗摘要 / 随访任务 / 自动触达。
- repository 测试：`credentialRef` 写入边界、只保存安全引用、软删除 / 撤销后的可见性、旧凭证版本状态、同事务 audit 边界或外部 storage 补偿边界。
- route 测试：认证、授权、parser 顺序、权限拒绝 audit、parser 失败 audit、service result 到 HTTP 映射、成功 DTO 最小化。
- audit 测试：凭证创建 / 更新 / 轮换 / 删除 / 撤销 allowed / denied audit、安全 reason、metadata 最小化和查询白名单影响。
- DTO 敏感字段回归测试：不返回 token、secret、API key、connection string、raw credential、内部路径、actor 或 `credentialRef` 真实含义。
- 日志 / audit metadata 敏感信息泄露回归测试：禁止明文凭证、raw HIS payload、SQL、stack、`DATABASE_URL`、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文。
- 凭证轮换边界测试：旧凭证失效、轮换冲突、轮换失败不泄露新旧明文。
- 凭证删除 / 撤销边界测试：删除凭证不硬删连接元数据、撤销连接阻断凭证使用、审计仍可追溯。

## 后续阶段边界

本 PR 不进入：

- 凭证管理实现。
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

后续任何 PR 如需要读取真实凭证、调用外部系统、保存外部响应、导入真实客户数据或触发业务副作用，必须先拆独立 Plan Mode，并重新确认租户隔离、审计、DTO、日志和错误脱敏边界。

## 下一阶段建议

建议后续顺序：

1. 凭证管理 repository / storage 边界 Plan Mode 或最小实现。
2. 凭证管理 parser / service / DTO Plan Mode 或最小实现。
3. 凭证管理 API route / audit / tests。
4. 测试连接 Plan Mode。
5. 真实 HIS adapter Plan Mode。

不要把测试连接或真实 HIS adapter 混入当前凭证管理 PR。凭证管理只能解决“安全录入、保存引用、更新、轮换、撤销和最小可见性”问题，不能证明外部系统可连通或业务数据可同步。

## 收口结论

Phase 23 下一步应先把 HIS 连接配置凭证管理从对象语义、权限、service、repository / storage、audit、DTO、parser 和测试拆分上收敛清楚，再进入实现。

当前状态 API 已闭环，但凭证管理仍未实现，测试连接仍未开始，真实 HIS adapter 仍未开始。当前 PR 只补规划文档，不改变运行时行为。
