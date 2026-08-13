import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeMocks = vi.hoisted(() => ({
  consumeInstitutionCapabilityAuthorityRuntimeContextV1: vi.fn(),
  createAuditEventRepository: vi.fn(),
  getDatabase: vi.fn(),
  listAuditEvents: vi.fn(),
  resolveInstitutionCapabilityAuthorityRuntimeContextV1: vi.fn(),
}));

vi.mock('@/modules/institution/server/institution-server-runtime', () => ({
  consumeInstitutionCapabilityAuthorityRuntimeContextV1:
    runtimeMocks.consumeInstitutionCapabilityAuthorityRuntimeContextV1,
  resolveInstitutionCapabilityAuthorityRuntimeContextV1:
    runtimeMocks.resolveInstitutionCapabilityAuthorityRuntimeContextV1,
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: runtimeMocks.createAuditEventRepository,
}));
vi.mock('@/server/db/client', () => ({ getDatabase: runtimeMocks.getDatabase }));

import type { AuditEventQuery } from '@/modules/audit/domain/audit-event-query';
import { readCurrentInstitutionAuditEventsV1 } from '@/server/orchestration/institution-audit-reader';

const formalHandle = Object.freeze({ opaque: true });
const formalContext = Object.freeze({
  tenantId: 'tenant-formal-001',
  institutionId: 'institution-formal-001',
  availableSectionIds: Object.freeze(['workbench', 'system']),
  observedAt: '2026-08-13T08:00:00.000Z',
});
const query: AuditEventQuery = Object.freeze({
  filters: Object.freeze({ resource: 'customer' }),
  limit: 25,
});

beforeEach(() => {
  for (const mock of Object.values(runtimeMocks)) mock.mockReset();

  runtimeMocks.resolveInstitutionCapabilityAuthorityRuntimeContextV1.mockResolvedValue(
    formalHandle,
  );
  runtimeMocks.consumeInstitutionCapabilityAuthorityRuntimeContextV1.mockReturnValue(
    formalContext,
  );
  runtimeMocks.getDatabase.mockReturnValue({ database: 'local' });
  runtimeMocks.createAuditEventRepository.mockReturnValue({
    listAuditEvents: runtimeMocks.listAuditEvents,
  });
  runtimeMocks.listAuditEvents.mockResolvedValue({
    records: [
      {
        id: 'audit_evt_001',
        tenantId: 'tenant-formal-001',
        institutionId: 'must-not-leak',
        institutionAttribution: 'verified',
        resource: 'customer',
        resourceId: 'cust_001',
        action: 'read_own_tenant',
        result: 'allowed',
        reason: 'allowed_by_policy',
        actorId: 'actor_001',
        actorRole: 'tenant_admin',
        occurredAt: '2026-08-13T08:00:00.000Z',
        metadata: { connectionString: 'must-not-leak' },
      },
    ],
    pageInfo: { hasMore: false, limit: 25, nextCursor: null },
  });
});

describe('机构范围审计只读编排', () => {
  it('只消费正式 opaque context，并以其中的 tenant + institution 双键查询', async () => {
    const result = await readCurrentInstitutionAuditEventsV1(query);

    expect(
      runtimeMocks.consumeInstitutionCapabilityAuthorityRuntimeContextV1,
    ).toHaveBeenCalledWith(formalHandle);
    expect(runtimeMocks.getDatabase).toHaveBeenCalledOnce();
    expect(runtimeMocks.listAuditEvents).toHaveBeenCalledWith({
      scope: {
        kind: 'institution',
        tenantId: 'tenant-formal-001',
        institutionId: 'institution-formal-001',
      },
      query,
    });
    expect(result.kind).toBe('ready');
  });

  it('不接受 caller scope、role 或 release claim 覆盖正式上下文', async () => {
    const callerControlledQuery = {
      ...query,
      tenantId: 'tenant-attacker',
      institutionId: 'institution-attacker',
      role: 'platform_admin',
      releaseClaim: 'released',
    } as AuditEventQuery;

    await readCurrentInstitutionAuditEventsV1(callerControlledQuery);

    expect(runtimeMocks.listAuditEvents).toHaveBeenCalledWith({
      scope: {
        kind: 'institution',
        tenantId: 'tenant-formal-001',
        institutionId: 'institution-formal-001',
      },
      query: callerControlledQuery,
    });
  });

  it('要求正式上下文包含 system section', async () => {
    runtimeMocks.consumeInstitutionCapabilityAuthorityRuntimeContextV1.mockReturnValue({
      ...formalContext,
      availableSectionIds: ['workbench'],
    });

    const result = await readCurrentInstitutionAuditEventsV1(query);

    expect(result).toEqual({ kind: 'unavailable' });
    expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
    expect(runtimeMocks.listAuditEvents).not.toHaveBeenCalled();
  });

  it('遵守正式 context 的 one-shot consumption', async () => {
    runtimeMocks.consumeInstitutionCapabilityAuthorityRuntimeContextV1
      .mockReturnValueOnce(formalContext)
      .mockReturnValueOnce(null);

    const firstResult = await readCurrentInstitutionAuditEventsV1(query);
    const secondResult = await readCurrentInstitutionAuditEventsV1(query);

    expect(firstResult.kind).toBe('ready');
    expect(secondResult).toEqual({ kind: 'unavailable' });
    expect(runtimeMocks.listAuditEvents).toHaveBeenCalledOnce();
  });

  it('成功响应只保留机构侧低敏投影且不泄漏 tenantId', async () => {
    const result = await readCurrentInstitutionAuditEventsV1(query);

    expect(result).toEqual({
      kind: 'ready',
      records: [
        {
          id: 'audit_evt_001',
          resource: 'customer',
          resourceId: 'cust_001',
          action: 'read_own_tenant',
          result: 'allowed',
          reason: 'allowed_by_policy',
          actorId: 'actor_001',
          actorRole: 'tenant_admin',
          occurredAt: '2026-08-13T08:00:00.000Z',
        },
      ],
      pageInfo: { hasMore: false, limit: 25, nextCursor: null },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('tenantId');
    expect(serialized).not.toContain('institutionId');
    expect(serialized).not.toContain('institutionAttribution');
    expect(serialized).not.toContain('connectionString');
  });

  it('正式上下文不可用时 fail-closed 且不访问数据库', async () => {
    runtimeMocks.resolveInstitutionCapabilityAuthorityRuntimeContextV1.mockResolvedValue(
      null,
    );

    const result = await readCurrentInstitutionAuditEventsV1(query);

    expect(result).toEqual({ kind: 'unavailable' });
    expect(
      runtimeMocks.consumeInstitutionCapabilityAuthorityRuntimeContextV1,
    ).not.toHaveBeenCalled();
    expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it.each(['database', 'repository'] as const)(
    '%s failure 安全降级且不泄漏内部错误',
    async (failurePoint) => {
      if (failurePoint === 'database') {
        runtimeMocks.getDatabase.mockImplementation(() => {
          throw new Error('DATABASE_URL=postgres://user:secret@localhost/zmtg');
        });
      } else {
        runtimeMocks.listAuditEvents.mockRejectedValue(
          new Error('select * from audit_events; stack=secret'),
        );
      }

      const result = await readCurrentInstitutionAuditEventsV1(query);

      expect(result).toEqual({ kind: 'unavailable' });
      expect(JSON.stringify(result)).not.toContain('DATABASE_URL');
      expect(JSON.stringify(result)).not.toContain('select *');
      expect(JSON.stringify(result)).not.toContain('secret');
    },
  );
});
