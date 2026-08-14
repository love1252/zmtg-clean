import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeMocks = vi.hoisted(() => ({
  consumeInstitutionAuditReadAuthorizationV1: vi.fn(),
  createAuditEventRepository: vi.fn(),
  getDatabase: vi.fn(),
  listAuditEvents: vi.fn(),
  readInstitutionAuditCoverage: vi.fn(),
  resolveInstitutionAuditReadAuthorizationV1: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-audit-read-authorization', () => ({
  consumeInstitutionAuditReadAuthorizationV1:
    runtimeMocks.consumeInstitutionAuditReadAuthorizationV1,
  resolveInstitutionAuditReadAuthorizationV1:
    runtimeMocks.resolveInstitutionAuditReadAuthorizationV1,
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
  observedAt: '2026-08-13T08:00:00.000Z',
});
const query: AuditEventQuery = Object.freeze({
  filters: Object.freeze({ resource: 'customer' }),
  limit: 25,
});

beforeEach(() => {
  for (const mock of Object.values(runtimeMocks)) mock.mockReset();

  runtimeMocks.resolveInstitutionAuditReadAuthorizationV1.mockResolvedValue({
    kind: 'allowed',
    authorization: formalHandle,
  });
  runtimeMocks.consumeInstitutionAuditReadAuthorizationV1.mockReturnValue(
    formalContext,
  );
  runtimeMocks.getDatabase.mockReturnValue({ database: 'local' });
  runtimeMocks.createAuditEventRepository.mockReturnValue({
    listAuditEvents: runtimeMocks.listAuditEvents,
    readInstitutionAuditCoverage: runtimeMocks.readInstitutionAuditCoverage,
  });
  runtimeMocks.readInstitutionAuditCoverage.mockResolvedValue({
    verifiedRecordCount: 7,
    unclassifiableHistoricalRecordCount: 267,
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
      runtimeMocks.consumeInstitutionAuditReadAuthorizationV1,
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
    expect(runtimeMocks.readInstitutionAuditCoverage).toHaveBeenCalledWith({
      tenantId: 'tenant-formal-001',
      institutionId: 'institution-formal-001',
    });
    expect(result.kind).toBe('ready');
  });

  it('caller filters 只能缩小查询且不能用 actorId、scope、role 或 release claim 扩权', async () => {
    const callerControlledQuery = {
      ...query,
      filters: {
        actorId: 'admin-id-from-caller',
        resource: 'customer',
        action: 'read_own_tenant',
        reason: 'allowed_by_policy',
        from: '2026-08-01T00:00:00.000Z',
        to: '2026-08-14T00:00:00.000Z',
      },
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

  it.each(['tenant_operator', 'consultant', 'customer_service'] as const)(
    '可信非管理员角色 %s 被 owner 拒绝时返回 forbidden 且不访问数据库',
    async (_role) => {
      runtimeMocks.resolveInstitutionAuditReadAuthorizationV1.mockResolvedValue({
        kind: 'forbidden',
      });

      const result = await readCurrentInstitutionAuditEventsV1(query);

      expect(result).toEqual({ kind: 'forbidden' });
      expect(
        runtimeMocks.consumeInstitutionAuditReadAuthorizationV1,
      ).not.toHaveBeenCalled();
      expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
      expect(runtimeMocks.listAuditEvents).not.toHaveBeenCalled();
    },
  );

  it('遵守正式 context 的 one-shot consumption', async () => {
    runtimeMocks.consumeInstitutionAuditReadAuthorizationV1
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
      coverage: {
        state: 'partial_verified_only',
        safeDataAvailable: true,
        historicalCoverageComplete: false,
        partialCoverageSafe: true,
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('tenantId');
    expect(serialized).not.toContain('institutionId');
    expect(serialized).not.toContain('institutionAttribution');
    expect(serialized).not.toContain('connectionString');
    expect(serialized).not.toContain('267');
  });

  it('零 verified 且存在历史 residual 时明确返回安全 partial，而不是 authoritative empty', async () => {
    runtimeMocks.readInstitutionAuditCoverage.mockResolvedValue({
      verifiedRecordCount: 0,
      unclassifiableHistoricalRecordCount: 267,
    });
    runtimeMocks.listAuditEvents.mockResolvedValue({
      records: [],
      pageInfo: { hasMore: false, limit: 25, nextCursor: null },
    });

    const result = await readCurrentInstitutionAuditEventsV1(query);

    expect(result).toEqual({
      kind: 'ready',
      records: [],
      pageInfo: { hasMore: false, limit: 25, nextCursor: null },
      coverage: {
        state: 'partial_verified_only',
        safeDataAvailable: false,
        historicalCoverageComplete: false,
        partialCoverageSafe: true,
      },
    });
  });

  it('零 residual 且零 verified 时才形成 complete authoritative-empty 事实', async () => {
    runtimeMocks.readInstitutionAuditCoverage.mockResolvedValue({
      verifiedRecordCount: 0,
      unclassifiableHistoricalRecordCount: 0,
    });
    runtimeMocks.listAuditEvents.mockResolvedValue({
      records: [],
      pageInfo: { hasMore: false, limit: 25, nextCursor: null },
    });

    const result = await readCurrentInstitutionAuditEventsV1(query);

    expect(result).toEqual({
      kind: 'ready',
      records: [],
      pageInfo: { hasMore: false, limit: 25, nextCursor: null },
      coverage: {
        state: 'complete',
        safeDataAvailable: false,
        historicalCoverageComplete: true,
        partialCoverageSafe: false,
      },
    });
  });

  it.each([
    { verifiedRecordCount: -1, unclassifiableHistoricalRecordCount: 0 },
    { verifiedRecordCount: 0, unclassifiableHistoricalRecordCount: -1 },
    { verifiedRecordCount: Number.NaN, unclassifiableHistoricalRecordCount: 0 },
  ])('非法 coverage facts fail-closed：%j', async (facts) => {
    runtimeMocks.readInstitutionAuditCoverage.mockResolvedValue(facts);

    const result = await readCurrentInstitutionAuditEventsV1(query);

    expect(result).toEqual({ kind: 'unavailable' });
    expect(runtimeMocks.listAuditEvents).not.toHaveBeenCalled();
  });

  it('正式上下文不可用时 fail-closed 且不访问数据库', async () => {
    runtimeMocks.resolveInstitutionAuditReadAuthorizationV1.mockResolvedValue({
      kind: 'unavailable',
    });

    const result = await readCurrentInstitutionAuditEventsV1(query);

    expect(result).toEqual({ kind: 'unavailable' });
    expect(
      runtimeMocks.consumeInstitutionAuditReadAuthorizationV1,
    ).not.toHaveBeenCalled();
    expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it.each(['database', 'coverage', 'repository'] as const)(
    '%s failure 安全降级且不泄漏内部错误',
    async (failurePoint) => {
      if (failurePoint === 'database') {
        runtimeMocks.getDatabase.mockImplementation(() => {
          throw new Error('DATABASE_URL=postgres://user:secret@localhost/zmtg');
        });
      } else if (failurePoint === 'coverage') {
        runtimeMocks.readInstitutionAuditCoverage.mockRejectedValue(
          new Error('select count(*) from audit_events; stack=secret'),
        );
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
