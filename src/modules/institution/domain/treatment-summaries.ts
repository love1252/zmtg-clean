import type { FollowUpRiskLevel } from '@/modules/institution/domain/followup-workflow';

export type TreatmentSummaryRecord = {
  id: string;
  tenantId: string;
  customerId: string;
  appointmentId: string | null;
  treatmentDate: string;
  treatmentProject: string;
  treatmentCategory: string;
  treatmentStage: string;
  recoveryStage: string;
  riskLevel: FollowUpRiskLevel;
  ownerUserId: string;
  summary: string;
  nextCareAction: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CustomerTimelineTreatmentSummary = Omit<
  TreatmentSummaryRecord,
  'tenantId' | 'customerId'
>;

export const demoTenantTreatmentSummaryRecords: TreatmentSummaryRecord[] = [
  {
    id: 'trt_qin_d7_review',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_qin_review',
    appointmentId: 'appt_qin_arrived',
    treatmentDate: '2026-05-30T12:10:00+08:00',
    treatmentProject: '玻尿酸复诊',
    treatmentCategory: 'injection_review',
    treatmentStage: 'D7 复诊',
    recoveryStage: 'D7',
    riskLevel: 'watch',
    ownerUserId: 'doctor-lin',
    summary: '结构化摘要：恢复进展稳定，安排补水护理观察。',
    nextCareAction: 'D14 人工回访恢复阶段。',
    tags: ['结构化摘要', '复诊'],
    createdAt: '2026-05-30T12:10:00+08:00',
    updatedAt: '2026-05-30T12:10:00+08:00',
  },
  {
    id: 'trt_wang_repair_window',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_wang_repurchase',
    appointmentId: null,
    treatmentDate: '2026-05-29T16:30:00+08:00',
    treatmentProject: '热玛吉修复组合',
    treatmentCategory: 'skin_repair',
    treatmentStage: 'D28 复购评估',
    recoveryStage: 'D28',
    riskLevel: 'urgent',
    ownerUserId: 'consultant-lin',
    summary: '结构化摘要：恢复窗口进入复购建议期，适合人工承接。',
    nextCareAction: '安排顾问跟进修复组合意向。',
    tags: ['结构化摘要', '复购窗口'],
    createdAt: '2026-05-29T16:30:00+08:00',
    updatedAt: '2026-05-29T16:30:00+08:00',
  },
  {
    id: 'trt_other_tenant_demo',
    tenantId: 'demo-tenant-002',
    customerId: 'cust_other_tenant',
    appointmentId: 'appt_other_tenant',
    treatmentDate: '2026-06-02T14:40:00+08:00',
    treatmentProject: '皮肤检测',
    treatmentCategory: 'skin_check',
    treatmentStage: '初次检测',
    recoveryStage: '稳定',
    riskLevel: 'normal',
    ownerUserId: 'consultant-other',
    summary: '结构化摘要：跨租户演示摘要，仅用于隔离测试。',
    nextCareAction: '保持当前租户内可见。',
    tags: ['结构化摘要', '隔离演示'],
    createdAt: '2026-06-02T14:40:00+08:00',
    updatedAt: '2026-06-02T14:40:00+08:00',
  },
];

export function mapTreatmentSummaryRecordToTimelineDto(
  record: TreatmentSummaryRecord,
): CustomerTimelineTreatmentSummary {
  return {
    id: record.id,
    appointmentId: record.appointmentId,
    treatmentDate: record.treatmentDate,
    treatmentProject: record.treatmentProject,
    treatmentCategory: record.treatmentCategory,
    treatmentStage: record.treatmentStage,
    recoveryStage: record.recoveryStage,
    riskLevel: record.riskLevel,
    ownerUserId: record.ownerUserId,
    summary: record.summary,
    nextCareAction: record.nextCareAction,
    tags: [...record.tags],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
