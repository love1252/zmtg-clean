# 租户业务真实落库第三阶段实施计划

> **给后续执行 Agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划。步骤使用 `- [ ]` 复选框语法跟踪。

**目标：** 为租户客户、预约、随访和审计事件建立 PostgreSQL + Drizzle 持久化基础，并新增复用权限守卫的只读 API。

**架构方案：** 本阶段新增 Drizzle schema、迁移、数据库连接、seed、仓储和只读 API route。业务读取必须从服务端 `AccessContext` 推导租户，调用 `canAccessResource`，再进入仓储查询；权限拒绝和允许读取都可写入审计事件。

**技术栈：** Next.js App Router、TypeScript、Vitest、Drizzle ORM、PostgreSQL、postgres.js、drizzle-kit、tsx。

---

## 文件结构

新增文件：

- `drizzle.config.ts`
  - Drizzle 迁移配置，读取 `DATABASE_URL`。
- `src/server/db/schema.ts`
  - 定义 `tenants`、`tenantMembers`、`customers`、`appointments`、`followUpTasks`、`auditEvents`。
- `src/server/db/client.ts`
  - 创建 PostgreSQL client 和 Drizzle db。
- `src/server/db/seed-demo-data.ts`
  - 将第二阶段演示领域数据写入数据库。
- `src/modules/institution/server/tenant-business-repository.ts`
  - 从数据库读取客户、预约和随访任务。
- `src/modules/audit/server/audit-event-repository.ts`
  - 写入审计事件。
- `src/modules/institution/server/tenant-business-api.ts`
  - API route 共用的访问控制、仓储调用和审计记录流程。
- `src/app/api/institution/customers/route.ts`
- `src/app/api/institution/appointments/route.ts`
- `src/app/api/institution/followups/route.ts`
- `src/server/db/tests/Schema.test.ts`
- `src/modules/institution/tests/TenantBusinessRepository.test.ts`
- `src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`
- `src/modules/audit/tests/AuditEventRepository.test.ts`

修改文件：

- `package.json`
  - 新增 Drizzle、Postgres、tsx 依赖和脚本。
- `docs/security/tenant-rbac-phase1.md`
  - 增加第三阶段落库约束。
- `docs/operations/local-development.md`
  - 记录本地数据库配置和 seed 命令。

不修改文件：

- `.env*`
- 机构端页面组件
- 开放平台页面组件

## 任务 1：新增 Drizzle 与数据库脚本

**涉及文件：**

- 修改：`package.json`
- 新增：`drizzle.config.ts`

- [ ] **步骤 1：安装依赖**

运行：

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit tsx
```

预期：`package.json` 和锁文件更新，新增运行时依赖 `drizzle-orm`、`postgres`，新增开发依赖 `drizzle-kit`、`tsx`。

- [ ] **步骤 2：新增数据库脚本**

修改 `package.json` 的 `scripts`：

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:seed": "tsx src/server/db/seed-demo-data.ts"
}
```

保留现有脚本，不删除 `dev`、`build`、`lint`、`typecheck`、`test`、`preflight`。

- [ ] **步骤 3：新增 Drizzle 配置**

创建 `drizzle.config.ts`：

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
});
```

- [ ] **步骤 4：运行基础检查**

运行：

```bash
pnpm exec tsc --noEmit
```

预期：通过。此时 schema 尚未创建，若 TypeScript 报 `src/server/db/schema.ts` 缺失，先创建空导出文件：

```ts
export {};
```

然后继续任务 2 填充 schema。

- [ ] **步骤 5：提交**

```bash
git add package.json pnpm-lock.yaml drizzle.config.ts src/server/db/schema.ts
git commit -m "新增数据库落库工具配置"
```

## 任务 2：新增数据库 schema 和迁移

**涉及文件：**

- 新建或修改：`src/server/db/schema.ts`
- 新增测试：`src/server/db/tests/Schema.test.ts`
- 新增：`drizzle/*.sql`

- [ ] **步骤 1：编写失败测试**

创建 `src/server/db/tests/Schema.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  appointments,
  auditEvents,
  customers,
  followUpTasks,
  tenantMembers,
  tenants,
} from '@/server/db/schema';

describe('数据库 schema', () => {
  it('定义租户业务和审计表', () => {
    expect(tenants).toBeDefined();
    expect(tenantMembers).toBeDefined();
    expect(customers).toBeDefined();
    expect(appointments).toBeDefined();
    expect(followUpTasks).toBeDefined();
    expect(auditEvents).toBeDefined();
  });

  it('客户 schema 只包含脱敏字段', () => {
    expect(customers.maskedPhone).toBeDefined();
    expect(customers.maskedMedicalRecordNo).toBeDefined();
    expect('phoneNumber' in customers).toBe(false);
    expect('idNumber' in customers).toBe(false);
    expect('medicalRecordNo' in customers).toBe(false);
    expect('treatmentRecord' in customers).toBe(false);
    expect('consultationTranscript' in customers).toBe(false);
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/server/db/tests/Schema.test.ts
```

预期：失败，原因是 schema 还没有导出这些表。

- [ ] **步骤 3：实现 schema**

创建或替换 `src/server/db/schema.ts`：

```ts
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended']);
export const authRoleEnum = pgEnum('auth_role', [
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
  'platform_admin',
  'platform_operator',
  'security_auditor',
]);
export const customerLifecycleEnum = pgEnum('customer_lifecycle', [
  'consulting',
  'scheduled',
  'post_care',
  'repurchase_window',
  'silent_reactivation',
]);
export const customerPriorityEnum = pgEnum('customer_priority', ['high', 'medium', 'observe']);
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'pending_confirmation',
  'confirmed',
  'arrived',
  'completed',
  'reschedule_requested',
  'cancelled',
]);
export const followUpStatusEnum = pgEnum('follow_up_status', [
  'scheduled',
  'due',
  'in_progress',
  'escalated',
  'completed',
  'cancelled',
]);
export const followUpRiskLevelEnum = pgEnum('follow_up_risk_level', ['normal', 'watch', 'urgent']);
export const auditResultEnum = pgEnum('audit_result', ['allowed', 'denied', 'transitioned']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const tenants = pgTable('tenants', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  status: tenantStatusEnum('status').notNull().default('active'),
  ...timestamps,
});

export const tenantMembers = pgTable(
  'tenant_members',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id),
    userId: varchar('user_id', { length: 96 }).notNull(),
    role: authRoleEnum('role').notNull(),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantUserIdx: index('tenant_members_tenant_user_idx').on(table.tenantId, table.userId),
    tenantRoleIdx: index('tenant_members_tenant_role_idx').on(table.tenantId, table.role),
  }),
);

export const customers = pgTable(
  'customers',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    lifecycle: customerLifecycleEnum('lifecycle').notNull(),
    priority: customerPriorityEnum('priority').notNull(),
    ownerUserId: varchar('owner_user_id', { length: 96 }).notNull(),
    projectInterest: varchar('project_interest', { length: 160 }).notNull(),
    maskedPhone: varchar('masked_phone', { length: 32 }).notNull(),
    maskedMedicalRecordNo: varchar('masked_medical_record_no', { length: 64 }).notNull(),
    lastTouchSummary: text('last_touch_summary').notNull(),
    nextAction: text('next_action').notNull(),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    ...timestamps,
  },
  (table) => ({
    tenantIdx: index('customers_tenant_idx').on(table.tenantId),
    tenantPriorityIdx: index('customers_tenant_priority_idx').on(table.tenantId, table.priority),
  }),
);

export const appointments = pgTable(
  'appointments',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    customerDisplayName: varchar('customer_display_name', { length: 120 }).notNull(),
    project: varchar('project', { length: 160 }).notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    consultantUserId: varchar('consultant_user_id', { length: 96 }).notNull(),
    status: appointmentStatusEnum('status').notNull(),
    note: text('note').notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantStatusIdx: index('appointments_tenant_status_idx').on(table.tenantId, table.status),
  }),
);

export const followUpTasks = pgTable(
  'follow_up_tasks',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull().references(() => tenants.id),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    customerDisplayName: varchar('customer_display_name', { length: 120 }).notNull(),
    journeyId: varchar('journey_id', { length: 96 }).notNull(),
    stage: varchar('stage', { length: 120 }).notNull(),
    status: followUpStatusEnum('status').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    suggestedAction: text('suggested_action').notNull(),
    riskLevel: followUpRiskLevelEnum('risk_level').notNull(),
    updatedBy: varchar('updated_by', { length: 96 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('follow_up_tasks_tenant_status_idx').on(table.tenantId, table.status),
  }),
);

export const auditEvents = pgTable(
  'audit_events',
  {
    eventId: varchar('event_id', { length: 96 }).primaryKey(),
    actorId: varchar('actor_id', { length: 96 }).notNull(),
    actorRole: authRoleEnum('actor_role').notNull(),
    tenantId: varchar('tenant_id', { length: 64 }),
    scope: varchar('scope', { length: 24 }).notNull(),
    resource: varchar('resource', { length: 64 }).notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    result: auditResultEnum('result').notNull(),
    reason: varchar('reason', { length: 80 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    source: varchar('source', { length: 48 }).notNull(),
  },
  (table) => ({
    tenantOccurredIdx: index('audit_events_tenant_occurred_idx').on(table.tenantId, table.occurredAt),
    actorOccurredIdx: index('audit_events_actor_occurred_idx').on(table.actorId, table.occurredAt),
  }),
);
```

- [ ] **步骤 4：运行 schema 测试**

运行：

```bash
node scripts/run-vitest.mjs run src/server/db/tests/Schema.test.ts
```

预期：通过。

- [ ] **步骤 5：生成迁移**

运行：

```bash
pnpm db:generate
```

预期：`drizzle/` 下生成 SQL 迁移文件，包含六张表和枚举类型。

- [ ] **步骤 6：提交**

```bash
git add src/server/db/schema.ts src/server/db/tests/Schema.test.ts drizzle
git commit -m "新增租户业务数据库 schema"
```

## 任务 3：新增数据库连接和 seed

**涉及文件：**

- 新建：`src/server/db/client.ts`
- 新建：`src/server/db/seed-demo-data.ts`
- 测试：`src/server/db/tests/Schema.test.ts`

- [ ] **步骤 1：编写连接配置测试**

在 `src/server/db/tests/Schema.test.ts` 增加：

```ts
import { createDatabaseUrlErrorMessage } from '@/server/db/client';

it('数据库连接错误提示不泄露连接串', () => {
  expect(createDatabaseUrlErrorMessage()).toBe('DATABASE_URL is required to use tenant persistence');
  expect(createDatabaseUrlErrorMessage()).not.toContain('postgres://');
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/server/db/tests/Schema.test.ts
```

预期：失败，原因是 `@/server/db/client` 尚不存在。

- [ ] **步骤 3：实现数据库连接**

创建 `src/server/db/client.ts`：

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/server/db/schema';

export function createDatabaseUrlErrorMessage() {
  return 'DATABASE_URL is required to use tenant persistence';
}

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(createDatabaseUrlErrorMessage());
  }
  return url;
}

export function createPostgresClient(databaseUrl = getDatabaseUrl()) {
  return postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });
}

export function createDatabase(client = createPostgresClient()) {
  return drizzle(client, { schema });
}

export type TenantDatabase = ReturnType<typeof createDatabase>;

let cachedClient: ReturnType<typeof createPostgresClient> | null = null;
let cachedDatabase: TenantDatabase | null = null;

export function getDatabase() {
  if (!cachedClient) {
    cachedClient = createPostgresClient();
  }
  if (!cachedDatabase) {
    cachedDatabase = createDatabase(cachedClient);
  }
  return cachedDatabase;
}
```

- [ ] **步骤 4：实现 seed**

创建 `src/server/db/seed-demo-data.ts`：

```ts
import { createDatabase, createPostgresClient } from '@/server/db/client';
import {
  appointments,
  customers,
  followUpTasks,
  tenantMembers,
  tenants,
} from '@/server/db/schema';
import { demoTenantAppointmentRecords } from '@/modules/institution/domain/appointment-records';
import { demoTenantCustomerRecords } from '@/modules/institution/domain/customer-records';
import { demoTenantFollowUpTasks } from '@/modules/institution/domain/followup-workflow';

const queryClient = createPostgresClient();
const db = createDatabase(queryClient);

async function seed() {
  await db.insert(tenants).values([
    { id: 'demo-tenant-001', name: '智美天工演示机构', status: 'active' },
    { id: 'demo-tenant-002', name: '跨租户隔离演示机构', status: 'active' },
  ]).onConflictDoNothing();

  await db.insert(tenantMembers).values([
    {
      id: 'member-demo-admin',
      tenantId: 'demo-tenant-001',
      userId: 'demo-user-admin',
      role: 'tenant_admin',
      displayName: '系统管理员',
    },
  ]).onConflictDoNothing();

  await db.insert(customers).values(
    demoTenantCustomerRecords.map((record) => ({
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
    })),
  ).onConflictDoNothing();

  await db.insert(appointments).values(
    demoTenantAppointmentRecords.map((record) => ({
      ...record,
      scheduledAt: new Date(record.scheduledAt),
    })),
  ).onConflictDoNothing();

  await db.insert(followUpTasks).values(
    demoTenantFollowUpTasks.map((task) => ({
      ...task,
      dueAt: new Date(task.dueAt),
      updatedAt: task.updatedAt ? new Date(task.updatedAt) : null,
    })),
  ).onConflictDoNothing();
}

seed()
  .then(async () => {
    await queryClient.end();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await queryClient.end();
    process.exit(1);
  });
```

- [ ] **步骤 5：运行测试和类型检查**

运行：

```bash
node scripts/run-vitest.mjs run src/server/db/tests/Schema.test.ts
pnpm exec tsc --noEmit
```

预期：测试和类型检查通过。

- [ ] **步骤 6：提交**

```bash
git add src/server/db/client.ts src/server/db/seed-demo-data.ts src/server/db/tests/Schema.test.ts
git commit -m "新增数据库连接和演示数据种子"
```

## 任务 4：新增仓储层

**涉及文件：**

- 新建：`src/modules/institution/server/tenant-business-repository.ts`
- 新建：`src/modules/audit/server/audit-event-repository.ts`
- 新增测试：`src/modules/institution/tests/TenantBusinessRepository.test.ts`
- 新增测试：`src/modules/audit/tests/AuditEventRepository.test.ts`

- [ ] **步骤 1：编写机构仓储失败测试**

创建 `src/modules/institution/tests/TenantBusinessRepository.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  mapAppointmentRowToRecord,
  mapCustomerRowToRecord,
  mapFollowUpTaskRowToRecord,
} from '@/modules/institution/server/tenant-business-repository';

describe('租户业务仓储映射', () => {
  it('把客户数据库行映射为领域记录且只保留脱敏字段', () => {
    const record = mapCustomerRowToRecord({
      id: 'cust_001',
      tenantId: 'demo-tenant-001',
      displayName: '王女士',
      lifecycle: 'repurchase_window',
      priority: 'high',
      ownerUserId: 'consultant-lin',
      projectInterest: '热玛吉修复组合',
      maskedPhone: '138****1208',
      maskedMedicalRecordNo: 'MR****001',
      lastTouchSummary: '术后第 28 天',
      nextAction: '人工回访',
      tags: ['高价值'],
      createdAt: new Date('2026-05-30T00:00:00.000Z'),
      updatedAt: new Date('2026-05-30T00:00:00.000Z'),
    });

    expect(record).toMatchObject({
      id: 'cust_001',
      tenantId: 'demo-tenant-001',
      maskedPhone: '138****1208',
    });
    expect(JSON.stringify(record)).not.toMatch(/phoneNumber|idNumber|medicalRecordNo/);
  });

  it('把预约和随访行映射为领域记录', () => {
    expect(
      mapAppointmentRowToRecord({
        id: 'appt_001',
        tenantId: 'demo-tenant-001',
        customerId: 'cust_001',
        customerDisplayName: '王女士',
        project: '水光补水',
        scheduledAt: new Date('2026-06-01T02:30:00.000Z'),
        consultantUserId: 'consultant-xu',
        status: 'pending_confirmation',
        note: '待确认',
        createdAt: new Date('2026-05-30T00:00:00.000Z'),
        updatedAt: new Date('2026-05-30T00:00:00.000Z'),
      }),
    ).toMatchObject({ id: 'appt_001', status: 'pending_confirmation' });

    expect(
      mapFollowUpTaskRowToRecord({
        id: 'fu_001',
        tenantId: 'demo-tenant-001',
        customerId: 'cust_001',
        customerDisplayName: '王女士',
        journeyId: 'journey_repurchase',
        stage: 'D28 复购建议',
        status: 'due',
        dueAt: new Date('2026-05-30T10:00:00.000Z'),
        suggestedAction: '人工回访',
        riskLevel: 'urgent',
        updatedBy: null,
        updatedAt: null,
        createdAt: new Date('2026-05-30T00:00:00.000Z'),
      }),
    ).toMatchObject({ id: 'fu_001', status: 'due', riskLevel: 'urgent' });
  });
});
```

- [ ] **步骤 2：编写审计仓储失败测试**

创建 `src/modules/audit/tests/AuditEventRepository.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { mapAuditEventToInsert } from '@/modules/audit/server/audit-event-repository';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';

describe('审计事件仓储映射', () => {
  it('把审计事件映射为数据库写入行', () => {
    const event: TenantAuditEvent = {
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
    };

    expect(mapAuditEventToInsert(event)).toEqual({
      ...event,
      occurredAt: new Date('2026-05-30T09:00:00.000Z'),
    });
  });
});
```

- [ ] **步骤 3：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessRepository.test.ts src/modules/audit/tests/AuditEventRepository.test.ts
```

预期：失败，原因是两个 server 仓储模块尚不存在。

- [ ] **步骤 4：实现机构仓储**

创建 `src/modules/institution/server/tenant-business-repository.ts`：

```ts
import { eq } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, customers, followUpTasks } from '@/server/db/schema';
import type { AppointmentRecordSummary } from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type { TenantFollowUpTask } from '@/modules/institution/domain/followup-workflow';

type CustomerRow = typeof customers.$inferSelect;
type AppointmentRow = typeof appointments.$inferSelect;
type FollowUpTaskRow = typeof followUpTasks.$inferSelect;

export function mapCustomerRowToRecord(row: CustomerRow): CustomerRecordSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    displayName: row.displayName,
    lifecycle: row.lifecycle,
    priority: row.priority,
    ownerUserId: row.ownerUserId,
    projectInterest: row.projectInterest,
    maskedPhone: row.maskedPhone,
    maskedMedicalRecordNo: row.maskedMedicalRecordNo,
    lastTouchSummary: row.lastTouchSummary,
    nextAction: row.nextAction,
    tags: row.tags,
  };
}

export function mapAppointmentRowToRecord(row: AppointmentRow): AppointmentRecordSummary {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    customerDisplayName: row.customerDisplayName,
    project: row.project,
    scheduledAt: row.scheduledAt.toISOString(),
    consultantUserId: row.consultantUserId,
    status: row.status,
    note: row.note,
  };
}

export function mapFollowUpTaskRowToRecord(row: FollowUpTaskRow): TenantFollowUpTask {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerId: row.customerId,
    customerDisplayName: row.customerDisplayName,
    journeyId: row.journeyId,
    stage: row.stage,
    status: row.status,
    dueAt: row.dueAt.toISOString(),
    suggestedAction: row.suggestedAction,
    riskLevel: row.riskLevel,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export function createTenantBusinessRepository(database: TenantDatabase) {
  return {
    async listCustomersByTenant(tenantId: string) {
      const rows = await database.select().from(customers).where(eq(customers.tenantId, tenantId));
      return rows.map(mapCustomerRowToRecord);
    },
    async listAppointmentsByTenant(tenantId: string) {
      const rows = await database.select().from(appointments).where(eq(appointments.tenantId, tenantId));
      return rows.map(mapAppointmentRowToRecord);
    },
    async listFollowUpTasksByTenant(tenantId: string) {
      const rows = await database.select().from(followUpTasks).where(eq(followUpTasks.tenantId, tenantId));
      return rows.map(mapFollowUpTaskRowToRecord);
    },
  };
}
```

- [ ] **步骤 5：实现审计仓储**

创建 `src/modules/audit/server/audit-event-repository.ts`：

```ts
import type { TenantDatabase } from '@/server/db/client';
import { auditEvents } from '@/server/db/schema';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';

export function mapAuditEventToInsert(event: TenantAuditEvent): typeof auditEvents.$inferInsert {
  return {
    ...event,
    occurredAt: new Date(event.occurredAt),
  };
}

export function createAuditEventRepository(database: TenantDatabase) {
  return {
    async record(event: TenantAuditEvent) {
      await database.insert(auditEvents).values(mapAuditEventToInsert(event));
    },
  };
}
```

- [ ] **步骤 6：运行仓储测试**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessRepository.test.ts src/modules/audit/tests/AuditEventRepository.test.ts
```

预期：通过。

- [ ] **步骤 7：提交**

```bash
git add src/modules/institution/server/tenant-business-repository.ts src/modules/audit/server/audit-event-repository.ts src/modules/institution/tests/TenantBusinessRepository.test.ts src/modules/audit/tests/AuditEventRepository.test.ts
git commit -m "新增租户业务和审计仓储"
```

## 任务 5：新增只读 API route

**涉及文件：**

- 新建：`src/modules/institution/server/tenant-business-api.ts`
- 新建：`src/app/api/institution/customers/route.ts`
- 新建：`src/app/api/institution/appointments/route.ts`
- 新建：`src/app/api/institution/followups/route.ts`
- 新增测试：`src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`

- [ ] **步骤 1：编写失败测试**

创建 `src/modules/institution/tests/TenantBusinessApiRoutes.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest';
import type { AccessContext } from '@/modules/security/domain/access-control';
import { handleTenantBusinessListRequest } from '@/modules/institution/server/tenant-business-api';

const tenantContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

describe('租户业务只读 API 流程', () => {
  it('使用服务端上下文租户读取客户，不信任 URL 租户参数', async () => {
    const repository = {
      listCustomersByTenant: vi.fn(async () => [{ id: 'cust_001', tenantId: 'demo-tenant-001' }]),
      listAppointmentsByTenant: vi.fn(),
      listFollowUpTasksByTenant: vi.fn(),
    };
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessListRequest({
      request: new Request('http://localhost/api/institution/customers?tenantId=other-tenant'),
      context: tenantContext,
      resource: 'customer',
      list: repository.listCustomersByTenant,
      auditRepository,
    });

    expect(response.status).toBe(200);
    expect(repository.listCustomersByTenant).toHaveBeenCalledWith('demo-tenant-001');
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'allowed',
      tenantId: 'demo-tenant-001',
      resource: 'customer',
    }));
  });

  it('没有访问上下文时返回 401', async () => {
    const response = await handleTenantBusinessListRequest({
      request: new Request('http://localhost/api/institution/customers'),
      context: null,
      resource: 'customer',
      list: vi.fn(),
      auditRepository: { record: vi.fn(async () => undefined) },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
  });

  it('权限拒绝时返回 403 并写入审计事件', async () => {
    const platformContext: AccessContext = {
      userId: 'demo-user-platform',
      role: 'platform_admin',
      scope: 'platform',
      tenantId: null,
      source: 'demo_session',
    };
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessListRequest({
      request: new Request('http://localhost/api/institution/customers'),
      context: platformContext,
      resource: 'customer',
      list: vi.fn(),
      auditRepository,
    });

    expect(response.status).toBe(403);
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'role_denied',
    }));
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
```

预期：失败，原因是 `tenant-business-api` 尚不存在。

- [ ] **步骤 3：实现共用 API 流程**

创建 `src/modules/institution/server/tenant-business-api.ts`：

```ts
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import { createAuditEvent, createDeniedAccessAuditEvent } from '@/modules/audit/domain/audit-events';
import type { AccessContext, ProtectedResource } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';

type AuditRepository = {
  record(event: TenantAuditEvent): Promise<void>;
};

type BusinessResource = Extract<ProtectedResource, 'customer' | 'appointment' | 'follow_up'>;

function resourceAction(resource: BusinessResource) {
  return 'read_own_tenant' as const;
}

function eventId(prefix: string) {
  return `${prefix}_${Date.now()}`;
}

export async function handleTenantBusinessListRequest<T>(input: {
  request: Request;
  context: AccessContext | null;
  resource: BusinessResource;
  list(tenantId: string): Promise<T[]>;
  auditRepository: AuditRepository;
}) {
  const { context, resource, list, auditRepository } = input;

  if (!context) {
    return Response.json({ error: '请先登录' }, { status: 401 });
  }

  const targetTenantId = context.tenantId;
  const decision = canAccessResource({
    context,
    resource,
    action: resourceAction(resource),
    targetTenantId,
  });

  if (!decision.allowed) {
    await auditRepository.record(
      createDeniedAccessAuditEvent({
        eventId: eventId('audit_denied'),
        context,
        resource,
        action: resourceAction(resource),
        reason: decision.reason,
        occurredAt: new Date().toISOString(),
      }),
    );
    return Response.json({ error: '当前账号无权访问该资源' }, { status: 403 });
  }

  const tenantId = context.tenantId;
  if (!tenantId) {
    await auditRepository.record(
      createDeniedAccessAuditEvent({
        eventId: eventId('audit_denied'),
        context,
        resource,
        action: resourceAction(resource),
        reason: 'missing_tenant',
        occurredAt: new Date().toISOString(),
      }),
    );
    return Response.json({ error: '当前账号无权访问该资源' }, { status: 403 });
  }

  const records = await list(tenantId);
  await auditRepository.record(
    createAuditEvent({
      eventId: eventId('audit_allowed'),
      context,
      resource,
      action: resourceAction(resource),
      result: 'allowed',
      reason: 'allowed_by_policy',
      occurredAt: new Date().toISOString(),
    }),
  );

  return Response.json({ records }, { status: 200 });
}
```

- [ ] **步骤 4：新增 API route**

创建 `src/app/api/institution/customers/route.ts`：

```ts
import { getDatabase } from '@/server/db/client';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { handleTenantBusinessListRequest } from '@/modules/institution/server/tenant-business-api';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

export async function GET(request: Request) {
  try {
    const db = getDatabase();
    const repository = createTenantBusinessRepository(db);
    return await handleTenantBusinessListRequest({
      request,
      context: getDemoAccessContextFromRequest(request),
      resource: 'customer',
      list: repository.listCustomersByTenant,
      auditRepository: createAuditEventRepository(db),
    });
  } catch {
    return Response.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
```

创建 `src/app/api/institution/appointments/route.ts`：

```ts
import { getDatabase } from '@/server/db/client';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { handleTenantBusinessListRequest } from '@/modules/institution/server/tenant-business-api';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

export async function GET(request: Request) {
  try {
    const db = getDatabase();
    const repository = createTenantBusinessRepository(db);
    return await handleTenantBusinessListRequest({
      request,
      context: getDemoAccessContextFromRequest(request),
      resource: 'appointment',
      list: repository.listAppointmentsByTenant,
      auditRepository: createAuditEventRepository(db),
    });
  } catch {
    return Response.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
```

创建 `src/app/api/institution/followups/route.ts`：

```ts
import { getDatabase } from '@/server/db/client';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { handleTenantBusinessListRequest } from '@/modules/institution/server/tenant-business-api';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

export async function GET(request: Request) {
  try {
    const db = getDatabase();
    const repository = createTenantBusinessRepository(db);
    return await handleTenantBusinessListRequest({
      request,
      context: getDemoAccessContextFromRequest(request),
      resource: 'follow_up',
      list: repository.listFollowUpTasksByTenant,
      auditRepository: createAuditEventRepository(db),
    });
  } catch {
    return Response.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
```

- [ ] **步骤 5：运行 API 测试**

运行：

```bash
node scripts/run-vitest.mjs run src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
```

预期：通过。

- [ ] **步骤 6：提交**

```bash
git add src/modules/institution/server/tenant-business-api.ts src/app/api/institution/customers/route.ts src/app/api/institution/appointments/route.ts src/app/api/institution/followups/route.ts src/modules/institution/tests/TenantBusinessApiRoutes.test.ts
git commit -m "新增租户业务只读 API"
```

## 任务 6：更新文档

**涉及文件：**

- 修改：`docs/security/tenant-rbac-phase1.md`
- 修改：`docs/operations/local-development.md`

- [ ] **步骤 1：更新安全文档**

在 `docs/security/tenant-rbac-phase1.md` 末尾追加：

```md
## 第三阶段真实落库约束

第三阶段允许新增 PostgreSQL、Drizzle schema、迁移、seed、只读仓储和只读 API route。

真实落库必须遵守：

1. 客户、预约、随访读取只使用服务端 `AccessContext` 推导租户。
2. API route 不接受查询参数、请求体或 header 中的租户编号作为最终授权依据。
3. 客户表只保存脱敏展示字段，不保存手机号、身份证号、病历号、治疗记录正文或咨询对话。
4. 权限拒绝、跨租户拒绝和允许读取都可以写入 `audit_events`。
5. 数据库连接错误不能向前端暴露连接串。
```

- [ ] **步骤 2：更新本地开发文档**

在 `docs/operations/local-development.md` 增加：

````md
## 本地数据库

第三阶段使用 PostgreSQL + Drizzle。需要在本地 shell 中设置 `DATABASE_URL`，不要把真实连接串提交到仓库。

常用命令：

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

如果没有配置 `DATABASE_URL`，应用中的真实落库 API 会返回稳定错误，不应泄露连接串。
````

- [ ] **步骤 3：检查文档未完成词**

运行：

```bash
pattern=$(node -e "process.stdout.write([String.fromCodePoint(0x5f85,0x5b9a), String.fromCodePoint(0x7a0d,0x540e), String.fromCodePoint(0x5360,0x4f4d), 'TO' + 'DO', 'TB' + 'D'].join('|'))")
rg -n "$pattern" docs/security/tenant-rbac-phase1.md docs/operations/local-development.md
```

预期：没有输出，命令退出码为 1。

- [ ] **步骤 4：提交**

```bash
git add docs/security/tenant-rbac-phase1.md docs/operations/local-development.md
git commit -m "补充真实落库开发和安全文档"
```

## 任务 7：全量验证与 PR 准备

**涉及文件：**

- 检查：所有第三阶段新增和修改文件。

- [ ] **步骤 1：运行 lint**

运行：

```bash
./node_modules/.bin/eslint .
```

预期：0 个错误。当前项目可能仍有既有 `src/modules/auth/components/LuxuryLoginShell.tsx` 的 `@next/next/no-img-element` warning，需要在总结中说明。

- [ ] **步骤 2：运行全量测试**

运行：

```bash
node scripts/run-vitest.mjs run
```

预期：所有测试通过。

- [ ] **步骤 3：运行构建和类型检查**

运行：

```bash
node scripts/run-next.mjs build --webpack
./node_modules/.bin/tsc --noEmit
```

预期：构建通过，类型检查通过。

- [ ] **步骤 4：检查迁移和 diff 范围**

运行：

```bash
git status -sb
git diff --stat main...HEAD
git diff --check
git diff --name-only main...HEAD
```

预期：

- 工作区干净。
- diff 包含 Drizzle 配置、schema、迁移、seed、仓储、只读 API、测试和文档。
- diff 不包含 `.env*`。
- diff 不包含写入型客户、预约、随访 API。
- diff 不包含 API Key、OAuth、Webhook 真实凭证实现。

- [ ] **步骤 5：准备 PR 描述**

PR 标题：

```text
租户业务真实落库第三阶段
```

PR 正文：

```md
## 变更摘要

- 新增 PostgreSQL + Drizzle schema、迁移和 seed 流程。
- 新增客户、预约、随访只读仓储和只读 API route。
- 新增审计事件写入仓储，记录允许和拒绝访问结果。
- 补充真实落库阶段的本地开发和安全约束文档。

## 验证结果

- `./node_modules/.bin/eslint .`
- `node scripts/run-vitest.mjs run`
- `node scripts/run-next.mjs build --webpack`
- `./node_modules/.bin/tsc --noEmit`

## 风险说明

- 本阶段新增数据库依赖、schema 和只读 API，需要重点 review 迁移和租户过滤。
- 本阶段不保存真实 PII，不实现写入型业务流程。
- API route 必须只使用服务端访问上下文推导租户。
```

## 自审清单

- [ ] schema 不包含真实 PII 字段。
- [ ] seed 数据只包含脱敏字段。
- [ ] 只读仓储按 `tenantId` 查询。
- [ ] API route 不信任查询参数、请求体或 header 中的租户编号。
- [ ] 权限拒绝写入审计事件。
- [ ] 数据库连接错误不泄露连接串。
- [ ] 没有提交 `.env*`。
- [ ] 没有实现写入型客户、预约、随访 API。
- [ ] 没有实现 API Key、OAuth、Webhook 真实凭证能力。
