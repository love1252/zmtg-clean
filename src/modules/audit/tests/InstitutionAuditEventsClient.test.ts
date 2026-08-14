import { describe, expect, it, vi } from 'vitest';

import { listInstitutionAuditEvents } from '@/modules/audit/client/institution-audit-events-client';

const validRecord = Object.freeze({
  id: 'audit-event-001',
  resource: 'customer',
  resourceId: 'customer-001',
  action: 'read',
  result: 'allowed',
  reason: 'allowed_by_policy',
  actorId: 'actor-001',
  actorRole: 'tenant_admin',
  occurredAt: '2026-08-14T00:00:00.000Z',
});

const partialCoverage = Object.freeze({
  state: 'partial_verified_only',
  safeDataAvailable: true,
  historicalCoverageComplete: false,
  partialCoverageSafe: true,
});

function successPayload(overrides: Record<string, unknown> = {}) {
  return {
    records: [validRecord],
    pageInfo: {
      hasMore: false,
      limit: 50,
      nextCursor: null,
    },
    coverage: partialCoverage,
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Institution Audit Events client strict low-sensitive DTO', () => {
  it('accepts the exact low-sensitive response and preserves the GET-only query', async () => {
    const fetcher = vi.fn(async () => jsonResponse(successPayload()));

    const result = await listInstitutionAuditEvents(
      { resource: 'customer', limit: 50 },
      { fetcher },
    );

    expect(fetcher).toHaveBeenCalledWith(
      '/api/institution/audit-events?resource=customer&limit=50',
      { cache: 'no-store' },
    );
    expect(result).toEqual({
      ok: true,
      records: [validRecord],
      pageInfo: { hasMore: false, limit: 50, nextCursor: null },
      coverage: partialCoverage,
    });
    if (result.ok) {
      expect(Reflect.ownKeys(result.records[0] ?? {})).toEqual([
        'id',
        'resource',
        'resourceId',
        'action',
        'result',
        'reason',
        'actorId',
        'actorRole',
        'occurredAt',
      ]);
    }
  });

  it.each([
    ['tenantId', 'tenant-private'],
    ['institutionId', 'institution-private'],
    ['institutionAttribution', 'verified'],
    ['rawProvenance', 'private-evidence'],
    ['secret', 'private-secret'],
  ])('rejects record-level extra field %s instead of carrying it into UI state', async (key, value) => {
    const fetcher = vi.fn(async () =>
      jsonResponse(successPayload({
        records: [{ ...validRecord, [key]: value }],
      })),
    );

    await expect(listInstitutionAuditEvents({}, { fetcher })).resolves.toEqual({
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 200 },
    });
  });

  it('rejects extra top-level and pageInfo fields', async () => {
    const extraTopLevel = vi.fn(async () =>
      jsonResponse({ ...successPayload(), tenantId: 'tenant-private' }),
    );
    const extraPageInfo = vi.fn(async () =>
      jsonResponse(successPayload({
        pageInfo: {
          hasMore: false,
          limit: 50,
          nextCursor: null,
          total: 275,
        },
      })),
    );

    await expect(listInstitutionAuditEvents({}, { fetcher: extraTopLevel })).resolves.toMatchObject({
      ok: false,
    });
    await expect(listInstitutionAuditEvents({}, { fetcher: extraPageInfo })).resolves.toMatchObject({
      ok: false,
    });
  });

  it.each([
    ['unknown resource', { ...validRecord, resource: 'private_resource' }],
    ['unknown action', { ...validRecord, action: 'private_action' }],
    ['unknown result', { ...validRecord, result: 'private_result' }],
    ['unknown reason', { ...validRecord, reason: 'private_reason' }],
    ['unknown actor role', { ...validRecord, actorRole: 'private_role' }],
    ['non-canonical time', { ...validRecord, occurredAt: '2026-08-14' }],
  ])('rejects %s in a record', async (_scenario, record) => {
    const fetcher = vi.fn(async () =>
      jsonResponse(successPayload({ records: [record] })),
    );

    await expect(listInstitutionAuditEvents({}, { fetcher })).resolves.toMatchObject({
      ok: false,
    });
  });

  it.each([
    'ai_conversation_viewed',
    'real_channel_preflight_viewed',
    'wecom_official_dry_run_viewed',
  ] as const)('accepts canonical AuditReason %s', async (reason) => {
    const fetcher = vi.fn(async () =>
      jsonResponse(successPayload({
        records: [{ ...validRecord, reason }],
      })),
    );

    await expect(listInstitutionAuditEvents({}, { fetcher })).resolves.toMatchObject({
      ok: true,
      records: [{ reason }],
    });
  });

  it.each([
    ['unsafe limit', { hasMore: false, limit: 101, nextCursor: null }],
    ['missing next cursor', { hasMore: true, limit: 50, nextCursor: null }],
    ['unexpected terminal cursor', { hasMore: false, limit: 50, nextCursor: 'cursor' }],
  ])('rejects invalid pageInfo: %s', async (_scenario, pageInfo) => {
    const fetcher = vi.fn(async () =>
      jsonResponse(successPayload({ pageInfo })),
    );

    await expect(listInstitutionAuditEvents({}, { fetcher })).resolves.toMatchObject({
      ok: false,
    });
  });

  it('rejects a coverage contract with extra provenance fields', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(successPayload({
        coverage: { ...partialCoverage, unclassifiableHistoricalRecordCount: 267 },
      })),
    );

    await expect(listInstitutionAuditEvents({}, { fetcher })).resolves.toMatchObject({
      ok: false,
    });
  });
});
