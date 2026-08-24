# 机构端 V1.1 现有能力审计映射

```text
TASK=INSTITUTION_EXISTING_CAPABILITY_AUDIT_AND_IMPLEMENTATION
REFERENCE_VERSION=V1.1_APPROVED
DESIGN_FREEZE_ID=ZMTG-INSTITUTION-V1.1-APPROVED-20260824
AUDIT_DATE=2026-08-24
BASELINE=8480d167f996155ad53a287411e76b418a0822e7
SCOPE=INSTITUTION_ONLY
AUDITED_CAPABILITY_COUNT=39
```

## 审计方法与边界

- 事实优先级：当前源码中的正式业务模型、服务端权限、租户/机构作用域和 Capability 权威，高于参考包与演示数据。
- 调用链按 `Page/API → Orchestration/Application Service → Reader/Writer → Repository → Schema/Guard` 核对，不能以文件名或静态 UI 判断能力存在。
- 当前 Capability 权威只放行 9 个页面：工作台、客户列表、会话队列、预约管理、随访任务、知识库资料只读、经营总览只读、AI 使用统计只读、审计与安全只读。其余注册页面保持 `hidden + not_released`。
- GitNexus 索引落后本次 `HEAD` 2030 个提交，未用于当前事实判断；Symbol、Import 和 Callgraph 以当前源码、测试和路由导入链为准。
- 本任务不新增 Schema、Migration、外部 Provider、真实连接、真实消息收发或 AI 调用，不把演示/Mock/Dry-run 结果作为生产能力。

## 分类汇总

| Reuse Decision | 数量 |
|---|---:|
| `REUSE_READY` | 17 |
| `PARTIAL_REUSE` | 10 |
| `SAFE_NEW_UI_OR_ADAPTER` | 2 |
| `GAP_REQUIRES_SCHEMA_OR_NEW_DOMAIN` | 2 |
| `EXTERNAL_CONTRACT_REQUIRED` | 4 |
| `CAPABILITY_OFF` | 3 |
| `NOT_AUTHORIZED` | 1 |
| `NOT_APPLICABLE` | 0 |

## 公共壳层与页面映射（1–15）

| # | Prototype Capability | Institution Page | Existing Route/Page | Existing API | Existing Domain Owner | Existing Reader | Existing Writer | Mapping/Adapter | Capability State | Permission/Tenant Guard | Reuse Decision | Implementation Action | Deferred Reason | Tests |
|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Institution Layout | 全机构端 | `/hospital/**`; `InstitutionNavigationShell` | 无直接 API | `institution-contracts/v1` + `InstitutionNavigationShell` | 服务端页面分别读取 | 无 | 七栏目契约到 Shell | 可见栏目由服务端授权；页面独立判定 | `resolveInstitutionServerAuthorizationV1` + section guard | `PARTIAL_REUSE` | 复用现有 Shell，补正式 Topbar、Workspace 区域和状态一致性 | 不迁移平台/Auth/Marketing Shell | `InstitutionRouteShell.test.tsx` |
| 2 | Sidebar | 全机构端 | `InstitutionNavigationShell` | 无 | `institution-navigation.ts` | `availableSectionIds` | 无 | 七栏目到 Lucide 图标 | 栏目级可见，非页面放行证明 | 服务端 `availableSectionIds` fail-closed | `PARTIAL_REUSE` | 保留七栏目、收起与正式图标；对齐冻结宽度 | 二级页面不能绕过 page capability | `InstitutionNavigationContract.test.ts`、`InstitutionRouteShell.test.tsx` |
| 3 | Workspace / Tabs | 全机构端 | `InstitutionNavigationShell → InstitutionWorkspaceFrame` | 无 | 无独立 Canonical Owner | 无 | 无 | 服务端页面 Capability 目标 + canonical 路径到低敏 Tab 描述 | UI 状态，不提升 Capability；最终安全修正后 `COMPLETED` | 只接受页面级 Capability 放行且经本地白名单验证的 `/hospital` canonical 路径；持久化 Key 由可信服务端 actor + tenant + institution 作用域生成；对象路径仍由服务端做对象级校验 | `SAFE_NEW_UI_OR_ADAPTER` | 工作台固定 Tab、可区分的业务/对象 Tab、最多 8 个、快速打开、完整标签列表、关闭当前/其他/右侧/全部、横向滚动、作用域隔离的 Session 恢复 | 不复用旧大组件中的平行业务逻辑 | `InstitutionWorkspaceState.test.ts`、`InstitutionWorkspaceFrame.test.tsx`、`InstitutionSectionGuard.test.ts` |
| 4 | Drawer / Modal / Popover | 详情/轻量交互 | 当前存在移动“更多” Dialog、`CustomerTimelineDrawer`、多处受控表单 | 多个既有业务 API | 各业务 Domain | 各页面 Reader | 仅已有受控 Writer | 当前页面组件各自映射 | 随页面/动作 Capability | 页面、对象、动作重新授权 | `PARTIAL_REUSE` | 复用现有 Dialog/Drawer 语义；新增全局导航搜索 Dialog | 不创建通用 Writer 或假数据 Drawer | `InstitutionRouteShell.test.tsx`、组件测试 |
| 5 | 全局搜索 | 公共 Topbar | 当前无统一生产业务搜索 | 无统一 API | 无统一搜索 Owner | 无 | 无 | 服务端 `CapabilityStatusV1` 映射为 `availableNavigationTargets` | 仅导航搜索；不读取客户/会话事实 | 同时要求服务端栏目授权与页面级 Capability；栏目可见不等于页面授权 | `SAFE_NEW_UI_OR_ADAPTER` | `⌘/Ctrl+K` 与 Workspace `+` 复用同一页面导航搜索，未授权页面不进入结果 | 客户/会话/知识跨域搜索需正式联合 Reader | `InstitutionNavigationTargetMapper.test.ts`、`InstitutionWorkspaceFrame.test.tsx` |
| 6 | 日期与时间组件 | 预约/随访/分析 | `datetime-local`、`Intl.DateTimeFormat` 与业务时间 Domain 已存在 | 预约/随访 API | Care/Analytics | Appointment/Follow-up Readers | 现有受控命令 | ISO UTC 与机构展示时间映射 | 预约/随访已放行；Availability 未放行 | Care 读写授权 + 机构作用域 | `PARTIAL_REUSE` | 保留正式选择控件和 ISO 转换，不新增假 Slot | 缺少正式 Availability Owner，不能实现周历空闲时段 | Appointment/Follow-up/BusinessTime tests |
| 7 | 图标库 | 全机构端 | `lucide-react` 已用于机构端 | 无 | 共享 UI | 无 | 无 | 冻结语义到 Lucide | 可复用 | 无业务授权含义 | `REUSE_READY` | 继续复用 Lucide，不引入 Emoji/Unicode 图标 | 无 | `InstitutionRouteShell.test.tsx` + build |
| 8 | Design Tokens | 全机构端 | Tailwind + `globals.css` + Shell 固定色值 | 无 | 共享样式 | 无 | 无 | 冻结颜色/尺寸到 CSS 变量 | 可复用但未集中 | 无业务授权含义 | `PARTIAL_REUSE` | 补机构端专用 Tokens，并由公共 Shell 消费 | 不影响 Marketing/Auth/Platform | build + 视觉核对 |
| 9 | 工作台 | 工作台 | `/hospital` | 服务端直接编排 | `institution-workbench` | Capability/Action projections | 已有受控快速创建入口 | Capability、Care/Conversation Action Projection | `page_workbench=operational/pilot_released` | Navigation + Capability + action 独立授权 | `REUSE_READY` | 原样复用真实投影，不复制 KPI 逻辑 | 不增加原型假数字 | Workbench capability/action tests |
| 10 | 客户中心 | 客户列表/详情 | `/hospital/customers`、`/hospital/customers/:customerId` | `/api/v1/institution/customers*` | `customers` | `readCurrentInstitutionCustomersV1`、controlled read | `customer-command-service` | Reader DTO / controlled DTO | 列表和受控创建/详情已试点放行 | Customer read/write auth + tenant/institution | `REUSE_READY` | 复用正式列表、详情、创建及服务端筛选 | 高级筛选/画像/分群未放行 | Customer list/controlled write/API tests |
| 11 | 会话工作台 | 会话队列/详情 | `/hospital/conversations*` | `/api/v1/institution/conversations*` | `institution-conversations` | `readCurrentInstitutionConversationQueueV1` | controlled conversation command repository | Formal source → queue/action DTO | 队列试点放行；真实收发和自动触达关闭 | Conversation read/write auth + object scope | `REUSE_READY` | 复用队列与受控处置；保留真实发送/入站关闭 | 四栏聊天 UI 不能用演示消息补齐 | Conversation queue/action/runtime tests |
| 12 | 预约与随访 | 预约、随访 | `/hospital/care/appointments*`、`/hospital/care/followups*` | `/api/v1/institution/appointments*`、`followups*` | `care` | Appointment list + Formal Follow-up readers | Appointment/Follow-up command services | Care DTOs | 两者均 `operational/pilot_released` | Care read/write auth + object/assignment scope | `REUSE_READY` | 复用正式列表、详情和受控命令 | Availability、HIS mutation、真实发送不在放行面 | Care page/API/runtime tests |
| 13 | 知识库 | 资料库 | `/hospital/knowledge` | `/api/v1/institution/knowledge-documents` | `knowledge` + `institution-knowledge` | `readCurrentInstitutionKnowledgeDocumentsV1` | 已有 Knowledge command service，当前页不暴露 | 只映射正式 `published` 版本元数据 | `read_only/pilot_released` | Knowledge read auth + tenant/institution + published filter | `REUSE_READY` | 复用已发布知识只读列表 | 检索、问答、任务、编辑页均 hidden | Knowledge metadata/runtime/page tests |
| 14 | 经营分析 | 经营总览 | `/hospital/analytics` | `/api/v1/institution/analytics` | `institution-analytics` | `readCurrentInstitutionAnalyticsOverviewV1` | 无当前写入口 | Formal consumption facts → deterministic aggregation | `read_only/pilot_released` | Analytics read auth + scoped formal source | `REUSE_READY` | 只展示真实可计算金额/客户指标及周期 | 策略、报告、成本/毛利不足时保持关闭 | Analytics runtime/page/API tests |
| 15 | 管理中心 | AI 用量、审计 | `/hospital/system/ai-usage`、`/hospital/system/audit`; 其余 catch-all off | AI usage、audit events | `institution-system`、`audit` | AI metrics reader、Audit reader | 本任务不新增 | 低敏用量/审计 DTO | 两页 read-only 试点；其余 hidden | system section + 独立 read auth + capability | `PARTIAL_REUSE` | 复用两页；未放行页面继续显示真实不可用状态 | 机构成员、Connector、隐私等页面尚未生产放行 | AI usage/Audit/Route shell tests |

## 业务 Domain 与治理映射（16–34）

| # | Prototype Capability | Institution Page | Existing Route/Page | Existing API | Existing Domain Owner | Existing Reader | Existing Writer | Mapping/Adapter | Capability State | Permission/Tenant Guard | Reuse Decision | Implementation Action | Deferred Reason | Tests |
|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 16 | Customer | 客户中心 | 列表/详情/创建 | `/api/v1/institution/customers*` | `customers`; `customers` 表 | Customer list/object fact readers | Customer command service/repository | Low-sensitive list/controlled DTO | 已试点放行 | tenantId + institutionId 双条件；对象再校验 | `REUSE_READY` | 作为唯一 Canonical Owner 复用 | 禁止复制第二套 Customer | Customer domain/repository/API tests |
| 17 | Customer Profile | 客户详情 | `/hospital/customers/:customerId` | GET/PATCH customer detail | `customers`；`customer-center` 提供候选投影 | controlled read/object fact | 受控字段 Writer | `CustomerControlledDtoV1`；overview mapper 未正式放行 | 受控详情可用；完整画像 Tabs 未放行 | Customer object/write authorization | `PARTIAL_REUSE` | 只展示当前低敏受控字段 | AI画像、消费/治疗全量、证据 Tabs 缺正式联合 Reader | Customer controlled/object fact tests |
| 18 | Customer Tags | 客户详情/列表 | Schema/Command 有 `tags`，正式列表 DTO 不输出 | customer legacy/formal APIs 中部分可见 | Customer | 无当前正式 Tag 专用 Reader | Customer command repository 支持 tags，但受控 UI 未放行 | Customer row ↔ tag array | 无独立页面/动作放行 | Customer write auth + low-sensitive validation | `PARTIAL_REUSE` | 不新增平行 Tag Owner；当前 UI 不擅自开放编辑 | 需要页面级字段权限和正式投影 | Customer command/list-item boundary tests |
| 19 | Segmentation | 客户分群 | 仅 Canonical route/capability 注册；catch-all off | 无正式 API | 无正式 Segmentation Owner | 无 | 无 | 无 | `hidden/not_released` | 无可授权目标 | `GAP_REQUIRES_SCHEMA_OR_NEW_DOMAIN` | 保持关闭 | 需要正式 Domain、持久化规则、Reader/Writer、权限和审计 | Route/capability contract tests |
| 20 | Opportunities | 客户/经营分析 | 旧 `OpportunityPoolShell` 与服务存在；正式 canonical 页面 off | `/api/institution/opportunities`（非 V1 正式页面链） | 旧 `institution/opportunity-pool` | 从 Customer 派生的旧服务 | 无正式 Writer | Customer → opportunity 推导 | `page_analytics_opportunities=hidden/not_released` | 旧 access-control，不构成当前放行 | `CAPABILITY_OFF` | 不挂入当前 Shell | 缺当前权威 Reader/页面放行与正式证据口径 | Opportunity legacy tests + capability tests |
| 21 | Conversation | 会话工作台 | 队列/详情 | `/api/v1/institution/conversations*` | `institution-conversations`; formal tables | Queue/controlled readers | Conversation command repository | Formal source/conversation/segment → DTO | 队列 operational | read/write auth + tenant/institution/object | `REUSE_READY` | 复用状态模型与人工处置 | 真实消息收发仍关闭 | Conversation domain/runtime/API tests |
| 22 | Communication | 会话/客户上下文 | Formal message/segment Domain 存在，当前 UI 只展示低敏队列与处置 | conversation APIs | `institution-conversations` | Queue/action projection | controlled command repository | Message/segment/action projection | 部分可读，消息正文工作台未放行 | 对象、最新 segment、风险与 assignment 校验 | `PARTIAL_REUSE` | 保持 AI/人工状态分离；不补演示聊天记录 | 真实渠道身份与授权消息 Reader 未完成 | Conversation boundary/action tests |
| 23 | Message Delivery | 随访/会话 | Draft/delivery evidence Domain 与旧 Routes 存在 | followup-message-drafts / controlled-reachout | `institution` follow-up delivery + `messaging` | Draft/delivery reads | Mock/受控记录 Writer | Draft → Delivery evidence；非真实发送 | 无当前页面 Capability；真实发送关闭 | Follow-up access + transaction + safety gates | `CAPABILITY_OFF` | 不在当前页面暴露发送；保留投递证据链 | 缺正式生产 Connector 与独立放行；`mark_sent` 不代表客户收到 | FollowUpMessageDelivery/ControlledReachOut tests |
| 24 | Appointment | 预约管理 | 列表/详情/创建 | `/api/v1/institution/appointments*` | `care`; `appointments` 表 | Appointment list/controlled read | Appointment command service/repository | Appointment DTO | operational pilot | Care auth + object/role + capability/action | `REUSE_READY` | 复用唯一 Appointment Owner 与受控命令 | 不直接写 HIS | Appointment domain/repository/API tests |
| 25 | Availability | 预约 | 无正式 Availability 页面/Reader/表 | 无 | 无正式 Owner | 无 | 无 | 无 | 未注册为可用能力 | 无 | `GAP_REQUIRES_SCHEMA_OR_NEW_DOMAIN` | 不显示假空闲 Slot | 需要资源/医生/房间/设备事实、并发校验与正式接口 | 仅可复用 BusinessTime 测试，尚无 Availability tests |
| 26 | Follow-up | 随访任务 | 列表/详情/创建与受控状态操作 | `/api/v1/institution/followups*` | `care`; formal follow-up tables | Formal follow-up reader/runtime | Follow-up command service/repository | Formal task → low-sensitive DTO | operational pilot | Care auth + tenant/institution + assignment/role | `REUSE_READY` | 复用多任务模型、状态与 assignment | 方案设计/自动触达页面未放行 | FormalFollowUp runtime/domain/API tests |
| 27 | Knowledge Base | 知识库 | `/hospital/knowledge` | Knowledge documents V1 | `knowledge` / `institution-knowledge` | Published metadata reader | Command service/repository 已存在但当前 UI 不开放 | Formal source/version/publication → DTO | read-only pilot | Knowledge auth + scope + publication status | `REUSE_READY` | 仅复用已发布版本 | 未发布内容不进入当前正式上下文 | Knowledge publication/version/runtime tests |
| 28 | AI Assistance | 客户/会话/知识/策略 | AI call/RAG 服务与用量统计存在，业务辅助页面未放行 | AI/knowledge answer 等非本次调用 | `institution` AI call + platform provider gateway | 用量 Reader；无本次业务 AI Reader | AI call service 可调用 Provider，但本任务禁用 | Provider/RAG adapters | 实际业务 AI 能力未放行 | AI policy + knowledge + quota + capability | `EXTERNAL_CONTRACT_REQUIRED` | 仅保留 AI 用量只读状态 | 需要正式 Provider、模型路由、证据与场景放行；本任务禁止真实调用 | AI call/readiness/quota tests |
| 29 | Evidence | 知识/AI/随访/审计 | Audit、Knowledge QA audit、Care timeline evidence 分散存在 | audit/knowledge/follow-up APIs | 各 Domain 分别持有 | Audit/QA/timeline Readers | 各自事务内 Evidence Writer | 多个低敏证据 DTO | 部分可用；无统一 AI Evidence 页 | Scope + resource authorization + redaction | `PARTIAL_REUSE` | 复用现有证据来源，不创建第二套 Evidence 表 | 原型 AI evidence 需要统一可信引用和确认状态 Owner | Audit/QA/Timeline evidence tests |
| 30 | Analytics | 经营分析 | `/hospital/analytics` | `/api/v1/institution/analytics` | `institution-analytics`; formal consumption facts | Analytics overview reader | 无当前 Writer | 按币种和等长周期聚合 | read-only pilot | Analytics auth + formal source scope | `REUSE_READY` | 展示真实口径、周期与更新时间 | 经营策略/利润结论无正式模型 | Analytics domain/runtime/API tests |
| 31 | Audit | 管理中心 | `/hospital/system/audit` | `/api/institution/audit-events` | `audit`; `audit_events` | Institution audit reader/client | Audit repository，由业务事务调用 | Redacted audit DTO | read-only partial pilot | system section + audit read auth + attribution | `REUSE_READY` | 复用低敏审计列表 | partial coverage 不冒充全量 | Audit domain/repository/API/client tests |
| 32 | Permissions | 全机构端 | 所有当前 Page/API | 各 Route guard | `security` + `access-control` | Membership/object/scope facts | Binding/Membership 命令（本任务不改） | Role/section/object/action decisions | 当前正式 Guard 生效 | server-only fail-closed | `REUSE_READY` | 原样复用，不在客户端重算授权 | 无 | Security 全套 unit/boundary tests |
| 33 | Tenancy | 全机构端 | 所有正式 Reader/Writer | 所有正式 API | `tenancy` + institution scope | authoritative institution scope reader | provisioning/write adapters（本任务不调用） | tenantId + institutionId attribution | 当前正式作用域生效 | current active scope + exact pair | `REUSE_READY` | 所有新增 UI 只消费现有服务端结果 | 不建立默认机构或客户端租户推断 | Tenancy/Scope/Isolation tests |
| 34 | Entitlements | 管理/动作门禁 | 用量 API 与 quota enforcement 存在 | `/api/institution/entitlement-usage` 等 | Tenant plan/quota + institution entitlement usage | Usage/quota readers | 现有 quota usage writers | Plan assignment → limits/usage | 可读且被多个 Writer 门禁消费 | tenant scope + active plan + capability | `REUSE_READY` | 复用现有额度与门禁；不写死功能开关 | 未放行页面不会因套餐存在而开放 | Entitlement/Quota/API tests |

## 外部系统与导入映射（35–39）

| # | Prototype Capability | Institution Page | Existing Route/Page | Existing API | Existing Domain Owner | Existing Reader | Existing Writer | Mapping/Adapter | Capability State | Permission/Tenant Guard | Reuse Decision | Implementation Action | Deferred Reason | Tests |
|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 35 | HIS Mapping / Contract / Adapter | 管理中心/预约 | 旧 HIS 安全摘要 Panel；当前 system data/channel 页面 off | `/api/institution/his-connections*` | HIS connection metadata | HIS connection repository | Command/write/credential services 已存在 | 仅安全元数据；test provider 为 fake | 当前管理页面 hidden；真实 HIS 禁用 | institution access + secret redaction | `EXTERNAL_CONTRACT_REQUIRED` | 不挂入已放行页面；保留状态为未接入 | 缺具体厂商 Contract、网络、凭据、Capability/UAT；禁止真实连接与 mutation | HIS repository/service/redaction tests |
| 36 | Database Connector | 管理中心 | 无医院业务数据库 Connector 页面 | 无 | 无正式 Connector Owner | 无 | 无 | 仅应用自身 Postgres，不等于医院数据库 Connector | 未注册/未放行 | 无 | `EXTERNAL_CONTRACT_REQUIRED` | 显示为未接入，不复用内部数据库客户端冒充 | 需要只读 View、数据字典、网络/凭据、增量游标、契约/UAT | 无正式 Connector tests |
| 37 | WeCom Mapping / Contract | 管理/会话 | 旧 Mapping/Dry-run/External Contact 组件与 API；当前 system channel 页面 off | 多个 `/api/institution/wecom*` | WeCom mapping / messaging | Mapping candidates、readonly proof readers | Mapping command + mock/controlled writer | 明确 mock/dry-run/official proof | 当前页面 hidden；真实授权/收发禁用 | scope + mapping review + safety/preflight | `CAPABILITY_OFF` | 保留关闭与真实状态说明，不显示“已连接” | 缺正式企业授权、回调、UAT 和生产放行 | WeCom mapping/dry-run/safety tests |
| 38 | Personal WeChat Connector | 管理/会话 | 无机构端生产实现；仅平台套餐候选文案 | 无 | 无 | 无 | 无 | 无供应商 Adapter | `VENDOR_DEPENDENT`，未放行 | 无 | `EXTERNAL_CONTRACT_REQUIRED` | 显示供应商依赖/未接入 | 需要供应商 SDK/API、授权、合规、心跳、联系人/消息 Contract 与 UAT | 无 |
| 39 | Excel Import | 客户中心 | 旧 import domain/API 存在，当前正式客户页未开放导入入口 | `/api/institution/customers/import` | Customer import + Customer | 预览/旧客户读取 | 可写 Customer records | 低敏模板行 → Customer draft | 无当前 action capability；非 V1 正式页面链 | 旧 access context + import boundary | `NOT_AUTHORIZED` | 本任务不暴露、不执行导入 | 开放写入需独立 action capability、正式授权链、审计与验收 | CustomerImport domain/API/boundary tests |

## Symbol / Import / Callgraph 与当前生产调用方核对

| # | 当前源码 Symbol / Import / Callgraph | 当前生产调用方 |
|---:|---|---|
| 1 | `InstitutionNavigationShell → InstitutionWorkspaceFrame` | 所有当前 `/hospital/**` 正式页面与 capability-off 页面 |
| 2 | `INSTITUTION_NAVIGATION_SECTIONS_V1 → InstitutionNavigationShell` | 所有当前 `/hospital/**` 页面；栏目列表由服务端授权结果收敛 |
| 3 | `InstitutionNavigationAuthorizationV1 → resolveInstitutionShellAuthorizationV1 → CapabilityStatusV1 → mapInstitutionAvailableNavigationTargetsV1 → InstitutionNavigationShell → InstitutionWorkspaceFrame` | 全部 14 个当前 `/hospital/**` Shell 调用方；统一 Helper 在可信请求/机构作用域内独立计算页面目标，不依赖当前目标页是否获准，客户端不推断权限 |
| 4 | 现有页面 Drawer/Dialog + 新导航搜索 Dialog | 客户详情、移动更多菜单及公共 Shell；无新增业务 Writer |
| 5 | `InstitutionWorkspaceFrame.availableNavigationTargets + workspaceScopeKey` | 公共 Shell；只索引服务端当前 AccessContext 放行且经 canonical 白名单验证的正式页面；`workspaceScopeKey` 是服务端生成的低敏 opaque 摘要，访问时服务端仍再次做页面/对象授权 |
| 6 | Care 页面表单、`BusinessTime`、`Intl.DateTimeFormat` | 预约与随访页面；无 Availability 调用方 |
| 7 | `lucide-react → InstitutionNavigationShell/InstitutionWorkspaceFrame` | 公共 Shell |
| 8 | `globals.css institution-* tokens → Institution Shell` | 仅 `/hospital/**` 壳层消费 |
| 9 | `/hospital → institution-workbench runtime/projections` | 机构工作台正式页面 |
| 10 | Customer Page/API → `readCurrentInstitutionCustomersV1` / controlled runtime | 客户列表、详情与受控创建页面 |
| 11 | Conversation Page/API → `readCurrentInstitutionConversationQueueV1` / controlled runtime | 会话队列与受控详情页面 |
| 12 | Care Pages/APIs → appointment/follow-up orchestration | 预约列表/详情、随访列表/详情页面 |
| 13 | Knowledge Page/API → `readCurrentInstitutionKnowledgeDocumentsV1` | 已发布知识只读页面 |
| 14 | Analytics Page/API → `readCurrentInstitutionAnalyticsOverviewV1` | 经营总览只读页面 |
| 15 | AI usage/Audit Pages → respective orchestration readers | 管理中心当前仅两条 read-only 页面 |
| 16 | Customer Readers/Writers → Customer repositories → `customers` | 客户正式 Page/API；唯一 Customer Owner |
| 17 | Customer detail Page/API → controlled read/object fact | 客户受控详情页 |
| 18 | Customer command repository `tags` | 当前正式机构页没有 Tag 专用调用方或编辑入口 |
| 19 | 只有 route/capability 注册与 catch-all 阻断 | 无生产业务调用方 |
| 20 | 旧 Opportunity service/API；未接入当前 capability authority | 无当前放行页面调用方 |
| 21 | Conversation queue/detail runtime → formal repositories | 会话正式 Page/API |
| 22 | Formal source/conversation/segment/action projections | 当前只被低敏队列与受控处置消费 |
| 23 | Draft/delivery evidence 与 controlled-reachout 旧链 | 无当前放行页面调用方；真实投递无调用方 |
| 24 | Appointment Page/API → command service/repository | 预约正式列表、详情与受控创建 |
| 25 | 无 Availability Symbol/Reader/Repository | 无生产调用方 |
| 26 | Formal Follow-up Page/API → runtime/command repository | 随访正式列表、详情与受控创建/状态操作 |
| 27 | Published Knowledge metadata runtime → formal publication/version repository | 知识库只读页面 |
| 28 | AI usage reader 有正式调用方；业务 AI provider/RAG 不在本任务调用 | 仅 AI 与额度只读页；无新增 AI 调用方 |
| 29 | Audit/Knowledge QA/Care timeline 各自证据链 | 各自 Owner 页面/API；无统一 Evidence 页面调用方 |
| 30 | Analytics overview runtime → formal consumption facts | 经营总览只读页面 |
| 31 | Audit page/client → institution audit reader/repository | 审计与安全只读页面 |
| 32 | Server authorization/section/object/scope guards | 所有正式机构 Page/API/Writer |
| 33 | Authoritative institution scope reader | 所有正式机构 Reader/Writer |
| 34 | Entitlement usage/quota services | AI 用量页与多个既有受控 Writer 门禁 |
| 35 | HIS metadata API/旧 Panel → HIS repository/services | 无当前放行管理页；真实 HIS Adapter 无调用方 |
| 36 | 无医院数据库 Connector Symbol/Contract | 无生产调用方 |
| 37 | WeCom mapping/dry-run/proof 旧 Panel/API | 无当前放行管理页；真实授权、入站和发送无调用方 |
| 38 | 无个人微信生产 Connector | 无生产调用方 |
| 39 | 旧 Customer import API/domain | 当前正式客户页无调用方；本任务未调用 |

## 同任务实施结果

- 新增独立 `institution-shell` 模块，避免向冻结的 `src/modules/institution/**` 增加文件，也未扩大架构例外。
- 公共 Shell 对齐机构端冻结尺寸：Sidebar `236px / 76px`、Topbar `64px`、Workspace `46px`；新增独立机构端 Design Tokens，不影响 Marketing、Auth 或 Platform。
- Workspace 路由状态使用 Next.js `usePathname` / `useRouter`：Next Link、浏览器前进后退和动态客户/会话/预约/随访详情路由无需依赖组件重新挂载；关闭当前标签使用 `router.push()`，不触发整页刷新。完成最终安全修正后 Workspace 状态为 `COMPLETED`。
- 新增固定且不可关闭的工作台 Tab、最多 8 个 Tab、横向滚动与完整标签列表，并补齐快速打开 `+`、标签管理 `…`、关闭当前、关闭其他、关闭右侧和关闭全部。正式 Section Guard 契约保证任何可用机构导航都包含 `workbench`；客户端仍采用防御性回退，只保留授权结果中实际存在的固定入口，异常快照下不会强制注入或跳转 `/hospital`。
- 对象 Tab 由受控 canonical 路径生成低敏标签，例如 `客户 · 0123`、`会话 · 8842`。`sessionStorage` 只保存经过页面级 Capability 过滤和白名单验证的 canonical route paths；对象路径可能包含不透明对象 ID。不会持久化姓名、手机号、聊天正文、知识内容、Secret、标签标题或其他业务载荷；标识边界以“不透明对象 ID 可能存在于路径中”为准。
- Workspace 持久化 Key 为 `zmtg:institution-workspace-paths:v2:<workspaceScopeKey>`。`workspaceScopeKey` 由可信服务端 Section Guard 使用 actor 的 opaque `userReference`、`tenantId` 与 `institutionId` 生成稳定 SHA-256 base64url 摘要后只读传入；客户端不从 URL、栏目或业务数据推断。相同 actor + tenant + institution 可恢复，任一作用域变化均不跨域恢复；当 `hydratedStorageKey !== storageKey` 时，渲染层立即停止使用旧内存标签，只允许显示当前 pathname 且经当前页面 Capability 放行的标签，避免新作用域 Hydration 前短暂暴露旧对象标签。切换作用域不会删除或覆盖旧作用域自己的 V2 数据，返回原作用域后仍可恢复。缺少可信 Key 时不读取、不写入也不清空任何 V2 Scoped Workspace。旧全局 `zmtg:institution-workspace-paths:v1` 永不读取并做 best-effort 清理。
- `⌘/Ctrl+K` 与 Workspace `+` 复用同一导航搜索。搜索与 Session 恢复同时经过服务端页面级 Capability 结果和 canonical 白名单过滤；权限变化后会清理已失权路径。`availableSectionIds` 只控制栏目可见性，栏目可见不代表其中每个页面已授权。
- 页面级导航目标通过统一服务端 `resolveInstitutionShellAuthorizationV1` 计算：只有真实有效的导航授权、可用的 `CapabilityStatusV1`，以及与导航授权精确匹配的 `tenantId + institutionId` 同时成立时，才返回 `workspaceScopeKey` 和页面目标。Capability Authority 抛错、返回 `null`、返回不可用/非法 envelope 或作用域不匹配时，统一返回 `workspaceScopeKey=null`、`availableNavigationTargets=[]`、`capabilityStatus=null`，客户端因此不会读取、写入或清空既有 Scoped Workspace。Authority 恢复后，相同作用域重新获得稳定 Key 并恢复原标签。当前目标栏目被阻断或当前页面 capability-off、但 Capability Authority 正常时，仍可展示同一可信请求作用域内其他已授权正式页面；当前页面内容继续独立执行 `targetAccess`、页面 Capability、业务权限和对象级服务端校验。
- 未新增业务 Route、API、Reader、Writer、Repository、Schema、Migration 或外部 Adapter；原有 Page/API 继续承担生产调用，所有访问和操作继续由服务端重新授权。
- 最终安全修正新增并更新 actor/tenant/institution 存储隔离、对象 Tab 跨作用域首帧隔离、旧作用域 Storage 保留与恢复、V1 Key 清理、无 Key 禁止读写/清空、Capability Authority 故障存储保护与恢复、阻断页/Capability-off 页保留其他授权导航、Authority 失败 fail-closed、工作台不变量与安全关闭回退测试；完整门禁结果以本任务最终回报为准。
- 本地浏览器只读验收：Sidebar `236px / 76px`、Topbar `64px`、Workspace `46px` 与背景 Token 均符合冻结值；安全阻断态和空搜索态无伪造数据，浏览器 console 无 error/warning。

## Canonical Owner 与不可越界结论

- Customer：`customers` 模块及 `customers` 表是唯一正式 Owner。
- Conversation：`institution-conversations` 的 formal source/conversation/segment/message 模型是唯一正式 Owner。
- Appointment 与 Follow-up：`care` 模块是唯一正式 Owner；任何 AI、会话或 Connector 都不得直接写表。
- Knowledge：`knowledge` / `institution-knowledge` 的 formal source/version/publication 是唯一正式 Owner；当前 UI 只读已发布版本。
- Analytics：只读取 `analytics` formal facts；不从演示数据或平台商业记录补数。
- Permissions/Tenancy/Capability：只接受服务端权威结果，未知、过期、作用域不一致一律 fail-closed。
- 外部系统：HIS、医院数据库、企业微信、个人微信和 AI Provider 均不因存在 UI、配置表、Fake/Mock/Dry-run 或测试代码而视为已接入。
