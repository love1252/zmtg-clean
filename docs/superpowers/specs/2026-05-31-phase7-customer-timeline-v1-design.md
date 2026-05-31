# Phase 7 客户详情时间线 v1 设计

> 日期：2026-05-31
> 状态：PR 1 规划文档。本文只定义 Phase 7 目标、边界和 PR 拆分，不修改业务代码、API、数据库、权限、认证或租户隔离。

## 1. Phase 7 目标

Phase 7 采用 A-first 路线：先建设“客户详情时间线 v1”，让机构端可以从客户中心进入单个客户详情，查看客户脱敏摘要、相关预约、相关随访任务和结构化时间线。

本阶段目标是把 Phase 5/6 已完成的客户、预约、随访真实 API 能力组织成“单客户经营视角”。v1 只做摘要和结构化时间线，不做完整病历、完整治疗记录、咨询对话全文、AI、企微、支付或外部连接器。

Phase 7 同时允许在后续 PR 中对 `audit_events` 做最小 `resource_id` enrich，用于让客户时间线能够关联到客户、预约或随访任务上的关键操作事件。该 enrich 只增加目标资源编号，不增加自由 `metadata jsonb`，不存请求体，不存隐私正文。

## 2. 为什么优先做客户详情时间线 v1

客户详情时间线 v1 是 Phase 5/6 的自然延伸：

- Phase 5 已完成客户中心、预约中心、智能随访接入真实 API。
- Phase 6 已完成机构工作台首页真实 API 摘要、共享页面状态和导航边界。
- 当前机构端已经能看列表和运营摘要，但还缺少围绕单个客户的经营闭环。

从商业化演示角度，客户详情时间线比审计日志查询更容易让机构用户理解价值：咨询、预约、随访、下一步动作可以在同一个客户上下文中串起来，演示“团队如何知道下一步该做什么”。

从工程风险角度，客户详情 v1 可以复用现有脱敏字段、租户过滤、预约/随访同租户外键和页面状态组件。只要严格限制字段范围，它比完整治疗记录、客服会话、AI 或企微接入更可控。

## 3. 为什么审计日志只读查询后置

审计日志只读查询对系统稳定和安全治理很重要，但不适合和客户详情首版混在同一个阶段完成：

- 当前审计模块已有写入仓储，但还没有查询 API、筛选参数白名单、分页、平台/机构可见范围页面。
- 当前审计事件没有 `resource_id`，无法精确定位到某个客户、预约或随访任务。
- 平台端目前仍是治理总览，`security_auditor` 角色有权限语义，但演示登录和平台入口还没有完整审计员工作台。
- 审计日志查询页面需要更严格的可见范围、筛选、脱敏和错误信息控制。

因此 Phase 7 先做客户详情时间线；Phase 8 再基于 Phase 7 的 `resource_id` enrich 建设审计日志只读查询基础版。

## 4. 客户详情时间线 v1 范围

Phase 7 v1 包含：

- 从客户中心进入客户详情。
- 展示客户脱敏基础摘要：
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
- 汇总该客户相关预约记录：
  - 项目
  - 预约时间
  - 顾问 ID
  - 状态
  - 脱敏备注摘要
- 汇总该客户相关随访任务：
  - 旅程 ID
  - 阶段
  - 状态
  - 到期时间
  - 建议人工动作摘要
  - 风险级别
  - 最近更新人和更新时间
- 汇总关键操作/审计事件摘要：
  - 仅在最小 `resource_id` enrich 完成后展示。
  - 只展示事件编号、操作者、角色、资源、动作、结果、原因、发生时间和来源。
  - 不展示请求体、错误堆栈、数据库错误、SQL、连接串、密钥或隐私正文。
- 形成结构化时间线：
  - `customer_summary`
  - `appointment`
  - `follow_up`
  - `audit`
  - `empty`
- 页面覆盖 loading、empty、error、403、404 和 503。

v1 不追求完整 CRM、完整病历或完整客服系统，只把现有安全摘要组织成可演示的客户经营时间线。

## 5. 不纳入本阶段

Phase 7 不做：

- AI provider。
- Agent。
- RAG / 知识库真实功能。
- 企业微信。
- HIS / CRM / OTA。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 套餐权益 enforcement。
- 大型平台租户管理。
- 完整治疗记录。
- 完整病历正文。
- 咨询对话全文。
- 自动触达客户。
- 大规模 UI 重构。
- 审计日志完整查询页面。

## 6. 是否新增 API

需要新增只读 API：

```text
GET /api/institution/customers/[customerId]/timeline
```

API 设计原则：

- 从服务端 session 推导 `AccessContext`。
- 不信任 URL、header、body 或浏览器缓存中的 `tenantId`。
- 先校验 `customerId` 属于当前 `context.tenantId`。
- 校验通过后读取同租户客户摘要、预约摘要、随访摘要和结构化时间线事件。
- 如果 PR 2 已完成 `resource_id` enrich，可读取该客户、相关预约和相关随访任务的审计摘要。
- 401 返回登录失效。
- 403 返回无权限。
- 404 返回客户不存在或不属于当前租户。
- 503 返回稳定数据服务不可用文案，不泄露数据库、SQL、连接串或密钥。

建议响应结构：

```ts
type CustomerTimelineResponse = {
  customer: CustomerTimelineCustomerSummary;
  appointments: CustomerTimelineAppointmentSummary[];
  followUpTasks: CustomerTimelineFollowUpSummary[];
  auditEvents: CustomerTimelineAuditSummary[];
  timelineEvents: CustomerTimelineEvent[];
};
```

前端不需要提交 `tenantId`，也不需要依赖返回的 `tenantId` 做授权判断。授权只在服务端完成。

## 7. 是否新增 schema / migration

客户、预约、随访本身不需要新增 schema。现有表已经具备客户摘要、预约摘要、随访任务和同租户客户外键。

Phase 7 允许在 PR 2 中新增最小审计字段：

```text
audit_events.resource_id varchar(96) null
```

建议新增索引：

```text
audit_events_tenant_resource_id_occurred_idx
  on audit_events (tenant_id, resource, resource_id, occurred_at)
```

字段允许为空，用于兼容历史审计事件、登录/权限拒绝等没有明确业务目标资源的事件。

## 8. 最小 audit resource_id enrich 方案

`resource_id` 用来表达审计事件直接作用的业务目标资源：

- 客户创建成功：`resource = customer`，`resource_id = 新客户 id`。
- 客户更新成功：`resource = customer`，`resource_id = 被更新客户 id`。
- 预约创建成功：`resource = appointment`，`resource_id = 新预约 id`。
- 预约更新成功：`resource = appointment`，`resource_id = 被更新预约 id`。
- 随访状态流转成功：`resource = follow_up`，`resource_id = 随访任务 id`。
- 明确绑定到目标记录且目标属于当前租户的 denied 事件，可以写入 `resource_id`。
- 权限拒绝、缺少租户、跨租户拒绝、目标不存在或目标归属未确认的事件，不应为了时间线展示而强行写入用户提交的目标 id。

客户详情 API 聚合审计事件时，可按当前客户上下文解析关联资源：

- `resource = customer` 且 `resource_id = customerId`。
- `resource = appointment` 且 `resource_id` 在该客户预约 id 集合中。
- `resource = follow_up` 且 `resource_id` 在该客户随访任务 id 集合中。

这样可以支持客户时间线和后续审计日志查询，同时避免把业务正文塞入审计表。

## 9. 不使用 metadata jsonb 的原因

Phase 7 不使用自由 `metadata jsonb`：

- 自由 metadata 容易被后续开发放入请求体、咨询片段、病历摘要、手机号、身份证、病历号原文或第三方凭证明文。
- 当前阶段只需要“事件关联到哪个资源”，不需要存储任意上下文。
- `resource_id` 可索引、可测试、可约束，足以支撑客户时间线 v1 和 Phase 8 审计查询基础版。
- 不引入 metadata 可以降低 schema 解释成本、隐私审计成本和查询脱敏成本。

后续如果确实需要更多审计上下文，应单独进入安全 Plan Mode，明确字段白名单、脱敏规则、保留周期、查询权限和测试。

## 10. PII / 医疗隐私边界

Phase 7 只能展示和传输现有脱敏摘要字段，不新增高风险隐私字段。

禁止新增或返回：

- 手机号原文。
- 身份证号。
- 完整病历号。
- 完整治疗记录。
- 完整病历正文。
- 咨询对话全文。
- 客服消息全文。
- 请求体。
- 外部凭证。
- OAuth token。
- Webhook secret。
- API Key。
- 数据库连接串。
- SQL 或错误堆栈。

客户摘要中的 `maskedPhone` 和 `maskedMedicalRecordNo` 必须继续保持脱敏展示值。预约 `note`、随访 `suggestedAction`、客户 `lastTouchSummary` 和 `nextAction` 只能作为脱敏运营摘要展示，不应引导用户输入真实手机号、身份证、完整病历或咨询全文。

## 11. 租户隔离边界

Phase 7 必须延续现有规则：

- 租户编号只能来自服务端 `AccessContext`。
- 客户详情 API 不接受客户端传入的 `tenantId`。
- API 查询必须先确认客户属于当前租户。
- 预约查询必须按 `tenantId + customerId` 过滤。
- 随访查询必须按 `tenantId + customerId` 过滤。
- 审计查询必须按当前租户和已确认的资源 id 集合过滤。
- 平台角色不能通过客户详情 API 读取机构客户敏感明细。
- 403、404 和 503 文案不能泄露目标记录是否属于其他租户。

前端只能把 `customerId` 当作页面定位参数，不能把它当作授权依据。

## 12. 推荐 PR 拆分

### PR 1：Phase 7 spec/plan 文档

范围：

- 新增 Phase 7 design spec。
- 新增 Phase 7 implementation plan。
- 不改代码。
- 不改 API。
- 不改数据库。
- 不改权限、认证或租户隔离。

风险：

- 文档范围过大，误导后续 PR 混入审计查询、治疗记录或 AI。

控制：

- 明确 Phase 7 只做客户详情时间线 v1。
- 明确审计日志完整查询页面后置。
- 明确 PR 2/3/4/5 的边界。

验证：

```bash
git diff --check
```

### PR 2：最小 audit resource_id enrich

范围：

- 新增 `audit_events.resource_id` 字段。
- 新增必要索引。
- 更新 audit event domain 类型和仓储映射。
- 更新客户、预约、随访写入链路中的允许审计，写入已确认目标资源 id。
- 对未确认归属或权限拒绝场景保持 `resource_id = null` 或仅在安全可证明时写入。
- 补充 migration / schema / repository / route 测试。
- 不新增 metadata。
- 不存隐私正文。

风险：

- 把用户提交的跨租户目标 id 直接写入审计并用于客户时间线展示。
- 借 `resource_id` enrich 顺手加入 metadata 或请求体。

控制：

- `resource_id` 只保存资源编号，不保存正文。
- denied 事件只有在目标资源已由服务端确认属于当前租户时才可绑定到目标 id。
- 测试确认审计插入行不包含 metadata、请求体、手机号、身份证、病历号原文或凭证明文。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/server/db/tests src/modules/audit/tests src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

### PR 3：客户详情 timeline 后端 API

范围：

- 新增 `GET /api/institution/customers/[customerId]/timeline`。
- 新增客户详情 timeline repository 查询方法。
- 新增 timeline domain view model。
- 服务端从 session 推导 tenant。
- 先校验 customer 属于当前 tenant。
- 返回客户脱敏摘要、预约摘要、随访摘要、结构化 timeline events。
- 如 PR 2 已完成，可包含与 customer、相关 appointment、相关 follow_up 关联的审计摘要。
- 不返回手机号原文、身份证、病历号原文、病历正文、咨询全文。

风险：

- 前端或 API 通过 URL/header/body 传入 tenantId 造成越权。
- 为了时间线完整性把过多字段透出给前端。
- 404 文案泄露其他租户是否存在同 id 客户。

控制：

- API route 只读取 `AccessContext.tenantId`。
- repository 查询全部带 `tenantId`。
- response DTO 只包含脱敏摘要字段。
- 404 固定为“客户不存在或无权访问”类文案。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessRepository.test.ts src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts src/modules/institution/tests/CustomerTimelineDomain.test.ts
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

### PR 4：客户详情时间线 UI

范围：

- 客户中心增加“查看详情”入口。
- 新增客户详情页面或抽屉。
- 调用客户详情 timeline API。
- 展示客户脱敏摘要、预约、随访和结构化时间线。
- 增加 loading / empty / error / 403 / 404 / 503。
- 复用共享页面状态组件。
- 不接 AI。
- 不接企微。
- 不做自动触达。

风险：

- 页面文案暗示 AI 排序、自动触达或外部同步已经可用。
- UI 展示过多敏感摘要或引导录入真实隐私信息。
- 客户中心导航状态和详情状态互相污染。

控制：

- 时间线文案只描述“现有机构 API 摘要”和“人工处理建议”。
- 不出现“AI 已生成”“自动发送”“企微同步”等未实现能力文案。
- 页面测试覆盖禁止 PII 字段、错误态脱敏和客户详情入口。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/institution/tests/CustomerTimelineShell.test.tsx src/modules/institution/tests/InstitutionPageState.test.tsx
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

### PR 5：Phase 7 smoke / 文档收尾

范围：

- 补充 workspace / customer detail smoke。
- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 标记 Phase 7 完成。
- 不进入审计日志完整查询页面。

风险：

- 收尾时顺手扩大到平台审计查询、治疗记录、AI 或外部连接器。
- 文档与实际完成范围不一致。

控制：

- smoke 只覆盖客户中心进入详情、详情 API mock、时间线展示和错误态。
- 文档只标记 Phase 7 v1 完成，不宣称审计查询页面完成。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/workspace/tests src/modules/institution/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
node scripts/run-vitest.mjs run
```

## 13. Phase 8 审计日志只读查询衔接

Phase 8 可以在 Phase 7 的基础上建设审计日志只读查询基础版：

- 复用 `audit_events.resource_id` 作为目标资源筛选字段。
- 新增审计查询 repository。
- 新增只读 API，支持时间、资源、结果、原因、操作者、租户范围筛选。
- 机构端只能看本租户审计事件。
- 平台或安全审计角色按明确权限看平台范围和跨租户安全事件。
- 不做导出。
- 不做复杂风控。
- 不做告警系统。
- 不做权限模型重构。

Phase 8 需要单独 spec/plan，重点评审平台可见范围、机构可见范围、筛选参数白名单、分页、错误脱敏和审计事件保留策略。
