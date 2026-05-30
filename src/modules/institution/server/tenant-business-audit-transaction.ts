import {
  createAuditEventRepository,
  type AuditEventRepository,
} from '@/modules/audit/server/audit-event-repository';
import {
  createTenantBusinessRepository,
  type TenantBusinessRepository,
} from '@/modules/institution/server/tenant-business-repository';
import type { TenantDatabase } from '@/server/db/client';

type TenantBusinessAuditTransactionDependencies = {
  repository: TenantBusinessRepository;
  auditRepository: AuditEventRepository;
};

export async function runTenantBusinessAuditTransaction<T>(
  database: TenantDatabase,
  operation: (dependencies: TenantBusinessAuditTransactionDependencies) => Promise<T>,
) {
  return database.transaction(async (transactionDatabase) => {
    const transactionTenantDatabase = transactionDatabase as unknown as TenantDatabase;

    return operation({
      repository: createTenantBusinessRepository(transactionTenantDatabase),
      auditRepository: createAuditEventRepository(transactionTenantDatabase),
    });
  });
}
