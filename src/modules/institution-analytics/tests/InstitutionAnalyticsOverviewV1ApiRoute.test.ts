import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
}));

vi.mock('@/server/orchestration/institution-analytics-overview-reader', () => ({
  readCurrentInstitutionAnalyticsOverviewV1: mocks.read,
}));

import { GET } from '@/app/api/v1/institution/analytics/route';

const overview = Object.freeze({
  contractVersion: 'v1' as const,
  preset: 'month' as const,
  comparisonMode: 'previous_equal_length_period' as const,
  timeZone: 'Asia/Shanghai',
  defaultCurrency: 'CNY',
  asOfBusinessDate: '2026-08-17',
  currentPeriod: Object.freeze({
    startDate: '2026-08-01',
    endDateExclusive: '2026-08-18',
    localDayCount: 17,
  }),
  previousPeriod: Object.freeze({
    startDate: '2026-07-15',
    endDateExclusive: '2026-08-01',
    localDayCount: 17,
  }),
  dataState: 'empty' as const,
  currencies: Object.freeze([]),
});

describe('GET /api/v1/institution/analytics', () => {
  beforeEach(() => mocks.read.mockReset());

  it('只接受服务端固定本月周期并返回 no-store DTO', async () => {
    mocks.read.mockResolvedValue({ kind: 'ready', overview });
    const response = await GET(
      new Request('http://localhost/api/v1/institution/analytics'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual(overview);
  });

  it('任何客户端时间查询参数均返回 400', async () => {
    const response = await GET(
      new Request('http://localhost/api/v1/institution/analytics?preset=custom'),
    );
    expect(response.status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it('正式授权拒绝返回 403', async () => {
    mocks.read.mockResolvedValue({ kind: 'forbidden' });
    const response = await GET(
      new Request('http://localhost/api/v1/institution/analytics'),
    );
    expect(response.status).toBe(403);
  });

  it('任何非 ready 结果返回 503', async () => {
    mocks.read.mockResolvedValue({ kind: 'unavailable' });
    const response = await GET(
      new Request('http://localhost/api/v1/institution/analytics'),
    );
    expect(response.status).toBe(503);
  });
});
