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

export const COMMERCIAL_ROLE_SEMANTICS = {
  platform_admin: 'platform_admin',
  institution_owner: 'tenant_admin',
  institution_admin: 'tenant_admin',
  manager: 'tenant_operator',
  consultant: 'consultant',
  staff: 'customer_service',
} as const satisfies Record<string, AccessRole>;

export const ACCESS_RESOURCES = [
  'tenant',
  'tenant_member',
  'customer',
  'appointment',
  'follow_up',
  'message_delivery',
  'ai_conversation',
  'dashboard',
  'safety_switch',
  'real_channel',
  'treatment_summary',
  'open_connection',
  'permission_policy',
  'audit_log',
  'platform_health',
  'ai_model_config',
  'knowledge_management',
] as const;

export type ProtectedResource = (typeof ACCESS_RESOURCES)[number];

export const ACCESS_ACTIONS = [
  'read',
  'read_aggregate',
  'read_own_tenant',
  'read_detail',
  'create',
  'import',
  'export',
  'update',
  'delete',
  'approve',
  'enable',
  'disable',
  'manage_status',
  'manage_credentials',
  'test_connection',
  'manage_policy',
  'review',
  'export_report',
  'execute_once',
] as const;

export type ProtectedAction = (typeof ACCESS_ACTIONS)[number];

export type AccessContext = {
  userId: string;
  role: AccessRole;
  scope: AccessScope;
  tenantId: string | null;
  institutionId?: string | null;
  source: 'demo_session' | 'server_session' | 'trusted_gateway';
};

export type AccessDecision =
  | { allowed: true; reason: 'allowed_by_policy' }
  | {
      allowed: false;
      reason:
        | 'missing_tenant'
        | 'cross_tenant_denied'
        | 'role_denied'
        | 'sensitive_detail_denied'
        | 'unknown_role_denied'
        | 'unknown_resource_denied'
        | 'unknown_action_denied';
    };

type AccessPolicy = {
  role: AccessRole;
  resource: ProtectedResource;
  actions: ProtectedAction[];
};

const tenantReadResources: ProtectedResource[] = [
  'customer',
  'appointment',
  'follow_up',
  'message_delivery',
  'ai_conversation',
  'dashboard',
];

const tenantManagerResources: ProtectedResource[] = [
  'customer',
  'appointment',
  'follow_up',
  'message_delivery',
  'ai_conversation',
  'dashboard',
];

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
    role: 'platform_admin',
    resource: 'ai_model_config',
    actions: ['read_detail', 'update', 'manage_credentials', 'test_connection'],
  },
  {
    role: 'platform_admin',
    resource: 'safety_switch',
    actions: ['read', 'read_detail', 'update', 'disable'],
  },
  {
    role: 'platform_admin',
    resource: 'real_channel',
    actions: ['read', 'enable', 'disable'],
  },
  {
    role: 'platform_operator',
    resource: 'platform_health',
    actions: ['read_aggregate', 'read_detail'],
  },
  {
    role: 'platform_operator',
    resource: 'ai_model_config',
    actions: ['read_detail'],
  },
  {
    role: 'security_auditor',
    resource: 'ai_model_config',
    actions: ['read_detail', 'review'],
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
    actions: [
      'read_own_tenant',
      'create',
      'update',
      'manage_status',
      'manage_credentials',
      'test_connection',
      'delete',
    ],
  },
  {
    role: 'tenant_admin',
    resource: 'customer',
    actions: ['read', 'read_own_tenant', 'create', 'import', 'update'],
  },
  {
    role: 'tenant_admin',
    resource: 'appointment',
    actions: ['read', 'read_own_tenant', 'create', 'update'],
  },
  {
    role: 'tenant_admin',
    resource: 'follow_up',
    actions: ['read', 'read_own_tenant', 'create', 'update', 'approve', 'review'],
  },
  {
    role: 'tenant_admin',
    resource: 'message_delivery',
    actions: ['read', 'read_own_tenant', 'approve', 'review'],
  },
  {
    role: 'tenant_admin',
    resource: 'ai_conversation',
    actions: ['read', 'read_own_tenant', 'read_detail', 'update', 'approve', 'review', 'manage_status'],
  },
  {
    role: 'tenant_admin',
    resource: 'dashboard',
    actions: ['read', 'read_own_tenant'],
  },
  {
    role: 'tenant_admin',
    resource: 'audit_log',
    actions: ['read_detail', 'review'],
  },
  {
    role: 'tenant_admin',
    resource: 'safety_switch',
    actions: ['read', 'read_detail', 'update', 'disable'],
  },
  {
    role: 'tenant_admin',
    resource: 'real_channel',
    actions: ['read', 'enable', 'disable', 'execute_once'],
  },
  {
    role: 'tenant_admin',
    resource: 'treatment_summary',
    actions: ['read_own_tenant', 'create', 'update'],
  },
  ...tenantManagerResources.map(
    (resource): AccessPolicy => ({
      role: 'tenant_operator',
      resource,
      actions:
        resource === 'follow_up' || resource === 'message_delivery'
          ? ['read', 'read_own_tenant', 'approve', 'review']
          : ['read', 'read_own_tenant'],
    }),
  ),
  {
    role: 'tenant_operator',
    resource: 'safety_switch',
    actions: ['read', 'read_detail'],
  },
  {
    role: 'tenant_operator',
    resource: 'real_channel',
    actions: ['read', 'disable'],
  },
  ...tenantReadResources.map(
    (resource): AccessPolicy => ({
      role: 'consultant',
      resource,
      actions: ['read', 'read_own_tenant'],
    }),
  ),
  {
    role: 'consultant',
    resource: 'safety_switch',
    actions: ['read', 'read_detail'],
  },
  ...tenantReadResources.map(
    (resource): AccessPolicy => ({
      role: 'customer_service',
      resource,
      actions: ['read', 'read_own_tenant'],
    }),
  ),
  {
    role: 'customer_service',
    resource: 'safety_switch',
    actions: ['read', 'read_detail'],
  },
];

const sensitiveResources: ProtectedResource[] = [
  'customer',
  'appointment',
  'follow_up',
  'message_delivery',
  'ai_conversation',
  'treatment_summary',
];

function hasPolicy(role: AccessRole, resource: ProtectedResource, action: ProtectedAction) {
  return accessPolicies.some(
    (policy) =>
      policy.role === role &&
      policy.resource === resource &&
      policy.actions.includes(action),
  );
}

function isKnownRole(role: unknown): role is AccessRole {
  return typeof role === 'string' && ACCESS_ROLES.includes(role as AccessRole);
}

function isKnownResource(resource: unknown): resource is ProtectedResource {
  return typeof resource === 'string' && ACCESS_RESOURCES.includes(resource as ProtectedResource);
}

function isKnownAction(action: unknown): action is ProtectedAction {
  return typeof action === 'string' && ACCESS_ACTIONS.includes(action as ProtectedAction);
}

export function canAccessResource(input: {
  context: AccessContext;
  resource: ProtectedResource;
  action: ProtectedAction;
  targetTenantId?: string | null;
  containsSensitiveDetail?: boolean;
}): AccessDecision {
  const { context, resource, action, targetTenantId, containsSensitiveDetail = false } = input;

  if (!isKnownRole(context.role)) {
    return { allowed: false, reason: 'unknown_role_denied' };
  }

  if (!isKnownResource(resource)) {
    return { allowed: false, reason: 'unknown_resource_denied' };
  }

  if (!isKnownAction(action)) {
    return { allowed: false, reason: 'unknown_action_denied' };
  }

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

  if (
    resource === 'real_channel' &&
    action === 'execute_once' &&
    (
      context.source !== 'server_session' ||
      context.scope !== 'tenant' ||
      !context.tenantId ||
      !context.institutionId
    )
  ) {
    return { allowed: false, reason: 'role_denied' };
  }

  if (!hasPolicy(context.role, resource, action)) {
    return { allowed: false, reason: 'role_denied' };
  }

  return { allowed: true, reason: 'allowed_by_policy' };
}
