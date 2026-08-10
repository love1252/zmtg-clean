import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import { createAiCallUsageRepository } from '@/modules/institution/server/institution-ai-call-usage-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  aiCallUsageRecords,
  platformAiProviderConfigs,
} from '@/server/db/schema';

function usageRow() {
  return {
    id: 'ai-usage-001',
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    actorUserId: 'user-a',
    provider: 'deepseek',
    model: 'deepseek-v4',
    promptTokens: 80,
    completionTokens: 40,
    totalTokens: 120,
    latencyMs: 321,
    status: 'succeeded',
    errorCode: null,
    aiCreditsConsumed: 5,
    meteringStatus: 'metered',
    meteringVersion: 'ai-credits-v1',
    meteringDetails: { billable: true },
    serviceCategory: 'knowledge_base_qa',
    serviceName: '知识库问答',
    serviceSource: 'institution_knowledge_qa',
    serviceAction: 'rag_answer',
    serviceVersion: 'v1',
    metadata: null,
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
  };
}

describe('legacy Institution AI call usage repository compatibility', () => {
  it('legacy createUsageRecord fails closed before database mutation', async () => {
    const insert = vi.fn();
    const repository = createAiCallUsageRepository({
      insert,
    } as unknown as TenantDatabase);

    await expect(
      repository.createUsageRecord({
        id: 'ai-usage-001',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
        actorUserId: 'user-a',
        provider: 'deepseek',
        model: 'deepseek-v4',
        promptTokens: 80,
        completionTokens: 40,
        totalTokens: 120,
        latencyMs: 321,
        status: 'succeeded',
        errorCode: null,
        aiCreditsConsumed: 5,
        meteringStatus: 'metered',
        meteringVersion: 'ai-credits-v1',
        meteringDetails: null,
        metadata: null,
      }),
    ).rejects.toThrow('legacy_institution_ai_call_usage_writer_disabled');

    expect(insert).not.toHaveBeenCalled();
  });

  it('findVendorConfig remains compatible', async () => {
    const limit = vi.fn(async () => [{
      provider: 'deepseek',
      baseUrl: 'https://example.invalid',
      model: 'deepseek-v4',
      encryptedApiKey: { encrypted: 'ciphertext' },
      configured: true,
    }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    const repository = createAiCallUsageRepository({
      select,
    } as unknown as TenantDatabase);

    const result = await repository.findVendorConfig('deepseek');
    expect(from).toHaveBeenCalledWith(platformAiProviderConfigs);
    expect(result).toEqual({
      baseUrl: 'https://example.invalid',
      model: 'deepseek-v4',
      encryptedApiKey: { encrypted: 'ciphertext' },
      configured: true,
    });
  });

  it('institution usage Reader remains tenant and institution bound', async () => {
    const limit = vi.fn(async () => [usageRow()]);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn((_condition: SQL) => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    const repository = createAiCallUsageRepository({
      select,
    } as unknown as TenantDatabase);

    const result = await repository.listInstitutionUsageRecords({
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      limit: 50,
    });

    const condition = where.mock.calls[0]?.[0];
    expect(condition).toBeDefined();
    const query = new PgDialect().sqlToQuery(condition!);
    expect(query.sql).toContain('"tenant_id" =');
    expect(query.sql).toContain('"institution_id" =');
    expect(query.params).toEqual(['tenant-a', 'institution-a']);
    expect(limit).toHaveBeenCalledWith(50);
    expect(result[0]).toMatchObject({
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      status: 'succeeded',
    });
  });

  it('institution metrics Reader remains low-sensitive and half-open-window bound', async () => {
    const limit = vi.fn(async () => []);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn((_condition: SQL) => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createAiCallUsageRepository({
      select,
    } as unknown as TenantDatabase);

    const startInclusiveEpochMs = 1_700_000_000_000;
    const endExclusiveEpochMs = 1_700_000_100_000;

    await repository.listInstitutionUsageMetricRecords({
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      startInclusiveEpochMs,
      endExclusiveEpochMs,
    });

    expect(select).toHaveBeenCalledWith({
      tenantId: aiCallUsageRecords.tenantId,
      institutionId: aiCallUsageRecords.institutionId,
      status: aiCallUsageRecords.status,
      serviceCategory: aiCallUsageRecords.serviceCategory,
      serviceAction: aiCallUsageRecords.serviceAction,
      createdAt: aiCallUsageRecords.createdAt,
    });

    const condition = where.mock.calls[0]?.[0];
    expect(condition).toBeDefined();
    const query = new PgDialect().sqlToQuery(condition!);
    expect(query.sql).toContain('"tenant_id" =');
    expect(query.sql).toContain('"institution_id" =');
    expect(query.sql).toContain('"created_at" >=');
    expect(query.sql).toContain('"created_at" <');
    expect(query.params).toEqual([
      'tenant-a',
      'institution-a',
      new Date(startInclusiveEpochMs).toISOString(),
      new Date(endExclusiveEpochMs).toISOString(),
    ]);
    expect(limit).toHaveBeenCalledWith(10_001);
  });

  it('platform usage summary Reader remains compatible', async () => {
    const orderBy = vi.fn(async () => [{
      tenantId: 'tenant-a',
      callCount: 8,
      totalTokens: 1200,
      succeededCount: 5,
      rejectedCount: 1,
      quotaExceededCount: 1,
      failedCount: 2,
    }]);
    const groupBy = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ groupBy }));
    const select = vi.fn(() => ({ from }));

    const repository = createAiCallUsageRepository({
      select,
    } as unknown as TenantDatabase);

    const result = await repository.listPlatformUsageSummary();

    expect(from).toHaveBeenCalledWith(aiCallUsageRecords);
    expect(result).toEqual([{
      tenantId: 'tenant-a',
      callCount: 8,
      totalTokens: 1200,
      succeededCount: 5,
      failedCount: 2,
      rejectedCount: 1,
      quotaExceededCount: 1,
    }]);
  });
});
