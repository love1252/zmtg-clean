# Phase 10 平台套餐 enforcement 轻量版设计

> 状态：Phase 10 已完成。PR 1-5 已完成 spec / plan、quota enforcement helper、客户 / 预约创建 API 接入、前端稳定错误态、smoke 和文档收尾。

## 1. Phase 10 目标

Phase 10 推荐选择“平台套餐 enforcement 轻量版”，目标是在 Phase 9 已完成的租户套餐、套餐分配和配额快照数据底座之上，为机构端会增加业务记录数量的写入增加最小服务端配额校验。

本阶段 v1 目标：

- 基于当前服务端 `AccessContext.tenantId` 判断机构租户。
- 读取当前租户 active plan / quota limit。
- 使用业务表按 `tenantId` 实时 count 判断是否超过配额。
- 只拦截新增客户和新增预约。
- 超额或缺少有效套餐配置时 fail closed。
- 写入稳定 denied 审计事件。
- 不新增计费、支付、合同、发票或完整套餐商业化后台。

Phase 10 不改变前几个阶段的根原则：机构端不能通过 URL、header、body、localStorage 或任意前端状态切换租户；租户编号只能来自服务端访问上下文。

## 2. 为什么优先做套餐 enforcement 轻量版

Phase 9 已完成平台端租户管理基础版，包括：

- `tenant_plans`、`tenant_plan_assignments`、`tenant_quota_snapshots` 最小数据底座。
- demo seed 套餐、分配和配额快照。
- 平台端租户只读 API。
- 平台端租户管理 UI。
- 配额上限、当前用量和快照时间展示。

但 Phase 9 的套餐 / 配额仍然只是只读展示，不能约束机构端实际写入。Phase 10 做轻量 enforcement 能把平台商业化数据从“可见”推进到“可执行”，直接支撑 SaaS 交付中的套餐权益边界。

相比治疗记录和 RAG，套餐 enforcement 轻量版有三个优势：

- 商业化价值更直接：客户数和预约数是最基础的套餐权益。
- 技术路径更清晰：复用现有机构端写入 API、审计事务、租户隔离和 Phase 9 数据底座。
- 隐私风险更低：不新增客户 PII 字段、医疗字段、知识库内容或外部凭证。

## 3. 为什么治疗记录和 RAG 后置

治疗记录结构化摘要 v1 有明确业务价值，可以补齐客户详情时间线里的治疗节点，支撑术后关怀、复诊复购和客户画像。但它涉及医疗敏感信息，即使只做摘要，也需要单独设计：

- 治疗摘要 schema 和 migration。
- 租户复合外键和客户归属校验。
- 字段白名单、医疗正文禁止边界和 PII 拒绝规则。
- API DTO、UI 展示和时间线聚合边界。
- 审计事件和敏感字段不返回测试。

知识库 / RAG 基础准备也有长期价值，但当前不接 AI provider、不做 Agent、不做真实 RAG 问答、不做复杂文件解析。如果 Phase 10 进入知识库，很容易只产生数据壳，或过早锁死后续 embedding、检索、文件解析和内容安全架构。

因此 Phase 10 不混入治疗记录、知识库、RAG、AI provider 或 Agent。它们应分别进入后续独立 Plan Mode。

## 4. 套餐 enforcement 轻量版 v1 范围

Phase 10 v1 只覆盖会增加记录数量的机构端写入：

1. `POST /api/institution/customers`
2. `POST /api/institution/appointments`

实现原则：

- 配额校验在服务端执行。
- 客户端不发送 `tenantId`、套餐编号或配额字段。
- 校验使用当前服务端访问上下文中的 `tenantId`。
- 读取 active plan / quota limit。
- 使用业务表实时 count：
  - `customers` 按 `tenant_id` 统计当前客户数。
  - `appointments` 按 `tenant_id` 统计当前预约数。
- 使用 `tenant_quota_snapshots.max*` 作为 quota limit 来源之一。
- 不把 `tenant_quota_snapshots.current*` 当强一致判断。
- quota snapshot 的 `current*` 只作为平台展示 / 运营参考，不作为 enforcement 唯一依据。

## 5. 不纳入本阶段

Phase 10 不做：

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
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
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

Phase 10 也不重构权限、认证或租户隔离模型。如果现有 RBAC 无法表达套餐权益错误，v1 采用业务配额错误，不把它混入角色权限错误。

## 6. Enforcement 覆盖哪些写入

### 6.1 新增客户

覆盖：

```text
POST /api/institution/customers
```

判断规则：

- 必须有 active plan。
- 必须有客户数 quota limit。
- 使用 `customers` 表按当前 `tenantId` 实时 count。
- 当 `currentCustomerCount >= maxCustomers` 时拒绝新增客户。
- 拒绝时不插入客户记录。
- 拒绝时写 denied 审计，resource 建议为 `customer`，action 为 `create`。

### 6.2 新增预约

覆盖：

```text
POST /api/institution/appointments
```

判断规则：

- 必须有 active plan。
- 必须有预约数 quota limit。
- 使用 `appointments` 表按当前 `tenantId` 实时 count。
- 当 `currentAppointmentCount >= maxAppointments` 时拒绝新增预约。
- 拒绝时不插入预约记录。
- 拒绝时写 denied 审计，resource 建议为 `appointment`，action 为 `create`。
- 预约创建仍必须校验 `customerId` 属于当前租户。为了保持现有安全语义，客户不存在或不属于当前租户时仍应返回稳定 404，不应为了配额校验泄露其他租户客户信息。

## 7. 不覆盖哪些写入

Phase 10 v1 暂不覆盖：

1. 客户更新：`PATCH /api/institution/customers`
2. 预约更新：`PATCH /api/institution/appointments`
3. 随访状态流转：`PATCH /api/institution/followups`
4. 审计写入。
5. 客户详情时间线只读 API。
6. 机构端客户、预约、随访 GET API。
7. 机构端审计日志只读 API。
8. 平台端租户管理只读 API。
9. 平台端审计日志只读 API。

不覆盖原因：

- 客户更新和预约更新不增加记录数量，v1 不应阻断存量服务流程。
- 随访状态流转当前不新增随访任务，只改变状态，阻断它会影响运营闭环。
- 审计写入必须保持可用，不能因配额限制导致安全事件丢失。
- 只读 API 不增加业务用量，不应进入 enforcement。

## 8. 用量计算策略

Phase 10 v1 不把 `tenant_quota_snapshots.current*` 当强一致判断。

推荐策略：

1. 查询当前租户 active plan assignment。
2. 查询该 assignment 对应的最新 quota snapshot。
3. 从 quota snapshot 读取 `maxCustomers` 或 `maxAppointments` 作为 quota limit。
4. 使用业务表实时 count：
   - `customers` 表统计 `tenant_id = context.tenantId` 的行数。
   - `appointments` 表统计 `tenant_id = context.tenantId` 的行数。
5. 用实时 count 和 quota limit 判断是否允许写入。

这样可以保持 Phase 9 的配额快照作为平台展示数据，同时避免因快照的 `current*` 陈旧导致误放行或误拒绝。

并发边界：

- Phase 10 v1 是轻量版，不做数据库锁、计数器表或强一致配额扣减。
- 并发请求可能在极小窗口内超卖 1 条或少量记录。
- 如果商业化交付需要严格配额，应在后续阶段单独设计强一致计数器、事务锁或数据库约束。

## 9. 无套餐 / 无快照默认策略

Phase 10 v1 推荐 fail closed。

具体策略：

- 无 active plan：禁止新增客户 / 新增预约。
- 无 quota limit：禁止新增客户 / 新增预约。
- 无 quota snapshot 但有 active plan 和 quota limit：可以继续按实时 count 判断。

当前 Phase 9 的 quota limit 存在于 `tenant_quota_snapshots.max*`。如果实现阶段仍只从最新 quota snapshot 读取 limit，则“无 quota snapshot”会等价于“无 quota limit”，应 fail closed。

如果 PR 2 选择引入内部 mapper，把 active plan 的 quota limit 从可确认来源解析出来，则可支持“无 snapshot 但有 quota limit”的放行策略。这个来源必须是服务端可信数据，不能来自前端、localStorage、query、header 或 request body。

更保守的理由：

- 缺少套餐或配额上限属于商业化配置缺失。
- 放行会导致未配置租户绕过套餐边界。
- fail closed 比 fail open 更符合 SaaS 权益控制。

## 10. 错误码和错误文案

Phase 10 v1 推荐所有套餐 enforcement 拒绝统一返回 `409 Conflict`。

原因：

- 当前项目中 `403` 已主要表达登录角色 / 权限拒绝。
- 配额拒绝属于当前租户业务状态与写入请求冲突，而不是 RBAC 不允许。
- 统一 `409` 可让前端复用现有 `conflict` 错误分支，展示稳定业务提示。

建议错误码和文案：

| 场景 | HTTP 状态 | 稳定文案 |
| --- | --- | --- |
| 客户数超额 | `409` | `客户配额已达上限，请联系平台管理员调整套餐` |
| 预约数超额 | `409` | `预约配额已达上限，请联系平台管理员调整套餐` |
| 无 active plan | `409` | `当前租户未配置有效套餐，暂时无法新增记录` |
| 无 quota limit | `409` | `当前租户套餐配额未配置，暂时无法新增记录` |

错误响应不得返回：

- SQL。
- stack。
- 数据库连接串。
- `DATABASE_URL`。
- token。
- secret。
- 套餐内部调试对象。
- 客户、预约、随访明细。
- 手机号原文、身份证号、病历号原文。
- 完整治疗记录正文、完整病历正文、咨询对话全文。

## 11. 审计事件 reason 设计

Phase 10 v1 需要新增稳定审计 reason 字符串。由于 `audit_events.reason` 当前是 varchar，不是数据库 enum，新增 reason 不需要 schema / migration，但需要扩展 TypeScript union 和查询白名单。

建议 reason：

```text
quota_exceeded_customers
quota_exceeded_appointments
missing_active_plan
missing_quota_limit
```

建议映射：

| 场景 | resource | action | result | reason |
| --- | --- | --- | --- | --- |
| 新增客户超额 | `customer` | `create` | `denied` | `quota_exceeded_customers` |
| 新增预约超额 | `appointment` | `create` | `denied` | `quota_exceeded_appointments` |
| 无 active plan | 对应业务资源 | `create` | `denied` | `missing_active_plan` |
| 无 quota limit | 对应业务资源 | `create` | `denied` | `missing_quota_limit` |

审计事件不得包含 request body、metadata、SQL、stack、连接串、手机号原文、身份证号、病历号原文、完整治疗记录正文或咨询对话全文。

## 12. 是否新增 API

Phase 10 v1 不新增公开 API。

复用现有机构端写入 API：

```text
POST /api/institution/customers
POST /api/institution/appointments
```

不新增：

- 平台套餐变更 API。
- 租户创建 / 修改 / 删除 API。
- 租户冻结 / 恢复 API。
- 支付 / 计费 API。
- 知识库 / RAG API。
- 治疗记录 API。
- AI provider / Agent API。

PR 2 可新增内部 server helper / repository，但这些不是公开 HTTP API。

## 13. 是否新增 schema / migration

Phase 10 v1 默认不新增 schema / migration。

原因：

- Phase 9 已新增 `tenant_plans`、`tenant_plan_assignments`、`tenant_quota_snapshots`。
- v1 可从现有 quota snapshot 读取 `maxCustomers` 和 `maxAppointments`。
- v1 可从现有 `customers` 和 `appointments` 表实时 count。
- 审计 reason 字段是 varchar，新增 reason 字符串无需数据库迁移。

不新增：

- 新套餐表。
- 新计费表。
- 新配额计数器表。
- 新租户状态表。
- 新治疗记录表。
- 新知识库表。
- `metadata jsonb`。
- 请求体存储字段。

后续如果需要严格一致配额、员工数配额、AI 调用配额、续费和套餐变更历史，应单独进入 Plan Mode 再新增 schema。

## 14. 租户隔离边界

Phase 10 必须继续遵守：

- 租户编号只能来自服务端 `AccessContext`。
- 机构端 API 不接受客户端传入的 `tenantId`。
- quota helper 不读取 query、header、body 或 localStorage 中的租户编号。
- 业务表实时 count 必须包含 `tenant_id = context.tenantId` 条件。
- active plan / quota limit 查询必须按当前 `tenantId` 过滤。
- 平台端租户只读 API 不参与机构端 enforcement 决策。
- 平台角色不能通过机构端 POST API 创建客户或预约。
- 错误文案不能泄露其他租户是否存在套餐、客户或预约。

预约创建仍必须保持 `(tenant_id, customer_id)` 复合外键和服务端客户归属校验。跨租户或不存在客户继续返回稳定 404。

## 15. PII 风险边界

Phase 10 v1 不新增客户字段，不新增医疗字段，不新增知识库内容字段，PII 风险低于治疗记录和 RAG。

仍必须禁止进入 schema、API、DTO、UI、测试快照或日志：

- 手机号原文。
- 身份证号。
- 病历号原文。
- 完整治疗记录正文。
- 完整病历正文。
- 咨询对话全文。
- 请求体原文。
- SQL。
- stack。
- `DATABASE_URL`。
- token。
- secret。
- API Key。
- OAuth token。
- Webhook secret。

配额错误只展示套餐权益状态，不展示客户或预约明细。

## 16. 推荐 PR 拆分

### PR 1：Phase 10 spec / plan 文档

范围：

- 新增 Phase 10 design spec。
- 新增 Phase 10 implementation plan。
- 固化 B-first 决策。
- 明确 enforcement 覆盖范围、不覆盖范围、无套餐 / 无快照策略、错误码、审计 reason、API / schema 决策、租户隔离和 PII 边界。

不做：

- 不改业务代码。
- 不改页面。
- 不改测试。
- 不改 API route。
- 不改数据库 schema / migration。
- 不改权限、认证或租户隔离。

风险：

- 文档范围过大，误导后续 PR 混入计费、支付、套餐变更、治疗记录或 RAG。
- 错误码和审计 reason 没有提前稳定，导致 PR 3 UI / API 行为漂移。

验证方式：

- `git diff --check`
- 人工检查只新增 Markdown 文档。

### PR 2：quota enforcement domain / repository / helper

范围：

- 新增内部 quota enforcement helper。
- 读取当前租户 active plan / quota limit。
- 按 `tenantId` 实时 count `customers` 和 `appointments`。
- 返回明确结果：允许、客户超额、预约超额、缺少 active plan、缺少 quota limit。
- 扩展审计 reason TypeScript union 和审计查询 reason 白名单。
- 覆盖无套餐、无 quota limit、无 snapshot、超额、未超额测试。
- 不接 API route。

风险：

- 误用 `tenant_quota_snapshots.current*` 作为强一致判断。
- count 查询漏掉 `tenantId` 条件。
- 无套餐时 fail open。
- 把平台租户管理 DTO 直接用于机构端 enforcement，扩大平台/机构边界耦合。

验证方式：

- quota helper 单元测试。
- repository 查询测试。
- 审计 reason 白名单测试。
- `node scripts/run-vitest.mjs run src/modules/institution/tests/<quota-test-file>`
- `./node_modules/.bin/tsc --noEmit`

### PR 3：接入客户 / 预约创建 API

范围：

- 在 `POST /api/institution/customers` 接入 quota enforcement。
- 在 `POST /api/institution/appointments` 接入 quota enforcement。
- 超额、无 active plan、无 quota limit 时不写业务表。
- 拒绝时写 denied 审计。
- 保持现有 payload 白名单、PII 拒绝、访问上下文和事务审计模式。
- 不改客户更新、预约更新和随访状态流转。

风险：

- 超额时仍然插入业务表。
- 拒绝审计未写入或 reason 不稳定。
- 把 quota 错误和 RBAC `403` 混淆。
- 预约创建时绕过客户归属校验。

验证方式：

- API route 测试覆盖客户超额、预约超额、无 active plan、无 quota limit、允许写入。
- 测试确认超额时 create repository 未被调用。
- 测试确认 denied 审计不含 request body、PII、SQL、stack 或连接串。
- `node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`
- `./node_modules/.bin/tsc --noEmit`

### PR 4：前端 client / UI 错误态与 smoke

范围：

- 客户表单展示客户配额稳定错误提示。
- 预约表单展示预约配额稳定错误提示。
- 复用现有 client error kind，优先映射 `409` 为 conflict。
- 补客户中心和预约中心表单测试。
- 补 workspace smoke，确认表单请求不发送 `tenantId`，配额错误不展示敏感字段。

风险：

- UI 文案暗示支付、套餐购买或自动升级已实现。
- 前端提交套餐编号、配额字段或 tenantId。
- 客户 / 预约表单在配额错误后状态丢失。

验证方式：

- `node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
- `node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- `./node_modules/.bin/tsc --noEmit`

### PR 5：Phase 10 验证 / 文档收尾

范围：

- 全量测试。
- 更新 README、roadmap、devlog、Phase 10 spec / plan。
- 标记 Phase 10 完成。
- 明确仍未进入计费、支付、套餐变更、治疗记录、知识库 / RAG、AI provider、Agent、企微、OAuth、Webhook 或 API Key。

风险：

- 文档误写成已具备完整套餐商业化后台。
- 收尾遗漏无套餐、无 quota limit 或超额边界。
- 只跑局部测试，遗漏 workspace 或 API 回归。

验证方式：

- `git diff --check`
- `node scripts/run-vitest.mjs run`
- `./node_modules/.bin/tsc --noEmit`
- `node scripts/run-next.mjs build --webpack`

## 17. Phase 10 完成标准

Phase 10 完成时应满足：

- 新增客户会校验当前租户客户数配额。
- 新增预约会校验当前租户预约数配额。
- 无 active plan fail closed。
- 无 quota limit fail closed。
- 不使用 `tenant_quota_snapshots.current*` 作为强一致判断。
- 超额时返回稳定中文 `409` 错误。
- 超额或配置缺失时写 denied 审计 reason。
- 客户更新、预约更新、随访状态流转、审计写入和只读 API 不被配额阻断。
- 不新增公开 API。
- 不新增 schema / migration。
- 不返回或展示 PII、医疗正文、SQL、stack、连接串、token 或 secret。
- README、roadmap、devlog 和 Phase 10 spec / plan 与实际完成范围一致。

## 18. Phase 10 收尾状态

Phase 10 已完成，最终范围保持为“平台套餐配额 enforcement 轻量版”：

- 已完成套餐 / 配额 enforcement 地基：内部 helper 读取 active plan / quota limit，并按当前租户 live count 判断客户数和预约数。
- 已完成客户创建配额 enforcement：`POST /api/institution/customers` 在创建前校验客户数量配额。
- 已完成预约创建配额 enforcement：`POST /api/institution/appointments` 在创建前校验预约数量配额。
- 已完成 denied 审计：超额、无 active plan、无 quota limit 均使用稳定 reason 写入 denied 审计。
- 已完成前端稳定错误态：客户中心和预约中心展示安全中文提示，失败后保留表单输入，前端不发送 `tenantId`。
- 已完成 smoke / 文档收尾：workspace 入口 smoke 覆盖客户和预约配额错误态，README、roadmap、devlog 和 Phase 10 spec / plan 已同步。

最终明确未纳入 Phase 10：

- 套餐购买、套餐变更、续费、支付、合同、发票。
- 租户创建、租户编辑、租户删除、租户冻结 / 恢复。
- 完整套餐商业化后台、严格一致计数器、计费流水。
- 治疗记录结构化摘要实现、完整治疗记录正文、完整病历正文。
- 知识库 / RAG 真实能力、AI provider、Agent。
- 企业微信、HIS / CRM / OTA、API Key、OAuth、Webhook。
- 自动触达客户或大规模 UI 重构。

最终验证覆盖：

- 客户创建未超额成功、客户创建超额拒绝。
- 预约创建未超额成功、预约创建超额拒绝。
- 无 active plan 拒绝、无 quota limit 拒绝。
- 无 quota snapshot 但有 active plan / quota limit 时按 live count 判断。
- denied 时不写业务表，denied 时写审计，审计 reason 稳定。
- 客户更新、预约更新、随访状态流转不受数量配额阻断。
- 前端客户 / 预约表单展示稳定配额错误，失败后输入内容保留。
- 前端不发送 `tenantId`。
- 错误响应和 UI 不展示 SQL、stack、`DATABASE_URL`、连接串、token、secret、PII 或医疗正文。

后续建议进入 Phase 11 Plan Mode，重新评估治疗记录结构化摘要 v1、平台租户状态管理和状态变更审计、知识库 / RAG 基础准备、审计高级治理等方向。本设计不包含 Phase 11 实现。
