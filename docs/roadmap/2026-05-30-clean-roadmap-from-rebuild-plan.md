# Clean 项目后续路线建议

> 日期：2026-05-30
> 参考材料：旧项目 `/Users/dongxiaolong/Documents/zmtg-imac/docs/REBUILD_PLAN.md`
> 边界：旧项目只作为功能和业务参考，不直接迁移旧代码。

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
- 开放平台治理第一阶段：API Key、OAuth、Webhook 和审计的治理词汇、生命周期和安全边界展示。

当前主要缺口：

- 平台端已有只读租户列表、租户状态、套餐 / 配额、用量快照和商业化健康运营摘要；机构端新增客户 / 预约已具备轻量套餐配额 enforcement，但尚未具备租户创建、编辑、删除、冻结 / 恢复、完整套餐商业化后台、计费、支付、合同或发票能力。
- 审计日志只读查询基础版已完成，但导出、告警和复杂风控仍未进入真实实现。
- 治疗记录结构化摘要 v1 和治疗摘要人工录入 v1 已完成；完整治疗记录正文、治疗摘要管理 / 编辑、客服会话、知识库、AI、企业微信、开放平台凭证和计费仍未进入真实实现。

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

- 治疗记录模块：结构化摘要 v1、租户隔离和人工录入 v1 已完成；后续治疗摘要管理 / 编辑、客服会话联动和完整治疗记录能力需单独规划，仍不保存完整病历正文。
- 平台租户后续能力：租户创建、状态变更审计、完整套餐商业化后台、计费、合同、发票和支付。
- 审计高级治理：只读查询基础版之后再单独评估导出、告警和复杂风控。
- 套餐权益与配额 enforcement：客户数和预约数创建阻断已完成轻量版，后续可单独评估员工数、随访任务、AI 调用、严格一致计数器和套餐变更流程。
- 知识库基础版：文件、分块、训练状态和检索测试。
- AI provider 与调用日志：模型启用、租户级配置、限流和成本记录。
- 企业微信连接器：扫码绑定、回调验签、客户同步和消息发送。
- 计费订单：套餐订单、合同、发票和支付事件。

## 6. 下一阶段优先级

推荐优先级：

1. Phase 14 Plan Mode：在治疗摘要管理能力 v1、知识库 / RAG 安全基础准备、平台套餐商业化继续增强、平台租户状态管理和审计高级治理之间重新评估优先级。
2. 治疗摘要管理能力 v1：只读列表、筛选和详情查看，继续禁止完整正文、图片 / 文件原文和 AI 生成内容。
3. 平台租户状态管理、更多资源配额 enforcement 与完整套餐商业化后台规划。
4. 审计高级治理：导出、告警和复杂风控。
5. 知识库/RAG 基础版。
6. 客服会话和治疗摘要编辑能力。
7. AI provider、调用日志和 Agent。
8. 企业微信、Webhook、OAuth、API Key。
9. 计费、合同、发票和支付。

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
- 后续建议进入 Phase 14 Plan Mode，在治疗摘要管理能力 v1、知识库 / RAG 安全基础准备、平台套餐商业化继续增强、平台租户状态管理和审计高级治理之间重新评估优先级；当前不进入 Phase 14 实现。
