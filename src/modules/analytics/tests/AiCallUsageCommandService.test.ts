import { describe, expect, it, vi } from 'vitest';

import {
  AiCallUsageCommandInputError,
  createAiCallUsageCommandService,
  type AiCallUsageCommandRepository,
  type AnalyticsAiCallUsageRecord,
  type NormalizedAiCallUsageAppend,
} from '@/modules/analytics/application/ai-call-usage-command-service';

function fixture() {
  const append = vi.fn(
    async (
      _input: NormalizedAiCallUsageAppend,
    ): Promise<AnalyticsAiCallUsageRecord> =>
      ({ createdAt: new Date('2026-08-10T00:00:00.000Z') }) as AnalyticsAiCallUsageRecord,
  );
  const repository: AiCallUsageCommandRepository = { append };
  return { append, service: createAiCallUsageCommandService(repository) };
}

function baseInput() {
  return {
    id: 'ai-usage-001',
    actorUserId: 'user-001',
    provider: 'deepseek',
    model: 'deepseek-v4',
    promptTokens: 80,
    completionTokens: 40,
    totalTokens: 120,
    latencyMs: 321,
    status: 'succeeded' as const,
    errorCode: null,
    aiCreditsConsumed: 5,
    meteringStatus: 'metered' as const,
    meteringVersion: 'ai-credits-v1',
    meteringDetails: { billable: true },
    serviceCategory: 'knowledge_base_qa',
    serviceName: '知识库问答',
    serviceSource: 'institution_knowledge_qa',
    serviceAction: 'rag_answer',
    serviceVersion: 'v1',
    metadata: { knowledgeContext: { used: true } },
  };
}

describe('Analytics AI call usage command service', () => {
  it('preserves explicit institution scope and usage fact', async () => {
    const { append, service } = fixture();
    await service.appendUsage({
      ...baseInput(),
      scope: { kind: 'institution', tenantId: 'tenant-001', institutionId: 'inst-001' },
    });

    expect(append).toHaveBeenCalledWith({
      ...baseInput(),
      scope: { kind: 'institution', tenantId: 'tenant-001', institutionId: 'inst-001' },
    });
  });

  it('preserves tenant scope without synthesizing institution attribution', async () => {
    const { append, service } = fixture();
    await service.appendUsage({
      ...baseInput(),
      scope: { kind: 'tenant', tenantId: 'tenant-001' },
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      latencyMs: null,
      aiCreditsConsumed: null,
      meteringStatus: null,
      meteringVersion: null,
      meteringDetails: null,
      serviceCategory: null,
      serviceName: null,
      serviceSource: null,
      serviceAction: null,
      serviceVersion: null,
      metadata: null,
    });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: 'tenant', tenantId: 'tenant-001' },
      }),
    );
  });

  it.each([
    ['blank tenant', { ...baseInput(), scope: { kind: 'tenant' as const, tenantId: ' ' } }],
    ['blank institution', {
      ...baseInput(),
      scope: { kind: 'institution' as const, tenantId: 'tenant-001', institutionId: '' },
    }],
    ['invalid status', {
      ...baseInput(),
      scope: { kind: 'tenant' as const, tenantId: 'tenant-001' },
      status: 'unknown' as never,
    }],
    ['negative tokens', {
      ...baseInput(),
      scope: { kind: 'tenant' as const, tenantId: 'tenant-001' },
      promptTokens: -1,
    }],
    ['fractional latency', {
      ...baseInput(),
      scope: { kind: 'tenant' as const, tenantId: 'tenant-001' },
      latencyMs: 1.5,
    }],
    ['negative credits', {
      ...baseInput(),
      scope: { kind: 'tenant' as const, tenantId: 'tenant-001' },
      aiCreditsConsumed: -1,
    }],
    ['blank provider', {
      ...baseInput(),
      scope: { kind: 'tenant' as const, tenantId: 'tenant-001' },
      provider: ' ',
    }],
    ['invalid metering status', {
      ...baseInput(),
      scope: { kind: 'tenant' as const, tenantId: 'tenant-001' },
      meteringStatus: 'unknown' as never,
    }],
  ])('fails closed for %s', async (_name, input) => {
    const { append, service } = fixture();
    await expect(service.appendUsage(input)).rejects.toBeInstanceOf(
      AiCallUsageCommandInputError,
    );
    expect(append).not.toHaveBeenCalled();
  });
});
