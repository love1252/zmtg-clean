# Demo/mock 运行时数据清理实施计划

> **面向 agentic worker 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步执行本计划。步骤使用 checkbox（`- [ ]`）语法跟踪。

**目标：** 分批清理会进入运行时页面或 API 的 Demo/mock/UI 数据，让无真实数据时系统展示空态或未接入态。

**架构：** 采用“运行时空态优先、测试 fixture 隔离”的路径。每批只处理一个边界：认证、机构端业务、平台 AI、平台知识库、产品套餐文案或测试 fixture；不在同一批里做数据库 schema、migration、真实认证或真实租户创建。

**技术栈：** Next.js、React、TypeScript、Vitest、Testing Library、现有 API route、现有 domain view model、现有平台/机构页面组件。

---

## 一、执行前共同基线

每个 runtime 子任务开始前必须执行：

```bash
date "+%Y-%m-%d %Z"
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

期望：

- 日期为当前执行日期。
- 工作树干净，或仅包含当前子任务允许文件。
- 如仍有本地领先远端提交，记录原因；不要因同步失败而混入无关改动。

共同禁止范围：

- 不改 DB schema、migration、SQL。
- 不创建真实租户或真实用户。
- 不接真实 OAuth、短信、邮件、支付、HIS 或外部系统。
- 不删除 `tenant_plans`。
- 不删除测试体系。
- 不读取或输出真实凭证。

## 二、文件责任地图

| 文件/目录 | 当前责任 | 清理方向 |
| --- | --- | --- |
| `src/modules/auth/server/demo-session.ts` | Demo 登录用户、cookie、session 签名。 | 后续改为开发开关或未配置态；真实认证单独任务。 |
| `src/modules/auth/components/ConfiguredLoginPages.tsx` | 登录页展示默认账号密码。 | 移除明文密码提示，展示登录方式未配置或开发模式说明。 |
| `src/modules/security/server/access-context.ts` | 从 demo cookie 解析访问上下文。 | 后续改为统一 session context 边界；第一批先不接真实认证。 |
| `src/modules/institution/domain/*` | 部分文件含 demo records 和默认业务常量。 | 运行时不默认导出 demo records；测试 fixture 接管。 |
| `src/modules/workspace/domain/institution-dashboard-view-models.ts` | 机构首页指标文案含 demo 口径。 | 改为真实 records/空态口径。 |
| `src/modules/open-platform/mock/**` | 平台 AI/知识库 mock 数据。 | 后续移出运行时默认路径，保留为测试 fixture 或删除。 |
| `src/modules/open-platform/server/*Contract.ts` | 部分 contract 从 mock 数据派生 API 响应。 | 改为空响应或真实持久化读取。 |
| `src/modules/open-platform/components/*Panel.tsx` | 展示受控示例和 mock 说明。 | 改为正式空态/未接入态。 |
| `src/server/db/seed-demo-data.ts` | demo seed 和测试数据源。 | 本计划不删除；后续隔离为测试/开发危险入口。 |

## 三、任务 1：认证 Demo 清理方案 runtime 准备

**文件：**
- 修改： `src/modules/auth/server/demo-session.ts`
- 修改： `src/modules/auth/components/ConfiguredLoginPages.tsx`
- 修改： `src/app/api/auth/login/route.ts`
- 修改： `src/app/api/auth/session/route.ts`
- 修改： `src/modules/auth/tests/DemoAuthRoutes.test.ts`
- 修改： `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

- [ ] **步骤 1：编写隐藏 demo 凭证明文的失败测试**

在 `src/modules/auth/tests/DemoAuthRoutes.test.ts` 增加测试，锁定登录页和 API 不再暴露 `admin123`：

```ts
it('登录配置不再暴露 demo 明文密码', async () => {
  const source = await import('@/modules/auth/components/ConfiguredLoginPages');
  expect(JSON.stringify(source)).not.toContain('admin123');
});
```

在页面测试中增加断言：

```ts
expect(screen.queryByText('admin123')).not.toBeInTheDocument();
expect(screen.getByText('登录方式未配置')).toBeInTheDocument();
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
pnpm test -- DemoAuthRoutes.test.ts WorkspaceEntryPages.test.tsx
```

预期：

- 失败原因： `ConfiguredLoginPages.tsx` still renders `admin123` and login still accepts demo credentials.

- [ ] **步骤 3：实现最小运行时清理**

Change `ConfiguredLoginPages.tsx` so default password text and auto-fill are removed. Use copy:

```tsx
登录方式未配置。请先完成真实用户或受控开发登录配置。
```

Change `demo-session.ts` so demo auth is disabled unless a clearly named development flag is enabled:

```ts
export function isDemoAuthEnabled() {
  return process.env.ZMTG_ENABLE_DEMO_AUTH === 'true';
}
```

Keep `decodeDemoSession` temporarily for backward compatibility, but do not show default credentials in UI.

- [ ] **步骤 4：运行聚焦测试**

运行：

```bash
pnpm test -- DemoAuthRoutes.test.ts WorkspaceEntryPages.test.tsx
```

预期：

- 通过条件： updated login expectations.
- Existing protected page tests may need fixtures to set explicit session context.

- [ ] **步骤 5：提交**

```bash
git add src/modules/auth/server/demo-session.ts src/modules/auth/components/ConfiguredLoginPages.tsx src/app/api/auth/login/route.ts src/app/api/auth/session/route.ts src/modules/auth/tests/DemoAuthRoutes.test.ts src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
git commit -m "fix: disable default demo credentials"
```

## 四、任务 2：机构端业务 Demo 常量运行时隔离

**文件：**
- 修改： `src/modules/institution/domain/customer-records.ts`
- 修改： `src/modules/institution/domain/appointment-records.ts`
- 修改： `src/modules/institution/domain/followup-workflow.ts`
- 修改： `src/modules/institution/domain/treatment-summaries.ts`
- 修改： `src/modules/workspace/domain/institution-dashboard-view-models.ts`
- 测试： `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
- 测试： `src/modules/institution/tests/TenantBusinessDomain.test.ts`

- [ ] **步骤 1：编写默认不返回 demo records 的失败测试**

Add or update tests so domain helpers require explicit records:

```ts
it('机构端业务查询默认不返回 demo records', () => {
  expect(listTenantCustomerRecords({ context: tenantContext, targetTenantId: 'demo-tenant-001' })).toEqual([]);
  expect(listTenantAppointmentRecords({ context: tenantContext, targetTenantId: 'demo-tenant-001' })).toEqual([]);
  expect(listTenantFollowUpTasks({ context: tenantContext, targetTenantId: 'demo-tenant-001' })).toEqual([]);
});
```

Add dashboard copy assertion:

```ts
const summary = buildInstitutionDashboardSummary({ customers: [], appointments: [], followUpTasks: [] });
expect(JSON.stringify(summary)).not.toContain('当前演示客户');
expect(JSON.stringify(summary)).not.toContain('受控 demo 数据');
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
pnpm test -- TenantBusinessDomain.test.ts WorkspaceDashboardDomain.test.ts
```

预期：

- 失败原因： helpers still default to demo records and dashboard copy still says demo.

- [ ] **步骤 3：实现空默认值**

Change function defaults from demo arrays to empty arrays:

```ts
const { context, targetTenantId, records = [] } = input;
```

For follow-up tasks:

```ts
const { context, targetTenantId, tasks = [] } = input;
```

Change dashboard metric copy from:

```ts
label: '当前演示客户',
helper: '受控 demo 数据',
```

to:

```ts
label: '当前客户',
helper: '来自当前租户数据',
```

- [ ] **步骤 4：如有需要，将 demo 数组迁入测试 fixture**

如果测试仍需要固定 records，创建测试专用 fixture，并把原运行时 demo 数组的对象原样移动到该 fixture 文件。移动时保留字段和值，不新增新的 mock 记录：

```ts
// src/modules/institution/tests/fixtures/tenant-business-demo-fixtures.ts
export const tenantBusinessDemoCustomerRecords = [
  // 从 src/modules/institution/domain/customer-records.ts 的原 demoTenantCustomerRecords 逐条迁入。
];
export const tenantBusinessDemoAppointmentRecords = [
  // 从 src/modules/institution/domain/appointment-records.ts 的原 demoTenantAppointmentRecords 逐条迁入。
];
export const tenantBusinessDemoFollowUpTasks = [
  // 从 src/modules/institution/domain/followup-workflow.ts 的原 demoTenantFollowUpTasks 逐条迁入。
];
```

运行时文件不得导入这个 fixture。

- [ ] **步骤 5：运行聚焦测试**

运行：

```bash
pnpm test -- TenantBusinessDomain.test.ts WorkspaceDashboardDomain.test.ts InstitutionBusinessShells.test.tsx WorkspaceEntryPages.test.tsx
```

预期：

- 通过。
- records 为空时，页面不得渲染默认 demo 客户。

- [ ] **步骤 6：提交**

```bash
git add src/modules/institution/domain/customer-records.ts src/modules/institution/domain/appointment-records.ts src/modules/institution/domain/followup-workflow.ts src/modules/institution/domain/treatment-summaries.ts src/modules/workspace/domain/institution-dashboard-view-models.ts src/modules/institution/tests src/modules/workspace/tests
git commit -m "fix: remove institution demo records from runtime defaults"
```

## 五、任务 3：平台 AI mock 改为空配置/未接入态

**文件：**
- 修改： `src/modules/open-platform/server/platformAiReadonlyApiContract.ts`
- 修改： `src/modules/open-platform/server/platformAiModelRegistryContract.ts`
- 修改： `src/modules/open-platform/server/platformAiUsageCostContract.ts`
- 修改： `src/modules/open-platform/components/OpenPlatformAiReadonlyPanel.tsx`
- 修改： `src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx`
- 测试： `src/modules/open-platform/tests/OpenPlatformAiReadonlyContract.test.ts`
- 测试： `src/modules/open-platform/tests/OpenPlatformAiReadonlyPanel.test.tsx`
- 测试： `src/modules/open-platform/tests/OpenPlatformAiModelConfigPanel.test.tsx`

- [ ] **步骤 1：编写不显示示例模型名的失败测试**

增加断言：

```ts
expect(JSON.stringify(payload)).not.toContain('Qwen Plus 示例');
expect(JSON.stringify(payload)).not.toContain('示例启用');
expect(JSON.stringify(payload)).not.toContain('受控示例用量');
expect(payload.usage.emptyState.title).toBe('暂无真实 AI 用量');
```

页面面板断言：

```ts
expect(screen.queryByText(/Qwen Plus 示例/)).not.toBeInTheDocument();
expect(screen.getByText('暂无真实 AI 用量')).toBeInTheDocument();
expect(screen.getByText('AI 模型配置未接入')).toBeInTheDocument();
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
pnpm test -- OpenPlatformAiReadonlyContract.test.ts OpenPlatformAiReadonlyPanel.test.tsx OpenPlatformAiModelConfigPanel.test.tsx
```

预期：

- 失败原因：当前 contract 和页面仍返回 mock AI registry 与 mock 用量。

- [ ] **步骤 3：实现 AI 空态 contract**

将 contract 输出改成：

```ts
{
  status: 'not_configured',
  registry: { providers: [], scenarios: [] },
  usage: {
    records: [],
    emptyState: {
      title: '暂无真实 AI 用量',
      description: '当前未接入真实 AI 调用日志、模型配置或费用账单。',
    },
  },
}
```

不得调用外部模型厂商，不得读取或写入真实 Key。

- [ ] **步骤 4：更新页面面板**

渲染空态或未配置态：

```tsx
<h2>AI 模型配置未接入</h2>
<p>当前没有真实模型配置、真实调用日志或费用账单。</p>
```

- [ ] **步骤 5：运行聚焦测试**

运行：

```bash
pnpm test -- OpenPlatformAiReadonlyContract.test.ts OpenPlatformAiReadonlyPanel.test.tsx OpenPlatformAiModelConfigPanel.test.tsx PlatformConsoleUx.test.tsx
```

预期：

- 通过。
- 运行时页面不得显示示例模型名或受控示例用量。

- [ ] **步骤 6：提交**

```bash
git add src/modules/open-platform/server/platformAiReadonlyApiContract.ts src/modules/open-platform/server/platformAiModelRegistryContract.ts src/modules/open-platform/server/platformAiUsageCostContract.ts src/modules/open-platform/components/OpenPlatformAiReadonlyPanel.tsx src/modules/open-platform/components/OpenPlatformAiModelConfigPanel.tsx src/modules/open-platform/tests
git commit -m "fix: replace platform ai mock data with empty states"
```

## 六、任务 4：平台知识库 mock 改为空响应

**文件：**
- 修改： `src/modules/open-platform/server/platformKnowledgeManagementApiContract.ts`
- 修改： `src/modules/open-platform/server/platform-knowledge-management-service.ts`
- 修改： `src/modules/open-platform/components/OpenPlatformKnowledgeManagementPanel.tsx`
- 测试： `src/modules/open-platform/tests/OpenPlatformKnowledgeManagementPanel.test.tsx`
- 测试： `src/modules/open-platform/tests/PlatformKnowledgeMockContract.test.ts`

- [ ] **步骤 1：编写不返回星澜 mock 数据的失败测试**

增加断言：

```ts
expect(JSON.stringify(response)).not.toContain('星澜医美中心');
expect(JSON.stringify(response)).not.toContain('星澜医美中心术后护理指南.pdf');
expect(response.records).toEqual([]);
```

页面面板断言：

```ts
expect(screen.queryByText(/星澜医美中心/)).not.toBeInTheDocument();
expect(screen.getByText('暂无知识库文件')).toBeInTheDocument();
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
pnpm test -- OpenPlatformKnowledgeManagementPanel.test.tsx PlatformKnowledgeMockContract.test.ts
```

预期：

- 失败原因：当前 API contract 和页面仍使用 `platformKnowledgeMockData`。

- [ ] **步骤 3：实现知识库空响应**

返回空数据：

```ts
{
  tenants: [],
  records: [],
  files: [],
  categories: [],
  topQuestions: [],
  importJobs: [],
  totals: {
    tenants: 0,
    files: 0,
    categories: 0,
    questions: 0,
    importJobs: 0,
  },
}
```

- [ ] **步骤 4：将 mock 数据保持为测试专用，或在测试迁移后删除**

如果现有测试仍需要丰富 records，将这些 records 移到：

```text
src/modules/open-platform/tests/fixtures/platform-knowledge-mock-fixtures.ts
```

运行时文件不得从这个 fixture 导入。

- [ ] **步骤 5：运行聚焦测试**

运行：

```bash
pnpm test -- OpenPlatformKnowledgeManagementPanel.test.tsx OpenPlatformKnowledgeManagementApiContract.test.ts PlatformKnowledgeMockContract.test.ts
```

预期：

- 通过。
- Runtime contract 不再返回星澜 mock 数据。

- [ ] **步骤 6：提交**

```bash
git add src/modules/open-platform/server/platformKnowledgeManagementApiContract.ts src/modules/open-platform/server/platform-knowledge-management-service.ts src/modules/open-platform/components/OpenPlatformKnowledgeManagementPanel.tsx src/modules/open-platform/tests
git commit -m "fix: replace platform knowledge mock data with empty states"
```

## 七、任务 5：产品套餐演示文案清理

**文件：**
- 修改： `src/modules/open-platform/components/ProductPlanPanel.tsx`
- 测试： `src/modules/open-platform/tests/ProductPlanPanel.test.tsx`

- [ ] **步骤 1：编写失败测试**

增加：

```ts
expect(screen.queryByText('演示环境权益词汇，非真实套餐')).not.toBeInTheDocument();
expect(screen.getByText('套餐目录配置')).toBeInTheDocument();
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
pnpm test -- ProductPlanPanel.test.tsx
```

预期：

- 失败原因：页面仍显示 demo 文案。

- [ ] **步骤 3：只修改文案**

替换：

```tsx
演示环境权益词汇，非真实套餐
```

改为：

```tsx
套餐目录配置
```

不得删除 `tenant_plans`，不得实现真实套餐 CRUD。

- [ ] **步骤 4：运行测试**

运行：

```bash
pnpm test -- ProductPlanPanel.test.tsx
```

预期：

- 通过。

- [ ] **步骤 5：提交**

```bash
git add src/modules/open-platform/components/ProductPlanPanel.tsx src/modules/open-platform/tests/ProductPlanPanel.test.tsx
git commit -m "fix: remove product plan demo wording"
```

## 八、任务 6：seed 与测试 fixture 隔离防回归

**文件：**
- 修改或新建： `src/server/db/tests/Schema.test.ts`
- 新建： `src/modules/open-platform/tests/RuntimeMockBoundary.test.ts`
- 新建： `src/modules/institution/tests/RuntimeDemoBoundary.test.ts`

- [ ] **步骤 1：增加运行时导入边界测试**

创建测试，扫描运行时文件，并在迁移后阻止运行时继续导入 mock 模块：

```ts
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

it('平台运行时不再导入 open-platform mock 数据', () => {
  const files = globSync('src/modules/open-platform/**/*.{ts,tsx}', {
    exclude: ['src/modules/open-platform/tests/**', 'src/modules/open-platform/mock/**'],
  });

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    expect(source, file).not.toContain('@/modules/open-platform/mock/');
  }
});
```

如果当前 Node runtime 没有 `globSync`，改用 `readdirSync` 递归实现同样扫描。

- [ ] **步骤 2：增加 seed 边界测试**

在 `Schema.test.ts` 中断言 seed 仍然是明确的危险/开发专用入口：

```ts
const seedSource = readFileSync(join(process.cwd(), 'src/server/db/seed-demo-data.ts'), 'utf8');
expect(seedSource).toContain('assertDemoSeedExecutionAllowed');
expect(seedSource).not.toContain('process.env.NODE_ENV === \"production\" || process.env.NODE_ENV === \"test\"');
```

具体断言应匹配已实现的 guard，目标是阻止随手在测试服务器执行 demo seed。

- [ ] **步骤 3：运行边界测试，并在运行时导入仍存在时确认失败**

运行：

```bash
pnpm test -- RuntimeMockBoundary.test.ts RuntimeDemoBoundary.test.ts Schema.test.ts
```

预期：

- 失败直到任务 3 和任务 4 移除对 `src/modules/open-platform/mock/**` 的运行时导入。

- [ ] **步骤 4：运行时清理完成后更新边界测试**

任务 3 和任务 4 通过后，边界测试应在不放宽导入规则的前提下通过。

- [ ] **步骤 5：提交**

```bash
git add src/server/db/tests/Schema.test.ts src/modules/open-platform/tests/RuntimeMockBoundary.test.ts src/modules/institution/tests/RuntimeDemoBoundary.test.ts
git commit -m "test: guard runtime demo mock boundaries"
```

## 九、最终验证

所有已批准的 runtime 任务完成后，运行：

```bash
pnpm test
pnpm lint
pnpm build
```

预期：

- `pnpm test` 通过。
- `pnpm lint` 退出码为 0；如仍有既有 warning，需要在总结中说明。
- `pnpm build` 通过。

手工运行时检查：

- `/open-platform` 平台总览不显示静态 demo 租户指标。
- `/open-platform` 租户管理在无租户时显示空态。
- AI 模型配置、AI 用量与费用、知识库管理不显示 `星澜医美中心`、`Qwen Plus 示例`、`受控示例用量`。
- 产品与套餐不显示“演示环境权益词汇，非真实套餐”。
- 登录页不显示 `admin123`。

## 十、实施顺序建议

1. 任务 5：产品套餐演示文案清理，风险最低。
2. 任务 3：平台 AI mock 改为空态，和真实认证无耦合。
3. 任务 4：平台知识库 mock 改为空态，和真实认证无耦合。
4. 任务 2：机构端业务 Demo 常量隔离，需要迁移测试 fixture。
5. 任务 6：边界防回归测试，在运行时导入清掉后落地。
6. 任务 1：认证 Demo 清理，风险最高，应在用户确认登录替代方式或开发开关策略后执行。

## 十一、自评

- 本计划覆盖方案文档中的认证、机构端、平台 AI、平台知识库、产品套餐和 seed/test 边界。
- 每个任务都有失败测试、实现方向、验证命令和提交命令。
- 本计划没有授权 schema、migration、SQL、真实租户创建、真实用户创建或真实外部系统。
- 本计划明确 `tenant_plans` 不清除。
