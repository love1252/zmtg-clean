export const AUTH_ROLES = [
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
  'platform_admin',
  'platform_operator',
  'security_auditor',
] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];

export type AuthSessionUser = {
  id: string;
  username: string;
  name: string;
  role: AuthRole;
  tenantId: string | null;
  institutionId?: string | null;
};

export type AuthSession = {
  user: AuthSessionUser;
  expiresAt: number;
};

export type AuthSessionPayload = {
  authenticated: boolean;
  user: AuthSessionUser | null;
};

export function isAuthRole(value: unknown): value is AuthRole {
  return typeof value === 'string' && AUTH_ROLES.includes(value as AuthRole);
}
