import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  consumeAuthorization: vi.fn(),
  getDatabase: vi.fn(),
  createRepository: vi.fn(),
  createReader: vi.fn(),
  read: vi.fn(),
  contextRows: [] as unknown[],
}));

vi.mock('@/server/orchestration/institution-analytics-read-authorization', () => ({
  resolveInstitutionAnalyticsReadAuthorizationV1: mocks.resolveAuthorization,
  consumeInstitutionAnalyticsReadAuthorizationV1: mocks.consumeAuthorization,
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: mocks.getDatabase,
}));

vi.mock(
  '@/modules/institution-analytics/server/institution-analytics-overview-repository',
  () => ({
    createInstitutionAnalyticsOverviewRepository: mocks.createRepository,
  }),
);

vi.mock(
  '@/modules/institution-analytics/application/institution/analytics-overview-reader',
  () => ({
    createAnalyticsOverviewReaderV1: mocks.createReader,
  }),
);

import {
  readCurrentInstitutionAnalyticsOverviewV1,
} from '@/server/orchestration/institution-analytics-overview-reader';

function database() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => mocks.contextRows),
          })),
        })),
      })),
    })),
  };
}

describe('institution Analytics overview orchestration', () => {
  beforeEach(() => {
    for (const mock of [
      mocks.resolveAuthorization,
      mocks.consumeAuthorization,
      mocks.getDatabase,
      mocks.createRepository,
      mocks.createReader,
      mocks.read,
    ]) mock.mockReset();

    mocks.contextRows = [
      {
        tenantId: 'growth-tenant-chengxing',
        institutionId: 'growth-inst-chengxing',
        latestVersion: 1,
        timezone: 'Asia/Shanghai',
        currency: 'CNY',
      },
    ];
    mocks.resolveAuthorization.mockResolvedValue({
      kind: 'allowed',
      authorization: {},
    });
    mocks.consumeAuthorization.mockReturnValue({
      tenantId: 'growth-tenant-chengxing',
      institutionId: 'growth-inst-chengxing',
      observedAt: '2026-08-17T01:00:00.000Z',
    });
    mocks.getDatabase.mockReturnValue(database());
    mocks.createRepository.mockReturnValue({ listFacts: vi.fn() });
    mocks.createReader.mockReturnValue({ read: mocks.read });
    mocks.read.mockResolvedValue({
      kind: 'ready',
      overview: { dataState: 'empty' },
    });
    vi.spyOn(Date, 'now').mockReturnValue(
      Date.parse('2026-08-17T01:00:00.000Z'),
    );
  });

  it('one-shot formal pair + current operating context 组成唯一 Analytics reader 输入', async () => {
    const result = await readCurrentInstitutionAnalyticsOverviewV1();

    expect(result).toEqual({
      kind: 'ready',
      overview: { dataState: 'empty' },
    });
    expect(mocks.read).toHaveBeenCalledWith({
      tenantId: 'growth-tenant-chengxing',
      institutionId: 'growth-inst-chengxing',
      timeZone: 'Asia/Shanghai',
      defaultCurrency: 'CNY',
      asOf: '2026-08-17T01:00:00.000Z',
    });
  });

  it('forbidden authorization 不访问数据库', async () => {
    mocks.resolveAuthorization.mockResolvedValue({ kind: 'forbidden' });
    await expect(readCurrentInstitutionAnalyticsOverviewV1()).resolves.toEqual({
      kind: 'forbidden',
    });
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });

  it('Operating Context 非 exact-one 时 fail-closed', async () => {
    mocks.contextRows = [];
    await expect(readCurrentInstitutionAnalyticsOverviewV1()).resolves.toEqual({
      kind: 'unavailable',
    });
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
