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
