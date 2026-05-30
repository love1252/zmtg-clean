# 租户隔离与 RBAC 权限底座第一阶段

## 范围

本阶段只建立服务端租户上下文、角色权限矩阵、访问守卫函数和测试基线。

本阶段不实现真实数据库、不新增真实客户接口、不替换生产认证、不接 API Key / OAuth / Webhook 真实能力。

## 可信上下文

权限判断只能使用服务端上下文：

- 用户编号
- 角色
- 租户编号
- 访问作用域
- 会话来源

禁止把浏览器缓存、URL 参数、请求体租户编号或前端传入角色作为授权依据。

## 默认拒绝规则

- 未在权限矩阵中的角色、资源、动作组合默认拒绝。
- 租户角色没有租户编号时拒绝。
- 租户角色访问其他租户时拒绝。
- 平台运营读取客户敏感明细时拒绝。
- 平台超级管理员默认读取客户敏感明细时拒绝。

## API route 约束

后续新增真实 API route 时必须：

1. 从服务端会话解析访问上下文。
2. 调用统一访问守卫。
3. 守卫允许后再进入业务查询。
4. 查询条件由服务端上下文推导。
5. 高风险动作写审计事件。

## 禁止模式

```ts
const tenantId = requestBody.tenantId;
const rows = await db.customer.findMany({ where: { tenantId } });
```

## 推荐模式

```ts
const context = await requireAccessContext(request);
const decision = canAccessResource({
  context,
  resource: 'customer',
  action: 'read_own_tenant',
  targetTenantId: context.tenantId,
});
```

## 后续真实实现准入

进入客户资料、预约、随访、API Key、OAuth、Webhook 或审计落库前，必须复用本阶段访问上下文和守卫函数。

## 第二阶段领域模型约束

第二阶段允许新增客户、预约、随访和审计事件的 TypeScript 领域模型，但仍不接真实数据库、不新增真实业务 API、不保存真实敏感数据。

客户、预约和随访读取函数必须：

1. 接收服务端 `AccessContext`。
2. 调用 `canAccessResource`。
3. 只返回 `context.tenantId` 对应的记录。
4. 跨租户拒绝时不返回任何业务记录。
5. 只暴露脱敏展示字段。

审计事件模型必须记录操作者、角色、租户、资源、动作、结果、原因、时间和来源。审计事件不能包含 API Key、OAuth token、Webhook secret 或其他凭证明文。
