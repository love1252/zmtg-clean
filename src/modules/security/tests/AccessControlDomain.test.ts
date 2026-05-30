import { describe, expect, it } from 'vitest';
import {
  ACCESS_ACTIONS,
  ACCESS_RESOURCES,
  ACCESS_ROLES,
  canAccessResource,
} from '@/modules/security/domain/access-control';

const tenantAdminContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
} as const;

const platformAdminContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
} as const;

const platformOperatorContext = {
  userId: 'demo-user-platform-operator',
  role: 'platform_operator',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
} as const;

const securityAuditorContext = {
  userId: 'demo-user-auditor',
  role: 'security_auditor',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
} as const;

describe('访问控制领域', () => {
  it('定义稳定角色、资源和动作', () => {
    expect(ACCESS_ROLES).toEqual([
      'tenant_admin',
      'tenant_operator',
      'consultant',
      'customer_service',
      'platform_admin',
      'platform_operator',
      'security_auditor',
    ]);
    expect(ACCESS_RESOURCES).toEqual([
      'tenant',
      'tenant_member',
      'customer',
      'appointment',
      'follow_up',
      'open_connection',
      'permission_policy',
      'audit_log',
      'platform_health',
    ]);
    expect(ACCESS_ACTIONS).toContain('read_own_tenant');
    expect(ACCESS_ACTIONS).toContain('read_aggregate');
    expect(ACCESS_ACTIONS).toContain('export_report');
  });

  it('允许机构管理员读取本租户资源', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'customer',
        action: 'read_own_tenant',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it('拒绝机构管理员读取其他租户', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'customer',
        action: 'read_own_tenant',
        targetTenantId: 'other-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'cross_tenant_denied' });
  });

  it('拒绝缺少租户编号的租户作用域访问', () => {
    expect(
      canAccessResource({
        context: { ...tenantAdminContext, tenantId: null },
        resource: 'customer',
        action: 'read_own_tenant',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'missing_tenant' });
  });

  it('允许平台运营读取平台健康聚合态势', () => {
    expect(
      canAccessResource({
        context: platformOperatorContext,
        resource: 'platform_health',
        action: 'read_aggregate',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it('拒绝平台运营读取客户敏感明细', () => {
    expect(
      canAccessResource({
        context: platformOperatorContext,
        resource: 'customer',
        action: 'read_detail',
        targetTenantId: 'demo-tenant-001',
        containsSensitiveDetail: true,
      }),
    ).toEqual({ allowed: false, reason: 'sensitive_detail_denied' });
  });

  it('默认拒绝平台管理员读取客户敏感明细', () => {
    expect(
      canAccessResource({
        context: platformAdminContext,
        resource: 'customer',
        action: 'read_detail',
        targetTenantId: 'demo-tenant-001',
        containsSensitiveDetail: true,
      }),
    ).toEqual({ allowed: false, reason: 'sensitive_detail_denied' });
  });

  it('允许平台管理员管理租户状态', () => {
    expect(
      canAccessResource({
        context: platformAdminContext,
        resource: 'tenant',
        action: 'manage_status',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it('允许安全审计员导出审计报告', () => {
    expect(
      canAccessResource({
        context: securityAuditorContext,
        resource: 'audit_log',
        action: 'export_report',
      }),
    ).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it('默认拒绝未知策略组合', () => {
    expect(
      canAccessResource({
        context: tenantAdminContext,
        resource: 'permission_policy',
        action: 'manage_policy',
        targetTenantId: 'demo-tenant-001',
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });
  });
});
