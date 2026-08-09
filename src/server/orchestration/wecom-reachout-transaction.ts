import { createAuditEventRepository, type AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createFollowUpMessageDraftCommandService } from '@/modules/care/application/follow-up-message-draft-command-service';
import { createFollowUpMessageDraftCommandRepository } from '@/modules/care/server/follow-up-message-draft-command-repository';
import { createTenantBusinessRepository, type TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { createTrustedReachOutSafetyRepository, type TrustedReachOutSafetyRepository } from '@/modules/institution/server/trusted-reachout-safety-repository';
import { createWeComCustomerMappingRepository, type WeComCustomerMappingRepository } from '@/modules/institution/server/wecom-customer-mapping-repository';
import { createWeComRealSendProofTransactionRepository, type WeComRealSendProofTransactionRepository } from '@/modules/institution/server/wecom-real-send-proof-repository';
import { createWeComReachOutCommandRepository } from '@/modules/messaging/server/wecom-reachout-command-repository';
import type { TenantDatabase } from '@/server/db/client';

export type WeComReachOutTransactionDependencies = Readonly<{
  customerRepository: TenantBusinessRepository;
  mappingRepository: WeComCustomerMappingRepository;
  safetyRepository: TrustedReachOutSafetyRepository;
  auditRepository: AuditEventRepository;
  careMessageDraftCommandService: ReturnType<typeof createFollowUpMessageDraftCommandService>;
}>;

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

export async function runWeComRealSendProofTransaction<T>(
  database: TenantDatabase,
  operation: (repository: WeComRealSendProofTransactionRepository) => Promise<T>,
): Promise<T> {
  return database.transaction(async (transactionDatabase) => {
    const transactionDb = transactionDatabase as unknown as TenantDatabase;
    const canonicalWriter = createWeComReachOutCommandRepository(transactionDb);
    const auditRepository = createAuditEventRepository(transactionDb);
    const repository = createWeComRealSendProofTransactionRepository(transactionDb, canonicalWriter, auditRepository);
    return operation(repository);
  });
}
