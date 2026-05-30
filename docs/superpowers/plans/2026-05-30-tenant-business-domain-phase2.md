# 租户业务领域模型第二阶段实施计划

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**目标：** 建立客户资料、预约、随访任务和审计事件的服务端领域模型，让后续真实数据库和 API route 能复用第一阶段租户权限底座。

**架构方案：** 本阶段只新增 TypeScript 领域模型、纯函数和测试，不接数据库、不新增 API route、不引入依赖。客户、预约、随访读取函数都接收 `AccessContext` 并调用 `canAccessResource`，审计事件模型记录允许、拒绝和状态流转结果。

**技术栈：** Next.js App Router、TypeScript、Vitest、ESLint、现有 `AccessContext` / `canAccessResource`。

---

## 文件结构

新增文件：

- `src/modules/institution/domain/customer-records.ts`
  - 定义租户客户记录、脱敏摘要、读取结果和 `listCustomerRecordsForAccess`。
- `src/modules/institution/domain/appointment-records.ts`
  - 定义租户预约记录、预约状态、读取结果和 `listAppointmentRecordsForAccess`。
- `src/modules/institution/domain/followup-workflow.ts`
  - 定义随访任务、状态机、读取函数和 `transitionFollowUpTask`。
- `src/modules/audit/domain/audit-events.ts`
  - 定义审计事件字段、结果码和事件创建函数。
- `src/modules/institution/tests/TenantBusinessDomain.test.ts`
  - 覆盖客户、预约、随访的租户过滤、跨租户拒绝、敏感字段和状态机。
- `src/modules/audit/tests/AuditEventsDomain.test.ts`
  - 覆盖审计事件字段完整性、拒绝原因和敏感词防护。

修改文件：

- `docs/security/tenant-rbac-phase1.md`
  - 增加第二阶段说明：当前仍是领域模型阶段，不落库、不新增 API、不接真实凭证。

不修改文件：

- `src/app/api/**`
- `.env*`
- `package.json`
- `next.config.ts`

## 任务 1：新增客户资料租户领域模型

**涉及文件：**

- 新建：`src/modules/institution/domain/customer-records.ts`
- 新建测试：`src/modules/institution/tests/TenantBusinessDomain.test.ts`

- [ ] **步骤 1：编写失败测试**

创建 `src/modules/institution/tests/TenantBusinessDomain.test.ts`，先写客户资料相关测试：

```ts
import { describe, expect, it } from 'vitest';
import {
  demoTenantCustomerRecords,
  listCustomerRecordsForAccess,
} from '@/modules/institution/domain/customer-records';
import type { AccessContext } from '@/modules/security/domain/access-control';

const tenantAdminContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const platformAdminContext: AccessContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

describe('租户业务领域模型', () => {
  it('机构管理员只能读取本租户客户摘要', () => {
    const result = listCustomerRecordsForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-001',
      records: demoTenantCustomerRecords,
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) throw new Error(result.reason);

    expect(result.records.map((record) => record.id)).toEqual([
      'cust_wang_repurchase',
      'cust_chen_conversion',
      'cust_zhao_care',
    ]);
    expect(result.records.every((record) => record.tenantId === 'demo-tenant-001')).toBe(true);
    expect(JSON.stringify(result.records)).not.toMatch(/phoneNumber|idNumber|medicalRecordNo/);
  });

  it('机构管理员跨租户读取客户时被拒绝且不返回记录', () => {
    const result = listCustomerRecordsForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-002',
      records: demoTenantCustomerRecords,
    });

    expect(result).toEqual({ allowed: false, reason: 'cross_tenant_denied' });
  });

  it('平台管理员默认不能读取客户明细', () => {
    const result = listCustomerRecordsForAccess({
      context: platformAdminContext,
      targetTenantId: 'demo-tenant-001',
      records: demoTenantCustomerRecords,
    });

    expect(result).toEqual({ allowed: false, reason: 'role_denied' });
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessDomain.test.ts
```

预期：失败，原因是 `@/modules/institution/domain/customer-records` 尚不存在。

- [ ] **步骤 3：编写最小实现**

创建 `src/modules/institution/domain/customer-records.ts`：

```ts
import type { AccessContext, AccessDecision } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';

export type TenantBusinessDeniedReason = Extract<AccessDecision, { allowed: false }>['reason'];

export type TenantBusinessResult<T> =
  | { allowed: true; records: T[] }
  | { allowed: false; reason: TenantBusinessDeniedReason };

export type CustomerLifecycleStage =
  | 'consulting'
  | 'scheduled'
  | 'post_care'
  | 'repurchase_window'
  | 'silent_reactivation';

export type CustomerPriority = 'high' | 'medium' | 'observe';

export type TenantCustomerRecord = {
  id: string;
  tenantId: string;
  displayName: string;
  lifecycle: CustomerLifecycleStage;
  priority: CustomerPriority;
  ownerUserId: string;
  projectInterest: string;
  maskedPhone: string;
  maskedMedicalRecordNo: string;
  lastTouchSummary: string;
  nextAction: string;
  tags: string[];
};

export type CustomerRecordSummary = {
  id: string;
  tenantId: string;
  displayName: string;
  lifecycle: CustomerLifecycleStage;
  priority: CustomerPriority;
  ownerUserId: string;
  projectInterest: string;
  maskedPhone: string;
  maskedMedicalRecordNo: string;
  lastTouchSummary: string;
  nextAction: string;
  tags: string[];
};

export const demoTenantCustomerRecords: TenantCustomerRecord[] = [
  {
    id: 'cust_wang_repurchase',
    tenantId: 'demo-tenant-001',
    displayName: '王女士',
    lifecycle: 'repurchase_window',
    priority: 'high',
    ownerUserId: 'consultant-lin',
    projectInterest: '热玛吉修复组合',
    maskedPhone: '138****1208',
    maskedMedicalRecordNo: 'MR****001',
    lastTouchSummary: '术后第 28 天',
    nextAction: '安排资深咨询师人工回访',
    tags: ['高价值', '近期咨询补水', '适合人工承接'],
  },
  {
    id: 'cust_chen_conversion',
    tenantId: 'demo-tenant-001',
    displayName: '陈女士',
    lifecycle: 'consulting',
    priority: 'high',
    ownerUserId: 'consultant-zhou',
    projectInterest: '玻尿酸联合方案',
    maskedPhone: '139****2609',
    maskedMedicalRecordNo: 'MR****002',
    lastTouchSummary: '浏览案例页 3 次',
    nextAction: '发送案例对比与价格解释',
    tags: ['预算明确', '价格异议', '需跟进'],
  },
  {
    id: 'cust_zhao_care',
    tenantId: 'demo-tenant-001',
    displayName: '赵女士',
    lifecycle: 'post_care',
    priority: 'high',
    ownerUserId: 'service-group-a',
    projectInterest: '光电修复',
    maskedPhone: '137****8842',
    maskedMedicalRecordNo: 'MR****003',
    lastTouchSummary: 'D3 红肿反馈',
    nextAction: '转人工回访并记录恢复情况',
    tags: ['敏感反馈', '需安抚', '术后 D3'],
  },
  {
    id: 'cust_other_tenant',
    tenantId: 'demo-tenant-002',
    displayName: '周女士',
    lifecycle: 'scheduled',
    priority: 'medium',
    ownerUserId: 'consultant-other',
    projectInterest: '皮肤检测',
    maskedPhone: '136****7711',
    maskedMedicalRecordNo: 'MR****101',
    lastTouchSummary: '明日到院',
    nextAction: '同步到院提醒',
    tags: ['跨租户演示记录'],
  },
];

function toCustomerSummary(record: TenantCustomerRecord): CustomerRecordSummary {
  return {
    id: record.id,
    tenantId: record.tenantId,
    displayName: record.displayName,
    lifecycle: record.lifecycle,
    priority: record.priority,
    ownerUserId: record.ownerUserId,
    projectInterest: record.projectInterest,
    maskedPhone: record.maskedPhone,
    maskedMedicalRecordNo: record.maskedMedicalRecordNo,
    lastTouchSummary: record.lastTouchSummary,
    nextAction: record.nextAction,
    tags: record.tags,
  };
}

export function listCustomerRecordsForAccess(input: {
  context: AccessContext;
  targetTenantId: string;
  records?: TenantCustomerRecord[];
}): TenantBusinessResult<CustomerRecordSummary> {
  const { context, targetTenantId, records = demoTenantCustomerRecords } = input;
  const decision = canAccessResource({
    context,
    resource: 'customer',
    action: 'read_own_tenant',
    targetTenantId,
  });

  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason };
  }

  return {
    allowed: true,
    records: records
      .filter((record) => record.tenantId === context.tenantId)
      .map(toCustomerSummary),
  };
}
```

- [ ] **步骤 4：运行测试并确认通过**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessDomain.test.ts
```

预期：客户资料相关测试通过。

- [ ] **步骤 5：提交**

```bash
git add src/modules/institution/domain/customer-records.ts src/modules/institution/tests/TenantBusinessDomain.test.ts
git commit -m "新增租户客户资料领域模型"
```

## 任务 2：新增预约记录租户领域模型

**涉及文件：**

- 新建：`src/modules/institution/domain/appointment-records.ts`
- 修改测试：`src/modules/institution/tests/TenantBusinessDomain.test.ts`

- [ ] **步骤 1：编写失败测试**

在 `src/modules/institution/tests/TenantBusinessDomain.test.ts` 增加导入：

```ts
import {
  demoTenantAppointmentRecords,
  listAppointmentRecordsForAccess,
} from '@/modules/institution/domain/appointment-records';
```

在 `describe('租户业务领域模型', () => { ... })` 内增加测试：

```ts
  it('机构管理员只能读取本租户预约记录', () => {
    const result = listAppointmentRecordsForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-001',
      records: demoTenantAppointmentRecords,
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) throw new Error(result.reason);

    expect(result.records.map((record) => record.id)).toEqual([
      'appt_liu_precheck',
      'appt_qin_arrived',
      'appt_tang_reschedule',
    ]);
    expect(result.records.every((record) => record.tenantId === 'demo-tenant-001')).toBe(true);
    expect(result.records.map((record) => record.status)).toEqual([
      'pending_confirmation',
      'arrived',
      'reschedule_requested',
    ]);
  });

  it('机构管理员跨租户读取预约时被拒绝', () => {
    const result = listAppointmentRecordsForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-002',
      records: demoTenantAppointmentRecords,
    });

    expect(result).toEqual({ allowed: false, reason: 'cross_tenant_denied' });
  });
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessDomain.test.ts
```

预期：失败，原因是 `@/modules/institution/domain/appointment-records` 尚不存在。

- [ ] **步骤 3：编写最小实现**

创建 `src/modules/institution/domain/appointment-records.ts`：

```ts
import type { AccessContext, AccessDecision } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';

export type TenantBusinessDeniedReason = Extract<AccessDecision, { allowed: false }>['reason'];

export type TenantBusinessResult<T> =
  | { allowed: true; records: T[] }
  | { allowed: false; reason: TenantBusinessDeniedReason };

export type AppointmentStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'arrived'
  | 'completed'
  | 'reschedule_requested'
  | 'cancelled';

export type TenantAppointmentRecord = {
  id: string;
  tenantId: string;
  customerId: string;
  customerDisplayName: string;
  project: string;
  scheduledAt: string;
  consultantUserId: string;
  status: AppointmentStatus;
  note: string;
};

export type AppointmentRecordSummary = TenantAppointmentRecord;

export const demoTenantAppointmentRecords: TenantAppointmentRecord[] = [
  {
    id: 'appt_liu_precheck',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_liu_arrival',
    customerDisplayName: '刘女士',
    project: '水光补水',
    scheduledAt: '2026-06-01T10:30:00+08:00',
    consultantUserId: 'consultant-xu',
    status: 'pending_confirmation',
    note: '待同步术前注意事项',
  },
  {
    id: 'appt_qin_arrived',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_qin_review',
    customerDisplayName: '秦女士',
    project: '玻尿酸复诊',
    scheduledAt: '2026-05-30T11:20:00+08:00',
    consultantUserId: 'frontdesk-a',
    status: 'arrived',
    note: '等待治疗记录回填',
  },
  {
    id: 'appt_tang_reschedule',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_tang_thermage',
    customerDisplayName: '唐女士',
    project: '热玛吉面诊',
    scheduledAt: '2026-05-30T16:00:00+08:00',
    consultantUserId: 'consultant-lin',
    status: 'reschedule_requested',
    note: '需协调专家下周档期',
  },
  {
    id: 'appt_other_tenant',
    tenantId: 'demo-tenant-002',
    customerId: 'cust_other_tenant',
    customerDisplayName: '周女士',
    project: '皮肤检测',
    scheduledAt: '2026-06-02T14:00:00+08:00',
    consultantUserId: 'consultant-other',
    status: 'confirmed',
    note: '跨租户演示记录',
  },
];

export function listAppointmentRecordsForAccess(input: {
  context: AccessContext;
  targetTenantId: string;
  records?: TenantAppointmentRecord[];
}): TenantBusinessResult<AppointmentRecordSummary> {
  const { context, targetTenantId, records = demoTenantAppointmentRecords } = input;
  const decision = canAccessResource({
    context,
    resource: 'appointment',
    action: 'read_own_tenant',
    targetTenantId,
  });

  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason };
  }

  return {
    allowed: true,
    records: records.filter((record) => record.tenantId === context.tenantId),
  };
}
```

- [ ] **步骤 4：运行测试并确认通过**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessDomain.test.ts
```

预期：客户资料和预约记录测试通过。

- [ ] **步骤 5：提交**

```bash
git add src/modules/institution/domain/appointment-records.ts src/modules/institution/tests/TenantBusinessDomain.test.ts
git commit -m "新增租户预约领域模型"
```

## 任务 3：新增随访任务状态机

**涉及文件：**

- 新建：`src/modules/institution/domain/followup-workflow.ts`
- 修改测试：`src/modules/institution/tests/TenantBusinessDomain.test.ts`

- [ ] **步骤 1：编写失败测试**

在 `src/modules/institution/tests/TenantBusinessDomain.test.ts` 增加导入：

```ts
import {
  demoTenantFollowUpTasks,
  listFollowUpTasksForAccess,
  transitionFollowUpTask,
} from '@/modules/institution/domain/followup-workflow';
```

在 `describe('租户业务领域模型', () => { ... })` 内增加测试：

```ts
  it('机构管理员只能读取本租户随访任务', () => {
    const result = listFollowUpTasksForAccess({
      context: tenantAdminContext,
      targetTenantId: 'demo-tenant-001',
      tasks: demoTenantFollowUpTasks,
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) throw new Error(result.reason);

    expect(result.records.map((task) => task.id)).toEqual([
      'fu_wang_d28',
      'fu_zhao_d3',
      'fu_li_silent',
    ]);
    expect(result.records.every((task) => task.tenantId === 'demo-tenant-001')).toBe(true);
  });

  it('允许随访任务按显式状态机流转', () => {
    const result = transitionFollowUpTask({
      task: demoTenantFollowUpTasks[0],
      nextStatus: 'in_progress',
      actorId: 'demo-user-admin',
      occurredAt: '2026-05-30T09:00:00.000Z',
    });

    expect(result).toEqual({
      allowed: true,
      task: {
        ...demoTenantFollowUpTasks[0],
        status: 'in_progress',
        updatedBy: 'demo-user-admin',
        updatedAt: '2026-05-30T09:00:00.000Z',
      },
    });
  });

  it('拒绝随访任务非法状态流转', () => {
    const result = transitionFollowUpTask({
      task: { ...demoTenantFollowUpTasks[0], status: 'completed' },
      nextStatus: 'in_progress',
      actorId: 'demo-user-admin',
      occurredAt: '2026-05-30T09:00:00.000Z',
    });

    expect(result).toEqual({
      allowed: false,
      reason: 'invalid_transition',
      from: 'completed',
      to: 'in_progress',
    });
  });
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessDomain.test.ts
```

预期：失败，原因是 `@/modules/institution/domain/followup-workflow` 尚不存在。

- [ ] **步骤 3：编写最小实现**

创建 `src/modules/institution/domain/followup-workflow.ts`：

```ts
import type { AccessContext, AccessDecision } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';

export type TenantBusinessDeniedReason = Extract<AccessDecision, { allowed: false }>['reason'];

export type TenantBusinessResult<T> =
  | { allowed: true; records: T[] }
  | { allowed: false; reason: TenantBusinessDeniedReason };

export type FollowUpStatus = 'scheduled' | 'due' | 'in_progress' | 'escalated' | 'completed' | 'cancelled';

export type FollowUpRiskLevel = 'normal' | 'watch' | 'urgent';

export type TenantFollowUpTask = {
  id: string;
  tenantId: string;
  customerId: string;
  customerDisplayName: string;
  journeyId: string;
  stage: string;
  status: FollowUpStatus;
  dueAt: string;
  suggestedAction: string;
  riskLevel: FollowUpRiskLevel;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type FollowUpTransitionResult =
  | { allowed: true; task: TenantFollowUpTask }
  | { allowed: false; reason: 'invalid_transition'; from: FollowUpStatus; to: FollowUpStatus };

export const demoTenantFollowUpTasks: TenantFollowUpTask[] = [
  {
    id: 'fu_wang_d28',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_wang_repurchase',
    customerDisplayName: '王女士',
    journeyId: 'journey_repurchase',
    stage: 'D28 复购建议',
    status: 'due',
    dueAt: '2026-05-30T18:00:00+08:00',
    suggestedAction: '人工回访并推荐修复组合',
    riskLevel: 'urgent',
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: 'fu_zhao_d3',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_zhao_care',
    customerDisplayName: '赵女士',
    journeyId: 'journey_post_care',
    stage: 'D3 异常反馈',
    status: 'due',
    dueAt: '2026-05-30T09:30:00+08:00',
    suggestedAction: '客服回访并记录恢复情况',
    riskLevel: 'urgent',
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: 'fu_li_silent',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_li_silent',
    customerDisplayName: '李女士',
    journeyId: 'journey_silent',
    stage: '48h 沉默唤醒',
    status: 'scheduled',
    dueAt: '2026-05-31T10:00:00+08:00',
    suggestedAction: '发送轻量唤醒话术',
    riskLevel: 'normal',
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: 'fu_other_tenant',
    tenantId: 'demo-tenant-002',
    customerId: 'cust_other_tenant',
    customerDisplayName: '周女士',
    journeyId: 'journey_other',
    stage: '跨租户演示任务',
    status: 'due',
    dueAt: '2026-05-30T12:00:00+08:00',
    suggestedAction: '不应被本租户读取',
    riskLevel: 'watch',
    updatedBy: null,
    updatedAt: null,
  },
];

const allowedTransitions: Record<FollowUpStatus, FollowUpStatus[]> = {
  scheduled: ['due', 'cancelled'],
  due: ['in_progress', 'escalated', 'cancelled'],
  in_progress: ['completed', 'escalated', 'cancelled'],
  escalated: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function listFollowUpTasksForAccess(input: {
  context: AccessContext;
  targetTenantId: string;
  tasks?: TenantFollowUpTask[];
}): TenantBusinessResult<TenantFollowUpTask> {
  const { context, targetTenantId, tasks = demoTenantFollowUpTasks } = input;
  const decision = canAccessResource({
    context,
    resource: 'follow_up',
    action: 'read_own_tenant',
    targetTenantId,
  });

  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason };
  }

  return {
    allowed: true,
    records: tasks.filter((task) => task.tenantId === context.tenantId),
  };
}

export function transitionFollowUpTask(input: {
  task: TenantFollowUpTask;
  nextStatus: FollowUpStatus;
  actorId: string;
  occurredAt: string;
}): FollowUpTransitionResult {
  const { task, nextStatus, actorId, occurredAt } = input;

  if (!allowedTransitions[task.status].includes(nextStatus)) {
    return {
      allowed: false,
      reason: 'invalid_transition',
      from: task.status,
      to: nextStatus,
    };
  }

  return {
    allowed: true,
    task: {
      ...task,
      status: nextStatus,
      updatedBy: actorId,
      updatedAt: occurredAt,
    },
  };
}
```

- [ ] **步骤 4：运行测试并确认通过**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessDomain.test.ts
```

预期：客户资料、预约记录和随访任务测试通过。

- [ ] **步骤 5：提交**

```bash
git add src/modules/institution/domain/followup-workflow.ts src/modules/institution/tests/TenantBusinessDomain.test.ts
git commit -m "新增租户随访任务状态机"
```

## 任务 4：新增审计事件领域模型

**涉及文件：**

- 新建：`src/modules/audit/domain/audit-events.ts`
- 新建测试：`src/modules/audit/tests/AuditEventsDomain.test.ts`

- [ ] **步骤 1：编写失败测试**

创建 `src/modules/audit/tests/AuditEventsDomain.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  auditForbiddenTerms,
  createAuditEvent,
  createDeniedAccessAuditEvent,
} from '@/modules/audit/domain/audit-events';
import type { AccessContext } from '@/modules/security/domain/access-control';

const tenantAdminContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

describe('审计事件领域模型', () => {
  it('创建允许访问审计事件并包含完整字段', () => {
    expect(
      createAuditEvent({
        eventId: 'audit_evt_001',
        context: tenantAdminContext,
        resource: 'customer',
        action: 'read_own_tenant',
        result: 'allowed',
        reason: 'allowed_by_policy',
        occurredAt: '2026-05-30T09:00:00.000Z',
      }),
    ).toEqual({
      eventId: 'audit_evt_001',
      actorId: 'demo-user-admin',
      actorRole: 'tenant_admin',
      tenantId: 'demo-tenant-001',
      scope: 'tenant',
      resource: 'customer',
      action: 'read_own_tenant',
      result: 'allowed',
      reason: 'allowed_by_policy',
      occurredAt: '2026-05-30T09:00:00.000Z',
      source: 'demo_session',
    });
  });

  it('创建拒绝访问审计事件', () => {
    expect(
      createDeniedAccessAuditEvent({
        eventId: 'audit_evt_denied_001',
        context: tenantAdminContext,
        resource: 'customer',
        action: 'read_own_tenant',
        reason: 'cross_tenant_denied',
        occurredAt: '2026-05-30T09:01:00.000Z',
      }),
    ).toMatchObject({
      result: 'denied',
      reason: 'cross_tenant_denied',
      resource: 'customer',
      action: 'read_own_tenant',
    });
  });

  it('审计事件风险词列表覆盖凭证明文模式', () => {
    expect(auditForbiddenTerms).toEqual([
      'client_secret',
      'access_token',
      'refresh_token',
      'private_key',
      'webhook_secret',
      'sk_live',
      'sk_test',
      'zmtg_sk_',
    ]);

    const serialized = JSON.stringify(
      createAuditEvent({
        eventId: 'audit_evt_002',
        context: tenantAdminContext,
        resource: 'follow_up',
        action: 'review',
        result: 'allowed',
        reason: 'allowed_by_policy',
        occurredAt: '2026-05-30T09:02:00.000Z',
      }),
    ).toLowerCase();

    auditForbiddenTerms.forEach((term) => {
      expect(serialized).not.toContain(term);
    });
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/audit/tests/AuditEventsDomain.test.ts
```

预期：失败，原因是 `@/modules/audit/domain/audit-events` 尚不存在。

- [ ] **步骤 3：编写最小实现**

创建 `src/modules/audit/domain/audit-events.ts`：

```ts
import type {
  AccessContext,
  AccessDecision,
  ProtectedAction,
  ProtectedResource,
} from '@/modules/security/domain/access-control';

export type AuditResult = 'allowed' | 'denied' | 'transitioned';

export type AuditReason = AccessDecision['reason'] | 'invalid_transition';

export type TenantAuditEvent = {
  eventId: string;
  actorId: string;
  actorRole: AccessContext['role'];
  tenantId: string | null;
  scope: AccessContext['scope'];
  resource: ProtectedResource;
  action: ProtectedAction;
  result: AuditResult;
  reason: AuditReason;
  occurredAt: string;
  source: AccessContext['source'];
};

export const auditForbiddenTerms = [
  'client_secret',
  'access_token',
  'refresh_token',
  'private_key',
  'webhook_secret',
  'sk_live',
  'sk_test',
  'zmtg_sk_',
] as const;

export function createAuditEvent(input: {
  eventId: string;
  context: AccessContext;
  resource: ProtectedResource;
  action: ProtectedAction;
  result: AuditResult;
  reason: AuditReason;
  occurredAt: string;
}): TenantAuditEvent {
  return {
    eventId: input.eventId,
    actorId: input.context.userId,
    actorRole: input.context.role,
    tenantId: input.context.tenantId,
    scope: input.context.scope,
    resource: input.resource,
    action: input.action,
    result: input.result,
    reason: input.reason,
    occurredAt: input.occurredAt,
    source: input.context.source,
  };
}

export function createDeniedAccessAuditEvent(input: {
  eventId: string;
  context: AccessContext;
  resource: ProtectedResource;
  action: ProtectedAction;
  reason: Extract<AccessDecision, { allowed: false }>['reason'];
  occurredAt: string;
}): TenantAuditEvent {
  return createAuditEvent({
    eventId: input.eventId,
    context: input.context,
    resource: input.resource,
    action: input.action,
    result: 'denied',
    reason: input.reason,
    occurredAt: input.occurredAt,
  });
}
```

- [ ] **步骤 4：运行测试并确认通过**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/audit/tests/AuditEventsDomain.test.ts src/modules/institution/tests/TenantBusinessDomain.test.ts
```

预期：审计事件和机构业务领域测试通过。

- [ ] **步骤 5：提交**

```bash
git add src/modules/audit/domain/audit-events.ts src/modules/audit/tests/AuditEventsDomain.test.ts
git commit -m "新增租户审计事件领域模型"
```

## 任务 5：更新安全文档

**涉及文件：**

- 修改：`docs/security/tenant-rbac-phase1.md`

- [ ] **步骤 1：追加第二阶段说明**

在 `docs/security/tenant-rbac-phase1.md` 末尾追加：

```md
## 第二阶段领域模型约束

第二阶段允许新增客户、预约、随访和审计事件的 TypeScript 领域模型，但仍不接真实数据库、不新增真实业务 API、不保存真实敏感数据。

客户、预约和随访读取函数必须：

1. 接收服务端 `AccessContext`。
2. 调用 `canAccessResource`。
3. 只返回 `context.tenantId` 对应的记录。
4. 跨租户拒绝时不返回任何业务记录。
5. 只暴露脱敏展示字段。

审计事件模型必须记录操作者、角色、租户、资源、动作、结果、原因、时间和来源。审计事件不能包含 API Key、OAuth token、Webhook secret 或其他凭证明文。
```

- [ ] **步骤 2：检查文档未完成词**

运行：

```bash
pattern=$(node -e "process.stdout.write([String.fromCodePoint(0x5f85,0x5b9a), String.fromCodePoint(0x7a0d,0x540e), String.fromCodePoint(0x5360,0x4f4d), 'TO' + 'DO', 'TB' + 'D'].join('|'))")
rg -n "$pattern" docs/security/tenant-rbac-phase1.md
```

预期：没有输出，命令退出码为 1。

- [ ] **步骤 3：提交**

```bash
git add docs/security/tenant-rbac-phase1.md
git commit -m "补充第二阶段领域模型安全约束"
```

## 任务 6：全量验证与 PR 准备

**涉及文件：**

- 检查：所有第二阶段新增和修改文件。

- [ ] **步骤 1：运行 lint**

运行：

```bash
./node_modules/.bin/eslint .
```

预期：0 个错误。当前项目可能仍有既有 `src/modules/auth/components/LuxuryLoginShell.tsx` 的 `@next/next/no-img-element` warning，需要在总结里如实说明。

- [ ] **步骤 2：运行全量测试**

运行：

```bash
node scripts/run-vitest.mjs run
```

预期：所有测试文件通过。

- [ ] **步骤 3：运行构建和类型检查**

运行：

```bash
node scripts/run-next.mjs build --webpack
./node_modules/.bin/tsc --noEmit
```

预期：构建通过，类型检查通过。

- [ ] **步骤 4：检查工作区和 diff**

运行：

```bash
git status -sb
git diff --stat main...HEAD
git diff --check
```

预期：

- 工作区干净。
- diff 只包含第二阶段领域模型、测试和安全文档。
- 没有数据库迁移。
- 没有新增 API route。
- 没有修改 `.env*`、`package.json` 或 `next.config.ts`。

- [ ] **步骤 5：准备 PR 描述**

PR 标题：

```text
租户业务领域模型第二阶段
```

PR 正文：

```md
## 变更摘要

- 新增客户资料、预约记录和随访任务的租户领域模型。
- 新增随访任务状态机和非法流转拒绝测试。
- 新增审计事件领域模型，记录允许、拒绝和状态流转结果。
- 补充第二阶段领域模型安全约束。

## 验证结果

- `./node_modules/.bin/eslint .`
- `node scripts/run-vitest.mjs run`
- `node scripts/run-next.mjs build --webpack`
- `./node_modules/.bin/tsc --noEmit`

## 风险说明

- 本阶段仍不接真实数据库，不新增真实业务 API。
- 本阶段不保存真实客户 PII、治疗记录、咨询对话或凭证明文。
- 客户、预约、随访读取必须复用第一阶段服务端访问上下文和权限守卫。
```

## 自审清单

- [ ] 客户、预约、随访读取函数都接收 `AccessContext`。
- [ ] 客户、预约、随访读取函数都调用 `canAccessResource`。
- [ ] 跨租户读取返回拒绝且不返回业务记录。
- [ ] 平台角色默认不能读取租户客户、预约、随访明细。
- [ ] 随访状态机非法流转返回稳定原因码。
- [ ] 审计事件包含完整字段。
- [ ] 没有新增数据库迁移。
- [ ] 没有新增 API route。
- [ ] 没有新增依赖或修改生产配置。
