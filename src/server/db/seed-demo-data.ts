import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDatabase, createPostgresClient, type TenantDatabase } from '@/server/db/client';
import {
  appointments,
  customers,
  followUpTasks,
  tenantPlanAssignments,
  tenantPlans,
  tenantQuotaSnapshots,
  tenantMembers,
  tenants,
} from '@/server/db/schema';
import { demoTenantAppointmentRecords } from '@/modules/institution/domain/appointment-records';
import {
  demoTenantCustomerRecords,
  type TenantCustomerRecord,
} from '@/modules/institution/domain/customer-records';
import { demoTenantFollowUpTasks } from '@/modules/institution/domain/followup-workflow';

const supplementalDemoCustomerRecords: TenantCustomerRecord[] = [
  {
    id: 'cust_liu_arrival',
    tenantId: 'demo-tenant-001',
    displayName: '刘女士',
    lifecycle: 'scheduled',
    priority: 'medium',
    ownerUserId: 'consultant-xu',
    projectInterest: '水光补水',
    maskedPhone: 'masked-demo-liu',
    maskedMedicalRecordNo: 'DEMO-MR-LIU',
    lastTouchSummary: '预约术前提醒待完成',
    nextAction: '发送脱敏演示提醒',
    tags: ['预约确认', '演示补充客户'],
  },
  {
    id: 'cust_qin_review',
    tenantId: 'demo-tenant-001',
    displayName: '秦女士',
    lifecycle: 'scheduled',
    priority: 'medium',
    ownerUserId: 'frontdesk-a',
    projectInterest: '玻尿酸复诊',
    maskedPhone: 'masked-demo-qin',
    maskedMedicalRecordNo: 'DEMO-MR-QIN',
    lastTouchSummary: '到院流程演示',
    nextAction: '等待接诊状态同步',
    tags: ['复诊', '演示补充客户'],
  },
  {
    id: 'cust_tang_thermage',
    tenantId: 'demo-tenant-001',
    displayName: '唐女士',
    lifecycle: 'consulting',
    priority: 'high',
    ownerUserId: 'consultant-lin',
    projectInterest: '热玛吉面诊',
    maskedPhone: 'masked-demo-tang',
    maskedMedicalRecordNo: 'DEMO-MR-TANG',
    lastTouchSummary: '专家档期协调中',
    nextAction: '确认脱敏演示档期',
    tags: ['改约', '演示补充客户'],
  },
  {
    id: 'cust_li_silent',
    tenantId: 'demo-tenant-001',
    displayName: '李女士',
    lifecycle: 'silent_reactivation',
    priority: 'observe',
    ownerUserId: 'service-group-a',
    projectInterest: '皮肤管理复访',
    maskedPhone: 'masked-demo-li',
    maskedMedicalRecordNo: 'DEMO-MR-LI',
    lastTouchSummary: '48h 未响应演示状态',
    nextAction: '发送轻量唤醒话术',
    tags: ['沉默唤醒', '演示补充客户'],
  },
];

type DemoCustomerReference = {
  source: 'appointment' | 'follow_up_task';
  recordId: string;
  tenantId: string;
  customerId: string;
};

const demoTenantPlanRecords: Array<typeof tenantPlans.$inferInsert> = [
  {
    id: 'plan-starter-care',
    name: '标准版',
    code: 'starter-care',
    description: '适合起步机构的基础运营演示套餐。',
    status: 'active',
  },
  {
    id: 'plan-growth-care',
    name: '成长版',
    code: 'growth-care',
    description: '适合增长期机构的进阶运营演示套餐。',
    status: 'active',
  },
];

const demoTenantPlanAssignmentRecords: Array<typeof tenantPlanAssignments.$inferInsert> = [
  {
    id: 'assign-demo-tenant-001-growth',
    tenantId: 'demo-tenant-001',
    planId: 'plan-growth-care',
    status: 'active',
    startedAt: new Date('2026-05-31T00:00:00.000Z'),
    expiresAt: null,
  },
  {
    id: 'assign-demo-tenant-002-starter',
    tenantId: 'demo-tenant-002',
    planId: 'plan-starter-care',
    status: 'active',
    startedAt: new Date('2026-05-31T00:00:00.000Z'),
    expiresAt: null,
  },
];

const demoTenantQuotaSnapshotRecords: Array<typeof tenantQuotaSnapshots.$inferInsert> = [
  {
    id: 'quota-demo-tenant-001-current',
    tenantId: 'demo-tenant-001',
    planAssignmentId: 'assign-demo-tenant-001-growth',
    maxCustomers: 5000,
    maxAppointments: 2000,
    maxFollowUps: 10000,
    maxAiCalls: 50000,
    currentCustomers: 7,
    currentAppointments: 5,
    currentFollowUps: 5,
    currentAiCalls: 0,
    snapshotAt: new Date('2026-05-31T08:00:00.000Z'),
  },
  {
    id: 'quota-demo-tenant-002-current',
    tenantId: 'demo-tenant-002',
    planAssignmentId: 'assign-demo-tenant-002-starter',
    maxCustomers: 1000,
    maxAppointments: 400,
    maxFollowUps: 2000,
    maxAiCalls: 0,
    currentCustomers: 1,
    currentAppointments: 0,
    currentFollowUps: 0,
    currentAiCalls: 0,
    snapshotAt: new Date('2026-05-31T08:00:00.000Z'),
  },
];

export function getDemoCustomerSeedRecords() {
  return [...demoTenantCustomerRecords, ...supplementalDemoCustomerRecords];
}

export function getDemoTenantPlanSeedRecords() {
  return [...demoTenantPlanRecords];
}

export function getDemoTenantPlanAssignmentSeedRecords() {
  return [...demoTenantPlanAssignmentRecords];
}

export function getDemoTenantQuotaSnapshotSeedRecords() {
  return [...demoTenantQuotaSnapshotRecords];
}

export function findMissingDemoCustomerReferences(
  customerRecords: TenantCustomerRecord[] = getDemoCustomerSeedRecords(),
) {
  const customerKeys = new Set(
    customerRecords.map((record) => `${record.tenantId}:${record.id}`),
  );
  const references: DemoCustomerReference[] = [
    ...demoTenantAppointmentRecords.map((record) => ({
      source: 'appointment' as const,
      recordId: record.id,
      tenantId: record.tenantId,
      customerId: record.customerId,
    })),
    ...demoTenantFollowUpTasks.map((task) => ({
      source: 'follow_up_task' as const,
      recordId: task.id,
      tenantId: task.tenantId,
      customerId: task.customerId,
    })),
  ];

  return references.filter(
    (reference) => !customerKeys.has(`${reference.tenantId}:${reference.customerId}`),
  );
}

export function assertDemoCustomerReferenceCoverage(
  customerRecords: TenantCustomerRecord[] = getDemoCustomerSeedRecords(),
) {
  const missingReferences = findMissingDemoCustomerReferences(customerRecords);

  if (missingReferences.length > 0) {
    throw new Error(
      `Demo seed customer references missing: ${missingReferences
        .map(
          (reference) =>
            `${reference.source}/${reference.recordId}->${reference.tenantId}:${reference.customerId}`,
        )
        .join(', ')}`,
    );
  }
}

function toCustomerSeedValue(record: TenantCustomerRecord) {
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

export async function seedDemoData(db: TenantDatabase) {
  assertDemoCustomerReferenceCoverage();

  await db
    .insert(tenants)
    .values([
      { id: 'demo-tenant-001', name: '智美天工演示机构', status: 'active' },
      { id: 'demo-tenant-002', name: '跨租户隔离演示机构', status: 'active' },
    ])
    .onConflictDoNothing();

  await db.insert(tenantPlans).values(getDemoTenantPlanSeedRecords()).onConflictDoNothing();

  await db
    .insert(tenantPlanAssignments)
    .values(getDemoTenantPlanAssignmentSeedRecords())
    .onConflictDoNothing();

  await db
    .insert(tenantQuotaSnapshots)
    .values(getDemoTenantQuotaSnapshotSeedRecords())
    .onConflictDoNothing();

  await db
    .insert(tenantMembers)
    .values([
      {
        id: 'member-demo-admin',
        tenantId: 'demo-tenant-001',
        userId: 'demo-user-admin',
        role: 'tenant_admin',
        displayName: '系统管理员',
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(customers)
    .values(getDemoCustomerSeedRecords().map(toCustomerSeedValue))
    .onConflictDoNothing();

  await db
    .insert(appointments)
    .values(
      demoTenantAppointmentRecords.map((record) => ({
        ...record,
        scheduledAt: new Date(record.scheduledAt),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(followUpTasks)
    .values(
      demoTenantFollowUpTasks.map((task) => ({
        ...task,
        dueAt: new Date(task.dueAt),
        updatedAt: task.updatedAt ? new Date(task.updatedAt) : null,
      })),
    )
    .onConflictDoNothing();
}

async function runSeed() {
  const queryClient = createPostgresClient();
  const db = createDatabase(queryClient);

  try {
    await seedDemoData(db);
  } finally {
    await queryClient.end();
  }
}

function isDirectRun() {
  return process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;
}

if (isDirectRun()) {
  runSeed().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
