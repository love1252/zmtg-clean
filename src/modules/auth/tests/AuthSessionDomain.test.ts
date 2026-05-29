import { describe, expect, it } from 'vitest';
import { AUTH_ROLES, isAuthRole } from '@/modules/auth/domain/session';

describe('auth session domain', () => {
  it('exposes the supported role boundary', () => {
    expect(AUTH_ROLES).toEqual(['tenant_admin', 'platform_admin']);
  });

  it('checks known auth roles', () => {
    expect(isAuthRole('tenant_admin')).toBe(true);
    expect(isAuthRole('platform_admin')).toBe(true);
    expect(isAuthRole('visitor')).toBe(false);
    expect(isAuthRole(null)).toBe(false);
  });
});
