# 平台端套餐商业化管理闭环 V1-V4 设计方案

> 状态：docs-only 正式方案。日期来自本地命令 `date "+%Y-%m-%d"`，结果为 2026-06-23；时区为 CST +0800。
>
> 当前基线：分支 `main`，`HEAD = origin/main = f08e7a1b297397fdda8ef65e614b5cf91c486749`。本方案只规划 `/open-platform` 的“产品与套餐”和“租户管理”连续能力，不修改 `src/**`、不修改 `drizzle/**`、不新增 migration、不执行 SQL、不接真实支付、不接第三方商业化 API。

## 一、任务目标

建设“平台端套餐商业化管理闭环 V1-V4”，让平台管理员能围绕同一套套餐目录完成：

- 套餐目录配置：编辑套餐版本、展示价格、Agent 数量、员工席位、AI 调用、知识库存储、连接器和服务权益。
- 租户开通绑定套餐：新建或编辑租户时选择已发布套餐，并生成租户授权快照。
- 套餐变更与审计：租户套餐升级、降级、停用前展示差异对照，变更后生成新授权快照并写审计记录。
- 商业化计费预留：订单、合同、发票、支付只做只读/预留边界，不接真实支付、不接第三方商业化 API。

本目标要保持产品连续性，但执行上必须分阶段落地。核心原则是：**一个总闭环，多个小 PR，schema 先审批。**

## 二、本轮不是哪些内容

本方案不授权以下 runtime 实现：

- 不修改数据库 schema。
- 不新增 migration。
- 不执行 SQL。
- 不实现真实支付、订阅、续费、扣费、退款、对账。
- 不接 Stripe、微信支付、支付宝、银行、财务、电子签、发票平台或任何第三方商业化 API。
- 不保存银行卡、支付凭证、合同正文、发票税号原文、外部支付 token、第三方订单密钥。
- 不改真实 AI provider 调用逻辑。
- 不改密钥、provider key、OAuth、Webhook 签名。
- 不把套餐直接等同于用户角色权限。
- 不自动合并后续实施 PR。

如果后续进入 runtime，凡是涉及 DB/schema/migration/SQL 的改动，必须再次确认。

## 三、当前项目上下文

当前项目已有基础：

- `src/modules/open-platform/components/ProductPlanPanel.tsx`：产品与套餐页面目前是硬编码只读卡片，只展示 `Starter / Professional / Enterprise` 及权益词汇。
- `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`：租户管理 UI 已有“开通新租户”的 UI-only 向导和套餐选择词汇。
- `src/modules/open-platform/server/tenant-management-repository.ts`：平台租户列表能读取租户、套餐分配和配额快照。
- `src/modules/open-platform/domain/tenant-management.ts`：租户管理 DTO 已包含套餐名称、套餐编码、套餐状态、分配状态和配额快照字段。
- `src/modules/open-platform/domain/tenant-management-view.ts`：已有授权异常、配额风险、有效期状态等展示判断。
- `src/modules/audit/domain/audit-events.ts`：已有审计事件模型、reason 类型和敏感词禁区。
- `src/server/db/schema.ts` 已有：
  - `tenants`
  - `tenant_plans`
  - `tenant_plan_assignments`
  - `tenant_quota_snapshots`
  - `audit_events`

当前缺口：

- `tenant_plans` 只有套餐模板级字段：`id`、`name`、`code`、`description`、`status`，不能表达草稿、发布版本、展示价格、权益结构。
- `tenant_plan_assignments` 只绑定租户和套餐模板，不能绑定“某个已发布版本”。
- `tenant_quota_snapshots` 只表达少量配额数字，不能表达完整权益快照、连接器、服务权益、价格展示和版本解释。
- 还没有套餐变更记录，无法解释升级/降级前后的差异。
- 商业化只读预留没有结构化数据来源。

## 四、总架构

推荐采用四层模型：

1. **套餐模板 `tenant_plans`**
   - 表达稳定套餐身份，例如 `starter`、`professional`、`enterprise`、`custom`。
   - 作为套餐目录的父级，不直接承载每次发布的权益细节。

2. **套餐版本 `tenant_plan_versions`**
   - 表达某个套餐在某个时间点的完整权益。
   - 支持草稿、已发布、停用。
   - 产品与套餐页面编辑的是套餐版本。

3. **租户授权快照 `tenant_authorization_snapshots`**
   - 租户选择已发布套餐版本后，生成不可静默漂移的授权快照。
   - 租户详情和后续授权解释读快照，而不是实时读套餐模板。

4. **变更与商业化记录**
   - `tenant_plan_change_records` 记录套餐变更差异和审计解释。
   - `tenant_commercial_records` 记录订单、合同、发票、支付的只读/预留状态。

套餐负责“能力和容量”，角色权限负责“人能做什么”。二者不能合并。

## 五、DB/schema 方案

本节是需要后续审批的 schema 方案，不在当前 docs-only 任务中实施。

### 5.1 复用现有表

#### `tenant_plans`

继续作为套餐模板表。建议保留现有字段，不直接塞入所有权益字段，避免模板被频繁修改时影响历史解释。

后续可只补少量模板级字段，是否需要补列需单独评估：

- `sort_order`
- `visibility`
- `default_version_id`

如果希望减少 schema 改动，`default_version_id` 也可以暂时由查询时取最新 published 版本替代。

#### `tenant_plan_assignments`

继续作为租户当前套餐分配表。V2 起建议新增 `plan_version_id`，让分配指向具体已发布版本。

如果不想改老表，也可以通过 `tenant_authorization_snapshots.plan_assignment_id + plan_version_id` 建立版本关联。推荐优先新增 `plan_version_id`，因为查询和一致性更直接。

#### `tenant_quota_snapshots`

继续保留，用于当前租户管理和商业健康里已有的配额判断。不要用它承载所有权益。完整权益进入 `tenant_authorization_snapshots.snapshot_json`。

### 5.2 新增 `tenant_plan_versions`

用途：套餐编辑、草稿、发布、停用和对照预览的权威来源。

建议字段：

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) primary key | 版本 ID，例如 `plan-version-professional-20260623-001` |
| `plan_id` | varchar(64) fk -> `tenant_plans.id` | 所属套餐模板 |
| `version_code` | varchar(64) | 版本编码，例如 `2026-06-23-v1` |
| `status` | enum/text | `draft`、`published`、`retired` |
| `display_name` | varchar(120) | 展示名称 |
| `display_price` | varchar(80) | 展示价格，例如 `¥2999/月`、`面议`、`—` |
| `price_note` | text | 价格备注，只作展示 |
| `agent_limit` | integer nullable | Agent 数量 |
| `seat_limit` | integer nullable | 员工席位 |
| `monthly_ai_call_limit` | integer nullable | AI 调用/月 |
| `knowledge_storage_gb` | integer nullable | 知识库存储 |
| `connector_entitlements_json` | jsonb | 连接器权益，例如企微、HIS、CRM |
| `service_entitlements_json` | jsonb | 服务权益，例如培训、实施、响应级别 |
| `feature_entitlements_json` | jsonb | 模块/功能权益 |
| `quota_entitlements_json` | jsonb | 其他容量配额 |
| `change_summary` | text | 版本变更说明 |
| `created_by` | varchar(96) | 创建人 |
| `updated_by` | varchar(96) | 最近更新人 |
| `published_by` | varchar(96) nullable | 发布人 |
| `published_at` | timestamp nullable | 发布时间 |
| `retired_at` | timestamp nullable | 停用时间 |
| `created_at` | timestamp | 创建时间 |
| `updated_at` | timestamp | 更新时间 |

建议索引：

- unique(`plan_id`, `version_code`)
- index(`plan_id`, `status`)
- index(`status`, `updated_at`)

状态约束：

- draft 可以编辑。
- published 不允许原地改权益，只能复制为新 draft。
- retired 不允许新租户选择，但历史快照继续可解释。

### 5.3 新增 `tenant_authorization_snapshots`

用途：租户绑定套餐版本后的授权解释来源。

建议字段：

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) primary key | 快照 ID |
| `tenant_id` | varchar(64) fk -> `tenants.id` | 租户 |
| `plan_assignment_id` | varchar(64) fk -> `tenant_plan_assignments.id` | 分配记录 |
| `plan_version_id` | varchar(64) fk -> `tenant_plan_versions.id` | 套餐版本 |
| `status` | enum/text | `active`、`superseded`、`revoked` |
| `snapshot_json` | jsonb | 固化后的完整权益 |
| `quota_json` | jsonb | 固化后的容量配额 |
| `connector_json` | jsonb | 固化后的连接器权益 |
| `service_json` | jsonb | 固化后的服务权益 |
| `source_change_record_id` | varchar(64) nullable | 由哪次变更生成 |
| `generated_by` | varchar(96) | 生成人 |
| `generated_at` | timestamp | 生成时间 |
| `superseded_at` | timestamp nullable | 被替代时间 |
| `created_at` | timestamp | 创建时间 |

建议索引：

- index(`tenant_id`, `status`)
- index(`plan_assignment_id`, `generated_at`)
- index(`plan_version_id`)

一致性原则：

- 同一租户同一时间只能有一个 active 授权快照。
- 新快照生成成功后，旧 active 快照转为 superseded。
- 快照 JSON 不保存敏感信息、合同正文、支付凭证或外部 token。

### 5.4 新增 `tenant_plan_change_records`

用途：套餐变更差异对照、人工确认、审计追溯。

建议字段：

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) primary key | 变更记录 ID |
| `tenant_id` | varchar(64) fk -> `tenants.id` | 租户 |
| `from_plan_version_id` | varchar(64) nullable | 变更前版本 |
| `to_plan_version_id` | varchar(64) not null | 变更后版本 |
| `from_snapshot_id` | varchar(64) nullable | 变更前授权快照 |
| `to_snapshot_id` | varchar(64) nullable | 变更后授权快照 |
| `status` | enum/text | `previewed`、`applied`、`cancelled`、`failed` |
| `diff_json` | jsonb | 变更差异 |
| `reason` | text | 平台管理员填写的变更原因 |
| `requested_by` | varchar(96) | 请求人 |
| `applied_by` | varchar(96) nullable | 执行人 |
| `applied_at` | timestamp nullable | 执行时间 |
| `created_at` | timestamp | 创建时间 |
| `updated_at` | timestamp | 更新时间 |

建议索引：

- index(`tenant_id`, `created_at`)
- index(`tenant_id`, `status`)
- index(`to_plan_version_id`)

变更规则：

- 预览差异不改变租户授权。
- 只有 applied 才生成新授权快照。
- applied 必须写审计。
- 失败不能留下 active 快照半成品。

### 5.5 新增 `tenant_commercial_records`

用途：订单、合同、发票、支付的只读/预留边界。

建议字段：

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `id` | varchar(64) primary key | 商业化记录 ID |
| `tenant_id` | varchar(64) fk -> `tenants.id` | 租户 |
| `record_type` | enum/text | `order`、`contract`、`invoice`、`payment` |
| `status` | enum/text | `draft`、`pending`、`manual_review`、`completed`、`cancelled` |
| `display_code` | varchar(96) | 人工编号或展示编号 |
| `display_amount` | varchar(80) nullable | 展示金额，不参与扣费 |
| `period_label` | varchar(80) nullable | 展示周期 |
| `related_plan_change_id` | varchar(64) nullable | 关联套餐变更 |
| `note` | text nullable | 内部备注 |
| `occurred_at` | timestamp nullable | 展示发生时间 |
| `created_by` | varchar(96) | 创建人 |
| `updated_by` | varchar(96) | 更新人 |
| `created_at` | timestamp | 创建时间 |
| `updated_at` | timestamp | 更新时间 |

禁止字段：

- 不存银行卡号。
- 不存支付 token。
- 不存第三方支付 secret。
- 不存合同正文。
- 不存发票完整税务敏感信息。
- 不存 webhook 签名。

### 5.6 枚举建议

可新增或用 text + parser 白名单实现：

- `tenant_plan_version_status`: `draft`、`published`、`retired`
- `tenant_authorization_snapshot_status`: `active`、`superseded`、`revoked`
- `tenant_plan_change_status`: `previewed`、`applied`、`cancelled`、`failed`
- `tenant_commercial_record_type`: `order`、`contract`、`invoice`、`payment`
- `tenant_commercial_record_status`: `draft`、`pending`、`manual_review`、`completed`、`cancelled`

如果项目希望减少 Postgres enum 迁移成本，可使用 `varchar` + domain parser + 测试白名单。考虑现有 schema 已使用 enum，最终采用哪种方式需要 schema PR 时单独确认。

## 六、后端 API 方案

后续 runtime 可按以下 API 边界拆分。路径仅作设计，不在本文实现。

### 6.1 套餐目录 API

- `GET /api/v1/open-platform/plan-catalog`
  - 返回套餐模板、版本、草稿状态、已发布版本和对照字段。
- `POST /api/v1/open-platform/plan-catalog/:planId/versions`
  - 从当前版本复制草稿或创建新草稿。
- `PUT /api/v1/open-platform/plan-catalog/versions/:versionId`
  - 保存草稿。
- `POST /api/v1/open-platform/plan-catalog/versions/:versionId/publish`
  - 发布版本。
- `POST /api/v1/open-platform/plan-catalog/versions/:versionId/retire`
  - 停用版本。

### 6.2 租户绑定套餐 API

- `GET /api/v1/open-platform/tenant-plan-options`
  - 返回可选择的 published 套餐版本。
- `POST /api/v1/open-platform/tenants`
  - 新建租户并绑定套餐版本。
- `PUT /api/v1/open-platform/tenants/:tenantId/plan`
  - 编辑租户当前套餐，进入变更预览或直接应用。
- `GET /api/v1/open-platform/tenants/:tenantId/authorization`
  - 查看当前授权快照。

### 6.3 套餐变更 API

- `POST /api/v1/open-platform/tenants/:tenantId/plan-change-preview`
  - 返回差异对照，不写入授权快照。
- `POST /api/v1/open-platform/tenants/:tenantId/plan-change`
  - 应用变更，写 change record、assignment、authorization snapshot 和 audit。

### 6.4 商业化预留 API

- `GET /api/v1/open-platform/tenants/:tenantId/commercial-records`
  - 只读展示订单/合同/发票/支付预留记录。
- `POST /api/v1/open-platform/tenants/:tenantId/commercial-records`
  - 后续如开放，也只允许人工创建展示记录，不接第三方 API。

## 七、前端 UI 方案

### 7.1 产品与套餐

当前只读三卡片升级为“套餐目录配置台”：

- 顶部概览：套餐模板数、已发布版本数、草稿数、使用中的租户数。
- Tab 1：套餐目录
  - 展示 Starter / Professional / Enterprise / Custom。
  - 每张卡展示当前 published 版本。
  - 操作：编辑草稿、复制为新版本、发布、停用。
- Tab 2：权益对照预览
  - 按列对比 Agent 数量、员工席位、AI 调用、知识库存储、连接器、服务权益。
- Tab 3：版本记录
  - 展示每个套餐版本的发布时间、状态和变更说明。
- Tab 4：商业化预留
  - 只读展示订单、合同、发票、支付预留状态说明。

编辑体验：

- 使用抽屉或右侧面板，不跳出当前页面。
- 数字字段使用输入框/步进器。
- 连接器使用复选框或多选控件。
- 服务权益使用可增删行。
- 价格是“展示价格”，不是“计费价格”。
- published 版本不可原地编辑，只能复制成 draft。

### 7.2 租户管理

当前租户管理已有 UI-only 开通向导，后续改为真实受控流程：

- 新建租户时必须选择 published 套餐版本。
- 选择套餐后展示授权摘要：
  - Agent 数量
  - 员工席位
  - AI 调用/月
  - 知识库存储
  - 连接器
  - 服务权益
- 提交成功后生成 tenant、plan assignment、authorization snapshot 和 audit。
- 租户详情展示当前授权快照和套餐版本号。

### 7.3 套餐变更

在租户详情或列表操作中提供“变更套餐”：

- 先选择目标 published 套餐版本。
- 显示差异对照：
  - 增加项
  - 减少项
  - 不变项
  - 风险提示
- 必须填写变更原因。
- 应用后生成新快照，旧快照 superseded。

### 7.4 商业化预留

不显示“立即支付”“开票”“签约”“自动续费”等真实动作。

只允许展示：

- 订单状态：预留、待人工确认、已人工确认、取消。
- 合同状态：待上传、人工确认、已归档。
- 发票状态：待人工处理、已记录、取消。
- 支付状态：待线下确认、已人工确认、取消。

所有按钮文案必须避免暗示真实支付能力。

## 八、审计方案

后续 runtime 需要扩展安全审计，但应复用现有 `audit_events` 表。

建议资源：

- `tenant_plan`
- `tenant_plan_version`
- `tenant_authorization`
- `tenant_commercial_record`

建议动作：

- `read`
- `create`
- `update`
- `publish`
- `retire`
- `assign`
- `change`
- `manage_status`

如果当前 `ProtectedResource` 或 `ProtectedAction` 不支持这些值，需要单独进入权限和审计 domain 扩展 PR，并补齐测试。

建议 reason：

- `tenant_plan_version_published`
- `tenant_plan_version_retired`
- `tenant_plan_assignment_created`
- `tenant_authorization_snapshot_created`
- `tenant_plan_change_applied`
- `tenant_plan_change_cancelled`
- `tenant_commercial_record_created`
- `invalid_tenant_plan_payload`
- `invalid_tenant_plan_transition`
- `missing_published_plan_version`

审计禁区：

- 不写价格明细全文。
- 不写合同正文。
- 不写支付凭证。
- 不写第三方响应。
- 不写 SQL、stack、`DATABASE_URL`、完整错误对象。

## 九、实施拆分

### PR 1：schema/migration 基础

前置：必须得到用户确认。

范围：

- 新增套餐版本、授权快照、套餐变更记录、商业化预留记录 schema。
- 补 schema tests。
- 不做 UI。
- 不接真实支付。

### PR 2：套餐目录 domain/repository/API

范围：

- 套餐目录读取。
- 草稿保存。
- 发布版本。
- 停用版本。
- 后端 parser 和安全 DTO。
- 不接租户开通。

### PR 3：产品与套餐 UI V1

范围：

- `ProductPlanPanel` 从硬编码只读升级为套餐目录配置台。
- 支持编辑草稿、发布、对照预览。
- 不做真实商业化。

### PR 4：租户开通绑定套餐 V2

范围：

- 租户新建/编辑时选择 published 套餐版本。
- 生成授权快照。
- 租户管理展示当前授权快照。
- 不做套餐变更。

### PR 5：套餐变更与审计 V3

范围：

- 套餐变更预览。
- 差异对照。
- 应用变更。
- 新旧授权快照切换。
- 写审计。

### PR 6：商业化计费预留 V4

范围：

- 订单、合同、发票、支付只读/预留记录。
- 前端展示人工状态。
- 不接真实支付 API。

### PR 7：测试服验证和文档收口

范围：

- 全量 test、lint、build。
- 测试服 `/open-platform` 验证。
- 文档补充风险、回滚和已实现边界。

## 十、测试策略

每个阶段至少覆盖：

- domain parser 单测。
- repository 单测。
- API route 单测。
- UI smoke 测试。
- 审计敏感信息禁区测试。
- schema/migration 测试。

关键测试场景：

- draft 可编辑，published 不可原地编辑。
- 租户只能选择 published 套餐版本。
- 生成授权快照后，套餐模板变化不影响旧租户解释。
- 套餐变更预览不写入快照。
- 套餐变更应用后旧快照 superseded，新快照 active。
- 商业化预留不出现真实支付字段、第三方密钥或 webhook 语义。

## 十一、风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 一次性实现过大 | PR 难审，容易混入支付和权限风险 | 拆 PR，先 schema，再目录，再租户，再变更，再预留 |
| 套餐模板修改影响历史租户 | 授权解释漂移 | 使用套餐版本和租户授权快照 |
| 支付/合同语义误导用户 | 误以为系统已具备真实计费能力 | V4 只读预留，文案明确“人工记录/预留” |
| 审计写入包含敏感信息 | 安全风险 | 审计只记录动作、资源、reason 和低敏 ID |
| schema 与现有 tenant management 断裂 | 租户管理列表异常 | 保留现有表，新增表渐进接入 |
| enum 迁移后续修改成本高 | schema 演进受限 | schema PR 时评估使用 varchar + parser 白名单 |

## 十二、回滚思路

- PR 1 schema 如未上线，直接回滚提交。
- schema 上线后，后续 runtime PR 可以逐个回滚，不删除数据。
- 套餐版本发布后不物理删除，用 retired 状态停用。
- 授权快照不物理删除，用 superseded/revoked 状态解释。
- 商业化预留记录不接真实外部系统，因此回滚不需要第三方补偿。
- 如果 V3 变更失败，保留旧 active 授权快照，不切换到新版本。

## 十三、验收标准

### 总体验收

- `/open-platform` 的“产品与套餐”支持平台管理员维护套餐目录。
- `/open-platform` 的“租户管理”支持租户绑定已发布套餐版本。
- 租户授权使用快照解释，不随套餐模板静默漂移。
- 套餐变更有差异对照和审计记录。
- 订单、合同、发票、支付只做预留/只读边界。
- 不接真实支付、不接第三方商业化 API。

### V1 验收

- 可编辑套餐版本的展示价格、Agent 数量、员工席位、AI 调用、知识库存储、连接器和服务权益。
- 支持保存草稿。
- 支持发布版本。
- 支持套餐对照预览。
- published 版本不能原地修改。

### V2 验收

- 新建或编辑租户时只能选择 published 套餐版本。
- 提交后生成租户授权快照。
- 租户管理能展示当前套餐版本和授权摘要。

### V3 验收

- 套餐变更前展示差异对照。
- 套餐变更需要填写原因。
- 套餐变更后旧快照 superseded，新快照 active。
- 审计记录能追溯变更操作。

### V4 验收

- 能展示订单、合同、发票、支付的只读/预留状态。
- 页面不出现真实支付、真实扣费、真实开票或第三方商业化 API 操作。
- 不保存外部支付 token、webhook secret、合同正文或敏感发票信息。

## 十四、方案自检

- [x] 保持目标为 V1-V4 连续闭环，没有缩小成单页面改造。
- [x] 明确当前 docs-only 不修改 runtime。
- [x] 明确 DB/schema/migration 必须后续单独确认。
- [x] 明确不接真实支付、不接第三方商业化 API。
- [x] 明确套餐版本和授权快照是连续能力的核心。
- [x] 明确租户套餐变更需要差异对照和审计。
- [x] 明确商业化计费只做预留/只读边界。
- [x] 明确验收标准和拆 PR 顺序。
