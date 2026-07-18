import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/institution/opportunities/route';

const routeMocks = vi.hoisted(() => ({
  canAccessResource: vi.fn(),
  createTenantBusinessRepository: vi.fn(),
  generateOpportunityPools: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
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

vi.mock('@/modules/institution/server/tenant-business-repository', () => ({
  createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
}));

vi.mock('@/modules/institution/server/opportunity-pool-service', () => ({
  generateOpportunityPools: routeMocks.generateOpportunityPools,
}));

const routeSource = readFileSync(
  join(process.cwd(), 'src/app/api/institution/opportunities/route.ts'),
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
    error: '旧机会池不提供机构级经营分析数据',
    code: 'legacy_opportunity_pool_disabled',
  });
  expect(payload).not.toHaveProperty('opportunityCount');
  expect(payload).not.toHaveProperty('customerCount');
  expect(payload).not.toHaveProperty('customers');
  expect(payload).not.toHaveProperty('records');
}

beforeEach(() => {
  for (const mock of Object.values(routeMocks)) {
    mock.mockReset();
  }
});

describe('legacy opportunity-pool API route', () => {
  it('returns the fixed disabled response before reading a normal request', async () => {
    await expectLegacyDisabled(
      await GET(new Request('http://localhost/api/institution/opportunities')),
    );
    expectLegacyDataChainUnused();
  });

  it('ignores forged query, header, and cookie input before returning the fixed response', async () => {
    const forgedValue = 'forged-institution-input';
    const response = await GET(
      new Request(
        `http://localhost/api/institution/opportunities?tenantId=${forgedValue}&customerId=${forgedValue}`,
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
      /getDemoAccessContextFromRequest|canAccessResource|getDatabase|createTenantBusinessRepository|generateOpportunityPools/u,
    );
  });
});
