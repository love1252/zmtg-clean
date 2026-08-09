import { createKnowledgeItemCommandService } from '@/modules/knowledge/application/institution/knowledge-item-command-service';
import { createInstitutionKnowledgeCommandRepository } from '@/modules/knowledge/server/institution-knowledge-command-repository';
import type { TenantDatabase } from '@/server/db/client';
export type KnowledgeInstitutionTransactionDependencies=Readonly<{commandService:ReturnType<typeof createKnowledgeItemCommandService>}>;
export type KnowledgeInstitutionTransactionOperation<T>=(dependencies:KnowledgeInstitutionTransactionDependencies)=>Promise<T>;
export async function runKnowledgeInstitutionTransaction<T>(database:TenantDatabase,operation:KnowledgeInstitutionTransactionOperation<T>):Promise<T>{ return database.transaction(async(transactionDatabase)=>{ const transactionDb=transactionDatabase as unknown as TenantDatabase; return operation({commandService:createKnowledgeItemCommandService(createInstitutionKnowledgeCommandRepository(transactionDb))}); }); }
