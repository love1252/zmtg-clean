import { describe, expect, it, vi } from 'vitest';
import { auditEvents } from '@/server/db/schema';
import type { TenantDatabase } from '@/server/db/client';
import {
  createAuditEventRepository,
  mapAuditEventToInsert,
} from '@/modules/audit/server/audit-event-repository';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';

const event: TenantAuditEvent = {
  eventId: 'audit_evt_001',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  tenantId: 'demo-tenant-001',
  scope: 'tenant',
  resource: 'customer',
  action: 'read_own_tenant',
  result: 'allowed',
  reason: 'allowed_by_policy',
  occurredAt: '2026-05-30T09:00:00.000Z',
  source: 'demo_session',
};

function createInsertDatabase() {
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));

  return {
    database: { insert } as unknown as TenantDatabase,
    insert,
    values,
  };
}

describe('审计事件仓储映射', () => {
  it('把审计事件映射为数据库写入行', () => {
    expect(mapAuditEventToInsert(event)).toEqual({
      ...event,
      occurredAt: new Date('2026-05-30T09:00:00.000Z'),
    });
  });

  it('把审计事件写入 audit_events 表', async () => {
    const query = createInsertDatabase();

    await createAuditEventRepository(query.database).record(event);

    expect(query.insert).toHaveBeenCalledWith(auditEvents);
    expect(query.values).toHaveBeenCalledWith({
      ...event,
      occurredAt: new Date('2026-05-30T09:00:00.000Z'),
    });
  });
});
