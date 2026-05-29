# Institution Business Shell Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add navigable customer, appointment, and smart follow-up shells to the institution workspace without introducing real persistence, APIs, or production authorization.

**Architecture:** Keep `/hospital` as one client-side workspace in this phase. Move demo business records into typed institution domain files, add focused shell components for each module, and let `InstitutionWorkspace` switch views through local state while retaining `DemoSessionGate`.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Tailwind CSS, Vitest, Testing Library.

---

## File Structure

- Create: `src/modules/institution/domain/customers.ts`
  - Owns typed demo customer records, segment summaries, and customer insight copy.
- Create: `src/modules/institution/domain/appointments.ts`
  - Owns typed appointment pipeline groups and operational alerts.
- Create: `src/modules/institution/domain/followups.ts`
  - Owns typed follow-up journeys, task queue, and demo message suggestions.
- Create: `src/modules/institution/components/CustomerCenterShell.tsx`
  - Renders customer segments, customer list shell, and insight panel.
- Create: `src/modules/institution/components/AppointmentCenterShell.tsx`
  - Renders appointment pipeline, appointment cards, and schedule alerts.
- Create: `src/modules/institution/components/SmartFollowUpShell.tsx`
  - Renders journey overview, follow-up tasks, and demo AI suggestions.
- Create: `src/modules/institution/tests/InstitutionBusinessDomain.test.ts`
  - Tests domain IDs, required fields, status coverage, and no sensitive identifier fields.
- Create: `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`
  - Tests each shell renders key headings and records.
- Modify: `src/modules/workspace/domain/institution-dashboard.ts`
  - Add stable `id` values to institution nav items.
- Modify: `src/modules/workspace/components/InstitutionWorkspace.tsx`
  - Add `activeView` state, active nav behavior, and render business shells.
- Modify: `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
  - Update nav assertions for IDs and default dashboard item.
- Modify: `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`
  - Add click-through tests for Customer Center, Appointment Center, and Smart Follow-up.

## Task 1: Add Institution Business Domain Data

**Files:**
- Create: `src/modules/institution/domain/customers.ts`
- Create: `src/modules/institution/domain/appointments.ts`
- Create: `src/modules/institution/domain/followups.ts`
- Create: `src/modules/institution/tests/InstitutionBusinessDomain.test.ts`

- [ ] **Step 1: Write the domain tests first**

Create `src/modules/institution/tests/InstitutionBusinessDomain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  customerInsightItems,
  customerSegments,
  demoCustomers,
} from '@/modules/institution/domain/customers';
import {
  appointmentAlerts,
  appointmentPipelineGroups,
} from '@/modules/institution/domain/appointments';
import {
  followUpJourneys,
  followUpTasks,
} from '@/modules/institution/domain/followups';

describe('institution business domain', () => {
  it('defines customer records with operational next actions', () => {
    expect(demoCustomers.length).toBeGreaterThanOrEqual(5);

    for (const customer of demoCustomers) {
      expect(customer.id).toMatch(/^cust_/);
      expect(customer.name).toMatch(/女士$/);
      expect(customer.lifecycle).toBeTruthy();
      expect(customer.priority).toMatch(/高|中|观察/);
      expect(customer.owner).toBeTruthy();
      expect(customer.nextAction).toBeTruthy();
      expect(customer).not.toHaveProperty('phone');
      expect(customer).not.toHaveProperty('idNumber');
      expect(customer).not.toHaveProperty('medicalRecordNo');
    }
  });

  it('defines customer segment and insight summaries', () => {
    expect(customerSegments.map((item) => item.label)).toEqual([
      '高意向待承接',
      '术后关怀中',
      '复购窗口期',
      '沉默待激活',
    ]);
    expect(customerInsightItems.length).toBeGreaterThanOrEqual(3);
  });

  it('covers the expected appointment pipeline statuses', () => {
    expect(appointmentPipelineGroups.map((group) => group.status)).toEqual([
      '待确认',
      '已确认',
      '已到院',
      '改约跟进',
    ]);
    expect(appointmentAlerts.length).toBeGreaterThanOrEqual(2);
  });

  it('defines follow-up journeys and due tasks', () => {
    expect(followUpJourneys.map((journey) => journey.name)).toContain('术后 D0-D30 关怀');
    expect(followUpTasks.length).toBeGreaterThanOrEqual(4);

    for (const task of followUpTasks) {
      expect(task.customerName).toMatch(/女士$/);
      expect(task.stage).toBeTruthy();
      expect(task.dueLabel).toBeTruthy();
      expect(task.suggestedAction).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessDomain.test.ts
```

Expected:

```text
FAIL ... Cannot find module '@/modules/institution/domain/customers'
```

- [ ] **Step 3: Create customer domain data**

Create `src/modules/institution/domain/customers.ts`:

```ts
export type CustomerPriority = '高优先级' | '中优先级' | '观察';

export type CustomerSummary = {
  id: string;
  name: string;
  lifecycle: string;
  priority: CustomerPriority;
  owner: string;
  projectInterest: string;
  lastTouch: string;
  nextAction: string;
  tags: string[];
};

export type CustomerSegment = {
  label: string;
  value: string;
  trend: string;
  tone: 'blue' | 'emerald' | 'amber' | 'rose';
};

export type CustomerInsightItem = {
  title: string;
  description: string;
};

export const customerSegments: CustomerSegment[] = [
  { label: '高意向待承接', value: '18', trend: 'AI 已排序', tone: 'blue' },
  { label: '术后关怀中', value: '126', trend: '7 位需人工', tone: 'emerald' },
  { label: '复购窗口期', value: '42', trend: '本周 +9', tone: 'amber' },
  { label: '沉默待激活', value: '73', trend: '话术已生成', tone: 'rose' },
];

export const demoCustomers: CustomerSummary[] = [
  {
    id: 'cust_wang_repurchase',
    name: '王女士',
    lifecycle: '复购窗口期',
    priority: '高优先级',
    owner: '林咨询',
    projectInterest: '热玛吉修复组合',
    lastTouch: '术后第 28 天',
    nextAction: '安排资深咨询师人工回访',
    tags: ['高价值', '近期咨询补水', '适合人工承接'],
  },
  {
    id: 'cust_chen_conversion',
    name: '陈女士',
    lifecycle: '咨询转化',
    priority: '高优先级',
    owner: '周咨询',
    projectInterest: '玻尿酸联合方案',
    lastTouch: '浏览案例页 3 次',
    nextAction: '发送案例对比与价格解释',
    tags: ['预算明确', '价格异议', '需跟进'],
  },
  {
    id: 'cust_liu_arrival',
    name: '刘女士',
    lifecycle: '预约到院',
    priority: '中优先级',
    owner: '许咨询',
    projectInterest: '水光补水',
    lastTouch: '明日 10:30 到院',
    nextAction: '同步术前注意事项',
    tags: ['已预约', '待确认', '新客'],
  },
  {
    id: 'cust_zhao_care',
    name: '赵女士',
    lifecycle: '术后关怀',
    priority: '高优先级',
    owner: '客服 A 组',
    projectInterest: '光电修复',
    lastTouch: 'D3 红肿反馈',
    nextAction: '转人工回访并记录恢复情况',
    tags: ['敏感词', '需安抚', '术后 D3'],
  },
  {
    id: 'cust_li_silent',
    name: '李女士',
    lifecycle: '沉默激活',
    priority: '观察',
    owner: 'AI 助手',
    projectInterest: '面部年轻化',
    lastTouch: '48 小时未回复',
    nextAction: '发送轻量唤醒话术',
    tags: ['沉默', '可自动触达', '低风险'],
  },
];

export const customerInsightItems: CustomerInsightItem[] = [
  {
    title: '客户分层来自 demo 规则',
    description: '当前仅用于演示优先级，不代表真实客户画像或医疗判断。',
  },
  {
    title: '高优先级客户建议人工承接',
    description: '复购窗口、价格异议、术后异常反馈会进入人工待办。',
  },
  {
    title: '禁止在静态数据中加入敏感标识',
    description: '本阶段不展示手机号、身份证、病历号或真实机构客户资料。',
  },
];
```

- [ ] **Step 4: Create appointment domain data**

Create `src/modules/institution/domain/appointments.ts`:

```ts
export type AppointmentSummary = {
  id: string;
  customerName: string;
  project: string;
  time: string;
  consultant: string;
  note: string;
};

export type AppointmentPipelineGroup = {
  status: '待确认' | '已确认' | '已到院' | '改约跟进';
  count: number;
  items: AppointmentSummary[];
};

export type AppointmentAlert = {
  title: string;
  description: string;
  tone: 'amber' | 'rose' | 'blue';
};

export const appointmentPipelineGroups: AppointmentPipelineGroup[] = [
  {
    status: '待确认',
    count: 12,
    items: [
      { id: 'appt_pending_1', customerName: '刘女士', project: '水光补水', time: '明日 10:30', consultant: '许咨询', note: '待同步术前注意事项' },
      { id: 'appt_pending_2', customerName: '韩女士', project: '皮肤检测', time: '明日 14:00', consultant: '林咨询', note: '新客首次到院' },
    ],
  },
  {
    status: '已确认',
    count: 21,
    items: [
      { id: 'appt_confirmed_1', customerName: '周女士', project: '面部抗衰方案', time: '今日 15:30', consultant: '周咨询', note: '专家档期已锁定' },
    ],
  },
  {
    status: '已到院',
    count: 8,
    items: [
      { id: 'appt_arrived_1', customerName: '秦女士', project: '玻尿酸复诊', time: '今日 11:20', consultant: '前台 A 组', note: '等待治疗记录回填' },
    ],
  },
  {
    status: '改约跟进',
    count: 5,
    items: [
      { id: 'appt_reschedule_1', customerName: '唐女士', project: '热玛吉面诊', time: '原定今日 16:00', consultant: '林咨询', note: '需协调专家下周档期' },
    ],
  },
];

export const appointmentAlerts: AppointmentAlert[] = [
  {
    title: '3 位客户存在爽约风险',
    description: '超过 24 小时未确认到院，建议咨询师优先电话确认。',
    tone: 'amber',
  },
  {
    title: '1 个专家档期冲突',
    description: '热玛吉面诊与复诊时间重叠，建议先处理高价值复购客户。',
    tone: 'rose',
  },
  {
    title: '今日到院转化可追踪',
    description: '已到院客户等待治疗记录回填，后续可触发术后关怀旅程。',
    tone: 'blue',
  },
];
```

- [ ] **Step 5: Create follow-up domain data**

Create `src/modules/institution/domain/followups.ts`:

```ts
export type FollowUpJourneySummary = {
  id: string;
  name: string;
  stageCount: number;
  activeCustomers: number;
  conversionHint: string;
};

export type FollowUpTask = {
  id: string;
  customerName: string;
  stage: string;
  dueLabel: string;
  suggestedAction: string;
  riskLevel: '普通' | '关注' | '优先';
};

export type FollowUpMessageSuggestion = {
  title: string;
  content: string;
};

export const followUpJourneys: FollowUpJourneySummary[] = [
  { id: 'journey_post_care', name: '术后 D0-D30 关怀', stageCount: 6, activeCustomers: 126, conversionHint: '异常反馈优先转人工' },
  { id: 'journey_repurchase', name: '复购窗口召回', stageCount: 4, activeCustomers: 42, conversionHint: '补水修复类项目响应更高' },
  { id: 'journey_silent', name: '沉默客户唤醒', stageCount: 3, activeCustomers: 73, conversionHint: '轻量内容优先，避免过度打扰' },
];

export const followUpTasks: FollowUpTask[] = [
  { id: 'task_wang_d28', customerName: '王女士', stage: 'D28 复购建议', dueLabel: '今天 18:00 前', suggestedAction: '人工回访并推荐修复组合', riskLevel: '优先' },
  { id: 'task_zhao_d3', customerName: '赵女士', stage: 'D3 异常反馈', dueLabel: '30 分钟内', suggestedAction: '客服回访并记录恢复情况', riskLevel: '优先' },
  { id: 'task_li_silent', customerName: '李女士', stage: '48h 沉默唤醒', dueLabel: '今天', suggestedAction: '发送轻量唤醒话术', riskLevel: '普通' },
  { id: 'task_han_new', customerName: '韩女士', stage: '首次到院前提醒', dueLabel: '明早 09:30', suggestedAction: '发送到院路线与注意事项', riskLevel: '关注' },
];

export const followUpMessageSuggestions: FollowUpMessageSuggestion[] = [
  {
    title: '术后关怀提醒',
    content: '这是 demo 话术：请根据客户真实恢复情况由专业人员确认后再发送。',
  },
  {
    title: '复购窗口提醒',
    content: '这是 demo 话术：可邀请客户预约复查，不承诺具体医疗效果。',
  },
  {
    title: '沉默客户唤醒',
    content: '这是 demo 话术：保持低频、轻量、可退出的沟通方式。',
  },
];
```

- [ ] **Step 6: Run the domain test and confirm it passes**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessDomain.test.ts
```

Expected:

```text
PASS src/modules/institution/tests/InstitutionBusinessDomain.test.ts
```

## Task 2: Add Business Shell Components

**Files:**
- Create: `src/modules/institution/components/CustomerCenterShell.tsx`
- Create: `src/modules/institution/components/AppointmentCenterShell.tsx`
- Create: `src/modules/institution/components/SmartFollowUpShell.tsx`
- Create: `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`

- [ ] **Step 1: Write shell render tests first**

Create `src/modules/institution/tests/InstitutionBusinessShells.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppointmentCenterShell } from '@/modules/institution/components/AppointmentCenterShell';
import { CustomerCenterShell } from '@/modules/institution/components/CustomerCenterShell';
import { SmartFollowUpShell } from '@/modules/institution/components/SmartFollowUpShell';

describe('institution business shells', () => {
  it('renders the customer center shell', () => {
    render(<CustomerCenterShell />);

    expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
    expect(screen.getByText('高意向待承接')).toBeInTheDocument();
    expect(screen.getByText('王女士')).toBeInTheDocument();
    expect(screen.getByText('客户分层来自 demo 规则')).toBeInTheDocument();
  });

  it('renders the appointment center shell', () => {
    render(<AppointmentCenterShell />);

    expect(screen.getByRole('heading', { name: '预约中心' })).toBeInTheDocument();
    expect(screen.getByText('待确认')).toBeInTheDocument();
    expect(screen.getByText('明日 10:30')).toBeInTheDocument();
    expect(screen.getByText('3 位客户存在爽约风险')).toBeInTheDocument();
  });

  it('renders the smart follow-up shell', () => {
    render(<SmartFollowUpShell />);

    expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
    expect(screen.getByText('术后 D0-D30 关怀')).toBeInTheDocument();
    expect(screen.getByText('D3 异常反馈')).toBeInTheDocument();
    expect(screen.getByText('这是 demo 话术：请根据客户真实恢复情况由专业人员确认后再发送。')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the shell tests and confirm they fail**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx
```

Expected:

```text
FAIL ... Cannot find module '@/modules/institution/components/CustomerCenterShell'
```

- [ ] **Step 3: Create `CustomerCenterShell`**

Create `src/modules/institution/components/CustomerCenterShell.tsx`:

```tsx
import { ArrowRight, Search, ShieldCheck, Tags } from 'lucide-react';
import {
  customerInsightItems,
  customerSegments,
  demoCustomers,
} from '@/modules/institution/domain/customers';
import { cn } from '@/shared/utils/cn';

const segmentToneClasses = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function CustomerCenterShell() {
  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Customer Operations</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">客户中心</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              用 demo 客户资产展示分层、优先级、负责人和下一步动作，真实客户数据将在后续数据库与权限阶段接入。
            </p>
          </div>
          <label className="relative block w-full lg:w-[320px]" aria-label="客户搜索">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-400"
              placeholder="搜索客户、标签或负责人"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {customerSegments.map((segment) => (
          <article key={segment.label} className="rounded-[22px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
            <div className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', segmentToneClasses[segment.tone])}>
              {segment.trend}
            </div>
            <div className="mt-4 text-3xl font-semibold text-slate-950">{segment.value}</div>
            <div className="mt-1 text-sm font-medium text-slate-500">{segment.label}</div>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-950">客户优先级队列</h3>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">Demo records</span>
          </div>
          <div className="mt-4 space-y-3">
            {demoCustomers.map((customer) => (
              <div key={customer.id} className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-slate-950">{customer.name}</span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">{customer.priority}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{customer.lifecycle}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{customer.projectInterest} · {customer.lastTouch}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {customer.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-[220px] rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-400">下一步动作</div>
                    <div className="mt-1 text-sm font-semibold leading-6 text-slate-800">{customer.nextAction}</div>
                    <div className="mt-2 text-xs text-slate-500">负责人：{customer.owner}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="rounded-[24px] border border-slate-900/90 bg-[#071322] p-5 text-white shadow-[0_24px_80px_rgba(3,15,33,0.22)]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400/16 text-cyan-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">客户数据边界</h3>
              <p className="mt-1 text-sm text-slate-400">本阶段只展示虚构 demo 信息。</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {customerInsightItems.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Tags className="h-4 w-4 text-cyan-300" />
                  {item.title}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
          <button type="button" className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-950">
            查看客户分层规则
            <ArrowRight className="h-4 w-4" />
          </button>
        </aside>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create `AppointmentCenterShell`**

Create `src/modules/institution/components/AppointmentCenterShell.tsx`:

```tsx
import { AlertTriangle, CalendarCheck, Clock3 } from 'lucide-react';
import {
  appointmentAlerts,
  appointmentPipelineGroups,
} from '@/modules/institution/domain/appointments';

const alertToneClasses = {
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
};

export function AppointmentCenterShell() {
  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
        <p className="text-sm font-semibold text-emerald-600">Appointment Pipeline</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">预约中心</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          聚合今日预约确认、到院、改约与风险提醒。当前为 demo 预约队列，不写入真实日程。
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {appointmentPipelineGroups.map((group) => (
          <article key={group.status} className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">{group.status}</h3>
                <p className="mt-1 text-sm text-slate-500">{group.count} 个预约</p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CalendarCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {group.items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-950">{item.customerName}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{item.time}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">{item.project}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.note}</p>
                  <p className="mt-2 text-xs text-slate-400">负责人：{item.consultant}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-950">运营提醒</h3>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {appointmentAlerts.map((alert) => (
            <div key={alert.title} className={`rounded-2xl border p-4 ${alertToneClasses[alert.tone]}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4" />
                {alert.title}
              </div>
              <p className="mt-2 text-sm leading-6">{alert.description}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
```

- [ ] **Step 5: Create `SmartFollowUpShell`**

Create `src/modules/institution/components/SmartFollowUpShell.tsx`:

```tsx
import { Bot, MessageSquareText, Workflow } from 'lucide-react';
import {
  followUpJourneys,
  followUpMessageSuggestions,
  followUpTasks,
} from '@/modules/institution/domain/followups';

const riskToneClasses = {
  普通: 'bg-slate-100 text-slate-600',
  关注: 'bg-amber-50 text-amber-700',
  优先: 'bg-rose-50 text-rose-700',
};

export function SmartFollowUpShell() {
  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
        <p className="text-sm font-semibold text-violet-600">Smart Follow-up</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">智能随访</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          展示术后关怀、复购召回和沉默激活的 demo 旅程。当前不执行真实自动触达。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {followUpJourneys.map((journey) => (
          <article key={journey.id} className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-600">
              <Workflow className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-950">{journey.name}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-2xl font-semibold text-slate-950">{journey.stageCount}</div>
                <div className="text-xs text-slate-500">旅程节点</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-2xl font-semibold text-slate-950">{journey.activeCustomers}</div>
                <div className="text-xs text-slate-500">运行客户</div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{journey.conversionHint}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <article className="rounded-[24px] border border-slate-900/90 bg-[#071322] p-5 text-white shadow-[0_24px_80px_rgba(3,15,33,0.22)]">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-cyan-300" />
            <h3 className="text-lg font-semibold">今日随访任务</h3>
          </div>
          <div className="mt-4 space-y-3">
            {followUpTasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{task.customerName}</div>
                    <div className="mt-1 text-sm text-slate-400">{task.stage} · {task.dueLabel}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskToneClasses[task.riskLevel]}`}>{task.riskLevel}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{task.suggestedAction}</p>
              </div>
            ))}
          </div>
        </article>

        <aside className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <MessageSquareText className="h-5 w-5 text-violet-600" />
            <h3 className="text-lg font-semibold text-slate-950">Demo 话术建议</h3>
          </div>
          <div className="mt-4 space-y-3">
            {followUpMessageSuggestions.map((suggestion) => (
              <div key={suggestion.title} className="rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="text-sm font-semibold text-slate-950">{suggestion.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{suggestion.content}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Run shell tests**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/InstitutionBusinessShells.test.tsx
```

Expected:

```text
PASS src/modules/institution/tests/InstitutionBusinessShells.test.tsx
```

## Task 3: Wire Workspace Navigation

**Files:**
- Modify: `src/modules/workspace/domain/institution-dashboard.ts`
- Modify: `src/modules/workspace/components/InstitutionWorkspace.tsx`
- Modify: `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts`
- Modify: `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`

- [ ] **Step 1: Update nav domain tests first**

Modify `src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts` to include:

```ts
import { describe, expect, it } from 'vitest';
import {
  institutionNavItems,
  institutionStats,
} from '@/modules/workspace/domain/institution-dashboard';

describe('institution dashboard domain', () => {
  it('defines stable institution navigation ids with dashboard as the default', () => {
    expect(institutionNavItems.map((item) => item.id)).toEqual([
      'dashboard',
      'customers',
      'followups',
      'conversations',
      'appointments',
      'knowledge',
      'analytics',
    ]);
    expect(institutionNavItems.filter((item) => item.active)).toHaveLength(1);
    expect(institutionNavItems.find((item) => item.active)?.id).toBe('dashboard');
  });

  it('keeps institution stats focused on growth operations', () => {
    expect(institutionStats.map((stat) => stat.label)).toEqual([
      '累计客户资产',
      '今日待承接',
      '预约转化率',
      '复购窗口客户',
    ]);
  });
});
```

If this file already contains related assertions, merge the new expectations rather than duplicating imports.

- [ ] **Step 2: Run the domain test and confirm it fails**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
```

Expected:

```text
FAIL ... Property 'id' does not exist
```

- [ ] **Step 3: Add stable nav ids**

Modify `src/modules/workspace/domain/institution-dashboard.ts`:

```ts
export type InstitutionViewId =
  | 'dashboard'
  | 'customers'
  | 'followups'
  | 'conversations'
  | 'appointments'
  | 'knowledge'
  | 'analytics';

export type InstitutionNavItem = {
  id: InstitutionViewId;
  label: string;
  icon: LucideIcon;
  active?: boolean;
};

export const institutionNavItems: InstitutionNavItem[] = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard, active: true },
  { id: 'customers', label: '客户中心', icon: Users },
  { id: 'followups', label: '智能随访', icon: Workflow },
  { id: 'conversations', label: '客服工作台', icon: MessageCircle },
  { id: 'appointments', label: '预约中心', icon: CalendarCheck },
  { id: 'knowledge', label: '知识库', icon: BookOpen },
  { id: 'analytics', label: '数据分析', icon: BarChart3 },
];
```

Keep the existing imports and other exports unchanged.

- [ ] **Step 4: Update workspace entry tests for click-through behavior**

Modify the institution test in `src/modules/workspace/tests/WorkspaceEntryPages.test.tsx`:

```tsx
import userEvent from '@testing-library/user-event';
```

Update the institution test body to include:

```tsx
const user = userEvent.setup();

expect(screen.getByText('客户旅程看板')).toBeInTheDocument();

await user.click(screen.getByRole('button', { name: '客户中心' }));
expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
expect(screen.getByText('客户优先级队列')).toBeInTheDocument();

await user.click(screen.getByRole('button', { name: '预约中心' }));
expect(screen.getByRole('heading', { name: '预约中心' })).toBeInTheDocument();
expect(screen.getByText('预约中心')).toBeInTheDocument();
expect(screen.getByText('运营提醒')).toBeInTheDocument();

await user.click(screen.getByRole('button', { name: '智能随访' }));
expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
expect(screen.getByText('今日随访任务')).toBeInTheDocument();
```

If duplicate visible text causes ambiguous assertions, scope to headings with `getByRole`.

- [ ] **Step 5: Run workspace entry test and confirm it fails**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

Expected:

```text
FAIL ... unable to find heading "客户中心" after click
```

- [ ] **Step 6: Wire `InstitutionWorkspace` state**

Modify `src/modules/workspace/components/InstitutionWorkspace.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { AppointmentCenterShell } from '@/modules/institution/components/AppointmentCenterShell';
import { CustomerCenterShell } from '@/modules/institution/components/CustomerCenterShell';
import { SmartFollowUpShell } from '@/modules/institution/components/SmartFollowUpShell';
import type { InstitutionViewId } from '@/modules/workspace/domain/institution-dashboard';
```

Inside `InstitutionWorkspace`:

```tsx
const [activeView, setActiveView] = useState<InstitutionViewId>('dashboard');
const activeNavItem = institutionNavItems.find((item) => item.id === activeView) ?? institutionNavItems[0];
```

For desktop and mobile nav buttons, replace `item.active` checks with `activeView === item.id`, and add:

```tsx
onClick={() => setActiveView(item.id)}
aria-current={activeView === item.id ? 'page' : undefined}
```

Wrap the existing dashboard-only content after the mobile nav into:

```tsx
{activeView === 'dashboard' ? (
  <DashboardView />
) : activeView === 'customers' ? (
  <CustomerCenterShell />
) : activeView === 'appointments' ? (
  <AppointmentCenterShell />
) : activeView === 'followups' ? (
  <SmartFollowUpShell />
) : (
  <PlaceholderInstitutionView label={activeNavItem.label} />
)}
```

Create local helper functions at the bottom of the file:

```tsx
function PlaceholderInstitutionView({ label }: { label: string }) {
  return (
    <section className="rounded-[24px] border border-white/80 bg-white/78 p-6 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
      <p className="text-sm font-semibold text-slate-500">Module placeholder</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{label}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
        该模块会在后续阶段接入真实业务壳。本阶段优先完成客户中心、预约中心和智能随访。
      </p>
    </section>
  );
}
```

Move the existing dashboard JSX into `DashboardView`. Keep helper constants at module scope. If the move becomes hard to review, create `src/modules/workspace/components/InstitutionDashboardView.tsx` and place the dashboard JSX there.

- [ ] **Step 7: Run workspace tests**

Run:

```bash
node scripts/run-vitest.mjs run src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

Expected:

```text
PASS src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts
PASS src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

## Task 4: Full Verification and Browser Check

**Files:**
- No new source files unless tests reveal a direct issue in files touched above.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
node scripts/run-vitest.mjs run \
  src/modules/institution/tests/InstitutionBusinessDomain.test.ts \
  src/modules/institution/tests/InstitutionBusinessShells.test.tsx \
  src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts \
  src/modules/workspace/tests/WorkspaceEntryPages.test.tsx
```

Expected:

```text
PASS
```

- [ ] **Step 2: Run full verification**

Run:

```bash
./node_modules/.bin/eslint .
node scripts/run-vitest.mjs run
./node_modules/.bin/tsc --noEmit
node scripts/run-next.mjs build --webpack
```

Expected:

```text
eslint exits 0
vitest exits 0
tsc exits 0
next build exits 0
```

- [ ] **Step 3: Browser verify desktop flow**

Run dev server if needed:

```bash
node scripts/run-next.mjs dev --webpack --port 5010
```

Open:

```text
http://localhost:5010/login
```

Use:

```text
admin / admin123
```

Expected:

```text
Login redirects to /hospital.
Dashboard is visible by default.
Click 客户中心: customer center content appears.
Click 预约中心: appointment center content appears.
Click 智能随访: follow-up content appears.
Click 工作台: dashboard content returns.
```

- [ ] **Step 4: Browser verify mobile layout**

Set browser viewport to approximately:

```text
390 x 844
```

Expected:

```text
Mobile nav scrolls horizontally.
No body-level horizontal overflow.
Customer, appointment, and follow-up cards remain readable.
Logout remains accessible.
```

- [ ] **Step 5: Commit implementation**

Run:

```bash
git status -sb
git add \
  src/modules/institution \
  src/modules/workspace/domain/institution-dashboard.ts \
  src/modules/workspace/components/InstitutionWorkspace.tsx \
  src/modules/workspace/tests/WorkspaceDashboardDomain.test.ts \
  src/modules/workspace/tests/WorkspaceEntryPages.test.tsx \
  docs/superpowers/specs/2026-05-29-institution-business-shell-design.md \
  docs/superpowers/plans/2026-05-29-institution-business-shell.md
git commit -m "feat: add institution business shells"
```

Expected:

```text
Commit succeeds and working tree is clean except any known generated file that should be handled separately.
```

## Self-Review

- Spec coverage: The plan covers customer, appointment, and smart follow-up shells; demo data boundary; navigation state; tests; and browser verification.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: `InstitutionViewId`, nav IDs, shell names, and domain export names are consistent across tasks.
- Scope check: The plan does not add database, API, RBAC, production auth, real AI, Webhook, OAuth, API Key, or persistence behavior.
