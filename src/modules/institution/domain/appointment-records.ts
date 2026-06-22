import type { AccessContext, AccessDecision } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';

export type TenantBusinessDeniedReason = Extract<AccessDecision, { allowed: false }>['reason'];

export type TenantBusinessResult<T> =
  | { allowed: true; records: T[] }
  | { allowed: false; reason: TenantBusinessDeniedReason };

export type AppointmentStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'arrived'
  | 'completed'
  | 'reschedule_requested'
  | 'cancelled';

export type TenantAppointmentRecord = {
  id: string;
  tenantId: string;
  customerId: string;
  customerDisplayName: string;
  project: string;
  scheduledAt: string;
  consultantUserId: string;
  status: AppointmentStatus;
  note: string;
};

export type AppointmentRecordSummary = TenantAppointmentRecord;

export function listAppointmentRecordsForAccess(input: {
  context: AccessContext;
  targetTenantId: string;
  records?: TenantAppointmentRecord[];
}): TenantBusinessResult<AppointmentRecordSummary> {
  const { context, targetTenantId, records = [] } = input;
  const decision = canAccessResource({
    context,
    resource: 'appointment',
    action: 'read_own_tenant',
    targetTenantId,
  });

  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason };
  }

  return {
    allowed: true,
    records: records.filter((record) => record.tenantId === context.tenantId),
  };
}
