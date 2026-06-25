import type { TenantDatabase } from '@/server/db/client';
import { appointments, customers, followUpTasks, treatmentSummaries } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import type { CustomerLifecycleStage, CustomerPriority } from '@/modules/institution/domain/customer-records';
import type { FollowUpStatus, FollowUpRiskLevel } from '@/modules/institution/domain/followup-workflow';

type ProvisionDemoDataInput = {
  db: TenantDatabase;
  tenantId: string;
  userId: string;
};

type CustomerSeed = {
  id: string;
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

type FollowUpSeed = {
  id: string;
  customerId: string;
  customerDisplayName: string;
  journeyId: string;
  stage: string;
  status: FollowUpStatus;
  dueAt: string;
  suggestedAction: string;
  riskLevel: FollowUpRiskLevel;
  sourceSuggestionKey: string;
  sourceTreatmentSummaryId: string;
};

type TreatmentSummarySeed = {
  id: string;
  customerId: string;
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
  sourceSuggestionKey: string;
};

type AppointmentSeed = {
  id: string;
  customerId: string;
  customerDisplayName: string;
  project: string;
  scheduledAt: string;
  consultantUserId: string;
  status: string;
  note: string;
};

const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

function isoDate(d: Date) {
  return d.toISOString();
}

function buildCustomerSeeds(tenantId: string, userId: string): CustomerSeed[] {
  const c1 = `provision-customer-${tenantId}-01`;
  const c2 = `provision-customer-${tenantId}-02`;
  const c3 = `provision-customer-${tenantId}-03`;
  const c4 = `provision-customer-${tenantId}-04`;
  const c5 = `provision-customer-${tenantId}-05`;

  return [
    {
      id: c1,
      displayName: '体验客户·陈女士',
      lifecycle: 'post_care',
      priority: 'high',
      ownerUserId: userId,
      projectInterest: '光子嫩肤·术后维养',
      maskedPhone: '138****6789',
      maskedMedicalRecordNo: 'MR-demo-****-001',
      lastTouchSummary: '三天前完成光子嫩肤治疗，术后恢复良好，建议一周后复诊评估',
      nextAction: '安排术后一周复诊，评估皮肤恢复状态并推荐维养方案',
      tags: ['光子嫩肤', '术后关怀', '高价值'],
    },
    {
      id: c2,
      displayName: '体验客户·李女士',
      lifecycle: 'repurchase_window',
      priority: 'high',
      ownerUserId: userId,
      projectInterest: '热玛吉·面部提升',
      maskedPhone: '139****8901',
      maskedMedicalRecordNo: 'MR-demo-****-002',
      lastTouchSummary: '两周前咨询热玛吉项目，对价格敏感，处于决策阶段',
      nextAction: '跟进热玛吉意向，提供限时体验价促进转化',
      tags: ['热玛吉', '意向客户', '价格敏感'],
    },
    {
      id: c3,
      displayName: '体验客户·张女士',
      lifecycle: 'silent_reactivation',
      priority: 'medium',
      ownerUserId: userId,
      projectInterest: '水光针·定期维养',
      maskedPhone: '137****3456',
      maskedMedicalRecordNo: 'MR-demo-****-003',
      lastTouchSummary: '两个月前完成水光针疗程后未再到院，属于沉睡客户',
      nextAction: '通过关怀消息唤醒，推荐季节维养优惠套餐',
      tags: ['水光针', '沉睡客户', '需唤醒'],
    },
    {
      id: c4,
      displayName: '体验客户·王女士',
      lifecycle: 'consulting',
      priority: 'observe',
      ownerUserId: userId,
      projectInterest: '眼部年轻化综合方案',
      maskedPhone: '136****0123',
      maskedMedicalRecordNo: 'MR-demo-****-004',
      lastTouchSummary: '初次到院咨询眼部年轻化方案，对眼周射频和填充均有兴趣',
      nextAction: '发送眼部年轻化方案对比资料，预约二次面诊',
      tags: ['眼部年轻化', '新客', '方案对比'],
    },
    {
      id: c5,
      displayName: '体验客户·赵女士',
      lifecycle: 'post_care',
      priority: 'medium',
      ownerUserId: userId,
      projectInterest: '玻尿酸填充·鼻唇沟',
      maskedPhone: '135****4567',
      maskedMedicalRecordNo: 'MR-demo-****-005',
      lastTouchSummary: '上周完成玻尿酸鼻唇沟填充，术后轻微肿胀已消退，效果满意',
      nextAction: '安排填充两周后回访，评估吸收情况和是否需要补打',
      tags: ['玻尿酸', '术后关怀', '填充'],
    },
  ];
}

function buildTreatmentSummarySeeds(
  tenantId: string,
  userId: string,
  customerSeeds: CustomerSeed[],
): TreatmentSummarySeed[] {
  const [c1, c2, c5] = customerSeeds;

  return [
    {
      id: `provision-ts-${tenantId}-01`,
      customerId: c1.id,
      treatmentDate: isoDate(threeDaysAgo),
      treatmentProject: '光子嫩肤 IPL',
      treatmentCategory: '光电治疗',
      treatmentStage: '术后恢复期',
      recoveryStage: '红肿消退',
      riskLevel: 'normal',
      ownerUserId: userId,
      summary: '光子嫩肤全脸治疗完成，能量参数适中，术后即刻冷敷，红肿轻微。建议一周后复诊评估效果。',
      nextCareAction: '一周后复诊评估皮肤状态，如效果良好可推荐维养套餐',
      tags: ['光子嫩肤', '光电', '术后'],
      sourceSuggestionKey: 'post_ipl_followup',
    },
    {
      id: `provision-ts-${tenantId}-02`,
      customerId: c2.id,
      treatmentDate: isoDate(lastWeek),
      treatmentProject: '面部评估咨询',
      treatmentCategory: '咨询面诊',
      treatmentStage: '方案沟通',
      recoveryStage: '无',
      riskLevel: 'normal',
      ownerUserId: userId,
      summary: '客户咨询热玛吉项目，皮肤评估显示轻度松弛，适合热玛吉治疗。客户对价格较为关注。',
      nextCareAction: '制作个性化热玛吉方案和价格方案，提供体验价促进决策',
      tags: ['咨询', '热玛吉', '面诊'],
      sourceSuggestionKey: 'thermage_consult_followup',
    },
    {
      id: `provision-ts-${tenantId}-03`,
      customerId: c5.id,
      treatmentDate: isoDate(yesterday),
      treatmentProject: '玻尿酸鼻唇沟填充',
      treatmentCategory: '注射填充',
      treatmentStage: '术后观察',
      recoveryStage: '肿胀消退',
      riskLevel: 'watch',
      ownerUserId: userId,
      summary: '玻尿酸鼻唇沟填充完成，注射量适中，术后冰敷处理。轻微肿胀预期2-3天消退。',
      nextCareAction: '两天后电话回访确认肿胀消退情况，两周后安排效果评估',
      tags: ['玻尿酸', '注射', '填充', '术后观察'],
      sourceSuggestionKey: 'post_filler_followup',
    },
  ];
}

function buildFollowUpSeeds(
  tenantId: string,
  customerSeeds: CustomerSeed[],
  treatmentSummarySeeds: TreatmentSummarySeed[],
): FollowUpSeed[] {
  const [c1, , c3, , c5] = customerSeeds;
  const [ts1, ts2, ts3] = treatmentSummarySeeds;

  return [
    {
      id: `provision-fu-${tenantId}-01`,
      customerId: c1.id,
      customerDisplayName: c1.displayName,
      journeyId: 'post_treatment_care',
      stage: '术后回访',
      status: 'due',
      dueAt: isoDate(tomorrow),
      suggestedAction: '联系陈女士确认光子嫩肤术后恢复情况，安排一周复诊',
      riskLevel: 'normal',
      sourceTreatmentSummaryId: ts1.id,
      sourceSuggestionKey: ts1.sourceSuggestionKey,
    },
    {
      id: `provision-fu-${tenantId}-02`,
      customerId: c5.id,
      customerDisplayName: c5.displayName,
      journeyId: 'post_treatment_care',
      stage: '术后观察',
      status: 'scheduled',
      dueAt: isoDate(nextWeek),
      suggestedAction: '两周后评估玻尿酸填充效果，确认是否需要补打或调整',
      riskLevel: 'watch',
      sourceTreatmentSummaryId: ts3.id,
      sourceSuggestionKey: ts3.sourceSuggestionKey,
    },
    {
      id: `provision-fu-${tenantId}-03`,
      customerId: c3.id,
      customerDisplayName: c3.displayName,
      journeyId: 'dormant_reactivation',
      stage: '沉睡唤醒',
      status: 'due',
      dueAt: isoDate(tomorrow),
      suggestedAction: '发送季节关怀消息给张女士，推荐水光针维养优惠套餐，尝试重新激活',
      riskLevel: 'watch',
      sourceTreatmentSummaryId: ts1.id,
      sourceSuggestionKey: 'dormant_reactivation_care',
    },
  ];
}

function buildAppointmentSeeds(tenantId: string, customerSeeds: CustomerSeed[]): AppointmentSeed[] {
  const [c1, c2, c4] = customerSeeds;

  return [
    {
      id: `provision-apt-${tenantId}-01`,
      customerId: c1.id,
      customerDisplayName: c1.displayName,
      project: '光子嫩肤术后复诊',
      scheduledAt: isoDate(tomorrow),
      consultantUserId: 'demo-consultant',
      status: 'confirmed',
      note: '术后一周复诊，评估皮肤恢复效果',
    },
    {
      id: `provision-apt-${tenantId}-02`,
      customerId: c2.id,
      customerDisplayName: c2.displayName,
      project: '热玛吉项目二次面诊',
      scheduledAt: isoDate(nextWeek),
      consultantUserId: 'demo-consultant',
      status: 'pending_confirmation',
      note: '客户需确认时间，需提前发送方案资料',
    },
    {
      id: `provision-apt-${tenantId}-03`,
      customerId: c4.id,
      customerDisplayName: c4.displayName,
      project: '眼部年轻化方案面诊',
      scheduledAt: isoDate(tomorrow),
      consultantUserId: 'demo-consultant',
      status: 'pending_confirmation',
      note: '初次面诊，需准备眼部年轻化方案对比资料',
    },
  ];
}

export async function provisionDemoDataForTenant(
  input: ProvisionDemoDataInput,
): Promise<{ provisioned: boolean; customerCount: number; followUpCount: number }> {
  const { db, tenantId, userId } = input;

  const existingCustomers = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.tenantId, tenantId))
    .limit(1);

  if (existingCustomers.length > 0) {
    return { provisioned: false, customerCount: 0, followUpCount: 0 };
  }

  const customerSeeds = buildCustomerSeeds(tenantId, userId);
  const treatmentSummarySeeds = buildTreatmentSummarySeeds(tenantId, userId, customerSeeds);
  const followUpSeeds = buildFollowUpSeeds(tenantId, customerSeeds, treatmentSummarySeeds);
  const appointmentSeeds = buildAppointmentSeeds(tenantId, customerSeeds);

  const nowISO = isoDate(now);

  await db.transaction(async (tx) => {
    for (const seed of customerSeeds) {
      await tx.insert(customers).values({
        id: seed.id,
        tenantId,
        displayName: seed.displayName,
        lifecycle: seed.lifecycle,
        priority: seed.priority,
        ownerUserId: seed.ownerUserId,
        projectInterest: seed.projectInterest,
        maskedPhone: seed.maskedPhone,
        maskedMedicalRecordNo: seed.maskedMedicalRecordNo,
        lastTouchSummary: seed.lastTouchSummary,
        nextAction: seed.nextAction,
        tags: seed.tags,
      });
    }

    for (const seed of treatmentSummarySeeds) {
      await tx.insert(treatmentSummaries).values({
        id: seed.id,
        tenantId,
        customerId: seed.customerId,
        treatmentDate: new Date(seed.treatmentDate),
        treatmentProject: seed.treatmentProject,
        treatmentCategory: seed.treatmentCategory,
        treatmentStage: seed.treatmentStage,
        recoveryStage: seed.recoveryStage,
        riskLevel: seed.riskLevel,
        ownerUserId: seed.ownerUserId,
        summary: seed.summary,
        nextCareAction: seed.nextCareAction,
        tags: seed.tags,
      });
    }

    for (const seed of followUpSeeds) {
      await tx.insert(followUpTasks).values({
        id: seed.id,
        tenantId,
        customerId: seed.customerId,
        customerDisplayName: seed.customerDisplayName,
        journeyId: seed.journeyId,
        stage: seed.stage,
        status: seed.status,
        dueAt: new Date(seed.dueAt),
        suggestedAction: seed.suggestedAction,
        riskLevel: seed.riskLevel,
        sourceSuggestionKey: seed.sourceSuggestionKey,
        sourceTreatmentSummaryId: seed.sourceTreatmentSummaryId,
        updatedBy: null,
        updatedAt: null,
      });
    }

    for (const seed of appointmentSeeds) {
      await tx.insert(appointments).values({
        id: seed.id,
        tenantId,
        customerId: seed.customerId,
        customerDisplayName: seed.customerDisplayName,
        project: seed.project,
        scheduledAt: new Date(seed.scheduledAt),
        consultantUserId: seed.consultantUserId,
        status: seed.status as 'pending_confirmation' | 'confirmed' | 'arrived' | 'completed' | 'reschedule_requested' | 'cancelled',
        note: seed.note,
      });
    }
  });

  return {
    provisioned: true,
    customerCount: customerSeeds.length,
    followUpCount: followUpSeeds.length,
  };
}
