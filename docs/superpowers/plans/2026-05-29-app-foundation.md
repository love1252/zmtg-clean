# App Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立「智美天工 Clean」下一阶段可复用的应用底座，让认证类型、工作台配置、页面壳和静态 mock 边界更清晰。

**Architecture:** 本阶段只做低风险模块边界整理，不引入数据库、不实现真实 RBAC、不改生产认证策略。把已经存在于页面组件里的稳定配置和类型抽到模块内 domain/config 文件，再让页面组件消费这些配置，保持 UI 视觉不变、行为不变。

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library, ESLint.

---

## Scope

本计划覆盖第二阶段「应用底座整理」的第一组任务，适合在 `codex/app-foundation` 分支执行。

本阶段明确不做：

- 数据库 schema 或迁移。
- 真实用户、租户、RBAC、权限策略。
- API Key、OAuth、Webhook、签名或密钥存储。
- Agent 调度、知识库/RAG、计费。
- 删除旧功能或大规模重写页面视觉。

## File Structure

### Create

- `src/modules/auth/domain/session.ts`
  - 定义认证角色、session user、session payload、role guard 相关类型。
- `src/modules/auth/tests/AuthSessionDomain.test.ts`
  - 验证 session domain 的角色列表和 helper 行为。
- `src/modules/workspace/domain/institution-dashboard.ts`
  - 机构端工作台导航、指标、建议、用户分层配置。
- `src/modules/workspace/domain/platform-dashboard.ts`
  - 平台端导航、指标、健康状态、底部能力卡配置。
- `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
  - 验证导航唯一性、active 项唯一、关键业务入口存在。

### Modify

- `src/modules/auth/server/demo-session.ts`
  - 改为复用 `session.ts` 中的公共类型。
- `src/modules/auth/components/DemoSessionGate.tsx`
  - 改为复用公共 role 类型和 session payload 类型。
- `src/modules/workspace/components/InstitutionWorkspace.tsx`
  - 从 `institution-dashboard.ts` 引入静态配置，组件只负责渲染。
- `src/modules/workspace/components/PlatformConsole.tsx`
  - 从 `platform-dashboard.ts` 引入静态配置，组件只负责渲染。
- `docs/devlog/2026-05-29.md`
  - 记录本阶段计划和 PR。

---

### Task 1: Auth Session Domain

**Files:**

- Create: `src/modules/auth/domain/session.ts`
- Create: `src/modules/auth/tests/AuthSessionDomain.test.ts`
- Modify: `src/modules/auth/server/demo-session.ts`
- Modify: `src/modules/auth/components/DemoSessionGate.tsx`

- [ ] **Step 1: Write the failing domain test**

Create `src/modules/auth/tests/AuthSessionDomain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AUTH_ROLES, isAuthRole } from '@/modules/auth/domain/session';

describe('auth session domain', () => {
  it('exposes the supported role boundary', () => {
    expect(AUTH_ROLES).toEqual(['tenant_admin', 'platform_admin']);
  });

  it('checks known auth roles', () => {
    expect(isAuthRole('tenant_admin')).toBe(true);
    expect(isAuthRole('platform_admin')).toBe(true);
    expect(isAuthRole('visitor')).toBe(false);
    expect(isAuthRole(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/auth/tests/AuthSessionDomain.test.ts
```

Expected:

```text
FAIL src/modules/auth/tests/AuthSessionDomain.test.ts
Cannot find module '@/modules/auth/domain/session'
```

- [ ] **Step 3: Add the auth session domain**

Create `src/modules/auth/domain/session.ts`:

```ts
export const AUTH_ROLES = ['tenant_admin', 'platform_admin'] as const;

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

- [ ] **Step 4: Update demo session types**

Modify the top of `src/modules/auth/server/demo-session.ts`:

```ts
import type { AuthRole, AuthSession, AuthSessionUser } from '@/modules/auth/domain/session';

export const DEMO_SESSION_COOKIE = 'zmtg_demo_session';

export type DemoUserRole = AuthRole;
export type DemoSessionUser = AuthSessionUser;
export type DemoSession = AuthSession;
```

Keep the existing demo user logic unchanged.

- [ ] **Step 5: Update session gate types**

Modify `src/modules/auth/components/DemoSessionGate.tsx`:

```ts
import type { AuthRole, AuthSessionPayload } from '@/modules/auth/domain/session';

type DemoSessionGateProps = {
  allowedRole: AuthRole;
  loginHref: string;
  wrongRoleHref: string;
  children: ReactNode;
};

type SessionPayload = Partial<AuthSessionPayload>;
```

Remove the local `DemoSessionRole` and duplicate inline user role type.

- [ ] **Step 6: Verify auth tests**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/auth/tests/AuthSessionDomain.test.ts src/modules/auth/tests/DemoAuthRoutes.test.ts src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

Expected:

```text
Test Files  3 passed
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/auth/domain/session.ts src/modules/auth/tests/AuthSessionDomain.test.ts src/modules/auth/server/demo-session.ts src/modules/auth/components/DemoSessionGate.tsx
git commit -m "refactor: 收拢认证 session 类型"
```

---

### Task 2: Institution Dashboard Domain Config

**Files:**

- Create: `src/modules/workspace/domain/institution-dashboard.ts`
- Modify: `src/modules/workspace/components/InstitutionWorkspace.tsx`
- Test: `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`

- [ ] **Step 1: Write the institution config test**

Create `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  institutionNavItems,
  institutionSegmentItems,
  institutionStats,
  institutionSuggestions,
} from '@/modules/workspace/domain/institution-dashboard';

describe('workspace dashboard domain', () => {
  it('keeps institution navigation unique with one active entry', () => {
    const labels = institutionNavItems.map((item) => item.label);

    expect(new Set(labels).size).toBe(labels.length);
    expect(institutionNavItems.filter((item) => item.active)).toHaveLength(1);
    expect(labels).toEqual(
      expect.arrayContaining(['工作台', '客户中心', '智能随访', '客服工作台', '预约中心', '知识库']),
    );
  });

  it('keeps institution dashboard cards meaningful', () => {
    expect(institutionStats).toHaveLength(4);
    expect(institutionSuggestions).toHaveLength(4);
    expect(institutionSegmentItems).toHaveLength(4);
    expect(institutionStats.map((item) => item.label)).toEqual(
      expect.arrayContaining(['累计客户数', '活跃旅程数', '预约转化率', '待处理随访']),
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
```

Expected:

```text
FAIL src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
Cannot find module '@/modules/workspace/domain/institution-dashboard'
```

- [ ] **Step 3: Create institution dashboard config**

Create `src/modules/workspace/domain/institution-dashboard.ts`:

```ts
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  CalendarCheck,
  Clock3,
  Database,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Trophy,
  Users,
  Workflow,
} from 'lucide-react';

export type InstitutionNavItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
};

export type InstitutionStatItem = {
  label: string;
  value: string;
  change: string;
  tone: 'blue' | 'violet' | 'emerald' | 'amber';
  icon: LucideIcon;
};

export const institutionNavItems: InstitutionNavItem[] = [
  { label: '工作台', icon: LayoutDashboard, active: true },
  { label: '智能体中心', icon: Bot },
  { label: '客户接入中心', icon: Database },
  { label: '客户中心', icon: Users },
  { label: '智能随访', icon: Workflow },
  { label: '客服工作台', icon: MessageCircle },
  { label: '预约中心', icon: CalendarCheck },
  { label: '知识库', icon: BookOpen },
  { label: '数据分析', icon: BarChart3 },
  { label: '员工绩效', icon: Trophy },
  { label: '系统设置', icon: Settings },
];

export const institutionStats: InstitutionStatItem[] = [
  { label: '累计客户数', value: '13', change: '↗ 100%', tone: 'blue', icon: Users },
  { label: '活跃旅程数', value: '6', change: '↘ 25%', tone: 'violet', icon: BriefcaseBusiness },
  { label: '预约转化率', value: '25%', change: '↗ 8%', tone: 'emerald', icon: CalendarCheck },
  { label: '待处理随访', value: '10', change: '↘ 5%', tone: 'amber', icon: Clock3 },
];

export const institutionSuggestions = [
  { type: '复购', title: '今日复购提醒', description: '打开率提升18%，建议跟进12位高意向用户' },
  { type: '转化', title: '沉默用户激活', description: '检测到32位30天未互动用户，建议发送激活旅程' },
  { type: '服务', title: '术后随访优化', description: '水光项目D7随访响应率偏低，建议调整话术' },
  { type: '营销', title: '活动预热提醒', description: '端午节活动将于3天后开始，建议提前启动预热流程' },
] as const;

export const institutionSegmentItems = [
  { label: '高价值活跃', value: '1250', color: '#10b981' },
  { label: '高价值沉默', value: '680', color: '#f59e0b' },
  { label: '低价值活跃', value: '3200', color: '#3b82f6' },
  { label: '低价值沉默', value: '890', color: '#64748b' },
] as const;
```

- [ ] **Step 4: Update institution workspace imports and usages**

Modify `src/modules/workspace/components/InstitutionWorkspace.tsx`:

```ts
import {
  institutionNavItems,
  institutionSegmentItems,
  institutionStats,
  institutionSuggestions,
} from '@/modules/workspace/domain/institution-dashboard';
```

Remove local `NavItem`, `StatItem`, `navItems`, `stats`, `suggestions`, and `segmentItems`.

Rename usages:

```tsx
{institutionNavItems.map((item) => (...))}
{institutionStats.map((stat) => (...))}
{institutionSuggestions.map((suggestion) => (...))}
{institutionSegmentItems.map((item) => (...))}
```

- [ ] **Step 5: Verify institution config test**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

Expected:

```text
Test Files  2 passed
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/workspace/domain/institution-dashboard.ts src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts src/modules/workspace/components/InstitutionWorkspace.tsx
git commit -m "refactor: 抽离机构工作台配置"
```

---

### Task 3: Platform Dashboard Domain Config

**Files:**

- Create: `src/modules/workspace/domain/platform-dashboard.ts`
- Modify: `src/modules/workspace/components/PlatformConsole.tsx`
- Modify: `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`

- [ ] **Step 1: Extend the workspace domain test**

Append to `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`:

```ts
import {
  platformCapabilityCards,
  platformHealthItems,
  platformMetrics,
  platformNavItems,
} from '@/modules/workspace/domain/platform-dashboard';

it('keeps platform navigation unique with one active entry', () => {
  const labels = platformNavItems.map((item) => item.label);

  expect(new Set(labels).size).toBe(labels.length);
  expect(platformNavItems.filter((item) => item.active)).toHaveLength(1);
  expect(labels).toEqual(
    expect.arrayContaining(['平台总览', '租户管理', '产品与套餐', '开放连接中心', '权限与组织']),
  );
});

it('keeps platform operational cards meaningful', () => {
  expect(platformMetrics).toHaveLength(6);
  expect(platformHealthItems).toHaveLength(4);
  expect(platformCapabilityCards.map((item) => item.title)).toEqual(['开放接口', '连接器治理', '权限审计']);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
```

Expected:

```text
FAIL src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
Cannot find module '@/modules/workspace/domain/platform-dashboard'
```

- [ ] **Step 3: Create platform dashboard config**

Create `src/modules/workspace/domain/platform-dashboard.ts` by moving the existing platform arrays out of `PlatformConsole.tsx`:

```ts
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Boxes,
  Building2,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Plug,
  RefreshCw,
  Settings,
  Shield,
  Users,
  WalletCards,
} from 'lucide-react';

export type PlatformNavItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
};

export type PlatformMetric = {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  tone: string;
};

export const platformNavItems: PlatformNavItem[] = [
  { label: '平台总览', icon: LayoutDashboard, active: true },
  { label: '首页编辑', icon: FileText },
  { label: '租户管理', icon: Building2 },
  { label: '产品与套餐', icon: Boxes },
  { label: 'AI模型', icon: Database },
  { label: 'AI用量与费用', icon: WalletCards },
  { label: '知识库管理', icon: BookOpen },
  { label: '开放连接中心', icon: Plug },
  { label: '智能体运行监控', icon: Activity },
  { label: '平台数据分析', icon: BarChart3 },
  { label: '计费与订单', icon: CreditCard },
  { label: '权限与组织', icon: Shield },
  { label: '系统设置', icon: Settings },
];

export const platformMetrics: PlatformMetric[] = [
  { label: '累计入驻医院', value: '156', change: '↗ 8.2%', icon: Building2, tone: 'bg-blue-50 text-blue-600' },
  { label: '活跃机构', value: '142', change: '↗ 5.8%', icon: Users, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Agent调用总量', value: '2.6M', change: '↗ 18.5%', icon: Boxes, tone: 'bg-violet-50 text-violet-600' },
  { label: '服务用户数', value: '125.0K', change: '↗ 12.3%', icon: Globe2, tone: 'bg-cyan-50 text-cyan-600' },
  { label: 'MRR', value: '¥258,000', change: '↗ 6.8%', icon: DollarSign, tone: 'bg-amber-50 text-amber-600' },
  { label: '续费率', value: '94.2%', change: '↗ 1.2%', icon: RefreshCw, tone: 'bg-emerald-50 text-emerald-600' },
];

export const platformHealthItems = [
  { label: 'API Gateway', detail: '延迟 45ms', value: '99.98%', status: '运行正常', warning: false },
  { label: '数据库', detail: '延迟 12ms', value: '99.99%', status: '运行正常', warning: false },
  { label: 'Agent服务', detail: '延迟 230ms', value: '99.95%', status: '运行正常', warning: false },
  { label: '存储服务', detail: '1.2TB / 1.5TB', value: '78%', status: '容量警告', warning: true },
] as const;

export const platformCapabilityCards = [
  { icon: KeyRound, title: '开放接口', detail: 'API Key、OAuth、Webhook 后续接入' },
  { icon: Plug, title: '连接器治理', detail: '企微、HIS、CRM、投放平台统一管理' },
  { icon: Shield, title: '权限审计', detail: '平台操作留痕与租户边界核查' },
] as const;
```

- [ ] **Step 4: Update platform console imports and usages**

Modify `src/modules/workspace/components/PlatformConsole.tsx`:

```ts
import {
  platformCapabilityCards,
  platformHealthItems,
  platformMetrics,
  platformNavItems,
} from '@/modules/workspace/domain/platform-dashboard';
```

Remove local `PlatformNavItem`, `PlatformMetric`, `platformNav`, `metrics`, and `healthItems`.

Rename usages:

```tsx
{platformNavItems.map((item) => (...))}
{platformMetrics.map((metric) => (...))}
{platformHealthItems.map((item) => (...))}
{platformCapabilityCards.map((item) => (...))}
```

- [ ] **Step 5: Verify platform config test**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

Expected:

```text
Test Files  2 passed
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/workspace/domain/platform-dashboard.ts src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts src/modules/workspace/components/PlatformConsole.tsx
git commit -m "refactor: 抽离平台工作台配置"
```

---

### Task 4: Verification And Devlog

**Files:**

- Modify: `docs/devlog/2026-05-29.md`

- [ ] **Step 1: Run full verification**

Run:

```bash
./node_modules/.bin/eslint .
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

Expected:

```text
eslint: 0 errors, existing <img> warning only
vitest: all test files pass
tsc: exit 0
next build: exit 0
```

- [ ] **Step 2: Browser smoke check**

Use Browser against `http://localhost:5010`:

```text
/login -> demo login -> /hospital -> logout -> /login
/platform-login -> platform/admin123 -> /open-platform -> logout -> /platform-login
```

Expected:

```text
Both role-specific flows still work and no route guard regression appears.
```

- [ ] **Step 3: Update devlog**

Append to `docs/devlog/2026-05-29.md`:

```md
## HH:mm 应用底座整理

- 分支：`codex/app-foundation`
- PR：待创建
- 目标：收拢认证 session 类型和工作台静态配置，降低后续业务模块迁移时的组件耦合。
- 完成：
  - 新增认证 session domain。
  - 抽离机构端工作台配置。
  - 抽离平台端工作台配置。
  - 补充 domain 测试。
- 修改文件：
  - `src/modules/auth/domain/session.ts`
  - `src/modules/auth/server/demo-session.ts`
  - `src/modules/auth/components/DemoSessionGate.tsx`
  - `src/modules/auth/tests/AuthSessionDomain.test.ts`
  - `src/modules/workspace/domain/institution-dashboard.ts`
  - `src/modules/workspace/domain/platform-dashboard.ts`
  - `src/modules/workspace/components/InstitutionWorkspace.tsx`
  - `src/modules/workspace/components/PlatformConsole.tsx`
  - `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
- 验证：
  - `./node_modules/.bin/eslint .`
  - `node scripts/run-vitest.mjs run`
  - `./node_modules/.bin/tsc --noEmit`
  - `node scripts/run-next.mjs build --webpack`
  - 浏览器验证机构端和平台端登录/退出链路
- 风险：
  - 本阶段只整理静态配置和类型，不改变真实业务能力。
  - 仍为 demo auth，不能视为正式认证系统。
- 下一步：
  - 继续拆机构端客户、预约、随访模块的页面壳和 mock 数据边界。
```

- [ ] **Step 4: Commit**

```bash
git add docs/devlog/2026-05-29.md
git commit -m "docs: 记录应用底座整理"
```

---

### Task 5: PR Handoff

**Files:**

- No source file changes.

- [ ] **Step 1: Push branch**

Run:

```bash
git push -u origin codex/app-foundation
```

Expected:

```text
branch 'codex/app-foundation' set up to track 'origin/codex/app-foundation'
```

- [ ] **Step 2: Open draft PR**

Create a Draft PR:

```text
Title: refactor: 整理应用底座类型与配置
Base: main
Head: codex/app-foundation
```

PR body:

```md
## 本次变更

- 收拢认证 session 类型与角色判断。
- 抽离机构端工作台静态配置。
- 抽离平台端工作台静态配置。
- 补充 domain 测试，确保导航和关键卡片配置不被误删。

## 为什么这样做

- 后续客户、预约、随访等模块会持续扩展，当前页面组件里混合了配置、图标、渲染和布局。
- 先把稳定配置和类型抽到模块内 domain 文件，能减少后续迁移时的耦合和重复。
- 本阶段不改变 UI 视觉和业务行为，降低回归风险。

## 验证

- [ ] `./node_modules/.bin/eslint .`
- [ ] `node scripts/run-vitest.mjs run`
- [ ] `./node_modules/.bin/tsc --noEmit`
- [ ] `node scripts/run-next.mjs build --webpack`
- [ ] 浏览器验证机构端和平台端登录/退出链路

## 风险和未完成项

- 当前仍是 demo auth，不是正式认证。
- 本阶段只整理类型和静态配置，不引入真实数据服务。
- 后续真实租户、RBAC、审计、数据库模型需要单独方案。

## 下一步

- 拆机构端客户中心、预约中心、智能随访的页面壳和 mock 数据边界。
```

- [ ] **Step 3: Mark ready or keep draft**

If all verification passes and the diff is limited to this plan, mark Ready. If follow-up implementation remains in the same branch, keep Draft.

---

## Self-Review

- Spec coverage: 覆盖应用底座第一阶段，未触碰需要单独规划的高风险模块。
- Placeholder scan: 没有 `TBD`、`TODO`、`implement later`、空泛测试项。
- Type consistency: `AuthRole`、`AuthSessionUser`、`AuthSession`、`AuthSessionPayload` 在测试、server helper、gate 组件之间保持一致。
