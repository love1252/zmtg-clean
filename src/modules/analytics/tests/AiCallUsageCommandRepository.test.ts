import { describe, expect, it, vi } from 'vitest';

import { createAiCallUsageCommandRepository } from '@/modules/analytics/server/ai-call-usage-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import { aiCallUsageRecords } from '@/server/db/schema';

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ai-usage-001',
    tenantId: 'tenant-001',
    institutionId: 'inst-001',
    actorUserId: 'user-001',
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
    metadata: { knowledgeContext: { used: true } },
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    ...overrides,
  };
}

function databaseFixture(row: unknown) {
  const returning = vi.fn(async () => [row]);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  const update = vi.fn();
  const deleteFn = vi.fn();
  return {
    database: { insert, update, delete: deleteFn } as unknown as TenantDatabase,
    insert,
    values,
    update,
    deleteFn,
  };
}

function appendInput() {
  return {
    scope: {
      kind: 'institution' as const,
      tenantId: 'tenant-001',
      institutionId: 'inst-001',
    },
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

describe('Analytics AI call usage command repository', () => {
  it('appends institution-scoped usage and returns the persisted record', async () => {
    const fixture = databaseFixture(baseRow());
    const repository = createAiCallUsageCommandRepository(fixture.database);
    const result = await repository.append(appendInput());

    expect(fixture.insert).toHaveBeenCalledTimes(1);
    expect(fixture.insert).toHaveBeenCalledWith(aiCallUsageRecords);
    expect(fixture.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-001',
        institutionId: 'inst-001',
        status: 'succeeded',
        aiCreditsConsumed: 5,
        serviceAction: 'rag_answer',
      }),
    );
    expect(fixture.update).not.toHaveBeenCalled();
    expect(fixture.deleteFn).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'ai-usage-001',
      tenantId: 'tenant-001',
      institutionId: 'inst-001',
      status: 'succeeded',
      meteringStatus: 'metered',
    });
  });

  it('appends tenant-scoped usage with institutionId=null', async () => {
    const fixture = databaseFixture(baseRow({ institutionId: null }));
    const repository = createAiCallUsageCommandRepository(fixture.database);

    await repository.append({
      ...appendInput(),
      scope: { kind: 'tenant', tenantId: 'tenant-001' },
    });

    expect(fixture.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-001',
        institutionId: null,
      }),
    );
    expect(fixture.update).not.toHaveBeenCalled();
    expect(fixture.deleteFn).not.toHaveBeenCalled();
  });

  it('fails closed when insert returning yields no row', async () => {
    const returning = vi.fn(async () => []);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    const repository = createAiCallUsageCommandRepository({
      insert,
    } as unknown as TenantDatabase);

    await expect(repository.append(appendInput())).rejects.toThrow(
      'ai_call_usage_record_create_failed',
    );
  });
});
