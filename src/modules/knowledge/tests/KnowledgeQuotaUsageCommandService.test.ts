import { describe, expect, it, vi } from 'vitest';

import {
  createKnowledgeQuotaUsageCommandService,
  KnowledgeQuotaUsageCommandInputError,
  type KnowledgeQuotaUsageCommandRepository,
} from '@/modules/knowledge/application/quota/knowledge-quota-usage-command-service';

function repositoryFixture() {
  const append = vi.fn(async () => undefined);
  const repository: KnowledgeQuotaUsageCommandRepository = { append };
  return { append, repository };
}

describe('Knowledge quota usage command service', () => {
  it('preserves explicit institution scope and normalizes optional fields', async () => {
    const { append, repository } = repositoryFixture();
    const service = createKnowledgeQuotaUsageCommandService(repository);

    await service.appendUsage({
      scope: {
        kind: 'institution',
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
      },
      actorUserId: 'user-a',
      resourceKey: 'knowledge_files',
      action: 'upload_file',
      status: 'allowed',
    });

    expect(append).toHaveBeenCalledWith({
      scope: {
        kind: 'institution',
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
      },
      actorUserId: 'user-a',
      resourceKey: 'knowledge_files',
      action: 'upload_file',
      status: 'allowed',
      quantity: 1,
      safeReasonCode: 'allowed',
    });
  });

  it('preserves explicit tenant scope without synthesizing an institution', async () => {
    const { append, repository } = repositoryFixture();
    const service = createKnowledgeQuotaUsageCommandService(repository);

    await service.appendUsage({
      scope: { kind: 'tenant', tenantId: 'tenant-a' },
      actorUserId: null,
      resourceKey: 'knowledge_ocr_jobs_monthly',
      action: 'ocr_file',
      status: 'rejected',
      safeReasonCode: 'feature_disabled',
      quantity: 1,
    });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: 'tenant', tenantId: 'tenant-a' },
        actorUserId: null,
        safeReasonCode: 'feature_disabled',
      }),
    );
  });

  it.each([
    {
      name: 'blank tenant',
      input: {
        scope: { kind: 'tenant' as const, tenantId: ' ' },
        resourceKey: 'knowledge_files' as const,
        action: 'upload_file' as const,
        status: 'allowed' as const,
      },
    },
    {
      name: 'blank institution',
      input: {
        scope: {
          kind: 'institution' as const,
          tenantId: 'tenant-a',
          institutionId: '',
        },
        resourceKey: 'knowledge_files' as const,
        action: 'upload_file' as const,
        status: 'allowed' as const,
      },
    },
    {
      name: 'invalid quantity',
      input: {
        scope: { kind: 'tenant' as const, tenantId: 'tenant-a' },
        resourceKey: 'knowledge_files' as const,
        action: 'upload_file' as const,
        status: 'allowed' as const,
        quantity: 0,
      },
    },
    {
      name: 'rejected without safe reason',
      input: {
        scope: { kind: 'tenant' as const, tenantId: 'tenant-a' },
        resourceKey: 'knowledge_files' as const,
        action: 'upload_file' as const,
        status: 'rejected' as const,
      },
    },
    {
      name: 'blank actor',
      input: {
        scope: { kind: 'tenant' as const, tenantId: 'tenant-a' },
        actorUserId: ' ',
        resourceKey: 'knowledge_files' as const,
        action: 'upload_file' as const,
        status: 'allowed' as const,
      },
    },
  ])('fails closed for $name', async ({ input }) => {
    const { append, repository } = repositoryFixture();
    const service = createKnowledgeQuotaUsageCommandService(repository);

    await expect(service.appendUsage(input)).rejects.toBeInstanceOf(
      KnowledgeQuotaUsageCommandInputError,
    );
    expect(append).not.toHaveBeenCalled();
  });
});
