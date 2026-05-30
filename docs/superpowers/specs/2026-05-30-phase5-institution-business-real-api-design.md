# Phase 5 机构业务页面真实化设计

## 目标

Phase 5 聚焦把机构端核心业务页面从静态演示页面升级为接入真实 API 的可操作工作台。范围只包含客户中心、预约中心、智能随访 / 随访任务三块页面，复用当前已经完成的客户、预约、随访 GET / POST / PATCH API、仓储、写入白名单、租户隔离和审计事件能力。

本阶段不新增数据库 schema，不新增 migration，不改 demo auth，不改权限模型，不进入 AI、企微、支付、OAuth、Webhook 等高风险模块。

## 1. 当前可用 API 和数据能力盘点

当前后端已经具备以下真实 API：

- `GET /api/institution/customers`：读取当前服务端访问上下文对应租户的客户摘要，返回 `{ records }`。
- `POST /api/institution/customers`：创建脱敏客户摘要。
- `PATCH /api/institution/customers`：按 `id` 更新脱敏客户摘要。
- `GET /api/institution/appointments`：读取当前租户预约摘要。
- `POST /api/institution/appointments`：创建预约，并校验 `customerId` 属于当前租户。
- `PATCH /api/institution/appointments`：更新预约 `status` 和 `note`。
- `GET /api/institution/followups`：读取当前租户随访任务。
- `PATCH /api/institution/followups`：通过已有随访状态机流转任务状态。

当前仓储和数据能力：

- `src/modules/institution/server/tenant-business-repository.ts` 已提供客户、预约、随访的列表、创建、更新和状态流转仓储方法。
- `src/modules/institution/server/tenant-business-api.ts` 已统一处理 401、403、404、409、503、RBAC 和审计事件。
- `src/modules/institution/server/tenant-business-write-input.ts` 已提供写入 payload 白名单和 PII 拒绝规则。
- `src/modules/institution/server/tenant-business-audit-transaction.ts` 已保证允许写入和审计事件在同一数据库事务内执行。
- `src/server/db/schema.ts` 已定义 `customers`、`appointments`、`follow_up_tasks`、`audit_events` 等表。
- `src/server/db/seed-demo-data.ts` 已提供可用于页面真实化验证的 seed 数据。

当前安全能力：

- 租户编号只从服务端 `AccessContext` 推导。
- API 不信任 URL、header 或 body 中的 `tenantId`。
- 客户表只保存脱敏展示字段。
- 预约和随访通过 `(tenant_id, customer_id)` 复合外键约束同租户客户。
- 审计事件覆盖允许、拒绝、目标不存在、非法状态流转和 stale transition。
- 数据库异常返回稳定错误，不暴露连接串、SQL 或凭证明文。

## 2. 当前机构端页面现状

当前机构端入口为 `/hospital`，由 `DemoSessionGate` 限制 `tenant_admin` 访问。`InstitutionWorkspace` 使用本地 `activeView` 在工作台、客户中心、预约中心、智能随访和占位模块之间切换。

当前三个核心页面仍是静态演示：

- `src/modules/institution/components/CustomerCenterShell.tsx` 直接读取 `demoCustomers`、`customerSegments`、`customerInsightItems`。
- `src/modules/institution/components/AppointmentCenterShell.tsx` 直接读取 `appointmentPipelineGroups`、`appointmentAlerts`。
- `src/modules/institution/components/SmartFollowUpShell.tsx` 直接读取 `followUpJourneys`、`followUpTasks`、`followUpMessageSuggestions`。

当前页面缺口：

- 未请求真实 `/api/institution/*` API。
- 没有业务数据加载态、空状态、错误态、权限态。
- 没有客户和预约创建 / 更新 UI。
- 没有随访任务状态流转 UI。
- 没有前端层面的 payload 白名单组装和提交失败反馈。
- 没有页面交互层测试覆盖真实 API 调用。

## 3. 客户中心真实化方案

客户中心在进入页面时请求 `GET /api/institution/customers`，用返回的 `records` 替换当前静态 `demoCustomers` 队列。

展示方案：

- 以真实 records 渲染客户优先级队列。
- 基于 records 计算分层卡片：
  - `priority === 'high'` 作为高意向 / 高优先级。
  - `lifecycle === 'post_care'` 作为术后关怀中。
  - `lifecycle === 'repurchase_window'` 作为复购窗口期。
  - `lifecycle === 'silent_reactivation'` 作为沉默待激活。
- 保留客户数据边界说明，但文案从“静态演示信息”调整为“真实 API 返回的脱敏展示字段”。

创建和更新方案：

- 增加“新建客户”表单。
- 增加“编辑客户摘要”操作，可更新基础展示字段。
- 创建 payload 只包含：
  - `displayName`
  - `lifecycle`
  - `priority`
  - `ownerUserId`
  - `projectInterest`
  - `maskedPhone`
  - `maskedMedicalRecordNo`
  - `lastTouchSummary`
  - `nextAction`
  - `tags`
- 更新 payload 只包含：
  - `id`
  - 上述字段子集
- 表单成功后刷新客户列表或局部更新当前记录。

明确不做：

- 不新增客户详情完整时间线。
- 不保存真实手机号、身份证号、完整病历号、治疗记录正文或咨询对话。
- 不做治疗记录完整病历正文。

## 4. 预约中心真实化方案

预约中心进入页面时请求：

- `GET /api/institution/appointments`
- `GET /api/institution/customers`

客户列表用于新建预约时选择 `customerId`，并从已加载客户记录派生 `customerDisplayName`，避免手工输入造成租户或展示名不一致。

展示方案：

- 按预约 `status` 分组渲染：
  - `pending_confirmation`
  - `confirmed`
  - `arrived`
  - `completed`
  - `reschedule_requested`
  - `cancelled`
- `scheduledAt` 在前端格式化为本地可读时间。
- 保留运营提醒区，但提醒只基于当前 records 的基础统计和固定安全文案，不引入外部排班或治疗记录。

创建和更新方案：

- 增加“新建预约”表单。
- 创建 payload 只包含：
  - `customerId`
  - `customerDisplayName`
  - `project`
  - `scheduledAt`
  - `consultantUserId`
  - `status`
  - `note`
- 增加预约状态更新操作。
- 更新 payload 只包含：
  - `id`
  - `status`
  - `note`

明确不做：

- 不做专家排班系统。
- 不做 HIS / CRM / OTA 连接器。
- 不做治疗记录回填或完整病历正文。

## 5. 智能随访 / 随访任务真实化方案

智能随访页面进入时请求 `GET /api/institution/followups`，用真实随访任务替换当前静态 `followUpTasks`。

展示方案：

- 按 `status`、`riskLevel`、`dueAt` 排序。
- 将 `riskLevel` 映射为当前 UI 的普通、关注、优先展示标签。
- 将 `dueAt` 格式化为可读到期时间。
- 旅程摘要可先由任务 `journeyId` 聚合得到基础统计，不新增旅程配置 API。
- 话术建议保留为静态安全说明，不调用 AI，不生成真实触达内容。

状态流转方案：

- 增加状态流转按钮，只展示当前状态允许的下一步。
- 流转规则复用现有状态机：
  - `scheduled` -> `due`、`cancelled`
  - `due` -> `in_progress`、`escalated`、`cancelled`
  - `in_progress` -> `completed`、`escalated`、`cancelled`
  - `escalated` -> `in_progress`、`completed`、`cancelled`
  - `completed`、`cancelled` 无下一步
- PATCH payload 只包含：
  - `id`
  - `nextStatus`
- 409 stale transition 时提示刷新并重新拉取任务列表。

明确不做：

- 不接 AI provider。
- 不接 Agent。
- 不接 RAG / 知识库。
- 不做企业微信或自动触达。

## 6. 前端状态管理方案

Phase 5 不引入新的状态管理库。页面状态使用 React client state 管理。

建议新增轻量 client helper：

- `src/modules/institution/client/tenant-business-client.ts`

职责：

- 封装 `fetch` 调用。
- 统一解析 `{ records }` 和 `{ record }`。
- 统一解析 `{ error }`。
- 将 HTTP 状态映射为 UI 可理解的错误类型：
  - `unauthorized`
  - `forbidden`
  - `not_found`
  - `conflict`
  - `validation_error`
  - `service_unavailable`
  - `unknown`

建议新增 view model helper：

- `src/modules/institution/domain/tenant-business-view-models.ts`

职责：

- 枚举值到中文标签映射。
- 客户分层统计。
- 预约状态分组。
- 随访风险标签和允许下一步流转。
- 日期展示格式化。

组件状态建议：

- `loading`
- `records`
- `error`
- `submitting`
- `selectedRecord`
- `formError`

Mutation 成功后优先更新本地 state；遇到 404、409 或 503 时提示并重新拉取最新列表。

## 7. 表单与写入白名单方案

前端表单只组装后端已允许字段。前端不得发送：

- `tenantId`
- `phoneNumber`
- `idNumber`
- `medicalRecordNo`
- `treatmentRecord`
- `consultationTranscript`
- `rawPhone`
- `rawIdCard`
- 任何 API Key、OAuth token、Webhook secret 或凭证明文

客户表单要求：

- `maskedPhone` 字段文案必须明确为“脱敏手机号展示值”。
- `maskedMedicalRecordNo` 字段文案必须明确为“脱敏病历号展示值”。
- `tags` 由前端拆分为非空字符串数组。
- 自由文本字段不提示用户输入真实手机号、身份证号、完整病历号、治疗记录正文或咨询对话。

预约表单要求：

- `customerId` 必须来自当前租户客户列表。
- `customerDisplayName` 必须由已选客户派生。
- `scheduledAt` 必须转换为后端接受的 ISO-like 时间字符串。
- `note` 只记录脱敏摘要。

随访表单要求：

- 状态流转只发送 `id` 和 `nextStatus`。
- 不允许提交任务正文、对话、话术发送结果或 AI 生成内容。

后端 `tenant-business-write-input.ts` 仍是最终准入规则。前端校验只用于改善体验，不能替代后端白名单。

## 8. 错误态 / 空状态 / 权限态设计

加载态：

- 三个页面进入时展示紧凑 loading 区域或骨架卡片。
- 提交按钮在 mutation 中显示提交中并禁用重复点击。

空状态：

- 客户中心空态展示“暂无客户摘要”，并提供创建入口。
- 预约中心空态展示“暂无预约”，如果客户列表非空则提供创建入口；如果客户列表为空则提示先创建客户。
- 随访空态展示“暂无随访任务”，不提供自动创建入口。

错误态：

- 401：提示“登录状态已失效，请重新登录”，提供返回 `/login` 的入口。
- 403：提示“当前账号没有访问该业务数据的权限”，不展示业务数据。
- 400：展示服务端返回的字段错误。
- 404：提示“记录不存在或不属于当前租户”。
- 409：提示“状态已变化，请刷新后重试”，并触发重新拉取。
- 503：提示“数据服务暂时不可用”，不展示内部错误。
- unknown：提示“操作失败，请稍后重试”。

权限态：

- 页面不根据前端角色自行授权业务请求。
- `/hospital` 继续由 `DemoSessionGate` 做入口守卫。
- 业务 API 继续由服务端 `AccessContext` 和 `canAccessResource` 做最终授权。

## 9. 租户隔离与审计验证方式

租户隔离验证：

- 前端代码不得读取、缓存、拼接或提交 `tenantId`。
- 客户、预约、随访列表都只调用无租户参数的 `/api/institution/*`。
- 创建预约只能从当前 GET 得到的客户列表中选择客户。
- 后端仍以 `context.tenantId` 作为最终租户。

审计验证：

- 读取客户、预约、随访应继续产生允许读取审计事件。
- 创建客户、更新客户、创建预约、更新预约、随访流转成功时，业务写入和 allowed 审计在同一事务内完成。
- 权限拒绝、目标不存在、非法随访流转和 stale transition 继续写 denied 审计。
- 页面测试重点验证前端不会发送 `tenantId` 和禁止字段；API/仓储测试继续验证审计事件内容。

## 10. 测试计划

组件测试：

- 客户中心：
  - 加载态。
  - GET 成功渲染真实客户 records。
  - 空态。
  - 401 / 403 / 503。
  - 创建客户成功。
  - 更新客户成功。
  - 提交失败展示服务端错误。
  - 请求 body 不包含 `tenantId` 和禁止 PII 字段。
- 预约中心：
  - 同时加载客户和预约。
  - 按状态分组。
  - 客户为空时禁用新建预约。
  - 创建预约时从客户派生 `customerDisplayName`。
  - 更新预约状态和备注。
  - 404 / 503 错误展示。
- 智能随访：
  - GET 成功渲染真实随访任务。
  - 按风险和到期时间展示。
  - 合法下一步按钮。
  - PATCH 成功更新状态。
  - 409 stale transition 后提示刷新。

Client/helper 测试：

- 成功解析 `{ records }`。
- 成功解析 `{ record }`。
- 稳定解析 `{ error }`。
- 将 HTTP status 映射为错误类型。

View model 测试：

- 客户生命周期和优先级中文标签。
- 客户分层统计。
- 预约状态分组。
- 随访状态允许下一步。
- 日期展示格式化。

回归测试：

- 保留现有 `TenantBusinessApiRoutes.test.ts`、`TenantBusinessRepository.test.ts`、`TenantBusinessWriteInput.test.ts`、`AccessControlDomain.test.ts`。
- 完成 Phase 5 开发后运行 `pnpm typecheck && pnpm test && pnpm build`。

## 11. 文件级修改清单

预计新增：

- `src/modules/institution/client/tenant-business-client.ts`
- `src/modules/institution/domain/tenant-business-view-models.ts`

预计修改：

- `src/modules/institution/components/CustomerCenterShell.tsx`
- `src/modules/institution/components/AppointmentCenterShell.tsx`
- `src/modules/institution/components/SmartFollowUpShell.tsx`
- `src/modules/workspace/components/InstitutionWorkspace.tsx`，仅在需要传入刷新函数或共享数据时修改。
- `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

预计新增测试：

- `src/modules/institution/tests/TenantBusinessClient.test.ts`
- `src/modules/institution/tests/TenantBusinessViewModels.test.ts`

不应修改：

- `src/app/api/institution/customers/route.ts`
- `src/app/api/institution/appointments/route.ts`
- `src/app/api/institution/followups/route.ts`
- `src/server/db/schema.ts`
- `drizzle/*.sql`
- `src/modules/security/domain/access-control.ts`
- `src/modules/security/server/access-context.ts`
- `src/modules/auth/server/demo-session.ts`

除非执行中发现与本计划明确冲突的现有缺陷，否则 Phase 5 不改 API、schema、migration、demo auth 或权限模型。

## 12. A-F 分阶段任务拆解

### A. Client helper 和 view model

- 新增 API client helper。
- 新增标签、分组、统计和流转 view model helper。
- 先写 helper 测试，再实现 helper。
- 不触碰页面和 API route。

### B. 客户中心真实化

- 将客户中心从静态数组切换为真实 GET。
- 增加加载、空、错误、权限态。
- 增加创建和编辑客户摘要表单。
- 测试客户 GET、POST、PATCH 和 payload 白名单。

### C. 预约中心真实化

- 将预约中心从静态数组切换为真实 GET。
- 加载当前租户客户列表用于预约创建。
- 增加创建预约和更新预约状态 UI。
- 测试客户派生、预约分组、POST、PATCH 和错误态。

### D. 智能随访 / 随访任务真实化

- 将随访任务从静态数组切换为真实 GET。
- 增加状态流转 UI。
- 处理 409 stale transition。
- 测试合法按钮、PATCH 成功和冲突刷新提示。

### E. 页面集成和状态补齐

- 在 `/hospital` 工作台切换中验证三页真实 API 行为。
- 补齐 401、403、503、空态。
- 确认移动端导航和页面布局不因动态文案溢出。

### F. 验证和交付

- 运行 `pnpm typecheck`。
- 运行 `pnpm test`。
- 运行 `pnpm build`。
- 如配置了 `DATABASE_URL`，用 seed 数据做本地 smoke：
  - 登录机构端。
  - 读取客户、预约、随访 seed 数据。
  - 创建客户。
  - 创建预约。
  - 流转随访任务。

## 13. 不纳入本阶段的内容

Phase 5 明确不做：

- AI provider。
- Agent。
- RAG / 知识库。
- 企业微信。
- HIS / CRM / OTA 连接器。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 套餐权益 enforcement。
- 平台租户管理。
- 治疗记录完整病历正文。
- 客户详情完整时间线。

如执行中发现以上能力看起来“顺手可做”，只记录为后续阶段，不纳入 Phase 5。

## 14. 风险点

- GET 请求会写审计，页面不应使用高频轮询或重复无意义刷新。
- `datetime-local` 与 ISO 时间转换可能造成时区偏移，需要测试固定样例。
- 预约创建同时包含 `customerId` 和 `customerDisplayName`，前端必须从客户列表派生展示名，不能让用户手写。
- 随访状态没有客户端版本号，只能依赖服务端 stale transition 409，需要良好提示。
- 组件引入业务 fetch 后，测试需要区分 `/api/auth/session` 和 `/api/institution/*`。
- 动态数据长度可能破坏当前卡片布局，需要移动端和桌面端做基本视觉检查。
- 前端校验不足不能成为安全依赖，必须继续依赖后端白名单和 PII 拒绝规则。

## 15. 执行前确认项

执行 Phase 5 开发前需要确认：

- 当前分支从最新 `main` 创建。
- 当前工作区没有未归属变更。
- 本文档和对应实施计划已经合并或明确作为执行依据。
- 本阶段只改客户中心、预约中心、智能随访相关前端和必要 helper / 测试。
- 不改 API route。
- 不改数据库 schema。
- 不新增 migration。
- 不改 demo auth。
- 不改权限模型。
- 不进入 AI provider、Agent、RAG、企微、连接器、API Key、OAuth、Webhook、支付、合同、发票、套餐权益 enforcement、平台租户管理、治疗记录完整病历正文或客户详情完整时间线。
- 如需要偏离上述边界，先停止并重新进入 Plan Mode。
