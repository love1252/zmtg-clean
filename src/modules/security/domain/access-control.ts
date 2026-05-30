export const ACCESS_ROLES = [
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
  'platform_admin',
  'platform_operator',
  'security_auditor',
] as const;

export type AccessRole = (typeof ACCESS_ROLES)[number];

export type AccessScope = 'platform' | 'tenant';

export const ACCESS_RESOURCES = [
  'tenant',
  'tenant_member',
  'customer',
  'appointment',
  'follow_up',
  'open_connection',
  'permission_policy',
  'audit_log',
  'platform_health',
] as const;

export type ProtectedResource = (typeof ACCESS_RESOURCES)[number];

export const ACCESS_ACTIONS = [
  'read_aggregate',
  'read_own_tenant',
  'read_detail',
  'create',
  'update',
  'delete',
  'manage_status',
  'manage_policy',
  'review',
  'export_report',
] as const;

export type ProtectedAction = (typeof ACCESS_ACTIONS)[number];

export type AccessContext = {
  userId: string;
  role: AccessRole;
  scope: AccessScope;
  tenantId: string | null;
  source: 'demo_session' | 'server_session' | 'trusted_gateway';
};

export type AccessDecision =
  | { allowed: true; reason: 'allowed_by_policy' }
  | {
      allowed: false;
      reason: 'missing_tenant' | 'cross_tenant_denied' | 'role_denied' | 'sensitive_detail_denied';
    };

type AccessPolicy = {
  role: AccessRole;
  resource: ProtectedResource;
  actions: ProtectedAction[];
};

const accessPolicies: AccessPolicy[] = [
  {
    role: 'platform_admin',
    resource: 'tenant',
    actions: ['read_aggregate', 'read_detail', 'manage_status'],
  },
  {
    role: 'platform_admin',
    resource: 'permission_policy',
    actions: ['read_detail', 'manage_policy', 'review'],
  },
  {
    role: 'platform_operator',
    resource: 'platform_health',
    actions: ['read_aggregate', 'read_detail'],
  },
  {
    role: 'platform_operator',
    resource: 'tenant',
    actions: ['read_aggregate'],
  },
  {
    role: 'security_auditor',
    resource: 'audit_log',
    actions: ['read_detail', 'export_report', 'review'],
  },
  {
    role: 'tenant_admin',
    resource: 'open_connection',
    actions: ['read_own_tenant'],
  },
  {
    role: 'tenant_admin',
    resource: 'customer',
    actions: ['read_own_tenant'],
  },
  {
    role: 'tenant_admin',
    resource: 'appointment',
    actions: ['read_own_tenant'],
  },
  {
    role: 'tenant_admin',
    resource: 'follow_up',
    actions: ['read_own_tenant'],
  },
];

const sensitiveResources: ProtectedResource[] = ['customer', 'appointment', 'follow_up'];

function hasPolicy(role: AccessRole, resource: ProtectedResource, action: ProtectedAction) {
  return accessPolicies.some(
    (policy) =>
      policy.role === role &&
      policy.resource === resource &&
      policy.actions.includes(action),
  );
}

export function canAccessResource(input: {
  context: AccessContext;
  resource: ProtectedResource;
  action: ProtectedAction;
  targetTenantId?: string | null;
  containsSensitiveDetail?: boolean;
}): AccessDecision {
  const { context, resource, action, targetTenantId, containsSensitiveDetail = false } = input;

  if (context.scope === 'tenant' && !context.tenantId) {
    return { allowed: false, reason: 'missing_tenant' };
  }

  if (
    context.scope === 'tenant' &&
    targetTenantId &&
    context.tenantId &&
    targetTenantId !== context.tenantId
  ) {
    return { allowed: false, reason: 'cross_tenant_denied' };
  }

  if (
    containsSensitiveDetail &&
    sensitiveResources.includes(resource) &&
    context.scope === 'platform'
  ) {
    return { allowed: false, reason: 'sensitive_detail_denied' };
  }

  if (!hasPolicy(context.role, resource, action)) {
    return { allowed: false, reason: 'role_denied' };
  }

  return { allowed: true, reason: 'allowed_by_policy' };
}
