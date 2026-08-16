import {
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const mocks = vi.hoisted(() => ({
  readAiUsage: vi.fn(),
}));

vi.mock(
  '@/server/orchestration/institution-ai-usage-metrics-reader',
  () => ({
    readCurrentInstitutionAiUsageMetricsV1:
      mocks.readAiUsage,
  }),
);

import {
  GET,
} from '@/app/api/v1/institution/ai-service-usage/route';

const emptyMetrics = Object.freeze({
  totalCallCount: 0,
  serviceUnits: null,
  failureCount: 0,
  rejectionCount: 0,
  incompleteCount: 0,
  successRate: Object.freeze({
    numerator: 0,
    denominator: 0,
    value: null,
  }),
  byServiceKey: Object.freeze([]),
});

beforeEach(() => {
  mocks.readAiUsage.mockReset();
  mocks.readAiUsage.mockResolvedValue(
    Object.freeze({
      kind: 'ready',
      preset: 'currentMonth',
      metrics: emptyMetrics,
    }),
  );
});

describe('GET /api/v1/institution/ai-service-usage', () => {
  it('返回 exact low-sensitive metrics 与 no-store', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/v1/institution/ai-service-usage?preset=currentMonth',
      ),
    );

    expect(response.status).toBe(200);
    expect(
      response.headers.get('cache-control'),
    ).toBe('no-store');

    await expect(
      response.json(),
    ).resolves.toEqual(emptyMetrics);

    const params =
      mocks.readAiUsage.mock.calls[0]?.[0] as URLSearchParams;

    expect(params.get('preset')).toBe(
      'currentMonth',
    );
  });

  it.each([
    [
      {
        kind: 'invalid_query',
        code: 'invalid_ai_usage_query',
      },
      400,
      {
        code: 'invalid_ai_usage_query',
      },
    ],
    [
      {
        kind: 'forbidden',
      },
      403,
      {
        code: 'institution_ai_usage_forbidden',
      },
    ],
    [
      {
        kind: 'unavailable',
      },
      503,
      {
        code: 'institution_ai_usage_unavailable',
      },
    ],
  ] as const)(
    '%o 映射为 no-store HTTP %i',
    async (result, status, body) => {
      mocks.readAiUsage.mockResolvedValueOnce(
        result,
      );

      const response = await GET(
        new Request(
          'http://localhost/api/v1/institution/ai-service-usage',
        ),
      );

      expect(response.status).toBe(status);
      expect(
        response.headers.get('cache-control'),
      ).toBe('no-store');

      await expect(
        response.json(),
      ).resolves.toEqual(body);
    },
  );

  it('V1 Route 只连接 orchestration Reader 且 GET only', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/api/v1/institution/ai-service-usage/route.ts',
      ),
      'utf8',
    );

    expect(source).toContain(
      'readCurrentInstitutionAiUsageMetricsV1',
    );
    expect(source).not.toContain('getDatabase');
    expect(source).not.toContain(
      'createInstitutionAiUsageMetricsSource',
    );
    expect(source).not.toMatch(
      /export\s+(?:async\s+)?function\s+(?:POST|PATCH|PUT|DELETE)/u,
    );
  });

  it('legacy API 保持原 410 capability-off compatibility surface', () => {
    const legacy = readFileSync(
      resolve(
        process.cwd(),
        'src/app/api/institution/ai-service-usage/route.ts',
      ),
      'utf8',
    );

    expect(legacy).toContain(
      "code: 'institution_ai_usage_capability_off'",
    );
    expect(legacy).toContain('status: 410');
    expect(legacy).not.toContain(
      'readCurrentInstitutionAiUsageMetricsV1',
    );
  });
});
