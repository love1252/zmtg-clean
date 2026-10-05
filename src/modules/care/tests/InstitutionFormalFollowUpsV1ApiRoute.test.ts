import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
}));

vi.mock(
  '@/server/orchestration/institution-formal-follow-up-runtime',
  () => ({
    readCurrentInstitutionFormalFollowUpsV1:
      mocks.list,
    createCurrentInstitutionFormalFollowUpV1:
      mocks.create,
  }),
);

import {
  GET,
  POST,
} from '@/app/api/v1/institution/followups/route';

describe('Institution Formal Follow-ups V1 API', () => {
  beforeEach(() => {
    mocks.list.mockReset();
    mocks.create.mockReset();
  });

  it('GET 保留默认读取并拒绝调用方机构范围', async () => {
    mocks.list.mockResolvedValue({
      kind: 'ready',
      records: [],
      canCreate: true,
      hasMore: false,
    });

    const ok = await GET(
      new Request(
        'https://example.test/api/v1/institution/followups',
      ),
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(mocks.list.mock.calls[0]?.[0].toString()).toBe('');

    const invalid = await GET(
      new Request(
        'https://example.test/api/v1/institution/followups?tenantId=other',
      ),
    );
    expect(invalid.status).toBe(400);
    expect(
      mocks.list,
    ).toHaveBeenCalledTimes(1);
  });

  it('GET 将分页筛选交给正式读取器，并保留全范围统计', async () => {
    const result = {
      kind: 'ready', records: [], canCreate: false, hasMore: true,
      pageInfo: { page: 2, pageSize: 20, total: 150, pageCount: 8, hasMore: true },
      summary: { total: 150 },
    };
    mocks.list.mockResolvedValue(result);
    const response = await GET(new Request(
      'https://example.test/api/v1/institution/followups?page=2&pageSize=20&state=pending&dueBucket=due_today&q=客户',
    ));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(mocks.list.mock.calls[0]?.[0].get('dueBucket')).toBe('due_today');
    expect(mocks.list.mock.calls[0]?.[0].get('page')).toBe('2');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each(['page=0', 'page=1&page=2', 'state=other', 'dueBucket=today', 'q=', 'actorRole=tenant_admin']) (
    'GET 拒绝 %s，且不调用读取器', async (query) => {
      const response = await GET(new Request(`https://example.test/api/v1/institution/followups?${query}`));
      expect(response.status).toBe(400);
      expect(mocks.list).not.toHaveBeenCalled();
    },
  );

  it.each([['forbidden', 403], ['unavailable', 503], ['invalid_query', 400]] as const)(
    'GET 将 %s 映射为 %s，不返回内部数据', async (kind, status) => {
      mocks.list.mockResolvedValue({ kind, internal: '不可暴露的内部信息' });
      const response = await GET(new Request('https://example.test/api/v1/institution/followups'));
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).not.toContain('内部信息');
    },
  );

  it('POST maps idempotency conflict and rejects oversized input before runtime', async () => {
    mocks.create.mockResolvedValue({
      kind: 'conflict',
      code: 'idempotency_conflict',
    });

    const conflict = await POST(
      new Request(
        'https://example.test/api/v1/institution/followups',
        {
          method: 'POST',
          headers: {
            'content-type':
              'application/json',
          },
          body: JSON.stringify({
            idempotencyKey:
              'manual-test-001',
            customerId: 'customer-1',
            stageCode:
              'manual_followup',
            actionCode:
              'manual_contact',
            dueAt:
              '2026-08-18T00:00:00.000Z',
            assignment: {
              kind: 'role_pool',
              role:
                'customer_service',
            },
          }),
        },
      ),
    );
    expect(conflict.status).toBe(409);

    mocks.create.mockClear();
    const oversized = await POST(
      new Request(
        'https://example.test/api/v1/institution/followups',
        {
          method: 'POST',
          headers: {
            'content-type':
              'application/json',
            'content-length':
              String(9 * 1024),
          },
          body: '{}',
        },
      ),
    );
    expect(oversized.status).toBe(400);
    expect(
      mocks.create,
    ).not.toHaveBeenCalled();
  });
});
