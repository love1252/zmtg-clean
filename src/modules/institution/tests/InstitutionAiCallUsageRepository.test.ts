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
    });
  });
});
