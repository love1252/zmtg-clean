import type { AuditEventListItem } from '@/modules/audit/domain/audit-event-query';
import { auditEvents } from '@/server/db/schema';

type AuditEventRow = typeof auditEvents.$inferSelect;

export function mapAuditEventRowToListItem(row: AuditEventRow): AuditEventListItem {
  return {
    id: row.eventId,
    tenantId: row.tenantId,
    resource: row.resource,
    resourceId: row.resourceId,
    action: row.action,
    result: row.result,
    reason: row.reason,
    actorId: row.actorId,
    actorRole: row.actorRole,
    occurredAt: row.occurredAt.toISOString(),
  };
}
