# Phase 9 平台端租户管理基础版实施计划

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**目标：** 建设平台端租户管理基础版 v1，让平台管理员只读查看租户列表、租户状态、套餐名称和配额上限。

**架构方案：** Phase 9 先新增套餐 / 配额最小持久化模型，再通过 open-platform 模块提供只读 repository、DTO、API 和平台端 UI。平台端只展示租户运营元数据，不展示客户、预约、随访、治疗、咨询或审计请求体等租户业务数据；本阶段不做套餐 enforcement、计费、支付或租户状态变更。

**技术栈：** Next.js App Router、React client components、TypeScript、Vitest、Testing Library、Drizzle、PostgreSQL、现有 `AccessContext` / RBAC / `tenants` / `PlatformConsole` / open-platform 模块。

---

## 当前 PR 状态

本文属于 Phase 9 PR 1：spec / plan 文档。

PR 1 只做：

- 新增 `docs/superpowers/specs/2026-05-31-phase9-platform-tenant-management-v1-design.md`。
- 新增 `docs/superpowers/plans/2026-05-31-phase9-platform-tenant-management-v1.md`。

PR 1 不做：

- 业务代码。
- 页面。
- 测试。
- API route。
- 数据库 schema / migration。
- 权限、认证或租户隔离修改。
- Phase 9 PR 2/3/4/5 的代码执行。

## 总边界

Phase 9 做：

- 平台端租户管理基础版。
- 租户列表只读。
- 租户状态展示。
- 套餐名称展示。
- 客户数上限展示。
- 预约数上限展示。
- 随访任务上限展示。
- AI 调用上限展示，先仅作为字段，不做 enforcement。
- 平台端角色边界测试。
- 敏感字段不返回、不展示测试。
- smoke 和文档收尾。

Phase 9 不做：

- 治疗记录结构化摘要实现。
- 知识库 / RAG 真实能力。
- AI provider。
- Agent。
- 企业微信。
- HIS / CRM / OTA。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 套餐 enforcement。
- 完整平台商业化后台。
- 租户创建 / 修改 / 删除。
- 租户冻结 / 恢复。
- 客户 / 预约 / 随访业务明细下钻。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 自动触达客户。
- 大规模 UI 重构。

## 文件职责规划

PR 1 新增：

- `docs/superpowers/specs/2026-05-31-phase9-platform-tenant-management-v1-design.md`
  - Phase 9 目标、优先级、安全边界、API 建议、schema 决策、DTO 字段边界和 PR 拆分。
- `docs/superpowers/plans/2026-05-31-phase9-platform-tenant-management-v1.md`
  - 后续 PR 执行计划、文件范围、风险和验证方式。

PR 2 预计涉及：

- `src/server/db/schema.ts`
  - 新增 `tenantPlans`、`tenantPlanAssignments` 表定义和索引。
- `drizzle/*.sql`
  - 新增 migration。
- `src/server/db/seed-demo-data.ts`
  - 为 demo 租户写入套餐和套餐分配。
- `src/modules/open-platform/domain/tenant-management.ts`
  - 定义租户管理 DTO、配额字段和安全 mapper。
- `src/modules/open-platform/server/tenant-management-repository.ts`
  - 查询租户、套餐和配额上限。
- `src/server/db/tests/Schema.test.ts`
  - 覆盖新增表和索引。
- `src/server/db/tests/SeedDemoData.test.ts`
  - 覆盖 demo 套餐和分配关系。
- `src/modules/open-platform/tests/OpenPlatformTenantManagementDomain.test.ts`
  - 覆盖 DTO 字段边界和敏感字段禁区。
- `src/modules/open-platform/tests/OpenPlatformTenantManagementRepository.test.ts`
  - 覆盖 repository 查询和 mapper。

PR 3 预计涉及：

- `src/app/api/open-platform/tenants/route.ts`
  - 新增平台端租户只读 API。
- `src/modules/open-platform/tests/OpenPlatformTenantsApiRoute.test.ts`
  - 覆盖角色边界、DTO 字段、错误脱敏和 401 / 403 / 503。

PR 4 预计涉及：

- `src/modules/open-platform/client/open-platform-tenants-client.ts`
  - 封装 `GET /api/open-platform/tenants`。
- `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
  - 平台端租户管理 UI。
- `src/modules/workspace/components/PlatformConsole.tsx`
  - 将“租户管理”导航接入真实租户管理面板。
- `src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`
  - 覆盖 UI 状态和敏感字段不展示。
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 覆盖平台端租户管理入口。

PR 5 预计涉及：

- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 强化 smoke。
- `README.md`
  - 标记 Phase 9 完成。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 更新路线图。
- `docs/devlog/2026-05-31.md`
  - 记录 Phase 9 结果。
- `docs/superpowers/specs/2026-05-31-phase9-platform-tenant-management-v1-design.md`
  - 更新完成状态。
- `docs/superpowers/plans/2026-05-31-phase9-platform-tenant-management-v1.md`
  - 更新完成状态。

## 安全规则总览

平台端租户管理 v1 只返回租户运营元数据。

允许 DTO 字段：

- `id`
- `name`
- `status`
- `createdAt`
- `updatedAt`
- `plan.id`
- `plan.name`
- `quotas.customerLimit`
- `quotas.appointmentLimit`
- `quotas.followUpTaskLimit`
- `quotas.aiCallLimit`

禁止 DTO 字段：

- 客户明细。
- 预约明细。
- 随访任务明细。
- 治疗记录。
- 病历正文。
- 咨询对话。
- 手机号原文。
- 身份证号。
- 病历号原文。
- 审计请求体。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。

角色边界：

- `platform_admin`：可查看租户列表和基础详情。
- `platform_operator`：建议 v1 只看聚合摘要，不默认查看完整租户详情。完整租户列表 API 默认返回 403。
- 机构角色：不可访问平台租户管理 API。
- 本阶段不重构权限模型。

## PR 1：Phase 9 spec/plan 文档

**范围：**

- 新增 Phase 9 design spec。
- 新增 Phase 9 implementation plan。
- 只做文档。
- 不改业务代码。
- 不改页面。
- 不改测试。
- 不改 API route。
- 不改数据库 schema / migration。
- 不改权限、认证或租户隔离。

**涉及文件：**

- 新建：`docs/superpowers/specs/2026-05-31-phase9-platform-tenant-management-v1-design.md`
- 新建：`docs/superpowers/plans/2026-05-31-phase9-platform-tenant-management-v1.md`

**风险：**

- 文档边界不清，导致后续 PR 混入治疗记录、RAG、AI provider、Agent、企微、OAuth、Webhook、支付、合同、发票或套餐 enforcement。
- 计划把 `platform_operator` 默认开放为可查看完整租户详情。
- 计划使用静态配置伪造套餐和配额，导致后续真实商业化模型返工。

**控制：**

- 文档明确 Phase 9 只做平台端租户管理基础版。
- 文档明确只展示租户运营元数据。
- 文档明确 `platform_admin` 可看租户列表和基础详情。
- 文档明确 `platform_operator` v1 不默认查看完整租户详情。
- 文档明确需要最小 schema / migration 支撑真实套餐和配额展示。
- 文档明确不进入 Phase 9 PR 2/3/4/5 代码执行。

**步骤：**

- [x] **步骤 1：从最新 main 创建文档分支**

运行：

```bash
git fetch origin main
git switch -c docs/phase9-platform-tenant-management-plan origin/main
```

预期：切换到 `docs/phase9-platform-tenant-management-plan`。

- [x] **步骤 2：新增 Phase 9 设计文档**

新建：

```text
docs/superpowers/specs/2026-05-31-phase9-platform-tenant-management-v1-design.md
```

文档必须覆盖：

- Phase 9 目标。
- 为什么优先做平台端租户管理基础版。
- 为什么治疗记录和 RAG 后置。
- 平台端租户管理基础版 v1 的范围。
- 不纳入本阶段的内容。
- 平台端可见范围。
- `platform_admin` 与 `platform_operator` 的角色边界建议。
- 租户列表 DTO 字段边界。
- 套餐 / 配额最小模型。
- 是否新增 API。
- 是否新增 schema / migration。
- PII / 租户业务数据禁区。
- 推荐 PR 拆分。
- 每个 PR 的范围、风险和验证方式。

- [x] **步骤 3：新增 Phase 9 实施计划**

新建：

```text
docs/superpowers/plans/2026-05-31-phase9-platform-tenant-management-v1.md
```

计划必须覆盖：

- 标准计划页首。
- 当前 PR 状态。
- 总边界。
- 文件职责规划。
- 安全规则总览。
- PR 1 到 PR 5 的范围、风险、控制和验证方式。

- [ ] **步骤 4：验证 Markdown diff**

运行：

```bash
git diff --check
```

预期：退出码 0，无 trailing whitespace。

本 PR 只修改 Markdown，不运行完整 test/typecheck/build。原因：未修改 TypeScript、页面、测试、API route、数据库 schema / migration、权限、认证或租户隔离。

- [ ] **步骤 5：提交并创建 Draft PR**

运行：

```bash
git add docs/superpowers/specs/2026-05-31-phase9-platform-tenant-management-v1-design.md docs/superpowers/plans/2026-05-31-phase9-platform-tenant-management-v1.md
git commit -m "docs: 固化 Phase 9 平台租户管理计划"
git push -u origin docs/phase9-platform-tenant-management-plan
```

Draft PR 标题：

```text
docs: 固化 Phase 9 平台租户管理计划
```

PR 描述必须说明：

- 本次只做 Phase 9 PR 1。
- 只新增 spec/plan 文档。
- 不改代码。
- 不改 API。
- 不改数据库。
- 不改权限、认证、租户隔离。
- 不进入平台租户管理代码开发。
- 不进入治疗记录或 RAG 开发。

## PR 2：租户套餐 / 配额最小 schema、seed、repository、domain 测试

**范围：**

- 新增最小 schema / migration。
- 新增 seed demo 数据。
- 新增 repository 查询。
- 新增 domain / DTO。
- 新增 schema、seed、domain、repository 测试。
- 不做 API route。
- 不做 UI。
- 不做套餐 enforcement。
- 不做计费、支付、合同或发票。

**建议涉及文件：**

- 修改：`src/server/db/schema.ts`
- 新增：`drizzle/<generated-migration>.sql`
- 修改：`src/server/db/seed-demo-data.ts`
- 新增：`src/modules/open-platform/domain/tenant-management.ts`
- 新增：`src/modules/open-platform/server/tenant-management-repository.ts`
- 修改：`src/server/db/tests/Schema.test.ts`
- 修改或新建：`src/server/db/tests/SeedDemoData.test.ts`
- 新建：`src/modules/open-platform/tests/OpenPlatformTenantManagementDomain.test.ts`
- 新建：`src/modules/open-platform/tests/OpenPlatformTenantManagementRepository.test.ts`

**实现要求：**

- 新增 `tenant_plans` 表，保存套餐名称和配额上限。
- 新增 `tenant_plan_assignments` 表，保存租户到套餐的只读分配关系。
- 为 `demo-tenant-001` 和 `demo-tenant-002` 写入 demo 套餐分配。
- DTO mapper 只输出租户运营元数据。
- Phase 9 v1 不新增 `tenant_quota_snapshots`；当前用量摘要不进入本阶段实现。
- 不读取客户、预约、随访明细来构造 DTO。

**风险：**

- 把配额模型做成 enforcement，影响现有客户/预约/随访写入。
- 把套餐模型扩展成计费、支付或合同模型。
- DTO mapper 泄露业务明细或敏感字段。

**控制：**

- schema 只保存套餐和配额上限。
- repository 只 join `tenants`、`tenant_plans`、`tenant_plan_assignments`。
- 测试显式断言 DTO 不包含客户、预约、随访、治疗、病历、咨询、SQL、stack、token、secret 和 `DATABASE_URL`。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/server/db/tests src/modules/open-platform/tests/OpenPlatformTenantManagementDomain.test.ts src/modules/open-platform/tests/OpenPlatformTenantManagementRepository.test.ts
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## PR 3：平台端租户只读 API、DTO、角色边界和错误脱敏测试

**范围：**

- 新增 `GET /api/open-platform/tenants`。
- 只读。
- 平台角色访问。
- 不返回租户业务明细。
- 不改权限模型。
- 不做 UI。

**建议涉及文件：**

- 新增：`src/app/api/open-platform/tenants/route.ts`
- 新建：`src/modules/open-platform/tests/OpenPlatformTenantsApiRoute.test.ts`
- 可修改：`src/modules/open-platform/domain/tenant-management.ts`
- 可修改：`src/modules/open-platform/server/tenant-management-repository.ts`

**实现要求：**

- 未登录返回 401，且不初始化数据库。
- `platform_admin` 可访问，返回 `records`。
- `platform_operator` 对完整租户列表返回 403。
- 机构角色返回 403。
- 数据库异常返回 503，且不泄露 SQL、stack、token、secret、`DATABASE_URL` 或连接串。
- API 不接受前端用 query、header 或 body 扩大可见范围。
- API v1 不支持创建、修改、冻结、恢复、删除或套餐变更。

**风险：**

- 把 `platform_operator` 默认开放为可查看完整租户详情。
- API 返回业务明细或敏感字段。
- API 路径和 Phase 8 平台审计路径不一致。

**控制：**

- 使用 `GET /api/open-platform/tenants`。
- 复用现有访问上下文和角色语义。
- 测试覆盖 `platform_admin`、`platform_operator`、`tenant_admin`、401、403 和 503。
- DTO 测试覆盖敏感字段禁区。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/open-platform/tests/OpenPlatformTenantsApiRoute.test.ts src/modules/open-platform/tests/OpenPlatformTenantManagementDomain.test.ts src/modules/open-platform/tests/OpenPlatformTenantManagementRepository.test.ts
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## PR 4：平台端租户管理 UI

**范围：**

- 平台端租户管理页面接入真实 API。
- 展示租户列表、状态、套餐 / 配额。
- loading、empty、error、403、503。
- 不做创建 / 修改 / 冻结 / 删除。
- 不做业务明细下钻。

**建议涉及文件：**

- 新增：`src/modules/open-platform/client/open-platform-tenants-client.ts`
- 新增：`src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
- 修改：`src/modules/workspace/components/PlatformConsole.tsx`
- 新增：`src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`
- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

**实现要求：**

- 点击平台导航“租户管理”时展示真实租户管理面板。
- 面板调用 `/api/open-platform/tenants`，使用 `{ cache: 'no-store' }`。
- 展示租户 ID、租户名称、状态、创建时间、更新时间、套餐名称和配额上限。
- 不展示客户、预约、随访、治疗、病历、咨询或审计请求体。
- 不出现“创建租户”“冻结租户”“删除租户”“修改套餐”“支付”“发票”等未实现操作。
- 平台总览中的静态增长、调用、收入等展示不得被描述为真实租户管理 API 数据。

**风险：**

- UI 暗示租户状态管理、套餐变更或计费能力已经实现。
- UI 为平台用户提供业务明细入口。
- 复用静态平台总览数据导致真实/静态边界不清。

**控制：**

- UI 文案明确“只读租户运营元数据”。
- 不增加 mutation 按钮。
- workspace smoke 验证租户管理入口只触发 `/api/open-platform/tenants`，不触发机构业务 API。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## PR 5：Phase 9 smoke / 文档收尾

**范围：**

- 补 smoke 测试。
- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 更新 Phase 9 spec / plan 完成状态。
- 标记 Phase 9 完成。

**建议涉及文件：**

- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-05-31.md`
- 修改：`docs/superpowers/specs/2026-05-31-phase9-platform-tenant-management-v1-design.md`
- 修改：`docs/superpowers/plans/2026-05-31-phase9-platform-tenant-management-v1.md`

**实现要求：**

- smoke 覆盖平台端进入“租户管理”。
- smoke 覆盖展示租户运营元数据。
- smoke 覆盖不展示业务明细和敏感字段。
- smoke 覆盖不触发创建、修改、冻结、恢复、删除、支付、计费或套餐 enforcement 请求。
- README / roadmap / devlog 明确 Phase 9 完成范围和未做内容。

**风险：**

- 收尾文档误写成 Phase 9 已支持完整平台商业化后台。
- 收尾文档误写成已支持套餐 enforcement、租户冻结/恢复或计费。

**控制：**

- 文档只标记租户管理基础版只读完成。
- 明确治疗记录、RAG、AI、企微、OAuth、Webhook、支付、计费、合同、发票和套餐 enforcement 仍后置。

**验证：**

```bash
git diff --check
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## 执行交接

Phase 9 PR 1 完成并合并后，下一步进入 PR 2：租户套餐 / 配额最小 schema、seed、repository、domain 测试。

执行 PR 2 前请先确认：

- 是否采用 `tenant_plans` + `tenant_plan_assignments` 两表模型。
- 是否继续不实现当前用量摘要。
- 是否保持 `platform_operator` 不访问完整租户详情。

确认后使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 按本计划逐项执行。
