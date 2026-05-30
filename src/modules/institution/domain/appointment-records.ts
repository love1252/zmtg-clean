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

export const demoTenantAppointmentRecords: TenantAppointmentRecord[] = [
  {
    id: 'appt_liu_precheck',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_liu_arrival',
    customerDisplayName: '刘女士',
    project: '水光补水',
    scheduledAt: '2026-06-01T10:30:00+08:00',
    consultantUserId: 'consultant-xu',
    status: 'pending_confirmation',
    note: '待同步术前注意事项',
  },
  {
    id: 'appt_qin_arrived',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_qin_review',
    customerDisplayName: '秦女士',
    project: '玻尿酸复诊',
    scheduledAt: '2026-05-30T11:20:00+08:00',
    consultantUserId: 'frontdesk-a',
    status: 'arrived',
    note: '等待治疗记录回填',
  },
  {
    id: 'appt_tang_reschedule',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_tang_thermage',
    customerDisplayName: '唐女士',
    project: '热玛吉面诊',
    scheduledAt: '2026-05-30T16:00:00+08:00',
    consultantUserId: 'consultant-lin',
    status: 'reschedule_requested',
    note: '需协调专家下周档期',
  },
  {
    id: 'appt_other_tenant',
    tenantId: 'demo-tenant-002',
    customerId: 'cust_other_tenant',
    customerDisplayName: '周女士',
    project: '皮肤检测',
    scheduledAt: '2026-06-02T14:00:00+08:00',
    consultantUserId: 'consultant-other',
    status: 'confirmed',
    note: '跨租户演示记录',
  },
];

export function listAppointmentRecordsForAccess(input: {
  context: AccessContext;
  targetTenantId: string;
  records?: TenantAppointmentRecord[];
}): TenantBusinessResult<AppointmentRecordSummary> {
  const { context, targetTenantId, records = demoTenantAppointmentRecords } = input;
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
