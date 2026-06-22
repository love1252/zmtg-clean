# 平台端租户管理 V1.1 UI 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于已确认的租户管理 V1.1 功能路径和 9 张效果图，在平台端实现 UI-only 的租户管理工作台。

**Architecture:** 第一阶段只改平台端租户管理前端体验和纯前端派生逻辑，复用现有 `/api/open-platform/tenants` 只读数据，不新增真实创建接口，不改数据库、schema、migration 或 SQL。新增的“新建租户”流程仅作为受控界面状态和提交前确认展示，不写入真实数据。

**Tech Stack:** Next.js / React / TypeScript / Vitest / Testing Library / lucide-react / Tailwind CSS。

---

## 0. 前置条件与边界

当前设计分支仍有未提交 docs-only 设计文件。进入 runtime 前必须先完成以下任一处理：

- 将当前 docs-only 设计分支提交、推送并合并到 `main`，然后从最新 `main` 新建 runtime 分支。
- 或用户明确授权在当前分支继续追加 runtime，但这会让 docs 与 runtime 混在同一分支，不推荐。

推荐 runtime 分支：

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/platform-tenant-management-v11-ui-01
```

本计划第一阶段只允许修改：

- `src/modules/open-platform/domain/tenant-management-view.ts`
- `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
- `src/modules/open-platform/tests/OpenPlatformTenantManagementView.test.ts`
- `src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`

如确实需要修改其他文件，必须先停止说明原因。

本计划明确不做：

- 不修改 DB / schema / migration / SQL。
- 不新增真实租户创建 API。
- 不创建真实租户账号。
- 不写入套餐授权快照。
- 不新增依赖。
- 不接短信、邮件、HIS、支付、合同、发票。
- 不实现冻结、恢复、删除、重置密码、真实套餐变更。

## 1. 文件职责

### 新增：`src/modules/open-platform/domain/tenant-management-view.ts`

负责 UI-only 派生逻辑：

- 将 `TenantManagementListItem` 转换为展示状态。
- 计算租户总览指标。
- 计算授权异常、配额风险、有效期状态。
- 按关键词、状态、套餐、有效期、授权状态、配额风险筛选列表。
- 提供中文标签，避免 UI 中散落英文枚举。

### 修改：`src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`

负责租户管理 V1.1 页面体验：

- 顶部总览。
- 查询与筛选栏。
- 租户表格。
- 租户详情抽屉。
- 新建租户三步 UI。
- 提交确认与成功态。
- 授权异常提示和空状态。

### 新增：`src/modules/open-platform/tests/OpenPlatformTenantManagementView.test.ts`

覆盖纯函数：

- 总览指标。
- 授权异常。
- 配额风险。
- 即将到期。
- 搜索和筛选。

### 修改：`src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`

覆盖 UI：

- 页面正常渲染。
- 总览和筛选存在。
- 筛选能收敛列表。
- 详情抽屉能展示授权快照和审计入口。
- 新建租户三步流程只做 UI，不调用真实创建接口。
- 成功态说明生成项。
- 不展示敏感字段或误导性真实能力文案。

## 2. 实施任务

### Task 1: 建立租户管理 V1.1 纯前端派生模型

**Files:**

- Create: `src/modules/open-platform/domain/tenant-management-view.ts`
- Test: `src/modules/open-platform/tests/OpenPlatformTenantManagementView.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/modules/open-platform/tests/OpenPlatformTenantManagementView.test.ts`，覆盖总览、筛选和风险识别。

```ts
import { describe, expect, it } from 'vitest';
import type { TenantManagementListItem } from '@/modules/open-platform/domain/tenant-management';
import {
  buildTenantManagementOverview,
  filterTenantManagementRecords,
  getTenantAuthorizationState,
  getTenantExpiryState,
  getTenantQuotaRiskState,
} from '@/modules/open-platform/domain/tenant-management-view';

const baseTenant: TenantManagementListItem = {
  tenantId: 'tenant-a',
  tenantName: '星澜医美中心',
  tenantStatus: 'active',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-20T00:00:00.000Z',
  planName: '专业版',
  planCode: 'professional',
  planStatus: 'active',
  assignmentStatus: 'active',
  startedAt: '2026-06-01T00:00:00.000Z',
  expiresAt: '2026-06-29T00:00:00.000Z',
  maxCustomers: 100,
  maxAppointments: 200,
  maxFollowUps: 300,
  maxAiCalls: 1000,
  currentCustomers: 88,
  currentAppointments: 20,
  currentFollowUps: 30,
  currentAiCalls: 100,
  snapshotAt: '2026-06-20T00:00:00.000Z',
};

describe('租户管理 V1.1 视图派生', () => {
  it('计算总览指标', () => {
    const missingPlan = {
      ...baseTenant,
      tenantId: 'tenant-b',
      tenantName: '未授权机构',
      planName: null,
      planCode: null,
      planStatus: null,
      assignmentStatus: null,
      snapshotAt: null,
    };

    const overview = buildTenantManagementOverview([baseTenant, missingPlan], {
      now: '2026-06-22T00:00:00.000Z',
    });

    expect(overview.total).toBe(2);
    expect(overview.active).toBe(2);
    expect(overview.trialing).toBe(0);
    expect(overview.expiringSoon).toBe(1);
    expect(overview.authorizationIssues).toBe(1);
  });

  it('识别授权异常、配额风险和即将到期', () => {
    expect(getTenantAuthorizationState(baseTenant).status).toBe('normal');
    expect(getTenantQuotaRiskState(baseTenant).status).toBe('near_limit');
    expect(getTenantExpiryState(baseTenant, { now: '2026-06-22T00:00:00.000Z' }).status).toBe('expiring_soon');

    expect(
      getTenantAuthorizationState({
        ...baseTenant,
        planCode: null,
        snapshotAt: null,
      }).status,
    ).toBe('issue');
  });

  it('按关键词、状态、套餐、有效期、授权和配额风险筛选', () => {
    const records = [
      baseTenant,
      {
        ...baseTenant,
        tenantId: 'tenant-b',
        tenantName: '低风险机构',
        planCode: 'basic',
        planName: '基础版',
        expiresAt: '2026-12-31T00:00:00.000Z',
        currentCustomers: 10,
      },
    ];

    const filtered = filterTenantManagementRecords(records, {
      keyword: '星澜',
      tenantStatus: 'active',
      planCode: 'professional',
      expiry: 'expiring_soon',
      authorization: 'normal',
      quotaRisk: 'near_limit',
      now: '2026-06-22T00:00:00.000Z',
    });

    expect(filtered.map((record) => record.tenantId)).toEqual(['tenant-a']);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test -- OpenPlatformTenantManagementView.test.ts
```

Expected: FAIL，提示 `tenant-management-view` 模块不存在。

- [ ] **Step 3: 实现最小纯函数**

创建 `src/modules/open-platform/domain/tenant-management-view.ts`。

```ts
import type { TenantManagementListItem } from '@/modules/open-platform/domain/tenant-management';

export type TenantExpiryStatus = 'none' | 'valid' | 'expiring_soon' | 'expired';
export type TenantAuthorizationStatus = 'normal' | 'issue';
export type TenantQuotaRiskStatus = 'none' | 'normal' | 'near_limit' | 'blocked';

export type TenantManagementFilterState = {
  keyword: string;
  tenantStatus: 'all' | string;
  planCode: 'all' | string;
  expiry: 'all' | TenantExpiryStatus;
  authorization: 'all' | TenantAuthorizationStatus;
  quotaRisk: 'all' | TenantQuotaRiskStatus;
  now: Date | string;
};

export type TenantManagementOverview = {
  total: number;
  active: number;
  trialing: number;
  expiringSoon: number;
  authorizationIssues: number;
};

function toTime(value: string | null) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function daysUntil(value: string | null, now: Date | string) {
  const target = toTime(value);
  if (target === null) return null;
  const current = typeof now === 'string' ? Date.parse(now) : now.getTime();
  if (!Number.isFinite(current)) return null;
  return Math.ceil((target - current) / 86_400_000);
}

function ratio(current: number | null, max: number | null) {
  if (typeof current !== 'number' || typeof max !== 'number' || max <= 0) return null;
  return current / max;
}

export function getTenantExpiryState(
  record: TenantManagementListItem,
  options: { now: Date | string },
) {
  const days = daysUntil(record.expiresAt, options.now);
  if (days === null) return { status: 'none' as const, label: '未设置有效期' };
  if (days < 0) return { status: 'expired' as const, label: '已过期' };
  if (days <= 30) return { status: 'expiring_soon' as const, label: `${days} 天后到期` };
  return { status: 'valid' as const, label: '有效期正常' };
}

export function getTenantAuthorizationState(record: TenantManagementListItem) {
  const hasIssue =
    !record.planCode ||
    record.planStatus !== 'active' ||
    record.assignmentStatus !== 'active' ||
    !record.snapshotAt ||
    [record.maxCustomers, record.maxAppointments, record.maxFollowUps, record.maxAiCalls].some(
      (value) => value === null,
    );

  return hasIssue
    ? { status: 'issue' as const, label: '授权异常' }
    : { status: 'normal' as const, label: '授权正常' };
}

export function getTenantQuotaRiskState(record: TenantManagementListItem) {
  const ratios = [
    ratio(record.currentCustomers, record.maxCustomers),
    ratio(record.currentAppointments, record.maxAppointments),
    ratio(record.currentFollowUps, record.maxFollowUps),
    ratio(record.currentAiCalls, record.maxAiCalls),
  ].filter((value): value is number => typeof value === 'number');

  if (ratios.length === 0) return { status: 'none' as const, label: '无配额快照' };
  if (ratios.some((value) => value >= 1)) return { status: 'blocked' as const, label: '已达上限' };
  if (ratios.some((value) => value >= 0.8)) return { status: 'near_limit' as const, label: '接近上限' };
  return { status: 'normal' as const, label: '配额正常' };
}

export function buildTenantManagementOverview(
  records: TenantManagementListItem[],
  options: { now: Date | string },
): TenantManagementOverview {
  return {
    total: records.length,
    active: records.filter((record) => record.tenantStatus === 'active').length,
    trialing: records.filter((record) => record.tenantStatus === 'trialing').length,
    expiringSoon: records.filter(
      (record) => getTenantExpiryState(record, options).status === 'expiring_soon',
    ).length,
    authorizationIssues: records.filter(
      (record) => getTenantAuthorizationState(record).status === 'issue',
    ).length,
  };
}

export function filterTenantManagementRecords(
  records: TenantManagementListItem[],
  filters: TenantManagementFilterState,
) {
  const normalizedKeyword = filters.keyword.trim().toLowerCase();

  return records.filter((record) => {
    if (
      normalizedKeyword &&
      !`${record.tenantName} ${record.tenantId} ${record.planCode ?? ''}`
        .toLowerCase()
        .includes(normalizedKeyword)
    ) {
      return false;
    }

    if (filters.tenantStatus !== 'all' && record.tenantStatus !== filters.tenantStatus) return false;
    if (filters.planCode !== 'all' && record.planCode !== filters.planCode) return false;
    if (filters.expiry !== 'all' && getTenantExpiryState(record, filters).status !== filters.expiry) {
      return false;
    }
    if (
      filters.authorization !== 'all' &&
      getTenantAuthorizationState(record).status !== filters.authorization
    ) {
      return false;
    }
    if (filters.quotaRisk !== 'all' && getTenantQuotaRiskState(record).status !== filters.quotaRisk) {
      return false;
    }

    return true;
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test -- OpenPlatformTenantManagementView.test.ts
```

Expected: PASS。

### Task 2: 改造租户管理首页为 V1.1 工作台

**Files:**

- Modify: `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
- Test: `src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`

- [ ] **Step 1: 更新测试断言**

在现有 `请求平台租户 API 并展示租户、状态、套餐、配额和当前用量` 测试中补充断言：

```ts
expect(screen.getByRole('button', { name: '新建租户' })).toBeInTheDocument();
expect(screen.getByText('全部租户')).toBeInTheDocument();
expect(screen.getByText('运行中')).toBeInTheDocument();
expect(screen.getByText('试用中')).toBeInTheDocument();
expect(screen.getByText('即将到期')).toBeInTheDocument();
expect(screen.getByText('授权异常')).toBeInTheDocument();
expect(screen.getByPlaceholderText('机构名称 / 租户 ID / 编码')).toBeInTheDocument();
expect(screen.getByText('授权快照')).toBeInTheDocument();
expect(screen.getByText('配额风险')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '查看' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '审计' })).toBeInTheDocument();
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test -- OpenPlatformTenantManagementPanel.test.tsx
```

Expected: FAIL，因为当前 UI 还没有 V1.1 搜索栏、筛选栏和列表操作。

- [ ] **Step 3: 引入派生模型和 UI 状态**

在 `OpenPlatformTenantManagementPanel.tsx` 中新增导入：

```ts
import {
  buildTenantManagementOverview,
  filterTenantManagementRecords,
  getTenantAuthorizationState,
  getTenantExpiryState,
  getTenantQuotaRiskState,
  type TenantManagementFilterState,
} from '@/modules/open-platform/domain/tenant-management-view';
```

在组件内新增状态：

```ts
const [filters, setFilters] = useState<TenantManagementFilterState>({
  keyword: '',
  tenantStatus: 'all',
  planCode: 'all',
  expiry: 'all',
  authorization: 'all',
  quotaRisk: 'all',
  now: new Date(),
});
const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
const [isWizardOpen, setIsWizardOpen] = useState(false);
```

新增派生数据：

```ts
const overview = useMemo(
  () => buildTenantManagementOverview(records, { now: filters.now }),
  [records, filters.now],
);

const filteredRecords = useMemo(
  () => filterTenantManagementRecords(records, filters),
  [records, filters],
);

const selectedTenant = useMemo(
  () => records.find((record) => record.tenantId === selectedTenantId) ?? null,
  [records, selectedTenantId],
);
```

- [ ] **Step 4: 将四个旧统计卡替换为五个 V1.1 概览卡**

显示：

- 全部租户
- 运行中
- 试用中
- 即将到期
- 授权异常

其中 `授权异常` 使用更醒目的 amber/rose 状态，但保持后台系统克制风格。

- [ ] **Step 5: 增加筛选栏**

在租户列表前加入：

- 搜索框 placeholder：`机构名称 / 租户 ID / 编码`
- 状态 select：全部、运行中、试用中、冻结、过期
- 套餐 select：从 records 中提取 planCode / planName，附加“全部套餐”
- 有效期 select：全部、即将到期、已过期
- 授权状态 select：全部、授权正常、授权异常
- 配额风险 select：全部、接近上限、已达上限、无配额快照

所有 select 只改变前端筛选状态，不请求新 API。

- [ ] **Step 6: 将租户列表从卡片组改成表格优先布局**

表格列：

- 机构名称
- 租户 ID
- 状态
- 当前套餐
- 有效期
- 授权快照
- 配额风险
- 最近更新
- 操作

操作按钮：

- `查看`：设置 `selectedTenantId`
- `审计`：UI-only，可设置按钮 title 为 `跳转平台审计日志将在后续任务接入`

不提供：

- 修改套餐
- 删除租户
- 重置密码
- 冻结恢复

- [ ] **Step 7: 运行测试确认通过**

```bash
pnpm test -- OpenPlatformTenantManagementPanel.test.tsx
```

Expected: PASS。

### Task 3: 增加租户详情抽屉

**Files:**

- Modify: `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
- Test: `src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`

- [ ] **Step 1: 写详情抽屉测试**

新增测试：

```ts
it('点击查看后展示租户详情、授权快照、用量摘要和审计入口', async () => {
  mockTenantFetch([jsonResponse({ records: [tenantRecord] })]);
  render(<OpenPlatformTenantManagementPanel />);

  await screen.findByText('智美天工演示机构');
  await userEvent.click(screen.getByRole('button', { name: '查看' }));

  expect(screen.getByRole('dialog', { name: /租户详情/ })).toBeInTheDocument();
  expect(screen.getByText('基础信息')).toBeInTheDocument();
  expect(screen.getByText('当前套餐')).toBeInTheDocument();
  expect(screen.getByText('授权快照')).toBeInTheDocument();
  expect(screen.getByText('用量摘要')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '查看审计日志' })).toBeInTheDocument();
});
```

需要在测试文件顶部增加：

```ts
import userEvent from '@testing-library/user-event';
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test -- OpenPlatformTenantManagementPanel.test.tsx
```

Expected: FAIL，因为详情抽屉未实现。

- [ ] **Step 3: 实现详情抽屉**

在 `OpenPlatformTenantManagementPanel.tsx` 内新增 `TenantDetailDrawer` 子组件。内容包含：

- 基础信息
- 当前套餐
- 授权快照
- 用量摘要
- 风险提示
- `查看审计日志` 按钮
- `关闭` 按钮

按钮均为 UI-only，不触发真实路由跳转。

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test -- OpenPlatformTenantManagementPanel.test.tsx
```

Expected: PASS。

### Task 4: 增加 UI-only 新建租户三步流程

**Files:**

- Modify: `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
- Test: `src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`

- [ ] **Step 1: 写新建流程测试**

新增测试：

```ts
it('新建租户流程只展示 UI 状态，不调用真实创建接口', async () => {
  const fetchMock = mockTenantFetch([jsonResponse({ records: [tenantRecord] })]);
  render(<OpenPlatformTenantManagementPanel />);

  await screen.findByText('智美天工演示机构');
  await userEvent.click(screen.getByRole('button', { name: '新建租户' }));

  expect(screen.getByRole('dialog', { name: /新建租户/ })).toBeInTheDocument();
  expect(screen.getByText('机构与管理员')).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText('机构名称'), '星澜测试机构');
  await userEvent.type(screen.getByLabelText('管理员姓名'), '测试管理员');
  await userEvent.click(screen.getByRole('button', { name: '下一步' }));

  expect(screen.getByText('套餐与权益')).toBeInTheDocument();
  expect(screen.getByText('套餐控制租户能力，角色控制人员动作。')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '下一步' }));

  expect(screen.getByText('提交确认')).toBeInTheDocument();
  expect(screen.getByText('审计摘要')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '确认开设租户' }));

  expect(screen.getByText('租户已创建')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalledWith('/api/open-platform/tenants', expect.objectContaining({ method: 'POST' }));
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test -- OpenPlatformTenantManagementPanel.test.tsx
```

Expected: FAIL，因为新建流程不存在。

- [ ] **Step 3: 实现 wizard 状态**

在组件内新增状态：

```ts
type CreateTenantStep = 1 | 2 | 3 | 'success';

const [createStep, setCreateStep] = useState<CreateTenantStep>(1);
const [tenantDraft, setTenantDraft] = useState({
  institutionName: '',
  institutionShortName: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  adminName: '',
  adminCredential: '',
  planCode: 'professional',
});
```

实现 `CreateTenantWizard` 子组件：

- Step 1：机构与管理员
- Step 2：套餐与权益
- Step 3：提交确认
- Success：租户已创建

所有提交只切换本地状态，不调用 API。

- [ ] **Step 4: 禁用无效提交**

Step 1 的 `下一步` 在以下条件满足前禁用：

- `institutionName` 非空
- `adminName` 非空
- `adminCredential` 非空

禁用提示文案：

```text
请先填写机构名称和初始管理员。
```

- [ ] **Step 5: 运行测试确认通过**

```bash
pnpm test -- OpenPlatformTenantManagementPanel.test.tsx
```

Expected: PASS。

### Task 5: 补齐授权异常、空状态和安全文案

**Files:**

- Modify: `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
- Test: `src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`

- [ ] **Step 1: 更新空状态测试**

将 empty 测试断言更新为：

```ts
expect(await screen.findByText('暂无租户')).toBeInTheDocument();
expect(screen.getByText('请通过平台管理端开设第一个测试租户')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '新建租户' })).toBeInTheDocument();
expect(screen.getByText(/不支持公开注册、真实计费或外部通知/)).toBeInTheDocument();
```

- [ ] **Step 2: 增加授权异常测试**

新增测试：

```ts
it('授权异常租户展示异常原因但不开放高风险操作', async () => {
  mockTenantFetch([
    jsonResponse({
      records: [
        {
          ...tenantRecord,
          planCode: null,
          planName: null,
          planStatus: null,
          assignmentStatus: null,
          snapshotAt: null,
        },
      ],
    }),
  ]);

  render(<OpenPlatformTenantManagementPanel />);

  expect(await screen.findByText('授权异常')).toBeInTheDocument();
  expect(screen.getByText('套餐缺失')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '删除租户' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '重置密码' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '修改套餐' })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: 实现异常原因文案**

在 UI 中根据 `getTenantAuthorizationState` 展示：

- `套餐缺失`
- `快照缺失`
- `配额缺失`
- `套餐未启用`
- `分配未启用`

只展示原因和审计入口，不提供修复按钮。

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test -- OpenPlatformTenantManagementPanel.test.tsx
```

Expected: PASS。

### Task 6: 视觉收尾与响应式检查

**Files:**

- Modify: `src/modules/open-platform/components/OpenPlatformTenantManagementPanel.tsx`
- Test: `src/modules/open-platform/tests/OpenPlatformTenantManagementPanel.test.tsx`

- [ ] **Step 1: 桌面布局检查**

确认页面结构顺序：

```text
PlatformSectionBanner
概览指标
筛选区
租户列表
商业化健康辅助区
详情抽屉 / 新建租户弹层
```

如果商业化健康摘要导致页面过长，将其移动到列表后方，作为“运营辅助”折叠区或次级区块。

- [ ] **Step 2: 窄屏布局检查**

确认：

- 概览卡在移动端单列或两列。
- 筛选控件纵向排列。
- 表格在窄屏可横向滚动，不挤压文字。
- 抽屉在窄屏变成全屏弹层。
- 新建租户 wizard 每步单列展示。

- [ ] **Step 3: 敏感信息和误导性能力扫描**

运行测试后，确认页面不出现：

```text
明文密码
完整手机号
完整邮箱
真实支付
合同已完成
发票已完成
自动触达
真实计费
删除租户
重置密码
```

- [ ] **Step 4: 运行面板测试**

```bash
pnpm test -- OpenPlatformTenantManagementPanel.test.tsx
```

Expected: PASS。

## 3. 验证命令

完成所有任务后执行：

```bash
pnpm test -- OpenPlatformTenantManagementView.test.ts
pnpm test -- OpenPlatformTenantManagementPanel.test.tsx
pnpm test
pnpm lint
pnpm build
```

预期：

- 所有测试通过。
- lint 通过；如出现既有 `<img>` warning，记录但不在本任务修复。
- build 通过。

## 4. PR 说明要求

如果用户授权提交、推送和 PR，PR body 必须说明：

1. 本次只实现平台端租户管理 V1.1 UI-only。
2. 实现了总览、筛选列表、详情抽屉、新建三步流程、成功态、授权异常和空状态。
3. 未修改 DB / schema / migration / SQL。
4. 未新增真实创建租户 API。
5. 未创建真实租户账号。
6. 未写入套餐授权快照。
7. 未新增依赖。
8. 已执行 `pnpm test` / `pnpm lint` / `pnpm build`。
9. 后续需单独任务实现真实租户开设、账号创建、授权快照持久化和服务端权限校验。

## 5. 后续拆分建议

本 UI-only PR 合并后，后续按以下独立任务推进：

1. **Domain-only 套餐授权契约**：定义套餐权益、授权快照和覆盖项纯函数，不改 DB。
2. **Schema / migration 设计与审批**：单独审批最小表结构。
3. **真实租户开设 API**：创建租户、初始管理员、套餐分配和审计。
4. **授权快照持久化**：生成、读取和展示真实快照。
5. **配额 enforcement**：在客户、知识库、AI 调用等关键动作接入服务端配额校验。

## 6. 自检

- 规格覆盖：覆盖了租户总览、查询列表、详情抽屉、新建三步、成功态、授权异常和空状态。
- 范围控制：第一阶段只做 UI-only，不改真实数据链路。
- 风险控制：高风险操作仅展示为后续任务，不提供真实按钮能力。
- 文件数量：runtime 预计 2 个核心文件 + 2 个测试文件，符合小范围 PR。
