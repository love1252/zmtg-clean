import { and, eq } from 'drizzle-orm';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { TenantDatabase } from '@/server/db/client';
import { auditEvents } from '@/server/db/schema';

type AuditEventRow = typeof auditEvents.$inferSelect;

export type CustomerAuditEventSummary = {
  id: string;
  action: AuditEventRow['action'];
  result: AuditEventRow['result'];
  reason: AuditEventRow['reason'];
  actor: {
    id: string;
    role: AuditEventRow['actorRole'];
  };
  occurredAt: string;
  resource: AuditEventRow['resource'];
  resourceId: string | null;
};

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

function mapAuditEventRowToSummary(row: AuditEventRow): CustomerAuditEventSummary {
  return {
    id: row.eventId,
    action: row.action,
    result: row.result,
    reason: row.reason,
    actor: {
      id: row.actorId,
      role: row.actorRole,
    },
    occurredAt: row.occurredAt.toISOString(),
    resource: row.resource,
    resourceId: row.resourceId,
  };
}

function sortAuditEventSummaries(events: CustomerAuditEventSummary[]) {
  return [...events].sort((left, right) => {
    const timeDiff = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
    if (timeDiff !== 0) return timeDiff;

    return left.id.localeCompare(right.id);
  });
}

export function createAuditEventRepository(database: TenantDatabase) {
  return {
    async record(event: TenantAuditEvent) {
      await database.insert(auditEvents).values(mapAuditEventToInsert(event));
    },
    async listCustomerAuditEventsByResourceId(input: {
      tenantId: string;
      customerId: string;
    }): Promise<CustomerAuditEventSummary[]> {
      const rows = await database
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.tenantId, input.tenantId),
            eq(auditEvents.resource, 'customer'),
            eq(auditEvents.resourceId, input.customerId),
          ),
        );

      return sortAuditEventSummaries(rows.map(mapAuditEventRowToSummary));
    },
  };
}

export type AuditEventRepository = ReturnType<typeof createAuditEventRepository>;
