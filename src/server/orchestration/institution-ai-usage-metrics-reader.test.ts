import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  consumeAuthorization: vi.fn(),
  createSource: vi.fn(),
  getDatabase: vi.fn(),
  listRecords: vi.fn(),
  resolveAuthorization: vi.fn(),
}));

vi.mock(
  '@/server/orchestration/institution-ai-usage-read-authorization',
  () => ({
    resolveInstitutionAiUsageReadAuthorizationV1:
      mocks.resolveAuthorization,
    consumeInstitutionAiUsageReadAuthorizationV1:
      mocks.consumeAuthorization,
  }),
);

vi.mock(
  '@/modules/analytics/server/institution-ai-usage-metrics-source',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import(
        '@/modules/analytics/server/institution-ai-usage-metrics-source'
      )
    >()),
    createInstitutionAiUsageMetricsSource:
      mocks.createSource,
  }),
);

vi.mock('@/server/db/client', () => ({
  getDatabase: mocks.getDatabase,
}));

import {
  readCurrentInstitutionAiUsageMetricsV1,
} from '@/server/orchestration/institution-ai-usage-metrics-reader';

const pair = Object.freeze({
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  observedAt: '2026-08-16T08:00:00.000Z',
});

const source = Object.freeze({
  listInstitutionUsageMetricRecords:
    mocks.listRecords,
});

function validRecord(
  overrides: Partial<{
    tenantId: string;
    institutionId: string | null;
    status: string | null;
    serviceCategory: string | null;
    serviceAction: string | null;
    createdAt: Date;
  }> = {},
) {
  return {
    tenantId: 'tenant-001',
    institutionId: 'institution-001',
    status: 'succeeded',
    serviceCategory: 'ai_qa',
    serviceAction: 'direct_answer',
    createdAt: new Date('2026-08-16T04:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  Object.values(mocks).forEach((mock) => mock.mockReset());

  vi.spyOn(Date, 'now').mockReturnValue(
    Date.parse('2026-08-16T08:00:00.000Z'),
  );

  mocks.resolveAuthorization.mockResolvedValue(
    Object.freeze({
      kind: 'allowed',
      authorization: Object.freeze({}),
    }),
  );

  mocks.consumeAuthorization.mockReturnValue(pair);
  mocks.getDatabase.mockReturnValue(
    Object.freeze({ database: true }),
  );
  mocks.createSource.mockReturnValue(source);
  mocks.listRecords.mockResolvedValue([]);
});

describe('SYS-01 formal AI usage metrics orchestration', () => {
  it('empty cohort 是 ready，且 serviceUnits=null', async () => {
    const result =
      await readCurrentInstitutionAiUsageMetricsV1(
        new URLSearchParams(),
      );

    expect(result).toEqual({
      kind: 'ready',
      preset: 'currentMonth',
      metrics: {
        totalCallCount: 0,
        serviceUnits: null,
        failureCount: 0,
        rejectionCount: 0,
        incompleteCount: 0,
        successRate: {
          numerator: 0,
          denominator: 0,
          value: null,
        },
        byServiceKey: [],
      },
    });

    expect(mocks.listRecords).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      startInclusiveEpochMs:
        Date.parse('2026-07-31T16:00:00.000Z'),
      endExclusiveEpochMs:
        Date.parse('2026-08-31T16:00:00.000Z'),
    });
  });

  it('recognized formal row 产生低敏 metrics，serviceUnits 仍保持不可伪造的 null', async () => {
    mocks.listRecords.mockResolvedValueOnce([
      validRecord(),
    ]);

    const result =
      await readCurrentInstitutionAiUsageMetricsV1(
        new URLSearchParams('preset=today'),
      );

    expect(result).toMatchObject({
      kind: 'ready',
      preset: 'today',
      metrics: {
        totalCallCount: 1,
        serviceUnits: null,
        failureCount: 0,
        rejectionCount: 0,
        incompleteCount: 0,
        successRate: {
          numerator: 1,
          denominator: 1,
          value: 1,
        },
      },
    });
  });

  it('unknown service tuple 整体 fail-closed', async () => {
    mocks.listRecords.mockResolvedValueOnce([
      validRecord({
        serviceCategory: 'unknown_category',
        serviceAction: 'unknown_action',
      }),
    ]);

    await expect(
      readCurrentInstitutionAiUsageMetricsV1(
        new URLSearchParams(),
      ),
    ).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('cross-pair row 整体 fail-closed', async () => {
    mocks.listRecords.mockResolvedValueOnce([
      validRecord({
        institutionId: 'institution-other',
      }),
    ]);

    await expect(
      readCurrentInstitutionAiUsageMetricsV1(
        new URLSearchParams(),
      ),
    ).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('超过 10000 行整体 fail-closed', async () => {
    mocks.listRecords.mockResolvedValueOnce(
      Array.from(
        { length: 10_001 },
        () => validRecord(),
      ),
    );

    await expect(
      readCurrentInstitutionAiUsageMetricsV1(
        new URLSearchParams(),
      ),
    ).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it.each([
    'preset=custom',
    'from=2026-08-01&to=2026-08-02',
    'preset=today&preset=last7days',
    'preset=today&unknown=value',
  ])(
    '非法 query %s 在 authorization/data access 前返回 invalid_query',
    async (query) => {
      await expect(
        readCurrentInstitutionAiUsageMetricsV1(
          new URLSearchParams(query),
        ),
      ).resolves.toEqual({
        kind: 'invalid_query',
        code: 'invalid_ai_usage_query',
      });

      expect(
        mocks.resolveAuthorization,
      ).not.toHaveBeenCalled();
      expect(mocks.createSource).not.toHaveBeenCalled();
    },
  );

  it('dedicated authorization forbidden 映射为 forbidden', async () => {
    mocks.resolveAuthorization.mockResolvedValueOnce(
      Object.freeze({
        kind: 'forbidden',
      }),
    );

    await expect(
      readCurrentInstitutionAiUsageMetricsV1(
        new URLSearchParams(),
      ),
    ).resolves.toEqual({
      kind: 'forbidden',
    });

    expect(mocks.createSource).not.toHaveBeenCalled();
  });

  it('authorization unavailable 与 consumed pair 缺失都 fail-closed', async () => {
    mocks.resolveAuthorization.mockResolvedValueOnce(
      Object.freeze({
        kind: 'unavailable',
      }),
    );

    await expect(
      readCurrentInstitutionAiUsageMetricsV1(
        new URLSearchParams(),
      ),
    ).resolves.toEqual({
      kind: 'unavailable',
    });

    mocks.resolveAuthorization.mockResolvedValueOnce(
      Object.freeze({
        kind: 'allowed',
        authorization: Object.freeze({}),
      }),
    );
    mocks.consumeAuthorization.mockReturnValueOnce(null);

    await expect(
      readCurrentInstitutionAiUsageMetricsV1(
        new URLSearchParams(),
      ),
    ).resolves.toEqual({
      kind: 'unavailable',
    });
  });
});
