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

export const demoTenantCustomerRecords: TenantCustomerRecord[] = [
  {
    id: 'cust_wang_repurchase',
    tenantId: 'demo-tenant-001',
    displayName: '王女士',
    lifecycle: 'repurchase_window',
    priority: 'high',
    ownerUserId: 'consultant-lin',
    projectInterest: '热玛吉修复组合',
    maskedPhone: '138****1208',
    maskedMedicalRecordNo: 'MR****001',
    lastTouchSummary: '术后第 28 天',
    nextAction: '安排资深咨询师人工回访',
    tags: ['高价值', '近期咨询补水', '适合人工承接'],
  },
  {
    id: 'cust_chen_conversion',
    tenantId: 'demo-tenant-001',
    displayName: '陈女士',
    lifecycle: 'consulting',
    priority: 'high',
    ownerUserId: 'consultant-zhou',
    projectInterest: '玻尿酸联合方案',
    maskedPhone: '139****2609',
    maskedMedicalRecordNo: 'MR****002',
    lastTouchSummary: '浏览案例页 3 次',
    nextAction: '发送案例对比与价格解释',
    tags: ['预算明确', '价格异议', '需跟进'],
  },
  {
    id: 'cust_zhao_care',
    tenantId: 'demo-tenant-001',
    displayName: '赵女士',
    lifecycle: 'post_care',
    priority: 'high',
    ownerUserId: 'service-group-a',
    projectInterest: '光电修复',
    maskedPhone: '137****8842',
    maskedMedicalRecordNo: 'MR****003',
    lastTouchSummary: 'D3 红肿反馈',
    nextAction: '转人工回访并记录恢复情况',
    tags: ['敏感反馈', '需安抚', '术后 D3'],
  },
  {
    id: 'cust_other_tenant',
    tenantId: 'demo-tenant-002',
    displayName: '周女士',
    lifecycle: 'scheduled',
    priority: 'medium',
    ownerUserId: 'consultant-other',
    projectInterest: '皮肤检测',
    maskedPhone: '136****7711',
    maskedMedicalRecordNo: 'MR****101',
    lastTouchSummary: '明日到院',
    nextAction: '同步到院提醒',
    tags: ['跨租户演示记录'],
  },
];

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
  const { context, targetTenantId, records = demoTenantCustomerRecords } = input;
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
