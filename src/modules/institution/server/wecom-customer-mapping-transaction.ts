import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type { VerifiedInstitutionAuditAttributionHandleV1 } from '@/modules/audit/domain/audit-events';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import type { WeComCustomerMappingRepository } from '@/modules/institution/server/wecom-customer-mapping-repository';
import type { TenantDatabase } from '@/server/db/client';
import { runAttributedWeComReachOutTransaction } from '@/server/orchestration/wecom-reachout-transaction';

type WeComCustomerMappingTransactionDependencies = {
  customerRepository: Pick<
    TenantBusinessRepository,
    'getCustomerByTenantAndInstitution' | 'listCustomersByTenantAndInstitution'
  >;
  mappingRepository: WeComCustomerMappingRepository;
  auditRepository: Pick<AuditEventRepository, 'recordAttributed'>;
  auditAttribution: VerifiedInstitutionAuditAttributionHandleV1;
};

export async function runWeComCustomerMappingTransaction<T>(
  database: TenantDatabase,
  businessPair: Readonly<{ tenantId: string; institutionId: string }>,
  operation: (dependencies: WeComCustomerMappingTransactionDependencies) => Promise<T>,
) {
  return runAttributedWeComReachOutTransaction(database, businessPair, (dependencies) => operation({
    customerRepository: dependencies.customerRepository,
    mappingRepository: dependencies.mappingRepository,
    auditRepository: dependencies.auditRepository,
    auditAttribution: dependencies.auditAttribution,
  }));
}
