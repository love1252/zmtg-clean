# 租户隔离与 RBAC 权限底座第一阶段设计

## 目标

为智美天工建立第一阶段租户隔离与 RBAC 权限底座，让后续客户资料、预约、随访、开放平台 API Key、OAuth、Webhook 和审计日志都有统一的服务端权限边界。

本阶段只建立领域模型、服务端守卫接口、测试基线和安全文档，不接真实数据库，不做生产认证，不新增真实业务数据接口。

## 背景

当前系统已经具备：

- 演示登录与演示会话。
- 机构端 `/hospital` 工作台。
- 平台端 `/open-platform` 控制台。
- 开放平台治理第一阶段的只读基线。
- 机构端客户中心、预约中心、智能随访演示业务壳。

当前系统尚未具备：

- 真实租户表。
- 真实用户、员工、角色、权限表。
- 服务端 RBAC 中间件。
- API 层租户隔离守卫。
- 审计日志落库。

登录页目前会把机构演示租户写入浏览器缓存：

```ts
window.localStorage.setItem('zmtg_tenant_id', String(tenantId));
```

这只能作为前端体验缓存，不能作为授权依据。后续真实权限判断必须来自服务端会话、服务端签发上下文或可信网关。

## 第一阶段范围

第一阶段要做的是“权限规则和守卫边界”，不是“真实业务数据接入”。

本阶段包含：

- 定义服务端租户上下文。
- 定义角色、资源、动作和权限矩阵。
- 定义机构端与平台端的默认访问边界。
- 定义服务端守卫函数接口。
- 定义审计事件最小字段。
- 增加测试，锁住不可越权规则。
- 增加安全文档，作为后续真实实现的准入条件。

本阶段不包含：

- 数据库 schema 和迁移。
- 真实用户、员工、组织架构管理。
- 真实客户、预约、随访接口。
- API Key 生成、存储、轮换、吊销。
- OAuth 授权、回调、令牌交换。
- Webhook 签名、投递、重试。
- 生产级认证替换。

## 设计原则

### 1. 服务端上下文唯一可信

所有权限判断必须从服务端上下文读取：

- 当前用户编号。
- 当前角色。
- 当前租户编号。
- 当前访问作用域。
- 当前会话来源。

禁止把以下内容作为权限依据：

- 浏览器缓存。
- URL 查询参数。
- 请求体里的 `tenantId`。
- 前端传来的角色。
- 前端路由状态。

### 2. 平台聚合默认安全

平台端默认只能看聚合态势和治理状态。

即使是平台超级管理员，第一阶段也不能默认读取机构客户 PII、治疗记录、咨询记录、订单明细或随访明细。

### 3. 机构只读本租户

机构管理员只能访问本租户资源。

任何“指定租户访问”都必须由服务端上下文和权限策略共同决定，不能由前端传入的租户编号决定。

### 4. 敏感数据默认不可见

客户手机号、身份证号、病历号、治疗记录、咨询对话、凭证明文、Webhook 目标地址等均属于敏感信息。

第一阶段不展示真实敏感信息，只设计后续读写前必须满足的守卫和审计边界。

### 5. 守卫先于业务

后续新增任何真实 API route 前，应先通过统一守卫函数获取访问判定。

业务代码不应自己散落判断角色和租户，避免不同模块权限逻辑不一致。

## 角色模型

第一阶段角色保持精简，覆盖当前页面和后续真实模块的最小边界。

| 角色 | 作用域 | 说明 |
| --- | --- | --- |
| 平台超级管理员 | 平台 | 管理租户状态、平台策略、高风险审批。第一阶段不能默认读取客户 PII。 |
| 平台运营 | 平台 | 查看平台聚合状态和健康状态，不修改安全策略。 |
| 安全审计员 | 平台 | 查看审计事件和安全巡检结果，不执行业务配置变更。 |
| 机构管理员 | 租户 | 管理本机构工作台和本租户开放连接可见状态。 |
| 机构运营 | 租户 | 查看本租户客户、预约、随访运营态势，后续可执行低风险动作。 |
| 咨询师 | 租户 | 处理被分配客户和预约，不读取跨团队数据。 |
| 客服 | 租户 | 处理随访和服务回访，不管理权限和开放连接。 |

第一阶段可以只实现前四类角色的领域定义和测试，后续客户、预约、随访进入真实实现时再启用机构运营、咨询师、客服。

## 资源模型

第一阶段定义资源名，不实现真实读写。

| 资源 | 说明 | 默认边界 |
| --- | --- | --- |
| `tenant` | 租户状态和租户治理 | 平台可看聚合，机构只能看自身 |
| `tenant_member` | 用户、员工、角色关系 | 第一阶段只定义，不实现管理 |
| `customer` | 客户资料 | 机构本租户可见，平台默认不可见明细 |
| `appointment` | 预约记录 | 机构本租户可见，平台默认只看聚合 |
| `follow_up` | 随访任务 | 机构本租户可见，平台默认只看聚合 |
| `open_connection` | API Key、OAuth、Webhook 连接态势 | 机构看本租户，平台看治理态势 |
| `permission_policy` | 权限策略 | 平台超级管理员和安全审计员可审查 |
| `audit_log` | 审计事件 | 安全审计员可读，机构只能看本租户摘要 |
| `platform_health` | 平台健康 | 平台角色可读聚合 |

## 动作模型

第一阶段动作保持可组合，不追求覆盖所有业务细节。

| 动作 | 说明 |
| --- | --- |
| `read_aggregate` | 读取聚合态势 |
| `read_own_tenant` | 读取本租户资源 |
| `read_detail` | 读取明细 |
| `create` | 创建资源 |
| `update` | 更新资源 |
| `delete` | 删除资源 |
| `manage_status` | 管理状态 |
| `manage_policy` | 管理权限策略 |
| `review` | 审查高风险事项 |
| `export_report` | 导出报告 |

## 权限矩阵

第一阶段权限矩阵应当以“默认拒绝”为原则。

| 角色 | 资源 | 动作 | 边界 |
| --- | --- | --- | --- |
| 平台超级管理员 | `tenant` | `read_aggregate`, `read_detail`, `manage_status` | 可管理租户运营状态，但不能默认读取客户 PII。 |
| 平台超级管理员 | `permission_policy` | `read_detail`, `manage_policy`, `review` | 可管理策略草案和审批高风险策略。 |
| 平台运营 | `platform_health` | `read_aggregate`, `read_detail` | 可看平台健康和聚合趋势，不修改安全策略。 |
| 平台运营 | `tenant` | `read_aggregate` | 只看聚合，不看机构客户明细。 |
| 安全审计员 | `audit_log` | `read_detail`, `export_report`, `review` | 可审计权限和事件，不轮换凭证，不改租户状态。 |
| 机构管理员 | `open_connection` | `read_own_tenant` | 只能查看本租户开放连接态势。 |
| 机构管理员 | `customer`, `appointment`, `follow_up` | `read_own_tenant` | 只能访问本租户数据。 |

任何不在矩阵中的组合默认拒绝。

## 服务端访问上下文

后续实现时建议新增 `src/modules/security/domain/access-control.ts`，定义最小上下文：

```ts
export type AccessScope = 'platform' | 'tenant';

export type AccessRole =
  | 'platform_admin'
  | 'platform_operator'
  | 'security_auditor'
  | 'tenant_admin'
  | 'tenant_operator'
  | 'consultant'
  | 'customer_service';

export type AccessContext = {
  userId: string;
  role: AccessRole;
  scope: AccessScope;
  tenantId: string | null;
  source: 'demo_session' | 'server_session' | 'trusted_gateway';
};
```

第一阶段可以从现有演示会话转换出 `AccessContext`，但必须显式标记 `source: 'demo_session'`，避免误认为是生产认证。

## 守卫函数接口

后续实现时建议提供三个纯函数，先用于领域测试和 API 设计，不直接连接数据库。

```ts
export type AccessDecision =
  | { allowed: true; reason: 'allowed_by_policy' }
  | { allowed: false; reason: 'missing_tenant' | 'cross_tenant_denied' | 'role_denied' | 'sensitive_detail_denied' };

export function canAccessResource(input: {
  context: AccessContext;
  resource: ProtectedResource;
  action: ProtectedAction;
  targetTenantId?: string | null;
  containsSensitiveDetail?: boolean;
}): AccessDecision;
```

判定规则：

- 没有上下文时拒绝。
- 租户作用域但没有 `tenantId` 时拒绝。
- 机构角色访问其他租户时拒绝。
- 平台运营读取敏感明细时拒绝。
- 平台超级管理员读取客户敏感明细时默认拒绝，除非后续新增审批上下文。
- 矩阵中没有的角色、资源、动作组合拒绝。

## API 使用约束

后续新增真实 API route 时，必须遵守：

1. 先从服务端会话解析 `AccessContext`。
2. 再调用 `canAccessResource`。
3. 守卫允许后才进入业务查询。
4. 查询条件必须由服务端上下文推导，不接受前端传入的租户作为最终依据。
5. 高风险动作必须写审计事件。

禁止示例：

```ts
const tenantId = requestBody.tenantId;
const customers = await db.customer.findMany({ where: { tenantId } });
```

推荐示例：

```ts
const context = await requireAccessContext(request);
const decision = canAccessResource({
  context,
  resource: 'customer',
  action: 'read_own_tenant',
  targetTenantId: context.tenantId,
});

if (!decision.allowed) return forbidden(decision.reason);
```

## 审计事件基线

第一阶段只定义字段，不落库。

后续真实实现时，高风险操作至少要记录：

- 事件编号。
- 操作者编号。
- 操作者角色。
- 租户范围。
- 资源类型。
- 资源编号。
- 动作。
- 结果。
- 拒绝原因。
- 发生时间。
- 请求来源。

高风险操作包括：

- 跨租户聚合读取。
- 权限策略变更。
- 开放连接状态变更。
- API Key 轮换或吊销。
- OAuth 应用发布或暂停。
- Webhook 启用或停用。
- 审计报告导出。

## 错误处理

守卫失败应返回稳定原因码，不把内部策略细节暴露给前端。

建议前端可见提示：

- 未登录：`请先登录`
- 角色不匹配：`当前账号无权访问该入口`
- 跨租户拒绝：`无权访问该租户资源`
- 敏感明细拒绝：`该信息需要更高权限或审批`

服务端日志和后续审计事件可以记录更细原因。

## 测试策略

第一阶段必须优先写领域测试。

建议测试文件：

```text
src/modules/security/tests/AccessControlDomain.test.ts
src/modules/security/tests/AccessContext.test.ts
src/modules/auth/tests/AuthSessionDomain.test.ts
```

关键测试：

- 机构管理员读取本租户客户资源允许。
- 机构管理员读取其他租户客户资源拒绝。
- 机构管理员没有租户编号时拒绝。
- 平台运营读取平台健康聚合允许。
- 平台运营读取客户敏感明细拒绝。
- 平台超级管理员管理租户状态允许。
- 平台超级管理员默认读取客户敏感明细拒绝。
- 安全审计员导出审计报告允许。
- 未在矩阵中的角色、资源、动作组合默认拒绝。
- `localStorage`、URL 参数和请求体租户编号不能参与领域判定。

## 文件影响

设计阶段只新增文档。

后续实现阶段预计新增：

```text
src/modules/security/domain/access-control.ts
src/modules/security/tests/AccessControlDomain.test.ts
src/modules/security/server/access-context.ts
src/modules/security/tests/AccessContext.test.ts
docs/security/tenant-rbac-phase1.md
```

预计修改：

```text
src/modules/auth/domain/session.ts
src/modules/auth/server/demo-session.ts
src/modules/auth/components/DemoSessionGate.tsx
src/app/api/auth/session/route.ts
src/modules/open-platform/domain/governance.ts
```

## 验收标准

设计阶段完成后应满足：

- 设计文档明确第一阶段范围和非目标。
- 设计文档明确不能信任前端租户来源。
- 设计文档明确平台角色不能默认读取客户 PII。
- 设计文档给出可测试的角色、资源、动作和守卫接口。
- 设计文档列出后续实现文件和测试策略。

实现阶段完成后应满足：

- 权限领域测试覆盖允许和拒绝路径。
- 守卫函数默认拒绝未知组合。
- 演示会话可以转换为 `AccessContext`，但标记为演示来源。
- 现有登录、机构工作台、平台工作台不回退。
- 不新增数据库迁移和真实业务 API。

## 后续阶段

第一阶段完成后，建议按顺序推进：

1. 客户资料真实模型。
2. 预约真实模型。
3. 随访任务状态机。
4. 审计日志落库。
5. API Key / OAuth / Webhook 真实实现。

每一阶段都必须复用本阶段的服务端访问上下文和守卫函数。
