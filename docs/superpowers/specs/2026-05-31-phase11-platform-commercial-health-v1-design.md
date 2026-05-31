# Phase 11 平台套餐商业化管理增强 v1 设计

> 日期：2026-05-31
> 状态：Phase 11 PR 1 规划文档。本文只固化设计边界，不包含代码实现。

## 1. Phase 11 目标

Phase 11 推荐选择“平台套餐商业化管理增强 v1”，目标是在 Phase 9 已完成的平台端租户管理基础版和 Phase 10 已完成的套餐配额 enforcement 轻量版之上，为平台端补充只读商业化运营辅助视图。

本阶段 v1 目标：

- 展示平台端商业化健康摘要。
- 展示租户套餐覆盖情况。
- 展示租户套餐状态和套餐分配状态。
- 基于配额快照展示运营参考级配额风险。
- 识别缺少 active plan、缺少 quota limit、缺少 quota snapshot 的租户。
- 聚合近期 quota denied 审计信号。
- 明确 `tenant_quota_snapshots.current*` 与 Phase 10 live count enforcement 的区别。
- 不实现套餐购买、套餐变更、续费、支付、合同、发票、租户冻结 / 恢复或完整商业化后台。

Phase 11 v1 仍遵守当前项目的核心安全原则：机构端租户编号只能来自服务端访问上下文；平台端只展示租户运营元数据和审计安全 DTO；不能下钻客户、预约、随访、治疗记录、病历正文或咨询对话全文。

## 2. 为什么优先做平台套餐商业化管理增强

Phase 9 已完成平台端租户管理基础版：

- `tenant_plans`、`tenant_plan_assignments`、`tenant_quota_snapshots` 最小数据底座。
- demo seed 套餐、分配和配额快照。
- `GET /api/open-platform/tenants` 只读 API。
- 平台租户管理 UI。
- 租户状态、套餐、配额上限、当前用量和快照时间展示。

Phase 10 已完成套餐配额 enforcement 轻量版：

- 内部 quota enforcement helper。
- 客户数和预约数按当前租户 live count 判断。
- `POST /api/institution/customers` 和 `POST /api/institution/appointments` 创建前阻断。
- 超额、无 active plan、无 quota limit 时 fail closed。
- denied 审计 reason 稳定。
- 前端展示稳定套餐配额错误态。

Phase 11 在这个地基上做平台商业化健康视图，价值最直接：

- 商业化价值高：平台运营可以看到哪些租户已分配套餐、哪些租户配置缺失、哪些租户接近配额风险。
- 工程风险低：优先复用现有 `GET /api/open-platform/tenants` 和 `GET /api/open-platform/audit-events`，不新增 schema、migration 或公开 API。
- 隐私面较小：只展示租户运营元数据、配额快照和审计聚合，不展示业务明细或医疗内容。
- SaaS 交付关键：它把套餐数据从“只读列表”和“后台 enforcement”推进到平台运营可观察的商业化健康面板。

相比治疗记录和知识库 / RAG，平台套餐商业化管理增强更贴近 Phase 9 / Phase 10 已完成能力，也更容易在不扩大隐私面、不引入外部系统的前提下交付稳定增量。

## 3. 为什么治疗记录和 RAG 后置

治疗记录结构化摘要 v1 有明确业务价值，能补齐客户详情时间线中的治疗节点，支撑术后关怀、复诊复购和客户画像。但它涉及医疗敏感信息，即使只做摘要，也需要单独设计：

- 治疗摘要 schema / migration。
- 租户复合外键和客户归属校验。
- 治疗摘要字段白名单。
- 完整治疗记录正文、完整病历正文和咨询对话全文禁止边界。
- API DTO、timeline 聚合和 UI 展示规则。
- 审计事件、错误脱敏和敏感字段不返回测试。

知识库 / RAG 基础准备也应后置。即使不接真实 AI provider、不做 Agent、不做自动问答、不做复杂文件解析，知识库仍会涉及：

- 租户级知识内容隔离。
- 文件、文档或条目数据结构。
- 后续分块、embedding、检索命中和内容安全的架构选择。
- 未来 AI provider、成本控制和提示词安全边界。

如果 Phase 11 进入知识库，很容易只产生数据壳，或过早锁死后续 RAG 架构。因此 Phase 11 不混入治疗记录、知识库、RAG、AI provider 或 Agent。它们应分别进入后续独立 Plan Mode。

## 4. 平台套餐商业化管理增强 v1 范围

Phase 11 v1 只做平台端只读运营辅助。

可以包含：

- 套餐覆盖情况。
- 租户套餐状态。
- 租户套餐分配状态。
- 配额使用风险。
- 缺少 active plan 的租户。
- 缺少 quota limit 的租户。
- 缺少 quota snapshot 的租户。
- 近期 quota denied 审计信号。
- 平台端商业化健康摘要。
- 平台端只读运营视图。

推荐复用现有数据来源：

- `GET /api/open-platform/tenants`
  - 用于租户、套餐、套餐分配、配额快照和 snapshot 时间。
- `GET /api/open-platform/audit-events`
  - 用于查询近期 quota denied 审计事件。

推荐实现方式：

- PR 2 先新增平台商业化健康 view model / client 派生逻辑和测试。
- PR 3 再在平台租户管理或平台总览中展示商业化健康摘要。
- 不新增后端聚合 API，除非后续 PR 评估发现现有 API 无法稳定支撑安全 DTO；Phase 11 v1 默认不新增 API。
- 不新增 schema / migration。
- 不修改 Phase 10 enforcement 逻辑。

## 5. 不纳入本阶段

Phase 11 不做：

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
- 严格一致计数器。
- 计费流水。
- 客户 / 预约 / 随访业务明细下钻。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 大规模 UI 重构。

Phase 11 也不修改权限、认证或租户隔离模型。如果现有角色边界无法支持更细的商业化运营角色，应记录为后续 RBAC 规划，不在本阶段顺手改权限。

## 6. 商业化健康视图的指标设计

商业化健康视图建议只基于平台安全 DTO 和运营快照派生指标。

建议指标：

| 指标 | 数据来源 | 含义 | 边界 |
| --- | --- | --- | --- |
| 租户总数 | `GET /api/open-platform/tenants` | 当前平台可见租户数 | 运营元数据，不代表计费账户数 |
| 已分配套餐租户数 | `planCode` / `assignmentStatus` | 有套餐分配信息的租户数量 | 只读展示，不代表已付款 |
| active plan 覆盖数 | `planStatus === active` 且 `assignmentStatus === active` | 有可用套餐分配的租户数量 | 只代表配置状态 |
| 套餐覆盖率 | active plan 覆盖数 / 租户总数 | 平台商业化配置覆盖情况 | 运营参考，不作为财务指标 |
| 缺少 active plan 租户数 | 租户记录中无 active plan / active assignment | 可能导致 Phase 10 新增客户 / 预约 fail closed | 不自动变更套餐 |
| 缺少 quota limit 租户数 | maxCustomers 或 maxAppointments 缺失 | 可能导致 Phase 10 新增客户 / 预约 fail closed | 不自动补配置 |
| 缺少 quota snapshot 租户数 | `snapshotAt === null` | 缺少最近配额快照 | 不代表 enforcement 不可用，需结合 plan limit 规则 |
| 配额风险租户数 | snapshot current / max 达到阈值 | 运营参考级风险提醒 | snapshot 不是强一致 enforcement 依据 |
| 近期 quota denied 事件数 | `GET /api/open-platform/audit-events` | 近期套餐拒绝信号 | 只统计安全 DTO，不展示业务明细 |
| 最近 quota denied 时间 | 审计事件 `occurredAt` | 最近一次配额拒绝时间 | 不展示请求体或客户 / 预约明细 |

建议配额风险阈值：

- `>= 90%`：高风险。
- `>= 75%` 且 `< 90%`：关注。
- `< 75%`：正常。
- 缺失 max 或 current：配置缺失或不可判断。

这些阈值只用于运营提示，不用于 enforcement，不用于计费，不用于自动套餐升级。

## 7. 套餐覆盖率展示边界

套餐覆盖率只表达平台配置覆盖情况。

允许展示：

- 租户总数。
- 已分配套餐租户数。
- active plan 租户数。
- 无 active plan 租户数。
- 套餐名称、套餐 code、套餐状态、分配状态。

禁止展示或暗示：

- 已付款租户数。
- 收入、账单、发票、合同状态。
- 自动续费状态。
- 支付成功或失败。
- 套餐购买入口。
- 套餐变更入口。
- 自动升级能力。

UI 文案应使用：

- `套餐配置覆盖`
- `active plan 配置`
- `平台运营参考`
- `只读商业化健康`

UI 文案不应使用：

- `已付费`
- `应收`
- `续费`
- `账单`
- `自动升级`
- `立即购买`

## 8. 配额风险展示边界

配额风险基于 `tenant_quota_snapshots.max*` 和 `tenant_quota_snapshots.current*` 派生，只能作为运营参考。

允许展示：

- 客户数当前快照 / 上限。
- 预约数当前快照 / 上限。
- 随访任务当前快照 / 上限。
- AI 调用当前快照 / 上限。
- 风险级别：正常、关注、高风险、不可判断。
- 最近快照时间。

禁止展示或暗示：

- snapshot 当前用量是强一致计费依据。
- snapshot 当前用量是 Phase 10 enforcement 依据。
- snapshot 当前用量等于数据库实时 live count。
- 页面会自动阻断、自动升级或自动触达。

UI 文案必须使用：

- `配额快照`
- `运营参考`
- `最近快照时间`
- `非实时 enforcement 依据`

## 9. 缺失配置识别边界

Phase 11 v1 可以识别配置缺失，但不自动修复配置。

可识别：

- 缺少 active plan。
- 缺少 active plan assignment。
- 缺少 `maxCustomers`。
- 缺少 `maxAppointments`。
- 缺少 quota snapshot。
- snapshot 时间缺失。

关于 `maxFollowUps` 和 `maxAiCalls`：

- 当前 Phase 10 enforcement 只覆盖 customers 和 appointments。
- `maxFollowUps`、`maxAiCalls` 可作为平台展示字段参与运营参考。
- 不得暗示随访任务或 AI 调用已经有 Phase 10 同等级 enforcement。

展示建议：

- 缺少 active plan：`缺少有效套餐配置，新增客户 / 预约可能被 fail closed`。
- 缺少 quota limit：`缺少客户或预约配额上限，新增客户 / 预约可能被 fail closed`。
- 缺少 quota snapshot：`缺少配额快照，平台用量展示不可判断`。

禁止：

- 自动创建套餐。
- 自动补齐 quota snapshot。
- 自动变更租户状态。
- 自动通知客户或租户。

## 10. quota denied 审计信号使用边界

Phase 11 v1 可以使用 Phase 10 已稳定的 denied 审计 reason 作为商业化运营信号。

建议纳入聚合的 reason：

```text
quota_exceeded_customers
quota_exceeded_appointments
missing_active_plan
missing_quota_limit
```

允许展示：

- quota denied 事件数量。
- 涉及资源类型，例如 `customer`、`appointment`。
- 最近发生时间。
- reason 聚合。
- 按租户聚合后的信号摘要。

禁止展示：

- 请求体。
- 客户明细。
- 预约明细。
- 随访明细。
- 手机号原文。
- 身份证号。
- 病历号原文。
- 治疗记录正文。
- 咨询对话全文。
- SQL。
- stack。
- token。
- secret。
- `DATABASE_URL`。
- 数据库连接串。

实现建议：

- PR 2 可复用 `GET /api/open-platform/audit-events` 的白名单筛选。
- 可以对每个 quota reason 发起一次只读查询，并在前端 view model 聚合。
- 也可以查询近期 `result=denied` 后只在客户端过滤 quota reason，但必须确保只处理安全 DTO。
- 如果现有 API 只返回一页结果，页面应标注为“近期信号”，不要描述为全量统计。

## 11. snapshot 与 live enforcement 的区别

文档和 UI 必须明确：

- `tenant_quota_snapshots.current*` 是运营快照 / 展示参考。
- Phase 10 enforcement 仍以 live count 为准。
- `customers` 创建 enforcement 使用当前租户 `customers` 表 live count。
- `appointments` 创建 enforcement 使用当前租户 `appointments` 表 live count。
- 不允许把 snapshot 当前用量描述成强一致计费或 enforcement 依据。
- 页面文案应使用“配额快照”“运营参考”“最近快照时间”等表述。

Phase 11 不修改 Phase 10 enforcement 规则：

- 无 active plan：fail closed。
- 无 quota limit：fail closed。
- 客户数超额：拒绝新增客户。
- 预约数超额：拒绝新增预约。
- denied 时写稳定审计 reason。
- 客户更新、预约更新、随访状态流转、审计写入和只读 API 不受数量配额阻断。

## 12. 是否新增 API

Phase 11 v1 默认不新增 API。

优先复用：

```text
GET /api/open-platform/tenants
GET /api/open-platform/audit-events
```

不新增：

- 平台套餐购买 API。
- 平台套餐变更 API。
- 续费 API。
- 支付 / 计费 API。
- 合同 / 发票 API。
- 租户冻结 / 恢复 API。
- 新 enforcement API。
- 治疗记录 API。
- 知识库 / RAG API。
- AI provider / Agent API。

如果 PR 2 实现时发现现有 API 无法在不泄露业务明细的情况下支撑商业化健康聚合，应停止并重新进入 Plan Mode，而不是顺手新增 API。

## 13. 是否新增 schema / migration

Phase 11 v1 不新增 schema / migration。

原因：

- Phase 9 已新增 `tenant_plans`、`tenant_plan_assignments`、`tenant_quota_snapshots`。
- Phase 8 / Phase 10 已有 `audit_events.reason` 和稳定 quota denied reason。
- Phase 10 已有 active plan / quota limit / live count enforcement helper。
- v1 只做平台端只读运营辅助，可以从现有 DTO 派生。

不新增：

- 新套餐表。
- 新套餐变更历史表。
- 新计费表。
- 新合同表。
- 新发票表。
- 新配额计数器表。
- 新知识库表。
- 新治疗记录表。
- `metadata jsonb`。
- 请求体存储字段。

## 14. 租户隔离边界

Phase 11 必须继续遵守：

- 机构端不能通过 URL、header、body、localStorage 或任意前端状态传入 `tenantId`。
- 平台商业化健康视图只调用平台端 API。
- 平台端只展示租户运营元数据、配额快照和审计安全 DTO。
- 平台端不能通过商业化健康视图读取客户、预约、随访、治疗记录或咨询对话明细。
- 平台端 `tenantId` 只能作为租户运营归属和审计归属展示，不得作为机构端授权依据。
- `platform_admin` 可以读取现有平台租户详情 DTO。
- `platform_operator` 对完整租户详情仍按当前 Phase 9 边界保守处理。
- 机构角色不能访问平台商业化健康视图。

如果后续需要平台侧做租户业务明细下钻，必须单独进入 Plan Mode，设计审批流、二次审计、字段脱敏和角色边界。

## 15. PII / 医疗隐私边界

Phase 11 v1 不新增客户字段、不新增医疗字段、不新增知识库内容字段，PII 和医疗隐私风险低于治疗记录和 RAG。

仍必须禁止进入 schema、API、DTO、UI、测试快照或日志：

- 手机号原文。
- 身份证号。
- 病历号原文。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 客服消息全文。
- 客户明细。
- 预约明细。
- 随访任务明细。
- 请求体原文。
- SQL。
- stack。
- `DATABASE_URL`。
- token。
- secret。
- API Key。
- OAuth token。
- Webhook secret。

平台商业化健康视图中的 quota denied 信号只能展示聚合和安全 DTO 字段，不能展示业务正文。

## 16. 推荐 PR 拆分

Phase 11 推荐拆成 4 个 PR。

### PR 1：Phase 11 spec / plan 文档

范围：

- 新增 Phase 11 design spec。
- 新增 Phase 11 implementation plan。
- 固化平台套餐商业化管理增强 v1 的只读边界。
- 明确不新增 API、schema、migration、权限、认证或租户隔离。
- 不改业务代码。

风险：

- 文档边界不清，导致后续 PR 混入套餐购买、套餐变更、支付、合同、发票、租户冻结 / 恢复、治疗记录或 RAG。
- 未明确 snapshot 与 live enforcement 区别，导致 UI 把快照用量误写为强一致配额或计费依据。

验证方式：

```bash
git diff --check
```

本 PR 只修改 Markdown，不运行完整 test / typecheck / build。

### PR 2：平台商业化健康 view model / client 派生逻辑与测试

范围：

- 复用现有 `GET /api/open-platform/tenants`。
- 复用现有 `GET /api/open-platform/audit-events`。
- 新增平台商业化健康 view model。
- 新增平台商业化健康 client helper 或复用现有 client 并增加聚合函数。
- 派生套餐覆盖率、配额风险、配置缺失、quota denied 信号。
- 不新增 schema。
- 不新增 API。
- 不做 UI。

风险：

- 客户端把 quota snapshot 当前用量当作 live enforcement 依据。
- audit signal 聚合误展示业务明细或内部错误细节。
- 现有平台 audit API 单页结果被误描述成全量统计。

验证方式：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/open-platform/tests
./node_modules/.bin/tsc --noEmit
```

### PR 3：平台端租户管理 UI 增强

范围：

- 在平台租户管理或平台总览中展示商业化健康摘要。
- 展示套餐覆盖、配额风险、配置缺失、quota denied 信号。
- 文案明确“运营参考”“配额快照”“最近快照时间”。
- 不做购买 / 变更 / 支付。
- 不改 Phase 10 enforcement。

风险：

- UI 暗示完整商业化后台已实现。
- UI 文案把配额快照描述为实时强一致用量。
- UI 展示 quota denied 事件时泄露请求体、客户明细、预约明细、SQL、stack、token 或 secret。

验证方式：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/open-platform/tests src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
./node_modules/.bin/tsc --noEmit
```

### PR 4：Phase 11 smoke / 文档收尾

范围：

- 补 workspace smoke 测试。
- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 更新 Phase 11 spec / plan 完成状态。
- 标记 Phase 11 完成。
- 给出 Phase 12 建议。

风险：

- 收尾文档把 Phase 11 描述成完整商业化后台。
- smoke 只覆盖成功态，遗漏敏感字段和 snapshot 文案边界。
- 忘记说明治疗记录和 RAG 仍后置。

验证方式：

```bash
git diff --check
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## 17. Phase 11 完成标准

Phase 11 完成时应满足：

- 平台端可以看到商业化健康摘要。
- 平台端可以看到套餐覆盖情况。
- 平台端可以看到配额快照风险，且文案明确运营参考。
- 平台端可以识别缺少 active plan、缺少 quota limit、缺少 quota snapshot 的租户。
- 平台端可以看到近期 quota denied 审计信号聚合。
- 不新增 API。
- 不新增 schema / migration。
- 不改权限、认证或租户隔离模型。
- 不改 Phase 10 enforcement 逻辑。
- 不展示客户、预约、随访、治疗记录、病历正文、咨询对话、PII、SQL、stack、token、secret 或 `DATABASE_URL`。
- README、roadmap、devlog 和 Phase 11 spec / plan 与实际完成范围一致。

## 18. Phase 12 建议

Phase 11 完成后，建议重新进入 Plan Mode 评估：

1. 治疗记录结构化摘要 v1 的 schema、API、timeline 和安全边界。
2. 平台租户状态管理和状态变更审计。
3. 更多资源配额 enforcement，例如随访任务、员工数、AI 调用。
4. 审计高级治理：导出、告警和复杂风控。
5. 知识库 / RAG 基础准备。
6. AI provider、调用日志和 Agent。
7. 企业微信、OAuth、Webhook、API Key。
8. 支付、合同、发票和计费。
