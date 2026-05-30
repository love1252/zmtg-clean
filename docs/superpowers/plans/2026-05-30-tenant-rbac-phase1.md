# 租户隔离与 RBAC 权限底座第一阶段实施计划

> 给执行代理的要求：实施本计划时使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`，按任务逐项执行。步骤使用复选框语法，方便跟踪进度。

**目标：** 建立第一阶段租户隔离与 RBAC 权限底座，为后续客户资料、预约、随访、开放平台能力和审计日志提供统一服务端权限边界。

**架构：** 本阶段只新增权限领域模型、服务端演示上下文转换、测试和安全文档，不接真实数据库，不新增真实业务 API，不替换生产认证。权限判定采用“服务端上下文唯一可信、权限矩阵显式允许、未知组合默认拒绝”的方式。

**技术栈：** Next.js App Router、React、TypeScript、Vitest、Testing Library、ESLint。

---

## 文件结构

新增文件：

- `src/modules/security/domain/access-control.ts`
  - 定义访问作用域、角色、资源、动作、权限矩阵和 `canAccessResource`。
- `src/modules/security/tests/AccessControlDomain.test.ts`
  - 验证允许路径、拒绝路径、默认拒绝和敏感明细默认拒绝。
- `src/modules/security/server/access-context.ts`
  - 从现有演示会话转换服务端访问上下文。
- `src/modules/security/tests/AccessContext.test.ts`
  - 验证演示会话上下文转换、缺失会话、过期会话和角色映射。
- `docs/security/tenant-rbac-phase1.md`
  - 记录租户隔离、RBAC、API route 使用约束和后续真实实现准入条件。

修改文件：

- `src/modules/auth/domain/session.ts`
  - 扩展认证角色边界，加入平台运营、安全审计员、机构运营、咨询师、客服。
- `src/modules/auth/tests/AuthSessionDomain.test.ts`
  - 更新角色列表和 `isAuthRole` 测试。
- `src/modules/auth/server/demo-session.ts`
  - 继续保留演示用户，只补充类型兼容和上下文转换所需字段。
- `src/app/api/auth/session/route.ts`
  - 不改现有响应结构，只作为访问上下文解析的服务端来源。
- `src/modules/open-platform/domain/governance.ts`
  - 与新的权限资源、动作保持命名一致。

## 任务 1：扩展认证角色边界

**文件：**

- 修改：`src/modules/auth/domain/session.ts`
- 修改：`src/modules/auth/tests/AuthSessionDomain.test.ts`

- [ ] **步骤 1：先写失败测试**

修改 `src/modules/auth/tests/AuthSessionDomain.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { AUTH_ROLES, isAuthRole } from '@/modules/auth/domain/session';

describe('认证会话领域', () => {
  it('暴露支持的角色边界', () => {
    expect(AUTH_ROLES).toEqual([
      'tenant_admin',
      'tenant_operator',
      'consultant',
      'customer_service',
      'platform_admin',
      'platform_operator',
      'security_auditor',
    ]);
  });

  it('识别已知认证角色', () => {
    expect(isAuthRole('tenant_admin')).toBe(true);
    expect(isAuthRole('tenant_operator')).toBe(true);
    expect(isAuthRole('consultant')).toBe(true);
    expect(isAuthRole('customer_service')).toBe(true);
    expect(isAuthRole('platform_admin')).toBe(true);
    expect(isAuthRole('platform_operator')).toBe(true);
    expect(isAuthRole('security_auditor')).toBe(true);
    expect(isAuthRole('visitor')).toBe(false);
    expect(isAuthRole(null)).toBe(false);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```bash
node scripts/run-vitest.mjs run src/modules/auth/tests/AuthSessionDomain.test.ts
```

预期结果：失败，原因是 `AUTH_ROLES` 还只包含 `tenant_admin` 和 `platform_admin`。

- [ ] **步骤 3：扩展角色列表**

修改 `src/modules/auth/domain/session.ts`：

```ts
export const AUTH_ROLES = [
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
  'platform_admin',
  'platform_operator',
  'security_auditor',
] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];

export type AuthSessionUser = {
  id: string;
  username: string;
  name: string;
  role: AuthRole;
  tenantId: string | null;
};

export type AuthSession = {
  user: AuthSessionUser;
  expiresAt: number;
};

export type AuthSessionPayload = {
  authenticated: boolean;
  user: AuthSessionUser | null;
};

export function isAuthRole(value: unknown): value is AuthRole {
  return typeof value === 'string' && AUTH_ROLES.includes(value as AuthRole);
}
```

- [ ] **步骤 4：运行认证领域测试**

```bash
node scripts/run-vitest.mjs run src/modules/auth/tests/AuthSessionDomain.test.ts src/modules/auth/tests/DemoAuthRoutes.test.ts
```

预期结果：2 个测试文件通过。

- [ ] **步骤 5：提交**

```bash
git add src/modules/auth/domain/session.ts src/modules/auth/tests/AuthSessionDomain.test.ts
git commit -m "扩展认证角色边界"
```

## 任务 2：新增访问控制领域模型

**文件：**

- 新增：`src/modules/security/domain/access-control.ts`
- 新增测试：`src/modules/security/tests/AccessControlDomain.test.ts`

- [ ] **步骤 1：先写失败测试**

创建 `src/modules/security/tests/AccessControlDomain.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  ACCESS_ACTIONS,
  ACCESS_RESOURCES,
  ACCESS_ROLES,
  canAccessResource,
} from '@/modules/security/domain/access-control';

const tenantAdminContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
} as const;

const platformAdminContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
} as const;

const platformOperatorContext = {
  userId: 'demo-user-platform-operator',
  role: 'platform_operator',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
} as const;

const securityAuditorContext = {
  userId: 'demo-user-auditor',
  role: 'security_auditor',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
} as const;

describe('访问控制领域', () => {
  it('定义稳定角色、资源和动作', () => {
    expect(ACCESS_ROLES).toEqual([
      'tenant_admin',
      'tenant_operator',
      'consultant',
      'customer_service',
      'platform_admin',
      'platform_operator',
      'security_auditor',
    ]);
    expect(ACCESS_RESOURCES).toEqual([
      'tenant',
      'tenant_member',
      'customer',
      'appointment',
      'follow_up',
      'open_connection',
      'permission_policy',
      'audit_log',
      'platform_health',
    ]);
    expect(ACCESS_ACTIONS).toContain('read_own_tenant');
    expect(ACCESS_ACTIONS).toContain('read_aggregate');
    expect(ACCESS_ACTIONS).toContain('export_report');
  });

  it('允许机构管理员读取本租户资源', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'customer',
        action: 'read_own_tenant',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it('拒绝机构管理员读取其他租户', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'customer',
        action: 'read_own_tenant',
        targetTenantId: 'other-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'cross_tenant_denied' });
  });

  it('拒绝缺少租户编号的租户作用域访问', () => {
    expect(
      canAccessResource({
        context: { ...tenantAdminContext, tenantId: null },
        resource: 'customer',
        action: 'read_own_tenant',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'missing_tenant' });
  });

  it('允许平台运营读取平台健康聚合态势', () => {
    expect(
      canAccessResource({
        context: platformOperatorContext,
        resource: 'platform_health',
        action: 'read_aggregate',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it('拒绝平台运营读取客户敏感明细', () => {
    expect(
      canAccessResource({
        context: platformOperatorContext,
        resource: 'customer',
        action: 'read_detail',
        targetTenantId: 'demo-tenant-001',
        containsSensitiveDetail: true,
      }),
    ).toEqual({ allowed: false, reason: 'sensitive_detail_denied' });
  });

  it('默认拒绝平台管理员读取客户敏感明细', () => {
    expect(
      canAccessResource({
        context: platformAdminContext,
        resource: 'customer',
        action: 'read_detail',
        targetTenantId: 'demo-tenant-001',
        containsSensitiveDetail: true,
      }),
    ).toEqual({ allowed: false, reason: 'sensitive_detail_denied' });
  });

  it('允许平台管理员管理租户状态', () => {
    expect(
      canAccessResource({
        context: platformAdminContext,
        resource: 'tenant',
        action: 'manage_status',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it('允许安全审计员导出审计报告', () => {
    expect(
      canAccessResource({
        context: securityAuditorContext,
        resource: 'audit_log',
        action: 'export_report',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it('默认拒绝未知策略组合', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'permission_policy',
        action: 'manage_policy',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```bash
node scripts/run-vitest.mjs run src/modules/security/tests/AccessControlDomain.test.ts
```

预期结果：失败，原因是 `@/modules/security/domain/access-control` 尚不存在。

- [ ] **步骤 3：实现访问控制领域模型**

创建 `src/modules/security/domain/access-control.ts`：

```ts
export const ACCESS_ROLES = [
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
  'platform_admin',
  'platform_operator',
  'security_auditor',
] as const;

export type AccessRole = (typeof ACCESS_ROLES)[number];

export type AccessScope = 'platform' | 'tenant';

export const ACCESS_RESOURCES = [
  'tenant',
  'tenant_member',
  'customer',
  'appointment',
  'follow_up',
  'open_connection',
  'permission_policy',
  'audit_log',
  'platform_health',
] as const;

export type ProtectedResource = (typeof ACCESS_RESOURCES)[number];

export const ACCESS_ACTIONS = [
  'read_aggregate',
  'read_own_tenant',
  'read_detail',
  'create',
  'update',
  'delete',
  'manage_status',
  'manage_policy',
  'review',
  'export_report',
] as const;

export type ProtectedAction = (typeof ACCESS_ACTIONS)[number];

export type AccessContext = {
  userId: string;
  role: AccessRole;
  scope: AccessScope;
  tenantId: string | null;
  source: 'demo_session' | 'server_session' | 'trusted_gateway';
};

export type AccessDecision =
  | { allowed: true; reason: 'allowed_by_policy' }
  | {
      allowed: false;
      reason: 'missing_tenant' | 'cross_tenant_denied' | 'role_denied' | 'sensitive_detail_denied';
    };

export type AccessPolicy = {
  role: AccessRole;
  resource: ProtectedResource;
  actions: ProtectedAction[];
};

export const accessPolicies: AccessPolicy[] = [
  {
    role: 'platform_admin',
    resource: 'tenant',
    actions: ['read_aggregate', 'read_detail', 'manage_status'],
  },
  {
    role: 'platform_admin',
    resource: 'permission_policy',
    actions: ['read_detail', 'manage_policy', 'review'],
  },
  {
    role: 'platform_operator',
    resource: 'platform_health',
    actions: ['read_aggregate', 'read_detail'],
  },
  {
    role: 'platform_operator',
    resource: 'tenant',
    actions: ['read_aggregate'],
  },
  {
    role: 'security_auditor',
    resource: 'audit_log',
    actions: ['read_detail', 'export_report', 'review'],
  },
  {
    role: 'tenant_admin',
    resource: 'open_connection',
    actions: ['read_own_tenant'],
  },
  {
    role: 'tenant_admin',
    resource: 'customer',
    actions: ['read_own_tenant'],
  },
  {
    role: 'tenant_admin',
    resource: 'appointment',
    actions: ['read_own_tenant'],
  },
  {
    role: 'tenant_admin',
    resource: 'follow_up',
    actions: ['read_own_tenant'],
  },
];

const sensitiveResources: ProtectedResource[] = ['customer', 'appointment', 'follow_up'];

function hasPolicy(role: AccessRole, resource: ProtectedResource, action: ProtectedAction) {
  return accessPolicies.some(
    (policy) =>
      policy.role === role &&
      policy.resource === resource &&
      policy.actions.includes(action),
  );
}

export function canAccessResource(input: {
  context: AccessContext;
  resource: ProtectedResource;
  action: ProtectedAction;
  targetTenantId?: string | null;
  containsSensitiveDetail?: boolean;
}): AccessDecision {
  const { context, resource, action, targetTenantId, containsSensitiveDetail = false } = input;

  if (context.scope === 'tenant' && !context.tenantId) {
    return { allowed: false, reason: 'missing_tenant' };
  }

  if (
    context.scope === 'tenant' &&
    targetTenantId &&
    context.tenantId &&
    targetTenantId !== context.tenantId
  ) {
    return { allowed: false, reason: 'cross_tenant_denied' };
  }

  if (
    containsSensitiveDetail &&
    sensitiveResources.includes(resource) &&
    context.scope === 'platform'
  ) {
    return { allowed: false, reason: 'sensitive_detail_denied' };
  }

  if (!hasPolicy(context.role, resource, action)) {
    return { allowed: false, reason: 'role_denied' };
  }

  return { allowed: true, reason: 'allowed_by_policy' };
}
```

- [ ] **步骤 4：运行访问控制领域测试**

```bash
node scripts/run-vitest.mjs run src/modules/security/tests/AccessControlDomain.test.ts
```

预期结果：1 个测试文件通过。

- [ ] **步骤 5：提交**

```bash
git add src/modules/security/domain/access-control.ts src/modules/security/tests/AccessControlDomain.test.ts
git commit -m "新增访问控制领域模型"
```

## 任务 3：从演示会话转换访问上下文

**文件：**

- 新增：`src/modules/security/server/access-context.ts`
- 新增测试：`src/modules/security/tests/AccessContext.test.ts`

- [ ] **步骤 1：先写失败测试**

创建 `src/modules/security/tests/AccessContext.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { DEMO_SESSION_COOKIE, encodeDemoSession } from '@/modules/auth/server/demo-session';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

function requestWithSession(sessionValue: string) {
  return new Request('http://localhost/api/example', {
    headers: {
      cookie: `${DEMO_SESSION_COOKIE}=${sessionValue}`,
    },
  });
}

describe('访问上下文', () => {
  it('把机构管理员演示会话转换为租户访问上下文', () => {
    const session = encodeDemoSession({
      user: {
        id: 'demo-user-admin',
        username: 'admin',
        name: '系统管理员',
        role: 'tenant_admin',
        tenantId: 'demo-tenant-001',
      },
      expiresAt: Date.now() + 60_000,
    });

    expect(getDemoAccessContextFromRequest(requestWithSession(session))).toEqual({
      userId: 'demo-user-admin',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'demo-tenant-001',
      source: 'demo_session',
    });
  });

  it('把平台管理员演示会话转换为平台访问上下文', () => {
    const session = encodeDemoSession({
      user: {
        id: 'demo-user-platform',
        username: 'platform',
        name: '超级管理员',
        role: 'platform_admin',
        tenantId: null,
      },
      expiresAt: Date.now() + 60_000,
    });

    expect(getDemoAccessContextFromRequest(requestWithSession(session))).toEqual({
      userId: 'demo-user-platform',
      role: 'platform_admin',
      scope: 'platform',
      tenantId: null,
      source: 'demo_session',
    });
  });

  it('请求没有有效会话时返回空值', () => {
    expect(getDemoAccessContextFromRequest(new Request('http://localhost/api/example'))).toBeNull();
  });

  it('租户角色没有租户编号时返回空值', () => {
    const session = encodeDemoSession({
      user: {
        id: 'bad-tenant-user',
        username: 'bad',
        name: '错误租户用户',
        role: 'tenant_admin',
        tenantId: null,
      },
      expiresAt: Date.now() + 60_000,
    });

    expect(getDemoAccessContextFromRequest(requestWithSession(session))).toBeNull();
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

```bash
node scripts/run-vitest.mjs run src/modules/security/tests/AccessContext.test.ts
```

预期结果：失败，原因是 `@/modules/security/server/access-context` 尚不存在。

- [ ] **步骤 3：实现演示会话上下文转换**

创建 `src/modules/security/server/access-context.ts`：

```ts
import type { AuthRole } from '@/modules/auth/domain/session';
import {
  decodeDemoSession,
  DEMO_SESSION_COOKIE,
  readCookieValue,
} from '@/modules/auth/server/demo-session';
import type { AccessContext, AccessRole, AccessScope } from '@/modules/security/domain/access-control';

const platformRoles: AuthRole[] = ['platform_admin', 'platform_operator', 'security_auditor'];
const tenantRoles: AuthRole[] = ['tenant_admin', 'tenant_operator', 'consultant', 'customer_service'];

function roleToScope(role: AuthRole): AccessScope {
  return platformRoles.includes(role) ? 'platform' : 'tenant';
}

function isAccessRole(role: AuthRole): role is AccessRole {
  return [...platformRoles, ...tenantRoles].includes(role);
}

export function getDemoAccessContextFromRequest(request: Request, now = Date.now()): AccessContext | null {
  const cookie = readCookieValue(request.headers.get('cookie'), DEMO_SESSION_COOKIE);
  const session = decodeDemoSession(cookie, now);
  if (!session) return null;
  if (!isAccessRole(session.user.role)) return null;

  const scope = roleToScope(session.user.role);
  if (scope === 'tenant' && !session.user.tenantId) return null;

  return {
    userId: session.user.id,
    role: session.user.role,
    scope,
    tenantId: session.user.tenantId,
    source: 'demo_session',
  };
}
```

- [ ] **步骤 4：运行上下文测试**

```bash
node scripts/run-vitest.mjs run src/modules/security/tests/AccessContext.test.ts src/modules/security/tests/AccessControlDomain.test.ts
```

预期结果：2 个测试文件通过。

- [ ] **步骤 5：提交**

```bash
git add src/modules/security/server/access-context.ts src/modules/security/tests/AccessContext.test.ts
git commit -m "新增演示会话访问上下文"
```

## 任务 4：对齐开放平台治理领域命名

**文件：**

- 修改：`src/modules/open-platform/domain/governance.ts`
- 修改测试：`src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts`

- [ ] **步骤 1：先写对齐测试**

修改 `src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts`，增加导入：

```ts
import {
  ACCESS_ACTIONS,
  ACCESS_RESOURCES,
  ACCESS_ROLES,
} from '@/modules/security/domain/access-control';
```

在 `describe('开放平台治理领域模型', () => { ... })` 内增加测试：

```ts
it('与访问控制领域的角色、资源、动作保持一致', () => {
  platformRoleCatalog.forEach((role) => {
    expect(ACCESS_ROLES).toContain(role.id);
  });

  openPlatformPermissions.forEach((permission) => {
    expect(ACCESS_ROLES).toContain(permission.roleId);
    expect(ACCESS_RESOURCES).toContain(permission.resource);
    permission.actions.forEach((action) => {
      expect(ACCESS_ACTIONS).toContain(action);
    });
  });
});
```

- [ ] **步骤 2：运行测试确认状态**

```bash
node scripts/run-vitest.mjs run src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts src/modules/security/tests/AccessControlDomain.test.ts
```

预期结果：如果命名已一致则通过；如果失败，失败项会指出需要对齐的角色、资源或动作。

- [ ] **步骤 3：按测试结果对齐命名**

如测试失败，只允许修改静态治理领域中的角色、资源或动作名称，不放宽访问控制策略。

对齐后再次运行：

```bash
node scripts/run-vitest.mjs run src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts src/modules/security/tests/AccessControlDomain.test.ts
```

预期结果：2 个测试文件通过。

- [ ] **步骤 4：提交**

```bash
git add src/modules/open-platform/domain/governance.ts src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts
git commit -m "对齐开放平台治理权限命名"
```

## 任务 5：新增安全文档

**文件：**

- 新增：`docs/security/tenant-rbac-phase1.md`

- [ ] **步骤 1：新增安全文档**

创建 `docs/security/tenant-rbac-phase1.md`：

```md
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
```

- [ ] **步骤 2：检查文档英文漏项和占位**

```bash
rg -n "待定|稍后|占位|补充" docs/security/tenant-rbac-phase1.md || true
```

预期结果：没有输出。

- [ ] **步骤 3：提交**

```bash
git add docs/security/tenant-rbac-phase1.md
git commit -m "补充租户权限安全文档"
```

## 任务 6：全量验证与 PR 准备

**文件：**

- 检查：所有本阶段新增和修改文件。

- [ ] **步骤 1：运行 lint**

```bash
./node_modules/.bin/eslint .
```

预期结果：0 个错误。当前项目可能仍有既有 `<img>` warning，不在本阶段处理。

- [ ] **步骤 2：运行全量测试**

```bash
node scripts/run-vitest.mjs run
```

预期结果：所有测试文件通过。

- [ ] **步骤 3：运行构建和类型检查**

```bash
node scripts/run-next.mjs build --webpack
./node_modules/.bin/tsc --noEmit
```

预期结果：构建通过，类型检查通过。

- [ ] **步骤 4：检查工作区和 diff**

```bash
git status -sb
git diff --stat main...HEAD
git diff --check
```

预期结果：工作区干净，diff 只包含租户隔离与 RBAC 第一阶段文件，没有数据库迁移、真实业务 API 或生产配置修改。

- [ ] **步骤 5：准备 PR 描述**

PR 标题：

```text
租户隔离与 RBAC 权限底座第一阶段
```

PR 描述：

```md
## 变更摘要

- 新增服务端访问上下文和访问控制领域模型。
- 新增租户隔离、RBAC 权限矩阵和默认拒绝测试。
- 新增演示会话到访问上下文的转换。
- 补充租户权限安全文档。

## 验证结果

- `./node_modules/.bin/eslint .`
- `node scripts/run-vitest.mjs run`
- `node scripts/run-next.mjs build --webpack`
- `./node_modules/.bin/tsc --noEmit`

## 风险说明

- 本阶段不接真实数据库，不新增真实客户、预约、随访 API。
- 本阶段不实现真实 API Key、OAuth、Webhook 或审计落库。
- 浏览器缓存中的租户编号仍只能作为前端体验缓存，不能作为授权依据。
```

## 自审清单

- [ ] 角色、资源、动作命名在访问控制领域和开放平台治理领域中一致。
- [ ] 机构角色不能跨租户读取。
- [ ] 平台运营不能读取客户敏感明细。
- [ ] 平台超级管理员默认不能读取客户敏感明细。
- [ ] 未知组合默认拒绝。
- [ ] 没有新增数据库迁移。
- [ ] 没有新增真实业务 API。
- [ ] 没有修改 `.env` 或生产配置。
