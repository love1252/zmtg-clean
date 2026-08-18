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

  it('GET rejects caller-supplied scope/query and otherwise returns formal runtime only', async () => {
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
