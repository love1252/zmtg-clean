# Phase 23 HIS 连接配置测试连接与健康检查边界规划

## 范围声明

- 本文档只规划 Phase 23 HIS 连接配置测试连接与健康检查边界，不实现运行时代码。
- 本次不修改 `src/**`、`drizzle/**`、schema / migration、API route、service、repository runtime、credential provider runtime、test connection runtime、health check runtime、compensation runtime、recovery runtime、audit runtime、worker runtime、job queue runtime、runner / scheduler / cron、package / lockfile、`.env` 或 `.codex/**`。
- 当前 main 基线为 `97d87a2c1639bfc4407fb5824999469ee844defa`。
- PR #192 已合并，#192 只完成 Phase 23 HIS 凭证补偿 dead letter / manual review recovery docs-only 规划；本文档明确停止继续扩张 recovery 链路，把下一条主线收敛回测试连接 / 健康检查 Plan Mode。

## 开始前只读盘点结论

1. 本地 `main` 已同步 `origin/main`，两者都位于 `97d87a2c1639bfc4407fb5824999469ee844defa`。
2. working tree 在建分支前为 clean。
3. README、roadmap 和 2026-06-07 devlog 均持续标注：测试连接、真实 provider、真实凭证、真实 secret manager 和真实 HIS adapter 尚未开始。
4. 连接配置 schema / API 规划已经预留 `healthStatus`、`lastCheckedAt`、`lastErrorCode` 等健康字段语义。
5. 已有连接健康状态枚举语义为 `unknown`、`healthy`、`degraded`、`failed`，测试连接 / 健康检查应复用该集合，不新增平行枚举。
6. 凭证管理、凭证 provider 抽象、provider failure / compensation、operation / job queue 和 worker 最小链路已经完成多轮前置工作，但真实 provider、真实凭证和测试连接仍未进入实现。
7. 最新 recovery Plan 已把 recovery candidate 查询、recovery service、人工复核视图、audit integration、service / route 和 runner / scheduler 全部列为后置，不应在本轮继续扩张。
8. 本次 docs-only Plan 没有阻塞；如果要进入 runtime，必须另开后续实现 PR。

## 当前明确停止的 recovery 链路

本轮不继续推进以下内容：

- recovery candidate repository 查询。
- recovery service。
- recovery audit integration。
- 人工复核视图。
- recovery route。
- runner / scheduler / cron。
- compensation audit repository / service integration。
- service 创建 operation 与 job queue 接入。
- dead letter / manual review recovery runtime。

这些内容不是被否定，而是从 Phase 23 当前主线移出。后续如果确有运营需求，应作为独立 Plan Mode 或独立实现 PR，不应阻塞测试连接与健康检查边界。

## 主线收敛

测试连接 / 健康检查应成为 Phase 23 下一主线，优先级高于继续扩张 compensation recovery runtime。

理由：

- 连接配置、状态 API、凭证 API、provider 抽象和 provider failure 分类已经形成前置地基。
- 当前系统仍无法回答机构管理员最自然的问题：这条 HIS 连接配置是否可用。
- recovery 链路继续扩张会把后台补偿、人工复核和调度治理做深，但不能证明连接配置本身可安全使用。
- 测试连接 / 健康检查是进入真实 HIS adapter、Webhook / 同步任务、患者身份匹配和后续外部数据流之前的必要安全门。

本轮只规划，不实现测试连接按钮、route、service、provider 调用、状态写回或 audit runtime。

## 触发入口规划

v1 推荐入口：

- 连接配置详情页作为主入口，展示只读安全摘要、当前健康状态和手动“测试连接”动作。
- 凭证管理页作为次入口，在凭证创建、更新或轮换成功后提供手动测试动作，但不自动发起测试连接。
- 状态操作后不自动测试连接。pause / resume / revoke / delete 仍是生命周期动作，不等于外部连通性检测。
- create / update 低风险元数据成功后不自动测试连接，避免无意读取凭证或发起外部调用。

后置入口：

- 平台侧只读运营健康概览可后置。
- 自动周期健康检查可后置到 runner / scheduler 单独规划。
- 真实 HIS adapter preflight 可后置到真实 adapter Plan Mode。

## credential provider 边界

测试连接必须依赖受控 credential provider，不能绕过 provider 直接读取或拼接凭证。

允许规划：

- service 通过服务端可信 `tenantId + connectionId` 定位连接配置。
- service 判断连接未删除、未撤销，并且存在安全 `credentialConfigured` 摘要。
- service 调用受控 credential provider 获取一次性、短生命周期的内部凭证访问能力。
- provider 只把凭证交给测试连接专用内部 adapter 或 fake provider，不把凭证返回给 route、DTO、前端、audit 或日志。

禁止：

- 从前端 body、query、header、cookie 或 localStorage 读取凭证明文。
- 从普通 DTO、read model、`credentialRef` 字符串或 devtools 可见数据还原凭证。
- 把 `credentialRef` 当作外部 secret path 或真实凭证路径展示。
- 在测试连接 route 中接收 token、secret、API key、OAuth token、basic auth、private key、signing key 或 connection string。

## 凭证明文边界

测试连接不允许读取并返回凭证明文。

运行时实现时，服务端内部是否短暂读取凭证材料必须满足后续独立评审：

- 只能由 credential provider 在服务端受控上下文中完成。
- 明文只能短暂存在于 provider / adapter 调用栈内存中。
- 明文不得进入 repository command、audit metadata、DTO、日志、错误响应、测试 fixture、文档示例、devlog 或 PR 描述。
- 明文不得写入 `his_connections` 或任何普通业务表。

本轮不接真实凭证，因此也不演示、生成或保存任何真实 secret。

## 外部响应体边界

测试连接不允许返回外部响应体。

即使未来真实 HIS 返回诊断信息，也只能映射为稳定 reason code 和安全中文文案。禁止返回：

- 外部完整响应体。
- 外部完整请求体。
- 外部 HTTP header。
- 外部系统 token、session、trace id 或签名材料。
- SQL、stack、`DATABASE_URL`。
- provider raw error。
- raw HIS payload。
- 患者、预约、治疗、病历或门店原始业务数据。

前端只应看到：

- `ok` 布尔结果或稳定状态。
- 安全 reason code。
- 安全文案。
- 可选 `checkedAt`。
- 可选健康状态摘要。

## raw HIS payload 边界

测试连接不得保存 raw HIS payload。

v1 测试连接应优先采用最小探测动作，例如 fake provider 下的模拟 ping、真实 provider 后置时的受控 health endpoint 或只读 metadata endpoint。即使外部系统返回样例患者、队列、订单或机构信息，也必须丢弃原文，只保留安全分类。

如果未来真实 HIS 的测试接口只能返回业务 payload，必须另开 Plan Mode 评估脱敏、字段白名单和保存禁止策略；默认仍不保存原始 payload。

## 健康状态写回边界

测试连接成功 / 失败可以规划写回 `lastCheckedAt`、`healthStatus` 和 `lastErrorCode`，但 runtime 后置。

建议映射：

- 成功：`healthStatus = healthy`，`lastCheckedAt = now`，`lastErrorCode = null`。
- 可连接但能力受限、凭证临近过期、provider 降级或外部返回受控警告：`healthStatus = degraded`。
- 明确不可连接、认证失败、凭证不可用、provider 不可用超过安全阈值或外部端点失败：`healthStatus = failed`。
- 从未测试、连接新建、凭证清空 / 撤销后或无法判断：`healthStatus = unknown`。

`lastCheckedAt` 只记录安全检查时间，不代表最近同步时间、最近导入时间或真实 HIS 可持续可用。状态写回必须绑定可信 `tenantId + connectionId`，不得由前端传入状态值。

## reason code 设计

测试连接失败 reason code 应稳定、短小、可聚合，并且不含敏感内容。

建议 v1 候选：

- `missing_credential`：没有可用凭证引用或凭证已清空。
- `connection_not_active`：连接未处于允许测试的状态。
- `credential_provider_unavailable`：凭证 provider 不可用。
- `credential_unavailable`：provider 无法提供受控凭证访问能力。
- `credential_revoked`：凭证已撤销或不可用于测试。
- `provider_timeout`：provider 或测试连接内部调用超时。
- `external_unreachable`：外部测试端点不可达。
- `external_auth_failed`：外部系统拒绝认证。
- `external_rate_limited`：外部系统限流。
- `external_service_unavailable`：外部系统不可用。
- `unsupported_vendor`：当前厂商或系统类型尚未支持测试连接。
- `unsafe_external_response`：外部响应无法安全分类。
- `validation_failed`：输入或状态不满足白名单。
- `not_found_or_not_owned`：连接不存在或不属于当前租户。
- `service_unavailable`：内部服务不可用。

不建议使用包含外部错误文本、HTTP body、SQL 约束、stack、endpoint、tenant 名称、厂商账号、门店号或凭证摘要的 reason code。

## 前端展示边界

允许展示：

- “连接正常”。
- “连接异常，请检查配置或稍后重试”。
- “凭证未配置或已不可用”。
- “当前连接状态不允许测试”。
- “外部系统暂不可用”。
- “厂商暂未支持测试连接”。
- 最近检查时间。
- `unknown / healthy / degraded / failed` 的中文状态文案。

禁止展示：

- 凭证明文、token、secret、API key、OAuth token、basic auth、private key、signing key、connection string。
- `credentialRef`、provider internal path、secret manager path、KMS key id。
- 外部请求体、响应体、header、URL query、trace、签名串。
- SQL、stack、`DATABASE_URL`。
- raw HIS payload。
- 患者身份、病历、治疗记录或外部业务数据。

前端文案应面向机构管理员，可操作但不泄密；需要排障时只提供稳定 code，供内部审计和后续支持流程使用。

## audit 边界

测试连接成功和失败都应规划 audit，但 audit implementation 后置。

建议 audit 记录：

- actor id / role / scope。
- tenantId。
- connectionId。
- action，例如未来可复用或新增 `test_connection`。
- result：allowed / denied 或 succeeded / failed 的既有口径需单独评估。
- reason code。
- health status 写回结果。
- checkedAt。

audit 不写：

- 凭证明文。
- token、secret、API key、OAuth token、connection string。
- `credentialRef` 完整值或 provider path。
- 外部请求体、响应体、header。
- raw HIS payload。
- provider raw error。
- SQL、stack、`DATABASE_URL`。
- 患者、治疗、预约或病历原文。

audit 是否 fail closed 需要后续 route / service Plan Mode 决策。推荐测试连接发起、权限拒绝、parser 失败、provider failure 和外部测试失败都能被审计，但不要把 audit 接入与首个 test-only fake provider runtime 混在同一 PR。

## service / route / 权限 / parser / DTO / repository 边界

service：后续需要。service 应负责可信输入编排、连接状态判断、credential provider 调用、测试连接 provider 调用、稳定 result 映射、状态写回和 audit 衔接。本轮不新增 service。

route：后续需要。建议路径后置评估为 `POST /api/institution/his-connections/[connectionId]/test-connection` 或同等窄语义路径。route 只从 access context 推导 tenant，不从 body / query / header 接受 tenant。本轮不新增 route。

权限：后续需要。建议单独评估 `open_connection:test_connection`，不要复用只读权限；是否允许 `tenant_admin` 默认具备该权限需在实现 PR 明确。普通机构角色、平台运营、审计角色默认不允许触发测试连接。本轮不修改权限。

parser：后续需要，但应极薄。v1 手动测试连接可以不需要 body；如果需要 reason 或 mode，也只能接受小型白名单字段。parser 必须拒绝 `tenantId`、凭证、状态写回字段、raw payload、header、endpoint override 和任意 provider 参数。本轮不新增 parser。

DTO：后续需要。成功 DTO 建议只返回 `{ ok: true, healthStatus, checkedAt }` 或等价安全摘要；失败 DTO 只返回 `{ ok: false, code, error, healthStatus, checkedAt? }`。DTO 不返回 `credentialRef`、外部响应体或敏感字段。本轮不新增 DTO。

repository 写回：后续需要，但应窄语义。建议新增只写健康摘要的方法，绑定 `tenantId + connectionId`，只允许写 `healthStatus`、`lastCheckedAt`、`lastErrorCode` 和 `updatedAt`，不修改凭证、连接状态、租户、名称、sourceSystem 或 compensation state。本轮不修改 repository。

## fake provider 与真实 provider 顺序

后续实现顺序应先 test-only / fake provider，再真实 provider。

第一阶段可以只实现：

- fake provider 下的测试连接服务。
- reason code mapper。
- 权限、parser、DTO 和 audit 的安全边界。
- 健康状态写回的 repository 最小方法。
- 单元测试和 route tests，确认不调用真实 HIS、fetch、真实 secret manager 或真实 provider。

后续真实 provider 阶段才评估：

- 真实 credential provider 读取凭证的受控接口。
- 真实 secret manager。
- 真实 HIS adapter 测试 endpoint。
- 出站网络、超时、重试、限流、熔断、错误脱敏。
- 外部系统厂商差异。
- 生产凭证读取审计与最小权限。

真实 provider、真实 secret manager 和真实 HIS adapter 不应与本轮 Plan 或首个 fake provider runtime 混在同一 PR。

## 明确后置内容

以下内容全部后置：

- 真实 provider。
- 真实 secret manager / KMS / Vault。
- 真实 HIS adapter。
- Webhook / 同步任务。
- 患者身份匹配。
- 人工复核。
- 自动摘要。
- 自动任务。
- 自动触达。
- 真实测试连接出站请求。
- raw HIS payload 处理。
- runner / scheduler / cron。
- compensation recovery candidate 查询。
- recovery service。
- recovery audit integration。
- compensation audit repository / service integration。

## 后续 PR 拆分建议

1. 测试连接权限与 route Plan Mode：只规划 `test_connection` 权限、route 层 denied audit、parser 和 DTO。
2. 健康状态 repository 写回 Plan Mode：只规划 `lastCheckedAt / healthStatus / lastErrorCode` 写回方法、并发和状态边界。
3. fake provider 测试连接 runtime 最小实现：不出站、不读真实凭证，只跑安全 result mapper 和 DTO。
4. audit integration Plan Mode：规划 test requested / succeeded / failed / denied 的 action、reason、query whitelist 和 fail closed 口径。
5. fake provider route runtime：接入权限、parser、service、repository 写回和 route tests。
6. 真实 credential provider 读取边界 Plan Mode：规划真实 one-time credential access、secret manager、超时和脱敏。
7. 真实 HIS adapter 测试连接 Plan Mode：规划厂商 endpoint、出站策略、错误映射和 raw payload 禁区。
8. 周期健康检查 Plan Mode：单独规划 runner / scheduler / cron、批量限制、幂等、审计和告警。

## 本次结论

- 本次满足测试连接 / 健康检查 docs-only Plan Mode 条件。
- Phase 23 下一主线应转向测试连接 / 健康检查，不继续扩张 recovery runtime。
- 测试连接必须通过受控 credential provider，不直接读前端或普通 DTO 里的凭证明文。
- 测试连接不得返回外部响应体，不保存 raw HIS payload。
- 健康状态复用 `unknown / healthy / degraded / failed`。
- `lastCheckedAt`、`healthStatus` 和 `lastErrorCode` 可以规划写回，但 runtime 后置。
- 成功和失败都应规划 audit，但 audit implementation 后置。
- service、route、permission、parser、DTO 和 repository 写回都需要后续独立实现或 Plan Mode。
- 真实 provider、真实 secret manager、真实 HIS adapter、Webhook / 同步任务、患者身份匹配、人工复核、自动摘要、自动任务和自动触达全部后置。
