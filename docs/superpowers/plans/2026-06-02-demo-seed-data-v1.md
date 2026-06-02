# Demo Seed Data V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一套可重复生成的智美天工演示数据，支撑机构老板版和运营负责人版产品演示。

**Architecture:** 复用现有 `db:seed` 入口和 Drizzle schema，不新增数据库结构、不新增 API。将完整星澜医美 demo 数据沉淀为稳定的 seed records，并通过 upsert、固定 ID、敏感字段测试和 workspace smoke 保证演示路径可重复使用。

**Tech Stack:** Next.js、TypeScript、Drizzle ORM、PostgreSQL、Vitest、现有 `src/server/db/seed-demo-data.ts`。

---

## 当前 PR 范围

本 PR 是 PR 1：demo seed spec / plan，只新增文档：

- `docs/superpowers/specs/2026-06-02-demo-seed-data-v1-design.md`
- `docs/superpowers/plans/2026-06-02-demo-seed-data-v1.md`

本 PR 不写 seed 代码，不改 API，不改数据库，不改权限、认证、租户隔离，不进入 Phase 20。

## 只读检查摘要

当前实现中与 demo seed 相关的事实：

- `package.json` 已有 `db:seed`：`tsx src/server/db/seed-demo-data.ts`。
- `src/server/db/seed-demo-data.ts` 是当前 seed 入口。
- 当前 seed 已插入 tenants、tenant plans、plan assignments、quota snapshots、tenant members、customers、appointments、treatment summaries、follow-up tasks。
- 当前 seed 未插入 `audit_events`。
- 当前 seed 使用 `onConflictDoNothing`，重复执行不会刷新已有 demo 数据。
- 当前 `toTreatmentSummarySeedValue` 未写入作废字段，无法 seed 已作废摘要状态。
- 当前 `treatment_summaries` 已有作废字段，无需 migration。
- 当前 `follow_up_tasks` 已有来源治疗摘要字段，无需 migration。
- 当前随访建议是确定性派生，不需要新增 suggestions table。

## PR 拆分

### PR 1：demo seed spec / plan

范围：

- 只做本文档和设计文档。
- 固化 demo seed v1 的数据口径、表映射、实现策略、验证策略和后续 PR 拆分。

风险：

- 无运行时风险。
- 主要风险是文档误导后续实现，因此必须明确“不接 HIS / 企微 / AI，不实现 seed，不进入 Phase 20”。

验证：

```bash
git diff --check
```

无需运行完整 test / typecheck / build，因为只新增 Markdown 文档。

### PR 2：demo seed 数据实现

范围：

- 新增或扩展 demo seed records。
- 复用现有 `db:seed` 入口。
- 创建虚构租户、客户、预约、治疗摘要、随访任务、审计和平台数据。
- 不新增数据库 schema。
- 不新增 API。
- 不进入 HIS / 企微 / AI。

建议修改文件：

- 修改：`src/server/db/seed-demo-data.ts`
- 可新增：`src/server/db/demo-seed-records.ts`
- 修改：`src/server/db/tests/Schema.test.ts`
- 如需要同步 domain fallback 数据，可评估修改：
  - `src/modules/institution/domain/customer-records.ts`
  - `src/modules/institution/domain/appointment-records.ts`
  - `src/modules/institution/domain/treatment-summaries.ts`
  - `src/modules/institution/domain/followup-workflow.ts`

推荐实现策略：

- 不新增单独 seed 命令，继续使用 `pnpm db:seed` / `npm run db:seed` 对应的现有入口。
- 新增 `src/server/db/demo-seed-records.ts` 承载完整星澜医美演示数据。
- `src/server/db/seed-demo-data.ts` 只负责校验引用、转换字段、按依赖顺序 upsert。
- 所有 ID 使用 `demo-` 前缀。
- 主演示租户继续使用 `demo-tenant-001`，避免修改 demo auth。
- 默认使用 upsert，确保重复执行后数据刷新。
- 不做全表 reset。
- 如新增 reset 模式，只允许在明确环境变量下删除 `demo-*` 固定 ID 数据。
- 默认禁止生产环境执行 demo seed，除非后续单独设计安全开关。

PR 2 必须覆盖的数据：

- `tenants`：星澜医美中心、青禾皮肤管理、澄镜医疗美容、远山医美连锁。
- `tenant_plans`：Starter / Growth / Trial / Enterprise 演示套餐。
- `tenant_plan_assignments`：每个租户对应一个 active assignment。
- `tenant_quota_snapshots`：客户、预约、随访、AI 调用配额和使用量。
- `tenant_members`：老板、运营负责人、咨询师、客服、医助。
- `customers`：5-8 个虚构客户。
- `appointments`：3-5 条预约。
- `treatment_summaries`：5-8 条摘要，包含 active / edited / voided。
- `follow_up_tasks`：待处理、超时、已完成、来源治理任务。
- `audit_events`：创建客户、创建预约、创建治疗摘要、编辑摘要、作废摘要、创建随访任务、权限拒绝、配额拒绝、平台查看事件。

PR 2 必须注意：

- `treatment_summaries` seed 转换必须写入 `voidedAt`、`voidedBy`、`voidReasonCode`、`voidReason`。
- 作废审计使用 `action=update`、`reason=treatment_summary_voided`，因为当前 `ACCESS_ACTIONS` 没有 `void`。
- 随访任务的 `sourceSuggestionKey` 必须与确定性建议规则一致，避免演示时看不到来源提示或重复创建冲突。
- 试用租户不能使用 `tenant_status=trial`，应通过 plan 表达 Trial。

PR 2 测试建议：

- `src/server/db/tests/Schema.test.ts`
  - seed 包含星澜医美中心。
  - seed 包含 5-8 个虚构客户。
  - seed 包含 active / edited / voided 治疗摘要。
  - voided 摘要 seed 写入作废字段。
  - seed 包含来源随访任务。
  - seed 包含审计事件。
  - seed 中不包含真实手机号、身份证、病历号、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文、SQL、stack、token、secret、`DATABASE_URL`。
  - seed 引用的客户、预约、治疗摘要都保持同租户引用。

PR 2 验证命令：

```bash
git diff --check
node scripts/run-vitest.mjs run src/server/db/tests
./node_modules/.bin/tsc --noEmit
```

如触及 domain fallback 或 repository 测试，再补：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests src/modules/audit/tests
```

### PR 3：演示路径 smoke

范围：

- 覆盖机构端演示路径 smoke。
- 覆盖平台端演示路径 smoke。
- 不新增业务功能。
- 不新增 API。
- 不改数据库 schema。

建议修改文件：

- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- 如需要补充组件级测试：
  - `src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`
  - `src/modules/institution/tests/CustomerTimelineDrawer.test.tsx`
  - `src/modules/institution/tests/SmartFollowUpShell.test.tsx`

Smoke 覆盖：

- 机构工作台可进入。
- 客户中心有星澜演示客户。
- 预约中心有面诊、治疗、复诊、取消或待确认预约。
- 客户详情时间线可打开。
- 治疗摘要管理有 active、edited、voided 摘要。
- 作废摘要详情显示作废状态、作废时间、作废人、作废原因。
- 作废摘要阻断随访建议。
- 作废摘要阻断来源任务创建。
- 智能随访有来源为治疗摘要的任务。
- 智能随访展示待处理、超时、已完成任务。
- 机构审计日志有演示事件。
- 平台租户管理展示租户、套餐、配额。
- 商业化健康视图展示配额风险和 denied audit。
- 平台审计日志有平台演示事件。
- UI 不展示敏感字段。

PR 3 验证命令：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/workspace/tests src/modules/institution/tests src/modules/audit/tests src/server/db/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

如 smoke 调整较多，再补：

```bash
node scripts/run-vitest.mjs run
```

### PR 4：演示 UI 小打磨

范围：

- 减少演示主线上的占位感。
- 优化页面空态、错误态和演示数据标题。
- 明确哪些页面不建议演示。
- 不进入 Phase 20 新功能。

允许修改：

- 机构工作台演示文案。
- 客户中心 / 预约中心 / 智能随访的空态和错误态。
- 治疗摘要管理演示数据标题、作废提示和来源任务提示。
- 平台租户管理 / 商业化健康视图中的演示说明。

明确不做：

- 不新增 API。
- 不改数据库。
- 不改权限、认证、租户隔离。
- 不接 HIS / 企微 / AI。
- 不自动触达客户。
- 不做完整经营智能中心。

PR 4 验证命令：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/workspace/tests src/modules/institution/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## PR 2 详细任务建议

### Task 1：补 seed 数据测试

**Files:**

- Modify: `src/server/db/tests/Schema.test.ts`

步骤：

- [ ] 新增测试：`演示种子数据包含星澜医美中心和完整套餐配额`
- [ ] 新增测试：`演示种子数据包含 5-8 个虚构客户且不含真实 PII`
- [ ] 新增测试：`演示种子数据包含 active edited voided 治疗摘要`
- [ ] 新增测试：`演示种子数据包含来源随访任务并保持同租户引用`
- [ ] 新增测试：`演示种子数据包含安全审计事件`
- [ ] 运行：

```bash
node scripts/run-vitest.mjs run src/server/db/tests
```

预期：新增测试先失败，因为 seed records 尚未实现。

### Task 2：新增 demo seed records

**Files:**

- Create: `src/server/db/demo-seed-records.ts`
- Modify: `src/server/db/seed-demo-data.ts`

步骤：

- [ ] 在 `demo-seed-records.ts` 中定义 tenants、plans、assignments、quota snapshots。
- [ ] 定义 tenant members。
- [ ] 定义 8 个虚构 customers。
- [ ] 定义 5 条 appointments。
- [ ] 定义 7 条 treatment summaries。
- [ ] 定义 4 条 follow-up tasks。
- [ ] 定义 audit events。
- [ ] 导出只读数组供 seed 脚本和测试复用。
- [ ] 保证所有 ID 稳定且使用 `demo-` 前缀。

### Task 3：增强 seed 执行入口

**Files:**

- Modify: `src/server/db/seed-demo-data.ts`

步骤：

- [ ] 继续保留 `seedDemoData(db)`。
- [ ] 改为从 `demo-seed-records.ts` 读取完整演示数据。
- [ ] 为治疗摘要 seed 写入作废字段。
- [ ] 新增 audit events 插入。
- [ ] 将主要表的插入策略从 `onConflictDoNothing` 调整为 upsert。
- [ ] 保持插入顺序：tenants -> plans -> assignments -> quota snapshots -> tenant members -> customers -> appointments -> treatment summaries -> follow-up tasks -> audit events。
- [ ] 不新增 migration。
- [ ] 不新增 API。

### Task 4：补安全和引用校验

**Files:**

- Modify: `src/server/db/seed-demo-data.ts`
- Modify: `src/server/db/tests/Schema.test.ts`

步骤：

- [ ] 校验 appointment / treatment summary / follow-up task 的同租户 customer 引用。
- [ ] 校验 treatment summary 的 appointment 引用。
- [ ] 校验 follow-up task 的 source treatment summary 引用。
- [ ] 校验 audit resourceId 引用的演示记录存在。
- [ ] 增加敏感字段扫描，覆盖真实手机号、身份证、病历号、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文、AI 生成内容、外部系统原文、SQL、stack、token、secret、`DATABASE_URL`。

### Task 5：验证 PR 2

运行：

```bash
git diff --check
node scripts/run-vitest.mjs run src/server/db/tests
node scripts/run-vitest.mjs run src/modules/institution/tests src/modules/audit/tests
./node_modules/.bin/tsc --noEmit
```

如 seed 影响 workspace smoke，再运行：

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests
node scripts/run-next.mjs build --webpack
```

## PR 3 详细任务建议

### Task 1：补 workspace 演示路径 smoke

**Files:**

- Modify: `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

步骤：

- [ ] 覆盖机构工作台展示星澜演示数据。
- [ ] 覆盖客户中心展示沈知夏、叶舒颜等演示客户。
- [ ] 覆盖预约中心展示 5 类预约状态。
- [ ] 覆盖治疗摘要管理展示 active / voided。
- [ ] 覆盖智能随访展示来源任务。
- [ ] 覆盖平台租户管理和商业化健康展示。

### Task 2：补作废和敏感字段 smoke

**Files:**

- Modify: `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- Modify if needed: `src/modules/institution/tests/TreatmentSummaryManagementShell.test.tsx`

步骤：

- [ ] 覆盖作废摘要不请求 follow-up suggestions。
- [ ] 覆盖作废摘要不调用创建 follow-up task。
- [ ] 覆盖来源治疗摘要已作废提示。
- [ ] 覆盖页面不展示手机号原文、身份证、病历号原文、完整治疗正文、完整病历正文、咨询全文、图片 / 文件原文、SQL、stack、token、secret、`DATABASE_URL`。

## PR 4 详细任务建议

### Task 1：演示主线 UI 文案打磨

**Files:**

- Modify: `src/modules/workspace/components/InstitutionWorkspace.tsx`
- Modify if needed: `src/modules/institution/components/TreatmentSummaryManagementShell.tsx`
- Modify if needed: `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`

步骤：

- [ ] 减少页面中的工程化阶段命名。
- [ ] 对演示主线页面增强空态和错误态。
- [ ] 在不适合演示的占位页面中保持清楚边界，不误导已完成能力。

### Task 2：验证 UI 小打磨

运行：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/workspace/tests src/modules/institution/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## 总体验收标准

完成 PR 2-4 后，演示数据应满足：

- 老板版 15 分钟演示可以顺畅走完。
- 运营负责人版 30 分钟深度演示可以顺畅走完。
- 治疗摘要作废状态可见。
- 作废摘要阻断建议和任务创建。
- 已存在来源任务不自动取消。
- 审计日志可展示关键动作。
- 平台端可展示租户、套餐、配额和商业化健康。
- 所有数据均为虚构，不展示敏感字段。
