import { describe, expect, it, vi } from 'vitest';

import { createKnowledgeQuotaWriter } from '@/server/orchestration/knowledge-quota-writer';
import type { TenantDatabase } from '@/server/db/client';

function databaseFixture() {
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));
  return {
    database: { insert } as unknown as TenantDatabase,
    values,
    insert,
  };
}

describe('Knowledge quota writer orchestration', () => {
  it('maps an allowed TenantQuotaDecision into institution-scoped canonical evidence', async () => {
    const fixture = databaseFixture();
    const writer = createKnowledgeQuotaWriter(fixture.database);

    await writer.recordDecision({
      scope: {
        kind: 'institution',
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
      },
      actorUserId: 'user-a',
      resourceKey: 'knowledge_files',
      action: 'upload_file',
      decision: {
        allowed: true,
        current: 0,
        limit: 10,
        resource: 'knowledge_files',
      },
      quantity: 1,
    });

    expect(fixture.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        status: 'allowed',
        safeReasonCode: 'allowed',
      }),
    );
  });

  it('maps tenant-scoped rejection without inventing institution scope', async () => {
    const fixture = databaseFixture();
    const writer = createKnowledgeQuotaWriter(fixture.database);

    await writer.recordDecision({
      scope: { kind: 'tenant', tenantId: 'tenant-a' },
      actorUserId: null,
      resourceKey: 'knowledge_ocr_jobs_monthly',
      action: 'ocr_file',
      decision: {
        allowed: false,
        current: 10,
        limit: 10,
        reason: 'quota_exceeded_knowledge_ocr_jobs_monthly',
        resource: 'knowledge_ocr_jobs_monthly',
      },
      quantity: 1,
    });

    expect(fixture.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: null,
        status: 'rejected',
        safeReasonCode: 'quota_exceeded_knowledge_ocr_jobs_monthly',
      }),
    );
  });

  it('rejects non-Knowledge quota resources at the orchestration boundary', async () => {
    const fixture = databaseFixture();
    const writer = createKnowledgeQuotaWriter(fixture.database);

    await expect(
      writer.recordOutcome({
        scope: { kind: 'tenant', tenantId: 'tenant-a' },
        resourceKey: 'customers',
        action: 'upload_file',
        status: 'succeeded',
      }),
    ).rejects.toThrow('non_knowledge_quota_resource');

    expect(fixture.insert).not.toHaveBeenCalled();
  });
});
