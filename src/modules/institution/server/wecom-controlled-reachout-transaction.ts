
import type {
  AuditEventRepository,
} from '@/modules/audit/server/audit-event-repository';
import type {
  TenantBusinessRepository,
} from '@/modules/institution/server/tenant-business-repository';
import type {
  TrustedReachOutSafetyRepository,
} from '@/modules/institution/server/trusted-reachout-safety-repository';
import type {
  WeComCustomerMappingRepository,
} from '@/modules/institution/server/wecom-customer-mapping-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  runWeComReachOutTransaction,
} from '@/server/orchestration/wecom-reachout-transaction';

type WeComControlledReachOutTransactionDependencies = {
  repository: TenantBusinessRepository;
  mappingRepository: WeComCustomerMappingRepository;
  safetyRepository: TrustedReachOutSafetyRepository;
  auditRepository: AuditEventRepository;
};

export async function runWeComControlledReachOutTransaction<T>(
  database: TenantDatabase,
  operation: (
    dependencies: WeComControlledReachOutTransactionDependencies,
  ) => Promise<T>,
) {
  return runWeComReachOutTransaction(database, (dependencies) =>
    operation({
      repository: dependencies.customerRepository,
      mappingRepository: dependencies.mappingRepository,
      safetyRepository: dependencies.safetyRepository,
      auditRepository: dependencies.auditRepository,
    }));
}
