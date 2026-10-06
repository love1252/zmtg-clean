import { randomUUID } from 'node:crypto';
import { createVerifiedInstitutionAttributedTenantAuditEventV1, type AuditReason, type VerifiedInstitutionAuditAttributionHandleV1 } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type { TenantDatabase } from '@/server/db/client';
import type { InstitutionCustomerWriteAuthorizationConsumptionV1 } from './institution-customer-write-authorization';

// Resolve attribution before opening a transaction; this writer only uses its transaction.
export async function recordInstitutionHumanDecisionAudit(database: TenantDatabase, actor: InstitutionCustomerWriteAuthorizationConsumptionV1,
  attribution: VerifiedInstitutionAuditAttributionHandleV1, input: { resource: 'customer' | 'follow_up'; resourceId: string; reason: AuditReason; occurredAt: Date; action?: 'create' | 'update' }) {
  const eventId = randomUUID();
  const event = createVerifiedInstitutionAttributedTenantAuditEventV1({ attribution, event: {
    eventId, actorId: actor.accountId, actorRole: actor.role, tenantId: actor.tenantId, scope: 'tenant', source: 'server_session',
    resource: input.resource, resourceId: input.resourceId, action: input.action ?? 'update', result: 'transitioned', reason: input.reason, occurredAt: input.occurredAt.toISOString(),
  } });
  if (!event) throw new Error('human_decision_audit_invalid');
  await createAuditEventRepository(database).recordAttributed(event);
  return eventId;
}
