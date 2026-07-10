import {
  createAuditEventRepository,
  type AuditEventRepository,
} from '@/modules/audit/server/audit-event-repository';
import {
  createTenantBusinessRepository,
  type TenantBusinessRepository,
} from '@/modules/institution/server/tenant-business-repository';
import {
  createWeComCustomerMappingRepository,
  type WeComCustomerMappingRepository,
} from '@/modules/institution/server/wecom-customer-mapping-repository';
import type { TenantDatabase } from '@/server/db/client';

type WeComCustomerMappingTransactionDependencies = {
  customerRepository: TenantBusinessRepository;
  mappingRepository: WeComCustomerMappingRepository;
  auditRepository: AuditEventRepository;
};

export async function runWeComCustomerMappingTransaction<T>(
  database: TenantDatabase,
  operation: (dependencies: WeComCustomerMappingTransactionDependencies) => Promise<T>,
) {
  return database.transaction(async (transactionDatabase) => {
    const transactionDb = transactionDatabase as unknown as TenantDatabase;
    return operation({
      customerRepository: createTenantBusinessRepository(transactionDb),
      mappingRepository: createWeComCustomerMappingRepository(transactionDb),
      auditRepository: createAuditEventRepository(transactionDb),
    });
  });
}
