# Phase 6 运营页面一致性与 workspace 入口真实化实施计划

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**目标：** 将机构 workspace 首页从静态经营展示推进到复用现有真实 API 的运营摘要，并统一业务页状态、导航边界、smoke 测试和文档。

**架构方案：** Phase 6 只在前端 workspace / institution 页面层复用现有 `/api/institution/customers`、`/api/institution/appointments`、`/api/institution/followups`，通过轻量 view model 派生首页摘要。后端 API、数据库 schema、migration、权限模型、认证、租户隔离和高风险集成模块全部保持不变。

**技术栈：** Next.js App Router、React client components、TypeScript、Vitest、Testing Library、现有 `tenant-business-client.ts`、现有客户 / 预约 / 随访领域模型。

---

## 总边界

Phase 6 不做：

- 新 API。
- 新数据库 schema。
- 新 migration。
- 权限模型改造。
- 认证改造。
- 租户隔离改造。
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
- 平台租户管理真实功能。
- 治疗记录完整正文。
- 客户详情完整时间线。
- 大型 UI 框架重构。
- 引入新的数据请求库。

## 静态 demo 数据边界

- 可以保留 seed/demo 测试数据。
- 可以保留随访旅程 / 安全话术说明作为静态说明。
- 可以保留工作台经营展示中的静态视觉元素，但不能把它们描述成真实同步数据。
- 三大业务页面不能再用静态 demo 数组作为业务 records 数据源。
- 对旧的未使用 demo 数据，如 `src/modules/institution/domain/customers.ts`，本阶段先标记边界；后续如无引用再单独清理。

## PR 拆分

1. PR 1：Phase 6 spec/plan 文档与 README/roadmap/devlog 状态更新。
2. PR 2：机构工作台首页接入现有三类真实 API，派生指标、行动摘要、首页 loading/error/empty。
3. PR 3：抽小型共享页面状态组件，统一三大业务页 header/state/boundary 展示。
4. PR 4：导航与 smoke 稳定化，补测试和收尾文档。

## PR 1：Phase 6 文档和状态同步

**涉及文件：**

- 新建：`docs/superpowers/specs/2026-05-31-phase6-workspace-entry-consistency-design.md`
- 新建：`docs/superpowers/plans/2026-05-31-phase6-workspace-entry-consistency.md`
- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-05-31.md`

- [ ] **步骤 1：创建 Phase 6 设计文档**

写入 `docs/superpowers/specs/2026-05-31-phase6-workspace-entry-consistency-design.md`，必须包含：

- Phase 5 后的当前状态。
- Phase 6 六项目标。
- Phase 6 非目标完整清单。
- 静态 demo 数据边界。
- 首页真实化、统一状态组件、导航边界和测试策略。
- 四个 PR 拆分。

- [ ] **步骤 2：创建 Phase 6 实施计划**

写入 `docs/superpowers/plans/2026-05-31-phase6-workspace-entry-consistency.md`，必须包含：

- 本计划页首标准说明。
- 总边界和静态 demo 数据边界。
- PR 1 到 PR 4 的文件范围、步骤、风险和验证方式。
- PR 2/3/4 只作为计划，不在 PR 1 执行。

- [ ] **步骤 3：同步 README**

修改 `README.md`：

- 把客户、预约、随访三大业务页面真实 API 接入列入已完成。
- 从后续事项中移除“机构业务页面接入真实 API”。
- 增加 Phase 6 当前规划方向：运营页面一致性与 workspace 入口真实化。

- [ ] **步骤 4：同步 roadmap**

修改 `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`：

- 标明客户、预约、随访三大业务页面已接入真实 API。
- 更新下一阶段为 Phase 6：运营页面一致性与 workspace 入口真实化。
- 保留高风险模块后置说明。

- [ ] **步骤 5：同步 devlog**

修改 `docs/devlog/2026-05-31.md`：

- 补充 Phase 6 Plan Mode 结果。
- 标明本次只做计划文档，不进入代码开发。
- 标明不进入 Phase 6 PR 2/3/4。

- [ ] **步骤 6：验证 PR 1**

运行：

```bash
git diff --check
```

预期：退出码 0，无 trailing whitespace 或 patch 格式问题。

本 PR 只修改 Markdown，不运行完整 test/typecheck/build。原因：未改 TypeScript、页面、测试、API、数据库、权限、认证或租户隔离。

## PR 2：机构工作台首页真实化

**涉及文件：**

- 修改：`src/modules/workspace/components/InstitutionWorkspace.tsx`
- 修改或新建：`src/modules/workspace/domain/institution-dashboard.ts`
- 可选新建：`src/modules/workspace/domain/institution-dashboard-view-model.ts`
- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- 修改或新建：`src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`

- [ ] **步骤 1：编写首页 view model 失败测试**

覆盖：

- 从 customers records 派生客户总数、高优先级、复购窗口、术后关怀数量。
- 从 appointments records 派生待确认、已确认、改约跟进数量。
- 从 followups records 派生待处理、高风险、已升级数量。
- 行动摘要优先使用高风险随访、待确认预约、高优先级客户。
- 空 records 返回稳定零值摘要。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
```

预期：新增断言先失败。

- [ ] **步骤 2：实现首页 view model**

在 workspace domain 中实现纯函数，输入现有 `CustomerRecordSummary[]`、`AppointmentRecordSummary[]`、`TenantFollowUpTask[]`，输出首页指标和行动摘要。

要求：

- 不发请求。
- 不读取 localStorage。
- 不接受 `tenantId` 入参。
- 不输出“AI 已排序”“实时同步”等未实现能力文案。

- [ ] **步骤 3：编写 workspace 首页加载 / 错误 / 空态失败测试**

在 `WorkspaceEntryPages.test.tsx` 中覆盖：

- `/hospital` 首页会请求三类现有 API。
- 三类 API 成功时展示派生指标。
- 任一 API 返回 503 时展示稳定错误态。
- 三类 records 都为空时展示零值或空态摘要。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

预期：新增断言先失败。

- [ ] **步骤 4：接入首页数据加载**

修改 `InstitutionWorkspace.tsx`：

- 工作台首页进入时调用现有 `listCustomers()`、`listAppointments()`、`listFollowUpTasks()`。
- 使用 view model 渲染首页指标和行动摘要。
- 保留静态视觉元素，但静态元素不能被描述为真实同步数据。
- 对 loading、error、empty 使用稳定文案。

- [ ] **步骤 5：验证 PR 2**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

预期：全部通过。

## PR 3：共享状态组件与三大业务页一致性

**涉及文件：**

- 可选新建：`src/modules/institution/components/BusinessPageHeader.tsx`
- 可选新建：`src/modules/institution/components/BusinessStateBlock.tsx`
- 可选新建：`src/modules/institution/components/BusinessBoundaryPanel.tsx`
- 修改：`src/modules/institution/components/CustomerCenterShell.tsx`
- 修改：`src/modules/institution/components/AppointmentCenterShell.tsx`
- 修改：`src/modules/institution/components/SmartFollowUpShell.tsx`
- 修改：`src/modules/institution/tests/InstitutionBusinessShells.test.tsx`

- [ ] **步骤 1：编写共享状态组件测试或补充页面断言**

覆盖：

- loading 文案样式和语义稳定。
- error 文案不会泄露数据库、SQL、连接串、密钥。
- empty 文案不暗示 mock 或静态 records。
- boundary panel 明确数据来源和白名单边界。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx
```

预期：新增断言先失败。

- [ ] **步骤 2：抽小型共享组件**

组件要求：

- 只抽现有重复展示结构。
- 不改 API client。
- 不改 payload 白名单。
- 不改随访状态机。
- 不引入新的数据请求库。
- 不建设大型 UI 框架。

- [ ] **步骤 3：迁移三大业务页展示层**

迁移范围：

- `CustomerCenterShell` 的标题、加载、错误、空态和客户数据边界。
- `AppointmentCenterShell` 的标题、加载、错误、空态和数据边界。
- `SmartFollowUpShell` 的标题、加载、错误、空态、随访旅程说明和安全话术说明。

保持不变：

- 表单字段。
- mutation payload。
- PII 拒绝逻辑。
- API 路径。
- 现有交互行为。

- [ ] **步骤 4：验证 PR 3**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/institution/tests/TenantBusinessClient.test.ts src/modules/institution/tests/TenantBusinessViewModels.test.ts
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

预期：全部通过。

## PR 4：导航与 smoke 稳定化

**涉及文件：**

- 修改：`src/modules/workspace/components/InstitutionWorkspace.tsx`
- 修改：`src/modules/workspace/domain/institution-dashboard.ts`
- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- 修改：`src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-05-31.md` 或新日期 devlog

- [ ] **步骤 1：补导航领域模型测试**

覆盖：

- 已真实接入页面：`dashboard`、`customers`、`appointments`、`followups`。
- 后续占位页面：`conversations`、`knowledge`、`analytics`。
- 导航 label 唯一。
- 默认入口仍为 `dashboard`。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
```

预期：新增断言先失败。

- [ ] **步骤 2：整理导航和占位状态**

要求：

- 桌面导航和移动导航使用同一份页面元数据。
- 占位页明确“后续阶段接入”，不得触发 AI、知识库、客服、数据分析真实请求。
- 搜索输入如暂不实现，应避免暗示全局业务搜索已可用。

- [ ] **步骤 3：补 workspace smoke 测试**

覆盖：

- 首页加载真实 API 摘要。
- 切换客户中心展示客户 API records。
- 切换预约中心展示预约 API records。
- 切换智能随访展示随访 API records。
- 切换客服工作台、知识库、数据分析展示占位边界。

运行：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

预期：新增断言先失败。

- [ ] **步骤 4：更新收尾文档**

文档需要说明：

- Phase 6 PR 2/3/4 完成的真实化和一致性结果。
- 仍未进入高风险模块。
- 后续阶段可再单独规划客户详情时间线、审计查询、平台租户管理等。

- [ ] **步骤 5：Phase 6 总体验证**

运行：

```bash
git diff --check
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

预期：

- 21 个以上测试文件全部通过。
- TypeScript 无错误。
- Next build 成功。

## 后续阶段建议

Phase 6 完成后，才建议重新进入 Plan Mode 评估：

- 客户详情时间线第一版。
- 审计日志只读查询基础版。
- 治疗记录结构化摘要安全计划。
- 平台租户管理与套餐权益计划。
- 知识库 / RAG、AI provider、Agent、企业微信、开放平台凭证、支付和计费等高风险模块。
