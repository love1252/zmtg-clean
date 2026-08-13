import { createAuditEventRepository, type AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type { VerifiedInstitutionAuditAttributionHandleV1 } from '@/modules/audit/domain/audit-events';
import { createFollowUpCommandService } from '@/modules/care/application/follow-up-command-service';
import { createFollowUpMessageDraftCommandService } from '@/modules/care/application/follow-up-message-draft-command-service';
import { createFollowUpCommandRepository } from '@/modules/care/server/follow-up-command-repository';
import { createFollowUpMessageDraftCommandRepository } from '@/modules/care/server/follow-up-message-draft-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import { resolveInstitutionAuditWriterVerifiedAttributionV1 } from '@/server/orchestration/institution-audit-writer-scope';

export type CareFollowUpTransactionDependencies = Readonly<{
  commandService: ReturnType<typeof createFollowUpCommandService>;
  messageDraftCommandService: ReturnType<typeof createFollowUpMessageDraftCommandService>;
  auditRepository: AuditEventRepository;
}>;
export type CareFollowUpTransactionOperation<T> = (dependencies: CareFollowUpTransactionDependencies) => Promise<T>;
export type AttributedCareFollowUpTransactionDependencies =
  CareFollowUpTransactionDependencies & Readonly<{
    auditAttribution: VerifiedInstitutionAuditAttributionHandleV1;
  }>;

export async function runCareFollowUpTransaction<T>(
  database: TenantDatabase,
  operation: CareFollowUpTransactionOperation<T>,
): Promise<T> {
  return database.transaction(async (transactionDatabase) => {
    const transactionDb = transactionDatabase as unknown as TenantDatabase;
    return operation({
      commandService: createFollowUpCommandService(createFollowUpCommandRepository(transactionDb)),
      messageDraftCommandService: createFollowUpMessageDraftCommandService(
        createFollowUpMessageDraftCommandRepository(transactionDb),
      ),
      auditRepository: createAuditEventRepository(transactionDb),
    });
  });
}

export async function runAttributedCareFollowUpTransaction<T>(
  database: TenantDatabase,
  businessPair: Readonly<{ tenantId: string; institutionId: string }>,
  operation: (dependencies: AttributedCareFollowUpTransactionDependencies) => Promise<T>,
): Promise<T> {
  const auditAttribution = await resolveInstitutionAuditWriterVerifiedAttributionV1(
    businessPair,
  );
  if (!auditAttribution) throw new Error('institution_audit_attribution_unavailable');

  return database.transaction(async (transactionDatabase) => {
    const transactionDb = transactionDatabase as unknown as TenantDatabase;
    return operation({
      commandService: createFollowUpCommandService(createFollowUpCommandRepository(transactionDb)),
      messageDraftCommandService: createFollowUpMessageDraftCommandService(
        createFollowUpMessageDraftCommandRepository(transactionDb),
      ),
      auditRepository: createAuditEventRepository(transactionDb),
      auditAttribution,
    });
  });
}
