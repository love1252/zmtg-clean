# Workspace UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将机构端 `/hospital` 改为浅奢医疗增长工作台，将平台端 `/open-platform` 改为深色科技运营中枢，并保持现有登录、退出和 demo session 行为不变。

**Architecture:** 本次只改 workspace domain 静态数据、两个 workspace 页面组件和测试，不引入数据库、真实权限、开放平台密钥或后端服务。先用测试锁定新的导航、核心文案、指标和能力入口，再实现视觉改造，最后用浏览器验证桌面与移动基础布局。

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, lucide-react, Vitest, Testing Library.

---

## File Structure

### Modify

- `src/modules/workspace/domain/institution-dashboard.ts`
  - 调整机构端导航、指标、AI 建议、客户旅程和行动队列数据。
- `src/modules/workspace/domain/platform-dashboard.ts`
  - 调整平台端导航、指标短标题、能力卡文案。
- `src/modules/workspace/components/InstitutionWorkspace.tsx`
  - 实现浅奢医疗增长工作台 UI。
- `src/modules/workspace/components/PlatformConsole.tsx`
  - 实现深色科技运营中枢 UI。
- `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
  - 更新 domain 断言，覆盖新导航、指标、行动队列、能力卡。
- `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - 更新页面入口断言，覆盖新标题和核心模块。
- `docs/devlog/2026-05-29.md`
  - 记录 UI 改造阶段、验证和风险。

---

### Task 1: Domain Tests And Static Data

**Files:**

- Modify: `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
- Modify: `src/modules/workspace/domain/institution-dashboard.ts`
- Modify: `src/modules/workspace/domain/platform-dashboard.ts`

- [ ] **Step 1: Write failing domain tests**

Update `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts` to import the new institution exports:

```ts
import {
  institutionActionQueue,
  institutionJourneyLanes,
  institutionNavItems,
  institutionStats,
  institutionSuggestions,
} from '@/modules/workspace/domain/institution-dashboard';
```

Replace institution assertions with:

```ts
expect(labels).toEqual(
  expect.arrayContaining(['工作台', '客户中心', '智能随访', '客服工作台', '预约中心', '知识库', '数据分析']),
);
expect(institutionStats.map((item) => item.label)).toEqual(
  expect.arrayContaining(['累计客户资产', '今日待承接', '预约转化率', '复购窗口客户']),
);
expect(institutionSuggestions.map((item) => item.type)).toEqual(['复购', '转化', '服务']);
expect(institutionJourneyLanes.map((item) => item.title)).toEqual(['新客咨询', '预约到院', '术后关怀', '复购召回']);
expect(institutionActionQueue).toHaveLength(5);
expect(institutionActionQueue[0]).toMatchObject({ name: '王女士', score: 98 });
```

Replace platform assertions with:

```ts
expect(labels).toEqual(
  expect.arrayContaining(['平台总览', '首页与品牌', '租户管理', '产品与套餐', '开放连接中心', '权限与审计']),
);
expect(platformMetrics.map((item) => item.label)).toEqual(
  expect.arrayContaining(['入驻医院', '活跃机构', 'Agent 调用', '服务用户', 'MRR', '续费率']),
);
expect(platformCapabilityCards.map((item) => item.title)).toEqual(['开放接口治理', '模型与智能体监控', '权限审计']);
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
```

Expected:

```text
FAIL ... institutionJourneyLanes / institutionActionQueue export missing or old labels mismatch
```

- [ ] **Step 3: Update institution domain data**

In `src/modules/workspace/domain/institution-dashboard.ts`:

- Keep nav unique and active `工作台`.
- Replace stats with:

```ts
export const institutionStats: InstitutionStatItem[] = [
  { label: '累计客户资产', value: '5,143', change: '↗ 本周 +12%', tone: 'blue', icon: Users },
  { label: '今日待承接', value: '18', change: 'AI 已排序', tone: 'violet', icon: BriefcaseBusiness },
  { label: '预约转化率', value: '32%', change: '↗ +7.6%', tone: 'emerald', icon: CalendarCheck },
  { label: '复购窗口客户', value: '42', change: '建议人工跟进', tone: 'amber', icon: Clock3 },
];
```

- Replace suggestions with three items:

```ts
export const institutionSuggestions = [
  { type: '复购', title: '优先跟进术后 D21-D30 客户', description: '18 位客户近期咨询修复补水，建议由资深咨询师承接。', action: '查看客户' },
  { type: '转化', title: '沉默高意向客户激活', description: '7 位客户超过 48 小时未回复，AI 已生成提醒话术。', action: '生成话术' },
  { type: '服务', title: '异常反馈转人工', description: '3 位术后客户出现敏感词，建议客服优先回访。', action: '分配客服' },
] as const;
```

- Add journey lanes:

```ts
export const institutionJourneyLanes = [
  { title: '新客咨询', items: [{ title: '玻尿酸咨询', detail: '高预算 · 需人工', hot: true }, { title: '水光项目禁忌', detail: 'AI 已提示注意事项' }] },
  { title: '预约到院', items: [{ title: '明日到院提醒', detail: '12 位待确认' }, { title: '高意向客户改约', detail: '需协调专家档期', hot: true }] },
  { title: '术后关怀', items: [{ title: 'D3 红肿反馈', detail: 'AI 已记录恢复情况' }, { title: '异常症状转人工', detail: '3 位客户需回访', hot: true }] },
  { title: '复购召回', items: [{ title: '补水修复窗口', detail: '18 位客户进入窗口', hot: true }, { title: '会员生日关怀', detail: '本周 9 位' }] },
] as const;
```

- Add action queue:

```ts
export const institutionActionQueue = [
  { name: '王女士', title: '热玛吉复购窗口', detail: '术后第 28 天 · 最近咨询补水', score: 98 },
  { name: '陈女士', title: '价格异议待承接', detail: '高预算 · 已浏览案例页 3 次', score: 91 },
  { name: '刘女士', title: '明日到院确认', detail: '需同步术前注意事项', score: 87 },
  { name: '赵女士', title: '术后异常反馈', detail: 'D3 红肿描述 · 建议人工回访', score: 86 },
  { name: '李女士', title: '沉默客户激活', detail: '48 小时未回复 · AI 已生成话术', score: 78 },
] as const;
```

- [ ] **Step 4: Update platform domain data**

In `src/modules/workspace/domain/platform-dashboard.ts`:

- Rename `首页编辑` to `首页与品牌`.
- Rename `权限与组织` to `权限与审计`.
- Use metric labels `入驻医院`、`活跃机构`、`Agent 调用`、`服务用户`、`MRR`、`续费率`.
- Replace capability card titles with:

```ts
export const platformCapabilityCards = [
  { icon: KeyRound, title: '开放接口治理', detail: 'API Key、OAuth、Webhook 作为后续独立规划。' },
  { icon: Activity, title: '模型与智能体监控', detail: '按租户、模型、工具调用量观测成本与风险。' },
  { icon: Shield, title: '权限审计', detail: '平台操作留痕，避免越权查看机构敏感数据。' },
] as const;
```

- [ ] **Step 5: Verify domain tests pass**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
```

Expected:

```text
Test Files  1 passed
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/workspace/domain/institution-dashboard.ts src/modules/workspace/domain/platform-dashboard.ts src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
git commit -m "refactor: 更新工作台 UI 信息架构"
```

---

### Task 2: Institution Workspace UI

**Files:**

- Modify: `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- Modify: `src/modules/workspace/components/InstitutionWorkspace.tsx`

- [ ] **Step 1: Write failing entry page assertions**

In `WorkspaceEntryPages.test.tsx`, change institution assertions to:

```ts
expect(await screen.findByRole('heading', { name: /让咨询团队/ })).toBeInTheDocument();
expect(screen.getByText('先看到增长机会')).toBeInTheDocument();
expect(screen.getByText('今日高意向客户 18 位')).toBeInTheDocument();
expect(screen.getByText('累计客户资产')).toBeInTheDocument();
expect(screen.getByText('客户旅程看板')).toBeInTheDocument();
expect(screen.getByText('今日行动队列')).toBeInTheDocument();
```

- [ ] **Step 2: Run focused entry test and verify RED**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

Expected:

```text
FAIL ... unable to find 先看到增长机会 / 今日行动队列
```

- [ ] **Step 3: Implement institution UI**

Rewrite `InstitutionWorkspace.tsx` around the confirmed visual direction:

- Root background uses `/homepage/zmtg-luxury-clinic-bg.png`.
- Sidebar uses dark grid style.
- Main title uses `让咨询团队` and gradient `先看到增长机会`.
- Metric cards consume `institutionStats`.
- AI recommendation cards consume `institutionSuggestions`.
- Journey board consumes `institutionJourneyLanes`.
- Action queue consumes `institutionActionQueue`.
- Keep `LogoutButton redirectTo="/login"` unchanged.

- [ ] **Step 4: Verify institution entry test passes**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

Expected:

```text
Test Files  1 passed
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/workspace/components/InstitutionWorkspace.tsx src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
git commit -m "feat: 重设计机构端增长工作台"
```

---

### Task 3: Platform Console UI

**Files:**

- Modify: `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
- Modify: `src/modules/workspace/components/PlatformConsole.tsx`

- [ ] **Step 1: Write failing platform entry assertions**

In `WorkspaceEntryPages.test.tsx`, change platform assertions to:

```ts
expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
expect(screen.getByText('让平台运营可观测')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '首页与品牌' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '权限与审计' })).toBeInTheDocument();
expect(screen.getByText('平台增长与调用趋势')).toBeInTheDocument();
expect(screen.getByText('开放接口治理')).toBeInTheDocument();
```

- [ ] **Step 2: Run focused entry test and verify RED**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

Expected:

```text
FAIL ... unable to find 掌控租户、模型与接口 / 首页与品牌
```

- [ ] **Step 3: Implement platform UI**

Rewrite `PlatformConsole.tsx` around the confirmed visual direction:

- Root background uses dark grid and blue/teal glow.
- Sidebar stays dark, with governance-focused navigation.
- Main title uses `掌控租户、模型与接口` and gradient `让平台运营可观测`.
- Metrics consume `platformMetrics`.
- Trend chart title becomes `平台增长与调用趋势`.
- Health rows consume `platformHealthItems`.
- Capability cards consume `platformCapabilityCards`.
- Keep `LogoutButton redirectTo="/platform-login"` unchanged.

- [ ] **Step 4: Verify entry tests pass**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
```

Expected:

```text
Test Files  2 passed
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/workspace/components/PlatformConsole.tsx src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
git commit -m "feat: 重设计平台端运营中枢"
```

---

### Task 4: Verification, Browser QA, And PR Update

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
build: exit 0
```

- [ ] **Step 2: Browser QA**

Open in Browser:

```text
http://localhost:5010/login
http://localhost:5010/platform-login
```

Verify:

```text
institution login -> /hospital -> logout -> /login
platform login -> /open-platform -> logout -> /platform-login
desktop screenshots for /hospital and /open-platform
mobile viewport smoke check has no horizontal overflow
```

- [ ] **Step 3: Update devlog**

Append a section:

```md
## HH:mm 工作台 UI 重设计

- 分支：`codex/workspace-ui-redesign-spec`
- PR：[#4 docs: 制定机构端与平台端 UI 重设计规格](https://github.com/love1252/zmtg-clean/pull/4)
- 目标：按已确认方案重设计机构端与平台端首屏。
- 完成：
  - 机构端改为浅奢医疗增长工作台。
  - 平台端改为深色科技运营中枢。
  - 更新工作台 domain 数据和测试。
- 验证：
  - `./node_modules/.bin/eslint .`
  - `node scripts/run-vitest.mjs run`
  - `./node_modules/.bin/tsc --noEmit`
  - `node scripts/run-next.mjs build --webpack`
  - 浏览器验证两端登录/退出链路
- 风险：
  - 只改视觉和静态 demo 数据，不涉及真实数据服务。
- 下一步：
  - 根据预览反馈微调间距、密度和移动端。
```

- [ ] **Step 4: Commit, push, update PR**

Run:

```bash
git add docs/devlog/2026-05-29.md
git commit -m "docs: 记录工作台 UI 重设计"
git push origin codex/workspace-ui-redesign-spec
```

Update PR #4 body with implementation summary and verification evidence.

---

## Self-Review

- Spec coverage: 覆盖机构端浅奢增长工作台、平台端深色运营中枢、响应式基础检查和不触碰高风险模块。
- Placeholder scan: 本计划没有 `TBD`、`TODO`、空泛测试项或未定义类型。
- Type consistency: `institutionJourneyLanes`、`institutionActionQueue`、`platformCapabilityCards` 在 domain、组件和测试中使用同名导出。
