# 智美天工 Clean

智美天工 Clean 是一套重新搭建的 AI 驱动医美智能运营中台。它以旧项目为功能参考，但不直接继承旧项目的临时代码、mock 降级逻辑、巨型页面和混乱数据源。

## 当前范围

当前已经完成：

- 官网首页
- 机构登录页与本地演示登录
- 平台登录页与本地演示登录
- 机构工作台首屏
- 平台管理后台首屏
- 租户隔离与 RBAC 权限底座
- 客户、预约、随访和审计领域模型
- PostgreSQL + Drizzle 真实落库基础
- 客户、预约、随访只读和受控写入 API
- 机构端客户中心、预约中心、智能随访接入真实 API
- Phase 6：机构工作台首页真实 API 摘要、共享页面状态组件、机构端导航边界和 workspace smoke 测试
- Phase 7：客户详情时间线 v1，包括 audit `resource_id` enrich、timeline 后端 API、客户中心详情抽屉和 smoke 覆盖
- Phase 8：审计日志只读查询基础版，包括底层查询能力、机构端审计 API/UI、平台端审计 API/UI 和 smoke / 文档收尾
- Phase 9：平台端租户管理基础版，包括租户套餐 / 配额数据底座、平台端租户只读 API、租户管理 UI 和 smoke / 文档收尾
- Phase 10：平台套餐配额 enforcement 轻量版，包括配额 helper、客户 / 预约创建 API 阻断、前端稳定错误态和 smoke / 文档收尾
- Phase 11：平台商业化健康只读运营辅助，包括商业化健康派生逻辑、平台端摘要 UI、配额快照风险 / 配置缺失 / quota denied 信号展示和 smoke / 文档收尾
- Phase 12：治疗记录结构化摘要 v1，包括治疗摘要数据底座、客户详情 timeline API 接入、客户详情抽屉展示和 smoke / 文档收尾
- Phase 13：治疗摘要人工录入 v1，包括 payload parser、repository create、`POST /api/institution/customers/[customerId]/treatment-summaries`、客户详情抽屉结构化录入 UI、timeline 刷新和 smoke / 文档收尾
- Phase 14：治疗摘要管理能力 v1，包括 `GET /api/institution/treatment-summaries`、query parser、repository list、DTO 白名单、机构端治疗摘要管理 UI、筛选、加载更多、安全详情和 smoke / 文档收尾
- Phase 15：治疗后护理 / 随访联动 v1，包括确定性护理 / 随访建议规则、`follow_up_tasks` 来源关联、幂等 / 去重、人工确认 API、治疗摘要管理 UI 联动和 smoke / 文档收尾
- Phase 16：随访任务来源治理增强 v1，包括 follow-up 来源筛选、安全来源 DTO、智能随访来源标签 / 来源筛选、治疗摘要管理页重复任务提示和 smoke / 文档收尾
- Phase 17：HIS 接入标准模型 / 标准治疗事件 v1，包括 spec / plan 文档、domain-only 标准治疗事件类型、`sourceSystem` 稳定集合、mapper 输入 / 输出契约、字段白名单、禁止字段边界和 institution 测试
- Phase 18：治疗摘要编辑能力 v1，包括 spec / plan 文档、编辑 payload parser、`treatment_summary:update` 最小权限、repository update、`PATCH /api/institution/treatment-summaries/[summaryId]`、机构端受控编辑 UI、入口 smoke 和文档收尾
- Phase 19：治疗摘要作废能力 v1，包括作废字段、软作废 API、作废后随访建议 / 来源任务阻断、机构端状态展示和 smoke / 文档收尾
- Phase 20：治疗项目路径模板 v1，包括 domain-only catalog、确定性随访建议接入、机构端模板建议轻量展示和 smoke / 文档收尾
- Phase 21 Plan Mode：随访路径运营分析 v1 spec / plan 文档规划已完成；当前只是 docs-only 口径规划，不进入功能实现
- Phase 21 PR 2：随访路径运营分析 domain-only 口径，包括最小安全输入 / 输出类型、纯函数指标计算和 institution 单元测试
- 开放平台基础治理基线

Phase 6 已完成：

- 机构工作台首页复用现有真实 API 派生运营摘要
- workspace 与三大业务页加载态、错误态、空态和占位态统一
- 机构端导航明确标注已接入页面与后续占位页面
- workspace entry smoke 覆盖首页、三大业务页和占位入口切换

Phase 7 已完成：

- audit events 已补充最小 `resource_id`，支持客户、预约、随访相关审计事件关联目标记录
- `GET /api/institution/customers/[customerId]/timeline` 已提供客户详情时间线只读 API
- 客户中心已增加“查看详情”入口和右侧客户详情时间线抽屉
- 客户详情 v1 展示客户脱敏摘要、预约摘要、随访摘要、结构化时间线和安全审计摘要
- workspace / customer detail smoke 覆盖客户中心打开详情、关闭后列表保留、敏感信息不展示

Phase 8 已完成：

- 审计查询底层能力已完成：查询条件类型、白名单 parser、repository 查询方法、分页 DTO 和安全 DTO mapper
- `GET /api/institution/audit-events` 已提供机构端本租户审计事件只读查询，不接受前端 `tenantId` 切换租户
- 机构端「审计日志」入口已接入基础列表、筛选、分页、loading、empty、error、403 和 503
- `GET /api/open-platform/audit-events` 已提供平台端受控审计事件只读查询，支持平台端 `tenantId` 筛选
- 平台端「权限与审计」已接入审计日志只读 UI，平台端可展示 `tenantId` 作为审计归属字段
- workspace smoke 覆盖机构端和平台端审计入口、筛选请求、可见范围和敏感字段不展示

Phase 9 已完成：

- 新增租户套餐、租户套餐分配和租户配额快照最小数据底座
- demo seed 已写入套餐、分配和配额快照演示数据
- open-platform tenant-management repository / domain 已提供安全 DTO，只返回租户运营元数据
- `GET /api/open-platform/tenants` 已提供平台端租户只读 API，`platform_admin` 可访问，`platform_operator` 按当前 RBAC 保守返回 403
- 平台端「租户管理」已接入真实 API，展示租户列表、状态、套餐、配额上限、当前用量和快照时间
- UI 与 smoke 覆盖 loading、empty、403、503、成功态、只读请求和敏感字段不展示
- Phase 9 不包含租户创建、编辑、删除、冻结 / 恢复、套餐 enforcement、计费、支付、合同、发票或客户 / 预约 / 随访业务明细下钻

Phase 10 已完成：

- 新增内部套餐配额 enforcement helper，读取当前租户 active plan / quota limit
- 新增客户数和预约数按 `tenantId` 实时 live count，不把 `tenant_quota_snapshots.current*` 作为强一致判断
- `POST /api/institution/customers` 已接入客户数量配额 enforcement
- `POST /api/institution/appointments` 已接入预约数量配额 enforcement
- 超额、无 active plan、无 quota limit 时 fail closed，返回稳定中文 `409` 错误并写 denied 审计
- 客户更新、预约更新、随访状态流转、审计写入和只读 API 不受数量配额阻断
- 客户中心和预约中心已展示稳定套餐配额错误态，失败后保留表单输入，前端不发送 `tenantId`
- smoke / 单元测试覆盖配额允许、拒绝、无套餐、无 limit、无 snapshot、租户隔离、PII / SQL / stack / token / secret 不泄露
- Phase 10 不包含套餐购买、套餐变更、续费、支付、合同、发票、租户冻结 / 恢复、完整套餐商业化后台、治疗记录、AI / RAG / Agent、企微、OAuth 或 Webhook

Phase 11 已完成：

- 平台商业化健康 view model / client 派生逻辑已完成，复用现有 `GET /api/open-platform/tenants` 和 `GET /api/open-platform/audit-events`
- 平台端「租户管理」已展示商业化健康摘要、套餐覆盖率、配额风险、配置缺失租户和近期 quota denied 审计信号
- 配额风险基于 `tenant_quota_snapshots.current*` 做“配额快照 / 运营参考”展示，不作为计费、创建拦截或 Phase 10 enforcement 的强一致依据
- smoke / 单元测试覆盖平台入口展示、套餐覆盖、配额风险、缺失配置、quota denied 聚合、只读请求和敏感字段不展示
- Phase 11 不包含套餐购买、套餐变更、续费、支付、合同、发票、租户冻结 / 恢复、自动升级套餐、自动触达客户或租户、治疗记录、AI / RAG / Agent、企微、OAuth 或 Webhook

Phase 12 已完成：

- 新增最小 `treatment_summaries` 治疗结构化摘要数据底座、Drizzle migration、demo seed、repository 和 DTO 白名单
- `GET /api/institution/customers/[customerId]/timeline` 已返回 `treatmentSummaries`，并在 `timeline` 中增加 `type: "treatment_summary"` 节点
- 客户详情抽屉已展示治疗时间、项目、类别、阶段、恢复阶段、风险等级、负责人、摘要、下一步护理建议和标签
- workspace / customer detail smoke 覆盖客户中心进入详情、治疗摘要展示、治疗节点展示、无治疗摘要空态和敏感字段不展示
- Phase 12 不包含完整治疗记录正文、完整病历正文、咨询对话全文、治疗写入 UI、AI provider、AI 生成治疗建议、Agent、RAG、企微、HIS / CRM / OTA、OAuth、Webhook、支付或外部系统同步

Phase 13 已完成：

- 新增治疗摘要写入 payload parser，限制结构化字段白名单并拒绝完整正文、PII、图片 / 文件原文、AI 生成内容、外部系统原文和敏感错误细节
- 新增治疗摘要 repository create 和安全 DTO，写入使用服务端确认的 `tenantId` / `customerId`
- 新增 `treatment_summary` access resource，`tenant_admin` 具备必要 create / read 权限，不扩大 update / delete
- 新增 `POST /api/institution/customers/[customerId]/treatment-summaries`，从 access context 推导 tenant，不接受前端 `tenantId`，并校验 customer / appointment 同租户和同客户
- 客户详情抽屉新增“添加治疗摘要”结构化录入表单，成功后刷新 timeline，新摘要进入治疗摘要区域和 `treatment_summary` 时间线节点
- workspace / customer detail smoke 覆盖打开客户详情、打开结构化表单、提交成功刷新 timeline、提交失败保留输入、请求 body 不含 `tenantId` / 未知字段 / PII / 完整正文，以及 SQL / stack / token / secret / `DATABASE_URL` / 连接串不展示
- Phase 13 不包含完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件上传、AI 生成、Agent、RAG、企微、HIS / CRM / OTA、OAuth、Webhook、支付、外部系统同步或治疗摘要管理 / 编辑

Phase 14 已完成：

- 新增 `GET /api/institution/treatment-summaries`，服务端从 access context 推导 `tenantId`，不接受前端 `tenantId` 切换租户
- 新增治疗摘要列表 query parser、repository `listTreatmentSummariesByTenant`、cursor / limit 校验和安全 DTO 白名单 mapper
- 机构端新增「治疗摘要管理」入口，展示治疗摘要只读列表、基础筛选、加载更多和安全详情查看
- UI 与 smoke 覆盖 loading、empty、403、503、筛选白名单、分页 / 加载更多、安全详情、只读请求和敏感字段不展示
- Phase 14 不新增 schema / migration，不改权限、认证或租户隔离，不做治疗摘要新增 / 编辑 / 删除
- Phase 14 不包含完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件上传、AI provider、Agent、RAG、企微、HIS / CRM / OTA、OAuth、Webhook、支付、合同、发票或外部系统同步

Phase 15 已完成：

- 新增确定性护理 / 随访建议 domain、parser / mapper 和稳定 `suggestionKey`，只基于 `riskLevel`、`recoveryStage`、`treatmentStage`、`nextCareAction`、`treatmentCategory`、`treatmentProject`、`treatmentDate`、`tags` 等结构化字段
- `follow_up_tasks` 已增加 `source_treatment_summary_id` 和 `source_suggestion_key` 来源关联字段，并完成 Drizzle migration / meta、repository create 地基和同租户来源幂等 / 去重测试
- 新增 `GET /api/institution/treatment-summaries/[summaryId]/follow-up-suggestions`，服务端从 access context 推导 `tenantId`，返回确定性建议，不写数据库、不创建随访任务
- 新增 `POST /api/institution/treatment-summaries/[summaryId]/follow-up-tasks`，机构人员人工确认后创建结构化随访任务，服务端重新校验 summary / suggestionKey / tenant，并写稳定审计
- 治疗摘要管理 UI 已支持查看随访建议、展示“人工确认”边界、人工确认创建内部随访任务、成功提示和重复确认冲突提示
- workspace smoke / API / UI / repository 测试覆盖建议展示、人工确认创建、重复冲突、来源关联、租户隔离、敏感字段不展示和不自动触达边界
- Phase 15 不包含 AI provider、AI 生成护理建议、Agent、RAG、企微、短信、电话外呼、自动触达客户、HIS / CRM / OTA、OAuth、Webhook、支付、完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件原文或外部系统同步

Phase 16 已完成：

- `GET /api/institution/followups` 已支持 `source=treatment_summary` 和 `sourceTreatmentSummaryId` 白名单筛选，继续从 access context 推导 `tenantId`，拒绝前端传入 `tenantId`、未知参数和未定义 `source`
- follow-up DTO 已返回安全来源字段 `source`、`sourceTreatmentSummaryId` 和 `sourceSuggestionKey`，不返回 `tenantId`、完整治疗摘要正文、完整病历正文、咨询全文、PII、SQL、stack、token、secret、`DATABASE_URL` 或连接串
- 智能随访列表已展示“来源：治疗摘要”、来源摘要 ID、建议 key，并支持“全部来源 / 治疗摘要来源”筛选
- 治疗摘要管理页已在加载建议后查询同来源活跃随访任务，展示只读重复任务提示，并在存在活跃同来源任务时禁用重复创建
- workspace smoke / institution 测试覆盖来源标签、来源筛选、重复提示、不自动创建、不自动触达和敏感字段不展示
- Phase 16 不包含治疗摘要编辑、治疗摘要作废、自动创建随访任务、自动触达客户、企业微信、短信、电话外呼、AI provider、Agent、RAG、HIS / CRM / OTA、OAuth、Webhook、支付、完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件原文或外部系统同步

Phase 17 已完成：

- Phase 17 HIS 接入标准模型 / 标准治疗事件 v1 spec / plan 已完成，明确标准治疗事件是未来 HIS / 导入 / 外部系统进入智美天工后的内部标准化事件，不是数据库 schema
- 已新增 domain-only 标准治疗事件类型、`sourceSystem` 稳定集合、`treatmentStatus` / `riskLevel` 等稳定枚举、mapper 输入 / 输出契约、字段白名单和禁止字段边界
- mapper 明确外部 `tenantId` 不可信，`tenantId` / `eventId` / `receivedAt` 只能来自服务端可信上下文；输入不接受 raw payload、未知字段或手机号原文
- 已明确标准治疗事件不会自动生成或修改 `treatment_summaries`；`treatment_summaries` 仍是机构端可查看和运营使用的结构化摘要
- institution 测试覆盖合法输入、`sourceSystem`、`sourceEventId`、`customerMatchKey`、`maskedPhone`、治疗项目 / 分类 / 阶段、金额 / 币种、tags 标准化、字段白名单和禁止字段
- Phase 17 不包含真实 HIS 接入、Webhook、文件导入、外部系统同步、数据库 schema / migration、API route、UI、企业微信 / 个人微信、AI / RAG / Agent、业务事件埋点实现或经营智能中心实现

Phase 18 已完成：

- Phase 18 治疗摘要编辑能力 v1 spec / plan 已完成，明确只允许机构端编辑白名单结构化字段，不允许完整治疗记录正文、完整病历正文、诊疗原文、咨询对话全文、图片 / 文件原文或外部系统原文
- 已新增治疗摘要编辑 payload parser，拒绝未知字段、外部 `tenantId` / `customerId` / `id` / 时间戳字段、PII、完整正文、AI 生成内容、外部系统 payload、SQL、stack、token、secret、`DATABASE_URL` 和连接串
- 已为 `tenant_admin` 增加最小 `treatment_summary:update` 权限，未开放 `treatment_summary:delete`
- 已新增 `updateTreatmentSummaryByTenant`，按服务端确认的 `tenantId + summaryId` 更新，`appointmentId` 更新前校验同租户且属于同一 customer
- 已新增 `PATCH /api/institution/treatment-summaries/[summaryId]`，服务端从 access context 推导 `tenantId`，成功返回安全 DTO 并写 `treatment_summary/update allowed` audit
- 机构端治疗摘要管理安全详情已新增“编辑治疗摘要”入口和受控编辑表单，提交只发送白名单字段，成功后刷新列表和详情，失败后保留输入并展示稳定中文错误
- workspace smoke 覆盖治疗摘要管理页进入、安全详情打开、编辑入口、白名单 PATCH body、成功刷新、失败保留输入、不会自动修改既有随访任务、不会重新生成随访建议和敏感字段不展示
- Phase 18 不包含治疗摘要删除、治疗摘要作废、版本历史、diff 展示、完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件上传、AI provider、Agent、RAG、企业微信、真实 HIS / CRM / OTA 接入、OAuth、Webhook、支付、合同、发票或外部系统同步

Phase 19 已完成：

- Phase 19 治疗摘要作废能力 v1 spec / plan 已完成，明确作废不是删除，作废信息必须可审计、可追溯
- `treatment_summaries` 已新增 nullable 作废字段和 Drizzle migration，历史摘要默认视为 active，不 drop 表、不删除字段、不修改已有字段类型
- 治疗摘要 domain / DTO 已派生 `status: "active" | "voided"`，repository 已新增 `voidTreatmentSummaryByTenant`，按服务端确认的 `tenantId + summaryId` 软作废
- 作废原因 parser 已覆盖稳定 reason code、短文本限制和敏感字段拒绝，不接受完整治疗记录正文、完整病历正文、诊疗原文、咨询全文、手机号原文、身份证号、病历号原文、图片 / 文件原文、AI 生成内容、外部系统原文、SQL、stack、token、secret、`DATABASE_URL` 或连接串
- 已新增 `POST /api/institution/treatment-summaries/[summaryId]/void`，服务端从 access context 推导 `tenantId`，不接受前端传入 `tenantId`，成功和拒绝路径写稳定 audit
- 已作废摘要会阻断新的随访建议和新的来源随访任务创建；已存在来源随访任务不自动取消、不自动修改状态，仍保留来源追溯
- 机构端治疗摘要列表、详情、客户 timeline 和来源任务提示已展示作废状态，作废详情显示作废时间、作废人和作废原因
- workspace smoke / institution / audit / db 测试覆盖作废字段、parser、repository、API、随访阻断、UI 展示、来源任务提示、客户 timeline、不会硬删除、不会自动取消既有任务和敏感字段不展示
- Phase 19 不包含治疗摘要硬删除、批量作废、版本历史、diff 展示、自动取消既有随访任务、自动触达客户、完整治疗记录正文、完整病历正文、咨询对话全文、图片 / 文件上传、AI provider、Agent、RAG、企业微信、HIS / CRM / OTA 真实接入、OAuth、Webhook、支付、外部系统同步

Phase 20 治疗项目路径模板 v1 已完成：

- Phase 20 治疗项目路径模板 / 随访路径模板 v1 已形成最小闭环：治疗摘要结构化字段 → domain-only 路径模板 catalog 匹配 → 模板驱动确定性随访建议 → 治疗摘要管理页轻量展示 → 人工确认创建来源任务 → 重复来源任务治理 → 作废摘要阻断
- 首批覆盖光子 / 光电治疗、水光 / 注射护理、术后修复和皮肤管理；模板节点包含恢复阶段、风险等级、建议随访节点、建议任务标题、建议处理角色、人工确认和禁止自动触达边界
- 机构端治疗摘要管理页已能轻量展示“路径模板建议”、路径类型、建议处理角色、人工确认后创建内部随访任务、禁止自动触达客户、不自动回复客户和不接 AI
- Phase 20 v1 未新增 API、未改 DTO、未改 schema / migration、未改权限、认证或租户隔离，不接 HIS / 企微 / AI，不做自动触达，也不修改 demo seed 数据
- 后续如需路径模板 schema / API、租户自定义模板、路径编辑器、平台端模板管理、HIS 输入、企微触达、AI 生成建议或路径效果分析，必须单独进入 Plan Mode

Phase 21 随访路径运营分析 v1 Plan Mode 已完成：

- Phase 21 仅规划如何基于现有治疗摘要、路径模板建议、来源随访任务、任务状态和审计记录形成最小运营分析口径，不是功能实现
- 最小指标建议包括模板建议数、人工确认任务数、任务完成数、任务超时数、作废摘要阻断数和重复来源任务冲突数
- 当前不新增 API，不改 schema / migration，不改权限、认证或租户隔离，不接 HIS / 企微 / AI，不做自动触达，不做复杂经营智能中心、图表 UI、报表导出或经营归因
- 后续如需落库、报表 API、图表 UI、导出、经营归因、审计口径补强或外部系统接入，必须单独评估

Phase 21 PR 2 随访路径运营分析 domain-only 口径已完成：

- 新增随访路径运营分析最小输入 / 输出类型和纯函数，基于治疗摘要、模板建议、来源随访任务、任务状态、固定 `analysisAt` 和审计事件计算六个最小指标
- 指标包括模板建议数、人工确认任务数、任务完成数、任务超时数、作废摘要阻断数和重复来源任务冲突数
- 作废阻断和重复来源冲突只从可识别审计事件统计；审计不足时返回 0 和 warning，不用作废摘要数量或任务重复行猜测
- 本阶段仍不新增 API、不改 UI、不改 schema / migration、不改权限、认证或租户隔离，不接 HIS / 企微 / AI，不做自动触达、图表 UI、报表导出或经营归因

后续阶段会依次加入：

- Phase 20 后续扩展评估：路径模板 schema / API、租户自定义 SOP、平台端模板管理、路径效果分析、外部系统输入或触达能力必须单独规划
- HIS 标准治疗事件 mapper 增强、业务事件埋点体系 spec、随访路径运营分析 v1 实现评估、经营智能中心 v1、客服会话、版本历史 / diff 展示和完整治疗记录能力仍需单独规划
- 平台租户状态管理、更多资源配额 enforcement、完整套餐商业化后台与计费能力
- AI 与知识库
- 企业微信、开放平台凭证和计费

路线图参考：

```text
docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md
```

## 开发

```bash
pnpm install
pnpm dev
```

打开地址：

```text
http://localhost:5010
```

本地演示账号：

```text
机构端：admin / admin123
平台端：platform / admin123
```

演示认证默认只在非生产环境启用。生产环境如需临时演示，必须显式设置：

```text
ZMTG_ENABLE_DEMO_AUTH=true
```

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 架构

参见：

```text
docs/architecture/zmtg-new-project-architecture-design.md
```

## 自主执行工作流

Codex 按仓库内的自主执行规则推进分支、测试、PR、开发日志和风险升级：

```text
docs/operations/codex-autonomous-workflow.md
```

开发日志记录在：

```text
docs/devlog/
```

## 工程规则

- 不要信任浏览器 localStorage 或任意请求头中的租户编号。
- 不要添加生产备用账号。
- 不要把业务数据存入 localStorage。
- 不要隐藏 TypeScript 构建错误。
- mock provider 仅限 development 和 test 环境使用。

## 文档语言规范

后续所有面向人阅读的项目文档，原则上使用中文撰写，包括 README、roadmap、devlog、产品文档、spec 文档、plan 文档、PR 说明中的功能范围描述、团队交接说明、测试描述中面向人阅读的场景说明、页面文案和错误提示。

文档文件名和路径可以使用英文 slug，文件名建议采用 `YYYY-MM-DD-phaseXX-english-slug.md`。文件名不要求中文化；面向人阅读的标题、正文和说明内容应尽量中文化。

允许保留英文的内容：

- API 路径。
- 文件路径。
- 字段名。
- 变量名。
- 函数名。
- 类型名。
- 表名。
- 枚举值。
- 代码标识符。
- 命令。
- 技术缩写，例如 API、DTO、RBAC、PII、SQL、HIS、CRM、SCRM、AI、RAG、Webhook、OAuth。
- 与代码保持一致的 `resource` / `action` / `reason` / `status` 等值。

禁止后续文档继续出现无必要英文模板残留，例如：

- `Implementation Plan`
- `Goal:`
- `Architecture:`
- `Tech Stack:`
- `For agentic workers...`
- 其他纯英文模板说明。

历史文档处理原则：

- 已合并的历史文档文件名不主动大规模重命名。
- 历史文档中的英文模板残留，可在后续触碰时顺手中文化。
- 如果专门做历史文档清理，必须单独 docs-only PR。
- 不应把历史文档清理和功能开发混在同一个 PR 中。

日期命名规则：

- 后续新建 spec / plan 文档时，文件名前缀日期必须使用当前实际日期。
- 不得继续复用旧模板日期。
- 如需确认日期，可执行 `date +%F`。
