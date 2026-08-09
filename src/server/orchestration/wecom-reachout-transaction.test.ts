import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAuditRepository: vi.fn(), createCustomerRepository: vi.fn(), createMappingRepository: vi.fn(),
  createSafetyRepository: vi.fn(), createCanonicalWriter: vi.fn(), createRealSendTransactionRepository: vi.fn(),
  createCareDraftRepository: vi.fn(),
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({ createAuditEventRepository: mocks.createAuditRepository }));
vi.mock('@/modules/institution/server/tenant-business-repository', () => ({ createTenantBusinessRepository: mocks.createCustomerRepository }));
vi.mock('@/modules/institution/server/wecom-customer-mapping-repository', () => ({ createWeComCustomerMappingRepository: mocks.createMappingRepository }));
vi.mock('@/modules/institution/server/trusted-reachout-safety-repository', () => ({ createTrustedReachOutSafetyRepository: mocks.createSafetyRepository }));
vi.mock('@/modules/messaging/server/wecom-reachout-command-repository', () => ({ createWeComReachOutCommandRepository: mocks.createCanonicalWriter }));
vi.mock('@/modules/institution/server/wecom-real-send-proof-repository', () => ({ createWeComRealSendProofTransactionRepository: mocks.createRealSendTransactionRepository }));
vi.mock('@/modules/care/server/follow-up-message-draft-command-repository', () => ({ createFollowUpMessageDraftCommandRepository: mocks.createCareDraftRepository }));

import { runWeComReachOutTransaction, runWeComRealSendProofTransaction } from '@/server/orchestration/wecom-reachout-transaction';

describe('wecom reachout orchestration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Messaging frequency, Care draft CAS and Audit bind to the same transaction database', async () => {
    const transactionDatabase = { kind: 'transaction-db' };
    const database = { transaction: vi.fn(async (operation) => operation(transactionDatabase)) };
    const legacySafety = {
      findConsent: vi.fn(), findConsentForUpdate: vi.fn(), findFrequency: vi.fn(), findDryRunSnapshot: vi.fn(),
      findDryRunSnapshotForUpdate: vi.fn(), upsertConsent: vi.fn(), createFrequencyIfAbsent: vi.fn(),
      updateFrequencyWhenVersion: vi.fn(), upsertDryRunSnapshot: vi.fn(),
    };
    const canonicalWriter = {
      upsertConsent: vi.fn(), createFrequencyIfAbsent: vi.fn(), updateFrequencyWhenVersion: vi.fn(), upsertDryRunSnapshot: vi.fn(),
    };
    mocks.createCustomerRepository.mockReturnValue({ kind: 'customer' });
    mocks.createMappingRepository.mockReturnValue({ kind: 'mapping' });
    mocks.createAuditRepository.mockReturnValue({ kind: 'audit' });
    mocks.createSafetyRepository.mockReturnValue(legacySafety);
    mocks.createCanonicalWriter.mockReturnValue(canonicalWriter);
    mocks.createCareDraftRepository.mockReturnValue({});

    const deps = await runWeComReachOutTransaction(database as never, async (input) => input);
    expect(mocks.createCustomerRepository).toHaveBeenCalledWith(transactionDatabase);
    expect(mocks.createMappingRepository).toHaveBeenCalledWith(transactionDatabase);
    expect(mocks.createSafetyRepository).toHaveBeenCalledWith(transactionDatabase);
    expect(mocks.createCanonicalWriter).toHaveBeenCalledWith(transactionDatabase);
    expect(mocks.createAuditRepository).toHaveBeenCalledWith(transactionDatabase);
    expect(mocks.createCareDraftRepository).toHaveBeenCalledWith(transactionDatabase);
    expect(deps.careMessageDraftCommandService.updateControlledReachOutMetadata).toBeTypeOf('function');

    await deps.safetyRepository.upsertConsent({} as never);
    await deps.safetyRepository.createFrequencyIfAbsent({} as never);
    expect(canonicalWriter.upsertConsent).toHaveBeenCalledOnce();
    expect(canonicalWriter.createFrequencyIfAbsent).toHaveBeenCalledOnce();
    expect(legacySafety.upsertConsent).not.toHaveBeenCalled();
    expect(legacySafety.createFrequencyIfAbsent).not.toHaveBeenCalled();
  });

  it('cross-owner callback failure is not swallowed', async () => {
    const database = { transaction: vi.fn(async (operation) => operation({ kind: 'transaction-db' })) };
    mocks.createCustomerRepository.mockReturnValue({}); mocks.createMappingRepository.mockReturnValue({});
    mocks.createSafetyRepository.mockReturnValue({}); mocks.createCanonicalWriter.mockReturnValue({});
    mocks.createAuditRepository.mockReturnValue({}); mocks.createCareDraftRepository.mockReturnValue({});
    await expect(runWeComReachOutTransaction(database as never, async () => { throw new Error('rollback-required'); }))
      .rejects.toThrow('rollback-required');
  });

  it('real-send proof composition remains unchanged and transaction-bound', async () => {
    const transactionDatabase = { kind: 'real-send-transaction-db' };
    const database = { transaction: vi.fn(async (operation) => operation(transactionDatabase)) };
    const canonicalWriter = { kind: 'canonical-writer' };
    const auditRepository = { kind: 'audit-repository' };
    const realSendRepository = { kind: 'real-send-transaction-repository' };
    mocks.createCanonicalWriter.mockReturnValue(canonicalWriter);
    mocks.createAuditRepository.mockReturnValue(auditRepository);
    mocks.createRealSendTransactionRepository.mockReturnValue(realSendRepository);
    const result = await runWeComRealSendProofTransaction(database as never, async (repository) => repository);
    expect(mocks.createRealSendTransactionRepository).toHaveBeenCalledWith(transactionDatabase, canonicalWriter, auditRepository);
    expect(result).toBe(realSendRepository);
  });
});
