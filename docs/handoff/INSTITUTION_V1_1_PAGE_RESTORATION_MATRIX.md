# 机构端 V1.1 七大栏目页面还原矩阵

> 基线：`731af151d45e88bf740df5a4e4558edd8b9c9d95`
> 参考版本：`V1.1_APPROVED`
> 事实边界：表中 `RESTORED` 仅表示页面视觉结构和安全交互已经还原，不表示底层业务能力、外部连接或生产放行已经开启。

## 状态口径

- `LIVE`：复用当前生产 Reader / Writer 与服务端授权。
- `READ_ONLY`：复用当前正式只读 Reader；页面不提供越权写入。
- `CAPABILITY_OFF`：页面结构完整，但正式能力关闭，所有受控操作显示明确原因。
- `EXTERNAL_CONTRACT_REQUIRED`：依赖尚未接入的 HIS、数据库、企业微信、个人微信或 AI Provider。
- `NOT_CONFIGURED`：技术契约存在，但当前机构没有完成配置或授权。
- 页面可见性来自服务端页面级 Capability；栏目可见不等于页面授权。

## 逐页矩阵

| 栏目 | 页面 | 正式 Route | 参考截图 | 现有组件 | 现有 API / Reader | 当前 Capability | 视觉还原状态 | 交互还原状态 | 数据状态 | 权限状态 | 截图状态 | 测试状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 工作台 | 运营工作台 | `/hospital` | `01-workbench.png` | `InstitutionWorkbenchShell` | Workbench action/lifecycle/capability projections | `LIVE` / `READ_ONLY` | RESTORED | RESTORED | 真实投影；缺失指标显示不可用 | 服务端 section + page Capability | GENERATED | PASSED |
| 客户中心 | 客户列表与高级筛选 | `/hospital/customers` | `02-customer-advanced-filter.png` | `CustomerListReadonlyShell` | `readCurrentInstitutionCustomersV1` | `LIVE` / `READ_ONLY` | RESTORED | RESTORED | 正式分页；仅 lifecycle/priority 服务端筛选 | 服务端 page + tenant + institution | GENERATED | PASSED |
| 客户中心 | 客户对象详情 | `/hospital/customers/:customerId` | `03-customer-ai-insights.png` | `CustomerControlledDetailShell` | Customer controlled view / PATCH API | `LIVE` | RESTORED | RESTORED | 正式对象 DTO；对象级校验 | 服务端对象权限 | GENERATED | PASSED |
| 客户中心 | 客户画像 | `/hospital/customers/:customerId` Page Tab | `03-customer-ai-insights.png` | CustomerControlledDetailShell 页面 Tab | 无正式 AI / Evidence Reader | `CAPABILITY_OFF` | RESTORED | RESTORED | 不生成画像或建议 | 继承客户对象权限 | GENERATED | PASSED |
| 客户中心 | Excel 导入六步向导 | `/hospital/customers?view=import` | `institution.html` | InstitutionV11CapabilityPage 六步向导 | 无正式导入 Writer | `CAPABILITY_OFF` | RESTORED | RESTORED | 仅展示契约、校验步骤与依赖 | 继承客户页面权限 | GENERATED | PASSED |
| 客户中心 | 客户分群 | `/hospital/customers?view=segments` | `institution.html` | InstitutionV11CapabilityPage | 无正式 Segmentation Domain | `CAPABILITY_OFF` | RESTORED | RESTORED | 不创建临时规则或数据 | 继承客户页面权限 | GENERATED | PASSED |
| 客户中心 | 经营机会 | `/hospital/analytics/opportunities` | `institution.html` | `InstitutionCapabilityOffPage` | 无正式机会聚合 Reader | `CAPABILITY_OFF` | RESTORED | RESTORED | 不生成机会记录 | 服务端 page Capability | GENERATED | PASSED |
| 会话工作台 | 四栏会话工作台 | `/hospital/conversations` | `04-conversation-workbench.png` | `ConversationQueueReadonlyShell` | `readCurrentInstitutionConversationQueueV1` | `LIVE` / `READ_ONLY` | RESTORED | RESTORED | 真实低敏队列；消息与账号状态未知 | 服务端 page + tenant + institution | GENERATED | PASSED |
| 会话工作台 | 会话对象详情 | `/hospital/conversations/:conversationId` | `04-conversation-workbench.png` | `ConversationControlledDetailShell` | Conversation controlled reader / command API | `LIVE` | RESTORED | RESTORED | 正式会话对象；真实发送关闭 | 服务端对象权限 | GENERATED | PASSED |
| 会话工作台 | 自动触达 | `/hospital/conversations/automations` | `institution.html` | `InstitutionCapabilityOffPage` | 无生产自动触达 Writer | `CAPABILITY_OFF` | RESTORED | RESTORED | 不假发送、不自动启用 AI | 服务端 page Capability | GENERATED | PASSED |
| 预约与随访 | 今日队列 | `/hospital/care` | `01-workbench.png` | `InstitutionCapabilityOffPage` | Workbench Care projection（跨页只读） | `CAPABILITY_OFF` | RESTORED | RESTORED | 未开放独立 Reader | 服务端 page Capability | GENERATED | PASSED |
| 预约与随访 | 预约管理与日历 | `/hospital/care/appointments` | `05-appointment-calendar.png` | `AppointmentListReadonlyShell` | `readCurrentInstitutionAppointmentsV1` | `LIVE` / `READ_ONLY` | RESTORED | RESTORED | 正式列表；Availability 未开放 | 服务端 page + tenant + institution | GENERATED | PASSED |
| 预约与随访 | 预约详情 Drawer | `/hospital/care/appointments/:appointmentId` | `institution.html` | 预约受控详情页 | Appointment controlled view / command API | `LIVE` | RESTORED | RESTORED | 正式对象；HIS mutation 关闭 | 服务端对象权限 | GENERATED | PASSED |
| 预约与随访 | 随访管理 | `/hospital/care/followups` | `institution.html` | `CareFollowUpControlledShell` | Current institution follow-up Reader / commands | `LIVE` | RESTORED | RESTORED | 正式任务；消息发送状态独立 | 服务端 page + tenant + institution | GENERATED | PASSED |
| 预约与随访 | 随访详情 Drawer | `/hospital/care/followups/:taskId` | `institution.html` | `CareFollowUpControlledShell` | Follow-up object Reader / commands | `LIVE` | RESTORED | RESTORED | 正式对象；真实发送关闭 | 服务端对象权限 | GENERATED | PASSED |
| 预约与随访 | 随访方案设计器 | `/hospital/care/paths` | `06-followup-plan-designer.png` | `InstitutionCapabilityOffPage` | 无正式设计器 Writer | `CAPABILITY_OFF` | RESTORED | RESTORED | 只读结构，不使用本地持久化 | 服务端 page Capability | GENERATED | PASSED |
| 知识库 | 知识资料库 | `/hospital/knowledge` | `07-knowledge-base.png` | `KnowledgeDocumentMetadataReadonlyShell` | Published metadata Reader | `READ_ONLY` | RESTORED | RESTORED | 仅正式 Published metadata | 服务端 page + tenant + institution | GENERATED | PASSED |
| 知识库 | 知识编辑 Workspace | `/hospital/knowledge/items/:knowledgeId` | `institution.html` | `InstitutionCapabilityOffPage` | 无已放行 Knowledge Writer | `CAPABILITY_OFF` | RESTORED | RESTORED | 不创建第二套知识 Writer | 服务端对象路由校验 | GENERATED | PASSED |
| 知识库 | AI 检索测试 | `/hospital/knowledge/search` | `institution.html` | `InstitutionCapabilityOffPage` | 无正式 AI Provider | `EXTERNAL_CONTRACT_REQUIRED` | RESTORED | RESTORED | 不调用真实 AI，不生成假引用 | 服务端 page Capability | GENERATED | PASSED |
| 知识库 | 问答与引用 | `/hospital/knowledge/qa` | `institution.html` | `InstitutionCapabilityOffPage` | Evidence / AI 契约未放行 | `CAPABILITY_OFF` | RESTORED | RESTORED | 不生成假 Evidence | 服务端 page Capability | GENERATED | PASSED |
| 经营分析 | 经营总览 | `/hospital/analytics` | `08-business-strategy.png` | `AnalyticsOverviewReadonlyShell` | Analytics overview Reader | `READ_ONLY` | RESTORED | RESTORED | 仅展示真实可计算聚合 | 服务端 page + tenant + institution | GENERATED | PASSED |
| 经营分析 | 客户分析 | `/hospital/analytics/opportunities` | `institution.html` | `InstitutionCapabilityOffPage` | 无正式客户机会聚合 | `CAPABILITY_OFF` | RESTORED | RESTORED | 指标不可用，不伪造 | 服务端 page Capability | GENERATED | PASSED |
| 经营分析 | 预约与服务 | `/hospital/analytics/projects` | `institution.html` | `InstitutionCapabilityOffPage` | 无正式项目聚合 | `CAPABILITY_OFF` | RESTORED | RESTORED | 指标不可用，不伪造 | 服务端 page Capability | GENERATED | PASSED |
| 经营分析 | 随访与触达 | `/hospital/analytics/consumption` | `institution.html` | `InstitutionCapabilityOffPage` | 无正式触达聚合 | `CAPABILITY_OFF` | RESTORED | RESTORED | 指标不可用，不伪造 | 服务端 page Capability | GENERATED | PASSED |
| 经营分析 | AI 与自动化 | `/hospital/analytics/reports` | `institution.html` | `InstitutionCapabilityOffPage` | 无正式策略模型 | `CAPABILITY_OFF` | RESTORED | RESTORED | 不生成假 AI 指标 | 服务端 page Capability | GENERATED | PASSED |
| 经营分析 | 经营策略 | `/hospital/analytics/reports` Page Tab | `08-business-strategy.png` | InstitutionV11CapabilityPage 策略结构 | 无正式策略模型 | `CAPABILITY_OFF` | RESTORED | RESTORED | 展示生成条件、证据与假设缺口 | 继承报告页权限 | GENERATED | PASSED |
| 管理中心 | 机构与成员 | `/hospital/system/organization` | `institution.html` | `InstitutionCapabilityOffPage` | 无本任务授权的成员 Writer | `CAPABILITY_OFF` | RESTORED | RESTORED | 不展示未读取成员 | 服务端 page Capability | GENERATED | PASSED |
| 管理中心 | 权限与安全 | `/hospital/system/privacy` | `institution.html` | `InstitutionCapabilityOffPage` | Permission / tenancy 契约 | `READ_ONLY` / `CAPABILITY_OFF` | RESTORED | RESTORED | 仅边界与状态，不扩大授权 | 服务端 page Capability | GENERATED | PASSED |
| 管理中心 | 系统接入 | `/hospital/system/channels` | `09-connectors.png` | `InstitutionCapabilityOffPage` | Connector capability diagnostics | `NOT_CONFIGURED` | RESTORED | RESTORED | HIS/DB/微信均不真实连接 | 服务端 page Capability | GENERATED | PASSED |
| 管理中心 | HIS 十步接入向导 | `/hospital/system/data` | `10-his-onboarding.png` | `InstitutionCapabilityOffPage` | HIS contract / mapping（无连接） | `EXTERNAL_CONTRACT_REQUIRED` | RESTORED | RESTORED | 不保存凭证，不连接数据库 | 服务端 page Capability | GENERATED | PASSED |
| 管理中心 | 数据与同步 | `/hospital/system/data` | `institution.html` | `InstitutionCapabilityOffPage` | Mapping contracts only | `CAPABILITY_OFF` | RESTORED | RESTORED | 不执行同步或写库 | 服务端 page Capability | GENERATED | PASSED |
| 管理中心 | AI 与自动化 | `/hospital/system/ai-usage` | `institution.html` | `AiUsageReadonlyShell` | AI usage Reader | `READ_ONLY` | RESTORED | RESTORED | 正式用量；Provider 调用关闭 | 服务端 page + tenant + institution | GENERATED | PASSED |
| 管理中心 | 审计与日志 | `/hospital/system/audit` | `institution.html` | 现有审计 Shell | Audit Reader | `READ_ONLY` | RESTORED | RESTORED | 仅已脱敏审计事件 | 服务端 page + tenant + institution | GENERATED | PASSED |
| 管理中心 | 基础设置 | `/hospital/system` | `institution.html` | `InstitutionCapabilityOffPage` | 无本任务授权的配置 Writer | `CAPABILITY_OFF` | RESTORED | RESTORED | 不写 Secret 或配置 | 服务端 page Capability | GENERATED | PASSED |

## 共同边界

- 所有动态对象深链继续执行服务端对象权限校验。
- 客户、会话、预约、随访和知识的 Canonical Owner 保持不变。
- Capability-off 页面不读取业务载荷，不将未知值显示为 `0`，不使用 `localStorage` 或 JSON 冒充生产持久化。
- Workspace 仅持久化经过页面级 Capability 白名单验证的 canonical route path；对象路径可能包含不透明对象 ID，但不保存姓名、手机号、消息正文、知识正文、Secret 或业务载荷。
- 视觉审查 Fixture 仅用于本地截图，不进入正式 API、数据库或生产默认数据。
