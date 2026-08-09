import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  followUpRepository: vi.fn(() => ({})),
  messageDraftRepository: vi.fn(() => ({})),
  auditRepository: vi.fn(() => ({ record: vi.fn(async () => undefined) })),
}));
vi.mock('@/modules/care/server/follow-up-command-repository', () => ({ createFollowUpCommandRepository: mocks.followUpRepository }));
vi.mock('@/modules/care/server/follow-up-message-draft-command-repository', () => ({ createFollowUpMessageDraftCommandRepository: mocks.messageDraftRepository }));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({ createAuditEventRepository: mocks.auditRepository }));

import { runCareFollowUpTransaction } from '@/server/orchestration/care-follow-up-transaction';
import type { TenantDatabase } from '@/server/db/client';

describe('care-follow-up transaction orchestration', () => {
  it('binds task/path, message draft and Audit owners to one transaction database', async () => {
    const transactionDb = { kind: 'care-transaction-db' } as unknown as TenantDatabase;
    const transaction = vi.fn(async (operation: (database: TenantDatabase) => Promise<string>) => operation(transactionDb));
    const result = await runCareFollowUpTransaction({ transaction } as unknown as TenantDatabase, async (deps) => {
      expect(deps.commandService.createPathEnrollmentBundle).toBeTypeOf('function');
      expect(deps.messageDraftCommandService.createDraftWithTimeline).toBeTypeOf('function');
      expect(deps.messageDraftCommandService.updateControlledReachOutMetadata).toBeTypeOf('function');
      expect(deps.auditRepository.record).toBeTypeOf('function');
      return 'committed';
    });
    expect(result).toBe('committed');
    expect(mocks.followUpRepository).toHaveBeenCalledWith(transactionDb);
    expect(mocks.messageDraftRepository).toHaveBeenCalledWith(transactionDb);
    expect(mocks.auditRepository).toHaveBeenCalledWith(transactionDb);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('operation or Audit failure propagates to the transaction rollback boundary', async () => {
    const transaction = vi.fn(async (operation: (database: TenantDatabase) => Promise<unknown>) => operation({} as TenantDatabase));
    await expect(runCareFollowUpTransaction({ transaction } as unknown as TenantDatabase, async () => {
      throw new Error('required_timeline_evidence_failed');
    })).rejects.toThrow('required_timeline_evidence_failed');

    mocks.auditRepository.mockReturnValueOnce({ record: vi.fn(async () => { throw new Error('audit_unavailable'); }) });
    await expect(runCareFollowUpTransaction({ transaction } as unknown as TenantDatabase, async ({ auditRepository }) => {
      await auditRepository.record({} as never);
      return 'unreachable';
    })).rejects.toThrow('audit_unavailable');
  });
});
