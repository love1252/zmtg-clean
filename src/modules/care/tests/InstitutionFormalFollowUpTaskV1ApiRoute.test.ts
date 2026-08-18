import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock(
  '@/server/orchestration/institution-formal-follow-up-runtime',
  () => ({
    readCurrentInstitutionFormalFollowUpV1:
      mocks.read,
    mutateCurrentInstitutionFormalFollowUpV1:
      mocks.mutate,
  }),
);

import {
  GET,
  PATCH,
} from '@/app/api/v1/institution/followups/[taskId]/route';

describe('Institution Formal Follow-up Task V1 API', () => {
  beforeEach(() => {
    mocks.read.mockReset();
    mocks.mutate.mockReset();
  });

  it('maps hidden/non-owned tasks to 404 without leaking scope', async () => {
    mocks.read.mockResolvedValue({
      kind: 'not_found',
    });

    const response = await GET(
      new Request(
        'https://example.test/api/v1/institution/followups/task-1',
      ),
      {
        params: Promise.resolve({
          taskId: 'task-1',
        }),
      },
    );

    expect(response.status).toBe(404);
  });

  it('maps revision conflict to 409 and rejects query scope', async () => {
    mocks.mutate.mockResolvedValue({
      kind: 'conflict',
      code: 'revision_conflict',
    });

    const response = await PATCH(
      new Request(
        'https://example.test/api/v1/institution/followups/task-1',
        {
          method: 'PATCH',
          headers: {
            'content-type':
              'application/json',
          },
          body: JSON.stringify({
            command: 'claim',
            expectedRevision: 1,
          }),
        },
      ),
      {
        params: Promise.resolve({
          taskId: 'task-1',
        }),
      },
    );
    expect(response.status).toBe(409);

    mocks.mutate.mockClear();
    const invalid = await PATCH(
      new Request(
        'https://example.test/api/v1/institution/followups/task-1?institutionId=other',
        {
          method: 'PATCH',
          headers: {
            'content-type':
              'application/json',
          },
          body: JSON.stringify({
            command: 'claim',
            expectedRevision: 1,
          }),
        },
      ),
      {
        params: Promise.resolve({
          taskId: 'task-1',
        }),
      },
    );
    expect(invalid.status).toBe(400);
    expect(
      mocks.mutate,
    ).not.toHaveBeenCalled();
  });
});
