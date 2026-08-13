import { createAuditEventRepository, type AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type { VerifiedInstitutionAuditAttributionHandleV1 } from '@/modules/audit/domain/audit-events';
import { createFollowUpMessageDraftCommandService } from '@/modules/care/application/follow-up-message-draft-command-service';
import { createFollowUpMessageDraftCommandRepository } from '@/modules/care/server/follow-up-message-draft-command-repository';
import { createTenantBusinessRepository, type TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { createTrustedReachOutSafetyRepository, type TrustedReachOutSafetyRepository } from '@/modules/institution/server/trusted-reachout-safety-repository';
import { createWeComCustomerMappingRepository, type WeComCustomerMappingRepository } from '@/modules/institution/server/wecom-customer-mapping-repository';
import { createWeComRealSendProofTransactionRepository, type WeComRealSendProofTransactionRepository } from '@/modules/institution/server/wecom-real-send-proof-repository';
import { createWeComReachOutCommandRepository } from '@/modules/messaging/server/wecom-reachout-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import { resolveInstitutionAuditWriterVerifiedAttributionV1 } from '@/server/orchestration/institution-audit-writer-scope';

export type WeComReachOutTransactionDependencies = Readonly<{
  customerRepository: TenantBusinessRepository;
  mappingRepository: WeComCustomerMappingRepository;
  safetyRepository: TrustedReachOutSafetyRepository;
  auditRepository: AuditEventRepository;
  careMessageDraftCommandService: ReturnType<typeof createFollowUpMessageDraftCommandService>;
}>;

type InstitutionBusinessPair = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

type AttributedWeComCustomerRepository = Pick<
  TenantBusinessRepository,
  | 'getCustomerByTenantAndInstitution'
  | 'listCustomersByTenantAndInstitution'
  | 'getFollowUpMessageDraftByTenantAndInstitution'
  | 'listMessageDeliveriesForDraft'
>;

type AttributedWeComCareMessageDraftCommandService = Pick<
  ReturnType<typeof createFollowUpMessageDraftCommandService>,
  'updateControlledReachOutMetadata'
>;

export type AttributedWeComReachOutTransactionDependencies = Readonly<{
  customerRepository: AttributedWeComCustomerRepository;
  mappingRepository: WeComCustomerMappingRepository;
  safetyRepository: TrustedReachOutSafetyRepository;
  auditRepository: Pick<AuditEventRepository, 'recordAttributed'>;
  auditAttribution: VerifiedInstitutionAuditAttributionHandleV1;
  careMessageDraftCommandService: AttributedWeComCareMessageDraftCommandService;
}>;

function assertInstitutionBusinessPair(
  boundPair: InstitutionBusinessPair,
  candidatePair: InstitutionBusinessPair,
): void {
  if (
    candidatePair.tenantId !== boundPair.tenantId ||
    candidatePair.institutionId !== boundPair.institutionId
  ) {
    throw new Error('wecom_reachout_business_pair_mismatch');
  }
}

function bindInstitutionScopedOperation<
  Input extends InstitutionBusinessPair,
  Result,
>(
  boundPair: InstitutionBusinessPair,
  operation: (input: Input) => Result,
): (input: Input) => Result {
  return (input) => {
    assertInstitutionBusinessPair(boundPair, input);
    return operation(input);
  };
}

function bindCustomerRepository(
  repository: TenantBusinessRepository,
  businessPair: InstitutionBusinessPair,
): AttributedWeComCustomerRepository {
  return {
    getCustomerByTenantAndInstitution: bindInstitutionScopedOperation(
      businessPair,
      repository.getCustomerByTenantAndInstitution,
    ),
    listCustomersByTenantAndInstitution: bindInstitutionScopedOperation(
      businessPair,
      repository.listCustomersByTenantAndInstitution,
    ),
    getFollowUpMessageDraftByTenantAndInstitution: bindInstitutionScopedOperation(
      businessPair,
      repository.getFollowUpMessageDraftByTenantAndInstitution,
    ),
    listMessageDeliveriesForDraft: bindInstitutionScopedOperation(
      businessPair,
      repository.listMessageDeliveriesForDraft,
    ),
  };
}

function bindMappingRepository(
  repository: WeComCustomerMappingRepository,
  businessPair: InstitutionBusinessPair,
): WeComCustomerMappingRepository {
  return {
    findByScope: bindInstitutionScopedOperation(businessPair, repository.findByScope),
    findByScopeForUpdate: bindInstitutionScopedOperation(
      businessPair,
      repository.findByScopeForUpdate,
    ),
    createIfAbsent: bindInstitutionScopedOperation(
      businessPair,
      repository.createIfAbsent,
    ),
    updateWhenCurrentStatus: bindInstitutionScopedOperation(
      businessPair,
      repository.updateWhenCurrentStatus,
    ),
  };
}

function bindSafetyRepository(
  repository: TrustedReachOutSafetyRepository,
  businessPair: InstitutionBusinessPair,
): TrustedReachOutSafetyRepository {
  return {
    findConsent: bindInstitutionScopedOperation(businessPair, repository.findConsent),
    findConsentForUpdate: bindInstitutionScopedOperation(
      businessPair,
      repository.findConsentForUpdate,
    ),
    upsertConsent: bindInstitutionScopedOperation(businessPair, repository.upsertConsent),
    findFrequency: bindInstitutionScopedOperation(businessPair, repository.findFrequency),
    createFrequencyIfAbsent: bindInstitutionScopedOperation(
      businessPair,
      repository.createFrequencyIfAbsent,
    ),
    updateFrequencyWhenVersion: bindInstitutionScopedOperation(
      businessPair,
      repository.updateFrequencyWhenVersion,
    ),
    findDryRunSnapshot: bindInstitutionScopedOperation(
      businessPair,
      repository.findDryRunSnapshot,
    ),
    findDryRunSnapshotForUpdate: bindInstitutionScopedOperation(
      businessPair,
      repository.findDryRunSnapshotForUpdate,
    ),
    upsertDryRunSnapshot: bindInstitutionScopedOperation(
      businessPair,
      repository.upsertDryRunSnapshot,
    ),
  };
}

function bindCareMessageDraftCommandService(
  service: ReturnType<typeof createFollowUpMessageDraftCommandService>,
  businessPair: InstitutionBusinessPair,
): AttributedWeComCareMessageDraftCommandService {
  return {
    updateControlledReachOutMetadata(input) {
      assertInstitutionBusinessPair(businessPair, input.attribution);
      return service.updateControlledReachOutMetadata(input);
    },
  };
}

function bindRealSendProofTransactionRepository(
  repository: WeComRealSendProofTransactionRepository,
  businessPair: InstitutionBusinessPair,
): WeComRealSendProofTransactionRepository {
  return {
    auditAttribution: repository.auditAttribution,
    loadReadySource: bindInstitutionScopedOperation(
      businessPair,
      repository.loadReadySource,
    ),
    listControls: bindInstitutionScopedOperation(businessPair, repository.listControls),
    findProductionAttestation: repository.findProductionAttestation,
    findOperationBySource: bindInstitutionScopedOperation(
      businessPair,
      repository.findOperationBySource,
    ),
    findOperationByRef: bindInstitutionScopedOperation(
      businessPair,
      repository.findOperationByRef,
    ),
    createOperation: bindInstitutionScopedOperation(
      businessPair,
      repository.createOperation,
    ),
    consumeConfirmation: bindInstitutionScopedOperation(
      businessPair,
      repository.consumeConfirmation,
    ),
    abortOperation: bindInstitutionScopedOperation(
      businessPair,
      repository.abortOperation,
    ),
    finalizeNonSuccess: bindInstitutionScopedOperation(
      businessPair,
      repository.finalizeNonSuccess,
    ),
    lockOperation: bindInstitutionScopedOperation(businessPair, repository.lockOperation),
    recordCompletedFrequency(input) {
      assertInstitutionBusinessPair(businessPair, input.operation);
      return repository.recordCompletedFrequency(input);
    },
    markSucceeded: bindInstitutionScopedOperation(
      businessPair,
      repository.markSucceeded,
    ),
    recordAudit: repository.recordAudit,
  };
}

function createCanonicalSafetyRepository(database: TenantDatabase): TrustedReachOutSafetyRepository {
  const legacyReads = createTrustedReachOutSafetyRepository(database);
  const canonicalWriter = createWeComReachOutCommandRepository(database);
  return {
    ...legacyReads,
    upsertConsent: canonicalWriter.upsertConsent,
    createFrequencyIfAbsent: canonicalWriter.createFrequencyIfAbsent,
    updateFrequencyWhenVersion: canonicalWriter.updateFrequencyWhenVersion,
    upsertDryRunSnapshot: canonicalWriter.upsertDryRunSnapshot,
  } as TrustedReachOutSafetyRepository;
}

export async function runWeComReachOutTransaction<T>(
  database: TenantDatabase,
  operation: (dependencies: WeComReachOutTransactionDependencies) => Promise<T>,
): Promise<T> {
  return database.transaction(async (transactionDatabase) => {
    const transactionDb = transactionDatabase as unknown as TenantDatabase;
    return operation({
      customerRepository: createTenantBusinessRepository(transactionDb),
      mappingRepository: createWeComCustomerMappingRepository(transactionDb),
      safetyRepository: createCanonicalSafetyRepository(transactionDb),
      auditRepository: createAuditEventRepository(transactionDb),
      careMessageDraftCommandService: createFollowUpMessageDraftCommandService(
        createFollowUpMessageDraftCommandRepository(transactionDb),
      ),
    });
  });
}

export async function runAttributedWeComReachOutTransaction<T>(
  database: TenantDatabase,
  businessPair: InstitutionBusinessPair,
  operation: (dependencies: AttributedWeComReachOutTransactionDependencies) => Promise<T>,
): Promise<T> {
  const auditAttribution = await resolveInstitutionAuditWriterVerifiedAttributionV1(
    businessPair,
  );
  if (!auditAttribution) throw new Error('institution_audit_attribution_unavailable');

  return runWeComReachOutTransaction(
    database,
    async (dependencies) => operation({
      customerRepository: bindCustomerRepository(
        dependencies.customerRepository,
        businessPair,
      ),
      mappingRepository: bindMappingRepository(
        dependencies.mappingRepository,
        businessPair,
      ),
      safetyRepository: bindSafetyRepository(
        dependencies.safetyRepository,
        businessPair,
      ),
      auditRepository: {
        recordAttributed: dependencies.auditRepository.recordAttributed,
      },
      auditAttribution,
      careMessageDraftCommandService: bindCareMessageDraftCommandService(
        dependencies.careMessageDraftCommandService,
        businessPair,
      ),
    }),
  );
}

export async function runWeComRealSendProofTransaction<T>(
  database: TenantDatabase,
  businessPair: InstitutionBusinessPair,
  operation: (repository: WeComRealSendProofTransactionRepository) => Promise<T>,
): Promise<T> {
  const auditAttribution = await resolveInstitutionAuditWriterVerifiedAttributionV1(
    businessPair,
  );
  if (!auditAttribution) throw new Error('institution_audit_attribution_unavailable');

  return database.transaction(async (transactionDatabase) => {
    const transactionDb = transactionDatabase as unknown as TenantDatabase;
    const canonicalWriter = createWeComReachOutCommandRepository(transactionDb);
    const auditRepository = createAuditEventRepository(transactionDb);
    const repository = createWeComRealSendProofTransactionRepository(
      transactionDb,
      canonicalWriter,
      auditRepository,
      auditAttribution,
    );
    return operation(bindRealSendProofTransactionRepository(repository, businessPair));
  });
}
