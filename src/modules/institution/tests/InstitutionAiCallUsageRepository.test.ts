import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import { createAiCallUsageRepository } from '@/modules/institution/server/institution-ai-call-usage-repository';
import type { AiCreditMeteringDetails } from '@/modules/institution/domain/ai-credits-metering';
import type { TenantDatabase } from '@/server/db/client';
import { aiCallUsageRecords } from '@/server/db/schema';

const meteringDetails = {
  meteringVersion: 'ai-credits-v0.6-test',
  inputTokens: 80,
  outputTokens: 40,
  totalTokens: 120,
  inputTokenWeight: 1,
  outputTokenWeight: 3,
  modelMultiplier: 2,
  creditsPerStandardTokenUnit: 100,
  ragCreditSurcharge: 1,
  weightedStandardTokens: 400,
  formulaVersion: 'ai-credits-v0.6-domain-03',
  billable: true,
  reason: 'succeeded_metered',
  usageStatus: 'succeeded',
} satisfies AiCreditMeteringDetails;

function createInsertDatabase(row: unknown) {
  const returning = vi.fn(async () => [row]);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));

  return {
    database: { insert } as unknown as TenantDatabase,
    insert,
    returning,
    values,
  };
}

describe('AI call usage repository metering 写入', () => {
  it('createUsageRecord 支持写入 credits 字段且不改变 token/provider/model/metadata 保存', async () => {
    const createdAt = new Date('2026-06-29T10:00:00.000Z');
    const query = createInsertDatabase({
      id: 'ai-usage-001',
      tenantId: 'tenant-001',
      institutionId: 'inst-001',
      actorUserId: 'user-001',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      promptTokens: 80,
      completionTokens: 40,
      totalTokens: 120,
      latencyMs: 321,
      status: 'succeeded',
      errorCode: null,
      aiCreditsConsumed: 5,
      meteringStatus: 'metered',
      meteringVersion: 'ai-credits-v0.6-test',
      meteringDetails,
      serviceCategory: 'knowledge_base_qa',
      serviceName: '知识库问答',
      serviceSource: 'institution_knowledge_qa',
      serviceAction: 'rag_answer',
      serviceVersion: 'v06-service-metering-1',
      metadata: {
        knowledgeContext: {
          used: true,
          sources: [{
            knowledgeId: 'kb-001',
            knowledgeTitle: '术后护理',
            fileId: 'file-001',
            fileName: '护理.pdf',
            chunkId: 'chunk-001',
            chunkIndex: 0,
            textPreview: '冷敷后注意观察。',
            matchReason: '包含关键词',
          }],
        },
      },
      createdAt,
    });

    const result = await createAiCallUsageRepository(query.database).createUsageRecord({
      id: 'ai-usage-001',
      tenantId: 'tenant-001',
      institutionId: 'inst-001',
      actorUserId: 'user-001',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      promptTokens: 80,
      completionTokens: 40,
      totalTokens: 120,
      latencyMs: 321,
      status: 'succeeded',
      errorCode: null,
      aiCreditsConsumed: 5,
      meteringStatus: 'metered',
      meteringVersion: 'ai-credits-v0.6-test',
      meteringDetails,
      serviceCategory: 'knowledge_base_qa',
      serviceName: '知识库问答',
      serviceSource: 'institution_knowledge_qa',
      serviceAction: 'rag_answer',
      serviceVersion: 'v06-service-metering-1',
      metadata: {
        knowledgeContext: {
          used: true,
          sources: [{
            knowledgeId: 'kb-001',
            knowledgeTitle: '术后护理',
            fileId: 'file-001',
            fileName: '护理.pdf',
            chunkId: 'chunk-001',
            chunkIndex: 0,
            textPreview: '冷敷后注意观察。',
            matchReason: '包含关键词',
          }],
        },
      },
    });

    expect(query.insert).toHaveBeenCalledWith(aiCallUsageRecords);
    expect(query.values).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      promptTokens: 80,
      completionTokens: 40,
      totalTokens: 120,
      aiCreditsConsumed: 5,
      meteringStatus: 'metered',
      meteringVersion: 'ai-credits-v0.6-test',
      meteringDetails,
      serviceCategory: 'knowledge_base_qa',
      serviceName: '知识库问答',
      serviceSource: 'institution_knowledge_qa',
      serviceAction: 'rag_answer',
      serviceVersion: 'v06-service-metering-1',
      metadata: expect.objectContaining({
        knowledgeContext: expect.objectContaining({ used: true }),
      }),
    }));
    expect(result).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      promptTokens: 80,
      completionTokens: 40,
      totalTokens: 120,
      aiCreditsConsumed: 5,
      meteringStatus: 'metered',
      meteringVersion: 'ai-credits-v0.6-test',
      meteringDetails,
      serviceCategory: 'knowledge_base_qa',
      serviceName: '知识库问答',
      serviceSource: 'institution_knowledge_qa',
      serviceAction: 'rag_answer',
      serviceVersion: 'v06-service-metering-1',
    });
  });

  it('createUsageRecord 未传入 service project 字段时写入 null 并保持兼容', async () => {
    const createdAt = new Date('2026-06-29T10:00:00.000Z');
    const query = createInsertDatabase({
      id: 'ai-usage-002',
      tenantId: 'tenant-001',
      institutionId: 'inst-001',
      actorUserId: 'user-001',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      latencyMs: null,
      status: 'failed',
      errorCode: 'NETWORK_ERROR',
      aiCreditsConsumed: 0,
      meteringStatus: 'not_billable',
      meteringVersion: null,
      meteringDetails: null,
      serviceCategory: null,
      serviceName: null,
      serviceSource: null,
      serviceAction: null,
      serviceVersion: null,
      metadata: null,
      createdAt,
    });

    const result = await createAiCallUsageRepository(query.database).createUsageRecord({
      id: 'ai-usage-002',
      tenantId: 'tenant-001',
      institutionId: 'inst-001',
      actorUserId: 'user-001',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      latencyMs: null,
      status: 'failed',
      errorCode: 'NETWORK_ERROR',
      aiCreditsConsumed: 0,
      meteringStatus: 'not_billable',
      meteringVersion: null,
      meteringDetails: null,
      metadata: null,
    });

    expect(query.values).toHaveBeenCalledWith(expect.objectContaining({
      serviceCategory: null,
      serviceName: null,
      serviceSource: null,
      serviceAction: null,
      serviceVersion: null,
    }));
    expect(result).toMatchObject({
      serviceCategory: null,
      serviceName: null,
      serviceSource: null,
      serviceAction: null,
      serviceVersion: null,
    });
  });

  it('institution metrics read projects only low-sensitivity fields and binds tenant, institution, and a half-open time window', async () => {
    const limit = vi.fn(async () => []);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn((_condition: SQL) => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createAiCallUsageRepository({ select } as unknown as TenantDatabase);
    const startInclusiveEpochMs = 1_700_000_000_000;
    const endExclusiveEpochMs = 1_700_000_100_000;

    await repository.listInstitutionUsageMetricRecords({
      tenantId: 'tenant-a', institutionId: 'institution-a', startInclusiveEpochMs, endExclusiveEpochMs,
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
      'tenant-a', 'institution-a',
      new Date(startInclusiveEpochMs).toISOString(), new Date(endExclusiveEpochMs).toISOString(),
    ]);
    expect(limit).toHaveBeenCalledWith(10_001);
  });
});
