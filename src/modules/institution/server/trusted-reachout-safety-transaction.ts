
import type {
  AuditEventRepository,
} from '@/modules/audit/server/audit-event-repository';
import type {
  TenantBusinessRepository,
} from '@/modules/institution/server/tenant-business-repository';
import type {
  TrustedReachOutSafetyRepository,
} from '@/modules/institution/server/trusted-reachout-safety-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  runWeComReachOutTransaction,
} from '@/server/orchestration/wecom-reachout-transaction';

type TrustedReachOutSafetyTransactionDependencies = {
  customerRepository: TenantBusinessRepository;
  safetyRepository: TrustedReachOutSafetyRepository;
  auditRepository: AuditEventRepository;
};

export async function runTrustedReachOutSafetyTransaction<T>(
  database: TenantDatabase,
  operation: (
    dependencies: TrustedReachOutSafetyTransactionDependencies,
  ) => Promise<T>,
) {
  return runWeComReachOutTransaction(database, (dependencies) =>
    operation({
      customerRepository: dependencies.customerRepository,
      safetyRepository: dependencies.safetyRepository,
      auditRepository: dependencies.auditRepository,
    }));
}
