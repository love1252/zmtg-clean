import { describe, expect, it, vi } from 'vitest';

import { createKnowledgeQuotaUsageCommandRepository } from '@/modules/knowledge/server/knowledge-quota-usage-command-repository';
import type { TenantDatabase } from '@/server/db/client';

function databaseFixture() {
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));
  const update = vi.fn();
  const deleteFn = vi.fn();

  return {
    database: {
      insert,
      update,
      delete: deleteFn,
    } as unknown as TenantDatabase,
    values,
    insert,
    update,
    deleteFn,
  };
}

describe('Knowledge quota usage command repository', () => {
  it('appends institution-scoped evidence with non-null institutionId', async () => {
    const fixture = databaseFixture();
    const repository = createKnowledgeQuotaUsageCommandRepository(
      fixture.database,
    );

    await repository.append({
      scope: {
        kind: 'institution',
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
      },
      actorUserId: 'user-a',
      resourceKey: 'knowledge_files',
      action: 'upload_file',
      status: 'succeeded',
      quantity: 1,
      safeReasonCode: 'succeeded',
    });

    expect(fixture.insert).toHaveBeenCalledTimes(1);
    expect(fixture.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        actorUserId: 'user-a',
        resourceKey: 'knowledge_files',
        action: 'upload_file',
        status: 'succeeded',
        quantity: 1,
        safeReasonCode: 'succeeded',
      }),
    );
    expect(fixture.update).not.toHaveBeenCalled();
    expect(fixture.deleteFn).not.toHaveBeenCalled();
  });

  it('appends tenant-scoped evidence with institutionId=null', async () => {
    const fixture = databaseFixture();
    const repository = createKnowledgeQuotaUsageCommandRepository(
      fixture.database,
    );

    await repository.append({
      scope: { kind: 'tenant', tenantId: 'tenant-a' },
      actorUserId: null,
      resourceKey: 'knowledge_ocr_jobs_monthly',
      action: 'ocr_file',
      status: 'failed',
      quantity: 1,
      safeReasonCode: 'failed',
    });

    expect(fixture.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: null,
      }),
    );
    expect(fixture.insert).toHaveBeenCalledTimes(1);
    expect(fixture.update).not.toHaveBeenCalled();
    expect(fixture.deleteFn).not.toHaveBeenCalled();
  });
});
