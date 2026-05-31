import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { TenantDatabase } from '@/server/db/client';
import { auditEvents } from '@/server/db/schema';

export function mapAuditEventToInsert(event: TenantAuditEvent): typeof auditEvents.$inferInsert {
  return {
    eventId: event.eventId,
    actorId: event.actorId,
    actorRole: event.actorRole,
    tenantId: event.tenantId,
    scope: event.scope,
    resource: event.resource,
    resourceId: event.resourceId ?? null,
    action: event.action,
    result: event.result,
    reason: event.reason,
    occurredAt: new Date(event.occurredAt),
    source: event.source,
  };
}

export function createAuditEventRepository(database: TenantDatabase) {
  return {
    async record(event: TenantAuditEvent) {
      await database.insert(auditEvents).values(mapAuditEventToInsert(event));
    },
  };
}

export type AuditEventRepository = ReturnType<typeof createAuditEventRepository>;
