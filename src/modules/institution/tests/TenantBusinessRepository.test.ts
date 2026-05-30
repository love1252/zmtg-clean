import { describe, expect, it, vi } from 'vitest';
import { appointments, customers, followUpTasks } from '@/server/db/schema';
import type { TenantDatabase } from '@/server/db/client';
import {
  createTenantBusinessRepository,
  mapAppointmentRowToRecord,
  mapCustomerRowToRecord,
  mapFollowUpTaskRowToRecord,
} from '@/modules/institution/server/tenant-business-repository';

const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'eq',
    value,
  })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: eqMock,
  };
});

function createSelectDatabase(rows: unknown[] = []) {
  const where = vi.fn(async () => rows);
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    select,
    where,
  };
}

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
    expect(record).not.toHaveProperty('createdAt');
    expect(record).not.toHaveProperty('updatedAt');
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

  it('列表查询按 tenantId 过滤客户、预约和随访任务', async () => {
    const customerQuery = createSelectDatabase();
    await createTenantBusinessRepository(customerQuery.database).listCustomersByTenant(
      'demo-tenant-001',
    );

    expect(customerQuery.from).toHaveBeenCalledWith(customers);
    expect(eqMock).toHaveBeenLastCalledWith(customers.tenantId, 'demo-tenant-001');
    expect(customerQuery.where).toHaveBeenCalledWith({
      column: customers.tenantId,
      operator: 'eq',
      value: 'demo-tenant-001',
    });

    const appointmentQuery = createSelectDatabase();
    await createTenantBusinessRepository(appointmentQuery.database).listAppointmentsByTenant(
      'demo-tenant-001',
    );

    expect(appointmentQuery.from).toHaveBeenCalledWith(appointments);
    expect(eqMock).toHaveBeenLastCalledWith(appointments.tenantId, 'demo-tenant-001');
    expect(appointmentQuery.where).toHaveBeenCalledWith({
      column: appointments.tenantId,
      operator: 'eq',
      value: 'demo-tenant-001',
    });

    const followUpQuery = createSelectDatabase();
    await createTenantBusinessRepository(followUpQuery.database).listFollowUpTasksByTenant(
      'demo-tenant-001',
    );

    expect(followUpQuery.from).toHaveBeenCalledWith(followUpTasks);
    expect(eqMock).toHaveBeenLastCalledWith(followUpTasks.tenantId, 'demo-tenant-001');
    expect(followUpQuery.where).toHaveBeenCalledWith({
      column: followUpTasks.tenantId,
      operator: 'eq',
      value: 'demo-tenant-001',
    });
  });
});
