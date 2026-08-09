import type { TenantDatabase } from '@/server/db/client';
import { runCareFollowUpTransaction, type CareFollowUpTransactionOperation } from '@/server/orchestration/care-follow-up-transaction';
export type InstitutionCareFollowUpTransactionOperation<T>=CareFollowUpTransactionOperation<T>;
export function runInstitutionCareFollowUpTransaction<T>(database:TenantDatabase,operation:InstitutionCareFollowUpTransactionOperation<T>){
  return runCareFollowUpTransaction(database,operation);
}
