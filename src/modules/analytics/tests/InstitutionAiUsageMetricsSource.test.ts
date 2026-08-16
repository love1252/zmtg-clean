import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createInstitutionAiUsageMetricsSource,
  INSTITUTION_AI_USAGE_SOURCE_LIMIT_WITH_SENTINEL,
} from '@/modules/analytics/server/institution-ai-usage-metrics-source';
import type { TenantDatabase } from '@/server/db/client';

const mocks = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
};

const database = {
  select: mocks.select,
} as unknown as TenantDatabase;

const input = Object.freeze({
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  startInclusiveEpochMs: Date.parse('2026-08-01T00:00:00.000Z'),
  endExclusiveEpochMs: Date.parse('2026-08-08T00:00:00.000Z'),
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());

  mocks.select.mockReturnValue({ from: mocks.from });
  mocks.from.mockReturnValue({ where: mocks.where });
  mocks.where.mockReturnValue({ orderBy: mocks.orderBy });
  mocks.orderBy.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockResolvedValue([
    {
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      status: 'succeeded',
      serviceCategory: 'ai_qa',
      serviceAction: 'direct_answer',
      createdAt: new Date('2026-08-02T00:00:00.000Z'),
    },
  ]);
});

describe('Analytics institution AI usage metrics source', () => {
  it('只投影 Reader 所需低敏字段，并使用 10001 sentinel', async () => {
    const source = createInstitutionAiUsageMetricsSource(database);

    await expect(
      source.listInstitutionUsageMetricRecords(input),
    ).resolves.toEqual([
      {
        tenantId: 'tenant-001',
        institutionId: 'institution-001',
        status: 'succeeded',
        serviceCategory: 'ai_qa',
        serviceAction: 'direct_answer',
        createdAt: new Date('2026-08-02T00:00:00.000Z'),
      },
    ]);

    expect(Object.keys(mocks.select.mock.calls[0]?.[0] ?? {})).toEqual([
      'tenantId',
      'institutionId',
      'status',
      'serviceCategory',
      'serviceAction',
      'createdAt',
    ]);
    expect(mocks.orderBy).toHaveBeenCalledTimes(1);
    expect(mocks.orderBy.mock.calls[0]).toHaveLength(2);
    expect(mocks.limit).toHaveBeenCalledWith(
      INSTITUTION_AI_USAGE_SOURCE_LIMIT_WITH_SENTINEL,
    );
    expect(INSTITUTION_AI_USAGE_SOURCE_LIMIT_WITH_SENTINEL).toBe(10_001);
  });

  it('非法 source query 在数据库访问前 fail-closed', async () => {
    const source = createInstitutionAiUsageMetricsSource(database);

    await expect(
      source.listInstitutionUsageMetricRecords({
        ...input,
        endExclusiveEpochMs: input.startInclusiveEpochMs,
      }),
    ).rejects.toThrow('invalid_institution_ai_usage_metrics_source_query');

    expect(mocks.select).not.toHaveBeenCalled();
  });

  it('生产 Source 固定 exact pair、half-open window，且不投影高敏字段', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/analytics/server/institution-ai-usage-metrics-source.ts',
      ),
      'utf8',
    );

    expect(source).toContain(
      'eq(aiCallUsageRecords.tenantId, input.tenantId)',
    );
    expect(source).toContain(
      'eq(aiCallUsageRecords.institutionId, input.institutionId)',
    );
    expect(source).toContain(
      'gte(aiCallUsageRecords.createdAt, startInclusive)',
    );
    expect(source).toContain(
      'lt(aiCallUsageRecords.createdAt, endExclusive)',
    );

    const projection = source.slice(
      source.indexOf('.select({'),
      source.indexOf('        })\n        .from'),
    );

    for (const forbidden of [
      'actorUserId:',
      'provider:',
      'model:',
      'promptTokens:',
      'completionTokens:',
      'totalTokens:',
      'latencyMs:',
      'errorCode:',
      'aiCreditsConsumed:',
      'meteringDetails:',
      'metadata:',
      'serviceName:',
      'serviceSource:',
      'serviceVersion:',
    ]) {
      expect(projection).not.toContain(forbidden);
    }
  });
});
