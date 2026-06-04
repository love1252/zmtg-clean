# Clean 项目后续路线建议

> 日期：2026-05-30
> 参考材料：旧项目 `/Users/dongxiaolong/Documents/zmtg-imac/docs/REBUILD_PLAN.md`
> 边界：旧项目只作为功能和业务参考，不直接迁移旧代码。
> 文件名说明：`2026-05-30` 是本路线图最初整理日期，不代表后续状态更新都发生在当天。文件名暂时保留是为了避免破坏 README、历史 PR 和审阅上下文中的引用；如需重命名或拆分路线图，应单独做文档整理 PR。

## 1. 当前 clean 项目已完成阶段

当前 `zmtg-clean` 已经完成以下基础阶段：

- 视觉和入口底座：首页、机构登录、平台登录、机构工作台、平台管理后台首屏。
- Demo 认证闭环：本地 demo 登录、session、退出和入口守卫。
- 应用底座整理：认证 session 类型、机构端和平台端工作台静态配置。
- 租户隔离与 RBAC 第一阶段：服务端访问上下文、角色、资源、动作和默认拒绝策略。
- 租户业务领域模型第二阶段：客户、预约、随访和审计事件的领域模型。
- 租户业务真实落库第三阶段：PostgreSQL、Drizzle schema、seed、仓储和只读 API。
- 租户业务写入第四阶段：客户、预约和随访的受控写入 API、payload 白名单、PII 防护、事务内审计和真实数据库 smoke 验证。
- 机构业务页面真实化第五阶段：客户中心、预约中心、智能随访 / 随访任务已接入现有真实 API。
- 运营页面一致性与 workspace 入口真实化第六阶段：机构工作台首页已基于现有客户、预约、随访 API 派生运营摘要，三大业务页已复用共享页面状态组件，机构端导航已标注已接入 / 后续占位边界。
- 客户详情时间线第七阶段：audit `resource_id` enrich、客户详情 timeline 只读 API、客户详情时间线 UI 和 smoke / 文档收尾已完成。
- 审计日志只读查询第八阶段：审计查询 domain / repository / query parser / API DTO、机构端审计只读 API/UI、平台端审计 API/UI 和 smoke / 文档收尾已完成。
- 平台端租户管理第九阶段：租户套餐 / 配额数据底座、平台端租户只读 API、平台租户管理 UI、入口 smoke 和文档收尾已完成。
- 平台套餐配额 enforcement 第十阶段：内部 quota enforcement helper、客户 / 预约创建 API 阻断、denied 审计、前端稳定错误态、入口 smoke 和文档收尾已完成。
- 平台商业化健康第十一阶段：平台商业化健康 view model / client 派生、平台端只读摘要 UI、配额快照风险 / 配置缺失 / quota denied 信号展示、入口 smoke 和文档收尾已完成。
- 治疗记录结构化摘要第十二阶段：治疗摘要 schema / migration / seed / repository / DTO 白名单、customer timeline API 接入、客户详情抽屉展示、入口 smoke 和文档收尾已完成。
- 治疗摘要人工录入第十三阶段：payload parser、repository create、`treatment_summary` RBAC / audit 决策、POST API route、客户详情抽屉结构化录入 UI、timeline 刷新、入口 smoke 和文档收尾已完成。
- 治疗摘要管理第十四阶段：治疗摘要列表 query parser / repository / DTO / API、机构端治疗摘要管理 UI、筛选、加载更多、安全详情、入口 smoke 和文档收尾已完成。
- 治疗后护理 / 随访联动第十五阶段：确定性护理 / 随访建议规则、`follow_up_tasks` 来源关联、幂等 / 去重、人工确认 API、治疗摘要管理 UI 联动、入口 smoke 和文档收尾已完成。
- 随访任务来源治理增强第十六阶段：`GET /api/institution/followups` 来源筛选、安全来源 DTO、智能随访来源标签 / 来源筛选、治疗摘要管理页重复任务提示、入口 smoke 和文档收尾已完成。
- HIS 接入标准模型 / 标准治疗事件第十七阶段：Phase 17 spec / plan、domain-only 标准治疗事件类型、`sourceSystem` 稳定集合、mapper 输入 / 输出契约、字段白名单、禁止字段边界和 institution 测试已完成。
- 治疗摘要编辑能力第十八阶段：Phase 18 spec / plan、编辑 payload parser、`treatment_summary:update` 最小权限、repository update、PATCH API、机构端受控编辑 UI、入口 smoke 和文档收尾已完成。
- 治疗摘要作废能力第十九阶段：软作废字段、作废 API、作废后随访建议 / 来源任务阻断、机构端状态展示和入口 smoke 已完成。
- 治疗项目路径模板第二十阶段：Phase 20 spec / plan、domain-only catalog、确定性随访建议接入、机构端轻量展示、workspace smoke 和文档收尾已完成。
- 随访路径运营分析第二十一阶段：最小闭环已完成，覆盖 spec / plan、domain-only 口径、审计关联口径补强、只读分析 API、机构端轻量指标展示、workspace smoke 和文档收尾。
- HIS 标准治疗事件 mapper 第二十二阶段：Phase 22 spec / plan、PR 2 契约差异评估、PR 3A 标准事件缺口字段 domain-only 契约补齐、PR 3B mapper 解析器安全测试和 PR 3C 文档 / smoke 收尾已完成，明确 v1 优先保留 Phase 17 `source*` 内部命名，只补 `recoveryStage`、`rawSourceType`、`mappingWarnings`，不接真实 HIS、不保存 raw payload、不做患者身份匹配、自动摘要、自动任务、AI 解析或自动触达。
- 真实 HIS adapter 前置评估 Plan Mode 已完成：只做 docs-only 规划，明确未来接真实 HIS / 机构系统前必须先评估租户绑定、连接配置、凭证安全、Webhook / 同步 / 手动导入、幂等、重试、错误降级、审计、raw payload 默认不保存、字段白名单、患者身份匹配、人工复核、自动摘要 / 自动任务禁止和自动触达禁止边界；尚未进入 adapter 实现、外部连接或真实数据处理。
- 连接配置与凭证边界 Plan Mode 已完成：只做 docs-only 规划，明确未来连接配置字段、凭证类型、凭证明文展示禁止、凭证生命周期、权限可见性、审计事件、错误降级和后续 PR A-G 拆分；尚未进入连接配置实现、凭证存储实现、测试连接实现或真实 HIS adapter。
- 连接配置 schema / API Plan Mode 已完成：只做 docs-only 规划，明确未来连接配置实体字段、API 边界、权限与租户隔离、审计事件、DTO、稳定错误态、凭证引用和后续 PR A-H 拆分；尚未进入 schema / migration、API、凭证存储、测试连接或真实 HIS adapter 实现。
- 连接配置 schema / migration 最小实现已完成：新增 `his_connections` 安全元数据表、状态 / 健康状态枚举、租户外键、租户内索引、软删除连接名唯一约束和 schema / migration 测试；尚未进入 API、repository、凭证存储、测试连接或真实 HIS adapter 实现。
- 连接配置只读 repository 最小实现已完成：新增按可信 `tenantId` 列表读取、按 `tenantId + connectionId` 详情读取、安全 read model、`credentialConfigured` 派生和只读 repository 测试；尚未进入 API、写入 repository、凭证存储、测试连接或真实 HIS adapter 实现。
- 连接配置 list / detail 只读 API 最小实现已完成：新增机构端 `GET /api/institution/his-connections` 与 `GET /api/institution/his-connections/[connectionId]`，只使用服务端 access context 的 `tenantId`，返回安全 DTO，不返回 `credentialRef`、凭证明文或 raw payload；尚未进入写入 API、写入 repository、凭证存储、测试连接或真实 HIS adapter 实现。
- 连接配置只读 UI / workspace 入口轻量实现已完成：机构端新增「HIS 连接配置」只读入口和 `HisConnectionReadOnlyPanel`，只调用现有 list / detail GET API，展示安全摘要、中文状态文案、空态 / 错误态和只读边界，并补充组件测试与 workspace smoke；尚未进入写入 API、凭证管理、测试连接或真实 HIS adapter 实现。
- 连接配置只读 UI smoke / 文档收尾已完成：确认 `his_connections` schema / migration -> 只读 repository -> 机构端 list / detail GET API -> workspace「HIS 连接配置」入口 -> 只读 UI -> 组件测试 / workspace smoke 闭环；现有测试已覆盖入口、只读面板、列表安全摘要、状态 / 健康 / 凭证中文文案、空态、错误态、敏感字段不展示、无写入按钮、不调用外部系统和 demo seed 不修改；后续写入 API、凭证管理、测试连接和真实 HIS adapter 仍未实现，必须单独 Plan Mode / 独立 PR。
- Phase 23 HIS 连接配置写入 API 与状态流转边界 Plan Mode 已完成：只规划未来 create / update / pause / resume / revoke / delete API、写入 repository、权限、审计、状态流转、错误态和数据最小化边界；repository create / update 和状态流转已分阶段完成最小实现，尚未进入写入 API、凭证管理、测试连接或真实 HIS adapter。
- Phase 23 HIS 连接配置状态流转 repository 最小实现已完成：新增 pause / resume / revoke / softDelete repository 方法和状态流转测试，状态方法绑定 `tenantId + connectionId + deletedAt is null`，跨租户 / 不存在 / 已软删除统一 `not_found`；尚未进入写入 API、审计补强、权限补强、凭证管理、测试连接或真实 HIS adapter。
- Phase 23 HIS 连接配置 repository 写入闭环收尾已完成：docs-only 确认 create / update / pause / resume / revoke / softDelete repository、测试覆盖、数据最小化和状态边界已闭环；下一步 API / service 接入前仍需单独处理 HTTP payload parser、权限判断、API 错误映射、审计写入、service 层事务边界和 DTO 数据最小化。
- Phase 23 HIS 连接配置 create / update API v1 Plan Mode 已完成：docs-only 规划未来 create / update API 接入前的 HTTP 载荷解析器、权限判断、服务层事务、审计写入、DTO 数据最小化、错误映射和 API 测试；当前仍未新增 API、route、service、权限、审计实现、凭证管理、测试连接或真实 HIS adapter。
- Phase 23 HIS 连接配置写入 payload parser / DTO helper 已完成：新增 create / update payload parser、最小 DTO helper 和 parser 测试；create / update 只接受 `connectionName`、`sourceSystem`、`vendorType`、`systemType`，拒绝外部 `tenantId`、状态、凭证、raw payload、SQL、stack 和 `DATABASE_URL`；当前仍未新增 API、route、service、权限、审计实现、凭证管理、测试连接或真实 HIS adapter。
- Phase 23 HIS 连接配置写入权限 v1 Plan Mode 已完成：docs-only 规划后续 create / update API 所需写入权限，明确当前 `tenant_admin` 只有 `open_connection:read_own_tenant`，不得复用只读权限放行写入，后续应单独实现 `open_connection:create` 和 `open_connection:update`；当前仍未修改权限实现、未新增 API、未写审计、未处理凭证或真实 HIS adapter。
- Phase 23 HIS 连接配置写入权限模型最小实现已完成：`tenant_admin` 已具备 `open_connection:create` 和 `open_connection:update`，并保留 `open_connection:read_own_tenant`；普通机构人员、顾问、客服、平台角色和审计角色仍默认拒绝写入；当前仍未新增 API、route、service、审计实现、凭证管理、测试连接或真实 HIS adapter。
- Phase 23 HIS 连接配置写入 service v1 Plan Mode 已完成：docs-only 规划后续 create / update service 的可信输入、事务边界、repository 结果映射、审计写入边界、DTO 最小化和 API 错误响应；当前仍未写 service 代码、未新增 API route、未改 parser / repository / 权限 / schema / migration、未写审计实现、未处理凭证或真实 HIS adapter。
- Phase 23 HIS 连接配置写入 service 最小实现已完成：新增 create / update service，在同一事务内编排 repository 写入与成功 allowed audit，返回 `{ ok: true }` 最小 DTO；当前仍未新增 API route、未实现 denied audit、未处理凭证或真实 HIS adapter。
- Phase 23 HIS 连接配置审计 reason 补强 Plan Mode 已完成：docs-only 规划后续 create / update 失败路径 reason，评估 `invalid_his_connection_payload`、`his_connection_name_conflict`、`invalid_his_connection_repository_result` 和 `not_found_or_not_owned` 复用边界；当前仍未修改 audit domain / reason、未实现 denied audit、未新增 API route。
- Phase 23 HIS 连接配置审计 reason 与 service denied audit 最小接入已完成：已补强 `invalid_his_connection_payload`、`his_connection_name_conflict` 并复用 `not_found_or_not_owned`，service 已覆盖 repository 失败路径 denied audit；当前仍未新增 API route、未处理凭证或真实 HIS adapter。
- Phase 23 HIS 连接配置创建更新 API route Plan Mode 已完成：docs-only 规划后续 `POST /api/institution/his-connections` 与 `PATCH /api/institution/his-connections/[connectionId]` 的 access context、权限、parser、service 映射、route denied audit、DTO 和测试边界；当前仍未新增 API route、未修改 `src/**`、未处理凭证或真实 HIS adapter。
- Phase 23 HIS 连接配置状态 API Plan Mode 已完成：docs-only 规划后续 pause / resume / revoke / delete API 的路径、可信输入、权限边界、状态流转、service 边界、审计边界、DTO 最小化和测试拆分；当前仍未新增状态 API route、未修改 `src/**`、未处理凭证、测试连接或真实 HIS adapter。
- 开放平台治理第一阶段：API Key、OAuth、Webhook 和审计的治理词汇、生命周期和安全边界展示。

当前主要缺口：

- 平台端已有只读租户列表、租户状态、套餐 / 配额、用量快照和商业化健康运营摘要；机构端新增客户 / 预约已具备轻量套餐配额 enforcement，但尚未具备租户创建、编辑、删除、冻结 / 恢复、完整套餐商业化后台、计费、支付、合同或发票能力。
- 审计日志只读查询基础版已完成，但导出、告警和复杂风控仍未进入真实实现。
- 治疗记录结构化摘要 v1、治疗摘要人工录入 v1、治疗摘要管理 v1、治疗后护理 / 随访联动 v1、随访任务来源治理增强 v1、标准治疗事件 domain-only 契约、治疗摘要编辑能力 v1、治疗摘要作废能力 v1、治疗项目路径模板 v1 和随访路径运营分析 v1 最小闭环已完成；HIS 标准治疗事件 mapper v1 已完成 Plan Mode、契约差异评估、标准事件缺口字段 domain-only 契约补齐、解析器安全测试和文档 / smoke 收尾，真实 HIS adapter 前置评估、连接配置与凭证边界、连接配置 schema / API 边界、连接配置 schema / migration 最小实现、连接配置只读 repository 最小实现、连接配置 list / detail 只读 API 最小实现、连接配置只读 UI / workspace 入口轻量实现、只读 UI smoke / 文档收尾、Phase 23 写入 API 与状态流转边界 Plan Mode、状态流转 repository 最小实现、repository 写入闭环收尾、写入 payload parser / DTO helper、写入权限 Plan Mode、写入权限模型最小实现、写入 service Plan Mode、写入 service 最小实现、审计 reason 补强、service denied audit 和 create / update API route Plan Mode 也已完成，但尚未进入真实 adapter 实现、连接配置写入 API route 实现、凭证存储 / 加密、测试连接 / 健康检查、Webhook / 同步任务、患者身份匹配、自动摘要或自动任务；随访路径运营分析仍不包含图表、导出、经营智能中心、收入 / 复购 / 转化归因或路径效果分析；真实 HIS 接入、Webhook、文件导入、外部系统同步、完整治疗记录正文、版本历史 / diff 展示、客服会话、知识库、AI、企业微信、开放平台凭证和计费仍未进入真实实现。

## 2. 旧 REBUILD_PLAN.md 中仍有价值的功能

以下旧功能仍有业务价值，适合作为后续产品路线参考：

- 客户详情时间线：统一承载咨询、预约、治疗、随访、客服、消费和标签变更。
- 治疗记录与消费摘要：支撑术后关怀、复诊复购和客户画像。
- 机构端真实业务页面：客户中心、预约中心、智能随访应从演示页面升级为可操作工作台。
- 平台租户管理：开通、冻结、恢复、套餐、配额和状态审计。
- 审计高级治理：审计导出、告警、复杂风控和安全运营流程。
- 知识库和 RAG：文件导入、分块、训练、检索和问答测试。
- AI provider、调用日志和 Agent：形成差异化能力，但需要在业务闭环稳定后推进。
- 企业微信和外部连接器：对商业交付有价值，但必须单独做凭证、回调和审计设计。
- 计费、合同、发票和支付：商业化必要能力，但不能直接复用旧实现。

## 3. 已经被 clean 项目覆盖的功能

以下内容已经在 clean 项目中有了新实现或治理基线，后续不要重复规划：

- 官网和品牌入口基础展示。
- 机构端、平台端双登录入口和 demo session 闭环。
- 机构端、平台端工作台首屏。
- 租户隔离原则、RBAC 权限矩阵和服务端访问上下文。
- 客户、预约、随访、审计领域模型。
- 客户、预约、随访和审计的 PostgreSQL schema、Drizzle 迁移和 seed。
- 客户、预约、随访只读和写入 API。
- 服务端 tenantId 推导、payload 白名单、PII 字段拒绝和数据库错误脱敏。
- 允许、拒绝、目标不存在、非法状态流转和 stale transition 审计。
- 机构端客户中心、预约中心、智能随访 / 随访任务页面真实 API 接入。
- 机构工作台首页真实 API 运营摘要、共享页面状态组件、机构端导航边界和 workspace smoke 测试。
- 客户详情时间线 v1：客户脱敏摘要、预约摘要、随访摘要、结构化时间线和安全审计摘要。
- audit `resource_id` enrich、客户详情 timeline 后端 API 和客户中心详情抽屉。
- 审计日志只读查询基础版：查询 parser、repository、分页 DTO、机构端本租户审计 API/UI、平台端受控审计 API/UI 和入口 smoke。
- 平台端租户管理基础版：租户套餐 / 配额最小 schema、demo seed、repository、domain DTO、`GET /api/open-platform/tenants` 只读 API、平台租户管理 UI 和入口 smoke。
- 套餐配额 enforcement 轻量版：客户 / 预约创建前读取 active plan / quota limit，按当前租户业务表 live count 判断是否允许写入，拒绝时返回稳定 `409`、写 denied 审计并保留前端安全错误态。
- 平台商业化健康只读运营辅助：复用现有平台租户 / 审计 API，派生并展示套餐覆盖、配额快照风险、配置缺失和近期 quota denied 信号，明确“运营参考 / 配额快照”边界。
- 治疗记录结构化摘要 v1：最小 `treatment_summaries` 数据底座、tenant-scoped repository、DTO 白名单、客户详情 timeline API `treatmentSummaries` / `treatment_summary` 节点、客户详情抽屉展示和入口 smoke。
- 治疗摘要人工录入 v1：结构化 payload parser、repository create、`treatment_summary` RBAC / audit 语义、客户子路径 POST API、客户详情抽屉结构化表单、提交后 timeline 刷新和入口 smoke。
- 治疗摘要管理 v1：`GET /api/institution/treatment-summaries`、白名单 query parser、tenant-scoped repository list、安全 DTO、机构端只读管理 UI、筛选、加载更多、安全详情和入口 smoke。
- 治疗后护理 / 随访联动 v1：确定性建议 domain / parser、安全 `suggestionKey`、`follow_up_tasks` 来源关联、同租户幂等 / 去重、建议只读 API、人工确认创建 API、治疗摘要管理 UI 联动和入口 smoke。
- 随访任务来源治理增强 v1：follow-up 来源 query 白名单、安全来源 DTO、当前租户内 `source=treatment_summary` / `sourceTreatmentSummaryId` 筛选、智能随访来源标签 / 来源筛选、治疗摘要管理页同来源活跃任务只读重复提示和入口 smoke。
- HIS 接入标准模型 / 标准治疗事件 v1：Phase 17 spec / plan、domain-only 类型、`sourceSystem` 稳定集合、mapper 输入 / 输出契约、字段白名单、禁止字段边界、外部 `tenantId` 不可信、raw payload 拒绝、不自动生成或修改 `treatment_summaries` 和 institution 测试。
- HIS 标准治疗事件 mapper v1：Phase 22 spec / plan 已规划 `externalEventId`、`externalSource`、`tenantId`、`customerExternalId`、`appointmentExternalId`、`treatmentDate`、`treatmentProject`、`treatmentCategory`、`treatmentStage`、`recoveryStage`、`riskLevel`、`nextCareAction`、`tags`、`rawSourceType` 和 `mappingWarnings` 等字段语义；PR 2 契约差异评估建议内部核心 DTO 继续使用 Phase 17 `sourceSystem`、`sourceEventId`、`sourceCustomerId` 和 `appointmentRef`，`external*` 只作为 adapter 输入层别名或文档映射；PR 3A 已补齐 `recoveryStage`、`rawSourceType` 和 `mappingWarnings` 的 domain-only 契约与单元测试；PR 3B 已补强解析器安全边界回归测试；PR 3C 已补充 mapper domain-only 最小闭环 smoke 与文档收尾，未改解析器 / domain。
- 真实 HIS adapter 前置评估：已完成 docs-only spec / plan，明确 adapter 只应把未来外部系统输入转换为 Phase 22 mapper 可接受的安全输入，不应绕过 mapper 直接写治疗摘要、随访任务或运营分析；raw HIS payload 默认不保存，连接配置、凭证、Webhook / 同步、患者身份匹配、人工复核和真实 PoC 均需后续单独 PR。
- 连接配置与凭证边界：已完成 docs-only spec / plan，明确未来连接配置字段、凭证类型、凭证明文永不返回前端 / 写审计 / 写日志 / 进错误信息 / 进 PR 或 demo seed、凭证生命周期、权限可见性、审计允许和禁止项、错误降级展示边界，以及后续连接配置 schema / API、凭证加密、健康检查、Webhook / 同步和真实 PoC 拆分。
- 连接配置 schema / API 边界：已完成 docs-only spec / plan，明确未来连接配置只能保存安全元数据和 `credentialRef`，`tenantId` 只能来自服务端可信上下文或平台受控选择，API 不返回凭证明文、raw payload、外部系统错误响应全文、SQL、stack 或 `DATABASE_URL`；schema / migration、API 实现、凭证引用集成、测试连接和真实 adapter 均需后续单独 PR。
- 连接配置 schema / migration 最小实现：已新增 `his_connections` 安全元数据表，`tenantId` 关联租户，`credentialRef` 只能是 nullable 引用字段，状态枚举、健康状态枚举、租户内索引、软删除连接名唯一约束和 migration 测试均已落地；API、repository、凭证引用集成、测试连接和真实 adapter 均需后续独立 PR。
- 连接配置只读 repository 最小实现：已新增机构侧只读 repository，读取条件绑定可信 `tenantId`，详情读取绑定 `tenantId + connectionId`，默认过滤软删除记录，返回安全 read model 并派生 `credentialConfigured`；API、写入 repository、凭证引用集成、测试连接和真实 adapter 均需后续独立 PR。
- 连接配置 list / detail 只读 API 最小实现：已新增机构端 list / detail GET route，复用既有 `open_connection:read_own_tenant` 权限，`tenantId` 只来自服务端 access context，list 和 detail 均默认不返回软删除记录，API DTO 不返回 `tenantId`、`deletedAt`、`credentialRef`、凭证明文、raw payload 或外部错误全文；写入 API、写入 repository、凭证引用集成、测试连接和真实 adapter 均需后续独立 PR。
- 连接配置只读 UI / workspace 入口轻量实现：已新增机构端「HIS 连接配置」入口，UI 只调用现有 list / detail 只读 API，只展示安全字段和稳定状态文案，覆盖空态、加载失败、未登录 / 无权限、详情 `not_found`、敏感字段不展示、无写入按钮和无写入 API；写入 API、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置写入 API 与状态流转边界：已完成 docs-only spec / plan，明确未来 create / update 只允许安全元数据，`tenantId` 只来自服务端 access context，`credentialRef` v1 不允许写入也不返回，pause / resume / revoke / delete 必须审计且不代表测试连接或真实 HIS 调用已实现；写入 repository、API 实现、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置写入 repository 边界：已完成 docs-only spec / plan，明确未来 repository 只做可信 `tenantId` 范围内的安全元数据写入和状态机持久化，规划 create / update / pause / resume / revoke / softDelete 方法、输入模型、状态流转、稳定结果、审计衔接和数据最小化；create / update 和状态流转 repository 已分阶段完成最小实现，API 实现、service 实现、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置 create / update repository 最小实现：已新增 `createHisConnectionForTenant` 和 `updateHisConnectionForTenant`，create 固定写入 `draft` / `unknown` 和 actor 字段，update 只允许连接名称、来源系统、厂商类型、系统类型等低风险元数据，写入条件绑定可信租户且默认不可更新软删除记录；状态流转 repository 已由后续 PR C 完成，写入 API、service 实现、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置状态流转 repository 最小实现：已新增 `pauseHisConnectionForTenant`、`resumeHisConnectionForTenant`、`revokeHisConnectionForTenant` 和 `softDeleteHisConnectionForTenant`，覆盖 active / error -> paused、paused -> active、draft / active / paused / error -> revoked、未删除状态 -> deleted，跨租户 / 不存在 / 已软删除统一 `not_found`；写入 API、service 实现、审计补强、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置 repository 写入闭环收尾：已确认 PR #126 / #127 的 repository 测试覆盖 create 默认 `draft / unknown`、create / update 白名单字段、conflict、validation_failed、not_found、pause / resume / revoke / softDelete 状态流转、softDelete 后 list / detail 不可见、敏感字段不写入、无外部系统、无治疗摘要 / 随访任务 / 自动触达和 demo seed 不修改；下一步 API / service 接入必须单独处理 payload parser、权限、错误映射、审计、事务边界和 DTO 最小化。
- Phase 23 HIS 连接配置 create / update API v1 边界：已完成 docs-only spec / plan，明确 create / update API 只处理安全元数据，`tenantId` 只来自服务端 access context，严禁返回 `credentialRef`、凭证、连接串、raw payload、完整请求 / 响应体、SQL、stack 或 `DATABASE_URL`；API route、权限补强、审计实现、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置写入 payload parser / DTO helper：已新增 create / update parser 和最小 DTO helper，parser 只接受普通 JSON object、四个安全元数据字段、trim 后非空字符串和长度限制；DTO helper 只返回四个安全元数据字段；API route、权限实现、审计实现、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置写入权限 v1 边界和最小实现：已完成 docs-only spec / plan，并已为 `tenant_admin` 最小授予 `open_connection:create` 和 `open_connection:update`，同时保留 `open_connection:read_own_tenant`；普通机构人员、顾问、客服、平台角色和审计角色仍默认不具备 create / update，平台代管写入不进入 v1；API route、service 实现、审计实现、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置写入 service v1 边界：已完成 docs-only spec / plan，明确后续 create / update service 只接收服务端 access context、path `connectionId` 和 parser 输出，规划事务内 repository 写入与 allowed audit、repository result 到 HTTP 错误映射、denied audit reason 补强缺口和 DTO 最小化；API route、service 实现、审计 reason 补强、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置写入 service 最小实现和审计 reason Plan Mode：service 已最小实现 create / update 事务编排与成功 allowed audit；审计 reason 补强已规划 payload 非法、连接名冲突、repository validation_failed 和 not found 复用边界；API route、route 层 denied audit、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置审计 reason 与 service denied audit：已最小补强 reason 并接入 service repository 失败路径 denied audit；route 层权限拒绝、parser 失败、HTTP 映射和 API route 测试仍需后续独立 PR，不处理凭证、测试连接或真实 adapter。
- Phase 23 HIS 连接配置创建更新 API route Plan Mode：已完成 docs-only spec / plan，明确后续 POST / PATCH route 的 access context、权限判断、parser、service result 映射、route denied audit、DTO 和错误响应边界；API route 实现、route tests、状态流转 API、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置状态 API Plan Mode：已完成 docs-only spec / plan，明确后续 pause / resume / revoke / delete API 路径、可信输入、权限边界、状态流转、service 边界、审计边界、DTO 最小化和测试拆分；状态 API 权限、service、route、route tests、审计补强、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置状态权限 Plan Mode：已完成 docs-only spec / plan，明确 v1 推荐 pause / resume / revoke 使用 `open_connection:manage_status`，delete / softDelete 使用 `open_connection:delete`；默认仅 `tenant_admin` 可写，其他机构角色、平台角色和审计角色默认拒绝，平台代管写入不进入 v1；状态 API 权限实现、service、route、route tests、审计补强、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- Phase 23 HIS 连接配置状态 service Plan Mode：已完成 docs-only spec / plan，明确后续 pause / resume / revoke / delete / softDelete service 的推荐导出函数、可信输入、repository command 最小化、事务内 repository 写入与 audit 写入、稳定 result、HTTP 映射参考、成功 `{ ok: true }` DTO 和测试拆分；状态 service 实现、状态 API route、route tests、审计补强、凭证管理、测试连接和真实 adapter 均需后续独立 PR。
- 治疗摘要编辑能力 v1：编辑 payload parser、`treatment_summary:update` 最小权限、tenant-scoped repository update、`PATCH /api/institution/treatment-summaries/[summaryId]`、机构端受控编辑 UI、成功刷新列表 / 详情、失败保留输入、审计和入口 smoke。
- 治疗项目路径模板 v1：首批光子 / 光电治疗、水光 / 注射护理、术后修复和皮肤管理的 domain-only catalog，确定性随访建议接入模板，机构端轻量展示路径类型 / 建议处理角色 / 人工确认边界，人工确认来源任务、重复治理、作废阻断和 smoke / 文档收尾。
- 随访路径运营分析 v1：基于治疗摘要、路径模板建议、来源随访任务、任务状态和审计记录的最小聚合口径、审计关联补强、机构端只读 API、轻量指标展示和 workspace smoke / 文档收尾。
- 开放平台 API Key、OAuth、Webhook 生命周期和安全治理词汇。

## 4. 不建议迁移的旧功能

以下旧功能或实现不建议迁移到 clean 项目：

- 旧平台巨型 `OpenPlatform.tsx`。
- `data/*.json` 作为生产状态存储。
- Supabase 链式兼容层和多套数据访问方式并存的旧结构。
- 前端传入 `tenantId`、localStorage 租户 fallback 或 header-based auth。
- 独立的旧版 `/homepage-editor`。
- 生产路径里的 demo/fallback 登录。
- 支付、Webhook、OAuth、API Key 旧代码。
- 页面组件内大量 mock、fetch、业务判断和静态指标混杂的实现方式。
- 客服、AI、企微、旅程画布的旧代码。可以参考交互和业务语义，但不应直接复制。

## 5. 建议加入当前项目的功能清单

建议进入后续路线的功能：

- 治疗记录模块：结构化摘要 v1、租户隔离、人工录入 v1、只读管理 v1、治疗后护理 / 随访联动 v1、随访任务来源治理增强 v1、标准治疗事件 domain-only 契约、治疗摘要编辑能力 v1、治疗摘要作废能力 v1、治疗项目路径模板 v1、随访路径运营分析 v1 最小闭环、HIS 标准治疗事件 mapper v1 Plan Mode / 契约差异评估 / 缺口字段 domain-only 契约 / 解析器安全测试 / 文档 smoke 收尾、真实 HIS adapter 前置评估、连接配置与凭证边界、连接配置 schema / API Plan Mode、连接配置 schema / migration 最小实现、连接配置只读 repository 最小实现、连接配置 list / detail 只读 API 最小实现、连接配置只读 UI / workspace 入口轻量实现、Phase 23 写入 API 与状态流转边界 Plan Mode、Phase 23 写入 repository 边界 Plan Mode、Phase 23 create / update repository 最小实现、Phase 23 状态流转 repository 最小实现、Phase 23 repository 写入闭环收尾、Phase 23 写入 parser / 权限 / service / audit reason / service denied audit 和 Phase 23 create / update API route Plan Mode 均已完成；后续版本历史 / diff 展示、客服会话联动、完整治疗记录能力、真实 HIS adapter spec / plan、连接配置写入 / 状态 API 实现、凭证加密与密钥管理、连接健康检查 / 测试连接、Webhook / 同步任务、患者身份匹配、人工复核 / 预览、adapter domain-only 输入 DTO / parser、路径模板 schema / API、随访路径图表 / 导出 / 归因 / 路径效果分析和外部系统接入需单独规划，仍不保存完整病历正文。
- 平台租户后续能力：租户创建、状态变更审计、完整套餐商业化后台、计费、合同、发票和支付。
- 审计高级治理：只读查询基础版之后再单独评估导出、告警和复杂风控。
- 套餐权益与配额 enforcement：客户数和预约数创建阻断已完成轻量版，后续可单独评估员工数、随访任务、AI 调用、严格一致计数器和套餐变更流程。
- 知识库基础版：文件、分块、训练状态和检索测试。
- AI provider 与调用日志：模型启用、租户级配置、限流和成本记录。
- 企业微信连接器：扫码绑定、回调验签、客户同步和消息发送。
- 计费订单：套餐订单、合同、发票和支付事件。

## 6. 下一阶段优先级

推荐优先级：

1. 产品可演示性验收：优先完整走查机构端客户中心、治疗摘要创建 / 编辑 / 作废、路径模板随访建议、来源任务追溯、客户 timeline 和平台端只读治理页面，确认 Phase 5-20 是否已经能支撑一次稳定演示。
2. Phase 20 后续扩展评估：治疗项目路径模板 v1 已完成最小闭环；后续如需 schema / API、租户自定义 SOP、路径编辑器、平台端模板管理、HIS、企微、AI 或自动触达，必须单独进入 Plan Mode。
3. HIS 标准治疗事件 mapper / 真实 HIS adapter 后续评估：Phase 22 已完成 Plan Mode、契约差异评估、缺口字段 domain-only 契约补齐、解析器安全测试和文档 / smoke 收尾；真实 HIS adapter 前置评估、连接配置与凭证边界、连接配置 schema / API Plan Mode、连接配置 schema / migration 最小实现、连接配置只读 repository 最小实现、连接配置 list / detail 只读 API 最小实现、连接配置只读 UI / workspace 入口轻量实现、Phase 23 写入 API 与状态流转边界 Plan Mode、Phase 23 写入 repository 边界 Plan Mode、Phase 23 create / update repository 最小实现、Phase 23 状态流转 repository 最小实现、Phase 23 repository 写入闭环收尾、写入 parser / 权限 / service / audit reason / service denied audit 和 create / update API route Plan Mode 也已完成。后续如进入 adapter spec / plan、连接配置写入 / 状态 API 实现、凭证引用集成、凭证加密与密钥管理、连接健康检查 / 测试连接、Webhook / 同步任务、患者身份匹配、人工复核 / 预览、adapter domain-only 输入 DTO / parser、治疗摘要创建来源治理或真实外部系统接入 PoC，仍需单独规划，不接真实 HIS、不保存 raw payload、不自动摘要、不自动任务、不自动触达。
4. 业务事件埋点体系 spec：只做事件模型规划，不做真实采集，不记录 raw payload、完整医疗正文或 PII。
5. 随访路径运营分析 v1：Phase 21 最小闭环已完成；后续如进入图表、导出、经营归因、路径效果分析、历史趋势或指标落库，必须单独进入 Plan Mode，不做自动触达。
6. follow-up 配额 enforcement：单独评估是否将 Phase 15 的人工确认创建接入 `maxFollowUps`。
7. 平台租户状态管理、更多资源配额 enforcement 与完整套餐商业化后台规划。
8. 审计高级治理：导出、告警和复杂风控。
9. 知识库 / RAG 基础版，优先元数据规划，不保存医疗隐私正文。
10. 客服会话和完整治疗记录能力。
11. AI provider、调用日志和 Agent。
12. 企业微信、Webhook、OAuth、API Key。
13. 计费、合同、发票和支付。

## 7. 高风险模块提醒

以下模块必须单独进入 Plan Mode，不能混入普通页面开发：

- 治疗记录和病历相关字段：涉及医疗敏感信息和隐私边界。
- 知识库/RAG：涉及文件解析、embedding、检索命中、内容安全和成本控制。
- AI provider 和 Agent：涉及租户级密钥、调用日志、限流、提示词注入和人工接管。
- 企业微信和外部连接器：涉及凭证加密、回调验签、幂等、重试和审计。
- API Key、OAuth、Webhook：涉及签名、token 生命周期、scope、撤销和重放保护。
- 计费、合同、发票和支付：涉及金额、回调签名、幂等、财务状态和外部支付平台。

## 8. Phase 5 建议范围

Phase 5 建议聚焦“机构业务页面真实化”，不要混入 AI、企微、支付、OAuth 或 Webhook。

建议包含：

- 客户中心从演示数据改为读取 `/api/institution/customers`。
- 预约中心从演示数据改为读取 `/api/institution/appointments`。
- 智能随访从演示数据改为读取 `/api/institution/followups`。
- 为客户和预约补充基础创建/更新表单，复用第四阶段写入 API。
- 为随访补充状态流转操作，复用现有状态机和 PATCH API。
- 展示加载、空数据、未登录、无权限、数据库不可用和提交失败状态。
- 保持页面只处理脱敏展示字段，不新增真实手机号、身份证、完整病历或咨询对话字段。
- 保留审计写入链路，并补充页面交互层测试。

暂不包含：

- 治疗记录。
- 客户详情完整时间线。
- 真实认证系统。
- AI、知识库、Agent。
- 企业微信、开放平台凭证、Webhook、OAuth。
- 计费、合同、发票和支付。

Phase 5 的成功标准：

- 机构端三个核心页面能基于真实 API 展示 seed 数据。
- 客户和预约基础写入能从 UI 到数据库闭环。
- 随访状态流转能从 UI 到数据库闭环。
- 所有请求继续使用服务端租户上下文。
- 错误提示稳定，不泄露连接串、SQL 或凭证明文。
- 相关测试覆盖页面状态、API 调用和权限边界。

状态更新：

- Phase 5 已完成并合并，客户中心、预约中心、智能随访 / 随访任务已接入现有真实 API。
- Phase 6 已完成运营页面一致性与 workspace 入口真实化：工作台首页、客户中心、预约中心、智能随访为已接入页面，客服工作台、知识库、数据分析仍为后续占位。
- Phase 6 未新增 API、数据库 schema、migration、权限、认证或租户隔离能力，未进入 AI、知识库真实功能、企业微信、开放平台凭证、支付、合同、发票、套餐权益 enforcement、平台租户管理真实功能或治疗记录完整正文。
- Phase 7 已完成客户详情时间线 v1：最小 audit `resource_id` enrich、客户详情 timeline API、客户中心“查看详情”入口、右侧时间线抽屉、workspace / customer detail smoke 和文档收尾均已完成。
- Phase 7 未完成也未进入审计日志完整查询页面、完整治疗记录、完整病历正文、咨询对话全文、AI / RAG / Agent、企业微信、OAuth、Webhook、支付、平台租户管理或套餐权益 enforcement。
- Phase 8 已完成审计日志只读查询基础版：审计查询底层能力、机构端审计 API/UI、平台端审计 API/UI、入口 smoke 和文档收尾均已完成。
- Phase 8 未新增 schema / migration，未改权限、认证或租户隔离模型，未进入审计导出、告警、复杂风控、平台租户管理、治疗记录、AI / RAG / Agent、企业微信、OAuth、Webhook、支付或套餐权益 enforcement。
- Phase 9 已完成平台端租户管理基础版：租户套餐 / 配额数据底座、配额快照、demo seed、repository / domain DTO、平台端租户只读 API、平台租户管理 UI、入口 smoke 和文档收尾均已完成。
- Phase 9 未改权限、认证或租户隔离模型，未做租户创建 / 编辑 / 删除 / 冻结 / 恢复、套餐 enforcement、计费、支付、合同、发票、客户 / 预约 / 随访业务明细下钻、治疗记录、AI / RAG / Agent、企业微信、OAuth、Webhook 或 API Key。
- Phase 10 已完成平台套餐配额 enforcement 轻量版：内部 quota enforcement helper、active plan / quota limit 读取、客户和预约按租户 live count、客户创建阻断、预约创建阻断、denied 审计、前端稳定错误态、workspace smoke 和文档收尾均已完成。
- Phase 10 未改数据库 schema / migration，未改权限、认证或租户隔离模型，未做套餐购买 / 变更 / 续费、支付、合同、发票、租户创建 / 编辑 / 删除 / 冻结 / 恢复、完整套餐商业化后台、治疗记录、AI / RAG / Agent、企业微信、OAuth、Webhook 或 API Key。
- Phase 11 已完成平台商业化健康只读运营辅助：Phase 11 spec / plan、平台商业化健康 view model / client 派生逻辑、平台租户管理商业化健康 UI、workspace smoke 和文档收尾均已完成。
- Phase 11 复用现有 `GET /api/open-platform/tenants` 和 `GET /api/open-platform/audit-events`，未新增 API，未新增数据库 schema / migration，未改权限、认证或租户隔离模型，未改 Phase 10 enforcement。
- Phase 11 页面明确 `tenant_quota_snapshots.current*` 仅为配额快照 / 运营参考，不作为强一致计费、创建拦截或 live enforcement 依据；UI 和 smoke 均确认不展示客户 / 预约 / 随访业务明细、治疗记录、病历正文、咨询对话、PII、SQL、stack、token、secret、`DATABASE_URL` 或连接串。
- Phase 11 未做套餐购买 / 变更 / 续费、支付、合同、发票、租户冻结 / 恢复、自动升级套餐、自动触达客户或租户、治疗记录、AI / RAG / Agent、企业微信、OAuth、Webhook 或 API Key。
- Phase 12 已完成治疗记录结构化摘要 v1：Phase 12 spec / plan、`treatment_summaries` schema / migration / seed / repository / DTO 白名单、customer timeline API `treatmentSummaries` 与 `treatment_summary` 事件、客户详情抽屉 UI、workspace smoke 和文档收尾均已完成。
- Phase 12 未保存或展示完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、手机号原文、身份证号、病历号原文、图片 / 文件原文、AI 生成内容、外部系统同步原文、SQL、stack、token、secret、`DATABASE_URL` 或连接串。
- Phase 12 未新增独立治疗 API，未新增治疗写入 UI，未改权限、认证或租户隔离模型，未进入 AI provider、AI 生成治疗建议、Agent、RAG、企微、HIS / CRM / OTA、OAuth、Webhook、支付、合同、发票或外部系统同步。
- Phase 13 已完成治疗摘要人工录入 v1：Phase 13 spec / plan、治疗摘要写入 payload parser、repository create、`treatment_summary` RBAC / audit 决策、`POST /api/institution/customers/[customerId]/treatment-summaries`、客户详情抽屉结构化录入 UI、提交后 timeline 刷新、workspace smoke 和文档收尾均已完成。
- Phase 13 未保存或展示完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、手机号原文、身份证号、病历号原文、图片 / 文件原文、AI 生成内容、外部系统同步原文、SQL、stack、token、secret、`DATABASE_URL` 或连接串。
- Phase 13 未新增数据库 schema / migration，未改认证或租户隔离模型，未进入治疗摘要管理 / 编辑、完整治疗记录正文、图片 / 文件上传、AI provider、AI 生成治疗建议、Agent、RAG、企微、HIS / CRM / OTA、OAuth、Webhook、支付、合同、发票或外部系统同步。
- Phase 14 已完成治疗摘要管理能力 v1：Phase 14 spec / plan、治疗摘要列表 query parser、repository list、`GET /api/institution/treatment-summaries`、安全 DTO、机构端治疗摘要管理 UI、筛选、加载更多、安全详情、workspace smoke 和文档收尾均已完成。
- Phase 14 未新增数据库 schema / migration，未改权限、认证或租户隔离模型，未进入治疗摘要新增 / 编辑 / 删除、完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件上传、AI provider、AI 生成治疗建议、Agent、RAG、企微、HIS / CRM / OTA、OAuth、Webhook、支付、合同、发票或外部系统同步。
- Phase 15 已完成治疗后护理 / 随访联动 v1：Phase 15 spec / plan、确定性护理 / 随访建议 domain / parser、`follow_up_tasks` 来源关联和幂等 / 去重、人工确认 API、治疗摘要管理 UI 联动、workspace smoke 和文档收尾均已完成。
- Phase 15 未进入 AI provider、AI 生成护理建议、Agent、RAG、企微、短信、电话外呼、自动触达客户、HIS / CRM / OTA、OAuth、Webhook、支付、完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件原文或外部系统同步。
- Phase 16 已完成随访任务来源治理增强 v1：Phase 16 spec / plan、follow-up 来源筛选、安全来源 DTO、智能随访来源标签 / 来源筛选、治疗摘要管理页同来源活跃任务重复提示、workspace smoke 和文档收尾均已完成。
- Phase 16 未新增 API route，未改数据库 schema / migration，未改权限、认证或租户隔离模型，未改随访任务创建逻辑，未进入治疗摘要编辑 / 作废、自动创建随访任务、自动触达客户、AI provider、Agent、RAG、企微、短信、电话外呼、HIS / CRM / OTA、OAuth、Webhook、支付、完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件原文或外部系统同步。
- Phase 17 已完成 HIS 接入标准模型 / 标准治疗事件 v1：Phase 17 spec / plan、domain-only 标准治疗事件类型、`sourceSystem` 稳定集合、mapper 输入 / 输出契约、字段白名单、禁止字段边界、外部 `tenantId` 不可信、raw payload 拒绝、不自动生成或修改 `treatment_summaries`、institution 测试和文档收尾均已完成。
- Phase 17 未新增 API route，未新增数据库 schema / migration，未改权限、认证或租户隔离模型，未进入真实 HIS 接入、Webhook、文件导入、外部系统同步、UI、企业微信 / 个人微信、AI / RAG / Agent、业务事件埋点实现、经营智能中心实现、完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件原文或自动触达。
- Phase 18 已完成治疗摘要编辑能力 v1：Phase 18 spec / plan、编辑 payload parser、`treatment_summary:update` 最小权限、`updateTreatmentSummaryByTenant`、`PATCH /api/institution/treatment-summaries/[summaryId]`、机构端治疗摘要编辑 UI、workspace smoke 和文档收尾均已完成。
- Phase 18 编辑请求只允许白名单结构化字段，服务端从 access context 推导 `tenantId`，不接受外部 `tenantId` / `customerId` 更新，`appointmentId` 更新前校验同租户且属于同一 customer，成功返回安全 DTO 并写 allowed audit。
- Phase 18 未新增数据库 schema / migration，未改认证或租户隔离模型，未进入治疗摘要删除 / 作废、版本历史、diff 展示、完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件上传、AI provider、Agent、RAG、企业微信、真实 HIS / CRM / OTA 接入、OAuth、Webhook、支付、合同、发票或外部系统同步。
- Phase 19 已完成治疗摘要作废能力 v1：Phase 19 spec / plan、nullable 作废字段、Drizzle migration、domain / DTO `status` 派生、作废原因 parser、`voidTreatmentSummaryByTenant`、作废 audit reason、`POST /api/institution/treatment-summaries/[summaryId]/void`、作废后随访建议 / 来源任务创建阻断、机构端列表 / 详情 / 客户 timeline / 来源任务提示和 workspace smoke / 文档收尾均已完成。
- Phase 19 作废不是删除：不硬删除治疗摘要，不删除客户时间线，不删除来源随访任务；已存在来源随访任务不自动取消、不自动修改状态，仍保留来源追溯。
- Phase 19 未进入批量作废、版本历史、diff 展示、自动触达客户、完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件上传、AI provider、Agent、RAG、企业微信、真实 HIS / CRM / OTA 接入、OAuth、Webhook、支付、合同、发票或外部系统同步。
- Phase 20 治疗项目路径模板 v1 已完成：spec / plan、domain-only 静态模板 catalog、保守 matcher、确定性随访建议接入、机构端模板建议轻量展示、workspace smoke 和文档收尾均已完成。
- Phase 20 v1 首批覆盖光子 / 光电治疗、水光 / 注射护理、术后修复和皮肤管理；路径模板建议继续只基于结构化字段生成内部随访建议，人工确认后才创建来源任务，并保留重复来源任务治理和作废摘要阻断。
- Phase 20 v1 未新增 API route，未改 DTO、数据库 schema / migration、权限、认证或租户隔离，未接 HIS / 企微 / AI / RAG / Agent，未做自动触达，未修改 demo seed 数据。
- 后续如需路径模板 schema / API、租户自定义模板、路径编辑器、平台端模板管理、HIS 输入、企微触达、AI 生成建议、自动触达或路径效果分析，必须单独 Plan Mode。
- Phase 21 随访路径运营分析 v1 最小闭环已完成：spec / plan、domain-only 口径、审计口径核对、作废摘要阻断 audit 关联补强、重复来源任务冲突 audit 关联补强、只读分析 API、机构端轻量指标展示、workspace smoke 和文档收尾均已完成。
- Phase 21 v1 基于现有治疗摘要、路径模板建议、来源随访任务、任务状态和审计记录，提供模板建议数、人工确认任务数、任务完成数、任务超时数、作废摘要阻断数和重复来源任务冲突数六个最小聚合指标。
- `GET /api/institution/follow-up-path-analysis` 只读返回聚合指标、notes / warnings 和边界说明；机构端工作台只轻量展示指标，不展示客户明细、任务列表、治疗正文、病历正文、咨询全文、图片 / 文件原文或 raw audit payload。
- Phase 21 v1 未新增数据库 schema / migration，未改权限、认证或租户隔离，未接 HIS / 企微 / AI / RAG / Agent，未做自动触达，未做复杂经营智能中心、图表 UI、报表导出、收入 / 复购 / 转化归因或 demo seed 修改。
- 后续如需分析指标落库、历史趋势、报表 API、图表 UI、导出、经营归因、路径效果分析或外部系统接入，必须单独进入 Plan Mode。
- Phase 22 HIS 标准治疗事件 mapper v1 已完成 Plan Mode：新增 spec / plan 文档，规划未来 HIS / 机构系统治疗事件映射为内部标准治疗事件结构的目标、建议字段、mapping warning、与治疗摘要 / 路径模板 / 随访建议 / 来源任务 / 运营分析的关系和后续 PR 拆分。
- Phase 22 PR 2 标准事件 mapper 契约差异评估已完成 docs-only 结论：v1 优先保留 Phase 17 既有 `sourceSystem`、`sourceEventId`、`sourceCustomerId` 和 `appointmentRef` 内部命名，避免同时存在 `source*` 和 `external*` 两套同义核心 DTO 字段；后续优先只补 `recoveryStage`、`rawSourceType` 和 `mappingWarnings`。
- Phase 22 PR 3A 标准事件缺口字段 domain-only 契约已补齐 `recoveryStage`、`rawSourceType` 和 `mappingWarnings`，覆盖 mapper 解析器和单元测试，仍不新增或修改 API，不改数据库 schema / migration，不改权限、认证或租户隔离，不接真实 HIS / 机构系统 / 企微 / AI / RAG / Agent，不导入真实客户数据，不保存 raw HIS payload、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文，不做患者身份匹配、自动创建治疗摘要、自动创建随访任务、AI 解析、自动触达、经营智能中心、图表或导出。
- Phase 22 PR 3B mapper 解析器与安全测试收尾已补强 `recoveryStage`、`rawSourceType`、`mappingWarnings` 的空值、敏感内容、非法值、未知告警代码、外部调用和数据库写入禁止测试；解析器 / domain 无需改动，仍不新增 API、schema / migration、权限、UI、真实 HIS、AI、自动摘要、自动任务或自动触达。
- Phase 22 PR 3C 标准治疗事件 mapper 文档 / smoke 收尾已补充 domain-only 最小闭环 smoke，确认新增字段输出、`source*` 命名保留、`external*` 核心字段拒绝、context 可信边界、`mappingWarnings` 安全代码、无外部调用、无数据库写入、无治疗摘要 / 随访任务创建和无自动触达；仍不新增 API、schema / migration、权限、UI、真实 HIS、企微、AI、患者身份匹配、自动摘要、自动任务或自动触达。
- 真实 HIS adapter 前置评估 Plan Mode 已完成：新增 spec / plan 文档，明确当前不是 adapter 实现，不连接真实 HIS，不保存 raw HIS payload，不导入真实客户数据，不新增 API，不改 schema / migration，不改权限、认证或租户隔离；后续建议拆为真实 adapter spec / plan、连接配置与凭证边界、Webhook / 同步任务、患者身份匹配、人工复核 / 标准事件预览、adapter domain-only 输入 DTO / parser 和真实外部系统接入 PoC。
- 连接配置与凭证边界 Plan Mode 已完成：新增 spec / plan 文档，明确当前不是连接配置实现、凭证存储实现、测试连接实现或 HIS adapter 实现，不连接真实 HIS，不保存真实凭证，不新增 API，不改 schema / migration，不改权限、认证或租户隔离；后续建议拆为连接配置 schema / API、凭证加密与密钥管理、连接健康检查 / 测试连接、Webhook / 同步任务、真实 HIS adapter PoC 和真实外部系统接入 PoC。
- 连接配置 schema / API Plan Mode 已完成：新增 spec / plan 文档，明确当前不是 schema 实现、migration、API 实现、凭证存储、测试连接或 HIS adapter；规划未来字段、机构端 / 平台端 API 边界、权限与租户隔离、审计事件、DTO、错误态、凭证引用和后续 PR A-H 拆分；仍不保存 raw HIS payload 或真实凭证，不新增 API，不改 schema / migration，不改权限、认证或租户隔离。
- 连接配置 schema / migration 最小实现已完成：新增 `his_connections` 表、状态 / 健康状态枚举、租户外键、租户内索引、软删除连接名唯一约束和 schema / migration 测试；仍不保存 raw HIS payload 或真实凭证，不新增 API / repository，不改权限、认证或租户隔离，不修改 demo seed。
- 连接配置只读 repository 最小实现已完成：新增 `his-connection-repository` 和 repository 测试，支持可信 `tenantId` 列表读取、`tenantId + connectionId` 详情读取、软删除过滤、安全 read model 和 `credentialConfigured` 派生；仍不新增 API / 写入 repository，不改权限、认证或租户隔离，不保存 raw payload 或真实凭证，不修改 demo seed。
- 连接配置 list / detail 只读 API 最小实现已完成：新增机构端 `GET /api/institution/his-connections` 与 `GET /api/institution/his-connections/[connectionId]`、安全 DTO 和 API route 测试；仍不新增 schema / migration，不做写入 API / 写入 repository，不改权限、认证或租户隔离，不返回 raw payload、`credentialRef` 或真实凭证，不修改 demo seed。
- 连接配置只读 UI / workspace 入口轻量实现已完成：新增机构端「HIS 连接配置」入口、`HisConnectionReadOnlyPanel`、组件测试和 workspace smoke，UI 只调用既有 list / detail GET API，只展示安全摘要字段、中文状态文案、凭证是否已配置、空态 / 稳定错误态、详情 `not_found` 和只读边界；仍不新增 API / schema / migration，不改权限 / 认证 / 租户隔离，不做写入 API、凭证管理、测试连接或真实 HIS adapter，不返回或展示 raw payload、`credentialRef` 或真实凭证。
- 连接配置只读 UI smoke / 文档收尾已完成：确认 schema、repository、API、UI 和 workspace smoke 已形成只读闭环，现有 smoke 已覆盖安全摘要、状态中文文案、健康状态中文文案、凭证已配置 / 未配置、空态、加载失败、敏感字段不展示、无写入按钮、不调用 HIS / 企微 / AI / RAG / Agent 和不修改 demo seed；仍不做 create / update / pause / resume / revoke API、凭证管理、测试连接、真实 HIS adapter 或任何写入能力。
- Phase 23 HIS 连接配置写入 API 与状态流转边界 Plan Mode 已完成：新增 spec / plan 文档，只规划未来 create / update / pause / resume / revoke / delete API、写入 repository、权限、审计、状态流转、错误态和数据最小化；仍不写代码、不新增 API、不做写入 repository、不改 schema / migration、不改权限、认证或租户隔离，不处理凭证明文、不返回 `credentialRef`、不做测试连接、不接真实 HIS。
- Phase 23 HIS 连接配置写入 repository 边界 Plan Mode 已完成：新增 spec / plan 文档，只规划未来 create / update / pause / resume / revoke / softDelete repository 方法、输入模型、状态流转、租户边界、审计衔接、稳定结果和数据最小化；仍不写代码、不改测试、不新增 repository 方法、不新增 API、不改 schema / migration、不改权限、认证或租户隔离，不处理凭证、不做测试连接、不接真实 HIS。
- Phase 23 HIS 连接配置 create / update repository 最小实现已完成：新增 repository create / update 最小写入能力和测试；状态 repository 已由后续 PR C 完成；仍不新增 API、不改 schema / migration、不改权限 / 认证 / 租户隔离，不处理凭证、不做测试连接、不接真实 HIS、不修改 demo seed。
- Phase 23 HIS 连接配置状态流转 repository 最小实现已完成：新增 repository pause / resume / revoke / softDelete 最小状态流转能力和测试；仍不新增 API、不写审计、不改 schema / migration、不改权限 / 认证 / 租户隔离，不处理凭证、不做测试连接、不接真实 HIS、不修改 demo seed。
- Phase 23 HIS 连接配置 repository 写入闭环收尾已完成：docs-only 确认 repository 写入方法、现有测试覆盖、数据最小化、状态边界和 API / service 前置事项；仍不新增 API、不新增 repository 方法、不改生产 repository、不写审计、不处理凭证、不做测试连接、不接真实 HIS、不修改 demo seed。
- Phase 23 HIS 连接配置创建更新 API route Plan Mode 已完成：新增 spec / plan 文档，只规划后续 `POST /api/institution/his-connections` 和 `PATCH /api/institution/his-connections/[connectionId]` 的服务端 access context、写入权限、parser、service result 映射、route denied audit、DTO 和测试边界；仍不新增 API、不修改 `src/**`、不处理凭证、不做测试连接、不接真实 HIS、不修改 demo seed。
- Phase 23 HIS 连接配置状态 API Plan Mode 已完成：新增 spec / plan 文档，只规划后续 pause / resume / revoke / delete API 的路径、可信输入、权限边界、状态流转、service 边界、审计边界、DTO 最小化和测试拆分；仍不新增 API、不修改 `src/**`、不处理凭证、不做测试连接、不接真实 HIS、不修改 demo seed。
