import { describe, expect, it } from 'vitest';
import { AUTH_ROLES, isAuthRole } from '@/modules/auth/domain/session';

describe('认证会话领域', () => {
  it('暴露支持的角色边界', () => {
    expect(AUTH_ROLES).toEqual([
      'tenant_admin',
      'tenant_operator',
      'consultant',
      'customer_service',
      'platform_admin',
      'platform_operator',
      'security_auditor',
    ]);
  });

  it('识别已知认证角色', () => {
    expect(isAuthRole('tenant_admin')).toBe(true);
    expect(isAuthRole('tenant_operator')).toBe(true);
    expect(isAuthRole('consultant')).toBe(true);
    expect(isAuthRole('customer_service')).toBe(true);
    expect(isAuthRole('platform_admin')).toBe(true);
    expect(isAuthRole('platform_operator')).toBe(true);
    expect(isAuthRole('security_auditor')).toBe(true);
    expect(isAuthRole('visitor')).toBe(false);
    expect(isAuthRole(null)).toBe(false);
  });
});
