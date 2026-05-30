# 租户业务真实落库第三阶段设计

## 目标

在第一阶段权限底座和第二阶段业务领域模型之上，为智美天工建立真实持久化基础：数据库 schema、迁移、seed、只读仓储、只读 API route 和审计事件写入边界。

第三阶段的目标不是完成所有业务写操作，而是让客户、预约、随访和审计事件有可信落库路径，并确保所有读取都复用服务端访问上下文和权限守卫。

## 当前上下文

当前系统已经具备：

- 演示登录和 `getDemoAccessContextFromRequest`。
- `canAccessResource` 权限守卫和默认拒绝规则。
- 客户、预约、随访任务和审计事件的 TypeScript 领域模型。
- 机构端客户中心、预约中心和智能随访演示壳。

当前系统尚未具备：

- 数据库连接层。
- ORM 或 schema 定义。
- 数据库迁移和 seed 流程。
- 从数据库读取客户、预约、随访的仓储，以及审计事件写入仓储。
- 复用权限守卫的真实只读 API route。
- 权限拒绝和高风险动作的审计事件落库。

## 方案选择

第三阶段采用 PostgreSQL + Drizzle ORM。

选择理由：

- PostgreSQL 适合后续租户隔离、审计查询、索引和生产部署。
- Drizzle schema 与 TypeScript 类型贴近，便于复用第二阶段领域模型。
- 迁移文件可审查，适合当前按 PR 审核安全边界的节奏。

不选择 Prisma 的原因：

- Prisma 需要生成 client，新增运行时和构建约束较重。
- 当前阶段只需要清晰 schema、迁移和少量仓储，Drizzle 更轻。

不选择 SQLite 作为第三阶段目标的原因：

- SQLite 适合本地快速验证，但后续多租户、审计查询和部署形态仍会迁移到 PostgreSQL。
- 本阶段直接设计 PostgreSQL，避免第四阶段重复设计 schema。

## 第三阶段范围

本阶段包含：

- 新增 Drizzle 和 PostgreSQL 依赖。
- 新增 `drizzle.config.ts`。
- 新增数据库 schema：
  - `tenants`
  - `tenant_members`
  - `customers`
  - `appointments`
  - `follow_up_tasks`
  - `audit_events`
- 新增数据库连接模块。
- 新增 seed 脚本，将第二阶段演示领域数据写入数据库。
- 新增仓储层：
  - 客户只读仓储
  - 预约只读仓储
  - 随访只读仓储
  - 审计事件写入仓储
- 新增只读 API route：
  - `GET /api/institution/customers`
  - `GET /api/institution/appointments`
  - `GET /api/institution/followups`
- 新增审计事件写入：
  - 允许读取可以记录 `allowed`
  - 权限拒绝必须记录 `denied`
  - 跨租户拒绝必须记录 `cross_tenant_denied`
- 新增测试，覆盖 schema 映射、仓储租户过滤、API 权限守卫和审计写入。
- 更新安全文档和本地开发文档。

本阶段不包含：

- 客户、预约、随访的创建、更新、删除 API。
- 真实手机号、身份证号、病历号、治疗记录正文或咨询对话落库。
- API Key 生成、存储、轮换、吊销。
- OAuth 授权、回调、令牌交换。
- Webhook 签名、投递、重试。
- 多租户数据库 Row Level Security。
- 生产级认证替换。

## 数据模型

### `tenants`

记录租户基础信息。

字段：

- `id`
- `name`
- `status`
- `created_at`
- `updated_at`

### `tenant_members`

记录用户与租户的关系。第三阶段只 seed 演示成员，不做管理 API。

字段：

- `id`
- `tenant_id`
- `user_id`
- `role`
- `display_name`
- `created_at`
- `updated_at`

### `customers`

记录脱敏客户摘要。

字段：

- `id`
- `tenant_id`
- `display_name`
- `lifecycle`
- `priority`
- `owner_user_id`
- `project_interest`
- `masked_phone`
- `masked_medical_record_no`
- `last_touch_summary`
- `next_action`
- `tags`
- `created_at`
- `updated_at`

禁止字段：

- `phone_number`
- `id_number`
- `medical_record_no`
- `treatment_record`
- `consultation_transcript`

### `appointments`

记录预约摘要。

字段：

- `id`
- `tenant_id`
- `customer_id`
- `customer_display_name`
- `project`
- `scheduled_at`
- `consultant_user_id`
- `status`
- `note`
- `created_at`
- `updated_at`

### `follow_up_tasks`

记录随访任务摘要和状态。

字段：

- `id`
- `tenant_id`
- `customer_id`
- `customer_display_name`
- `journey_id`
- `stage`
- `status`
- `due_at`
- `suggested_action`
- `risk_level`
- `updated_by`
- `updated_at`
- `created_at`

### `audit_events`

记录审计事件。第三阶段先记录字段，不做复杂查询 UI。

字段：

- `event_id`
- `actor_id`
- `actor_role`
- `tenant_id`
- `scope`
- `resource`
- `action`
- `result`
- `reason`
- `occurred_at`
- `source`

## 访问控制流程

所有 API route 必须执行以下顺序：

1. 调用 `getDemoAccessContextFromRequest(request)` 获取服务端访问上下文。
2. 如果没有上下文，返回 401；本阶段不为匿名请求写入 `audit_events`，避免伪造 actor。
3. 以 `context.tenantId` 作为目标租户，不接受查询参数、请求体或 header 中的租户编号作为最终授权依据。
4. 调用对应领域读取函数或 `canAccessResource`。
5. 如果拒绝，写入审计事件并返回 403。
6. 如果允许，从仓储读取 `context.tenantId` 对应记录。
7. 返回脱敏摘要数据。

## 错误处理

API 返回稳定状态码：

- 未登录：401
- 缺少租户：403
- 跨租户拒绝：403
- 角色拒绝：403
- 数据库不可用：503

前端可见错误不暴露内部 SQL、连接串、凭证或策略细节。

## 测试策略

本阶段测试优先级：

1. schema 文件不包含禁止字段。
2. seed 数据只包含脱敏字段。
3. 仓储读取必须按 `tenantId` 过滤。
4. API route 只能使用服务端上下文租户。
5. 权限拒绝必须写审计事件。
6. 客户、预约、随访 API 不接受前端传入租户作为授权依据。
7. 数据库连接缺失时返回稳定错误，不泄露连接串。

## 验收标准

- Drizzle schema、迁移和 seed 脚本可运行。
- 只读 API route 通过测试。
- 所有真实读取都复用 `AccessContext` 和 `canAccessResource`。
- 审计事件可落库并覆盖允许、拒绝和跨租户拒绝。
- 不落真实 PII，不新增写入型业务 API。
- `eslint`、`vitest`、`next build`、`tsc --noEmit` 通过。

## 后续阶段

第三阶段完成后，建议第四阶段再做写入型业务流程：

1. 客户资料创建和更新。
2. 预约状态变更。
3. 随访任务状态变更 API。
4. 更完整的审计查询页面。
5. API Key / OAuth / Webhook 真实凭证能力。
