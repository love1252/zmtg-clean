# Phase 10 平台套餐 enforcement 轻量版实施计划

> **执行记录：** 本计划按 PR 1-5 拆分执行，Phase 10 收尾时保留 checklist 作为历史记录。

**目标：** 基于 Phase 9 的租户套餐 / 配额数据底座，为机构端新增客户和新增预约增加轻量服务端套餐配额 enforcement。

**架构方案：** Phase 10 先新增内部 quota enforcement helper，读取当前租户 active plan / quota limit，并按业务表实时 count 判断客户数和预约数是否超额。随后接入现有机构端客户 / 预约创建 API，超额或配置缺失时返回稳定 `409`，写 denied 审计，并保持客户更新、预约更新、随访状态流转、审计写入和只读 API 不受配额阻断。

**技术栈：** Next.js App Router route handlers、TypeScript、Drizzle ORM、PostgreSQL、Vitest、Testing Library、现有 demo session / AccessContext / audit repository。

---

## 当前 PR 状态

本计划用于 Phase 10 PR 1-5。当前 Phase 10 已完成：

- PR 1：Phase 10 spec / plan 文档。
- PR 2：quota enforcement domain / repository / helper。
- PR 3：客户 / 预约创建 API 接入 enforcement。
- PR 4：前端 client / UI 错误态与 smoke。
- PR 5：全量验证、workspace smoke 强化和文档收尾。

Phase 10 最终状态是“平台套餐配额 enforcement 轻量版”完成，不代表完整套餐商业化后台完成。

## 总边界

Phase 10 包含：

- 平台套餐 enforcement 轻量版。
- 新增客户配额校验。
- 新增预约配额校验。
- active plan / quota limit 读取。
- `customers` / `appointments` 按租户实时 count。
- 超额、缺少 active plan、缺少 quota limit 的 fail closed 行为。
- denied 审计 reason。
- 客户 / 预约 UI 稳定错误态。
- smoke / 文档收尾。

Phase 10 不包含：

- 套餐购买。
- 套餐变更。
- 续费。
- 支付。
- 合同。
- 发票。
- 计费流水。
- 租户创建。
- 租户编辑。
- 租户冻结 / 恢复。
- 租户删除。
- 完整套餐商业化后台。
- 治疗记录结构化摘要实现。
- 知识库 / RAG 真实能力。
- AI provider。
- Agent。
- 企业微信。
- HIS / CRM / OTA。
- API Key。
- OAuth。
- Webhook。
- 自动触达客户。
- 大规模 UI 重构。

## 文件职责规划

PR 1 新增：

- `docs/superpowers/specs/2026-05-31-phase10-plan-quota-enforcement-light-design.md`
  - Phase 10 目标、优先级、安全边界、错误码、审计 reason、API / schema 决策和 PR 拆分。
- `docs/superpowers/plans/2026-05-31-phase10-plan-quota-enforcement-light.md`
  - 后续 PR 执行计划、文件范围、风险和验证方式。

PR 2 已完成涉及：

- 新增：`src/modules/institution/server/tenant-quota-enforcement.ts`
  - 内部 quota enforcement helper，返回允许 / 拒绝原因。
- 修改：`src/modules/audit/domain/audit-events.ts`
  - 扩展 `AuditReason`，加入 quota enforcement reason。
- 修改：`src/modules/audit/domain/audit-event-query.ts`
  - 扩展审计查询 reason 白名单。
- 测试：`src/modules/institution/tests/TenantQuotaEnforcement.test.ts`
  - 覆盖 active plan、quota limit、实时 count、无套餐、无 limit、无 snapshot、超额和未超额。
- 测试：`src/modules/audit/tests/AuditEventsDomain.test.ts`
  - 覆盖新增 reason 不含敏感数据，并可被审计查询白名单识别。

PR 3 已完成涉及：

- 修改：`src/app/api/institution/customers/route.ts`
  - `POST` 创建客户前接入客户数 quota enforcement。
- 修改：`src/app/api/institution/appointments/route.ts`
  - `POST` 创建预约前接入预约数 quota enforcement。
- 修改：`src/modules/institution/server/tenant-business-api.ts`
  - 如需要，增加 mutation handler 对 quota denied 结果的稳定响应分支。
- 测试：`src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`
  - 覆盖允许写入、超额拒绝、无 active plan、无 quota limit、审计 reason、敏感字段禁区。

PR 4 已完成涉及：

- 修改：`src/modules/institution/client/tenant-business-client.ts`
  - 确认 `409` 映射为 `conflict`，稳定读取 quota 错误文案。
- 修改：`src/modules/institution/components/CustomerCenterShell.tsx`
  - 客户表单展示客户配额错误。
- 修改：`src/modules/institution/components/AppointmentCenterShell.tsx`
  - 预约表单展示预约配额错误。
- 测试：`src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
  - 覆盖配额错误 UI 和请求 body 不含 `tenantId`。
- 测试：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 覆盖 workspace smoke 和敏感字段不展示。

PR 5 已完成涉及：

- 修改：`README.md`
  - 标记 Phase 10 完成范围。
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
  - 更新 Phase 10 状态和后续建议。
- 修改：`docs/devlog/2026-05-31.md`
  - 记录 Phase 10 PR 2-5 完成情况。
- 修改：Phase 10 spec / plan 文档
  - 标记最终完成状态和实际边界。

## 稳定错误与审计约定

所有套餐 enforcement 拒绝建议返回 `409`，不使用 `403`，避免和 RBAC 权限拒绝混淆。

错误文案：

- 客户数超额：`客户配额已达上限，请联系平台管理员调整套餐`
- 预约数超额：`预约配额已达上限，请联系平台管理员调整套餐`
- 无 active plan：`当前租户未配置有效套餐，暂时无法新增记录`
- 无 quota limit：`当前租户套餐配额未配置，暂时无法新增记录`

审计 reason：

- `quota_exceeded_customers`
- `quota_exceeded_appointments`
- `missing_active_plan`
- `missing_quota_limit`

审计事件不得记录 request body、metadata、SQL、stack、连接串、手机号原文、身份证号、病历号原文、完整治疗记录正文或咨询对话全文。

## PR 1：Phase 10 spec / plan 文档

**范围：**

- 新增 Phase 10 design spec。
- 新增 Phase 10 implementation plan。
- 固化套餐 enforcement 轻量版 B-first 决策。
- 不改业务代码、页面、测试、API route、schema、migration、权限、认证或租户隔离。

**涉及文件：**

- 新增：`docs/superpowers/specs/2026-05-31-phase10-plan-quota-enforcement-light-design.md`
- 新增：`docs/superpowers/plans/2026-05-31-phase10-plan-quota-enforcement-light.md`

**风险：**

- 文档范围不清，导致后续 PR 混入计费、支付、套餐变更、租户状态管理、治疗记录、RAG、AI provider、Agent、企微、OAuth、Webhook 或 API Key。
- 错误码和审计 reason 不稳定，导致 API、UI、审计查询实现不一致。

**控制：**

- 明确 Phase 10 v1 只覆盖 `POST /api/institution/customers` 和 `POST /api/institution/appointments`。
- 明确不覆盖客户更新、预约更新、随访状态流转、审计写入、客户详情时间线和平台端只读查询。
- 明确不新增公开 API。
- 明确不新增 schema / migration。

- [x] **步骤 1：确认分支和工作区**

运行：

```bash
git status -sb
git branch --show-current
```

预期：

```text
## docs/phase10-plan-quota-enforcement-light
docs/phase10-plan-quota-enforcement-light
```

- [x] **步骤 2：新增 Phase 10 设计文档**

新增 `docs/superpowers/specs/2026-05-31-phase10-plan-quota-enforcement-light-design.md`，必须包含：

- Phase 10 目标。
- 为什么优先做套餐 enforcement 轻量版。
- 为什么治疗记录和 RAG 后置。
- 套餐 enforcement 轻量版 v1 的范围。
- 不纳入本阶段的内容。
- enforcement 只覆盖哪些写入。
- 不覆盖哪些写入。
- 无套餐租户默认策略。
- 无配额快照默认策略。
- 超额时的错误码和错误文案。
- 审计事件 reason 设计。
- 是否新增 API。
- 是否新增 schema / migration。
- 租户隔离边界。
- PII 风险边界。
- 推荐 PR 拆分。
- 每个 PR 的范围、风险和验证方式。

- [x] **步骤 3：新增 Phase 10 实施计划**

新增 `docs/superpowers/plans/2026-05-31-phase10-plan-quota-enforcement-light.md`，必须包含：

- 计划文档标准页首。
- 当前 PR 状态。
- 总边界。
- 文件职责规划。
- 稳定错误与审计约定。
- PR 1 到 PR 5 的范围、风险、控制和验证方式。
- 后续执行 agent 的检查清单。

- [x] **步骤 4：验证 PR 1**

运行：

```bash
git diff --check
git diff --name-only
```

预期：

```text
git diff --check 无输出且退出码为 0
docs/superpowers/specs/2026-05-31-phase10-plan-quota-enforcement-light-design.md
docs/superpowers/plans/2026-05-31-phase10-plan-quota-enforcement-light.md
```

本 PR 只修改 Markdown，不运行完整 test/typecheck/build。原因：未修改 TypeScript、页面、测试、API route、数据库 schema / migration、权限、认证或租户隔离。

- [x] **步骤 5：提交、推送并创建 Draft PR**

运行：

```bash
git add docs/superpowers/specs/2026-05-31-phase10-plan-quota-enforcement-light-design.md docs/superpowers/plans/2026-05-31-phase10-plan-quota-enforcement-light.md
git commit -m "docs: 固化 Phase 10 套餐配额 enforcement 计划"
git push -u origin docs/phase10-plan-quota-enforcement-light
gh pr create --draft --base main --head docs/phase10-plan-quota-enforcement-light --title "docs: 固化 Phase 10 套餐配额 enforcement 计划" --body-file <body-file>
```

PR 描述必须说明：

- 本次只做 Phase 10 PR 1。
- 只新增 spec / plan 文档。
- 不改代码。
- 不改 API。
- 不改数据库。
- 不改权限、认证、租户隔离。
- 不进入套餐 enforcement 代码开发。
- 不进入治疗记录或 RAG 开发。

## PR 2：quota enforcement domain / repository / helper

**范围：**

- 新增内部 quota enforcement helper。
- 读取 active plan / quota limit。
- 按 tenant live count。
- 覆盖无套餐、无 quota limit、无 snapshot、超额、未超额。
- 不接 API route。

**涉及文件：**

- 新增：`src/modules/institution/server/tenant-quota-enforcement.ts`
- 新增：`src/modules/institution/tests/TenantQuotaEnforcement.test.ts`
- 修改：`src/modules/audit/domain/audit-events.ts`
- 修改：`src/modules/audit/domain/audit-event-query.ts`
- 修改：`src/modules/audit/tests/AuditEventsDomain.test.ts`

**设计接口建议：**

```ts
export type TenantQuotaResource = 'customers' | 'appointments';

export type TenantQuotaDenialReason =
  | 'quota_exceeded_customers'
  | 'quota_exceeded_appointments'
  | 'missing_active_plan'
  | 'missing_quota_limit';

export type TenantQuotaDecision =
  | { allowed: true; limit: number; current: number }
  | { allowed: false; reason: TenantQuotaDenialReason; limit: number | null; current: number | null };
```

helper 输入必须只接收服务端确认的 `tenantId`：

```ts
export async function checkTenantQuotaForCreate(input: {
  database: TenantDatabase;
  tenantId: string;
  resource: TenantQuotaResource;
}): Promise<TenantQuotaDecision>;
```

**测试要求：**

- 无 active plan 返回 `missing_active_plan`。
- active plan 存在但缺少对应 `maxCustomers` / `maxAppointments` 返回 `missing_quota_limit`。
- 无 quota snapshot 且无法解析 quota limit 时返回 `missing_quota_limit`。
- `current < limit` 返回 allowed。
- `current >= limit` 对 customers 返回 `quota_exceeded_customers`。
- `current >= limit` 对 appointments 返回 `quota_exceeded_appointments`。
- 测试证明 helper 不接受 query/header/body/localStorage 的 `tenantId`。
- 测试证明不使用 `tenant_quota_snapshots.current*` 做强一致判断。

**风险：**

- count 查询缺少 `tenantId` 条件。
- 把 snapshot `current*` 当强一致用量。
- 无套餐或无 limit 时 fail open。
- quota helper 返回业务明细或敏感字段。

**验证方式：**

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantQuotaEnforcement.test.ts src/modules/audit/tests/AuditEventsDomain.test.ts
./node_modules/.bin/tsc --noEmit
```

## PR 3：接入客户 / 预约创建 API

**范围：**

- 接入 `POST /api/institution/customers`。
- 接入 `POST /api/institution/appointments`。
- 超额时不写业务表。
- 写 denied 审计。
- 不改客户更新、预约更新和随访状态流转。

**涉及文件：**

- 修改：`src/app/api/institution/customers/route.ts`
- 修改：`src/app/api/institution/appointments/route.ts`
- 可能修改：`src/modules/institution/server/tenant-business-api.ts`
- 修改：`src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`

**行为要求：**

- 解析 payload 白名单失败时仍返回 400，不进入 quota helper。
- 未登录仍返回 401，不进入 quota helper。
- RBAC 拒绝仍返回 403，不进入 quota helper。
- 缺少租户上下文仍返回 403，不进入 quota helper。
- quota 拒绝返回 409。
- quota 拒绝时不调用 `createCustomer` 或 `createAppointment`。
- quota 拒绝时写 denied 审计，使用稳定 reason。
- 预约创建仍校验 customer 属于当前租户。
- quota 错误响应不包含 SQL、stack、连接串、PII 或医疗正文。

**风险：**

- quota 拒绝后仍执行业务 insert。
- denied 审计遗漏，导致平台审计无法追踪套餐拒绝。
- 预约创建中 customer 归属校验顺序被破坏。
- 错误响应混入内部 quota 查询细节。

**验证方式：**

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
./node_modules/.bin/tsc --noEmit
```

## PR 4：前端 client / UI 错误态与 smoke

**范围：**

- 客户 / 预约表单展示“套餐配额已达上限”等稳定提示。
- 不发送 `tenantId`。
- 补 smoke / 表单测试。
- 不新增套餐购买、升级、支付或自动触达入口。

**涉及文件：**

- 修改：`src/modules/institution/client/tenant-business-client.ts`
- 修改：`src/modules/institution/components/CustomerCenterShell.tsx`
- 修改：`src/modules/institution/components/AppointmentCenterShell.tsx`
- 修改：`src/modules/institution/tests/TenantBusinessClient.test.ts`
- 修改：`src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

**行为要求：**

- `409` 继续映射为 `conflict`。
- 客户配额错误展示 `客户配额已达上限，请联系平台管理员调整套餐`。
- 预约配额错误展示 `预约配额已达上限，请联系平台管理员调整套餐`。
- 无 active plan / 无 quota limit 展示后端稳定中文错误。
- 表单请求 body 不包含 `tenantId`、套餐 code、quota limit 或 current count。
- UI 不显示购买、续费、支付、合同、发票或套餐变更按钮。

**风险：**

- UI 暗示完整商业化套餐后台已实现。
- 前端把套餐或租户信息作为可信输入发送。
- 配额错误后表单状态丢失，影响用户修正。

**验证方式：**

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessClient.test.ts src/modules/institution/tests/InstitutionBusinessShells.test.tsx src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
./node_modules/.bin/tsc --noEmit
```

## PR 5：Phase 10 验证 / 文档收尾

**范围：**

- 全量验证 Phase 10 套餐配额 enforcement。
- 强化 workspace smoke，覆盖客户 / 预约创建配额错误态。
- 更新 README / roadmap / devlog / Phase 10 spec / plan。
- 标记 Phase 10 完成。
- 明确未进入治疗记录、RAG、AI provider、Agent、企微、OAuth、Webhook、支付、合同、发票或完整套餐商业化后台。

**涉及文件：**

- 修改：`README.md`
- 修改：`docs/roadmap/2026-05-30-clean-roadmap-from-rebuild-plan.md`
- 修改：`docs/devlog/2026-05-31.md`
- 修改：`docs/superpowers/specs/2026-05-31-phase10-plan-quota-enforcement-light-design.md`
- 修改：`docs/superpowers/plans/2026-05-31-phase10-plan-quota-enforcement-light.md`

**风险：**

- 文档把 Phase 10 误描述为完整套餐商业化后台。
- 收尾遗漏无套餐、无 quota limit 或超额场景。
- 忘记说明 `tenant_quota_snapshots.current*` 不是强一致 enforcement 依据。
- smoke 只覆盖单页组件，遗漏 workspace 入口表单路径。

**验证方式：**

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/institution/tests src/modules/open-platform/tests src/modules/workspace/tests src/server/db/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
node scripts/run-vitest.mjs run
```

**最终完成项：**

- 套餐 / 配额 enforcement 地基已完成。
- 客户创建配额 enforcement 已完成。
- 预约创建配额 enforcement 已完成。
- 前端稳定错误态已完成。
- denied 审计 reason 稳定，覆盖 `quota_exceeded_customers`、`quota_exceeded_appointments`、`missing_active_plan`、`missing_quota_limit`。
- 客户更新、预约更新、随访状态流转、审计写入和只读 API 不受数量配额阻断。
- 前端不发送 `tenantId`，错误响应和 UI 不展示 SQL、stack、`DATABASE_URL`、连接串、token、secret、PII 或医疗正文。
- 未新增公开 API。
- 未新增 schema / migration。
- 未改权限、认证或租户隔离模型。
- 未进入套餐购买 / 变更 / 续费、支付、合同、发票、租户冻结 / 恢复、完整套餐商业化后台、治疗记录、AI / RAG / Agent、企微、OAuth、Webhook 或 API Key。

## 后续阶段建议

Phase 10 完成后，建议进入 Phase 11 Plan Mode 评估：

1. 治疗记录结构化摘要 v1。
2. 平台租户状态管理和状态变更审计。
3. 知识库 / RAG 基础准备。
4. 审计高级治理：导出、告警和复杂风控。
5. AI provider、调用日志和 Agent。
6. 企业微信、OAuth、Webhook、API Key。
7. 计费、合同、发票和支付。
