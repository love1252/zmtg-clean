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
import {
  createWeComCustomerMappingRepository,
  type WeComCustomerMappingRepository,
} from '@/modules/institution/server/wecom-customer-mapping-repository';
import type { TenantDatabase } from '@/server/db/client';

type WeComControlledReachOutTransactionDependencies = {
  repository: TenantBusinessRepository;
  mappingRepository: WeComCustomerMappingRepository;
  safetyRepository: TrustedReachOutSafetyRepository;
  auditRepository: AuditEventRepository;
};

export async function runWeComControlledReachOutTransaction<T>(
  database: TenantDatabase,
  operation: (dependencies: WeComControlledReachOutTransactionDependencies) => Promise<T>,
) {
  return database.transaction(async (transactionDatabase) => {
    const transactionDb = transactionDatabase as unknown as TenantDatabase;
    return operation({
      repository: createTenantBusinessRepository(transactionDb),
      mappingRepository: createWeComCustomerMappingRepository(transactionDb),
      safetyRepository: createTrustedReachOutSafetyRepository(transactionDb),
      auditRepository: createAuditEventRepository(transactionDb),
    });
  });
}
