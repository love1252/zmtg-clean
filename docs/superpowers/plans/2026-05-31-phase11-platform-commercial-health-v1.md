# Phase 11 平台商业化健康 v1 实施计划

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**状态：** Phase 11 已完成。

**目标：** 在 Phase 9 / Phase 10 基础上，为平台端增加只读商业化运营辅助视图，展示套餐覆盖、配额快照风险、缺失配置和近期 quota denied 审计信号。

**架构方案：** Phase 11 v1 默认不新增 API、schema 或 migration。PR 2 先在 open-platform 模块内基于现有平台租户 API 和平台审计 API 派生商业化健康 view model；PR 3 再把派生结果接入平台租户管理或平台总览 UI；PR 4 做 smoke 和文档收尾。

**技术栈：** Next.js 16、React 19、TypeScript、Vitest、Testing Library、Drizzle ORM 现有 schema、现有 `GET /api/open-platform/tenants`、现有 `GET /api/open-platform/audit-events`。

---

## 当前上下文

Phase 11 接在以下已完成能力之后：

- Phase 9：平台端租户管理基础版，已具备租户套餐 / 配额数据底座、只读 API 和 UI。
- Phase 10：套餐配额 enforcement 轻量版，已接入客户 / 预约创建，拒绝时返回稳定 `409` 并写 denied 审计。

Phase 11 v1 的核心边界：

- 只做平台端只读运营辅助。
- 不新增 API。
- 不新增 schema / migration。
- 不修改权限、认证或租户隔离。
- 不修改 Phase 10 enforcement 逻辑。
- 不进入治疗记录、知识库 / RAG、AI provider、Agent、企微、支付、合同或发票。

## 完成摘要

- PR 1 已完成 Phase 11 spec / plan 文档。
- PR 2 已完成平台商业化健康 view model / client 派生逻辑与测试。
- PR 3 已完成平台端租户管理商业化健康 UI。
- PR 4 已完成平台商业化健康 workspace smoke 和文档收尾。
- Phase 11 复用现有 `GET /api/open-platform/tenants` 和 `GET /api/open-platform/audit-events`。
- Phase 11 未新增 API、schema、migration，未改权限、认证、租户隔离或 Phase 10 enforcement。
- 页面和测试明确 `tenant_quota_snapshots.current*` 仅作配额快照 / 运营参考，不作为强一致计费或 enforcement 依据。

## 文件职责规划

### PR 1 只新增文档

新增：

- `docs/superpowers/specs/2026-05-31-phase11-platform-commercial-health-v1-design.md`
  - Phase 11 设计、范围、指标、风险、API / schema 决策、租户隔离和 PII 边界。
- `docs/superpowers/plans/2026-05-31-phase11-platform-commercial-health-v1.md`
  - Phase 11 后续 PR 执行计划、文件范围、风险和验证方式。

### PR 2 建议文件

建议新增：

- `src/modules/open-platform/domain/platform-commercial-health.ts`
  - 商业化健康领域类型和 view model 派生函数。
- `src/modules/open-platform/tests/PlatformCommercialHealthDomain.test.ts`
  - 套餐覆盖、配额风险、缺失配置、quota denied 信号和敏感字段边界测试。

建议修改：

- `src/modules/open-platform/client/platform-tenant-management-client.ts`
  - 如需要，复用或扩展只读 client helper；不得新增 mutation。
- `src/modules/audit/client/open-platform-audit-events-client.ts`
  - 如需要，复用现有平台审计 client；不得扩大 DTO 字段。

不修改：

- `src/app/api/open-platform/tenants/route.ts`
- `src/app/api/open-platform/audit-events/route.ts`
- `src/server/db/schema.ts`
- `drizzle/*.sql`
- `src/modules/security/domain/access-control.ts`
- `src/modules/security/server/access-context.ts`

### PR 3 建议文件

建议修改：

- `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
  - 在租户管理页展示商业化健康摘要。
- 或 `src/modules/workspace/components/PlatformConsole.tsx`
  - 如选择平台总览展示摘要，只做小范围接入。
- `src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`
  - 覆盖 UI 展示和敏感字段边界。
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 覆盖入口 smoke。

不新增购买、套餐变更、支付、合同、发票、租户冻结 / 恢复按钮。

### PR 4 建议文件

建议修改：

- `README.md`
- `docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- `docs/devlog/2026-05-31.md`
- `docs/superpowers/specs/2026-05-31-phase11-platform-commercial-health-v1-design.md`
- `docs/superpowers/plans/2026-05-31-phase11-platform-commercial-health-v1.md`
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

## 指标设计约定

PR 2 / PR 3 应围绕以下只读指标：

- 租户总数。
- 已分配套餐租户数。
- active plan 覆盖数。
- 套餐覆盖率。
- 缺少 active plan 租户数。
- 缺少 quota limit 租户数。
- 缺少 quota snapshot 租户数。
- 配额快照风险租户数。
- 近期 quota denied 事件数。
- quota denied 最近发生时间。
- quota denied reason 聚合。

配额风险仅基于 snapshot 做运营参考：

- `>= 90%`：高风险。
- `>= 75%` 且 `< 90%`：关注。
- `< 75%`：正常。
- 缺少 max / current：不可判断。

必须在领域模型或 UI 文案中明确：

- `tenant_quota_snapshots.current*` 是运营快照 / 展示参考。
- Phase 10 enforcement 仍以 live count 为准。
- 不允许把 snapshot 当前用量描述成强一致计费或 enforcement 依据。

## PR 1：Phase 11 spec / plan 文档

状态：已完成。

**范围：**

- 新增 Phase 11 设计文档。
- 新增 Phase 11 实施计划。
- 固化平台套餐商业化管理增强 v1 为默认方向。
- 明确治疗记录和 RAG 后置。
- 明确 snapshot 与 live enforcement 区别。
- 明确 quota denied 审计信号边界。
- 不改业务代码、页面、测试、API route、schema、migration、权限、认证或租户隔离。

**涉及文件：**

- 新增：`docs/superpowers/specs/2026-05-31-phase11-platform-commercial-health-v1-design.md`
- 新增：`docs/superpowers/plans/2026-05-31-phase11-platform-commercial-health-v1.md`

**风险：**

- 文档范围不清，导致后续 PR 混入套餐购买、套餐变更、支付、合同、发票、租户冻结 / 恢复、治疗记录或 RAG。
- 未明确 snapshot 与 live enforcement 区别，导致后续 UI 把快照用量误写为强一致配额或计费依据。
- 未明确 quota denied 信号边界，导致后续 UI 泄露请求体、客户明细、预约明细或敏感错误细节。

**控制：**

- 设计文档明确 Phase 11 v1 只做只读运营辅助。
- 设计文档明确默认不新增 API、schema 或 migration。
- 计划文档明确 PR 2 / PR 3 / PR 4 才进入后续实现。
- PR 1 只提交 Markdown 文件。

**验证方式：**

```bash
git diff --check
```

本 PR 只修改 Markdown，不运行完整 test / typecheck / build。原因：未修改 TypeScript、React 页面、测试、API route、数据库 schema / migration、权限、认证或租户隔离。

## PR 2：平台商业化健康 view model / client 派生逻辑与测试

状态：已完成。

**范围：**

- 复用现有 `GET /api/open-platform/tenants`。
- 复用现有 `GET /api/open-platform/audit-events`。
- 新增商业化健康 view model。
- 派生套餐覆盖率。
- 派生配额风险。
- 派生缺少 active plan、缺少 quota limit、缺少 quota snapshot 的租户。
- 聚合近期 quota denied 审计信号。
- 不新增 schema。
- 不新增 API。
- 不做 UI。

**建议涉及文件：**

- 新增：`src/modules/open-platform/domain/platform-commercial-health.ts`
- 新增：`src/modules/open-platform/tests/PlatformCommercialHealthDomain.test.ts`
- 可能修改：`src/modules/open-platform/client/platform-tenant-management-client.ts`
- 可能修改：`src/modules/audit/client/open-platform-audit-events-client.ts`

**核心类型建议：**

```ts
export type CommercialQuotaRiskLevel = 'normal' | 'watch' | 'high' | 'unknown';

export type CommercialHealthSummary = {
  tenantTotal: number;
  activePlanTenants: number;
  planCoverageRate: number;
  missingActivePlanTenants: number;
  missingQuotaLimitTenants: number;
  missingQuotaSnapshotTenants: number;
  highQuotaRiskTenants: number;
  watchQuotaRiskTenants: number;
  quotaDeniedSignals: {
    total: number;
    latestOccurredAt: string | null;
    byReason: Array<{ reason: string; count: number }>;
    byResource: Array<{ resource: string; count: number }>;
  };
};
```

**测试要求：**

- active plan 覆盖率按租户总数派生。
- 无 active assignment 或无 active plan 的租户被归入缺少 active plan。
- `maxCustomers` 或 `maxAppointments` 缺失时被归入缺少 quota limit。
- `snapshotAt === null` 时被归入缺少 quota snapshot。
- 配额风险基于 snapshot current / max 派生，并在测试名称中标明“运营参考”。
- quota denied 只聚合以下 reason：
  - `quota_exceeded_customers`
  - `quota_exceeded_appointments`
  - `missing_active_plan`
  - `missing_quota_limit`
- 输出不包含请求体、客户明细、预约明细、随访明细、手机号原文、身份证号、病历号原文、治疗记录正文、咨询对话全文、SQL、stack、token、secret 或 `DATABASE_URL`。

**风险：**

- 把 snapshot 当前用量误作为 live enforcement 或计费依据。
- audit API 单页结果被误描述为全量统计。
- view model 接收或返回业务明细。
- client helper 新增 mutation 或发送不必要的 body。

**控制：**

- 命名使用 `snapshot`、`operationalReference`、`recentSignal` 等语义。
- quota denied 聚合只处理审计安全 DTO。
- 所有数据来源保持只读 GET。
- 测试覆盖敏感字段不透出。

**验证方式：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/open-platform/tests
./node_modules/.bin/tsc --noEmit
```

## PR 3：平台端租户管理 UI 增强

状态：已完成。

**范围：**

- 在平台租户管理或平台总览中展示商业化健康摘要。
- 展示套餐覆盖、配额风险、配置缺失、quota denied 信号。
- 文案明确“运营参考”“配额快照”“最近快照时间”。
- 不做购买 / 变更 / 支付 / 合同 / 发票。
- 不改 Phase 10 enforcement。
- 不新增 API。
- 不新增 schema / migration。

**建议涉及文件：**

- 修改：`src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
- 可能修改：`src/modules/workspace/components/PlatformConsole.tsx`
- 修改：`src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`
- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

**UI 展示建议：**

- 顶部摘要：
  - `套餐覆盖率`
  - `缺少有效套餐`
  - `配额高风险`
  - `近期配额拒绝`
- 租户列表内辅助标识：
  - `active plan`
  - `缺少 quota snapshot`
  - `配额快照关注`
  - `配置不可判断`
- quota denied 区块：
  - 事件数量。
  - 最近发生时间。
  - reason 聚合。
  - resource 聚合。

**文案要求：**

- 使用 `配额快照`。
- 使用 `运营参考`。
- 使用 `最近快照时间`。
- 使用 `近期配额拒绝信号`。
- 不使用 `实时计费用量`。
- 不使用 `强制扣减`。
- 不使用 `立即购买`、`自动升级`、`续费`、`支付`、`发票`。

**风险：**

- UI 暗示完整商业化后台已实现。
- UI 把配额快照描述为实时强一致用量。
- UI 展示 quota denied 事件时泄露请求体、客户明细、预约明细、SQL、stack、token 或 secret。
- 页面变复杂后影响平台租户管理现有 loading、empty、403、503 状态。

**控制：**

- 只新增只读展示区块。
- 不添加 mutation 按钮。
- 不展示客户、预约、随访、治疗记录或咨询明细。
- UI 测试覆盖敏感字段不显示。
- workspace smoke 覆盖平台租户管理入口仍稳定。

**验证方式：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/open-platform/tests src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
./node_modules/.bin/tsc --noEmit
```

## PR 4：Phase 11 smoke / 文档收尾

状态：已完成。

**范围：**

- 补 workspace smoke 测试。
- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 更新 Phase 11 spec / plan 完成状态。
- 标记 Phase 11 完成。
- 给出 Phase 12 建议。

**建议涉及文件：**

- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-05-31.md`
- 修改：`docs/superpowers/specs/2026-05-31-phase11-platform-commercial-health-v1-design.md`
- 修改：`docs/superpowers/plans/2026-05-31-phase11-platform-commercial-health-v1.md`
- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

**smoke 覆盖要求：**

- 平台端进入租户管理或平台总览后展示商业化健康摘要。
- 展示套餐覆盖、配额快照风险、配置缺失和 quota denied 信号。
- 文案包含“配额快照”或“运营参考”。
- 不发送套餐购买、套餐变更、续费、支付、合同、发票、租户冻结 / 恢复或 enforcement mutation。
- 不展示客户明细、预约明细、随访明细、治疗记录、病历正文、咨询对话、手机号原文、身份证号、病历号原文、SQL、stack、token、secret 或 `DATABASE_URL`。

**文档收尾要求：**

- README 标记 Phase 11 完成。
- roadmap 标记 Phase 11 完成，并把治疗记录结构化摘要、平台租户状态管理、知识库 / RAG、AI、企微、OAuth、Webhook、支付、合同、发票继续后置。
- devlog 记录 PR 1-4 范围和验证结果。
- Phase 11 spec / plan 更新为完成状态。

**风险：**

- 文档把 Phase 11 写成完整商业化后台。
- 收尾遗漏 snapshot 与 live enforcement 的区别。
- smoke 只覆盖成功态，遗漏敏感字段和禁止 mutation。

**控制：**

- 文档明确 Phase 11 只做平台端只读运营辅助。
- 文档明确 Phase 10 enforcement 未改。
- smoke 明确禁止购买 / 变更 / 支付 / enforcement mutation。

**验证方式：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/open-platform/tests src/modules/workspace/tests
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## 不纳入 Phase 11

Phase 11 全阶段不做：

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
- 套餐购买。
- 套餐变更。
- 续费。
- 租户创建。
- 租户编辑。
- 租户删除。
- 租户冻结 / 恢复。
- 自动升级套餐。
- 自动触达客户。
- 自动触达租户。
- 完整套餐商业化后台。
- enforcement 逻辑改造。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 大规模 UI 重构。

## 执行顺序

1. [x] 先合并 PR 1 文档。
2. [x] 再执行 PR 2 view model / client 派生逻辑。
3. [x] PR 2 合并后执行 PR 3 UI 增强。
4. [x] PR 3 合并后执行 PR 4 smoke / 文档收尾。

不得跳过 PR 1 直接进入代码实现。

## Phase 11 完成标准

Phase 11 完成时应满足：

- 平台端有商业化健康摘要。
- 套餐覆盖情况可见。
- 配额快照风险可见，且文案明确运营参考。
- 缺少 active plan、缺少 quota limit、缺少 quota snapshot 的租户可见。
- 近期 quota denied 审计信号可见。
- 不新增 API。
- 不新增 schema / migration。
- 不改权限、认证或租户隔离。
- 不改 Phase 10 enforcement。
- 不展示业务明细、PII、医疗正文、SQL、stack、token、secret 或 `DATABASE_URL`。

Phase 11 PR 4 收尾后，上述完成标准均已满足；后续只进入 Phase 12 Plan Mode，不在 Phase 11 分支继续扩展实现。

## Phase 12 建议

Phase 11 完成后，建议进入 Phase 12 Plan Mode 评估：

1. 治疗记录结构化摘要 v1。
2. 平台租户状态管理和状态变更审计。
3. 更多资源配额 enforcement。
4. 审计高级治理。
5. 知识库 / RAG 基础准备。
6. AI provider、调用日志和 Agent。
7. 企业微信、OAuth、Webhook、API Key。
8. 支付、合同、发票和计费。
