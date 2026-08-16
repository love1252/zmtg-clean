import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ readCustomers: vi.fn() }));
vi.mock('@/server/orchestration/institution-customer-list-reader', () => ({
  readCurrentInstitutionCustomersV1: mocks.readCustomers,
}));

import { GET } from '@/app/api/v1/institution/customers/route';

const ready = Object.freeze({
  kind: 'ready' as const,
  records: Object.freeze([
    Object.freeze({
      contractVersion: 'v1' as const,
      customerId: 'customer-001',
      displayName: '客户甲',
      lifecycle: 'consulting' as const,
      priority: 'high' as const,
      updatedAt: '2026-08-15T08:00:00.000Z',
    }),
  ]),
  pageInfo: Object.freeze({ page: 1, pageSize: 20 as const, hasMore: false }),
});

beforeEach(() => {
  mocks.readCustomers.mockReset();
  mocks.readCustomers.mockResolvedValue(ready);
});

describe('GET /api/v1/institution/customers', () => {
  it('返回 exact low-sensitive contract 与 no-store', async () => {
    const response = await GET(
      new Request('http://localhost/api/v1/institution/customers?page=1'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      records: ready.records,
      pageInfo: ready.pageInfo,
    });
    expect(mocks.readCustomers).toHaveBeenCalledOnce();
    const params = mocks.readCustomers.mock.calls[0]?.[0] as URLSearchParams;
    expect(params.get('page')).toBe('1');
  });

  it.each([
    [
      { kind: 'invalid_query', code: 'invalid_customer_query' },
      400,
      { code: 'invalid_customer_query' },
    ],
    [
      { kind: 'forbidden' },
      403,
      { code: 'institution_customer_list_forbidden' },
    ],
    [
      { kind: 'unavailable' },
      503,
      { code: 'institution_customer_list_unavailable' },
    ],
  ] as const)('把 %o 映射为低敏 HTTP %i', async (result, status, body) => {
    mocks.readCustomers.mockResolvedValueOnce(result);
    const response = await GET(
      new Request('http://localhost/api/v1/institution/customers'),
    );
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual(body);
  });

  it('route 只连接 orchestration Reader，不直连 DB/legacy/capability', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/v1/institution/customers/route.ts'),
      'utf8',
    );
    expect(source).toContain('readCurrentInstitutionCustomersV1');
    expect(source).not.toContain('getDatabase');
    expect(source).not.toContain('createTenantBusinessRepository');
    expect(source).not.toContain('page_customer_list');
    expect(source).not.toMatch(/export\s+(?:async\s+)?function\s+(?:POST|PATCH|DELETE)/u);
  });

  it('legacy API 继续 503 capability_disabled，page release 由独立 page test 验证', () => {
    const legacy = readFileSync(
      resolve(process.cwd(), 'src/app/api/institution/customers/route.ts'),
      'utf8',
    );
    expect(legacy).toContain("code: 'capability_disabled'");
    expect(legacy).toContain('status: 503');
    expect(legacy).not.toContain('readCurrentInstitutionCustomersV1');
  });
});
