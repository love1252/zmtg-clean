import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAuditRepository: vi.fn(), createCustomerRepository: vi.fn(), createMappingRepository: vi.fn(),
  createSafetyRepository: vi.fn(), createCanonicalWriter: vi.fn(), createRealSendTransactionRepository: vi.fn(),
  createCareDraftRepository: vi.fn(),
  resolveVerifiedAttribution: vi.fn(),
  verifiedAttribution: {},
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({ createAuditEventRepository: mocks.createAuditRepository }));
vi.mock('@/modules/institution/server/tenant-business-repository', () => ({ createTenantBusinessRepository: mocks.createCustomerRepository }));
vi.mock('@/modules/institution/server/wecom-customer-mapping-repository', () => ({ createWeComCustomerMappingRepository: mocks.createMappingRepository }));
vi.mock('@/modules/institution/server/trusted-reachout-safety-repository', () => ({ createTrustedReachOutSafetyRepository: mocks.createSafetyRepository }));
vi.mock('@/modules/messaging/server/wecom-reachout-command-repository', () => ({ createWeComReachOutCommandRepository: mocks.createCanonicalWriter }));
vi.mock('@/modules/institution/server/wecom-real-send-proof-repository', () => ({ createWeComRealSendProofTransactionRepository: mocks.createRealSendTransactionRepository }));
vi.mock('@/modules/care/server/follow-up-message-draft-command-repository', () => ({ createFollowUpMessageDraftCommandRepository: mocks.createCareDraftRepository }));
vi.mock('@/server/orchestration/institution-audit-writer-scope', () => ({
  resolveInstitutionAuditWriterVerifiedAttributionV1: mocks.resolveVerifiedAttribution,
}));

import {
  runAttributedWeComReachOutTransaction,
  runWeComRealSendProofTransaction,
  type AttributedWeComReachOutTransactionDependencies,
} from '@/server/orchestration/wecom-reachout-transaction';
import { recordWeComReachOutConsent } from '@/modules/institution/server/trusted-reachout-safety-service';
import { writeWeComCustomerMapping } from '@/modules/institution/server/wecom-customer-mapping-service';
import { evaluateAndPersistWeComDryRunSnapshot } from '@/modules/institution/server/wecom-dry-run-snapshot-service';
import { prepareWeComControlledReachOut } from '@/modules/institution/server/wecom-controlled-reachout-service';

const businessPair = { tenantId: 'tenant-a', institutionId: 'inst-a' } as const;
const driftPair = { tenantId: 'tenant-a', institutionId: 'inst-b' } as const;
const driftContext = {
  userId: 'admin-a', role: 'tenant_admin', scope: 'tenant', source: 'demo_session',
  ...driftPair,
} as const;

function createTransactionSetup() {
  const transactionDatabase = { kind: 'transaction-db' };
  let rollbackCount = 0;
  const database = {
    transaction: vi.fn(async (operation) => {
      try {
        return await operation(transactionDatabase);
      } catch (error) {
        rollbackCount += 1;
        throw error;
      }
    }),
  };
  const customerRepository = {
    getCustomerByTenantAndInstitution: vi.fn(),
    listCustomersByTenantAndInstitution: vi.fn(),
    getFollowUpMessageDraftByTenantAndInstitution: vi.fn(),
    listMessageDeliveriesForDraft: vi.fn(),
    createCustomer: vi.fn(),
  };
  const mappingRepository = {
    findByScope: vi.fn(),
    findByScopeForUpdate: vi.fn(),
    createIfAbsent: vi.fn(),
    updateWhenCurrentStatus: vi.fn(),
  };
  const legacySafety = {
    findConsent: vi.fn(), findConsentForUpdate: vi.fn(), findFrequency: vi.fn(), findDryRunSnapshot: vi.fn(),
    findDryRunSnapshotForUpdate: vi.fn(), upsertConsent: vi.fn(), createFrequencyIfAbsent: vi.fn(),
    updateFrequencyWhenVersion: vi.fn(), upsertDryRunSnapshot: vi.fn(),
  };
  const canonicalWriter = {
    upsertConsent: vi.fn(), createFrequencyIfAbsent: vi.fn(), updateFrequencyWhenVersion: vi.fn(),
    upsertDryRunSnapshot: vi.fn(),
  };
  const auditRepository = { record: vi.fn(), recordAttributed: vi.fn() };
  const careDraftRepository = { updateControlledReachOutMetadata: vi.fn() };

  mocks.createCustomerRepository.mockReturnValue(customerRepository);
  mocks.createMappingRepository.mockReturnValue(mappingRepository);
  mocks.createAuditRepository.mockReturnValue(auditRepository);
  mocks.createSafetyRepository.mockReturnValue(legacySafety);
  mocks.createCanonicalWriter.mockReturnValue(canonicalWriter);
  mocks.createCareDraftRepository.mockReturnValue(careDraftRepository);

  return {
    database,
    transactionDatabase,
    customerRepository,
    mappingRepository,
    legacySafety,
    canonicalWriter,
    auditRepository,
    careDraftRepository,
    getRollbackCount: () => rollbackCount,
  };
}

type DriftServiceCase = Readonly<{
  label: string;
  operation: (
    dependencies: AttributedWeComReachOutTransactionDependencies,
  ) => Promise<unknown>;
}>;

const driftServiceCases: DriftServiceCase[] = [
  {
    label: 'recordWeComReachOutConsent',
    operation: (dependencies) => recordWeComReachOutConsent({
      context: driftContext,
      scope: { ...driftPair, customerId: 'customer-a' },
      action: 'record_consent',
      sourceType: 'customer_explicit_written',
      confirmation: '我确认客户已明确同意通过企业微信联系',
      occurredAt: '2026-08-13T00:00:00.000Z',
      createId: () => 'generated-id',
      repositories: {
        customerRepository: dependencies.customerRepository,
        safetyRepository: dependencies.safetyRepository,
        auditRepository: dependencies.auditRepository,
        auditAttribution: dependencies.auditAttribution,
      },
    }),
  },
  {
    label: 'writeWeComCustomerMapping',
    operation: (dependencies) => writeWeComCustomerMapping({
      context: driftContext,
      ...driftPair,
      action: 'confirm',
      customerId: 'customer-a',
      occurredAt: '2026-08-13T00:00:00.000Z',
      createId: () => 'generated-id',
      repositories: {
        customerRepository: dependencies.customerRepository,
        mappingRepository: dependencies.mappingRepository,
        auditRepository: dependencies.auditRepository,
        auditAttribution: dependencies.auditAttribution,
      },
    }),
  },
  {
    label: 'evaluateAndPersistWeComDryRunSnapshot',
    operation: (dependencies) => evaluateAndPersistWeComDryRunSnapshot({
      context: driftContext,
      ...driftPair,
      officialRoute: 'official_wecom_self_built',
      proofInstitutionRef: 'proof-inst-b',
      callbackPlaceholderRef: 'callback-placeholder',
      hasTestWeComEnvironment: true,
      hasSecretKeeperConfirmed: true,
      confirmation: '我确认仅保存低敏 dry-run 评估快照且不启用真实发送',
      occurredAt: '2026-08-13T00:00:00.000Z',
      createId: () => 'generated-id',
      repositories: {
        safetyRepository: dependencies.safetyRepository,
        auditRepository: dependencies.auditRepository,
        auditAttribution: dependencies.auditAttribution,
      },
    }),
  },
  {
    label: 'prepareWeComControlledReachOut',
    operation: (dependencies) => prepareWeComControlledReachOut({
      context: driftContext,
      draftId: 'draft-a',
      repository: dependencies.customerRepository,
      mappingRepository: dependencies.mappingRepository,
      safetyRepository: dependencies.safetyRepository,
      auditRepository: dependencies.auditRepository,
      auditAttribution: dependencies.auditAttribution,
      careMessageDraftCommandService: dependencies.careMessageDraftCommandService,
      occurredAt: '2026-08-13T00:00:00.000Z',
      createId: () => 'generated-id',
    }),
  },
];

type BoundWriteCase = readonly [
  string,
  (
    dependencies: AttributedWeComReachOutTransactionDependencies,
  ) => Promise<unknown>,
];

const boundWriteCases: BoundWriteCase[] = [
  ['Safety consent', (dependencies) =>
    dependencies.safetyRepository.upsertConsent({ ...driftPair } as never)],
  ['Safety frequency create', (dependencies) =>
    dependencies.safetyRepository.createFrequencyIfAbsent({ ...driftPair } as never)],
  ['Safety frequency update', (dependencies) =>
    dependencies.safetyRepository.updateFrequencyWhenVersion({ ...driftPair } as never)],
  ['Safety dry-run', (dependencies) =>
    dependencies.safetyRepository.upsertDryRunSnapshot({ ...driftPair } as never)],
  ['Mapping create', (dependencies) =>
    dependencies.mappingRepository.createIfAbsent({ ...driftPair } as never)],
  ['Mapping update', (dependencies) =>
    dependencies.mappingRepository.updateWhenCurrentStatus({ ...driftPair } as never)],
  ['Care metadata', (dependencies) =>
    dependencies.careMessageDraftCommandService.updateControlledReachOutMetadata({
      attribution: driftPair,
    } as never)],
];

describe('wecom reachout orchestration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Messaging frequency、Care draft CAS 与 Audit 绑定到同一事务和 business pair', async () => {
    const setup = createTransactionSetup();
    mocks.resolveVerifiedAttribution.mockResolvedValueOnce(mocks.verifiedAttribution);

    const dependencies = await runAttributedWeComReachOutTransaction(
      setup.database as never,
      businessPair,
      async (input) => input,
    );

    expect(mocks.createCustomerRepository).toHaveBeenCalledWith(setup.transactionDatabase);
    expect(mocks.createMappingRepository).toHaveBeenCalledWith(setup.transactionDatabase);
    expect(mocks.createSafetyRepository).toHaveBeenCalledWith(setup.transactionDatabase);
    expect(mocks.createCanonicalWriter).toHaveBeenCalledWith(setup.transactionDatabase);
    expect(mocks.createAuditRepository).toHaveBeenCalledWith(setup.transactionDatabase);
    expect(mocks.createCareDraftRepository).toHaveBeenCalledWith(setup.transactionDatabase);
    expect(dependencies.careMessageDraftCommandService.updateControlledReachOutMetadata).toBeTypeOf('function');
    expect(dependencies.auditAttribution).toBe(mocks.verifiedAttribution);
    expect(Object.keys(dependencies.customerRepository).sort()).toEqual([
      'getCustomerByTenantAndInstitution',
      'getFollowUpMessageDraftByTenantAndInstitution',
      'listCustomersByTenantAndInstitution',
      'listMessageDeliveriesForDraft',
    ]);
    expect(Object.keys(dependencies.auditRepository)).toEqual(['recordAttributed']);
    expect(mocks.resolveVerifiedAttribution).toHaveBeenCalledOnce();

    await dependencies.safetyRepository.upsertConsent({ ...businessPair } as never);
    await dependencies.safetyRepository.createFrequencyIfAbsent({ ...businessPair } as never);
    expect(setup.canonicalWriter.upsertConsent).toHaveBeenCalledOnce();
    expect(setup.canonicalWriter.createFrequencyIfAbsent).toHaveBeenCalledOnce();
    expect(setup.legacySafety.upsertConsent).not.toHaveBeenCalled();
    expect(setup.legacySafety.createFrequencyIfAbsent).not.toHaveBeenCalled();
  });

  it.each(driftServiceCases)(
    '$label 在 callback 尝试 tenant-a/inst-b 时零业务写、零 Audit 写并回滚',
    async ({ operation }) => {
      const setup = createTransactionSetup();
      mocks.resolveVerifiedAttribution.mockResolvedValueOnce(mocks.verifiedAttribution);

      await expect(runAttributedWeComReachOutTransaction(
        setup.database as never,
        businessPair,
        operation,
      )).rejects.toThrow('wecom_reachout_business_pair_mismatch');

      expect(mocks.resolveVerifiedAttribution).toHaveBeenCalledOnce();
      expect(setup.database.transaction).toHaveBeenCalledOnce();
      expect(setup.getRollbackCount()).toBe(1);
      expect(setup.customerRepository.getCustomerByTenantAndInstitution).not.toHaveBeenCalled();
      expect(setup.mappingRepository.createIfAbsent).not.toHaveBeenCalled();
      expect(setup.mappingRepository.updateWhenCurrentStatus).not.toHaveBeenCalled();
      expect(setup.canonicalWriter.upsertConsent).not.toHaveBeenCalled();
      expect(setup.canonicalWriter.createFrequencyIfAbsent).not.toHaveBeenCalled();
      expect(setup.canonicalWriter.updateFrequencyWhenVersion).not.toHaveBeenCalled();
      expect(setup.canonicalWriter.upsertDryRunSnapshot).not.toHaveBeenCalled();
      expect(setup.careDraftRepository.updateControlledReachOutMetadata).not.toHaveBeenCalled();
      expect(setup.auditRepository.recordAttributed).not.toHaveBeenCalled();
    },
  );

  it.each(boundWriteCases)(
    '%s 写 capability 拒绝跨机构 pair，且不触达底层 writer',
    async (_label, operation) => {
      const setup = createTransactionSetup();
      mocks.resolveVerifiedAttribution.mockResolvedValueOnce(mocks.verifiedAttribution);

      await expect(runAttributedWeComReachOutTransaction(
        setup.database as never,
        businessPair,
        operation,
      )).rejects.toThrow('wecom_reachout_business_pair_mismatch');

      expect(setup.getRollbackCount()).toBe(1);
      expect(setup.mappingRepository.createIfAbsent).not.toHaveBeenCalled();
      expect(setup.mappingRepository.updateWhenCurrentStatus).not.toHaveBeenCalled();
      expect(setup.canonicalWriter.upsertConsent).not.toHaveBeenCalled();
      expect(setup.canonicalWriter.createFrequencyIfAbsent).not.toHaveBeenCalled();
      expect(setup.canonicalWriter.updateFrequencyWhenVersion).not.toHaveBeenCalled();
      expect(setup.canonicalWriter.upsertDryRunSnapshot).not.toHaveBeenCalled();
      expect(setup.careDraftRepository.updateControlledReachOutMetadata).not.toHaveBeenCalled();
      expect(setup.auditRepository.recordAttributed).not.toHaveBeenCalled();
    },
  );

  it('cross-owner callback failure is not swallowed', async () => {
    const setup = createTransactionSetup();
    mocks.resolveVerifiedAttribution.mockResolvedValueOnce(mocks.verifiedAttribution);
    await expect(runAttributedWeComReachOutTransaction(
      setup.database as never,
      businessPair,
      async () => { throw new Error('rollback-required'); },
    ))
      .rejects.toThrow('rollback-required');
    expect(setup.getRollbackCount()).toBe(1);
  });

  it('real-send proof repository 同样绑定到 business pair 且保持单事务', async () => {
    const transactionDatabase = { kind: 'real-send-transaction-db' };
    const database = { transaction: vi.fn(async (operation) => operation(transactionDatabase)) };
    const canonicalWriter = { kind: 'canonical-writer' };
    const auditRepository = { recordAttributed: vi.fn() };
    const realSendRepository = {
      auditAttribution: mocks.verifiedAttribution,
      loadReadySource: vi.fn(), listControls: vi.fn(), findProductionAttestation: vi.fn(),
      findOperationBySource: vi.fn(), findOperationByRef: vi.fn(), createOperation: vi.fn(),
      consumeConfirmation: vi.fn(), abortOperation: vi.fn(), finalizeNonSuccess: vi.fn(),
      lockOperation: vi.fn(), recordCompletedFrequency: vi.fn(), markSucceeded: vi.fn(),
      recordAudit: vi.fn(),
    };
    mocks.createCanonicalWriter.mockReturnValue(canonicalWriter);
    mocks.createAuditRepository.mockReturnValue(auditRepository);
    mocks.createRealSendTransactionRepository.mockReturnValue(realSendRepository);
    mocks.resolveVerifiedAttribution.mockResolvedValueOnce(mocks.verifiedAttribution);

    const result = await runWeComRealSendProofTransaction(
      database as never,
      businessPair,
      async (repository) => repository,
    );

    expect(mocks.createRealSendTransactionRepository).toHaveBeenCalledWith(
      transactionDatabase,
      canonicalWriter,
      auditRepository,
      mocks.verifiedAttribution,
    );
    expect(result).not.toBe(realSendRepository);
    expect(result.auditAttribution).toBe(mocks.verifiedAttribution);
    await result.createOperation({ ...businessPair } as never);
    expect(realSendRepository.createOperation).toHaveBeenCalledOnce();
    expect(() => result.createOperation({ ...driftPair } as never))
      .toThrow('wecom_reachout_business_pair_mismatch');
    expect(realSendRepository.createOperation).toHaveBeenCalledOnce();
  });
});
