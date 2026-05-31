# Phase 7 客户详情时间线 v1 实施计划

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**目标：** 建设机构端客户详情时间线 v1，让用户从客户中心进入单客户详情，查看脱敏客户摘要、相关预约、相关随访和结构化时间线。

**架构方案：** Phase 7 采用 A-first 路线，先围绕客户详情时间线组织现有客户、预约、随访真实数据。后续 PR 允许对 `audit_events` 增加最小 `resource_id` 字段，以便客户时间线关联关键操作事件；不增加自由 `metadata jsonb`，不存请求体或隐私正文。

**技术栈：** Next.js App Router、React client components、TypeScript、Vitest、Testing Library、Drizzle、PostgreSQL、现有 `AccessContext` / RBAC / `tenant-business-client` / `InstitutionPageState`。

---

## 总边界

Phase 7 做：

- 客户详情时间线 v1。
- 最小 audit `resource_id` enrich。
- 客户详情 timeline 只读 API。
- 客户详情 UI。
- smoke 和文档收尾。

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

## 文件职责规划

PR 1 只新增：

- `docs/superpowers/specs/2026-05-31-phase7-customer-timeline-v1-design.md`
  - Phase 7 设计、范围、安全边界、PR 拆分和 Phase 8 衔接。
- `docs/superpowers/plans/2026-05-31-phase7-customer-timeline-v1.md`
  - 后续 PR 执行计划、风险和验证命令。

后续 PR 预计涉及：

- `src/server/db/schema.ts`
  - PR 2 增加 `audit_events.resource_id` 和索引。
- `drizzle/*.sql`
  - PR 2 生成 migration。
- `src/modules/audit/domain/audit-events.ts`
  - PR 2 扩展审计事件类型，加入可选 `resourceId`。
- `src/modules/audit/server/audit-event-repository.ts`
  - PR 2 映射 `resourceId` 写入；PR 3 可增加客户时间线审计查询。
- `src/modules/institution/server/tenant-business-api.ts`
  - PR 2 让审计事件支持安全的目标资源 id。
- `src/app/api/institution/customers/[customerId]/timeline/route.ts`
  - PR 3 新增客户详情 timeline API。
- `src/modules/institution/server/tenant-business-repository.ts`
  - PR 3 增加按当前租户和客户查询客户、预约、随访的方法。
- `src/modules/institution/domain/customer-timeline.ts`
  - PR 3 新增纯函数 view model，构建结构化 timeline events。
- `src/modules/institution/client/customer-timeline-client.ts`
  - PR 4 封装客户详情 timeline API client。
- `src/modules/institution/components/CustomerTimelineShell.tsx`
  - PR 4 新增客户详情时间线 UI。
- `src/modules/institution/components/CustomerCenterShell.tsx`
  - PR 4 增加“查看详情”入口。
- `src/modules/institution/tests/*`
  - PR 2/3/4 补充 audit、API、domain 和 UI 测试。
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - PR 5 补 smoke。
- `README.md`
  - PR 5 标记 Phase 7 完成。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - PR 5 更新路线图。
- `docs/devlog/2026-05-31.md`
  - PR 5 记录 Phase 7 结果。

## PR 1：Phase 7 spec/plan 文档

**范围：**

- 新增 Phase 7 design spec。
- 新增 Phase 7 implementation plan。
- 只做文档。
- 不改业务代码。
- 不改页面。
- 不改测试。
- 不改 API route。
- 不改数据库 schema / migration。
- 不改权限、认证或租户隔离。

**风险：**

- 计划文档边界不清，导致后续 PR 混入审计日志完整查询、治疗记录、AI 或外部连接器。

**控制：**

- 文档明确 Phase 7 只做客户详情时间线 v1。
- 文档明确审计日志只读查询后置到 Phase 8。
- 文档明确 `metadata jsonb`、请求体、病历正文、咨询全文、手机号、身份证和病历号原文禁止进入审计或客户详情。

**步骤：**

- [x] **步骤 1：从最新 main 创建文档分支**

运行：

```bash
git switch -c docs/phase7-customer-timeline-plan
```

预期：切换到 `docs/phase7-customer-timeline-plan`。

- [x] **步骤 2：新增 Phase 7 设计文档**

新建：

```text
docs/superpowers/specs/2026-05-31-phase7-customer-timeline-v1-design.md
```

文档必须覆盖：

- Phase 7 目标。
- 为什么优先做客户详情时间线 v1。
- 为什么审计日志只读查询后置。
- 客户详情时间线 v1 范围。
- 不纳入本阶段的内容。
- 是否新增 API。
- 是否新增 schema / migration。
- 最小 audit `resource_id` enrich 方案。
- 不使用 `metadata jsonb` 的原因。
- PII / 医疗隐私边界。
- 租户隔离边界。
- 推荐 PR 拆分。
- Phase 8 审计日志只读查询衔接方式。

- [x] **步骤 3：新增 Phase 7 实施计划**

新建：

```text
docs/superpowers/plans/2026-05-31-phase7-customer-timeline-v1.md
```

计划必须覆盖：

- 标准计划页首。
- 总边界。
- 文件职责规划。
- PR 1 到 PR 5 的范围、风险、控制和验证方式。
- 本 PR 只做文档，不进入 PR 2/3/4/5 的代码执行。

- [x] **步骤 4：验证 Markdown diff**

运行：

```bash
git diff --check
```

预期：退出码 0，无 trailing whitespace。

- [ ] **步骤 5：提交并创建 Draft PR**

运行：

```bash
git add docs/superpowers/specs/2026-05-31-phase7-customer-timeline-v1-design.md docs/superpowers/plans/2026-05-31-phase7-customer-timeline-v1.md
git commit -m "docs: 固化 Phase 7 客户详情时间线 v1 计划"
git push -u origin docs/phase7-customer-timeline-plan
```

Draft PR 标题：

```text
docs: 固化 Phase 7 客户详情时间线 v1 计划
```

PR 描述必须说明：

- 本次只做 Phase 7 PR 1。
- 只新增 spec/plan 文档。
- 不改代码。
- 不改 API。
- 不改数据库。
- 不改权限、认证、租户隔离。
- 不进入客户详情代码开发。
- 不进入审计日志查询页面开发。

## PR 2：最小 audit resource_id enrich

**范围：**

- 新增 `audit_events.resource_id` 字段。
- 新增必要索引。
- 更新 audit 写入。
- 补充 migration / schema / 测试。
- 不加 metadata。
- 不存隐私正文。

**建议涉及文件：**

- 修改：`src/server/db/schema.ts`
- 新增：`drizzle/<generated-migration>.sql`
- 修改：`src/modules/audit/domain/audit-events.ts`
- 修改：`src/modules/audit/server/audit-event-repository.ts`
- 修改：`src/modules/institution/server/tenant-business-api.ts`
- 修改：`src/app/api/institution/customers/route.ts`
- 修改：`src/app/api/institution/appointments/route.ts`
- 修改：`src/app/api/institution/followups/route.ts`
- 修改：`src/modules/audit/tests/AuditEventsDomain.test.ts`
- 修改：`src/modules/audit/tests/AuditEventRepository.test.ts`
- 修改：`src/server/db/tests/Schema.test.ts`
- 修改：`src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`

**实现要求：**

- `resourceId` 在 TypeScript 领域模型中使用 camelCase。
- 数据库列使用 `resource_id`。
- 旧事件兼容 `resource_id = null`。
- 客户、预约、随访成功写入事件绑定确认后的目标资源 id。
- 权限拒绝、缺少租户、跨租户拒绝、目标不存在或目标归属未确认时，不为了展示时间线而记录用户提交的目标 id。
- 测试确认审计写入行不包含 `metadata`、请求体、手机号、身份证、病历号原文、病历正文、咨询全文、token、secret 或连接串。

**风险：**

- 把跨租户目标 id 或未确认归属的请求 id 写入 `resource_id`，再被客户详情误展示。
- 加入自由 metadata 后扩大隐私面。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/server/db/tests src/modules/audit/tests src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## PR 3：客户详情 timeline 后端 API

**范围：**

- 新增 `GET /api/institution/customers/[customerId]/timeline`。
- 服务端从 session 推导 tenant。
- 先校验 customer 属于当前 tenant。
- 返回客户脱敏摘要、预约摘要、随访摘要、结构化 timeline events。
- 如 PR 2 已完成，可包含与 customer 关联的审计摘要。
- 不返回手机号原文、身份证、病历号原文、病历正文、咨询全文。

**建议涉及文件：**

- 新增：`src/app/api/institution/customers/[customerId]/timeline/route.ts`
- 新增：`src/modules/institution/domain/customer-timeline.ts`
- 修改：`src/modules/institution/server/tenant-business-repository.ts`
- 修改：`src/modules/audit/server/audit-event-repository.ts`
- 新增：`src/modules/institution/tests/CustomerTimelineDomain.test.ts`
- 新增：`src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts`
- 修改：`src/modules/institution/tests/TenantBusinessRepository.test.ts`

**实现要求：**

- API route 不接受 `tenantId` query、header 或 body。
- 404 文案不泄露其他租户是否存在同 id 客户。
- timeline event 只包含类型、标题、摘要、发生时间、来源资源和状态标签。
- audit event 摘要只包含 `eventId`、`actorId`、`actorRole`、`resource`、`resourceId`、`action`、`result`、`reason`、`occurredAt`、`source`。
- 预约和随访必须按 `tenantId + customerId` 查询。
- 审计事件必须按当前租户和已确认资源 id 集合查询。

**风险：**

- 用前端传入租户做查询。
- API 返回过多客户或审计字段。
- 数据库异常泄露连接串或 SQL。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessRepository.test.ts src/modules/institution/tests/CustomerTimelineDomain.test.ts src/modules/institution/tests/CustomerTimelineApiRoutes.test.ts
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## PR 4：客户详情时间线 UI

**范围：**

- 客户中心增加“查看详情”入口。
- 新增客户详情页面或抽屉。
- 展示脱敏摘要、预约、随访、时间线。
- 增加 loading / empty / error / 403 / 404。
- 不接 AI。
- 不接企微。
- 不做自动触达。

**建议涉及文件：**

- 新增：`src/modules/institution/client/customer-timeline-client.ts`
- 新增：`src/modules/institution/components/CustomerTimelineShell.tsx`
- 修改：`src/modules/institution/components/CustomerCenterShell.tsx`
- 新增：`src/modules/institution/tests/CustomerTimelineClient.test.ts`
- 新增：`src/modules/institution/tests/CustomerTimelineShell.test.tsx`
- 修改：`src/modules/institution/tests/InstitutionBusinessShells.test.tsx`

**实现要求：**

- 客户中心入口只传 `customerId`。
- 详情 API client 不接受 `tenantId` 参数。
- 页面复用 `InstitutionPageState`。
- 详情页展示字段必须来自 timeline API 的脱敏 response DTO。
- 页面文案不出现“AI 已生成”“自动触达”“企微同步”“实时外部同步”等未实现能力。
- 错误态不透出数据库、SQL、连接串或密钥。

**风险：**

- 页面把详情做成完整病历或客服会话入口。
- 客户列表与详情状态互相污染。
- 空态和错误态不一致，影响 Phase 6 已稳定的页面状态体验。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests/CustomerTimelineClient.test.ts src/modules/institution/tests/CustomerTimelineShell.test.tsx src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/institution/tests/InstitutionPageState.test.tsx
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## PR 5：Phase 7 smoke / 文档收尾

**范围：**

- 补充 workspace / customer detail smoke。
- 更新 README / roadmap / devlog。
- 标记 Phase 7 完成。
- 不进入审计日志完整查询页面。

**建议涉及文件：**

- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-05-31.md`
- 修改：`docs/superpowers/specs/2026-05-31-phase7-customer-timeline-v1-design.md`
- 修改：`docs/superpowers/plans/2026-05-31-phase7-customer-timeline-v1.md`

**实现要求：**

- smoke 覆盖客户中心进入客户详情。
- smoke 覆盖客户详情 API mock records。
- smoke 覆盖客户详情 loading / empty / error 或 404 中至少一个边界状态。
- README 和 roadmap 只声明客户详情时间线 v1 完成，不声明审计日志查询页面完成。
- devlog 明确 Phase 7 未进入 AI、企微、知识库真实功能、支付、完整病历或审计日志完整查询。

**风险：**

- 收尾文档过度宣传 Phase 7 能力。
- smoke 测试触发后续占位模块或外部能力请求。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/workspace/tests src/modules/institution/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
node scripts/run-vitest.mjs run
```

## Phase 8 审计日志只读查询衔接

Phase 8 推荐基于 Phase 7 的 `resource_id` enrich 单独进入 Plan Mode。

Phase 8 建议范围：

- 新增审计事件只读查询 API。
- 支持基础筛选：时间、资源、动作、结果、原因、操作者、租户范围。
- 机构端只能看本租户事件。
- 平台或安全审计角色按明确权限看平台范围或跨租户安全事件。
- 不做导出。
- 不做复杂风控。
- 不做告警系统。
- 不做权限模型重构。

Phase 8 必须重新评估：

- 平台可见范围。
- 机构可见范围。
- 安全审计员入口和演示账号。
- 筛选参数白名单。
- 分页和默认时间窗口。
- 错误脱敏。
- 审计事件保留策略。
