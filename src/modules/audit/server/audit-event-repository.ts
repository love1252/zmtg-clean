import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { TenantDatabase } from '@/server/db/client';
import { auditEvents } from '@/server/db/schema';

export function mapAuditEventToInsert(event: TenantAuditEvent): typeof auditEvents.$inferInsert {
  return {
    ...event,
    occurredAt: new Date(event.occurredAt),
  };
}

export function createAuditEventRepository(database: TenantDatabase) {
  return {
    async record(event: TenantAuditEvent) {
      await database.insert(auditEvents).values(mapAuditEventToInsert(event));
    },
  };
}
