import { describe, expect, it } from 'vitest';
import {
  demoTenantCustomerRecords,
  listCustomerRecordsForAccess,
} from '@/modules/institution/domain/customer-records';
import {
  demoTenantAppointmentRecords,
  listAppointmentRecordsForAccess,
} from '@/modules/institution/domain/appointment-records';
import {
  demoTenantFollowUpTasks,
  listFollowUpTasksForAccess,
  transitionFollowUpTask,
} from '@/modules/institution/domain/followup-workflow';
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
});
