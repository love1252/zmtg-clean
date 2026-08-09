import { createAuditEventRepository, type AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createFollowUpCommandService } from '@/modules/care/application/follow-up-command-service';
import { createFollowUpMessageDraftCommandService } from '@/modules/care/application/follow-up-message-draft-command-service';
import { createFollowUpCommandRepository } from '@/modules/care/server/follow-up-command-repository';
import { createFollowUpMessageDraftCommandRepository } from '@/modules/care/server/follow-up-message-draft-command-repository';
import type { TenantDatabase } from '@/server/db/client';

export type CareFollowUpTransactionDependencies = Readonly<{
  commandService: ReturnType<typeof createFollowUpCommandService>;
  messageDraftCommandService: ReturnType<typeof createFollowUpMessageDraftCommandService>;
  auditRepository: AuditEventRepository;
}>;
export type CareFollowUpTransactionOperation<T> = (dependencies: CareFollowUpTransactionDependencies) => Promise<T>;

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
