# 租户业务真实落库第四阶段写入流程实施计划

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**目标：** 在第三阶段只读真实落库能力之上，新增客户、预约和随访任务的受控写入 API，并继续强制服务端租户上下文、RBAC、脱敏字段白名单和审计事件。

**架构方案：** 第四阶段不改现有数据库表结构，复用第三阶段 Drizzle schema 和仓储。写入 route 必须先从 demo/session 读取 `AccessContext`，再校验 payload 白名单和 RBAC，最后通过仓储按 `context.tenantId` 写库；成功、拒绝和非法随访状态流转都写入审计事件。

**技术栈：** Next.js App Router route handler、TypeScript、Vitest、Drizzle ORM、PostgreSQL、现有 `AccessContext` / `canAccessResource` / `audit_events`。

---

## 范围

本阶段包含：

- `POST /api/institution/customers`：创建脱敏客户摘要。
- `PATCH /api/institution/customers`：更新脱敏客户摘要，body 中携带 `id`。
- `POST /api/institution/appointments`：创建预约。
- `PATCH /api/institution/appointments`：更新预约状态和备注，body 中携带 `id`。
- `PATCH /api/institution/followups`：按现有状态机流转随访任务，body 中携带 `id` 和 `nextStatus`。
- 所有写入都忽略浏览器传入的 `tenantId`，并拒绝任何原始 PII 字段。
- 所有写入都只允许 `tenant_admin` 在自己租户内执行。

本阶段不包含：

- 真实手机号、身份证号、完整病历号、治疗记录正文、咨询对话落库。
- API Key / OAuth / Webhook 真实凭证能力。
- 客户、预约、随访 UI 表单改造。
- 审计事件查询页面。
- 多角色运营分工授权；本阶段先只开放 `tenant_admin` 写入。

## 文件结构

- 修改：`src/modules/security/domain/access-control.ts`
  - 为 `tenant_admin` 增加客户、预约、随访写入动作策略。
- 修改：`src/modules/security/tests/AccessControlDomain.test.ts`
  - 覆盖允许本租户写入、拒绝平台写入、拒绝跨租户写入。
- 新建：`src/modules/institution/server/tenant-business-write-input.ts`
  - 解析和校验写入 payload，统一拒绝 `tenantId`、原始 PII 和非白名单字段。
- 新建：`src/modules/institution/tests/TenantBusinessWriteInput.test.ts`
  - 覆盖 payload 白名单、枚举、日期、PII 拒绝和 JSON 格式错误。
- 修改：`src/modules/institution/server/tenant-business-repository.ts`
  - 新增客户创建/更新、预约创建/更新、随访状态流转写库方法。
- 修改：`src/modules/institution/tests/TenantBusinessRepository.test.ts`
  - 覆盖 insert/update 使用 `tenantId + id` 条件，随访非法状态不写库。
- 修改：`src/modules/institution/server/tenant-business-api.ts`
  - 新增通用写入 handler，统一 RBAC、审计和 401/403/404/409/503 边界。
- 修改：`src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`
  - 覆盖写入 route 认证优先级、租户注入防护、权限拒绝、非法 payload、DB 错误不泄露。
- 修改：`src/app/api/institution/customers/route.ts`
  - 保留 GET，新增 POST 和 PATCH。
- 修改：`src/app/api/institution/appointments/route.ts`
  - 保留 GET，新增 POST 和 PATCH。
- 修改：`src/app/api/institution/followups/route.ts`
  - 保留 GET，新增 PATCH。
- 修改：`docs/security/tenant-rbac-phase1.md`
  - 增加第四阶段写入约束。
- 修改：`docs/operations/local-development.md`
  - 增加写入 API 本地验证命令。

---

### 任务 1：扩展写入权限策略

**涉及文件：**
- 修改：`src/modules/security/domain/access-control.ts`
- 修改：`src/modules/security/tests/AccessControlDomain.test.ts`

- [ ] **步骤 1：编写失败测试**

在 `src/modules/security/tests/AccessControlDomain.test.ts` 的 `describe('访问控制领域', () => { ... })` 内追加：

```typescript
  it('允许机构管理员在本租户创建和更新客户、预约、随访', () => {
    const writeCases = [
      { resource: 'customer', action: 'create' },
      { resource: 'customer', action: 'update' },
      { resource: 'appointment', action: 'create' },
      { resource: 'appointment', action: 'update' },
      { resource: 'follow_up', action: 'update' },
    ] as const;

    for (const writeCase of writeCases) {
      expect(
        canAccessResource({
          context: tenantAdminContext,
          resource: writeCase.resource,
          action: writeCase.action,
          targetTenantId: 'demo-tenant-001',
        }),
      ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
    }
  });

  it('拒绝平台管理员直接写入租户业务数据', () => {
    expect(
      canAccessResource({
        context: platformAdminContext,
        resource: 'customer',
        action: 'create',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
  });
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/security/tests/AccessControlDomain.test.ts
```

预期：新增的写入策略测试失败，失败断言显示当前返回 `{ allowed: false, reason: 'role_denied' }`。

- [ ] **步骤 3：编写最小实现**

在 `src/modules/security/domain/access-control.ts` 中把现有 `tenant_admin` 的三条租户业务策略改成：

```typescript
  {
    role: 'tenant_admin',
    resource: 'customer',
    actions: ['read_own_tenant', 'create', 'update'],
  },
  {
    role: 'tenant_admin',
    resource: 'appointment',
    actions: ['read_own_tenant', 'create', 'update'],
  },
  {
    role: 'tenant_admin',
    resource: 'follow_up',
    actions: ['read_own_tenant', 'update'],
  },
```

- [ ] **步骤 4：运行测试并确认通过**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/security/tests/AccessControlDomain.test.ts
```

预期：该测试文件全部通过。

- [ ] **步骤 5：提交**

```bash
git add src/modules/security/domain/access-control.ts src/modules/security/tests/AccessControlDomain.test.ts
git commit -m "扩展租户业务写入权限策略"
```

---

### 任务 2：新增写入 payload 白名单校验

**涉及文件：**
- 新建：`src/modules/institution/server/tenant-business-write-input.ts`
- 新建：`src/modules/institution/tests/TenantBusinessWriteInput.test.ts`

- [ ] **步骤 1：编写失败测试**

创建 `src/modules/institution/tests/TenantBusinessWriteInput.test.ts`：

```typescript
import { describe, expect, it } from 'vitest';
import {
  parseCreateAppointmentPayload,
  parseCreateCustomerPayload,
  parseFollowUpTransitionPayload,
  parseUpdateAppointmentPayload,
  parseUpdateCustomerPayload,
} from '@/modules/institution/server/tenant-business-write-input';

describe('租户业务写入 payload 校验', () => {
  it('接受脱敏客户创建字段并拒绝 tenantId 注入', () => {
    expect(
      parseCreateCustomerPayload({
        displayName: '王女士',
        lifecycle: 'consulting',
        priority: 'high',
        ownerUserId: 'consultant-lin',
        projectInterest: '热玛吉修复组合',
        maskedPhone: '138****1208',
        maskedMedicalRecordNo: 'MR****001',
        lastTouchSummary: '术后第 28 天',
        nextAction: '人工回访',
        tags: ['高价值'],
      }),
    ).toEqual({
      ok: true,
      value: {
        displayName: '王女士',
        lifecycle: 'consulting',
        priority: 'high',
        ownerUserId: 'consultant-lin',
        projectInterest: '热玛吉修复组合',
        maskedPhone: '138****1208',
        maskedMedicalRecordNo: 'MR****001',
        lastTouchSummary: '术后第 28 天',
        nextAction: '人工回访',
        tags: ['高价值'],
      },
    });

    expect(
      parseCreateCustomerPayload({
        tenantId: 'other-tenant',
        displayName: '王女士',
      }),
    ).toEqual({ ok: false, error: '请求包含不允许的字段: tenantId' });
  });

  it('拒绝原始 PII 字段和非脱敏病历字段', () => {
    expect(parseCreateCustomerPayload({ phoneNumber: '13800000000' })).toEqual({
      ok: false,
      error: '请求包含不允许的字段: phoneNumber',
    });
    expect(parseUpdateCustomerPayload({ id: 'cust_001', medicalRecordNo: 'MR-RAW-001' })).toEqual({
      ok: false,
      error: '请求包含不允许的字段: medicalRecordNo',
    });
  });

  it('校验客户更新必须包含 id 且至少包含一个可更新字段', () => {
    expect(parseUpdateCustomerPayload({ displayName: '王女士' })).toEqual({
      ok: false,
      error: '字段 id 必须是非空字符串',
    });
    expect(parseUpdateCustomerPayload({ id: 'cust_001' })).toEqual({
      ok: false,
      error: '至少提供一个可更新字段',
    });
  });

  it('校验预约创建和更新字段', () => {
    expect(
      parseCreateAppointmentPayload({
        customerId: 'cust_001',
        customerDisplayName: '王女士',
        project: '水光补水',
        scheduledAt: '2026-06-01T10:30:00+08:00',
        consultantUserId: 'consultant-xu',
        status: 'pending_confirmation',
        note: '待确认',
      }),
    ).toMatchObject({
      ok: true,
      value: {
        customerId: 'cust_001',
        status: 'pending_confirmation',
      },
    });

    expect(parseCreateAppointmentPayload({ scheduledAt: 'not-a-date' })).toEqual({
      ok: false,
      error: '字段 scheduledAt 必须是有效时间字符串',
    });

    expect(
      parseUpdateAppointmentPayload({
        id: 'appt_001',
        status: 'arrived',
        note: '已到院',
      }),
    ).toEqual({
      ok: true,
      value: {
        id: 'appt_001',
        status: 'arrived',
        note: '已到院',
      },
    });
  });

  it('校验随访状态流转 payload', () => {
    expect(parseFollowUpTransitionPayload({ id: 'fu_001', nextStatus: 'in_progress' })).toEqual({
      ok: true,
      value: {
        id: 'fu_001',
        nextStatus: 'in_progress',
      },
    });

    expect(parseFollowUpTransitionPayload({ id: 'fu_001', nextStatus: 'unknown' })).toEqual({
      ok: false,
      error: '字段 nextStatus 值不在允许范围内',
    });
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessWriteInput.test.ts
```

预期：测试失败，失败原因是 `tenant-business-write-input` 模块不存在。

- [ ] **步骤 3：编写最小实现**

创建 `src/modules/institution/server/tenant-business-write-input.ts`：

```typescript
import type { AppointmentStatus } from '@/modules/institution/domain/appointment-records';
import type {
  CustomerLifecycleStage,
  CustomerPriority,
} from '@/modules/institution/domain/customer-records';
import type { FollowUpStatus } from '@/modules/institution/domain/followup-workflow';

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const lifecycleValues = [
  'consulting',
  'scheduled',
  'post_care',
  'repurchase_window',
  'silent_reactivation',
] as const satisfies readonly CustomerLifecycleStage[];

const priorityValues = ['high', 'medium', 'observe'] as const satisfies readonly CustomerPriority[];

const appointmentStatusValues = [
  'pending_confirmation',
  'confirmed',
  'arrived',
  'completed',
  'reschedule_requested',
  'cancelled',
] as const satisfies readonly AppointmentStatus[];

const followUpStatusValues = [
  'scheduled',
  'due',
  'in_progress',
  'escalated',
  'completed',
  'cancelled',
] as const satisfies readonly FollowUpStatus[];

const forbiddenPayloadKeys = [
  'tenantId',
  'phoneNumber',
  'idNumber',
  'medicalRecordNo',
  'treatmentRecord',
  'consultationTranscript',
  'rawPhone',
  'rawIdCard',
] as const;

export type CreateCustomerPayload = {
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

export type UpdateCustomerPayload = Partial<CreateCustomerPayload> & { id: string };

export type CreateAppointmentPayload = {
  customerId: string;
  customerDisplayName: string;
  project: string;
  scheduledAt: string;
  consultantUserId: string;
  status: AppointmentStatus;
  note: string;
};

export type UpdateAppointmentPayload = {
  id: string;
  status: AppointmentStatus;
  note: string;
};

export type FollowUpTransitionPayload = {
  id: string;
  nextStatus: FollowUpStatus;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectForbiddenKeys(input: Record<string, unknown>): ParseResult<null> {
  const forbiddenKey = forbiddenPayloadKeys.find((key) => key in input);
  if (forbiddenKey) return { ok: false, error: `请求包含不允许的字段: ${forbiddenKey}` };
  return { ok: true, value: null };
}

function readString(input: Record<string, unknown>, key: string): ParseResult<string> {
  const value = input[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, error: `字段 ${key} 必须是非空字符串` };
  }
  return { ok: true, value: value.trim() };
}

function readOptionalString(
  input: Record<string, unknown>,
  key: string,
): ParseResult<string | undefined> {
  if (!(key in input)) return { ok: true, value: undefined };
  return readString(input, key);
}

function readEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  values: readonly T[],
): ParseResult<T> {
  const stringValue = readString(input, key);
  if (!stringValue.ok) return stringValue;
  if (!values.includes(stringValue.value as T)) {
    return { ok: false, error: `字段 ${key} 值不在允许范围内` };
  }
  return { ok: true, value: stringValue.value as T };
}

function readOptionalEnum<T extends string>(
  input: Record<string, unknown>,
  key: string,
  values: readonly T[],
): ParseResult<T | undefined> {
  if (!(key in input)) return { ok: true, value: undefined };
  return readEnum(input, key, values);
}

function readTags(input: Record<string, unknown>): ParseResult<string[]> {
  const value = input.tags;
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    return { ok: false, error: '字段 tags 必须是字符串数组' };
  }
  return { ok: true, value: value.map((item) => item.trim()).filter(Boolean) };
}

function readOptionalTags(input: Record<string, unknown>): ParseResult<string[] | undefined> {
  if (!('tags' in input)) return { ok: true, value: undefined };
  return readTags(input);
}

function readTimeString(input: Record<string, unknown>, key: string): ParseResult<string> {
  const stringValue = readString(input, key);
  if (!stringValue.ok) return stringValue;
  if (Number.isNaN(new Date(stringValue.value).getTime())) {
    return { ok: false, error: `字段 ${key} 必须是有效时间字符串` };
  }
  return stringValue;
}

function readPlainObject(input: unknown): ParseResult<Record<string, unknown>> {
  if (!isObject(input)) return { ok: false, error: '请求体必须是 JSON object' };
  const forbidden = rejectForbiddenKeys(input);
  if (!forbidden.ok) return forbidden;
  return { ok: true, value: input };
}

export function parseCreateCustomerPayload(input: unknown): ParseResult<CreateCustomerPayload> {
  const objectResult = readPlainObject(input);
  if (!objectResult.ok) return objectResult;
  const body = objectResult.value;

  const displayName = readString(body, 'displayName');
  if (!displayName.ok) return displayName;
  const lifecycle = readEnum(body, 'lifecycle', lifecycleValues);
  if (!lifecycle.ok) return lifecycle;
  const priority = readEnum(body, 'priority', priorityValues);
  if (!priority.ok) return priority;
  const ownerUserId = readString(body, 'ownerUserId');
  if (!ownerUserId.ok) return ownerUserId;
  const projectInterest = readString(body, 'projectInterest');
  if (!projectInterest.ok) return projectInterest;
  const maskedPhone = readString(body, 'maskedPhone');
  if (!maskedPhone.ok) return maskedPhone;
  const maskedMedicalRecordNo = readString(body, 'maskedMedicalRecordNo');
  if (!maskedMedicalRecordNo.ok) return maskedMedicalRecordNo;
  const lastTouchSummary = readString(body, 'lastTouchSummary');
  if (!lastTouchSummary.ok) return lastTouchSummary;
  const nextAction = readString(body, 'nextAction');
  if (!nextAction.ok) return nextAction;
  const tags = readTags(body);
  if (!tags.ok) return tags;

  return {
    ok: true,
    value: {
      displayName: displayName.value,
      lifecycle: lifecycle.value,
      priority: priority.value,
      ownerUserId: ownerUserId.value,
      projectInterest: projectInterest.value,
      maskedPhone: maskedPhone.value,
      maskedMedicalRecordNo: maskedMedicalRecordNo.value,
      lastTouchSummary: lastTouchSummary.value,
      nextAction: nextAction.value,
      tags: tags.value,
    },
  };
}

export function parseUpdateCustomerPayload(input: unknown): ParseResult<UpdateCustomerPayload> {
  const objectResult = readPlainObject(input);
  if (!objectResult.ok) return objectResult;
  const body = objectResult.value;

  const id = readString(body, 'id');
  if (!id.ok) return id;

  const displayName = readOptionalString(body, 'displayName');
  if (!displayName.ok) return displayName;
  const lifecycle = readOptionalEnum(body, 'lifecycle', lifecycleValues);
  if (!lifecycle.ok) return lifecycle;
  const priority = readOptionalEnum(body, 'priority', priorityValues);
  if (!priority.ok) return priority;
  const ownerUserId = readOptionalString(body, 'ownerUserId');
  if (!ownerUserId.ok) return ownerUserId;
  const projectInterest = readOptionalString(body, 'projectInterest');
  if (!projectInterest.ok) return projectInterest;
  const maskedPhone = readOptionalString(body, 'maskedPhone');
  if (!maskedPhone.ok) return maskedPhone;
  const maskedMedicalRecordNo = readOptionalString(body, 'maskedMedicalRecordNo');
  if (!maskedMedicalRecordNo.ok) return maskedMedicalRecordNo;
  const lastTouchSummary = readOptionalString(body, 'lastTouchSummary');
  if (!lastTouchSummary.ok) return lastTouchSummary;
  const nextAction = readOptionalString(body, 'nextAction');
  if (!nextAction.ok) return nextAction;
  const tags = readOptionalTags(body);
  if (!tags.ok) return tags;

  const value = {
    id: id.value,
    displayName: displayName.value,
    lifecycle: lifecycle.value,
    priority: priority.value,
    ownerUserId: ownerUserId.value,
    projectInterest: projectInterest.value,
    maskedPhone: maskedPhone.value,
    maskedMedicalRecordNo: maskedMedicalRecordNo.value,
    lastTouchSummary: lastTouchSummary.value,
    nextAction: nextAction.value,
    tags: tags.value,
  };
  const hasUpdate = Object.entries(value).some(
    ([key, entryValue]) => key !== 'id' && entryValue !== undefined,
  );
  if (!hasUpdate) return { ok: false, error: '至少提供一个可更新字段' };
  return { ok: true, value };
}

export function parseCreateAppointmentPayload(input: unknown): ParseResult<CreateAppointmentPayload> {
  const objectResult = readPlainObject(input);
  if (!objectResult.ok) return objectResult;
  const body = objectResult.value;

  const customerId = readString(body, 'customerId');
  if (!customerId.ok) return customerId;
  const customerDisplayName = readString(body, 'customerDisplayName');
  if (!customerDisplayName.ok) return customerDisplayName;
  const project = readString(body, 'project');
  if (!project.ok) return project;
  const scheduledAt = readTimeString(body, 'scheduledAt');
  if (!scheduledAt.ok) return scheduledAt;
  const consultantUserId = readString(body, 'consultantUserId');
  if (!consultantUserId.ok) return consultantUserId;
  const status = readEnum(body, 'status', appointmentStatusValues);
  if (!status.ok) return status;
  const note = readString(body, 'note');
  if (!note.ok) return note;

  return {
    ok: true,
    value: {
      customerId: customerId.value,
      customerDisplayName: customerDisplayName.value,
      project: project.value,
      scheduledAt: scheduledAt.value,
      consultantUserId: consultantUserId.value,
      status: status.value,
      note: note.value,
    },
  };
}

export function parseUpdateAppointmentPayload(input: unknown): ParseResult<UpdateAppointmentPayload> {
  const objectResult = readPlainObject(input);
  if (!objectResult.ok) return objectResult;
  const body = objectResult.value;

  const id = readString(body, 'id');
  if (!id.ok) return id;
  const status = readEnum(body, 'status', appointmentStatusValues);
  if (!status.ok) return status;
  const note = readString(body, 'note');
  if (!note.ok) return note;

  return { ok: true, value: { id: id.value, status: status.value, note: note.value } };
}

export function parseFollowUpTransitionPayload(input: unknown): ParseResult<FollowUpTransitionPayload> {
  const objectResult = readPlainObject(input);
  if (!objectResult.ok) return objectResult;
  const body = objectResult.value;

  const id = readString(body, 'id');
  if (!id.ok) return id;
  const nextStatus = readEnum(body, 'nextStatus', followUpStatusValues);
  if (!nextStatus.ok) return nextStatus;

  return { ok: true, value: { id: id.value, nextStatus: nextStatus.value } };
}
```

- [ ] **步骤 4：运行测试并确认通过**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessWriteInput.test.ts
```

预期：测试通过。

- [ ] **步骤 5：提交**

```bash
git add src/modules/institution/server/tenant-business-write-input.ts src/modules/institution/tests/TenantBusinessWriteInput.test.ts
git commit -m "新增租户业务写入 payload 校验"
```

---

### 任务 3：扩展真实落库仓储写入方法

**涉及文件：**
- 修改：`src/modules/institution/server/tenant-business-repository.ts`
- 修改：`src/modules/institution/tests/TenantBusinessRepository.test.ts`

- [ ] **步骤 1：编写失败测试**

在 `src/modules/institution/tests/TenantBusinessRepository.test.ts` 中追加写入链路 mock：

```typescript
function createMutationDatabase(row: unknown | null = null) {
  const returning = vi.fn(async () => (row ? [row] : []));
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));

  return {
    database: { insert, update, select: vi.fn() } as unknown as TenantDatabase,
    insert,
    update,
    values,
    set,
    where,
    returning,
  };
}
```

在 `describe('租户业务仓储映射', () => { ... })` 内追加：

```typescript
  it('创建客户时由调用方传入 tenantId 并返回脱敏记录', async () => {
    const createdAt = new Date('2026-05-30T00:00:00.000Z');
    const mutation = createMutationDatabase({
      id: 'cust_created',
      tenantId: 'demo-tenant-001',
      displayName: '王女士',
      lifecycle: 'consulting',
      priority: 'high',
      ownerUserId: 'consultant-lin',
      projectInterest: '热玛吉修复组合',
      maskedPhone: '138****1208',
      maskedMedicalRecordNo: 'MR****001',
      lastTouchSummary: '术后第 28 天',
      nextAction: '人工回访',
      tags: ['高价值'],
      createdAt,
      updatedAt: createdAt,
    });

    const record = await createTenantBusinessRepository(mutation.database).createCustomer({
      id: 'cust_created',
      tenantId: 'demo-tenant-001',
      displayName: '王女士',
      lifecycle: 'consulting',
      priority: 'high',
      ownerUserId: 'consultant-lin',
      projectInterest: '热玛吉修复组合',
      maskedPhone: '138****1208',
      maskedMedicalRecordNo: 'MR****001',
      lastTouchSummary: '术后第 28 天',
      nextAction: '人工回访',
      tags: ['高价值'],
    });

    expect(mutation.insert).toHaveBeenCalledWith(customers);
    expect(mutation.values).toHaveBeenCalledWith(expect.objectContaining({
      id: 'cust_created',
      tenantId: 'demo-tenant-001',
      maskedPhone: '138****1208',
    }));
    expect(record).toMatchObject({
      id: 'cust_created',
      tenantId: 'demo-tenant-001',
      displayName: '王女士',
    });
  });

  it('更新预约时使用 tenantId 和 id 作为更新条件', async () => {
    const mutation = createMutationDatabase({
      id: 'appt_001',
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
      customerDisplayName: '王女士',
      project: '水光补水',
      scheduledAt: new Date('2026-06-01T02:30:00.000Z'),
      consultantUserId: 'consultant-xu',
      status: 'arrived',
      note: '已到院',
      createdAt: new Date('2026-05-30T00:00:00.000Z'),
      updatedAt: new Date('2026-05-30T00:00:00.000Z'),
    });

    const record = await createTenantBusinessRepository(mutation.database).updateAppointment({
      id: 'appt_001',
      tenantId: 'demo-tenant-001',
      status: 'arrived',
      note: '已到院',
    });

    expect(mutation.update).toHaveBeenCalledWith(appointments);
    expect(mutation.set).toHaveBeenCalledWith(expect.objectContaining({
      status: 'arrived',
      note: '已到院',
    }));
    expect(record).toMatchObject({ id: 'appt_001', status: 'arrived' });
  });
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessRepository.test.ts
```

预期：测试失败，失败原因是 `createCustomer` 和 `updateAppointment` 不存在。

- [ ] **步骤 3：编写最小实现**

修改 `src/modules/institution/server/tenant-business-repository.ts`：

```typescript
import { and, eq } from 'drizzle-orm';
import type { AppointmentStatus } from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import {
  transitionFollowUpTask as transitionFollowUpTaskDomain,
  type FollowUpStatus,
  type TenantFollowUpTask,
} from '@/modules/institution/domain/followup-workflow';
```

在类型定义后追加：

```typescript
type CreateCustomerInput = typeof customers.$inferInsert;
type UpdateCustomerInput = Partial<Omit<typeof customers.$inferInsert, 'tenantId' | 'id'>> & {
  tenantId: string;
  id: string;
};
type CreateAppointmentInput = typeof appointments.$inferInsert;
type UpdateAppointmentInput = {
  tenantId: string;
  id: string;
  status: AppointmentStatus;
  note: string;
};
type TransitionFollowUpTaskInput = {
  tenantId: string;
  id: string;
  nextStatus: FollowUpStatus;
  actorId: string;
  occurredAt: string;
};
type TransitionFollowUpTaskPersistenceResult =
  | { kind: 'updated'; task: TenantFollowUpTask }
  | { kind: 'not_found' }
  | { kind: 'invalid_transition'; from: FollowUpStatus; to: FollowUpStatus };

function dropUndefinedValues<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as Partial<T>;
}
```

在 `createTenantBusinessRepository(database: TenantDatabase)` 返回对象内增加：

```typescript
    async createCustomer(input: CreateCustomerInput): Promise<CustomerRecordSummary> {
      const [row] = await database.insert(customers).values(input).returning();
      return mapCustomerRowToRecord(row);
    },
    async updateCustomer(input: UpdateCustomerInput): Promise<CustomerRecordSummary | null> {
      const { tenantId, id, ...changes } = input;
      const [row] = await database
        .update(customers)
        .set({ ...dropUndefinedValues(changes), updatedAt: new Date() })
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .returning();

      return row ? mapCustomerRowToRecord(row) : null;
    },
    async createAppointment(input: CreateAppointmentInput): Promise<AppointmentRecordSummary> {
      const [row] = await database.insert(appointments).values(input).returning();
      return mapAppointmentRowToRecord(row);
    },
    async updateAppointment(input: UpdateAppointmentInput): Promise<AppointmentRecordSummary | null> {
      const [row] = await database
        .update(appointments)
        .set({ status: input.status, note: input.note, updatedAt: new Date() })
        .where(and(eq(appointments.tenantId, input.tenantId), eq(appointments.id, input.id)))
        .returning();

      return row ? mapAppointmentRowToRecord(row) : null;
    },
    async transitionFollowUpTask(
      input: TransitionFollowUpTaskInput,
    ): Promise<TransitionFollowUpTaskPersistenceResult> {
      const rows = await database
        .select()
        .from(followUpTasks)
        .where(and(eq(followUpTasks.tenantId, input.tenantId), eq(followUpTasks.id, input.id)));
      const current = rows[0];
      if (!current) return { kind: 'not_found' };

      const transition = transitionFollowUpTaskDomain({
        task: mapFollowUpTaskRowToRecord(current),
        nextStatus: input.nextStatus,
        actorId: input.actorId,
        occurredAt: input.occurredAt,
      });

      if (!transition.allowed) {
        return {
          kind: 'invalid_transition',
          from: transition.from,
          to: transition.to,
        };
      }

      const [row] = await database
        .update(followUpTasks)
        .set({
          status: transition.task.status,
          updatedBy: transition.task.updatedBy,
          updatedAt: transition.task.updatedAt ? new Date(transition.task.updatedAt) : null,
        })
        .where(and(eq(followUpTasks.tenantId, input.tenantId), eq(followUpTasks.id, input.id)))
        .returning();

      return row ? { kind: 'updated', task: mapFollowUpTaskRowToRecord(row) } : { kind: 'not_found' };
    },
```

- [ ] **步骤 4：运行测试并确认通过**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessRepository.test.ts
```

预期：测试通过。若 `and` mock 需要断言，扩展当前 `drizzle-orm` mock，让 `andMock` 返回 `{ operator: 'and', conditions }`。

- [ ] **步骤 5：提交**

```bash
git add src/modules/institution/server/tenant-business-repository.ts src/modules/institution/tests/TenantBusinessRepository.test.ts
git commit -m "新增租户业务写入仓储方法"
```

---

### 任务 4：新增通用写入 API handler

**涉及文件：**
- 修改：`src/modules/institution/server/tenant-business-api.ts`
- 修改：`src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`

- [ ] **步骤 1：编写失败测试**

在 `src/modules/institution/tests/TenantBusinessApiRoutes.test.ts` 的第一个 `describe` 内追加：

```typescript
  it('写入 handler 使用访问上下文租户并记录允许审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };
    const mutate = vi.fn(async () => ({
      kind: 'success' as const,
      record: { id: 'cust_created', tenantId: 'demo-tenant-001' },
    }));

    const response = await handleTenantBusinessMutationRequest({
      context: tenantContext,
      resource: 'customer',
      action: 'create',
      mutate,
      auditRepository,
      successStatus: 201,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      record: { id: 'cust_created', tenantId: 'demo-tenant-001' },
    });
    expect(mutate).toHaveBeenCalledWith('demo-tenant-001');
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resource: 'customer',
      result: 'allowed',
      tenantId: 'demo-tenant-001',
    }));
  });

  it('写入 handler 对非法随访流转返回 409 并写 denied 审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessMutationRequest({
      context: tenantContext,
      resource: 'follow_up',
      action: 'update',
      mutate: vi.fn(async () => ({
        kind: 'invalid_transition' as const,
        from: 'completed',
        to: 'in_progress',
      })),
      auditRepository,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: '随访状态不允许这样流转' });
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'invalid_transition',
      resource: 'follow_up',
      action: 'update',
    }));
  });
```

同时把 import 改成：

```typescript
import {
  handleTenantBusinessListRequest,
  handleTenantBusinessMutationRequest,
} from '@/modules/institution/server/tenant-business-api';
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
```

预期：测试失败，失败原因是 `handleTenantBusinessMutationRequest` 不存在。

- [ ] **步骤 3：编写最小实现**

在 `src/modules/institution/server/tenant-business-api.ts` 中追加类型和函数：

```typescript
// 同时把顶部 access-control import 扩展为：
// type ProtectedAction,
// type ProtectedResource,

type TenantBusinessMutationResult<Item> =
  | { kind: 'success'; record: Item }
  | { kind: 'not_found' }
  | { kind: 'invalid_transition'; from: string; to: string };

type TenantBusinessMutationRequest<Item> = {
  context: AccessContext | null;
  resource: TenantBusinessResource;
  action: Extract<ProtectedAction, 'create' | 'update'>;
  mutate: (tenantId: string) => Promise<TenantBusinessMutationResult<Item>>;
  auditRepository: Pick<AuditEventRepository, 'record'>;
  successStatus?: 200 | 201;
};

export async function handleTenantBusinessMutationRequest<Item>({
  context,
  resource,
  action,
  mutate,
  auditRepository,
  successStatus = 200,
}: TenantBusinessMutationRequest<Item>) {
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const occurredAt = new Date().toISOString();
  const decision = canAccessResource({
    context,
    resource,
    action,
    targetTenantId: context.tenantId,
  });

  if (!decision.allowed) {
    await auditRepository.record(
      createDeniedAccessAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        action,
        reason: decision.reason,
        occurredAt,
      }),
    );
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  if (!context.tenantId) {
    await auditRepository.record(
      createDeniedAccessAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        action,
        reason: 'missing_tenant',
        occurredAt,
      }),
    );
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  const result = await mutate(context.tenantId);

  if (result.kind === 'not_found') {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  if (result.kind === 'invalid_transition') {
    await auditRepository.record(
      createAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource,
        action,
        result: 'denied',
        reason: 'invalid_transition',
        occurredAt,
      }),
    );
    return NextResponse.json({ error: '随访状态不允许这样流转' }, { status: 409 });
  }

  await auditRepository.record(
    createAuditEvent({
      eventId: createAuditEventId(),
      context,
      resource,
      action,
      result: 'allowed',
      reason: decision.reason,
      occurredAt,
    }),
  );

  return NextResponse.json({ record: result.record }, { status: successStatus });
}
```

- [ ] **步骤 4：运行测试并确认通过**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
```

预期：测试通过。

- [ ] **步骤 5：提交**

```bash
git add src/modules/institution/server/tenant-business-api.ts src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
git commit -m "新增租户业务写入 API handler"
```

---

### 任务 5：接入客户、预约、随访写入 route

**涉及文件：**
- 修改：`src/app/api/institution/customers/route.ts`
- 修改：`src/app/api/institution/appointments/route.ts`
- 修改：`src/app/api/institution/followups/route.ts`
- 修改：`src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`

- [ ] **步骤 1：编写失败测试**

在 `src/modules/institution/tests/TenantBusinessApiRoutes.test.ts` 顶部 import 中加入：

```typescript
import {
  GET as customersGet,
  PATCH as customersPatch,
  POST as customersPost,
} from '@/app/api/institution/customers/route';
import {
  GET as appointmentsGet,
  PATCH as appointmentsPatch,
  POST as appointmentsPost,
} from '@/app/api/institution/appointments/route';
import {
  GET as followupsGet,
  PATCH as followupsPatch,
} from '@/app/api/institution/followups/route';
```

把 `routeMocks.repository` 扩展为：

```typescript
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    createAppointment: vi.fn(),
    updateAppointment: vi.fn(),
    transitionFollowUpTask: vi.fn(),
```

在 `beforeEach` 内增加：

```typescript
  routeMocks.repository.createCustomer.mockReset();
  routeMocks.repository.createCustomer.mockResolvedValue({
    id: 'cust_created',
    tenantId: 'demo-tenant-001',
    displayName: '王女士',
  });
  routeMocks.repository.updateCustomer.mockReset();
  routeMocks.repository.updateCustomer.mockResolvedValue({
    id: 'cust_created',
    tenantId: 'demo-tenant-001',
    displayName: '王女士更新',
  });
  routeMocks.repository.createAppointment.mockReset();
  routeMocks.repository.createAppointment.mockResolvedValue({
    id: 'appt_created',
    tenantId: 'demo-tenant-001',
  });
  routeMocks.repository.updateAppointment.mockReset();
  routeMocks.repository.updateAppointment.mockResolvedValue({
    id: 'appt_created',
    tenantId: 'demo-tenant-001',
    status: 'arrived',
  });
  routeMocks.repository.transitionFollowUpTask.mockReset();
  routeMocks.repository.transitionFollowUpTask.mockResolvedValue({
    kind: 'updated',
    task: {
      id: 'fu_001',
      tenantId: 'demo-tenant-001',
      status: 'in_progress',
    },
  });
```

追加 route 测试：

```typescript
describe('租户业务写入 API route', () => {
  it('未登录写入时返回 401 且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const response = await customersPost(
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        body: JSON.stringify({ displayName: '王女士' }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('创建客户时忽略 body tenantId 并拒绝该字段', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await customersPost(
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'other-tenant',
          displayName: '王女士',
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '请求包含不允许的字段: tenantId',
    });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('创建客户成功时使用访问上下文 tenantId 写库并记录审计', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await customersPost(
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: '王女士',
          lifecycle: 'consulting',
          priority: 'high',
          ownerUserId: 'consultant-lin',
          projectInterest: '热玛吉修复组合',
          maskedPhone: '138****1208',
          maskedMedicalRecordNo: 'MR****001',
          lastTouchSummary: '术后第 28 天',
          nextAction: '人工回访',
          tags: ['高价值'],
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      record: {
        id: 'cust_created',
        tenantId: 'demo-tenant-001',
        displayName: '王女士',
      },
    });
    expect(routeMocks.repository.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'demo-tenant-001',
      displayName: '王女士',
    }));
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resource: 'customer',
      result: 'allowed',
    }));
  });

  it('预约和随访写入 route 绑定正确仓储方法', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    await appointmentsPost(
      new Request('http://localhost/api/institution/appointments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: 'cust_001',
          customerDisplayName: '王女士',
          project: '水光补水',
          scheduledAt: '2026-06-01T10:30:00+08:00',
          consultantUserId: 'consultant-xu',
          status: 'pending_confirmation',
          note: '待确认',
        }),
      }),
    );
    expect(routeMocks.repository.createAppointment).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
    }));

    await appointmentsPatch(
      new Request('http://localhost/api/institution/appointments', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'appt_created', status: 'arrived', note: '已到院' }),
      }),
    );
    expect(routeMocks.repository.updateAppointment).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'appt_created',
      status: 'arrived',
      note: '已到院',
    });

    await followupsPatch(
      new Request('http://localhost/api/institution/followups', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'fu_001', nextStatus: 'in_progress' }),
      }),
    );
    expect(routeMocks.repository.transitionFollowUpTask).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'fu_001',
      nextStatus: 'in_progress',
      actorId: 'demo-user-admin',
      occurredAt: expect.any(String),
    });
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
```

预期：测试失败，失败原因是 `POST` / `PATCH` route exports 不存在。

- [ ] **步骤 3：实现 route 共享辅助函数**

在三个 route 文件内使用同一结构。先在 `src/app/api/institution/customers/route.ts` 顶部补充 import：

```typescript
import { handleTenantBusinessMutationRequest } from '@/modules/institution/server/tenant-business-api';
import {
  parseCreateCustomerPayload,
  parseUpdateCustomerPayload,
} from '@/modules/institution/server/tenant-business-write-input';
```

在 `GET` 后追加：

```typescript
async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const, error: '请求格式不正确' };
  }
}

function createRouteRepositories() {
  const db = getDatabase();
  return {
    repository: createTenantBusinessRepository(db),
    auditRepository: createAuditEventRepository(db),
  };
}
```

- [ ] **步骤 4：实现客户 POST/PATCH**

在 `src/app/api/institution/customers/route.ts` 追加：

```typescript
export async function POST(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 });
  }
  const parsed = parseCreateCustomerPayload(body.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const { repository, auditRepository } = createRouteRepositories();
    return await handleTenantBusinessMutationRequest({
      context,
      resource: 'customer',
      action: 'create',
      mutate: async (tenantId) => ({
        kind: 'success',
        record: await repository.createCustomer({
          id: globalThis.crypto.randomUUID(),
          tenantId,
          ...parsed.value,
        }),
      }),
      auditRepository,
      successStatus: 201,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 });
  }
  const parsed = parseUpdateCustomerPayload(body.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const { repository, auditRepository } = createRouteRepositories();
    return await handleTenantBusinessMutationRequest({
      context,
      resource: 'customer',
      action: 'update',
      mutate: async (tenantId) => {
        const record = await repository.updateCustomer({ tenantId, ...parsed.value });
        return record ? { kind: 'success', record } : { kind: 'not_found' };
      },
      auditRepository,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
```

- [ ] **步骤 5：实现预约 POST/PATCH**

在 `src/app/api/institution/appointments/route.ts` 补充 import：

```typescript
import { handleTenantBusinessMutationRequest } from '@/modules/institution/server/tenant-business-api';
import {
  parseCreateAppointmentPayload,
  parseUpdateAppointmentPayload,
} from '@/modules/institution/server/tenant-business-write-input';
```

在 `GET` 后追加与客户 route 同名的 `readJsonBody` 和 `createRouteRepositories`。再追加：

```typescript
export async function POST(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  const parsed = parseCreateAppointmentPayload(body.value);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { repository, auditRepository } = createRouteRepositories();
    return await handleTenantBusinessMutationRequest({
      context,
      resource: 'appointment',
      action: 'create',
      mutate: async (tenantId) => ({
        kind: 'success',
        record: await repository.createAppointment({
          id: globalThis.crypto.randomUUID(),
          tenantId,
          ...parsed.value,
          scheduledAt: new Date(parsed.value.scheduledAt),
        }),
      }),
      auditRepository,
      successStatus: 201,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  const parsed = parseUpdateAppointmentPayload(body.value);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { repository, auditRepository } = createRouteRepositories();
    return await handleTenantBusinessMutationRequest({
      context,
      resource: 'appointment',
      action: 'update',
      mutate: async (tenantId) => {
        const record = await repository.updateAppointment({ tenantId, ...parsed.value });
        return record ? { kind: 'success', record } : { kind: 'not_found' };
      },
      auditRepository,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
```

- [ ] **步骤 6：实现随访 PATCH**

在 `src/app/api/institution/followups/route.ts` 补充 import：

```typescript
import { handleTenantBusinessMutationRequest } from '@/modules/institution/server/tenant-business-api';
import { parseFollowUpTransitionPayload } from '@/modules/institution/server/tenant-business-write-input';
```

在 `GET` 后追加与客户 route 同名的 `readJsonBody` 和 `createRouteRepositories`。再追加：

```typescript
export async function PATCH(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 });
  const parsed = parseFollowUpTransitionPayload(body.value);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { repository, auditRepository } = createRouteRepositories();
    return await handleTenantBusinessMutationRequest({
      context,
      resource: 'follow_up',
      action: 'update',
      mutate: async (tenantId) => {
        const result = await repository.transitionFollowUpTask({
          tenantId,
          id: parsed.value.id,
          nextStatus: parsed.value.nextStatus,
          actorId: context.userId,
          occurredAt: new Date().toISOString(),
        });

        if (result.kind === 'updated') {
          return { kind: 'success', record: result.task };
        }
        return result;
      },
      auditRepository,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
```

- [ ] **步骤 7：运行 route 测试并确认通过**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
```

预期：测试通过。

- [ ] **步骤 8：提交**

```bash
git add src/app/api/institution/customers/route.ts src/app/api/institution/appointments/route.ts src/app/api/institution/followups/route.ts src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
git commit -m "接入租户业务写入 API route"
```

---

### 任务 6：补充安全文档和本地验证说明

**涉及文件：**
- 修改：`docs/security/tenant-rbac-phase1.md`
- 修改：`docs/operations/local-development.md`

- [ ] **步骤 1：更新安全文档**

在 `docs/security/tenant-rbac-phase1.md` 的“第三阶段真实落库约束”后追加：

```markdown
## 第四阶段写入流程约束

第四阶段允许新增客户、预约、随访任务的写入型 API route，但写入必须满足：

1. 所有写入必须从服务端 `AccessContext` 推导 `tenantId`，禁止信任 URL、header 或 body 传入的 `tenantId`。
2. 客户写入只能保存脱敏展示字段，禁止保存真实手机号、身份证号、完整病历号、治疗记录正文或咨询对话。
3. 预约和随访写入必须通过 `(tenant_id, customer_id)` 外键留在同一租户内。
4. 随访状态变更必须复用 `transitionFollowUpTask` 状态机。
5. 允许写入、权限拒绝和非法随访流转都必须写入 `audit_events`。
6. 数据库异常必须返回稳定错误，不能泄露连接串、凭证明文或 SQL 细节。
```

- [ ] **步骤 2：更新本地开发文档**

在 `docs/operations/local-development.md` 的“本地数据库”后追加：

```markdown
### 写入 API 验证

设置 `DATABASE_URL` 并完成迁移、种子后，可以用 demo 账号登录，再验证写入 API：

```bash
curl -i -X POST http://localhost:5010/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

curl -i -X POST http://localhost:5010/api/institution/customers \
  -H 'content-type: application/json' \
  -H 'cookie: zmtg_demo_session=<从登录响应复制 cookie 值>' \
  -d '{"displayName":"测试客户","lifecycle":"consulting","priority":"observe","ownerUserId":"demo-user-admin","projectInterest":"皮肤管理","maskedPhone":"masked-demo","maskedMedicalRecordNo":"DEMO-MR-WRITE","lastTouchSummary":"本地写入验证","nextAction":"继续跟进","tags":["本地验证"]}'
```

不要把真实 `DATABASE_URL`、cookie 或业务数据写入文档、提交记录或截图。
```

- [ ] **步骤 3：运行文档相关扫描**

运行：

```bash
rg -n -i "phoneNumber|idNumber|medicalRecordNo|treatmentRecord|consultationTranscript|DATABASE_URL=postgres://|sk_live|sk_test" docs/security/tenant-rbac-phase1.md docs/operations/local-development.md
```

预期：只命中文档中的禁止项和 `<从登录响应复制 cookie 值>` 示例，不出现真实连接串或真实凭证。

- [ ] **步骤 4：提交**

```bash
git add docs/security/tenant-rbac-phase1.md docs/operations/local-development.md
git commit -m "补充租户业务写入安全和验证文档"
```

---

### 任务 7：最终验证和 PR 准备

**涉及文件：**
- 检查：所有第四阶段新增和修改文件。

- [ ] **步骤 1：运行定向测试**

运行：

```bash
node scripts/run-vitest.mjs run \
  src/modules/security/tests/AccessControlDomain.test.ts \
  src/modules/institution/tests/TenantBusinessWriteInput.test.ts \
  src/modules/institution/tests/TenantBusinessRepository.test.ts \
  src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
```

预期：全部通过。

- [ ] **步骤 2：运行全量测试和构建**

运行：

```bash
./node_modules/.bin/tsc --noEmit
node scripts/run-vitest.mjs run
./node_modules/.bin/eslint .
node scripts/run-next.mjs build --webpack
```

预期：

- TypeScript 通过。
- Vitest 全量通过。
- ESLint 0 errors；如果仍有既有 `<img>` warning，需要在 PR 测试说明中说明。
- Next build 通过。

- [ ] **步骤 3：运行安全扫描**

运行：

```bash
git diff --check main...HEAD
git diff --name-only main...HEAD | rg -n '(^|/)\.env($|\.)|(^|/)env$'
rg -n "export async function (PUT|DELETE)|\bPUT\b|\bDELETE\b" src/app/api/institution src/modules/institution/server
git diff --name-only main...HEAD | xargs rg -n -i "(password|secret|token|api[_-]?key|sk-[A-Za-z0-9_\-]+)"
git diff --name-only main...HEAD | xargs rg -n -i "(phoneNumber|idNumber|medicalRecordNo|phone_number|id_number|medical_record_no|身份证号|病历号|真实手机号)"
```

预期：

- `git diff --check main...HEAD` 无输出。
- `.env` 扫描无输出。
- 写接口扫描只允许命中本阶段明确新增的 `POST` 和 `PATCH`，不允许 `PUT` / `DELETE`。
- 凭据扫描只允许命中文档警戒语、测试中的拒绝断言和 demo 登录字段。
- PII 扫描只允许命中文档禁止项、脱敏字段名和拒绝断言。

- [ ] **步骤 4：真实数据库验证**

如果当前 shell 有可用 `DATABASE_URL`，运行：

```bash
node_modules/.bin/drizzle-kit migrate
node_modules/.bin/tsx src/server/db/seed-demo-data.ts
env DATABASE_URL="$DATABASE_URL" node scripts/run-next.mjs dev --webpack --port 5010
```

然后使用 demo 登录后的 cookie 访问：

```bash
curl -i http://localhost:5010/api/institution/customers \
  -H 'cookie: zmtg_demo_session=<cookie>'

curl -i -X POST http://localhost:5010/api/institution/customers \
  -H 'content-type: application/json' \
  -H 'cookie: zmtg_demo_session=<cookie>' \
  -d '{"displayName":"测试客户","lifecycle":"consulting","priority":"observe","ownerUserId":"demo-user-admin","projectInterest":"皮肤管理","maskedPhone":"masked-demo","maskedMedicalRecordNo":"DEMO-MR-WRITE","lastTouchSummary":"本地写入验证","nextAction":"继续跟进","tags":["本地验证"]}'
```

预期：

- GET 返回本租户记录。
- POST 返回 201 和新客户 `record`。
- 使用 body 传入 `tenantId` 返回 400。
- 未登录请求返回 401。
- 没有数据库配置时返回稳定 503，不泄露连接串。

- [ ] **步骤 5：最终审查**

使用 `superpowers:requesting-code-review` 请求代码审查，审查范围是 `main...HEAD`。审查重点：

- 写入 API 是否完全从服务端上下文推导 `tenantId`。
- 是否拒绝原始 PII 字段和 body tenant 注入。
- 仓储 update 是否全部带 `tenantId + id` 条件。
- 审计事件是否覆盖成功、拒绝和非法随访流转。
- route catch 是否不泄露数据库连接串。

- [ ] **步骤 6：准备 PR 描述**

PR 描述使用：

```markdown
## 修改内容
- 新增客户、预约、随访任务写入 API。
- 新增写入 payload 白名单校验，拒绝 tenantId 注入和原始 PII 字段。
- 扩展仓储写入方法，所有更新按 tenantId + id 限定。
- 写入成功、权限拒绝和非法随访状态流转写入审计事件。
- 补充第四阶段安全约束和本地验证文档。

## 测试情况
- [ ] `./node_modules/.bin/tsc --noEmit`
- [ ] `node scripts/run-vitest.mjs run`
- [ ] `./node_modules/.bin/eslint .`
- [ ] `node scripts/run-next.mjs build --webpack`
- [ ] 真实数据库迁移、种子和写入 API 验证

## 风险
- 本阶段新增写入 API，必须重点审查 tenantId 来源、payload 白名单和审计覆盖。
- 如果没有配置 `DATABASE_URL`，API 会 fail closed 返回 503。
- 本阶段只开放 `tenant_admin` 写入，不解决更细粒度岗位授权。

## 下一步建议
- 接入 UI 表单并用同一套 API 写入真实数据。
- 增加审计查询页面，便于机构管理员追踪写入和拒绝事件。
- 进入凭证能力阶段前，继续保持 API Key / OAuth / Webhook 明文禁止落库。
```

---

## 自检

- 覆盖第三阶段设计文档“后续阶段”中的客户资料创建和更新、预约状态变更、随访任务状态变更 API。
- 本计划没有修改数据库 schema，原因是第三阶段表结构已经具备本阶段写入所需字段。
- 本计划没有引入真实 PII 字段，所有客户写入仅使用 `maskedPhone` 和 `maskedMedicalRecordNo`。
- 所有 route 都先检查访问上下文，未登录请求不会初始化数据库。
- 所有成功写入都经过 `canAccessResource`，并由审计仓储记录。
- 随访状态流转继续复用现有 `transitionFollowUpTask` 状态机。
- 本计划把 UI 表单、审计查询页面和真实凭证能力留到后续阶段，避免第四阶段范围失控。
