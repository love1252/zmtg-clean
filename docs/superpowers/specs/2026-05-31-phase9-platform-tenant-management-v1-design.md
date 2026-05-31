# Phase 9 平台端租户管理基础版设计

> 日期：2026-05-31
> 状态：Phase 9 PR 1 文档阶段。本文只定义平台端租户管理基础版 v1 的目标、边界、数据模型建议、API 建议和 PR 拆分，不进入代码实现。

## 1. Phase 9 目标

Phase 9 推荐选择“平台端租户管理基础版”，目标是在 Phase 8 审计日志只读查询完成后，让平台端从静态运营总览推进到可读取真实租户运营元数据。

本阶段 v1 目标：

- 平台端查看租户列表。
- 查看租户基础状态。
- 查看基础套餐和配额信息。
- 保持平台端只读。
- 不下钻查看租户业务数据。
- 不实现套餐权益 enforcement。
- 不实现计费、支付、合同或发票。

Phase 9 v1 的核心判断是：先补齐 SaaS 平台运营所需的租户目录和套餐/配额展示，让平台后台具备可交付的商业化基础视图，同时延续前几个阶段已经形成的租户隔离、RBAC、DTO 脱敏和错误信息稳定原则。

## 2. 为什么优先做平台端租户管理基础版

平台端租户管理基础版是当前 SaaS 商业化交付最关键的下一步：

- Phase 5-6 已完成机构端客户、预约、随访和首页摘要的真实 API 闭环。
- Phase 7 已完成客户详情时间线 v1，把单客户经营摘要串起来。
- Phase 8 已完成机构端和平台端审计日志只读查询，为平台侧跨租户治理提供安全地基。
- 当前平台端仍以运营和治理总览为主，导航里已有“租户管理”和“产品与套餐”，但还没有真实租户管理 API/UI。
- 现有 `tenants` 表只有 `id`、`name`、`status` 和时间字段，无法真实展示套餐和配额。

相比治疗记录和 RAG，平台租户管理 v1 的隐私面更小，技术路径更清晰，也更能直接支撑商业化演示、租户开通流程设计、后续套餐权益和计费能力。

## 3. 为什么治疗记录和 RAG 后置

治疗记录结构化摘要 v1 有业务价值，但涉及医疗敏感信息。即使只做摘要，不展示完整病历正文，也需要单独设计：

- 治疗摘要字段白名单。
- 租户复合外键和客户归属校验。
- 医疗隐私禁区。
- 客户详情时间线聚合规则。
- API DTO 和 UI 展示边界。
- 禁止完整治疗记录、完整病历正文、咨询对话全文进入系统的测试策略。

知识库 / RAG 基础准备也必须后置。即使不接真实 AI provider，只做知识库基础设施，也会很快涉及：

- 文件导入和解析。
- 文档分块。
- 租户级内容隔离。
- 检索命中边界。
- 内容安全。
- 未来 embedding 成本和 AI provider 接入边界。

因此 Phase 9 不混入治疗记录、知识库、RAG、AI provider 或 Agent。它们应在平台租户基础能力完成后分别进入单独 Plan Mode。

## 4. 平台端租户管理基础版 v1 范围

Phase 9 v1 包含：

- 新增平台端租户只读查询能力。
- 新增租户套餐 / 配额最小持久化模型。
- seed demo 租户的套餐 / 配额数据。
- repository 查询租户运营元数据。
- 安全 DTO，只返回租户运营元数据。
- 平台端 `GET /api/open-platform/tenants` 只读 API。
- 平台端“租户管理”页面接入真实 API。
- UI 展示租户列表、状态、套餐和配额。
- loading、empty、error、403 和 503 状态。
- 平台端 workspace smoke。
- README、roadmap、devlog 和 Phase 9 文档收尾。

v1 可以展示：

- 租户 ID。
- 租户名称。
- 租户状态。
- 创建时间 / 更新时间。
- 套餐名称。
- 客户数上限。
- 预约数上限。
- 随访任务上限。
- AI 调用上限，先仅作为字段展示，不做 enforcement。

当前用量摘要不强制进入 Phase 9 v1。若后续安全派生，只能展示聚合计数，不能展示客户、预约、随访或治疗明细。建议把当前用量摘要放到 Phase 9 之后的独立小阶段，或在 Phase 9 PR 2 中只预留轻量模型讨论，不实现业务计数聚合。

## 5. 不纳入本阶段

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

Phase 9 也不重构权限模型、认证模型或租户隔离模型。如果现有权限语义无法覆盖更细的运营角色需求，只在文档和测试中记录风险，并后置到专门的 RBAC 规划阶段。

## 6. 平台端可见范围

平台端租户管理 v1 只展示租户运营元数据，不展示租户业务数据。

允许返回和展示：

- 租户 ID。
- 租户名称。
- 租户状态。
- 创建时间。
- 更新时间。
- 当前套餐名称。
- 配额上限。
- 套餐分配状态。

禁止返回和展示：

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

平台端不得通过租户管理 v1 API 下钻到 `customers`、`appointments`、`follow_up_tasks`、治疗记录或咨询对话。后续如需平台侧查看租户业务明细，必须单独进入 Plan Mode，设计审批流、二次审计、角色边界和字段脱敏。

## 7. `platform_admin` 与 `platform_operator` 角色边界建议

`platform_admin`：

- 可查看租户列表。
- 可查看租户基础详情。
- 可查看租户状态、套餐名称和配额上限。
- v1 不允许创建、修改、删除、冻结或恢复租户。
- v1 不允许进入租户客户、预约、随访、治疗、审计请求体或咨询明细。

`platform_operator`：

- 建议 v1 只看聚合摘要，不默认查看完整租户详情。
- 当前 `GET /api/open-platform/tenants` 如果返回完整租户列表，应默认只允许 `platform_admin` 访问。
- 如果需要给 `platform_operator` 开放能力，建议后续新增只返回聚合指标的端点或面板，例如租户总数、活跃租户数、暂停租户数和套餐分布。
- 不要为了 Phase 9 v1 重构权限模型。

当前权限模型已有 `platform_admin` 对 `tenant` 的 `read_detail` 和 `manage_status`，以及 `platform_operator` 对 `tenant` 的 `read_aggregate`。Phase 9 v1 应复用现有语义：租户列表和基础详情属于 `tenant/read_detail`，聚合摘要属于 `tenant/read_aggregate`。如果实现时发现 `canAccessResource` 无法表达某个细粒度边界，记录为后续风险，不在本阶段顺手重构。

## 8. 租户列表 DTO 字段边界

建议 DTO：

```ts
type OpenPlatformTenantListItem = {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
  plan: {
    id: string;
    name: string;
  };
  quotas: {
    customerLimit: number;
    appointmentLimit: number;
    followUpTaskLimit: number;
    aiCallLimit: number;
  };
};

type OpenPlatformTenantListResponse = {
  records: OpenPlatformTenantListItem[];
};
```

DTO 不包含：

- `tenantMembers` 明细。
- 客户、预约、随访、治疗记录明细。
- 审计事件明细。
- 请求体、metadata、SQL、stack、token、secret 或连接串。
- 手机号、身份证号、病历号原文、病历正文或咨询全文。

如果需要分页，v1 可以先沿用审计查询的简单分页经验，但租户规模在当前 demo 阶段较小，PR 3 可先只返回受控列表。后续租户数量变大时，再单独加入 `limit`、`cursor` 和筛选白名单。

## 9. 套餐 / 配额最小模型

现有 `tenants` 表不足以展示套餐和配额。Phase 9 v1 如要真实展示套餐 / 配额，建议新增最小 schema / migration。

推荐最小模型：

- `tenant_plans`
  - `id`
  - `name`
  - `customer_limit`
  - `appointment_limit`
  - `follow_up_task_limit`
  - `ai_call_limit`
  - `created_at`
  - `updated_at`
- `tenant_plan_assignments`
  - `id`
  - `tenant_id`
  - `plan_id`
  - `status`
  - `assigned_at`
  - `created_at`
  - `updated_at`

`tenant_quota_snapshots` 不建议作为 Phase 9 v1 必需表。原因是当前用量摘要不是 v1 强制目标，而且真实用量派生会触及客户、预约、随访和 AI 调用聚合。若后续需要当前用量摘要，可以单独新增：

- `tenant_quota_snapshots`
  - `id`
  - `tenant_id`
  - `customer_count`
  - `appointment_count`
  - `follow_up_task_count`
  - `ai_call_count`
  - `captured_at`

即使后续新增 `tenant_quota_snapshots`，也只能存聚合计数，不得存业务明细、客户标识集合、治疗记录正文、咨询全文或外部凭证。

Phase 9 v1 不做套餐 enforcement。配额字段仅用于展示和后续规划，不用于拦截客户创建、预约创建、随访任务流转或 AI 调用。

## 10. 是否新增 API

需要新增只读 API：

```text
GET /api/open-platform/tenants
```

选择 `/api/open-platform/tenants` 的原因：

- 当前平台端页面入口是 `/open-platform`。
- Phase 8 已采用 `GET /api/open-platform/audit-events`。
- 当前开放平台治理模块位于 `src/modules/open-platform`。
- 使用该路径能保持平台端 API 命名一致。

API v1 只读，不做：

- 创建租户。
- 修改租户。
- 冻结 / 恢复租户。
- 删除租户。
- 套餐 enforcement。
- 支付 / 计费。

API 权限建议：

- 未登录返回 401。
- `platform_admin` 可访问。
- `platform_operator` 对完整租户列表默认返回 403。
- 机构角色返回 403。
- 数据库异常返回 503，且不泄露 SQL、连接串或凭证。

## 11. 是否新增 schema / migration

需要新增 schema / migration。

原因：

- 当前 `tenants` 表只有 `id`、`name`、`status`、`created_at` 和 `updated_at`。
- Phase 9 v1 需要真实展示套餐名称和配额上限。
- 用静态配置伪造套餐 / 配额会延续平台静态总览的问题，不利于后续 SaaS 商业化交付。

推荐 PR 2 新增：

- `tenant_plans` 表。
- `tenant_plan_assignments` 表。
- `tenant_id + status` 或 `tenant_id` 查询索引。
- demo seed：至少为 `demo-tenant-001` 和 `demo-tenant-002` 分配套餐。

不建议在 Phase 9 v1 中修改 `tenants` 表直接塞入所有套餐字段。使用独立套餐表和分配表更容易后续扩展套餐版本、状态变更、审计和计费，但本阶段只做只读展示。

## 12. PII / 租户业务数据禁区

Phase 9 必须继续遵守前几阶段的隐私边界。

禁止进入 schema、API、DTO、UI、测试快照或日志：

- 手机号原文。
- 身份证号。
- 完整病历号。
- 完整治疗记录。
- 完整病历正文。
- 咨询对话全文。
- 客服消息全文。
- 客户、预约、随访业务明细。
- 审计请求体。
- 任意第三方凭证。
- OAuth token。
- Webhook secret。
- API Key。
- 数据库连接串。
- SQL。
- 错误 stack。

租户 ID 是平台运营元数据，可以在平台租户管理 v1 中展示；但不能被机构端使用，也不能作为机构端切换租户的参数。

## 13. 推荐 PR 拆分

### PR 1：Phase 9 spec/plan 文档

范围：

- 新增 Phase 9 design spec。
- 新增 Phase 9 implementation plan。
- 只做文档。
- 不改代码。
- 不改 API。
- 不改数据库。
- 不改权限、认证或租户隔离。

风险：

- 文档范围过大，误导后续 PR 混入治疗记录、RAG、AI、支付或套餐 enforcement。

验证：

```bash
git diff --check
```

### PR 2：租户套餐 / 配额最小 schema、seed、repository、domain 测试

范围：

- 新增最小 schema / migration。
- 新增 demo seed 套餐和租户套餐分配。
- 新增租户管理 domain / DTO。
- 新增 repository 查询。
- 新增 domain、schema、repository 测试。
- 不做 API route。
- 不做 UI。

风险：

- 套餐模型过度设计，提前滑入计费、支付、合同或 enforcement。
- 用量摘要误读取业务明细或扩大平台可见范围。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/server/db/tests src/modules/open-platform/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

### PR 3：平台端租户只读 API、DTO、角色边界和错误脱敏测试

范围：

- 新增 `GET /api/open-platform/tenants`。
- 只读返回租户运营元数据。
- 只允许平台角色按文档边界访问。
- `platform_admin` 可读取完整租户列表 DTO。
- `platform_operator` 对完整列表默认 403。
- 机构角色 403。
- 不返回租户业务明细。
- 不改权限模型。

风险：

- API DTO 泄露客户、预约、随访、治疗或审计请求体。
- `platform_operator` 被默认赋予过宽的租户详情能力。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/open-platform/tests
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

### PR 4：平台端租户管理 UI

范围：

- 平台端“租户管理”页面接入真实 API。
- 展示租户列表、状态、套餐和配额。
- 覆盖 loading、empty、error、403 和 503。
- 不做创建、修改、冻结、恢复或删除。
- 不做业务明细下钻。
- 不做大规模 UI 重构。

风险：

- 平台总览静态指标继续被误认为真实租户数据。
- UI 链接或按钮暗示未实现的创建、冻结、套餐变更或计费能力。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run src/modules/open-platform/tests src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

### PR 5：Phase 9 smoke / 文档收尾

范围：

- 补平台端租户管理入口 smoke。
- 补敏感字段不展示 smoke。
- 更新 README。
- 更新 roadmap。
- 更新 devlog。
- 更新 Phase 9 spec / plan 完成状态。
- 标记 Phase 9 完成。

风险：

- 收尾文档把 Phase 9 描述成已具备套餐 enforcement、计费或租户状态管理。

验证：

```bash
git diff --check
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

## 14. Phase 10 衔接建议

Phase 9 完成后，建议重新进入 Plan Mode，在以下方向中排序：

1. 治疗记录结构化摘要 v1。
2. 平台租户状态管理和状态变更审计。
3. 套餐权益 enforcement。
4. 知识库 / RAG 基础准备。
5. AI provider、调用日志和 Agent。
6. 企业微信、OAuth、Webhook、API Key。
7. 支付、合同、发票和计费。

如果 Phase 9 实现时发现 `platform_operator` 的只读聚合摘要很重要，应先补一个平台租户聚合摘要小阶段，而不是把完整租户详情默认开放给平台运营角色。
