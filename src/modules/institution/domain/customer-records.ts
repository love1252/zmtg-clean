import type { AccessContext, AccessDecision } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';

export type TenantBusinessDeniedReason = Extract<AccessDecision, { allowed: false }>['reason'];

export type TenantBusinessResult<T> =
  | { allowed: true; records: T[] }
  | { allowed: false; reason: TenantBusinessDeniedReason };

export type CustomerLifecycleStage =
  | 'consulting'
  | 'scheduled'
  | 'post_care'
  | 'repurchase_window'
  | 'silent_reactivation';

export type CustomerPriority = 'high' | 'medium' | 'observe';

export type TenantCustomerRecord = {
  id: string;
  tenantId: string;
  displayName: string;
  lifecycle: CustomerLifecycleStage;
  priority: CustomerPriority;
  ownerUserId: string;
  projectInterest: string;
  maskedPhone: string;
  maskedMedicalRecordNo: string;
  lastTouchSummary: string;
  nextAction: string;
  tags: string[];
};

export type CustomerRecordSummary = {
  id: string;
  tenantId: string;
  displayName: string;
  lifecycle: CustomerLifecycleStage;
  priority: CustomerPriority;
  ownerUserId: string;
  projectInterest: string;
  maskedPhone: string;
  maskedMedicalRecordNo: string;
  lastTouchSummary: string;
  nextAction: string;
  tags: string[];
};

function toCustomerSummary(record: TenantCustomerRecord): CustomerRecordSummary {
  return {
    id: record.id,
    tenantId: record.tenantId,
    displayName: record.displayName,
    lifecycle: record.lifecycle,
    priority: record.priority,
    ownerUserId: record.ownerUserId,
    projectInterest: record.projectInterest,
    maskedPhone: record.maskedPhone,
    maskedMedicalRecordNo: record.maskedMedicalRecordNo,
    lastTouchSummary: record.lastTouchSummary,
    nextAction: record.nextAction,
    tags: record.tags,
  };
}

export function listCustomerRecordsForAccess(input: {
  context: AccessContext;
  targetTenantId: string;
  records?: TenantCustomerRecord[];
}): TenantBusinessResult<CustomerRecordSummary> {
  const { context, targetTenantId, records = [] } = input;
  const decision = canAccessResource({
    context,
    resource: 'customer',
    action: 'read_own_tenant',
    targetTenantId,
  });

  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason };
  }

  return {
    allowed: true,
    records: records
      .filter((record) => record.tenantId === context.tenantId)
      .map(toCustomerSummary),
  };
}
