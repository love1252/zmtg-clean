import type { AuthRole } from '@/modules/auth/domain/session';
import {
  decodeDemoSession,
  DEMO_SESSION_COOKIE,
  readCookieValue,
} from '@/modules/auth/server/demo-session';
import type { AccessContext, AccessRole, AccessScope } from '@/modules/security/domain/access-control';

const platformRoles: AuthRole[] = ['platform_admin', 'platform_operator', 'security_auditor'];
const tenantRoles: AuthRole[] = ['tenant_admin', 'tenant_operator', 'consultant', 'customer_service'];

function roleToScope(role: AuthRole): AccessScope {
  return platformRoles.includes(role) ? 'platform' : 'tenant';
}

function isAccessRole(role: AuthRole): role is AccessRole {
  return [...platformRoles, ...tenantRoles].includes(role);
}

export function getDemoAccessContextFromRequest(
  request: Request,
  now = Date.now(),
): AccessContext | null {
  const cookie = readCookieValue(request.headers.get('cookie'), DEMO_SESSION_COOKIE);
  const session = decodeDemoSession(cookie, now);
  if (!session) return null;
  if (!isAccessRole(session.user.role)) return null;

  const scope = roleToScope(session.user.role);
  if (scope === 'tenant' && !session.user.tenantId) return null;

  return {
    userId: session.user.id,
    role: session.user.role,
    scope,
    tenantId: session.user.tenantId,
    institutionId: scope === 'tenant' ? session.user.institutionId ?? null : null,
    source: session.source ?? 'demo_session',
  };
}
