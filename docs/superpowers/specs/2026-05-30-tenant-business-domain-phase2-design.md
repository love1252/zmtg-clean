# 租户业务领域模型第二阶段设计

## 目标

在第一阶段租户隔离与 RBAC 权限底座之上，建立客户资料、预约、随访任务和审计事件的服务端领域模型，为后续数据库落库、API route 和开放平台真实能力提供稳定边界。

第二阶段仍然不接真实数据库、不新增真实业务 API、不保存真实客户 PII、不实现 API Key / OAuth / Webhook 真实凭证能力。

## 当前上下文

当前系统已经具备：

- 演示登录与服务端演示访问上下文。
- `AccessContext`、`canAccessResource` 和默认拒绝权限矩阵。
- 机构端客户中心、预约中心、智能随访的静态演示壳。
- 开放平台治理领域词汇和安全文档。

当前系统尚未具备：

- 可复用的客户、预约、随访服务端领域实体。
- 租户过滤后的业务记录读取函数。
- 随访任务状态机和合法流转规则。
- 可落库前复用的审计事件字段模型。
- 将权限拒绝、跨租户拒绝和高风险动作纳入审计事件的统一结构。

## 范围

本阶段包含：

- 定义客户资料领域模型，只使用演示数据和脱敏字段。
- 定义预约领域模型，覆盖预约状态、到院状态和改约边界。
- 定义随访任务状态机，覆盖待处理、进行中、已升级、已完成和已取消。
- 定义审计事件领域模型，覆盖允许、拒绝、跨租户、敏感明细拒绝和状态流转。
- 所有业务读取函数必须接收服务端 `AccessContext`，并调用 `canAccessResource`。
- 新增测试锁住租户过滤、跨租户拒绝、敏感字段不暴露、状态机非法流转拒绝和审计字段完整性。
- 更新安全文档，说明第二阶段仍为领域模型阶段。

本阶段不包含：

- 数据库 schema、迁移、ORM、seed 脚本。
- 新增真实客户、预约、随访 API route。
- 真实手机号、身份证号、病历号、治疗记录明细或咨询对话。
- API Key 生成、存储、轮换、吊销。
- OAuth 授权、回调、令牌交换。
- Webhook 签名、投递、重试。
- 前端页面大改版。

## 设计原则

### 服务端上下文先行

客户、预约、随访和审计读取都必须从服务端 `AccessContext` 开始。函数不得接收前端传来的角色作为授权依据，也不得用 URL、查询参数、请求体里的租户编号绕过上下文。

### 领域模型先于落库

第二阶段只定义可测试的 TypeScript 领域模型和纯函数。后续落库时，数据库 schema 和 API route 必须复用这些类型、状态名、权限守卫和审计字段。

### 敏感数据默认脱敏

演示记录可以包含 `maskedPhone`、`maskedMedicalRecordNo` 这类脱敏字段，但不能包含真实手机号、身份证号、病历号、凭证明文或 Webhook 目标地址。

### 租户过滤不可选

机构角色读取客户、预约和随访记录时，只能返回 `context.tenantId` 对应记录。跨租户访问必须返回权限拒绝结果，并且可以转换为审计事件。

### 状态机显式流转

随访任务只能按显式 transition 流转，非法流转返回稳定原因码。任何升级、完成、取消都应能生成审计事件字段。

## 文件边界

新增文件：

```text
src/modules/institution/domain/customer-records.ts
src/modules/institution/domain/appointment-records.ts
src/modules/institution/domain/followup-workflow.ts
src/modules/audit/domain/audit-events.ts
src/modules/institution/tests/TenantBusinessDomain.test.ts
src/modules/audit/tests/AuditEventsDomain.test.ts
```

修改文件：

```text
docs/security/tenant-rbac-phase1.md
```

不修改文件：

```text
src/app/api/**
.env*
package.json
next.config.ts
```

## 核心接口

客户与预约读取函数返回稳定的结果联合类型：

```ts
export type TenantBusinessResult<T> =
  | { allowed: true; records: T[] }
  | { allowed: false; reason: 'missing_tenant' | 'cross_tenant_denied' | 'role_denied' | 'sensitive_detail_denied' };
```

所有读取函数必须调用 `canAccessResource`：

```ts
const decision = canAccessResource({
  context,
  resource: 'customer',
  action: 'read_own_tenant',
  targetTenantId,
});
```

审计事件必须包含：

- `eventId`
- `actorId`
- `actorRole`
- `tenantId`
- `scope`
- `resource`
- `action`
- `result`
- `reason`
- `occurredAt`
- `source`

## 测试策略

第二阶段测试优先级：

1. 机构管理员只能读取本租户客户、预约、随访记录。
2. 机构管理员跨租户读取被拒绝。
3. 租户作用域缺少 `tenantId` 被拒绝。
4. 平台角色默认不能读取客户、预约、随访明细。
5. 演示业务记录不包含真实敏感字段。
6. 随访任务合法流转成功，非法流转拒绝。
7. 审计事件包含完整字段和稳定结果码。
8. 审计事件不包含凭证明文或敏感风险词。

## 验收标准

- 所有新增领域函数都有测试覆盖。
- 客户、预约、随访读取均复用第一阶段权限守卫。
- 跨租户读取不返回任何业务记录。
- 敏感字段只允许脱敏展示字段。
- 随访状态机非法流转返回稳定拒绝原因。
- 审计事件可表达允许、拒绝和状态流转。
- 不新增数据库、API route、依赖或生产配置。

## 下一阶段

第二阶段完成后，再进入真实落库设计。届时需要单独选择数据库和 ORM，并把本阶段的领域模型映射到 schema、迁移、seed、API route 和审计写入流程。
