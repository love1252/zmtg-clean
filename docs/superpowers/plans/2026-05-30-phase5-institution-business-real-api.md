# Phase 5 机构业务页面真实化实施计划

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**目标：** 将机构端客户中心、预约中心、智能随访 / 随访任务从静态演示页面接入现有真实客户、预约、随访 API，并补齐基础创建、更新、状态流转和页面状态。

**架构方案：** Phase 5 只在前端页面和轻量 helper 层接入已有 API，后端 API、仓储、写入白名单、租户隔离和审计事务保持不变。页面使用 React client state 管理加载、空、错误、提交和选中记录状态；写入 payload 由前端按白名单组装，再由现有后端校验做最终准入。

**技术栈：** Next.js App Router、React client components、TypeScript、Vitest、Testing Library、现有 `/api/institution/*` route、现有 `AccessContext` / RBAC / Drizzle / PostgreSQL 能力。

---

## 范围

Phase 5 包含：

- 客户中心真实化。
- 预约中心真实化。
- 智能随访 / 随访任务真实化。
- 接入现有客户、预约、随访 GET / POST / PATCH API。
- 增加基础创建、更新、状态流转 UI。
- 补齐加载态、空状态、错误态、权限态。
- 保持租户隔离。
- 保持审计事件可验证。
- 保持写入 payload 白名单和 PII 拒绝规则。
- 补充必要测试。

Phase 5 不包含：

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

## 当前可用 API 和数据能力盘点

可用读取 API：

- `GET /api/institution/customers`
- `GET /api/institution/appointments`
- `GET /api/institution/followups`

可用写入 API：

- `POST /api/institution/customers`
- `PATCH /api/institution/customers`
- `POST /api/institution/appointments`
- `PATCH /api/institution/appointments`
- `PATCH /api/institution/followups`

可用服务端能力：

- `src/modules/institution/server/tenant-business-repository.ts`：客户、预约、随访仓储。
- `src/modules/institution/server/tenant-business-api.ts`：统一 RBAC、错误码和审计处理。
- `src/modules/institution/server/tenant-business-write-input.ts`：写入白名单和 PII 拒绝。
- `src/modules/institution/server/tenant-business-audit-transaction.ts`：业务写入和允许审计同事务。
- `src/server/db/seed-demo-data.ts`：本地真实 API smoke seed 数据。

## 当前机构端页面现状

- `src/modules/workspace/components/InstitutionWorkspace.tsx` 使用 `activeView` 本地 state 切换页面。
- `src/modules/institution/components/CustomerCenterShell.tsx` 使用静态 `demoCustomers`。
- `src/modules/institution/components/AppointmentCenterShell.tsx` 使用静态 `appointmentPipelineGroups`。
- `src/modules/institution/components/SmartFollowUpShell.tsx` 使用静态 `followUpTasks`。
- 三个页面尚无真实 API loading、empty、error、forbidden、mutation UI。
- `/hospital` 已通过 `DemoSessionGate` 限制 `tenant_admin`，业务授权仍需由 API 服务端执行。

## 文件级修改清单

预计新增文件：

- `src/modules/institution/client/tenant-business-client.ts`
  - 封装客户、预约、随访 GET / POST / PATCH 请求。
  - 解析 `{ records }`、`{ record }` 和 `{ error }`。
  - 输出稳定前端错误类型。
- `src/modules/institution/domain/tenant-business-view-models.ts`
  - 客户生命周期、优先级中文标签。
  - 客户分层统计。
  - 预约状态分组。
  - 随访风险标签、状态标签和允许下一步流转。
  - 日期展示格式化。
- `src/modules/institution/tests/TenantBusinessClient.test.ts`
  - API client 行为测试。
- `src/modules/institution/tests/TenantBusinessViewModels.test.ts`
  - View model 映射和分组测试。

预计修改文件：

- `src/modules/institution/components/CustomerCenterShell.tsx`
  - 接入客户 GET / POST / PATCH。
  - 增加客户加载、空、错误、权限和表单状态。
- `src/modules/institution/components/AppointmentCenterShell.tsx`
  - 接入预约 GET / POST / PATCH 和客户 GET。
  - 增加预约分组、创建和状态更新。
- `src/modules/institution/components/SmartFollowUpShell.tsx`
  - 接入随访 GET / PATCH。
  - 增加任务状态流转和冲突提示。
- `src/modules/workspace/components/InstitutionWorkspace.tsx`
  - 仅在需要共享刷新函数或传入页面依赖时修改。
- `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
  - 从静态渲染测试升级为真实 API mock 的页面状态测试。
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 验证工作台切换到三个业务页后触发并展示 API 数据。

禁止修改文件：

- `src/app/api/institution/customers/route.ts`
- `src/app/api/institution/appointments/route.ts`
- `src/app/api/institution/followups/route.ts`
- `src/server/db/schema.ts`
- `drizzle/*.sql`
- `src/modules/security/domain/access-control.ts`
- `src/modules/security/server/access-context.ts`
- `src/modules/auth/server/demo-session.ts`

## 表单与写入白名单

客户创建 payload 白名单：

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

客户更新 payload 白名单：

- `id`
- 客户创建字段中的任意可更新子集

预约创建 payload 白名单：

- `customerId`
- `customerDisplayName`
- `project`
- `scheduledAt`
- `consultantUserId`
- `status`
- `note`

预约更新 payload 白名单：

- `id`
- `status`
- `note`

随访状态流转 payload 白名单：

- `id`
- `nextStatus`

前端禁止发送：

- `tenantId`
- `phoneNumber`
- `idNumber`
- `medicalRecordNo`
- `treatmentRecord`
- `consultationTranscript`
- `rawPhone`
- `rawIdCard`
- API Key、OAuth token、Webhook secret 或其他凭证明文

## 错误态 / 空状态 / 权限态

页面必须覆盖：

- loading：初次进入页面展示加载态，提交中禁用按钮。
- empty：无客户、无预约、无随访任务时展示明确空态。
- 401：提示重新登录，并提供 `/login` 入口。
- 403：提示无权限，不展示业务数据。
- 400：展示字段校验错误。
- 404：提示记录不存在或不属于当前租户。
- 409：提示状态已变化，请刷新后重试，并重新拉取数据。
- 503：提示数据服务暂不可用，不展示连接串、SQL 或密钥。

## 租户隔离与审计验证

执行时必须保持：

- 前端不读取、不缓存、不提交 `tenantId`。
- API 请求路径不带租户参数。
- 预约创建的 `customerId` 来自当前租户客户列表。
- `customerDisplayName` 从已选客户派生。
- 后端仍由 `AccessContext` 和 `canAccessResource` 做最终授权。
- 现有审计链路不改动。

测试需证明：

- 客户、预约、随访写入请求 body 不包含 `tenantId`。
- 禁止字段不会出现在请求 body。
- 409、404、403 等错误会展示稳定文案。
- 现有 API/仓储/白名单/权限测试继续通过。

## A-F 分阶段任务拆解

### A. Client helper 和 view model

**涉及文件：**

- 新建：`src/modules/institution/client/tenant-business-client.ts`
- 新建：`src/modules/institution/domain/tenant-business-view-models.ts`
- 新建：`src/modules/institution/tests/TenantBusinessClient.test.ts`
- 新建：`src/modules/institution/tests/TenantBusinessViewModels.test.ts`

- [ ] **步骤 A1：编写 API client 失败测试**

覆盖以下行为：

- `listCustomers()` 请求 `/api/institution/customers` 并返回 `records`。
- `createCustomer(payload)` 请求 POST 并返回 `record`。
- 非 2xx 且 body 为 `{ error }` 时返回稳定错误对象。
- 请求 body 不包含 `tenantId`。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessClient.test.ts
```

预期：测试失败，原因是 client helper 尚不存在。

- [ ] **步骤 A2：实现 API client helper**

实现客户、预约、随访的 GET / POST / PATCH 封装。所有 mutation 函数只接收白名单 payload 类型，不暴露 `tenantId` 入参。

- [ ] **步骤 A3：编写 view model 失败测试**

覆盖以下行为：

- 客户生命周期和优先级映射为中文标签。
- 客户 records 可计算四类分层数量。
- 预约 records 可按 status 分组。
- 随访 status 可计算允许下一步状态。
- 日期字符串可格式化为稳定展示文案。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessViewModels.test.ts
```

预期：测试失败，原因是 view model helper 尚不存在。

- [ ] **步骤 A4：实现 view model helper**

实现枚举标签、分组、统计、状态流转和日期格式化。随访允许下一步必须与后端状态机保持一致。

- [ ] **步骤 A5：运行 A 阶段测试并提交**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessClient.test.ts src/modules/institution/tests/TenantBusinessViewModels.test.ts
```

预期：全部通过。

建议提交：

```bash
git add src/modules/institution/client/tenant-business-client.ts src/modules/institution/domain/tenant-business-view-models.ts src/modules/institution/tests/TenantBusinessClient.test.ts src/modules/institution/tests/TenantBusinessViewModels.test.ts
git commit -m "feat: add tenant business page data helpers"
```

### B. 客户中心真实化

**涉及文件：**

- 修改：`src/modules/institution/components/CustomerCenterShell.tsx`
- 修改：`src/modules/institution/tests/InstitutionBusinessShells.test.tsx`

- [ ] **步骤 B1：编写客户中心页面失败测试**

覆盖：

- 初始展示加载态。
- GET 成功后展示 API 返回客户。
- records 为空时展示空态和创建入口。
- 403 时展示无权限态。
- 503 时展示数据服务不可用。
- 创建客户提交 POST body 不包含 `tenantId`。
- 编辑客户提交 PATCH body 不包含禁止 PII 字段。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx
```

预期：测试失败，原因是组件仍使用静态 demo 数据。

- [ ] **步骤 B2：接入客户 GET**

在 `CustomerCenterShell` 中使用 client helper 拉取客户 records，渲染 loading、success、empty、error 和 forbidden 状态。

- [ ] **步骤 B3：增加客户创建和编辑表单**

表单只组装客户白名单字段。`maskedPhone` 和 `maskedMedicalRecordNo` 的表单文案必须提示输入脱敏展示值。

- [ ] **步骤 B4：运行客户中心测试并提交**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/institution/tests/TenantBusinessClient.test.ts src/modules/institution/tests/TenantBusinessViewModels.test.ts
```

预期：相关测试通过。

建议提交：

```bash
git add src/modules/institution/components/CustomerCenterShell.tsx src/modules/institution/tests/InstitutionBusinessShells.test.tsx
git commit -m "feat: connect customer center to tenant API"
```

### C. 预约中心真实化

**涉及文件：**

- 修改：`src/modules/institution/components/AppointmentCenterShell.tsx`
- 修改：`src/modules/institution/tests/InstitutionBusinessShells.test.tsx`

- [ ] **步骤 C1：编写预约中心页面失败测试**

覆盖：

- 同时请求客户和预约 API。
- 按预约 status 分组展示。
- 客户为空时禁用或隐藏新建预约提交。
- 创建预约时 `customerDisplayName` 从已选客户派生。
- 更新预约状态和备注。
- 404 和 503 错误展示稳定文案。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx
```

预期：测试失败，原因是组件仍使用静态预约队列。

- [ ] **步骤 C2：接入预约 GET 和客户 GET**

加载预约 records 和客户 records。预约中心列表按 status 分组，客户 records 用于创建预约下拉。

- [ ] **步骤 C3：增加预约创建和状态更新 UI**

创建预约 payload 必须从已选客户派生 `customerDisplayName`。状态更新 PATCH 只发送 `id`、`status`、`note`。

- [ ] **步骤 C4：运行预约中心测试并提交**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/institution/tests/TenantBusinessClient.test.ts src/modules/institution/tests/TenantBusinessViewModels.test.ts
```

预期：相关测试通过。

建议提交：

```bash
git add src/modules/institution/components/AppointmentCenterShell.tsx src/modules/institution/tests/InstitutionBusinessShells.test.tsx
git commit -m "feat: connect appointment center to tenant API"
```

### D. 智能随访 / 随访任务真实化

**涉及文件：**

- 修改：`src/modules/institution/components/SmartFollowUpShell.tsx`
- 修改：`src/modules/institution/tests/InstitutionBusinessShells.test.tsx`

- [ ] **步骤 D1：编写随访页面失败测试**

覆盖：

- GET 成功后展示 API 返回任务。
- 任务按风险和到期时间展示。
- 当前状态只展示允许的下一步按钮。
- PATCH 成功后更新任务状态。
- 409 stale transition 展示刷新提示并重新拉取。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx
```

预期：测试失败，原因是组件仍使用静态随访任务。

- [ ] **步骤 D2：接入随访 GET**

使用 client helper 拉取随访任务，渲染 loading、success、empty、error 和 forbidden 状态。

- [ ] **步骤 D3：增加随访状态流转 UI**

按 view model helper 输出的允许下一步状态渲染按钮。PATCH 只发送 `id` 和 `nextStatus`。

- [ ] **步骤 D4：运行随访测试并提交**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/institution/tests/TenantBusinessClient.test.ts src/modules/institution/tests/TenantBusinessViewModels.test.ts
```

预期：相关测试通过。

建议提交：

```bash
git add src/modules/institution/components/SmartFollowUpShell.tsx src/modules/institution/tests/InstitutionBusinessShells.test.tsx
git commit -m "feat: connect follow-up tasks to tenant API"
```

### E. 页面集成和状态补齐

**涉及文件：**

- 修改：`src/modules/workspace/components/InstitutionWorkspace.tsx`
- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- 修改：`src/modules/institution/components/CustomerCenterShell.tsx`
- 修改：`src/modules/institution/components/AppointmentCenterShell.tsx`
- 修改：`src/modules/institution/components/SmartFollowUpShell.tsx`

- [ ] **步骤 E1：编写工作台集成失败测试**

覆盖：

- 登录机构端后进入 `/hospital`。
- 点击客户中心后展示 API 客户 records。
- 点击预约中心后展示 API 预约 records。
- 点击智能随访后展示 API 随访 records。
- `/api/auth/session` 与 `/api/institution/*` 的 fetch mock 不互相污染。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

预期：测试失败，原因是工作台测试仍按静态页面壳断言。

- [ ] **步骤 E2：补齐工作台集成**

如组件无需共享数据，`InstitutionWorkspace` 可保持当前结构。若需要统一刷新或错误边界，只做最小必要修改。

- [ ] **步骤 E3：补齐移动端和文案溢出检查**

检查三个页面动态数据的标题、按钮、标签在当前卡片布局中不溢出。必要时用稳定宽度、换行和按钮禁用态修正。

- [ ] **步骤 E4：运行页面测试并提交**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

预期：页面相关测试通过。

建议提交：

```bash
git add src/modules/workspace/components/InstitutionWorkspace.tsx src/modules/workspace/tests/WorkspaceEntryPages.test.tsx src/modules/institution/components/CustomerCenterShell.tsx src/modules/institution/components/AppointmentCenterShell.tsx src/modules/institution/components/SmartFollowUpShell.tsx src/modules/institution/tests/InstitutionBusinessShells.test.tsx
git commit -m "test: cover institution workspace real API pages"
```

### F. 验证和交付

**涉及文件：**

- 按实际变更决定。

- [ ] **步骤 F1：运行 TypeScript 检查**

运行：

```bash
pnpm typecheck
```

预期：通过。

- [ ] **步骤 F2：运行测试**

运行：

```bash
pnpm test
```

预期：通过。

- [ ] **步骤 F3：运行构建**

运行：

```bash
pnpm build
```

预期：通过。

- [ ] **步骤 F4：本地真实 API smoke**

仅在已配置 `DATABASE_URL` 且完成迁移和 seed 时执行：

```bash
pnpm db:seed
pnpm dev
```

手工验证：

- 使用 `admin / admin123` 登录机构端。
- 客户中心展示 seed 客户。
- 新建一条脱敏客户摘要。
- 预约中心展示 seed 预约。
- 为当前租户客户新建一条预约。
- 智能随访展示 seed 任务。
- 将一条 `due` 随访任务流转到 `in_progress`。

预期：所有操作不需要前端提供 `tenantId`，失败错误不泄露连接串、SQL 或密钥。

- [ ] **步骤 F5：最终扫描**

运行：

```bash
rg -n "tenantId|phoneNumber|idNumber|medicalRecordNo|treatmentRecord|consultationTranscript|rawPhone|rawIdCard" src/modules/institution/components src/modules/institution/client src/modules/institution/domain src/modules/institution/tests
```

预期：只出现类型说明、测试中明确的禁止字段断言或后端已有白名单相关引用；页面提交逻辑不发送禁止字段。

## 执行前确认项

执行 Phase 5 功能开发前必须确认：

- 本计划和对应设计文档已被用户确认。
- 从最新 `main` 创建功能分支。
- 工作区干净，没有未归属变更。
- 本阶段只做机构业务页面真实化。
- 不改 API route。
- 不改数据库 schema。
- 不新增 migration。
- 不改 demo auth。
- 不改权限模型。
- 不进入 AI provider、Agent、RAG / 知识库、企业微信、HIS / CRM / OTA 连接器、API Key、OAuth、Webhook、支付、合同、发票、套餐权益 enforcement、平台租户管理、治疗记录完整病历正文或客户详情完整时间线。
- 如果执行中发现需要上述能力，停止开发并新开后续阶段 Plan Mode。

## 本计划文档 PR 的验证说明

本 PR 只新增 Markdown 文档，不修改业务代码、API、页面、测试、schema、migration、demo auth 或权限模型。因此本 PR 只需要运行：

```bash
git diff --check
```

完整 `pnpm typecheck`、`pnpm test`、`pnpm build` 留到 Phase 5 功能开发 PR 执行。
