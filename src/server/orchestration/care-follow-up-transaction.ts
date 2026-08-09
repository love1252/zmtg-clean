import { createFollowUpCommandService } from '@/modules/care/application/follow-up-command-service';
import { createFollowUpCommandRepository } from '@/modules/care/server/follow-up-command-repository';
import type { TenantDatabase } from '@/server/db/client';
export type CareFollowUpTransactionDependencies=Readonly<{commandService:ReturnType<typeof createFollowUpCommandService>}>;
export type CareFollowUpTransactionOperation<T>=(dependencies:CareFollowUpTransactionDependencies)=>Promise<T>;
export async function runCareFollowUpTransaction<T>(database:TenantDatabase,operation:CareFollowUpTransactionOperation<T>):Promise<T>{
  return database.transaction(async transactionDatabase=>{
    const transactionDb=transactionDatabase as unknown as TenantDatabase;
    return operation({commandService:createFollowUpCommandService(createFollowUpCommandRepository(transactionDb))});
  });
}
