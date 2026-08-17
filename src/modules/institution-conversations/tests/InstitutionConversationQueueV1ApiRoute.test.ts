import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-conversation-queue-reader', () => ({
  readCurrentInstitutionConversationQueueV1: mocks.read,
}));

import { GET } from '@/app/api/v1/institution/conversations/route';

const queue = Object.freeze({
  contractVersion: 'v1' as const,
  dataState: 'empty' as const,
  records: Object.freeze([]),
  pageInfo: Object.freeze({ pageSize: 100 as const, hasMore: false }),
});

describe('GET /api/v1/institution/conversations', () => {
  beforeEach(() => mocks.read.mockReset());

  it('无 caller scope/query 时返回 no-store formal queue DTO', async () => {
    mocks.read.mockResolvedValue({ kind: 'ready', queue });
    const response = await GET(
      new Request('http://localhost/api/v1/institution/conversations'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual(queue);
  });

  it('任何客户端查询参数均返回 400 且不进入 reader', async () => {
    const response = await GET(
      new Request('http://localhost/api/v1/institution/conversations?institutionId=other'),
    );

    expect(response.status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('formal authorization forbidden 返回 403', async () => {
    mocks.read.mockResolvedValue({ kind: 'forbidden' });
    const response = await GET(
      new Request('http://localhost/api/v1/institution/conversations'),
    );
    expect(response.status).toBe(403);
  });

  it('任何非 ready 结果返回 503', async () => {
    mocks.read.mockResolvedValue({ kind: 'unavailable' });
    const response = await GET(
      new Request('http://localhost/api/v1/institution/conversations'),
    );
    expect(response.status).toBe(503);
  });
});
