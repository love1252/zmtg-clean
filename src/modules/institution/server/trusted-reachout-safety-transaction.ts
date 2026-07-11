import {
  createAuditEventRepository,
  type AuditEventRepository,
} from '@/modules/audit/server/audit-event-repository';
import {
  createTenantBusinessRepository,
  type TenantBusinessRepository,
} from '@/modules/institution/server/tenant-business-repository';
import {
  createTrustedReachOutSafetyRepository,
  type TrustedReachOutSafetyRepository,
} from '@/modules/institution/server/trusted-reachout-safety-repository';
import type { TenantDatabase } from '@/server/db/client';

type TrustedReachOutSafetyTransactionDependencies = {
  customerRepository: TenantBusinessRepository;
  safetyRepository: TrustedReachOutSafetyRepository;
  auditRepository: AuditEventRepository;
};

export async function runTrustedReachOutSafetyTransaction<T>(
  database: TenantDatabase,
  operation: (dependencies: TrustedReachOutSafetyTransactionDependencies) => Promise<T>,
) {
  return database.transaction(async (transactionDatabase) => {
    const transactionDb = transactionDatabase as unknown as TenantDatabase;
    return operation({
      customerRepository: createTenantBusinessRepository(transactionDb),
      safetyRepository: createTrustedReachOutSafetyRepository(transactionDb),
      auditRepository: createAuditEventRepository(transactionDb),
    });
  });
}
