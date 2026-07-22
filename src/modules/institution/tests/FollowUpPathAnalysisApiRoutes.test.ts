import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/institution/follow-up-path-analysis/route';

const routeMocks = vi.hoisted(() => ({
  canAccessResource: vi.fn(),
  createAuditEventRepository: vi.fn(),
  createTenantBusinessRepository: vi.fn(),
  createTreatmentSummaryRepository: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  getFollowUpPathAnalysisForTenant: vi.fn(),
}));

vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));

vi.mock('@/modules/institution/server/followup-path-analysis-service', () => ({
  getFollowUpPathAnalysisForTenant: routeMocks.getFollowUpPathAnalysisForTenant,
}));

vi.mock('@/modules/institution/server/tenant-business-repository', () => ({
  createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
}));

vi.mock('@/modules/institution/server/treatment-summary-repository', () => ({
  createTreatmentSummaryRepository: routeMocks.createTreatmentSummaryRepository,
}));

vi.mock('@/modules/security/domain/access-control', () => ({
  canAccessResource: routeMocks.canAccessResource,
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: routeMocks.getDatabase,
}));

const routeSource = readFileSync(
  join(process.cwd(), 'src/app/api/institution/follow-up-path-analysis/route.ts'),
  'utf8',
);

function expectLegacyDataChainUnused() {
  for (const mock of Object.values(routeMocks)) {
    expect(mock).not.toHaveBeenCalled();
  }
}

async function expectLegacyDisabled(response: Response) {
  expect(response.status).toBe(410);
  expect(response.headers.get('cache-control')).toBe('no-store');

  const payload = await response.json() as Record<string, unknown>;
  expect(payload).toEqual({
    error: '旧随访路径运营分析不提供机构级经营分析数据',
    code: 'legacy_follow_up_path_analysis_disabled',
  });
  expect(payload).not.toHaveProperty('templateSuggestionCount');
  expect(payload).not.toHaveProperty('confirmedSourceTaskCount');
  expect(payload).not.toHaveProperty('completedTaskCount');
  expect(payload).not.toHaveProperty('overdueTaskCount');
  expect(payload).not.toHaveProperty('voidedSummaryBlockedCount');
  expect(payload).not.toHaveProperty('duplicateSourceTaskConflictCount');
  expect(payload).not.toHaveProperty('notes');
  expect(payload).not.toHaveProperty('warnings');
}

beforeEach(() => {
  for (const mock of Object.values(routeMocks)) {
    mock.mockReset();
  }
});

describe('legacy follow-up path analysis API route', () => {
  it('returns the fixed disabled response before reading a normal request', async () => {
    await expectLegacyDisabled(
      await GET(new Request('http://localhost/api/institution/follow-up-path-analysis')),
    );
    expectLegacyDataChainUnused();
  });

  it('ignores forged query, header, and cookie input before returning the fixed response', async () => {
    const forgedValue = 'forged-institution-input';
    const response = await GET(
      new Request(
        `http://localhost/api/institution/follow-up-path-analysis?tenantId=${forgedValue}&customerId=${forgedValue}`,
        {
          headers: {
            cookie: `zmtg_demo_session=${forgedValue}`,
            'x-institution-id': forgedValue,
          },
        },
      ),
    );

    const replayableResponse = response.clone();
    await expectLegacyDisabled(response);
    expect(JSON.stringify(await replayableResponse.json())).not.toContain(forgedValue);
    expectLegacyDataChainUnused();
  });

  it('does not access a hostile Request proxy', async () => {
    let propertyReads = 0;
    const hostileRequest = new Proxy({} as Request, {
      get() {
        propertyReads += 1;
        throw new Error('request_must_not_be_read');
      },
    });

    await expectLegacyDisabled(await GET(hostileRequest));
    expect(propertyReads).toBe(0);
    expectLegacyDataChainUnused();
  });

  it('imports only NextResponse and forbids legacy request or data-chain dependencies', () => {
    const importLines = routeSource.match(/^import .+;$/gmu) ?? [];

    expect(importLines).toEqual(["import { NextResponse } from 'next/server';"]);
    expect(routeSource).not.toMatch(/\b_?request\s*(?:\.|\[)/u);
    expect(routeSource).not.toMatch(
      /getDemoAccessContextFromRequest|canAccessResource|getDatabase|create(?:AuditEvent|TenantBusiness|TreatmentSummary)Repository|getFollowUpPathAnalysisForTenant/u,
    );
  });
});
