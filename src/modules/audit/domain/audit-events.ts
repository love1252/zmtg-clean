import type {
  AccessContext,
  AccessDecision,
  ProtectedAction,
  ProtectedResource,
} from '@/modules/security/domain/access-control';

export type AuditResult = 'allowed' | 'denied' | 'transitioned';

export type AuditReason =
  | AccessDecision['reason']
  | 'invalid_transition'
  | 'stale_transition'
  | 'not_found_or_not_owned'
  | 'invalid_treatment_summary_reference'
  | 'invalid_treatment_summary_payload'
  | 'invalid_follow_up_suggestion'
  | 'active_source_follow_up_exists'
  | 'quota_exceeded_customers'
  | 'quota_exceeded_appointments'
  | 'missing_active_plan'
  | 'missing_quota_limit';

export type TenantAuditEvent = {
  eventId: string;
  actorId: string;
  actorRole: AccessContext['role'];
  tenantId: string | null;
  scope: AccessContext['scope'];
  resource: ProtectedResource;
  resourceId?: string | null;
  action: ProtectedAction;
  result: AuditResult;
  reason: AuditReason;
  occurredAt: string;
  source: AccessContext['source'];
};

export const auditForbiddenTerms = [
  'client_secret',
  'access_token',
  'refresh_token',
  'private_key',
  'webhook_secret',
  'sk_live',
  'sk_test',
  'zmtg_sk_',
] as const;

export function createAuditEvent(input: {
  eventId: string;
  context: AccessContext;
  resource: ProtectedResource;
  resourceId?: string | null;
  action: ProtectedAction;
  result: AuditResult;
  reason: AuditReason;
  occurredAt: string;
}): TenantAuditEvent {
  return {
    eventId: input.eventId,
    actorId: input.context.userId,
    actorRole: input.context.role,
    tenantId: input.context.tenantId,
    scope: input.context.scope,
    resource: input.resource,
    ...(input.resourceId == null ? {} : { resourceId: input.resourceId }),
    action: input.action,
    result: input.result,
    reason: input.reason,
    occurredAt: input.occurredAt,
    source: input.context.source,
  };
}

export function createDeniedAccessAuditEvent(input: {
  eventId: string;
  context: AccessContext;
  resource: ProtectedResource;
  resourceId?: string | null;
  action: ProtectedAction;
  reason: Extract<AccessDecision, { allowed: false }>['reason'] | AuditReason;
  occurredAt: string;
}): TenantAuditEvent {
  return createAuditEvent({
    eventId: input.eventId,
    context: input.context,
    resource: input.resource,
    resourceId: input.resourceId,
    action: input.action,
    result: 'denied',
    reason: input.reason,
    occurredAt: input.occurredAt,
  });
}
