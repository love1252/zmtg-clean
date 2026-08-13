import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type { VerifiedInstitutionAuditAttributionHandleV1 } from '@/modules/audit/domain/audit-events';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import type { TrustedReachOutSafetyRepository } from '@/modules/institution/server/trusted-reachout-safety-repository';
import type { WeComCustomerMappingRepository } from '@/modules/institution/server/wecom-customer-mapping-repository';
import type { WeComControlledReachOutCareDraftPort } from '@/modules/institution/server/wecom-controlled-reachout-service';
import type { TenantDatabase } from '@/server/db/client';
import { runAttributedWeComReachOutTransaction } from '@/server/orchestration/wecom-reachout-transaction';

type WeComControlledReachOutTransactionDependencies = {
  repository: TenantBusinessRepository;
  mappingRepository: WeComCustomerMappingRepository;
  safetyRepository: TrustedReachOutSafetyRepository;
  auditRepository: AuditEventRepository;
  auditAttribution: VerifiedInstitutionAuditAttributionHandleV1;
  careMessageDraftCommandService: WeComControlledReachOutCareDraftPort;
};

export async function runWeComControlledReachOutTransaction<T>(
  database: TenantDatabase,
  businessPair: Readonly<{ tenantId: string; institutionId: string }>,
  operation: (dependencies: WeComControlledReachOutTransactionDependencies) => Promise<T>,
) {
  return runAttributedWeComReachOutTransaction(database, businessPair, (dependencies) => operation({
    repository: dependencies.customerRepository,
    mappingRepository: dependencies.mappingRepository,
    safetyRepository: dependencies.safetyRepository,
    auditRepository: dependencies.auditRepository,
    auditAttribution: dependencies.auditAttribution,
    careMessageDraftCommandService: dependencies.careMessageDraftCommandService,
  }));
}
