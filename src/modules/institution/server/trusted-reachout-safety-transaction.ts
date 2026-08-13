
import type {
  AuditEventRepository,
} from '@/modules/audit/server/audit-event-repository';
import type { VerifiedInstitutionAuditAttributionHandleV1 } from '@/modules/audit/domain/audit-events';
import type {
  TenantBusinessRepository,
} from '@/modules/institution/server/tenant-business-repository';
import type {
  TrustedReachOutSafetyRepository,
} from '@/modules/institution/server/trusted-reachout-safety-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  runAttributedWeComReachOutTransaction,
} from '@/server/orchestration/wecom-reachout-transaction';

type TrustedReachOutSafetyTransactionDependencies = {
  customerRepository: Pick<TenantBusinessRepository, 'getCustomerByTenantAndInstitution'>;
  safetyRepository: TrustedReachOutSafetyRepository;
  auditRepository: Pick<AuditEventRepository, 'recordAttributed'>;
  auditAttribution: VerifiedInstitutionAuditAttributionHandleV1;
};

export async function runTrustedReachOutSafetyTransaction<T>(
  database: TenantDatabase,
  businessPair: Readonly<{ tenantId: string; institutionId: string }>,
  operation: (
    dependencies: TrustedReachOutSafetyTransactionDependencies,
  ) => Promise<T>,
) {
  return runAttributedWeComReachOutTransaction(database, businessPair, (dependencies) =>
    operation({
      customerRepository: dependencies.customerRepository,
      safetyRepository: dependencies.safetyRepository,
      auditRepository: dependencies.auditRepository,
      auditAttribution: dependencies.auditAttribution,
    }));
}
