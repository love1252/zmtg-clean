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

const expectedInsertRow = {
  eventId: 'audit_evt_001',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  tenantId: 'demo-tenant-001',
  scope: 'tenant',
  resource: 'customer',
  resourceId: null,
  action: 'read_own_tenant',
  result: 'allowed',
  reason: 'allowed_by_policy',
  occurredAt: new Date('2026-05-30T09:00:00.000Z'),
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
    expect(mapAuditEventToInsert(event)).toEqual(expectedInsertRow);
  });

  it('把目标资源 id 映射为固定 resource_id 列', () => {
    expect(mapAuditEventToInsert({ ...event, resourceId: 'cust_001' })).toEqual({
      ...expectedInsertRow,
      resourceId: 'cust_001',
    });
  });

  it('映射审计事件时不会把额外字段带入写入行', () => {
    const eventWithExtraField: TenantAuditEvent & {
      accessToken: string;
      consultationTranscript: string;
      idNumber: string;
      medicalRecordNo: string;
      metadata: Record<string, unknown>;
      phoneNumber: string;
      requestBody: Record<string, unknown>;
      treatmentRecord: string;
    } = {
      ...event,
      accessToken: 'sk_test_should_not_persist',
      consultationTranscript: '咨询对话全文',
      idNumber: '110101199001010011',
      medicalRecordNo: 'MR-RAW-001',
      metadata: { requestBody: { maskedPhone: '13800000000' } },
      phoneNumber: '13800000000',
      requestBody: { maskedPhone: '13800000000' },
      treatmentRecord: '完整治疗记录正文',
    };

    const insertRow = mapAuditEventToInsert(eventWithExtraField);

    expect(insertRow).toEqual(expectedInsertRow);
    expect(insertRow).not.toHaveProperty('accessToken');
    expect(insertRow).not.toHaveProperty('consultationTranscript');
    expect(insertRow).not.toHaveProperty('idNumber');
    expect(insertRow).not.toHaveProperty('medicalRecordNo');
    expect(insertRow).not.toHaveProperty('metadata');
    expect(insertRow).not.toHaveProperty('phoneNumber');
    expect(insertRow).not.toHaveProperty('requestBody');
    expect(insertRow).not.toHaveProperty('treatmentRecord');
  });

  it('把审计事件写入 audit_events 表', async () => {
    const query = createInsertDatabase();

    await createAuditEventRepository(query.database).record(event);

    expect(query.insert).toHaveBeenCalledWith(auditEvents);
    expect(query.values).toHaveBeenCalledWith(expectedInsertRow);
  });
});
