# 开放平台基础治理第一阶段实施计划

> **给执行代理的要求：** 实施本计划时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行。任务步骤使用复选框语法，方便跟踪进度。

**目标：** 在不实现真实数据库、真实密钥、OAuth 回调、Webhook 投递或外部集成的前提下，为开放平台建立第一阶段的租户隔离、权限边界、API Key/OAuth/Webhook 生命周期和审计事件治理基线。

**架构：** 新增独立的 `src/modules/open-platform` 模块，负责开放平台治理领域数据和只读展示组件。平台端 `/open-platform` 只引入该模块展示治理基线，所有生命周期和审计概念都保持为类型化静态数据，不产生后端副作用。第一阶段禁止新增 API route、数据库迁移、`.env` 修改、真实密钥生成、OAuth 回调处理、Webhook 签名或外部请求。

**技术栈：** Next.js App Router、React Server Components、TypeScript、Vitest、Testing Library、lucide-react、Tailwind CSS。

---

## 范围

### 本阶段要做

- 定义租户隔离原则，作为类型化静态领域数据。
- 定义平台端与机构端的角色边界、资源和动作权限。
- 定义 API Key、OAuth 应用、Webhook 订阅的生命周期状态和状态流转。
- 定义审计事件分类、事件样例和必填字段。
- 在 `/open-platform` 页面中增加只读治理基线区域，延续 PR #4 的视觉风格。
- 增加测试，防止第一阶段误引入真实密钥、可执行回调或后端变更接口。
- 增加安全审查文档，约束后续真实实现阶段。

### 本阶段不做

- 不新增真实数据库表或迁移。
- 不生成、哈希、加密、存储、轮换或吊销真实 API Key。
- 不新增 OAuth 授权端点、令牌端点、回调路由、刷新令牌处理或客户端密钥存储。
- 不新增 Webhook 投递 worker、重试队列、HMAC 签名、目标地址校验或外部 HTTP 调用。
- 不做正式 RBAC 中间件或服务端强制鉴权，现阶段仍只保留已有 demo session gate。
- 不修改 `.env`、生产配置、支付、认证存储或真实用户数据。

## 风险闸门

- 本阶段禁止改动或新增 `src/app/api/open-platform`、`src/app/api/oauth`、`src/app/api/webhooks`、`db`、`drizzle`、`prisma`、`migrations`、`.env*`。
- 本阶段禁止使用真实密钥生成、令牌交换、Webhook 外发、明文凭证存储相关代码。
- 不允许把浏览器 `localStorage` 作为租户身份或权限判断来源。
- 静态演示文案只能使用遮罩示例，例如 `****-demo-preview`，不能出现逼真的密钥前缀。
- 平台端可以展示跨租户聚合概念，但不能引入客户 PII、医疗记录、订单明细或治疗明细。

## 文件结构

- 新建：`src/modules/open-platform/domain/governance.ts`
  - 管理租户隔离、角色权限、开放连接生命周期和审计词汇的静态领域数据。
- 新建：`src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts`
  - 锁定领域模型约束、风险禁词、角色边界和生命周期流转。
- 新建：`src/modules/open-platform/components/OpenPlatformGovernancePanel.tsx`
  - 渲染只读治理基线组件。
- 新建：`src/modules/open-platform/tests/OpenPlatformGovernancePanel.test.tsx`
  - 验证治理组件展示必要的租户、权限、生命周期和审计文案。
- 修改：`src/modules/workspace/components/PlatformConsole.tsx`
  - 在现有平台能力卡片后渲染 `OpenPlatformGovernancePanel`。
- 修改：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 验证 `/open-platform` 暴露第一阶段治理区域。
- 新建：`docs/security/open-platform-governance-phase1.md`
  - 记录真实 API Key/OAuth/Webhook/RBAC/审计实现前的安全规则和合并前检查。
- 修改：`docs/devlog/2026-05-29.md`
  - 实施完成后追加开放平台基础治理第一阶段记录。

---

### 任务 1：建立开放平台治理领域模型

**文件：**
- 新建：`src/modules/open-platform/domain/governance.ts`
- 新建测试：`src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts`

- [ ] **步骤 1：先写失败测试**

创建 `src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  auditEventCatalog,
  capabilityLifecycleGroups,
  governanceForbiddenTerms,
  openPlatformPermissions,
  platformRoleCatalog,
  tenantIsolationPrinciples,
} from '@/modules/open-platform/domain/governance';

describe('开放平台治理领域模型', () => {
  it('定义租户隔离原则，且不信任浏览器状态', () => {
    expect(tenantIsolationPrinciples).toHaveLength(4);
    expect(tenantIsolationPrinciples.map((item) => item.title)).toEqual([
      '服务端租户上下文',
      '平台聚合可观测',
      '机构租户最小权限',
      '敏感数据默认不可见',
    ]);
    expect(tenantIsolationPrinciples.map((item) => item.risk).join(' ')).not.toContain('localStorage');
  });

  it('保持角色权限显式且有边界', () => {
    expect(platformRoleCatalog.map((role) => role.id)).toEqual([
      'platform_super_admin',
      'platform_operator',
      'security_auditor',
      'tenant_admin',
    ]);

    expect(openPlatformPermissions).toContainEqual({
      roleId: 'platform_super_admin',
      resource: 'tenant',
      actions: ['read_aggregate', 'read_detail', 'manage_status'],
      boundary: '可管理租户运营状态，但第一阶段不能读取租户客户 PII。',
    });
    expect(openPlatformPermissions).toContainEqual({
      roleId: 'tenant_admin',
      resource: 'open_connection',
      actions: ['read_own_tenant'],
      boundary: '只能查看本租户开放连接态势，不能管理平台级策略。',
    });
  });

  it('定义 API Key、OAuth、Webhook 生命周期，但不包含真实密钥或回调能力', () => {
    expect(capabilityLifecycleGroups.map((group) => group.id)).toEqual(['api_key', 'oauth_app', 'webhook']);

    const apiKey = capabilityLifecycleGroups.find((group) => group.id === 'api_key');
    expect(apiKey?.states.map((state) => state.id)).toEqual(['draft', 'active', 'rotating', 'revoked']);
    expect(apiKey?.transitions).toContainEqual({ from: 'active', to: 'rotating', trigger: '轮换遮罩凭证预览' });

    const oauth = capabilityLifecycleGroups.find((group) => group.id === 'oauth_app');
    expect(oauth?.states.map((state) => state.id)).toEqual(['draft', 'configured', 'published', 'suspended']);

    const webhook = capabilityLifecycleGroups.find((group) => group.id === 'webhook');
    expect(webhook?.states.map((state) => state.id)).toEqual(['draft', 'enabled', 'degraded', 'disabled']);
    expect(webhook?.transitions).toContainEqual({ from: 'enabled', to: 'degraded', trigger: '投递健康低于策略阈值' });
  });

  it('定义审计事件词汇和必填字段', () => {
    expect(auditEventCatalog.map((event) => event.category)).toEqual([
      'tenant_boundary',
      'permission_policy',
      'connection_lifecycle',
      'security_review',
    ]);
    expect(auditEventCatalog[0].requiredFields).toEqual([
      'eventId',
      'actorId',
      'actorRole',
      'tenantScope',
      'resourceType',
      'resourceId',
      'action',
      'result',
      'occurredAt',
    ]);
  });

  it('第一阶段演示数据不包含真实凭证风险词', () => {
    const serialized = JSON.stringify({
      tenantIsolationPrinciples,
      platformRoleCatalog,
      openPlatformPermissions,
      capabilityLifecycleGroups,
      auditEventCatalog,
    }).toLowerCase();

    governanceForbiddenTerms.forEach((term) => {
      expect(serialized).not.toContain(term.toLowerCase());
    });
  });
});
```

- [ ] **步骤 2：运行测试，确认失败**

```bash
node scripts/run-vitest.mjs run src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts
```

预期：失败，原因是 `@/modules/open-platform/domain/governance` 尚不存在。

- [ ] **步骤 3：实现领域模型**

创建 `src/modules/open-platform/domain/governance.ts`：

```ts
export type PlatformRoleId =
  | 'platform_super_admin'
  | 'platform_operator'
  | 'security_auditor'
  | 'tenant_admin';

export type GovernanceResource =
  | 'tenant'
  | 'open_connection'
  | 'permission_policy'
  | 'audit_log'
  | 'platform_health';

export type GovernanceAction =
  | 'read_aggregate'
  | 'read_detail'
  | 'read_own_tenant'
  | 'manage_status'
  | 'manage_policy'
  | 'review'
  | 'export_report';

export type CapabilityLifecycleId = 'api_key' | 'oauth_app' | 'webhook';

export type LifecycleStateId =
  | 'draft'
  | 'active'
  | 'rotating'
  | 'revoked'
  | 'configured'
  | 'published'
  | 'suspended'
  | 'enabled'
  | 'degraded'
  | 'disabled';

export type AuditCategory =
  | 'tenant_boundary'
  | 'permission_policy'
  | 'connection_lifecycle'
  | 'security_review';

export const governanceForbiddenTerms = [
  'client_secret',
  'access_token',
  'refresh_token',
  'private_key',
  'webhook_secret',
  'sk_live',
  'sk_test',
  'zmtg_sk_',
] as const;

export const tenantIsolationPrinciples = [
  {
    title: '服务端租户上下文',
    detail: '租户身份只能来自服务端 session、服务端签发上下文或后续可信网关，不读取浏览器缓存作为授权依据。',
    risk: '阻断伪造租户、越权访问、跨机构读取。',
  },
  {
    title: '平台聚合可观测',
    detail: '平台端默认展示跨租户聚合指标、健康状态和治理状态，不直接展示机构客户明细。',
    risk: '降低平台运营误看客户 PII 和医疗敏感数据的风险。',
  },
  {
    title: '机构租户最小权限',
    detail: '机构管理员只能看到本租户资源、连接状态和被授予的配置入口。',
    risk: '避免机构间配置、客户资产、订单和审计事件互相泄露。',
  },
  {
    title: '敏感数据默认不可见',
    detail: '真实客户信息、治疗记录、外部凭证和安全事件详情默认不进入平台聚合卡片。',
    risk: '降低日志、截图和运营看板中的敏感信息暴露面。',
  },
] as const;

export const platformRoleCatalog: Array<{
  id: PlatformRoleId;
  name: string;
  description: string;
}> = [
  {
    id: 'platform_super_admin',
    name: '平台超级管理员',
    description: '负责租户状态、平台策略、开放连接治理和高风险操作审批。',
  },
  {
    id: 'platform_operator',
    name: '平台运营',
    description: '查看平台聚合运营状态，处理低风险租户运营任务。',
  },
  {
    id: 'security_auditor',
    name: '安全审计员',
    description: '查看审计事件、权限策略和安全巡检结果，不执行业务配置变更。',
  },
  {
    id: 'tenant_admin',
    name: '机构管理员',
    description: '管理本机构工作台和本租户开放连接可见状态。',
  },
];

export const openPlatformPermissions: Array<{
  roleId: PlatformRoleId;
  resource: GovernanceResource;
  actions: GovernanceAction[];
  boundary: string;
}> = [
  {
    roleId: 'platform_super_admin',
    resource: 'tenant',
    actions: ['read_aggregate', 'read_detail', 'manage_status'],
    boundary: '可管理租户运营状态，但第一阶段不能读取租户客户 PII。',
  },
  {
    roleId: 'platform_super_admin',
    resource: 'permission_policy',
    actions: ['read_detail', 'manage_policy', 'review'],
    boundary: '可定义策略草案，并在审查后审批高风险策略变更。',
  },
  {
    roleId: 'platform_operator',
    resource: 'platform_health',
    actions: ['read_aggregate', 'read_detail'],
    boundary: '可查看平台健康和聚合趋势，不修改安全策略。',
  },
  {
    roleId: 'security_auditor',
    resource: 'audit_log',
    actions: ['read_detail', 'export_report', 'review'],
    boundary: '可查看和导出审计报告，不能轮换凭证或修改租户状态。',
  },
  {
    roleId: 'tenant_admin',
    resource: 'open_connection',
    actions: ['read_own_tenant'],
    boundary: '只能查看本租户开放连接态势，不能管理平台级策略。',
  },
];

export const capabilityLifecycleGroups = [
  {
    id: 'api_key',
    title: 'API Key 生命周期',
    description: '第一阶段仅展示遮罩凭证预览和状态流转，不生成、存储或校验真实密钥。',
    states: [
      { id: 'draft', label: '草稿', description: '连接需求已登记，尚未允许调用。' },
      { id: 'active', label: '启用', description: '后续真实实现中代表调用权限已开启。' },
      { id: 'rotating', label: '轮换中', description: '后续真实实现中代表新旧遮罩凭证处于交接窗口。' },
      { id: 'revoked', label: '已吊销', description: '后续真实实现中代表调用权限已停止。' },
    ],
    transitions: [
      { from: 'draft', to: 'active', trigger: '审批连接申请' },
      { from: 'active', to: 'rotating', trigger: '轮换遮罩凭证预览' },
      { from: 'rotating', to: 'active', trigger: '完成轮换审查' },
      { from: 'active', to: 'revoked', trigger: '安全审查后吊销' },
    ],
  },
  {
    id: 'oauth_app',
    title: 'OAuth 应用生命周期',
    description: '第一阶段仅展示应用配置状态，不创建授权地址、回调处理或令牌交换。',
    states: [
      { id: 'draft', label: '草稿', description: '应用名称、授权范围和租户归属处于设计中。' },
      { id: 'configured', label: '已配置', description: '授权范围和回调域名通过人工校验。' },
      { id: 'published', label: '已发布', description: '后续真实实现中代表应用可被授权。' },
      { id: 'suspended', label: '已暂停', description: '后续真实实现中代表应用授权入口被暂停。' },
    ],
    transitions: [
      { from: 'draft', to: 'configured', trigger: '完成策略审查' },
      { from: 'configured', to: 'published', trigger: '发布已审查应用' },
      { from: 'published', to: 'suspended', trigger: '风险告警后暂停' },
      { from: 'suspended', to: 'configured', trigger: '整改复核后重新打开' },
    ],
  },
  {
    id: 'webhook',
    title: 'Webhook 生命周期',
    description: '第一阶段仅展示订阅健康状态，不保存目标地址、不签名、不投递事件。',
    states: [
      { id: 'draft', label: '草稿', description: '订阅主题和租户归属处于设计中。' },
      { id: 'enabled', label: '已启用', description: '后续真实实现中代表订阅可以接收事件。' },
      { id: 'degraded', label: '降级', description: '后续真实实现中代表投递健康低于策略阈值。' },
      { id: 'disabled', label: '已停用', description: '后续真实实现中代表订阅停止投递。' },
    ],
    transitions: [
      { from: 'draft', to: 'enabled', trigger: '审批订阅策略' },
      { from: 'enabled', to: 'degraded', trigger: '投递健康低于策略阈值' },
      { from: 'degraded', to: 'enabled', trigger: '健康恢复并通过复核' },
      { from: 'enabled', to: 'disabled', trigger: '租户申请或风险告警后停用' },
    ],
  },
] satisfies Array<{
  id: CapabilityLifecycleId;
  title: string;
  description: string;
  states: Array<{ id: LifecycleStateId; label: string; description: string }>;
  transitions: Array<{ from: LifecycleStateId; to: LifecycleStateId; trigger: string }>;
}>;

export const auditEventCatalog: Array<{
  category: AuditCategory;
  title: string;
  exampleAction: string;
  requiredFields: string[];
}> = [
  {
    category: 'tenant_boundary',
    title: '租户边界事件',
    exampleAction: 'tenant.aggregate.read',
    requiredFields: ['eventId', 'actorId', 'actorRole', 'tenantScope', 'resourceType', 'resourceId', 'action', 'result', 'occurredAt'],
  },
  {
    category: 'permission_policy',
    title: '权限策略事件',
    exampleAction: 'permission.policy.review',
    requiredFields: ['eventId', 'actorId', 'actorRole', 'tenantScope', 'resourceType', 'resourceId', 'action', 'result', 'occurredAt'],
  },
  {
    category: 'connection_lifecycle',
    title: '开放连接生命周期事件',
    exampleAction: 'connection.lifecycle.transition',
    requiredFields: ['eventId', 'actorId', 'actorRole', 'tenantScope', 'resourceType', 'resourceId', 'action', 'result', 'occurredAt'],
  },
  {
    category: 'security_review',
    title: '安全审查事件',
    exampleAction: 'security.review.complete',
    requiredFields: ['eventId', 'actorId', 'actorRole', 'tenantScope', 'resourceType', 'resourceId', 'action', 'result', 'occurredAt'],
  },
];
```

- [ ] **步骤 4：运行领域测试，确认通过**

```bash
node scripts/run-vitest.mjs run src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts
```

预期：通过。

- [ ] **步骤 5：提交领域模型**

```bash
git add src/modules/open-platform/domain/governance.ts src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts
git commit -m "feat: add open platform governance domain"
```

---

### 任务 2：增加只读治理面板

**文件：**
- 新建：`src/modules/open-platform/components/OpenPlatformGovernancePanel.tsx`
- 新建测试：`src/modules/open-platform/tests/OpenPlatformGovernancePanel.test.tsx`

- [ ] **步骤 1：先写失败测试**

创建 `src/modules/open-platform/tests/OpenPlatformGovernancePanel.test.tsx`：

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OpenPlatformGovernancePanel } from '@/modules/open-platform/components/OpenPlatformGovernancePanel';

describe('OpenPlatformGovernancePanel', () => {
  it('展示租户隔离、权限、生命周期和审计治理区域', () => {
    render(<OpenPlatformGovernancePanel />);

    expect(screen.getByRole('heading', { name: '开放平台基础治理' })).toBeInTheDocument();
    expect(screen.getByText('服务端租户上下文')).toBeInTheDocument();
    expect(screen.getByText('平台超级管理员')).toBeInTheDocument();
    expect(screen.getByText('API Key 生命周期')).toBeInTheDocument();
    expect(screen.getByText('OAuth 应用生命周期')).toBeInTheDocument();
    expect(screen.getByText('Webhook 生命周期')).toBeInTheDocument();
    expect(screen.getByText('租户边界事件')).toBeInTheDocument();
    expect(screen.getByText('只读治理基线')).toBeInTheDocument();
  });

  it('不展示可执行的凭证、OAuth 或 Webhook 操作按钮', () => {
    render(<OpenPlatformGovernancePanel />);

    expect(screen.queryByRole('button', { name: '生成 API Key' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '创建 OAuth 应用' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '发送测试 Webhook' })).not.toBeInTheDocument();
    expect(screen.queryByText('client_secret')).not.toBeInTheDocument();
    expect(screen.queryByText('access_token')).not.toBeInTheDocument();
  });
});
```

- [ ] **步骤 2：运行组件测试，确认失败**

```bash
node scripts/run-vitest.mjs run src/modules/open-platform/tests/OpenPlatformGovernancePanel.test.tsx
```

预期：失败，原因是 `OpenPlatformGovernancePanel` 尚不存在。

- [ ] **步骤 3：实现只读治理组件**

创建 `src/modules/open-platform/components/OpenPlatformGovernancePanel.tsx`。组件必须：

- 使用 `tenantIsolationPrinciples` 展示租户隔离原则。
- 使用 `platformRoleCatalog` 展示角色边界。
- 使用 `capabilityLifecycleGroups` 展示 API Key、OAuth、Webhook 生命周期。
- 使用 `auditEventCatalog` 展示审计事件词汇。
- 使用 `openPlatformPermissions` 展示权限样例矩阵。
- 只渲染只读内容，不新增任何按钮触发真实密钥、OAuth 或 Webhook 动作。

组件骨架：

```tsx
import { Activity, GitBranch, KeyRound, ShieldCheck } from 'lucide-react';
import {
  auditEventCatalog,
  capabilityLifecycleGroups,
  openPlatformPermissions,
  platformRoleCatalog,
  tenantIsolationPrinciples,
} from '@/modules/open-platform/domain/governance';

export function OpenPlatformGovernancePanel() {
  return (
    <section className="space-y-5" aria-labelledby="open-platform-governance-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs font-semibold text-cyan-100">
            <ShieldCheck className="h-4 w-4" />
            只读治理基线
          </div>
          <h2 id="open-platform-governance-title" className="mt-3 text-2xl font-semibold tracking-normal text-white">
            开放平台基础治理
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            第一阶段只定义租户隔离、权限边界、开放连接生命周期和审计词汇，不创建真实密钥、不处理 OAuth 回调、不投递 Webhook。
          </p>
        </div>
        <div className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1 text-xs font-semibold text-emerald-200">
          Phase 1 / 无外部副作用
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <ShieldCheck className="h-4 w-4" />
            租户隔离原则
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {tenantIsolationPrinciples.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-[#071322]/75 p-4">
                <div className="text-sm font-semibold text-white">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
                <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.07] px-3 py-2 text-xs leading-5 text-amber-100">
                  {item.risk}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <Activity className="h-4 w-4" />
            权限边界
          </div>
          <div className="mt-4 space-y-3">
            {platformRoleCatalog.map((role) => (
              <div key={role.id} className="rounded-2xl border border-white/10 bg-[#071322]/75 px-4 py-3">
                <div className="text-sm font-semibold text-white">{role.name}</div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{role.description}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
          <KeyRound className="h-4 w-4" />
          开放连接生命周期
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {capabilityLifecycleGroups.map((group) => (
            <div key={group.id} className="rounded-2xl border border-white/10 bg-[#071322]/75 p-4">
              <div className="text-sm font-semibold text-white">{group.title}</div>
              <p className="mt-2 min-h-[48px] text-xs leading-5 text-slate-400">{group.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.states.map((state) => (
                  <span key={`${group.id}-${state.id}`} className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.08] px-2.5 py-1 text-xs font-semibold text-cyan-100">
                    {state.label}
                  </span>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {group.transitions.slice(0, 2).map((transition) => (
                  <div key={`${transition.from}-${transition.to}`} className="flex items-center gap-2 text-xs text-slate-400">
                    <GitBranch className="h-3.5 w-3.5 text-cyan-200" />
                    <span>{transition.trigger}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </article>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <div className="text-sm font-semibold text-cyan-100">审计事件词汇</div>
          <div className="mt-4 space-y-3">
            {auditEventCatalog.map((event) => (
              <div key={event.category} className="rounded-2xl border border-white/10 bg-[#071322]/75 px-4 py-3">
                <div className="text-sm font-semibold text-white">{event.title}</div>
                <div className="mt-1 font-mono text-xs text-cyan-100">{event.exampleAction}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <div className="text-sm font-semibold text-cyan-100">权限样例矩阵</div>
          <div className="mt-4 space-y-3">
            {openPlatformPermissions.slice(0, 4).map((permission) => (
              <div key={`${permission.roleId}-${permission.resource}`} className="rounded-2xl border border-white/10 bg-[#071322]/75 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-semibold text-white">{permission.roleId}</span>
                  <span className="rounded-full bg-cyan-300/[0.10] px-2.5 py-1 text-xs font-semibold text-cyan-100">{permission.resource}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{permission.boundary}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
```

- [ ] **步骤 4：运行组件测试，确认通过**

```bash
node scripts/run-vitest.mjs run src/modules/open-platform/tests/OpenPlatformGovernancePanel.test.tsx
```

预期：通过。

- [ ] **步骤 5：提交只读治理面板**

```bash
git add src/modules/open-platform/components/OpenPlatformGovernancePanel.tsx src/modules/open-platform/tests/OpenPlatformGovernancePanel.test.tsx
git commit -m "feat: add open platform governance panel"
```

---

### 任务 3：接入平台端运营中枢

**文件：**
- 修改：`src/modules/workspace/components/PlatformConsole.tsx`
- 修改测试：`src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

- [ ] **步骤 1：先写失败断言**

在 `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx` 的平台端测试里补充：

```tsx
expect(screen.getByText('开放接口治理')).toBeInTheDocument();
expect(screen.getByRole('heading', { name: '开放平台基础治理' })).toBeInTheDocument();
expect(screen.getByText('服务端租户上下文')).toBeInTheDocument();
expect(screen.getByText('权限样例矩阵')).toBeInTheDocument();
expect(screen.getByText('审计事件词汇')).toBeInTheDocument();
```

- [ ] **步骤 2：运行入口页测试，确认失败**

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

预期：失败，因为 `/open-platform` 尚未渲染治理面板。

- [ ] **步骤 3：导入并渲染治理面板**

修改 `src/modules/workspace/components/PlatformConsole.tsx`。

新增导入：

```ts
import { OpenPlatformGovernancePanel } from '@/modules/open-platform/components/OpenPlatformGovernancePanel';
```

在现有 `platformCapabilityCards` 区域之后渲染：

```tsx
<OpenPlatformGovernancePanel />
```

渲染位置保持在现有容器内部：

```tsx
<div className="mx-auto w-full max-w-[1740px] space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
```

- [ ] **步骤 4：运行聚焦测试**

```bash
node scripts/run-vitest.mjs run src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts src/modules/open-platform/tests/OpenPlatformGovernancePanel.test.tsx src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

预期：通过。

- [ ] **步骤 5：提交页面接入**

```bash
git add src/modules/workspace/components/PlatformConsole.tsx src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
git commit -m "feat: surface open platform governance baseline"
```

---

### 任务 4：补充安全审查清单

**文件：**
- 新建：`docs/security/open-platform-governance-phase1.md`

- [ ] **步骤 1：创建安全文档**

创建 `docs/security/open-platform-governance-phase1.md`：

```md
# 开放平台基础治理第一阶段安全清单

## 阶段目标

第一阶段只建立开放平台治理视图和静态领域模型，用于统一租户隔离、权限边界、API Key/OAuth/Webhook 生命周期和审计事件语言。

## 禁止事项

- 不创建数据库迁移。
- 不创建真实 API Key。
- 不存储、展示或复制真实密钥。
- 不创建 OAuth 授权、回调、令牌交换或刷新令牌逻辑。
- 不创建 Webhook 投递、签名、重试、队列或外部 HTTP 调用。
- 不从 localStorage、query string 或任意前端输入读取租户身份作为权限依据。
- 不在平台聚合视图展示机构客户 PII、治疗记录、订单明细或医疗敏感数据。

## 后续真实实现前必须具备的设计

- 服务端租户上下文来源。
- 平台管理员、平台运营、安全审计员、机构管理员的 RBAC 权限矩阵。
- API Key 哈希存储、前缀展示、一次性明文展示、轮换与吊销策略。
- OAuth client 注册、redirect URI 校验、scope 审批、token 加密存储和撤销策略。
- Webhook endpoint 校验、签名算法、重试策略、死信队列和投递审计。
- 审计日志不可抵赖字段、保留周期、导出权限和敏感字段脱敏策略。

## 合并前检查

- `rg -i "client_secret|access_token|refresh_token|private_key|webhook_secret|sk_live|sk_test|zmtg_sk_" src docs`
- `rg -n "src/app/api/open-platform|src/app/api/oauth|src/app/api/webhooks|drizzle|prisma|migrations|\\.env" .`
- `./node_modules/.bin/eslint .`
- `node scripts/run-vitest.mjs run`
- `./node_modules/.bin/tsc --noEmit`
- `node scripts/run-next.mjs build --webpack`

## 审查问题

- 平台端是否只展示聚合数据和治理状态？
- 机构端是否只能看到本租户资源？
- 是否有任何租户身份来自浏览器可篡改数据？
- 是否出现真实凭证、令牌、签名密钥或回调 URL？
- 是否新增了未经计划的 API route、数据库模型或外部请求？
```

- [ ] **步骤 2：检查安全文档没有未完成表述**

```bash
node -e "const fs=require('fs'); const text=fs.readFileSync('docs/security/open-platform-governance-phase1.md','utf8'); const words=['待定','稍后实现','补充中']; const hit=words.find((word)=>text.includes(word)); if (hit) { console.error(hit); process.exit(1); }"
```

预期：退出码为 0，无输出。

- [ ] **步骤 3：提交安全清单**

```bash
git add docs/security/open-platform-governance-phase1.md
git commit -m "docs: add open platform governance security checklist"
```

---

### 任务 5：开发日志与完整验证

**文件：**
- 修改：`docs/devlog/2026-05-29.md`

- [ ] **步骤 1：追加开发日志**

在 `docs/devlog/2026-05-29.md` 末尾追加：

```md

## 开放平台基础治理第一阶段

- 分支：`codex/open-platform-governance-phase1`
- 目标：在不实现真实数据库、真实密钥、OAuth 回调或 Webhook 投递的前提下，为开放平台建立租户隔离、权限边界、连接生命周期和审计事件的只读治理基线。
- 完成：
  - 新增 `src/modules/open-platform` 模块，独立承载开放平台治理领域数据和展示组件。
  - 定义租户隔离原则、平台角色、权限边界、API Key/OAuth/Webhook 生命周期和审计事件词汇。
  - 在 `/open-platform` 平台运营中枢中展示只读治理基线。
  - 新增安全清单，明确后续真实实现前的禁止事项和合并前检查。
- 修改文件：
  - `src/modules/open-platform/domain/governance.ts`
  - `src/modules/open-platform/components/OpenPlatformGovernancePanel.tsx`
  - `src/modules/open-platform/tests/OpenPlatformGovernanceDomain.test.ts`
  - `src/modules/open-platform/tests/OpenPlatformGovernancePanel.test.tsx`
  - `src/modules/workspace/components/PlatformConsole.tsx`
  - `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - `docs/security/open-platform-governance-phase1.md`
- 验证：
  - `./node_modules/.bin/eslint .`
  - `node scripts/run-vitest.mjs run`
  - `./node_modules/.bin/tsc --noEmit`
  - `node scripts/run-next.mjs build --webpack`
- 风险：
  - 本阶段仍是只读治理基线，不代表真实开放平台能力已上线。
  - 后续真实 API Key、OAuth、Webhook、RBAC、审计日志和数据库模型必须继续单独 Plan Mode 设计。
```

- [ ] **步骤 2：运行完整验证**

```bash
./node_modules/.bin/eslint .
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

预期：

- ESLint：0 error，既有 `LuxuryLoginShell.tsx` 的 `<img>` warning 可以保留。
- Vitest：所有现有测试和新增 open-platform 测试均通过。
- TypeScript：退出码 0。
- Next build：退出码 0。

- [ ] **步骤 3：运行禁止范围扫描**

```bash
git diff --name-only main...HEAD | rg -i 'src/app/api/open-platform|src/app/api/oauth|src/app/api/webhooks|db|drizzle|prisma|migrations|\\.env'
```

预期：退出码 1，无命中。

```bash
rg -i 'client_secret|access_token|refresh_token|private_key|webhook_secret|sk_live|sk_test|zmtg_sk_' src/modules/open-platform docs/security/open-platform-governance-phase1.md
```

预期：退出码 1，无命中。

- [ ] **步骤 4：浏览器视觉验收**

启动或复用 `http://localhost:5010`，使用 `platform/admin123` 登录，检查：

- `/open-platform` 保持 PR #4 的视觉基准。
- 新增 `开放平台基础治理` 区域位于现有平台能力卡片之后。
- 页面没有 `生成 API Key`、`创建 OAuth 应用`、`发送测试 Webhook` 按钮。
- 390px 左右移动端无横向溢出。
- 现有 `退出平台` 仍能回到 `/platform-login`。

- [ ] **步骤 5：提交开发日志**

```bash
git add docs/devlog/2026-05-29.md
git commit -m "docs: record open platform governance phase one"
```

---

## 自检

### 需求覆盖

- 租户隔离：由任务 1 的 `tenantIsolationPrinciples` 和任务 2 的页面展示覆盖。
- 权限边界：由 `platformRoleCatalog`、`openPlatformPermissions`、任务 2 页面展示和任务 4 安全文档覆盖。
- API Key 生命周期：由 `capabilityLifecycleGroups` 中的 `api_key` 状态和流转覆盖。
- OAuth 生命周期：由 `capabilityLifecycleGroups` 中的 `oauth_app` 状态和流转覆盖。
- Webhook 生命周期：由 `capabilityLifecycleGroups` 中的 `webhook` 状态和流转覆盖。
- 审计日志：由 `auditEventCatalog` 和任务 4 安全文档覆盖。
- 不实现真实数据库、真实密钥和外部回调：由范围、风险闸门、任务 4、任务 5 的扫描命令共同约束。

### 文档完整性

计划已经写明具体文件、测试、实现代码、验证命令和预期结果。执行时不需要回到旧项目扫描，也不需要重新规划整个开放平台。

### 类型一致性

- `PlatformRoleId`、`GovernanceResource`、`GovernanceAction`、`CapabilityLifecycleId`、`LifecycleStateId`、`AuditCategory` 在任务 1 定义，并被后续任务一致使用。
- `OpenPlatformGovernancePanel` 只导入 `governance.ts` 导出的静态数据。
- 测试文件路径与组件、领域模型路径一致。

## 执行选择

计划已保存到 `docs/superpowers/plans/2026-05-29-open-platform-governance-phase1.md`。下一步有两个执行方式：

1. **Subagent-Driven（推荐）**：每个任务用独立上下文执行，任务间做 review，适合高风险阶段。
2. **Inline Execution**：在当前会话中按计划逐项执行，每个任务后做检查点。

请选择执行方式。
