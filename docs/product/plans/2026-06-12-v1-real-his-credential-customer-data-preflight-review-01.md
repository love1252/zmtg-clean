# V1 真实 HIS / credential / 客户数据接入前置审查 01

## 1. 任务元信息

| 项 | 内容 |
| --- | --- |
| 任务编号 | `ZMTG-V1-REAL-HIS-CREDENTIAL-CUSTOMER-DATA-PREFLIGHT-REVIEW-01` |
| 日期 / 时区 | 2026-06-12 / CST +0800 |
| 当前阶段 | docs-only 前置审查 |
| 当前基线 | `main` / `origin/main` = `4adc79f92d6a1879ae29280306f6ad851eb02d6a` |
| 本文档性质 | 真实 HIS、credential、客户数据接入前的安全、审计、字段白名单和合规边界审查计划 |

本文档只定义进入真实 HIS、credential 或客户数据之前必须完成的审查闸门，不授权 runtime 实现，不授权接入真实系统，不授权导入真实客户数据。

## 2. 当前任务不是哪些内容

本任务不是知识库 UI、demo PR、API route、DB schema、migration、runtime、service、repository、adapter、credential provider、HIS connector、上传、解析、分块、embedding、向量索引、检索 runtime、AI 使用知识 runtime、真实模型接入、自动营销、自动触达、自动创建任务、预约、成交、支付、合同或发票任务。

任何真实业务要接 HIS、credential 或客户数据时，必须单独启动本类前置审查，不得夹带在知识库 UI、知识库 demo、只读 mock、readonly facade、readonly API contract 或其他演示 PR 中。

## 3. 适用触发条件

出现以下任一诉求时，必须先执行本前置审查，再讨论 runtime：

| 触发项 | 示例 | 审查前状态 |
| --- | --- | --- |
| 真实 HIS 接入 | 读取客户、预约、项目、治疗、费用或医嘱相关数据。 | NO-GO |
| 真实 credential 接入 | API Key、OAuth、Webhook secret、Basic Auth、mTLS 私钥、数据库连接串、HIS 厂商密钥。 | NO-GO |
| 真实客户数据导入 | 姓名、手机号、身份证、病历号、治疗记录、咨询原文、订单、支付、合同、发票。 | NO-GO |
| 外部系统回写 | 向 HIS、微信、企微、短信、CRM 或支付系统写入状态。 | NO-GO |
| 真实 AI 使用客户数据 | prompt / completion 使用真实客户原文或完整医疗信息。 | NO-GO |

## 4. 参考原则

本计划以工程安全闸门为主，不替代法务、合规或安全团队判断。若目标客户、部署地或业务协议涉及 HIPAA 或其他监管框架，应由合规负责人确认适用性。

可参考的通用原则：

- 最小必要：只处理完成明确业务目的所需的最少数据。
- 分层防护：对电子敏感健康信息类数据应考虑行政、物理和技术安全措施。
- 可审计：所有敏感接入、读取、授权、拒绝、失败和变更都应留下低敏审计轨迹。
- 默认拒绝：字段、角色、租户、来源、credential 状态不明确时，不进入真实数据流。

外部参考链接：

- HHS HIPAA Privacy Rule minimum necessary guidance: `https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/minimum-necessary-requirement/index.html`
- HHS HIPAA Security Rule summary: `https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html`

## 5. 审查闸门总览

| 闸门 | 必须产物 | 不满足时处理 |
| --- | --- | --- |
| 业务目的 | 明确业务场景、最小闭环、数据使用目的、责任人。 | 不进入设计。 |
| 法务 / 合规确认 | 适用法规、客户授权、数据处理协议、保留 / 删除要求。 | 不进入 runtime。 |
| 数据分类 | 字段级敏感度、来源系统、保留周期、可见角色。 | 只能继续 mock / demo。 |
| 字段白名单 | 输入、存储、输出、审计、导出的 allowlist。 | 默认拒绝未知字段。 |
| Credential 生命周期 | 生成、保存、加密、使用、轮换、吊销、访问审计。 | 不接真实 credential。 |
| Tenant / RBAC | 租户、机构、workspace、角色、平台运维模式边界。 | 拒绝跨租户和越权读取。 |
| HIS 适配边界 | 只读 / 写入、同步方式、幂等、限流、失败降级。 | 不创建 adapter。 |
| 审计覆盖 | actor、tenant、action、reason、result、resource、低敏摘要。 | 不允许处理真实数据。 |
| 错误与日志 | 低敏错误文案、禁止 stack / SQL / raw payload / credential。 | 不进入测试环境。 |
| 验证计划 | 单元、契约、安全、脱敏、拒绝、审计、回滚验证。 | 不合并 runtime PR。 |

## 6. Credential 边界

Credential 包括但不限于：

- HIS API Key、Token、OAuth client secret、refresh token、Webhook signing secret。
- Basic Auth 用户名 / 密码。
- mTLS 证书、私钥、keystore 密码。
- 数据库连接串、只读账号、厂商私有密钥。
- 生产环境变量、第三方回调签名密钥。

Credential 必须满足：

| 规则 | 要求 |
| --- | --- |
| 不入仓库 | 不写入源码、测试 fixture、seed、docs 示例、截图、日志。 |
| 不进前端 | 不暴露给浏览器、localStorage、sessionStorage、URL、HTML。 |
| 加密保存 | 真实落库前必须有加密、密钥管理和访问控制方案。 |
| 最小权限 | 只授予目标接口、目标租户、目标环境所需权限。 |
| 可轮换 | 支持轮换、吊销、过期、失效提示和安全回滚。 |
| 可审计 | 记录 credential 引用、状态变化、访问者、用途和结果，不记录明文。 |
| 环境隔离 | dev、staging、prod 不共用 credential。 |

禁止：

- 在 demo、知识库 UI 或只读 PR 中读取真实 credential。
- 在错误信息、审计 metadata、console、测试快照、API response 中输出 credential。
- 用真实 credential 调试 mock / seed / demo 数据。

## 7. 客户数据字段白名单前置

真实客户数据进入系统前，必须先形成字段级 allowlist。未列入 allowlist 的字段一律拒绝，不做透传 JSON。

### 7.1 默认禁止字段

| 类型 | 禁止内容 |
| --- | --- |
| 身份识别 | 真实姓名、完整手机号、身份证号、护照号、完整地址、完整病历号。 |
| 医疗 / 治疗 | 完整病历、诊断原文、医嘱原文、治疗图片、咨询录音 / 转写、完整治疗记录。 |
| 交易 | 订单明细、支付流水、合同、发票、退款、收款账户。 |
| 外部系统 | HIS raw payload、外部请求 / 响应正文、外部错误全文、厂商内部 ID 明文。 |
| AI 内容 | 真实 prompt、completion、模型推理链路、含高敏原文的总结。 |

### 7.2 候选低敏字段

候选低敏字段仍需审查后才能进入 runtime：

| 字段 | 用途候选 | 限制 |
| --- | --- | --- |
| `tenantId` | 租户隔离。 | 必须来自服务端上下文。 |
| `institutionId` | 机构隔离。 | 不得由客户端自由覆盖。 |
| `workspaceId` | 工作区边界。 | 必须与租户、机构一致。 |
| `externalPatientRef` | 低敏外部引用。 | 必须不可逆或经过映射，不展示真实 HIS ID。 |
| `customerDisplayLabel` | UI 低敏展示。 | 仅允许脱敏标签，例如“客户 A123”。 |
| `treatmentStage` | 运营阶段判断。 | 不包含诊断和医嘱原文。 |
| `appointmentWindow` | 预约观察窗口。 | 不代表真实预约号或占号。 |
| `sourceSystemLabel` | 来源说明。 | 不展示厂商 credential 或 raw endpoint。 |

## 8. HIS 接入边界

HIS 只是潜在数据来源之一，不是智美天工 V1 主线。真实 HIS 接入必须晚于字段白名单、credential、审计、合规、tenant / RBAC 和错误边界审查。

| 维度 | 审查要求 |
| --- | --- |
| 读取范围 | 明确只读接口、字段、时间窗口、分页、限流和失败降级。 |
| 写入范围 | 默认禁止。任何写回 HIS 必须单独审批。 |
| 同步模式 | 默认不做后台自动同步。scheduler、worker、queue、cron 必须单独审批。 |
| 原始 payload | 不落库、不入日志、不进审计 metadata、不返回前端。 |
| 幂等 | 后续如需同步，必须先定义幂等键、重复处理和回滚策略。 |
| 错误 | 对用户只展示产品化低敏原因，不暴露厂商错误全文、路径、SQL、stack。 |
| 断路 | Credential 失效、字段拒绝、tenant mismatch、审计不可用时默认停止。 |

## 9. Tenant / RBAC / 运维边界

| 场景 | 必须行为 |
| --- | --- |
| tenant mismatch | 拒绝读取或返回低敏拒绝状态，不泄露对象存在性。 |
| institution mismatch | 拒绝读取，不返回其他机构数据。 |
| workspace mismatch | 拒绝读取，不用客户端 workspace 覆盖服务端上下文。 |
| RBAC denied | 返回低敏拒绝状态，不返回字段级详情。 |
| 平台运维访问 | 必须显式启用、限时、限范围，并写审计。 |
| 服务账号 | 必须绑定 tenant / institution / scope，不得拥有全局默认权限。 |

## 10. 审计覆盖矩阵候选

审计只能记录低敏摘要。不得记录 credential 明文、raw payload、完整客户数据、SQL、stack、外部错误全文、prompt / completion 全文。

| 动作 | 资源 | 结果 | 推荐 reason |
| --- | --- | --- | --- |
| credential 创建 / 更新 | `his_credential_ref` | `accepted` / `rejected` | `credential_scope_reviewed` / `credential_policy_denied` |
| credential 轮换 / 吊销 | `his_credential_ref` | `accepted` / `failed` | `credential_rotated` / `credential_revoked` |
| HIS 读取请求 | `his_read_request` | `accepted` / `denied` / `failed` | `his_read_allowed` / `tenant_mismatch` / `rbac_denied` |
| 字段白名单拒绝 | `customer_data_field` | `denied` | `field_not_allowlisted` |
| 客户数据低敏映射 | `customer_data_mapping` | `accepted` / `partial` | `low_sensitive_mapping_applied` |
| 外部错误降级 | `his_connection` | `failed` | `external_source_unavailable` |
| 平台运维访问 | `tenant_support_access` | `accepted` / `denied` | `support_access_approved` / `support_access_denied` |

最小审计字段候选：

- `actorId`
- `actorRole`
- `tenantId`
- `institutionId`
- `workspaceId`
- `action`
- `resourceType`
- `resourceRef`
- `result`
- `reason`
- `occurredAt`
- `sourceSystemType`
- `credentialRef`
- `dataCategory`
- `lowSensitiveSummary`

## 11. 错误、日志和失败状态

产品化失败原因必须低敏，不能暴露技术栈、路径、worker、依赖错误、SQL、DB URL、raw payload、credential 或模型输出。

| 状态 | 用户可见文案候选 | 禁止泄露 |
| --- | --- | --- |
| `feature_disabled` | “当前机构暂未启用该能力。” | feature flag 规则细节。 |
| `tenant_mismatch` | “当前账号无权访问该机构数据。” | 目标 tenant 是否存在。 |
| `rbac_denied` | “当前角色暂无查看权限。” | 具体字段或对象存在性。 |
| `credential_missing` | “连接凭据尚未完成安全配置。” | credential key 名、env 名。 |
| `credential_invalid` | “连接凭据校验未通过，请联系管理员处理。” | token、secret、厂商错误全文。 |
| `credential_expired` | “连接凭据已过期，需要重新授权。” | refresh token、过期策略细节。 |
| `his_unavailable` | “外部系统暂不可用，请稍后重试。” | endpoint、IP、HTTP 原文。 |
| `field_rejected` | “部分字段不在安全白名单内，已停止处理。” | 原始字段值。 |
| `audit_unavailable` | “审计记录不可用，已停止敏感操作。” | 审计存储错误、SQL。 |
| `partial` | “部分来源不完整，仅保留低敏可用信息。” | raw payload、外部失败详情。 |

## 12. 与知识库 / demo PR 的关系

知识库 demo、readonly facade、readonly API contract、mock UI 或后续最小 demo 链路只能继续使用 mock / seed / demo 输入。

禁止在这些 PR 中夹带：

- 真实 HIS adapter。
- 真实 credential provider。
- 真实客户数据导入。
- 外部网络请求。
- schema / migration。
- scheduler / worker / queue / cron。
- 真实 AI 模型调用。
- 自动任务、预约、触达、营销、成交、支付、合同、发票。

如果知识库后续需要使用真实业务知识或客户上下文，必须先回到本文档定义的前置审查闸门，并拆成单独任务。

## 13. Go / No-Go

| 事项 | 当前结论 | 说明 |
| --- | --- | --- |
| docs-only 前置审查 | GO | 可以继续细化审查清单和验收标准。 |
| mock / seed / demo 输入 | GO | 仍可用于知识库和 UI demo。 |
| 真实 HIS runtime | NO-GO | 必须单独审批，且完成本文闸门。 |
| 真实 credential runtime | NO-GO | 必须先有 credential 生命周期、安全存储和审计方案。 |
| 真实客户数据导入 | NO-GO | 必须先有字段白名单、合规确认和数据处理协议。 |
| schema / migration | NO-GO | 必须单独任务、单独审批。 |
| API / UI / service / repository / adapter | NO-GO | 本任务不授权。 |
| 自动触达 / 预约 / 成交 / 支付 / 合同 / 发票 | NO-GO | 不属于本阶段。 |

## 14. 后续最小任务拆分建议

以下只是候选任务，不是开发许可：

| 候选任务 | 类型 | 目标 | 禁止范围 |
| --- | --- | --- | --- |
| `V1-REAL-DATA-FIELD-WHITELIST-REVIEW-01` | docs-only | 输出真实客户数据字段分类、allowlist、denylist 和脱敏口径。 | runtime、schema、真实数据导入。 |
| `V1-CREDENTIAL-LIFECYCLE-REVIEW-01` | docs-only | 输出 credential 保存、轮换、吊销、审计和错误边界。 | credential provider runtime、真实密钥。 |
| `V1-HIS-READONLY-ADAPTER-CONTRACT-REVIEW-01` | contract-only | 定义未来只读 adapter 契约和拒绝状态。 | 外部网络、真实 adapter、scheduler。 |
| `V1-REAL-DATA-AUDIT-MATRIX-REVIEW-01` | docs-only | 输出真实数据读取、拒绝、失败、运维访问的审计矩阵。 | audit schema、audit runtime。 |
| `V1-REAL-DATA-SAFETY-TEST-PLAN-01` | test-plan-only | 定义 tenant mismatch、RBAC denied、credential invalid、field rejected 等安全测试。 | 生产代码、真实 HIS。 |

## 15. 验收标准

本前置审查完成后，至少应满足：

- 已明确本任务只做 docs-only，不授权 runtime。
- 已明确真实 HIS / credential / 客户数据不能夹带在知识库 UI 或 demo PR 中。
- 已定义 credential 的禁止存放位置、生命周期和审计要求。
- 已定义真实客户数据默认禁止字段和候选低敏字段。
- 已定义 HIS 读取、写入、同步、raw payload、错误和断路边界。
- 已定义 tenant / RBAC / 平台运维访问边界。
- 已定义低敏审计覆盖矩阵候选。
- 已定义产品化低敏失败文案，禁止技术栈、路径、worker、依赖错误、SQL、credential、raw payload 和模型输出泄露。
- 已明确所有后续候选任务都不是开发许可。

## 16. 停止条件

后续执行中遇到以下情况必须立即停止并重新确认：

- 需要新增或修改 `src/**`。
- 需要新增或修改 DB schema、migration、seed、repository、service、adapter、runtime。
- 需要读取、存储、展示或测试真实 credential。
- 需要导入或展示真实客户数据。
- 需要访问真实 HIS 或外部系统。
- 需要启动 dev server 或打开系统预览。
- 需要自动创建任务、预约、触达、营销、成交、支付、合同或发票。
- working tree 出现非当前任务允许的改动。

## 17. 本文档结论

当前可以继续做 mock / seed / demo、docs-only、test-plan-only、contract-only 的低风险准备工作。

当前不能进入真实 HIS、credential、客户数据、API、UI、DB、schema、migration、runtime、service、repository、adapter、外部网络、scheduler、worker、queue、cron 或真实 AI 模型调用。

真实业务要接 HIS 或客户数据时，应先单独完成本文档定义的安全、credential、审计、字段白名单和合规边界审查，再由用户明确授权后进入下一阶段。
