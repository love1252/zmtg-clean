# Phase 14 治疗摘要管理能力 v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为机构端建设治疗摘要只读管理能力，支持跨客户列表、白名单筛选、分页和安全详情查看。

**Architecture:** Phase 14 v1 复用 Phase 12 的 `treatment_summaries` 表和 Phase 13 的 `treatment_summary` RBAC resource，不新增 schema / migration。实现顺序为：先固化 spec / plan，再新增只读 API 地基，随后接入机构端 UI，最后补 workspace smoke 和文档收尾。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Vitest、Testing Library、Drizzle ORM、PostgreSQL、现有 demo access context、现有 `InstitutionPageState`、现有 audit repository。

---

## 当前状态

Phase 13 已完成：

- 治疗摘要写入 payload parser。
- 治疗摘要 repository create。
- `POST /api/institution/customers/[customerId]/treatment-summaries`。
- 客户详情抽屉结构化录入 UI。
- `treatment_summary` access resource 和最小 create / read 权限。
- workspace smoke / README / roadmap / devlog / Phase 13 文档收尾。

Phase 14 PR 1 只新增本文档和设计文档，不进入 API、UI、测试或数据库开发。

## 总边界

Phase 14 做：

- 治疗摘要只读列表。
- 白名单筛选。
- 分页。
- 安全详情查看。
- 当前租户范围查询。
- API DTO 白名单。
- loading / empty / error / 403 / 503。
- smoke 和文档收尾。

Phase 14 不做：

- 治疗摘要新增。
- 治疗摘要编辑。
- 治疗摘要删除。
- 治疗后护理 / 随访联动。
- AI provider。
- AI 生成治疗建议。
- Agent。
- RAG / 知识库真实能力。
- 企业微信。
- HIS / CRM / OTA。
- API Key。
- OAuth。
- Webhook。
- 支付。
- 合同。
- 发票。
- 完整治疗记录正文。
- 完整病历正文。
- 诊疗原文。
- 咨询对话全文。
- 图片 / 文件上传。
- 自动触达客户。
- 大规模 UI 重构。

## 文件职责规划

### PR 1 只新增文档

新增：

- `docs/superpowers/specs/2026-05-31-phase14-treatment-summary-management-v1-design.md`
  - Phase 14 目标、方向选择、API 设计、筛选白名单、DTO 白名单、租户隔离、隐私禁区、schema 策略和 PR 拆分。
- `docs/superpowers/plans/2026-05-31-phase14-treatment-summary-management-v1.md`
  - Phase 14 后续 PR 执行计划、文件范围、风险和验证方式。

不修改：

- TypeScript 业务代码。
- React 页面。
- 测试文件。
- API route。
- 数据库 schema。
- migration。
- 权限、认证或租户隔离。

### PR 2 建议文件

建议新增：

- `src/modules/institution/server/treatment-summary-query-parser.ts`
  - 解析 `customerId`、`treatmentProject`、`riskLevel`、`from`、`to`、`limit`、`cursor`。
  - 拒绝 `tenantId` 和所有未知参数。
  - 生成稳定 query object 和 opaque cursor。
- `src/app/api/institution/treatment-summaries/route.ts`
  - 新增机构端治疗摘要只读列表 API。
  - 从 access context 推导 `tenantId`。
  - 返回 `{ records, pageInfo }`。
- `src/modules/institution/tests/TreatmentSummaryQueryParser.test.ts`
  - 覆盖筛选白名单、重复参数、未知参数、`tenantId` 拒绝、日期范围、limit 和 cursor。
- `src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts`
  - 覆盖 200、400、401、403、503、租户隔离、DTO 白名单和敏感字段不返回。

建议修改：

- `src/modules/institution/domain/treatment-summaries.ts`
  - 增加 `InstitutionTreatmentSummaryListItem`、`TreatmentSummaryListQuery`、`TreatmentSummaryListPageInfo`。
  - 增加 list DTO mapper，不能直接返回数据库行。
- `src/modules/institution/server/treatment-summary-repository.ts`
  - 增加 `listTreatmentSummariesByTenant()`。
  - 查询必须按 `tenantId` 过滤，支持白名单筛选和 cursor 分页。
- `src/modules/institution/tests/TreatmentSummaryDomain.test.ts`
  - 补 list DTO 白名单和禁止字段扫描。
- `src/modules/institution/tests/TreatmentSummaryRepository.test.ts`
  - 补 list 查询条件、排序、分页、跨租户过滤和治疗项目筛选测试。
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
  - 如 PR 2 新增治疗摘要 read allowed / denied 审计断言，可补充不含请求体和敏感字段测试。

不修改：

- `src/server/db/schema.ts`
- `drizzle/*.sql`
- `src/modules/security/domain/access-control.ts`
- `src/modules/security/server/access-context.ts`

### PR 3 建议文件

建议新增：

- `src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
  - 治疗摘要只读列表、筛选表单、分页按钮和安全详情抽屉。
  - 复用 `InstitutionPageState` 和 `InstitutionSectionHeader`。
- `src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`
  - 覆盖 loading、empty、error、403、503、筛选、分页、详情和敏感字段不展示。

建议修改：

- `src/modules/institution/client/tenant-business-client.ts`
  - 增加 `listTreatmentSummaries()` client helper。
  - 只拼接白名单 query 参数，不发送 `tenantId`。
- `src/modules/workspace/domain/institution-dashboard.ts`
  - 增加机构端导航 view id，例如 `treatmentSummaries`。
  - 增加“治疗摘要”导航项。
- `src/modules/workspace/components/InstitutionWorkspace.tsx`
  - 把治疗摘要加入已接入页面列表。
  - 渲染 `TreatmentSummaryManagementShell`。
- `src/modules/institution/tests/TenantBusinessClient.test.ts`
  - 覆盖 client helper 只发送白名单参数、不发送 `tenantId`、隐藏敏感错误。
- `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
  - 覆盖治疗摘要管理 UI 行为。
- `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
  - 覆盖导航项边界。

不修改：

- API route 行为，除非 PR 3 UI 测试发现 PR 2 的返回结构缺陷；这种缺陷应单独回到 PR 2 修正。
- 数据库 schema / migration。
- 权限、认证或租户隔离。

### PR 4 建议文件

建议修改：

- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 覆盖机构端进入治疗摘要管理入口。
  - 覆盖列表展示、筛选请求、分页、安全详情和敏感字段不展示。
  - 确认不发送新增、编辑、删除请求。
- `README.md`
  - 标记 Phase 14 完成。
  - 说明治疗摘要管理 v1 能力和边界。
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 标记 Phase 14 完成，并后置随访联动、RAG、平台商业化增强。
- `docs/devlog/2026-05-31.md`
  - 增加 Phase 14 PR 1-4 执行记录。
- `docs/superpowers/specs/2026-05-31-phase14-treatment-summary-management-v1-design.md`
  - 更新为完成状态。
- `docs/superpowers/plans/2026-05-31-phase14-treatment-summary-management-v1.md`
  - 更新完成摘要和边界。

不修改：

- 治疗摘要业务逻辑。
- API route。
- 数据库 schema / migration。
- 权限、认证或租户隔离。

## PR 1：Phase 14 spec / plan 文档

**Files:**

- Create: `docs/superpowers/specs/2026-05-31-phase14-treatment-summary-management-v1-design.md`
- Create: `docs/superpowers/plans/2026-05-31-phase14-treatment-summary-management-v1.md`

- [ ] **Step 1: 创建 design spec**

写入 `docs/superpowers/specs/2026-05-31-phase14-treatment-summary-management-v1-design.md`，必须包含：

- Phase 14 目标。
- 为什么优先做治疗摘要管理能力 v1。
- 为什么治疗后护理 / 随访联动、RAG、平台商业化增强后置。
- 治疗摘要管理 v1 的范围。
- 不纳入本阶段的内容。
- 机构端治疗摘要只读列表设计。
- 筛选参数白名单。
- 详情查看边界。
- API 路径设计。
- API DTO 字段白名单。
- 租户隔离设计。
- PII / 医疗隐私禁区。
- 是否新增 schema / migration。
- 推荐 PR 拆分。
- 每个 PR 的范围、风险和验证方式。

- [ ] **Step 2: 创建 implementation plan**

写入 `docs/superpowers/plans/2026-05-31-phase14-treatment-summary-management-v1.md`，必须包含：

- 计划 header。
- 当前状态。
- 总边界。
- 文件职责规划。
- PR 1-4 任务拆分。
- 每个 PR 的风险。
- 每个 PR 的验证命令。
- Phase 14 完成标准。

- [ ] **Step 3: 验证 Markdown diff**

Run:

```bash
git diff --check
```

Expected:

```text
无输出，exit 0
```

- [ ] **Step 4: 提交 PR 1 文档**

Run:

```bash
git add docs/superpowers/specs/2026-05-31-phase14-treatment-summary-management-v1-design.md docs/superpowers/plans/2026-05-31-phase14-treatment-summary-management-v1.md
git commit -m "docs: 固化 Phase 14 治疗摘要管理计划"
```

Expected:

```text
2 files changed
```

## PR 2：治疗摘要列表 domain / query parser / repository / API

**Files:**

- Modify: `src/modules/institution/domain/treatment-summaries.ts`
- Create: `src/modules/institution/server/treatment-summary-query-parser.ts`
- Modify: `src/modules/institution/server/treatment-summary-repository.ts`
- Create: `src/app/api/institution/treatment-summaries/route.ts`
- Create: `src/modules/institution/tests/TreatmentSummaryQueryParser.test.ts`
- Modify: `src/modules/institution/tests/TreatmentSummaryDomain.test.ts`
- Modify: `src/modules/institution/tests/TreatmentSummaryRepository.test.ts`
- Create: `src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts`

- [ ] **Step 1: 写 query parser 失败测试**

在 `src/modules/institution/tests/TreatmentSummaryQueryParser.test.ts` 覆盖：

- 空参数返回默认 query。
- `customerId`、`treatmentProject`、`riskLevel`、`from`、`to`、`limit`、`cursor` 正常解析。
- `tenantId` 返回 400 错误。
- 未知参数返回 400 错误。
- 重复参数返回 400 错误。
- `from > to` 返回 400 错误。
- `limit` 小于 1 或大于 100 返回 400 错误。
- `treatmentProject` 包含 `DATABASE_URL`、`postgres://`、`token`、`secret` 返回 400 错误。

Run:

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryQueryParser.test.ts
```

Expected:

```text
FAIL because treatment-summary-query-parser.ts does not exist yet
```

- [ ] **Step 2: 实现 query parser**

创建 `src/modules/institution/server/treatment-summary-query-parser.ts`：

- `parseTreatmentSummaryQueryParams(params: URLSearchParams)`
- `encodeTreatmentSummaryCursor()`
- `decodeTreatmentSummaryCursor()`
- `DEFAULT_TREATMENT_SUMMARY_QUERY_LIMIT = 50`
- `MAX_TREATMENT_SUMMARY_QUERY_LIMIT = 100`

实现必须拒绝 `tenantId`，并且只接受白名单参数。

- [ ] **Step 3: 补 domain DTO 和 mapper 测试**

修改 `src/modules/institution/tests/TreatmentSummaryDomain.test.ts`：

- 验证 list DTO 只包含白名单字段。
- 验证 list DTO 不包含 `tenantId`。
- 验证 list DTO 不包含客户、预约、随访明细。
- 验证 list DTO 不包含完整正文、PII、SQL、stack、token、secret。

- [ ] **Step 4: 实现 domain DTO**

修改 `src/modules/institution/domain/treatment-summaries.ts`：

- 增加 `InstitutionTreatmentSummaryListItem`。
- 增加 `InstitutionTreatmentSummaryListResponse`。
- 增加 `mapTreatmentSummaryRecordToListItem()`。

mapper 只返回：

- `id`
- `customerId`
- `appointmentId`
- `treatmentDate`
- `treatmentProject`
- `treatmentCategory`
- `treatmentStage`
- `recoveryStage`
- `riskLevel`
- `ownerUserId`
- `summary`
- `nextCareAction`
- `tags`
- `createdAt`
- `updatedAt`

- [ ] **Step 5: 写 repository list 失败测试**

修改 `src/modules/institution/tests/TreatmentSummaryRepository.test.ts`，覆盖：

- 按 `tenantId` 查询。
- `customerId` 筛选。
- `riskLevel` 筛选。
- `from` / `to` 治疗时间筛选。
- `treatmentProject` 参数化筛选。
- `limit + 1` 判断 `hasMore`。
- cursor 分页。
- 混入跨租户数据时不返回。

Run:

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryRepository.test.ts
```

Expected:

```text
FAIL because listTreatmentSummariesByTenant is not implemented yet
```

- [ ] **Step 6: 实现 repository list**

修改 `src/modules/institution/server/treatment-summary-repository.ts`：

- 增加 `listTreatmentSummariesByTenant(input)`。
- 查询条件必须包含 `eq(treatmentSummaries.tenantId, input.tenantId)`。
- 默认排序 `treatmentDate desc, id asc`。
- 查询 `limit + 1` 条生成 `pageInfo`。
- 返回 list DTO 和 `pageInfo`。

- [ ] **Step 7: 写 API route 失败测试**

创建 `src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts`，覆盖：

- 200 返回 `{ records, pageInfo }`。
- 401 未登录。
- 403 平台角色或无治疗摘要读权限。
- 400 `tenantId` 或未知参数。
- 503 repository 异常。
- route 从 access context 推导 `tenantId`。
- DTO 不返回 `tenantId`、客户 / 预约 / 随访明细、完整正文或敏感字段。
- allowed / denied 审计不包含请求体或敏感内容。

Run:

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts
```

Expected:

```text
FAIL because src/app/api/institution/treatment-summaries/route.ts does not exist yet
```

- [ ] **Step 8: 实现 API route**

创建 `src/app/api/institution/treatment-summaries/route.ts`：

- GET only。
- 未登录返回 401。
- `treatment_summary/read_own_tenant` 拒绝返回 403。
- 缺少 `context.tenantId` 返回 403。
- parser 错误返回 400。
- repository 异常返回 503。
- 成功返回安全 DTO。

- [ ] **Step 9: PR 2 验证**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryQueryParser.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryDomain.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryRepository.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts
./node_modules/.bin/tsc --noEmit
git diff --check
```

Expected:

```text
All listed commands exit 0
```

## PR 3：机构端治疗摘要管理 UI

**Files:**

- Modify: `src/modules/institution/client/tenant-business-client.ts`
- Create: `src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
- Create: `src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`
- Modify: `src/modules/institution/tests/TenantBusinessClient.test.ts`
- Modify: `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
- Modify: `src/modules/workspace/domain/institution-dashboard.ts`
- Modify: `src/modules/workspace/components/InstitutionWorkspace.tsx`
- Modify: `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`

- [ ] **Step 1: 写 client helper 测试**

修改 `src/modules/institution/tests/TenantBusinessClient.test.ts`，覆盖：

- `listTreatmentSummaries()` 请求 `/api/institution/treatment-summaries`。
- 只发送白名单 query 参数。
- 不发送 `tenantId`。
- 400 / 401 / 403 / 503 映射为稳定 UI error。
- 错误响应中的 SQL、stack、token、secret、`DATABASE_URL` 被隐藏。

- [ ] **Step 2: 实现 client helper**

修改 `src/modules/institution/client/tenant-business-client.ts`：

- 增加 `TreatmentSummaryListClientQuery`。
- 增加 `listTreatmentSummaries(query, options)`。
- 使用 `URLSearchParams` 只拼接白名单参数。
- 读取 `{ records, pageInfo }`。

- [ ] **Step 3: 写 UI shell 测试**

创建 `src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`，覆盖：

- loading。
- empty。
- 403。
- 503。
- 成功列表。
- 筛选提交。
- 清空筛选。
- 下一页请求。
- 安全详情打开和关闭。
- 不展示敏感字段。
- 不出现新增、编辑、删除按钮。

- [ ] **Step 4: 实现 UI shell**

创建 `src/modules/institution/components/TreatmentSummaryManagementShell.tsx`：

- 复用 `InstitutionSectionHeader`。
- 复用 `InstitutionPageState`。
- 展示筛选控件：客户 ID、治疗项目、风险等级、from、to。
- 展示列表。
- 展示分页按钮。
- 使用本地 state 打开安全详情。
- 不提供 mutation。

- [ ] **Step 5: 接入 workspace 导航**

修改：

- `src/modules/workspace/domain/institution-dashboard.ts`
- `src/modules/workspace/components/InstitutionWorkspace.tsx`
- `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
- `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`

要求：

- 新增“治疗摘要”入口。
- 标记为已接入页面。
- 渲染 `TreatmentSummaryManagementShell`。
- 不影响客户中心、预约中心、智能随访和审计日志现有入口。

- [ ] **Step 6: PR 3 验证**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessClient.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
./node_modules/.bin/tsc --noEmit
git diff --check
```

Expected:

```text
All listed commands exit 0
```

## PR 4：smoke / 文档收尾

**Files:**

- Modify: `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- Modify: `README.md`
- Modify: `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- Modify: `docs/devlog/2026-05-31.md`
- Modify: `docs/superpowers/specs/2026-05-31-phase14-treatment-summary-management-v1-design.md`
- Modify: `docs/superpowers/plans/2026-05-31-phase14-treatment-summary-management-v1.md`

- [ ] **Step 1: 补 workspace smoke**

修改 `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`，覆盖：

- 机构端进入治疗摘要管理。
- 请求 `GET /api/institution/treatment-summaries`。
- 展示治疗摘要列表。
- 按客户 ID、治疗项目、风险等级、时间范围筛选。
- 使用分页。
- 打开安全详情。
- 不展示 `tenantId`、PII、完整正文、SQL、stack、token、secret、`DATABASE_URL`。
- 不发送 POST / PATCH / DELETE。

- [ ] **Step 2: 更新 README**

修改 `README.md`：

- 在当前范围中新增 Phase 14 完成状态。
- 明确治疗摘要管理 v1 是只读列表、筛选、分页和安全详情。
- 明确不包含新增、编辑、删除、完整治疗正文、AI、RAG、外部系统。

- [ ] **Step 3: 更新 roadmap**

修改 `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`：

- 标记 Phase 14 完成。
- 把治疗后护理 / 随访联动、知识库 / RAG、安全基础准备、平台商业化增强继续列为后续。
- 保持完整治疗记录正文、图片 / 文件、AI、外部系统、支付、合同、发票后置。

- [ ] **Step 4: 更新 devlog**

修改 `docs/devlog/2026-05-31.md`：

- 增加 Phase 14 PR 1-4 记录。
- 写清每个 PR 的范围、边界和验证。
- 写清 Phase 14 未新增 schema / migration，未改权限、认证或租户隔离。

- [ ] **Step 5: 更新 Phase 14 文档状态**

修改：

- `docs/superpowers/specs/2026-05-31-phase14-treatment-summary-management-v1-design.md`
- `docs/superpowers/plans/2026-05-31-phase14-treatment-summary-management-v1.md`

要求：

- 标记 Phase 14 已完成。
- 保留 PR 拆分历史。
- 保留不纳入范围。
- 保留后续建议。

- [ ] **Step 6: PR 4 验证**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
git diff --check
```

Expected:

```text
All listed commands exit 0
```

## Phase 14 风险清单

### 风险 1：治疗摘要可见面扩大

控制：

- API 使用 `treatment_summary/read_own_tenant`。
- API 只按当前 `tenantId` 查询。
- DTO 不返回 `tenantId`。
- UI 只展示安全字段。
- smoke 扫描敏感字段。

### 风险 2：列表 API 被用作客户 / 预约 / 随访下钻

控制：

- DTO 只返回客户 ID 和预约 ID 引用，不返回客户、预约、随访明细。
- v1 不提供平台侧治疗摘要查询。
- v1 不提供跳转到平台业务明细。

### 风险 3：项目筛选实现不安全

控制：

- query parser 限制长度和敏感词。
- repository 使用 Drizzle 参数化查询。
- 不拼接 SQL 字符串。
- 测试覆盖 SQL / token / secret 字样不进入输出。

### 风险 4：UI 暗示完整治疗记录

控制：

- 页面文案使用“结构化治疗摘要”和“安全详情”。
- 不使用“完整病历”“治疗记录全文”“诊疗原文”。
- 不出现新增、编辑、删除按钮。

### 风险 5：后续 PR 混入 AI / RAG / 外部系统

控制：

- Phase 14 spec / plan 明确禁止。
- PR 描述必须重复边界。
- smoke 确认没有 AI、RAG、企微、外部系统请求。

## Phase 14 完成标准

Phase 14 完成时应满足：

- 机构端有治疗摘要只读管理入口。
- `GET /api/institution/treatment-summaries` 已完成。
- API 只接受白名单 query 参数。
- API 不接受 `tenantId`。
- API 只返回当前租户治疗摘要。
- API DTO 不返回 `tenantId`。
- API DTO 不返回客户、预约、随访明细。
- UI 支持列表、筛选、分页和安全详情。
- UI 不做新增、编辑、删除。
- smoke 确认不展示 PII、医疗正文、SQL、stack、token、secret、`DATABASE_URL` 或连接串。
- README、roadmap、devlog、Phase 14 spec / plan 已更新完成状态。
- 未新增 schema / migration。
- 未修改权限、认证或租户隔离模型。
- 未进入治疗后护理 / 随访联动、AI、RAG、企微、外部系统、支付、合同或发票。

## PR 描述要求

每个 Phase 14 PR 描述都必须明确：

- 本 PR 属于 Phase 14 的哪一段。
- 本 PR 做了什么。
- 本 PR 没有做什么。
- 是否改 API。
- 是否改数据库。
- 是否改权限、认证、租户隔离。
- 隐私和 PII 边界。
- 运行过的验证命令。

PR 1 描述必须明确：

- 只新增 spec / plan 文档。
- 不改代码。
- 不改 API。
- 不改数据库。
- 不改权限、认证、租户隔离。
- 不进入治疗摘要管理代码开发。
- 不进入 AI / RAG / 企微 / 外部系统开发。
