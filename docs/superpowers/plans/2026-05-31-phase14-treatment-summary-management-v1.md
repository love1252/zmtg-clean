# Phase 14 治疗摘要管理能力 v1 实施计划

> 状态：Phase 14 已完成。PR 1 完成 spec / plan 文档，PR 2 完成治疗摘要列表 API、query parser、repository list 和 DTO，PR 3 完成机构端治疗摘要管理 UI，PR 4 完成 smoke / 文档收尾。

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**目标：** 为机构端建设治疗摘要只读管理能力，支持跨客户列表、白名单筛选、分页和安全详情查看。

**架构方案：** Phase 14 v1 复用 Phase 12 的 `treatment_summaries` 表和 Phase 13 的 `treatment_summary` RBAC 资源，不新增 schema / migration。实现顺序为：先固化设计 / 计划文档，再新增只读 API 地基，随后接入机构端 UI，最后补工作区入口冒烟测试（smoke）和文档收尾。

**技术栈：** Next.js 16 App Router、React 19、TypeScript、Vitest、Testing Library、Drizzle ORM、PostgreSQL、现有 demo 访问上下文、现有 `InstitutionPageState`、现有审计仓储层。

---

## 当前状态

Phase 14 已完成：

- PR 1：Phase 14 spec / plan 文档已完成。
- PR 2：治疗摘要列表 query parser、repository `listTreatmentSummariesByTenant`、DTO 白名单和 `GET /api/institution/treatment-summaries` 已完成。
- PR 3：机构端治疗摘要管理 UI 已完成，支持列表、基础筛选、加载更多和安全详情查看。
- PR 4：工作区入口冒烟测试（smoke）、README、roadmap、devlog 和 Phase 14 文档收尾已完成。

Phase 14 未新增 schema / migration，未改权限、认证或租户隔离模型，未进入治疗摘要新增 / 编辑 / 删除、完整治疗记录正文、完整病历正文、咨询对话全文、AI、RAG、企微或外部系统。

## 总边界

Phase 14 做：

- 治疗摘要只读列表。
- 白名单筛选。
- 分页。
- 安全详情查看。
- 当前租户范围查询。
- API DTO 白名单。
- 加载态 / 空态 / 错误态 / 403 / 503。
- 冒烟测试（smoke）和文档收尾。

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
- API 路由。
- 数据库 schema。
- migration。
- 权限、认证或租户隔离。

### PR 2 建议文件

建议新增：

- `src/modules/institution/server/treatment-summary-query-parser.ts`
  - 解析 `customerId`、`treatmentProject`、`riskLevel`、`from`、`to`、`limit`、`cursor`。
  - 拒绝 `tenantId` 和所有未知参数。
  - 生成稳定查询对象和不透明游标。
- `src/app/api/institution/treatment-summaries/route.ts`
  - 新增机构端治疗摘要只读列表 API。
  - 从访问上下文推导 `tenantId`。
  - 返回 `{ records, pageInfo }`。
- `src/modules/institution/tests/TreatmentSummaryQueryParser.test.ts`
  - 覆盖筛选白名单、重复参数、未知参数、`tenantId` 拒绝、日期范围、limit 和 cursor。
- `src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts`
  - 覆盖 200、400、401、403、503、租户隔离、DTO 白名单和敏感字段不返回。

建议修改：

- `src/modules/institution/domain/treatment-summaries.ts`
  - 增加 `InstitutionTreatmentSummaryListItem`、`TreatmentSummaryListQuery`、`TreatmentSummaryListPageInfo`。
  - 增加列表 DTO 映射器，不能直接返回数据库行。
- `src/modules/institution/server/treatment-summary-repository.ts`
  - 增加 `listTreatmentSummariesByTenant()`。
  - 查询必须按 `tenantId` 过滤，支持白名单筛选和 cursor 分页。
- `src/modules/institution/tests/TreatmentSummaryDomain.test.ts`
  - 补列表 DTO 白名单和禁止字段扫描。
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
  - 覆盖加载态、空态、错误态、403、503、筛选、分页、详情和敏感字段不展示。

建议修改：

- `src/modules/institution/client/tenant-business-client.ts`
  - 增加 `listTreatmentSummaries()` 客户端辅助方法。
  - 只拼接白名单查询参数，不发送 `tenantId`。
- `src/modules/workspace/domain/institution-dashboard.ts`
  - 增加机构端导航 view id，例如 `treatmentSummaries`。
  - 增加“治疗摘要”导航项。
- `src/modules/workspace/components/InstitutionWorkspace.tsx`
  - 把治疗摘要加入已接入页面列表。
  - 渲染 `TreatmentSummaryManagementShell`。
- `src/modules/institution/tests/TenantBusinessClient.test.ts`
  - 覆盖客户端辅助方法只发送白名单参数、不发送 `tenantId`、隐藏敏感错误。
- `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
  - 覆盖治疗摘要管理 UI 行为。
- `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
  - 覆盖导航项边界。

不修改：

- API 路由行为，除非 PR 3 UI 测试发现 PR 2 的返回结构缺陷；这种缺陷应单独回到 PR 2 修正。
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
- API 路由。
- 数据库 schema / migration。
- 权限、认证或租户隔离。

## PR 1：Phase 14 设计 / 计划文档

**文件：**

- 新建：`docs/superpowers/specs/2026-05-31-phase14-treatment-summary-management-v1-design.md`
- 新建：`docs/superpowers/plans/2026-05-31-phase14-treatment-summary-management-v1.md`

- [ ] **步骤 1：创建设计规格文档**

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

- [ ] **步骤 2：创建实施计划文档**

写入 `docs/superpowers/plans/2026-05-31-phase14-treatment-summary-management-v1.md`，必须包含：

- 计划页头。
- 当前状态。
- 总边界。
- 文件职责规划。
- PR 1-4 任务拆分。
- 每个 PR 的风险。
- 每个 PR 的验证命令。
- Phase 14 完成标准。

- [ ] **步骤 3：验证 Markdown 差异**

运行：

```bash
git diff --check
```

预期：

```text
无输出，exit 0
```

- [ ] **步骤 4：提交 PR 1 文档**

运行：

```bash
git add docs/superpowers/specs/2026-05-31-phase14-treatment-summary-management-v1-design.md docs/superpowers/plans/2026-05-31-phase14-treatment-summary-management-v1.md
git commit -m "docs: 固化 Phase 14 治疗摘要管理计划"
```

预期：

```text
2 files changed
```

## PR 2：治疗摘要列表领域类型 / 查询参数解析器 / 仓储层 / API

**文件：**

- 修改：`src/modules/institution/domain/treatment-summaries.ts`
- 新建：`src/modules/institution/server/treatment-summary-query-parser.ts`
- 修改：`src/modules/institution/server/treatment-summary-repository.ts`
- 新建：`src/app/api/institution/treatment-summaries/route.ts`
- 新建：`src/modules/institution/tests/TreatmentSummaryQueryParser.test.ts`
- 修改：`src/modules/institution/tests/TreatmentSummaryDomain.test.ts`
- 修改：`src/modules/institution/tests/TreatmentSummaryRepository.test.ts`
- 新建：`src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts`

- [ ] **步骤 1：写查询参数解析器失败测试**

在 `src/modules/institution/tests/TreatmentSummaryQueryParser.test.ts` 覆盖：

- 空参数返回默认查询对象。
- `customerId`、`treatmentProject`、`riskLevel`、`from`、`to`、`limit`、`cursor` 正常解析。
- `tenantId` 返回 400 错误。
- 未知参数返回 400 错误。
- 重复参数返回 400 错误。
- `from > to` 返回 400 错误。
- `limit` 小于 1 或大于 100 返回 400 错误。
- `treatmentProject` 包含 `DATABASE_URL`、`postgres://`、`token`、`secret` 返回 400 错误。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryQueryParser.test.ts
```

预期：

```text
预期失败：`treatment-summary-query-parser.ts` 尚不存在
```

- [ ] **步骤 2：实现查询参数解析器**

创建 `src/modules/institution/server/treatment-summary-query-parser.ts`：

- `parseTreatmentSummaryQueryParams(params: URLSearchParams)`
- `encodeTreatmentSummaryCursor()`
- `decodeTreatmentSummaryCursor()`
- `DEFAULT_TREATMENT_SUMMARY_QUERY_LIMIT = 50`
- `MAX_TREATMENT_SUMMARY_QUERY_LIMIT = 100`

实现必须拒绝 `tenantId`，并且只接受白名单参数。

- [ ] **步骤 3：补领域 DTO 和映射器测试**

修改 `src/modules/institution/tests/TreatmentSummaryDomain.test.ts`：

- 验证列表 DTO 只包含白名单字段。
- 验证列表 DTO 不包含 `tenantId`。
- 验证列表 DTO 不包含客户、预约、随访明细。
- 验证列表 DTO 不包含完整正文、PII、SQL、stack、token、secret。

- [ ] **步骤 4：实现 domain DTO**

修改 `src/modules/institution/domain/treatment-summaries.ts`：

- 增加 `InstitutionTreatmentSummaryListItem`。
- 增加 `InstitutionTreatmentSummaryListResponse`。
- 增加 `mapTreatmentSummaryRecordToListItem()`。

映射器只返回：

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

- [ ] **步骤 5：写仓储层列表查询失败测试**

修改 `src/modules/institution/tests/TreatmentSummaryRepository.test.ts`，覆盖：

- 按 `tenantId` 查询。
- `customerId` 筛选。
- `riskLevel` 筛选。
- `from` / `to` 治疗时间筛选。
- `treatmentProject` 参数化筛选。
- `limit + 1` 判断 `hasMore`。
- cursor 分页。
- 混入跨租户数据时不返回。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryRepository.test.ts
```

预期：

```text
预期失败：`listTreatmentSummariesByTenant` 尚未实现
```

- [ ] **步骤 6：实现仓储层列表查询**

修改 `src/modules/institution/server/treatment-summary-repository.ts`：

- 增加 `listTreatmentSummariesByTenant(input)`。
- 查询条件必须包含 `eq(treatmentSummaries.tenantId, input.tenantId)`。
- 默认排序 `treatmentDate desc, id asc`。
- 查询 `limit + 1` 条生成 `pageInfo`。
- 返回列表 DTO 和 `pageInfo`。

- [ ] **步骤 7：写 API 路由失败测试**

创建 `src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts`，覆盖：

- 200 返回 `{ records, pageInfo }`。
- 401 未登录。
- 403 平台角色或无治疗摘要读权限。
- 400 `tenantId` 或未知参数。
- 503 仓储层异常。
- API 路由从访问上下文推导 `tenantId`。
- DTO 不返回 `tenantId`、客户 / 预约 / 随访明细、完整正文或敏感字段。
- allowed / denied 审计不包含请求体或敏感内容。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts
```

预期：

```text
预期失败：`src/app/api/institution/treatment-summaries/route.ts` 尚不存在
```

- [ ] **步骤 8：实现 API 路由**

创建 `src/app/api/institution/treatment-summaries/route.ts`：

- 仅实现 GET。
- 未登录返回 401。
- `treatment_summary/read_own_tenant` 拒绝返回 403。
- 缺少 `context.tenantId` 返回 403。
- 解析器错误返回 400。
- 仓储层异常返回 503。
- 成功返回安全 DTO。

- [ ] **步骤 9：PR 2 验证**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryQueryParser.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryDomain.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryRepository.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryListApiRoutes.test.ts
./node_modules/.bin/tsc --noEmit
git diff --check
```

预期：

```text
以上命令均以 exit 0 结束
```

## PR 3：机构端治疗摘要管理 UI

**文件：**

- 修改：`src/modules/institution/client/tenant-business-client.ts`
- 新建：`src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
- 新建：`src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`
- 修改：`src/modules/institution/tests/TenantBusinessClient.test.ts`
- 修改：`src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
- 修改：`src/modules/workspace/domain/institution-dashboard.ts`
- 修改：`src/modules/workspace/components/InstitutionWorkspace.tsx`
- 修改：`src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`

- [ ] **步骤 1：写客户端辅助方法测试**

修改 `src/modules/institution/tests/TenantBusinessClient.test.ts`，覆盖：

- `listTreatmentSummaries()` 请求 `/api/institution/treatment-summaries`。
- 只发送白名单查询参数。
- 不发送 `tenantId`。
- 400 / 401 / 403 / 503 映射为稳定 UI 错误。
- 错误响应中的 SQL、stack、token、secret、`DATABASE_URL` 被隐藏。

- [ ] **步骤 2：实现客户端辅助方法**

修改 `src/modules/institution/client/tenant-business-client.ts`：

- 增加 `TreatmentSummaryListClientQuery`。
- 增加 `listTreatmentSummaries(query, options)`。
- 使用 `URLSearchParams` 只拼接白名单参数。
- 读取 `{ records, pageInfo }`。

- [ ] **步骤 3：写 UI 容器测试**

创建 `src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`，覆盖：

- 加载态。
- 空态。
- 403。
- 503。
- 成功列表。
- 筛选提交。
- 清空筛选。
- 下一页请求。
- 安全详情打开和关闭。
- 不展示敏感字段。
- 不出现新增、编辑、删除按钮。

- [ ] **步骤 4：实现 UI 容器**

创建 `src/modules/institution/components/TreatmentSummaryManagementShell.tsx`：

- 复用 `InstitutionSectionHeader`。
- 复用 `InstitutionPageState`。
- 展示筛选控件：客户 ID、治疗项目、风险等级、from、to。
- 展示列表。
- 展示分页按钮。
- 使用本地状态打开安全详情。
- 不提供写入操作。

- [ ] **步骤 5：接入工作区导航**

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

- [ ] **步骤 6：PR 3 验证**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessClient.test.ts
node scripts/run-vitest.mjs run src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
./node_modules/.bin/tsc --noEmit
git diff --check
```

预期：

```text
以上命令均以 exit 0 结束
```

## PR 4：冒烟测试（smoke）/ 文档收尾

**文件：**

- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-05-31.md`
- 修改：`docs/superpowers/specs/2026-05-31-phase14-treatment-summary-management-v1-design.md`
- 修改：`docs/superpowers/plans/2026-05-31-phase14-treatment-summary-management-v1.md`

- [ ] **步骤 1：补工作区入口冒烟测试（smoke）**

修改 `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`，覆盖：

- 机构端进入治疗摘要管理。
- 请求 `GET /api/institution/treatment-summaries`。
- 展示治疗摘要列表。
- 按客户 ID、治疗项目、风险等级、时间范围筛选。
- 使用分页。
- 打开安全详情。
- 不展示 `tenantId`、PII、完整正文、SQL、stack、token、secret、`DATABASE_URL`。
- 不发送 POST / PATCH / DELETE。

- [ ] **步骤 2：更新 README**

修改 `README.md`：

- 在当前范围中新增 Phase 14 完成状态。
- 明确治疗摘要管理 v1 是只读列表、筛选、分页和安全详情。
- 明确不包含新增、编辑、删除、完整治疗正文、AI、RAG、外部系统。

- [ ] **步骤 3：更新 roadmap**

修改 `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`：

- 标记 Phase 14 完成。
- 把治疗后护理 / 随访联动、知识库 / RAG、安全基础准备、平台商业化增强继续列为后续。
- 保持完整治疗记录正文、图片 / 文件、AI、外部系统、支付、合同、发票后置。

- [ ] **步骤 4：更新 devlog**

修改 `docs/devlog/2026-05-31.md`：

- 增加 Phase 14 PR 1-4 记录。
- 写清每个 PR 的范围、边界和验证。
- 写清 Phase 14 未新增 schema / migration，未改权限、认证或租户隔离。

- [ ] **步骤 5：更新 Phase 14 文档状态**

修改：

- `docs/superpowers/specs/2026-05-31-phase14-treatment-summary-management-v1-design.md`
- `docs/superpowers/plans/2026-05-31-phase14-treatment-summary-management-v1.md`

要求：

- 标记 Phase 14 已完成。
- 保留 PR 拆分历史。
- 保留不纳入范围。
- 保留后续建议。

- [ ] **步骤 6：PR 4 验证**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
git diff --check
```

预期：

```text
以上命令均以 exit 0 结束
```

## Phase 14 风险清单

### 风险 1：治疗摘要可见面扩大

控制：

- API 使用 `treatment_summary/read_own_tenant`。
- API 只按当前 `tenantId` 查询。
- DTO 不返回 `tenantId`。
- UI 只展示安全字段。
- 冒烟测试（smoke）扫描敏感字段。

### 风险 2：列表 API 被用作客户 / 预约 / 随访下钻

控制：

- DTO 只返回客户 ID 和预约 ID 引用，不返回客户、预约、随访明细。
- v1 不提供平台侧治疗摘要查询。
- v1 不提供跳转到平台业务明细。

### 风险 3：项目筛选实现不安全

控制：

- 查询参数解析器限制长度和敏感词。
- 仓储层使用 Drizzle 参数化查询。
- 不拼接 SQL 字符串。
- 测试覆盖 SQL / token / secret 字样不进入输出。

### 风险 4：UI 暗示完整治疗记录

控制：

- 页面文案使用“结构化治疗摘要”和“安全详情”。
- 不使用“完整病历”“治疗记录全文”“诊疗原文”。
- 不出现新增、编辑、删除按钮。

### 风险 5：后续 PR 混入 AI / RAG / 外部系统

控制：

- Phase 14 设计 / 计划文档明确禁止。
- PR 描述必须重复边界。
- 冒烟测试（smoke）确认没有 AI、RAG、企微、外部系统请求。

## Phase 14 完成标准

Phase 14 已满足以下完成标准：

- 机构端有治疗摘要只读管理入口。
- `GET /api/institution/treatment-summaries` 已完成。
- API 只接受白名单查询参数。
- API 不接受 `tenantId`。
- API 只返回当前租户治疗摘要。
- API DTO 不返回 `tenantId`。
- API DTO 不返回客户、预约、随访明细。
- UI 支持列表、筛选、分页和安全详情。
- UI 不做新增、编辑、删除。
- 冒烟测试（smoke）确认不展示 PII、医疗正文、SQL、stack、token、secret、`DATABASE_URL` 或连接串。
- README、roadmap、devlog、Phase 14 设计 / 计划文档已更新完成状态。
- 未新增 schema / migration。
- 未修改权限、认证或租户隔离模型。
- 未进入治疗后护理 / 随访联动、AI、RAG、企微、外部系统、支付、合同或发票。
- 后续建议进入 Phase 15 Plan Mode，优先重新评估治疗后护理 / 随访联动 v1、知识库 / RAG 安全基础准备、平台商业化继续增强、平台租户状态管理和审计高级治理，不在 Phase 14 PR 4 中实现 Phase 15。

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

- 只新增设计 / 计划文档。
- 不改代码。
- 不改 API。
- 不改数据库。
- 不改权限、认证、租户隔离。
- 不进入治疗摘要管理代码开发。
- 不进入 AI / RAG / 企微 / 外部系统开发。
