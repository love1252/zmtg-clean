import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sql } from 'drizzle-orm';
import { createDatabase, createPostgresClient, type TenantDatabase } from '@/server/db/client';
import {
  appointments,
  auditEvents,
  customers,
  followUpTasks,
  tenantMembers,
  tenantPlanAssignments,
  tenantPlans,
  tenantQuotaSnapshots,
  tenants,
  treatmentSummaries,
} from '@/server/db/schema';

const demoTenantId = 'demo-tenant-001';
const secondaryTenantId = 'demo-tenant-002';
const suspendedTenantId = 'demo-tenant-003';
const demoSeedStartedAt = new Date('2026-06-01T09:00:00+08:00');
const demoSeedSnapshotAt = new Date('2026-06-02T09:00:00+08:00');

export const demoSeedProductionGuardMessage =
  'demo seed 仅用于 local/demo 环境；生产环境如需运行必须显式设置 ZMTG_ENABLE_DEMO_SEED=true';

type DemoCustomerReference = {
  source: 'appointment' | 'follow_up_task' | 'treatment_summary';
  recordId: string;
  tenantId: string;
  customerId: string;
};

type DemoTreatmentAppointmentReference = {
  source: 'treatment_summary';
  recordId: string;
  tenantId: string;
  appointmentId: string;
};

type DemoFollowUpSourceReference = {
  source: 'follow_up_task';
  recordId: string;
  tenantId: string;
  sourceTreatmentSummaryId: string;
};

const demoTenantRecords: Array<typeof tenants.$inferInsert> = [
  {
    id: demoTenantId,
    name: '星澜医美中心',
    status: 'active',
  },
  {
    id: secondaryTenantId,
    name: '青禾皮肤管理',
    status: 'active',
  },
  {
    id: suspendedTenantId,
    name: '远山医美连锁',
    status: 'suspended',
  },
];

const demoTenantPlanRecords: Array<typeof tenantPlans.$inferInsert> = [
  {
    id: 'plan-starter-care',
    name: 'Starter Plan',
    code: 'starter-care',
    description: '适合起步机构的基础运营演示套餐。',
    status: 'active',
  },
  {
    id: 'plan-growth-care',
    name: 'Growth Plan',
    code: 'growth-care',
    description: '适合增长期机构演示治疗后运营闭环、配额管控和多角色协作。',
    status: 'active',
  },
  {
    id: 'plan-enterprise-care',
    name: 'Enterprise Plan',
    code: 'enterprise-care',
    description: '适合连锁机构演示多租户治理和更高配额。',
    status: 'active',
  },
];

const demoTenantPlanAssignmentRecords: Array<typeof tenantPlanAssignments.$inferInsert> = [
  {
    id: 'assign-demo-tenant-001-growth',
    tenantId: demoTenantId,
    planId: 'plan-growth-care',
    status: 'active',
    startedAt: demoSeedStartedAt,
    expiresAt: null,
  },
  {
    id: 'assign-demo-tenant-002-starter',
    tenantId: secondaryTenantId,
    planId: 'plan-starter-care',
    status: 'active',
    startedAt: demoSeedStartedAt,
    expiresAt: null,
  },
  {
    id: 'assign-demo-tenant-003-enterprise-expired',
    tenantId: suspendedTenantId,
    planId: 'plan-enterprise-care',
    status: 'expired',
    startedAt: new Date('2026-01-01T09:00:00+08:00'),
    expiresAt: new Date('2026-05-31T23:59:59+08:00'),
  },
];

const demoTenantQuotaSnapshotRecords: Array<typeof tenantQuotaSnapshots.$inferInsert> = [
  {
    id: 'quota-demo-tenant-001-current',
    tenantId: demoTenantId,
    planAssignmentId: 'assign-demo-tenant-001-growth',
    maxCustomers: 500,
    maxAppointments: 800,
    maxFollowUps: 1200,
    maxAiCalls: 0,
    currentCustomers: 386,
    currentAppointments: 612,
    currentFollowUps: 930,
    currentAiCalls: 0,
    snapshotAt: demoSeedSnapshotAt,
  },
  {
    id: 'quota-demo-tenant-002-current',
    tenantId: secondaryTenantId,
    planAssignmentId: 'assign-demo-tenant-002-starter',
    maxCustomers: 120,
    maxAppointments: 160,
    maxFollowUps: 300,
    maxAiCalls: 0,
    currentCustomers: 92,
    currentAppointments: 121,
    currentFollowUps: 188,
    currentAiCalls: 0,
    snapshotAt: demoSeedSnapshotAt,
  },
  {
    id: 'quota-demo-tenant-003-current',
    tenantId: suspendedTenantId,
    planAssignmentId: 'assign-demo-tenant-003-enterprise-expired',
    maxCustomers: 5000,
    maxAppointments: 6000,
    maxFollowUps: 10000,
    maxAiCalls: 0,
    currentCustomers: 1800,
    currentAppointments: 3200,
    currentFollowUps: 4100,
    currentAiCalls: 0,
    snapshotAt: demoSeedSnapshotAt,
  },
];

const demoTenantMemberRecords: Array<typeof tenantMembers.$inferInsert> = [
  {
    id: 'member-demo-admin',
    tenantId: demoTenantId,
    userId: 'demo-user-admin',
    role: 'tenant_admin',
    displayName: '林院长',
  },
  {
    id: 'member-demo-ops',
    tenantId: demoTenantId,
    userId: 'demo-user-ops',
    role: 'tenant_operator',
    displayName: '周运营',
  },
  {
    id: 'member-demo-consultant',
    tenantId: demoTenantId,
    userId: 'demo-user-consultant',
    role: 'consultant',
    displayName: '许咨询',
  },
  {
    id: 'member-demo-service',
    tenantId: demoTenantId,
    userId: 'demo-user-service',
    role: 'customer_service',
    displayName: '赵客服',
  },
  {
    id: 'member-demo-assistant',
    tenantId: demoTenantId,
    userId: 'demo-user-assistant',
    role: 'tenant_operator',
    displayName: '陈医助',
  },
];

const demoCustomerSeedRecords: Array<typeof customers.$inferInsert> = [
  {
    id: 'demo-customer-shen-zhixia',
    tenantId: demoTenantId,
    displayName: '沈知夏',
    lifecycle: 'post_care',
    priority: 'high',
    ownerUserId: 'demo-user-service',
    projectInterest: '光子术后修复',
    maskedPhone: '138****1201',
    maskedMedicalRecordNo: 'MR****1201',
    lastTouchSummary: '光子术后 D1，已完成护理说明。',
    nextAction: '确认泛红恢复并创建随访任务',
    tags: ['主线客户A', '光子术后', '可生成建议'],
  },
  {
    id: 'demo-customer-xu-ruoning',
    tenantId: demoTenantId,
    displayName: '许若宁',
    lifecycle: 'scheduled',
    priority: 'medium',
    ownerUserId: 'demo-user-consultant',
    projectInterest: '水光复诊',
    maskedPhone: '139****1202',
    maskedMedicalRecordNo: 'MR****1202',
    lastTouchSummary: '水光后预约复诊，等待到院确认。',
    nextAction: '复诊前一天人工提醒',
    tags: ['水光复诊', '预约确认'],
  },
  {
    id: 'demo-customer-gu-anran',
    tenantId: demoTenantId,
    displayName: '顾安然',
    lifecycle: 'post_care',
    priority: 'high',
    ownerUserId: 'demo-user-assistant',
    projectInterest: '术后重点关怀',
    maskedPhone: '137****1203',
    maskedMedicalRecordNo: 'MR****1203',
    lastTouchSummary: '术后重点关怀客户，恢复风险需人工关注。',
    nextAction: '今日完成重点回访',
    tags: ['重点关怀', '高风险'],
  },
  {
    id: 'demo-customer-liang-siyu',
    tenantId: demoTenantId,
    displayName: '梁思语',
    lifecycle: 'consulting',
    priority: 'medium',
    ownerUserId: 'demo-user-consultant',
    projectInterest: '面诊预约',
    maskedPhone: '136****1204',
    maskedMedicalRecordNo: 'MR****1204',
    lastTouchSummary: '已预约未到院，等待确认。',
    nextAction: '确认到院时间',
    tags: ['已预约未到院', '面诊'],
  },
  {
    id: 'demo-customer-lu-qinghe',
    tenantId: demoTenantId,
    displayName: '陆清禾',
    lifecycle: 'silent_reactivation',
    priority: 'observe',
    ownerUserId: 'demo-user-ops',
    projectInterest: '皮肤管理复购',
    maskedPhone: '135****1205',
    maskedMedicalRecordNo: 'MR****1205',
    lastTouchSummary: '三个月未消费，适合演示沉睡客户。',
    nextAction: '纳入人工唤醒名单',
    tags: ['沉睡客户', '机会识别'],
  },
  {
    id: 'demo-customer-cheng-wanqing',
    tenantId: demoTenantId,
    displayName: '程晚晴',
    lifecycle: 'repurchase_window',
    priority: 'high',
    ownerUserId: 'demo-user-ops',
    projectInterest: '高价值复购',
    maskedPhone: '134****1206',
    maskedMedicalRecordNo: 'MR****1206',
    lastTouchSummary: '近期多项目咨询，具备复购窗口。',
    nextAction: '安排顾问跟进组合护理',
    tags: ['高价值', '复购窗口'],
  },
  {
    id: 'demo-customer-ye-shuyan',
    tenantId: demoTenantId,
    displayName: '叶舒颜',
    lifecycle: 'post_care',
    priority: 'medium',
    ownerUserId: 'demo-user-admin',
    projectInterest: '射频修复',
    maskedPhone: '133****1207',
    maskedMedicalRecordNo: 'MR****1207',
    lastTouchSummary: '治疗摘要已作废，用于演示治理闭环。',
    nextAction: '仅保留历史追溯，不再基于该摘要创建来源任务',
    tags: ['主线客户B', '摘要作废', '阻断演示'],
  },
  {
    id: 'demo-customer-tang-yimo',
    tenantId: demoTenantId,
    displayName: '唐以沫',
    lifecycle: 'post_care',
    priority: 'medium',
    ownerUserId: 'demo-user-service',
    projectInterest: '水光术后复查',
    maskedPhone: '132****1208',
    maskedMedicalRecordNo: 'MR****1208',
    lastTouchSummary: '已创建来源随访任务，用于演示重复创建提示。',
    nextAction: '查看来源任务并避免重复创建',
    tags: ['来源治理', '已建任务'],
  },
  {
    id: 'demo-customer-other-tenant',
    tenantId: secondaryTenantId,
    displayName: '周若仪',
    lifecycle: 'consulting',
    priority: 'observe',
    ownerUserId: 'demo-user-other',
    projectInterest: '皮肤检测',
    maskedPhone: '131****2201',
    maskedMedicalRecordNo: 'MR****2201',
    lastTouchSummary: '跨租户隔离演示客户。',
    nextAction: '不应出现在星澜机构端列表',
    tags: ['跨租户隔离'],
  },
];

const demoAppointmentSeedRecords: Array<typeof appointments.$inferInsert> = [
  {
    id: 'demo-appt-shen-treatment',
    tenantId: demoTenantId,
    customerId: 'demo-customer-shen-zhixia',
    customerDisplayName: '沈知夏',
    project: '光子嫩肤治疗',
    scheduledAt: new Date('2026-06-01T10:00:00+08:00'),
    consultantUserId: 'demo-user-consultant',
    status: 'completed',
    note: '主线客户 A 的治疗预约，用于串起摘要和随访任务。',
  },
  {
    id: 'demo-appt-xu-revisit',
    tenantId: demoTenantId,
    customerId: 'demo-customer-xu-ruoning',
    customerDisplayName: '许若宁',
    project: '水光复诊',
    scheduledAt: new Date('2026-06-03T14:30:00+08:00'),
    consultantUserId: 'demo-user-consultant',
    status: 'confirmed',
    note: '复诊预约，用于预约中心演示。',
  },
  {
    id: 'demo-appt-liang-consultation',
    tenantId: demoTenantId,
    customerId: 'demo-customer-liang-siyu',
    customerDisplayName: '梁思语',
    project: '面诊预约',
    scheduledAt: new Date('2026-06-02T16:00:00+08:00'),
    consultantUserId: 'demo-user-consultant',
    status: 'pending_confirmation',
    note: '待确认预约，用于演示运营提醒。',
  },
  {
    id: 'demo-appt-lu-cancelled',
    tenantId: demoTenantId,
    customerId: 'demo-customer-lu-qinghe',
    customerDisplayName: '陆清禾',
    project: '皮肤管理复购面诊',
    scheduledAt: new Date('2026-05-28T11:00:00+08:00'),
    consultantUserId: 'demo-user-ops',
    status: 'cancelled',
    note: '已取消预约，用于展示历史追溯。',
  },
  {
    id: 'demo-appt-ye-treatment',
    tenantId: demoTenantId,
    customerId: 'demo-customer-ye-shuyan',
    customerDisplayName: '叶舒颜',
    project: '射频修复治疗',
    scheduledAt: new Date('2026-05-31T15:00:00+08:00'),
    consultantUserId: 'demo-user-admin',
    status: 'completed',
    note: '主线客户 B 的作废治理演示预约。',
  },
];

const demoTreatmentSummarySeedRecords: Array<typeof treatmentSummaries.$inferInsert> = [
  {
    id: 'TS-001',
    tenantId: demoTenantId,
    customerId: 'demo-customer-shen-zhixia',
    appointmentId: 'demo-appt-shen-treatment',
    treatmentDate: new Date('2026-06-01T10:40:00+08:00'),
    treatmentProject: '光子嫩肤',
    treatmentCategory: 'laser_repair',
    treatmentStage: '术后即时护理',
    recoveryStage: 'D1 轻度泛红',
    riskLevel: 'normal',
    ownerUserId: 'demo-user-assistant',
    summary: '术后轻微泛红，已完成基础护理说明。',
    nextCareAction: 'D3 人工回访恢复状态，并确认是否需要复诊。',
    tags: ['主线客户A', '可生成建议', '光子修复'],
    voidedAt: null,
    voidedBy: null,
    voidReasonCode: null,
    voidReason: null,
    createdAt: new Date('2026-06-01T11:00:00+08:00'),
    updatedAt: new Date('2026-06-01T11:00:00+08:00'),
  },
  {
    id: 'TS-002',
    tenantId: demoTenantId,
    customerId: 'demo-customer-xu-ruoning',
    appointmentId: 'demo-appt-xu-revisit',
    treatmentDate: new Date('2026-05-29T13:30:00+08:00'),
    treatmentProject: '水光补水',
    treatmentCategory: 'injection_review',
    treatmentStage: '复诊前观察',
    recoveryStage: 'D5 保湿观察',
    riskLevel: 'watch',
    ownerUserId: 'demo-user-consultant',
    summary: '复诊前需确认保湿状态和轻微紧绷反馈。',
    nextCareAction: '复诊前一日提醒客户带齐护理反馈。',
    tags: ['水光复诊', '观察'],
    voidedAt: null,
    voidedBy: null,
    voidReasonCode: null,
    voidReason: null,
    createdAt: new Date('2026-05-29T14:00:00+08:00'),
    updatedAt: new Date('2026-05-30T09:20:00+08:00'),
  },
  {
    id: 'TS-003',
    tenantId: demoTenantId,
    customerId: 'demo-customer-gu-anran',
    appointmentId: null,
    treatmentDate: new Date('2026-05-30T17:20:00+08:00'),
    treatmentProject: '眼周术后护理',
    treatmentCategory: 'skin_repair',
    treatmentStage: '术后重点关怀',
    recoveryStage: 'D2 肿胀观察',
    riskLevel: 'urgent',
    ownerUserId: 'demo-user-assistant',
    summary: '术后恢复需要重点关注，已安排人工复核。',
    nextCareAction: '今日内完成重点回访并升级给医助确认。',
    tags: ['高风险', '重点关怀'],
    voidedAt: null,
    voidedBy: null,
    voidReasonCode: null,
    voidReason: null,
    createdAt: new Date('2026-05-30T18:00:00+08:00'),
    updatedAt: new Date('2026-05-30T18:00:00+08:00'),
  },
  {
    id: 'TS-004',
    tenantId: demoTenantId,
    customerId: 'demo-customer-cheng-wanqing',
    appointmentId: null,
    treatmentDate: new Date('2026-05-26T11:00:00+08:00'),
    treatmentProject: '抗衰联合护理',
    treatmentCategory: 'skin_check',
    treatmentStage: '复购窗口评估',
    recoveryStage: '稳定期',
    riskLevel: 'normal',
    ownerUserId: 'demo-user-ops',
    summary: '恢复稳定，客户表达后续抗衰组合兴趣。',
    nextCareAction: '7 日内由顾问跟进组合护理方案。',
    tags: ['高价值复购', '已编辑'],
    voidedAt: null,
    voidedBy: null,
    voidReasonCode: null,
    voidReason: null,
    createdAt: new Date('2026-05-26T11:30:00+08:00'),
    updatedAt: new Date('2026-05-27T09:30:00+08:00'),
  },
  {
    id: 'TS-005',
    tenantId: demoTenantId,
    customerId: 'demo-customer-ye-shuyan',
    appointmentId: 'demo-appt-ye-treatment',
    treatmentDate: new Date('2026-05-31T16:00:00+08:00'),
    treatmentProject: '射频修复',
    treatmentCategory: 'skin_repair',
    treatmentStage: '术后记录治理',
    recoveryStage: 'D1 观察',
    riskLevel: 'watch',
    ownerUserId: 'demo-user-admin',
    summary: '摘要曾被人工编辑，后因依据不完整标记作废。',
    nextCareAction: '作废后不再作为新的随访建议或来源任务依据。',
    tags: ['主线客户B', '已编辑', '已作废'],
    voidedAt: new Date('2026-06-01T10:20:00+08:00'),
    voidedBy: 'demo-user-admin',
    voidReasonCode: 'manual_governance_review',
    voidReason: '摘要录入依据不完整，仅保留历史追溯',
    createdAt: new Date('2026-05-31T16:30:00+08:00'),
    updatedAt: new Date('2026-06-01T10:20:00+08:00'),
  },
  {
    id: 'TS-006',
    tenantId: demoTenantId,
    customerId: 'demo-customer-tang-yimo',
    appointmentId: null,
    treatmentDate: new Date('2026-05-30T12:00:00+08:00'),
    treatmentProject: '水光术后复查',
    treatmentCategory: 'injection_review',
    treatmentStage: '来源治理演示',
    recoveryStage: 'D3 复查',
    riskLevel: 'watch',
    ownerUserId: 'demo-user-service',
    summary: '该摘要已创建来源随访任务，用于演示重复创建提示。',
    nextCareAction: '查看既有来源任务，避免重复创建。',
    tags: ['来源任务', '重复创建提示'],
    voidedAt: null,
    voidedBy: null,
    voidReasonCode: null,
    voidReason: null,
    createdAt: new Date('2026-05-30T12:30:00+08:00'),
    updatedAt: new Date('2026-05-30T12:30:00+08:00'),
  },
  {
    id: 'TS-007',
    tenantId: demoTenantId,
    customerId: 'demo-customer-lu-qinghe',
    appointmentId: 'demo-appt-lu-cancelled',
    treatmentDate: new Date('2026-03-01T12:00:00+08:00'),
    treatmentProject: '皮肤管理评估',
    treatmentCategory: 'skin_check',
    treatmentStage: '沉睡客户回看',
    recoveryStage: '历史记录',
    riskLevel: 'normal',
    ownerUserId: 'demo-user-ops',
    summary: '历史护理后长期未消费，用于演示沉睡客户线索。',
    nextCareAction: '纳入人工唤醒名单，暂不自动触达客户。',
    tags: ['沉睡客户', '历史追溯'],
    voidedAt: null,
    voidedBy: null,
    voidReasonCode: null,
    voidReason: null,
    createdAt: new Date('2026-03-01T12:30:00+08:00'),
    updatedAt: new Date('2026-03-01T12:30:00+08:00'),
  },
];

const demoFollowUpTaskSeedRecords: Array<typeof followUpTasks.$inferInsert> = [
  {
    id: 'demo-fu-shen-photon-d3',
    tenantId: demoTenantId,
    customerId: 'demo-customer-shen-zhixia',
    customerDisplayName: '沈知夏',
    journeyId: 'journey-demo-post-care',
    stage: 'D3 光子术后回访',
    status: 'due',
    dueAt: new Date('2026-06-03T10:00:00+08:00'),
    suggestedAction: '人工确认泛红恢复状态，并记录是否需要复诊。',
    riskLevel: 'normal',
    sourceTreatmentSummaryId: 'TS-001',
    sourceSuggestionKey: 'TS-001:category_laser_repair_care:3d:laser_repair',
    updatedBy: null,
    updatedAt: null,
    createdAt: new Date('2026-06-01T11:20:00+08:00'),
  },
  {
    id: 'demo-fu-gu-surgery-urgent',
    tenantId: demoTenantId,
    customerId: 'demo-customer-gu-anran',
    customerDisplayName: '顾安然',
    journeyId: 'journey-demo-risk-care',
    stage: 'D2 术后重点关怀',
    status: 'due',
    dueAt: new Date('2026-05-31T09:00:00+08:00'),
    suggestedAction: '升级医助人工复核恢复状态。',
    riskLevel: 'urgent',
    sourceTreatmentSummaryId: 'TS-003',
    sourceSuggestionKey: 'TS-003:urgent_risk_followup:1d',
    updatedBy: null,
    updatedAt: null,
    createdAt: new Date('2026-05-30T18:10:00+08:00'),
  },
  {
    id: 'demo-fu-cheng-repurchase-done',
    tenantId: demoTenantId,
    customerId: 'demo-customer-cheng-wanqing',
    customerDisplayName: '程晚晴',
    journeyId: 'journey-demo-repurchase',
    stage: 'D7 复购方案跟进',
    status: 'completed',
    dueAt: new Date('2026-06-01T15:00:00+08:00'),
    suggestedAction: '顾问已完成人工跟进，记录复购意向。',
    riskLevel: 'normal',
    sourceTreatmentSummaryId: 'TS-004',
    sourceSuggestionKey: 'TS-004:next_care_action_followup:7d',
    updatedBy: 'demo-user-ops',
    updatedAt: new Date('2026-06-01T16:20:00+08:00'),
    createdAt: new Date('2026-05-27T10:00:00+08:00'),
  },
  {
    id: 'demo-fu-tang-source-active',
    tenantId: demoTenantId,
    customerId: 'demo-customer-tang-yimo',
    customerDisplayName: '唐以沫',
    journeyId: 'journey-demo-source-governance',
    stage: 'D3 来源任务复查',
    status: 'scheduled',
    dueAt: new Date('2026-06-02T17:00:00+08:00'),
    suggestedAction: '查看来源摘要并完成一次人工复查。',
    riskLevel: 'watch',
    sourceTreatmentSummaryId: 'TS-006',
    sourceSuggestionKey: 'TS-006:watch_risk_followup:3d',
    updatedBy: null,
    updatedAt: null,
    createdAt: new Date('2026-05-30T13:00:00+08:00'),
  },
];

const demoAuditEventSeedRecords: Array<typeof auditEvents.$inferInsert> = [
  {
    eventId: 'demo-audit-customer-created-shen',
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    tenantId: demoTenantId,
    scope: 'tenant',
    resource: 'customer',
    resourceId: 'demo-customer-shen-zhixia',
    action: 'create',
    result: 'allowed',
    reason: 'allowed_by_policy',
    occurredAt: new Date('2026-06-01T09:20:00+08:00'),
    source: 'demo_session',
  },
  {
    eventId: 'demo-audit-appointment-created-shen',
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    tenantId: demoTenantId,
    scope: 'tenant',
    resource: 'appointment',
    resourceId: 'demo-appt-shen-treatment',
    action: 'create',
    result: 'allowed',
    reason: 'allowed_by_policy',
    occurredAt: new Date('2026-06-01T09:40:00+08:00'),
    source: 'demo_session',
  },
  {
    eventId: 'demo-audit-treatment-created-ts001',
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    tenantId: demoTenantId,
    scope: 'tenant',
    resource: 'treatment_summary',
    resourceId: 'TS-001',
    action: 'create',
    result: 'allowed',
    reason: 'allowed_by_policy',
    occurredAt: new Date('2026-06-01T11:00:00+08:00'),
    source: 'demo_session',
  },
  {
    eventId: 'demo-audit-treatment-edited-ts004',
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    tenantId: demoTenantId,
    scope: 'tenant',
    resource: 'treatment_summary',
    resourceId: 'TS-004',
    action: 'update',
    result: 'allowed',
    reason: 'allowed_by_policy',
    occurredAt: new Date('2026-05-27T09:30:00+08:00'),
    source: 'demo_session',
  },
  {
    eventId: 'demo-audit-treatment-voided-ts005',
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    tenantId: demoTenantId,
    scope: 'tenant',
    resource: 'treatment_summary',
    resourceId: 'TS-005',
    action: 'update',
    result: 'allowed',
    reason: 'treatment_summary_voided',
    occurredAt: new Date('2026-06-01T10:20:00+08:00'),
    source: 'demo_session',
  },
  {
    eventId: 'demo-audit-follow-up-created-shen',
    actorId: 'demo-user-service',
    actorRole: 'customer_service',
    tenantId: demoTenantId,
    scope: 'tenant',
    resource: 'follow_up',
    resourceId: 'demo-fu-shen-photon-d3',
    action: 'update',
    result: 'allowed',
    reason: 'allowed_by_policy',
    occurredAt: new Date('2026-06-01T11:20:00+08:00'),
    source: 'demo_session',
  },
  {
    eventId: 'demo-audit-role-denied-export',
    actorId: 'demo-user-service',
    actorRole: 'customer_service',
    tenantId: demoTenantId,
    scope: 'tenant',
    resource: 'audit_log',
    resourceId: null,
    action: 'export_report',
    result: 'denied',
    reason: 'role_denied',
    occurredAt: new Date('2026-06-01T12:00:00+08:00'),
    source: 'demo_session',
  },
  {
    eventId: 'demo-audit-quota-denied-appointment',
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    tenantId: demoTenantId,
    scope: 'tenant',
    resource: 'appointment',
    resourceId: null,
    action: 'create',
    result: 'denied',
    reason: 'quota_exceeded_appointments',
    occurredAt: new Date('2026-06-01T12:30:00+08:00'),
    source: 'demo_session',
  },
  {
    eventId: 'demo-audit-platform-tenant-health',
    actorId: 'demo-user-platform',
    actorRole: 'platform_admin',
    tenantId: null,
    scope: 'platform',
    resource: 'tenant',
    resourceId: demoTenantId,
    action: 'read_aggregate',
    result: 'allowed',
    reason: 'allowed_by_policy',
    occurredAt: new Date('2026-06-02T09:10:00+08:00'),
    source: 'demo_session',
  },
];

export function getDemoTenantSeedRecords() {
  return [...demoTenantRecords];
}

export function getDemoTenantPlanSeedRecords() {
  return [...demoTenantPlanRecords];
}

export function getDemoTenantPlanAssignmentSeedRecords() {
  return [...demoTenantPlanAssignmentRecords];
}

export function getDemoTenantQuotaSnapshotSeedRecords() {
  return [...demoTenantQuotaSnapshotRecords];
}

export function getDemoTenantMemberSeedRecords() {
  return [...demoTenantMemberRecords];
}

export function getDemoCustomerSeedRecords() {
  return demoCustomerSeedRecords.map((record) => ({
    ...record,
    tags: [...(record.tags ?? [])],
  }));
}

export function getDemoAppointmentSeedRecords() {
  return [...demoAppointmentSeedRecords];
}

export function getDemoTreatmentSummarySeedRecords() {
  return demoTreatmentSummarySeedRecords.map((record) => ({
    ...record,
    tags: [...(record.tags ?? [])],
  }));
}

export function getDemoFollowUpTaskSeedRecords() {
  return [...demoFollowUpTaskSeedRecords];
}

export function getDemoAuditEventSeedRecords() {
  return [...demoAuditEventSeedRecords];
}

export function findMissingDemoCustomerReferences(
  customerRecords: Array<typeof customers.$inferInsert> = getDemoCustomerSeedRecords(),
) {
  const customerKeys = new Set(
    customerRecords.map((record) => `${record.tenantId}:${record.id}`),
  );
  const references: DemoCustomerReference[] = [
    ...getDemoAppointmentSeedRecords().map((record) => ({
      source: 'appointment' as const,
      recordId: record.id,
      tenantId: record.tenantId,
      customerId: record.customerId,
    })),
    ...getDemoFollowUpTaskSeedRecords().map((task) => ({
      source: 'follow_up_task' as const,
      recordId: task.id,
      tenantId: task.tenantId,
      customerId: task.customerId,
    })),
    ...getDemoTreatmentSummarySeedRecords().map((record) => ({
      source: 'treatment_summary' as const,
      recordId: record.id,
      tenantId: record.tenantId,
      customerId: record.customerId,
    })),
  ];

  return references.filter(
    (reference) => !customerKeys.has(`${reference.tenantId}:${reference.customerId}`),
  );
}

export function findMissingDemoTreatmentAppointmentReferences() {
  const appointmentKeys = new Set(
    getDemoAppointmentSeedRecords().map((record) => `${record.tenantId}:${record.id}`),
  );
  const references: DemoTreatmentAppointmentReference[] = getDemoTreatmentSummarySeedRecords()
    .filter((record) => record.appointmentId)
    .map((record) => ({
      source: 'treatment_summary',
      recordId: record.id,
      tenantId: record.tenantId,
      appointmentId: record.appointmentId as string,
    }));

  return references.filter(
    (reference) => !appointmentKeys.has(`${reference.tenantId}:${reference.appointmentId}`),
  );
}

export function findMissingDemoFollowUpSourceReferences() {
  const treatmentSummaryKeys = new Set(
    getDemoTreatmentSummarySeedRecords().map((record) => `${record.tenantId}:${record.id}`),
  );
  const references: DemoFollowUpSourceReference[] = getDemoFollowUpTaskSeedRecords()
    .filter((task) => task.sourceTreatmentSummaryId)
    .map((task) => ({
      source: 'follow_up_task',
      recordId: task.id,
      tenantId: task.tenantId,
      sourceTreatmentSummaryId: task.sourceTreatmentSummaryId as string,
    }));

  return references.filter(
    (reference) =>
      !treatmentSummaryKeys.has(`${reference.tenantId}:${reference.sourceTreatmentSummaryId}`),
  );
}

export function assertDemoCustomerReferenceCoverage(
  customerRecords: Array<typeof customers.$inferInsert> = getDemoCustomerSeedRecords(),
) {
  const missingReferences = findMissingDemoCustomerReferences(customerRecords);

  if (missingReferences.length > 0) {
    throw new Error(
      `Demo seed customer references missing: ${missingReferences
        .map(
          (reference) =>
            `${reference.source}/${reference.recordId}->${reference.tenantId}:${reference.customerId}`,
        )
        .join(', ')}`,
    );
  }
}

export function assertDemoTreatmentAppointmentReferenceCoverage() {
  const missingReferences = findMissingDemoTreatmentAppointmentReferences();

  if (missingReferences.length > 0) {
    throw new Error(
      `Demo seed treatment appointment references missing: ${missingReferences
        .map(
          (reference) =>
            `${reference.source}/${reference.recordId}->${reference.tenantId}:${reference.appointmentId}`,
        )
        .join(', ')}`,
    );
  }
}

export function assertDemoFollowUpSourceReferenceCoverage() {
  const missingReferences = findMissingDemoFollowUpSourceReferences();

  if (missingReferences.length > 0) {
    throw new Error(
      `Demo seed follow-up source references missing: ${missingReferences
        .map(
          (reference) =>
            `${reference.source}/${reference.recordId}->${reference.tenantId}:${reference.sourceTreatmentSummaryId}`,
        )
        .join(', ')}`,
    );
  }
}

export function assertDemoSeedExecutionAllowed(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production' && env.ZMTG_ENABLE_DEMO_SEED !== 'true') {
    throw new Error(demoSeedProductionGuardMessage);
  }
}

export async function seedDemoData(db: TenantDatabase) {
  assertDemoCustomerReferenceCoverage();
  assertDemoTreatmentAppointmentReferenceCoverage();
  assertDemoFollowUpSourceReferenceCoverage();

  await db
    .insert(tenants)
    .values(getDemoTenantSeedRecords())
    .onConflictDoUpdate({
      target: tenants.id,
      set: {
        name: sql`excluded.name`,
        status: sql`excluded.status`,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(tenantPlans)
    .values(getDemoTenantPlanSeedRecords())
    .onConflictDoUpdate({
      target: tenantPlans.id,
      set: {
        name: sql`excluded.name`,
        code: sql`excluded.code`,
        description: sql`excluded.description`,
        status: sql`excluded.status`,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(tenantPlanAssignments)
    .values(getDemoTenantPlanAssignmentSeedRecords())
    .onConflictDoUpdate({
      target: tenantPlanAssignments.id,
      set: {
        tenantId: sql`excluded.tenant_id`,
        planId: sql`excluded.plan_id`,
        status: sql`excluded.status`,
        startedAt: sql`excluded.started_at`,
        expiresAt: sql`excluded.expires_at`,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(tenantQuotaSnapshots)
    .values(getDemoTenantQuotaSnapshotSeedRecords())
    .onConflictDoUpdate({
      target: tenantQuotaSnapshots.id,
      set: {
        tenantId: sql`excluded.tenant_id`,
        planAssignmentId: sql`excluded.plan_assignment_id`,
        maxCustomers: sql`excluded.max_customers`,
        maxAppointments: sql`excluded.max_appointments`,
        maxFollowUps: sql`excluded.max_follow_ups`,
        maxAiCalls: sql`excluded.max_ai_calls`,
        currentCustomers: sql`excluded.current_customers`,
        currentAppointments: sql`excluded.current_appointments`,
        currentFollowUps: sql`excluded.current_follow_ups`,
        currentAiCalls: sql`excluded.current_ai_calls`,
        snapshotAt: sql`excluded.snapshot_at`,
      },
    });

  await db
    .insert(tenantMembers)
    .values(getDemoTenantMemberSeedRecords())
    .onConflictDoUpdate({
      target: tenantMembers.id,
      set: {
        tenantId: sql`excluded.tenant_id`,
        userId: sql`excluded.user_id`,
        role: sql`excluded.role`,
        displayName: sql`excluded.display_name`,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(customers)
    .values(getDemoCustomerSeedRecords())
    .onConflictDoUpdate({
      target: customers.id,
      set: {
        tenantId: sql`excluded.tenant_id`,
        displayName: sql`excluded.display_name`,
        lifecycle: sql`excluded.lifecycle`,
        priority: sql`excluded.priority`,
        ownerUserId: sql`excluded.owner_user_id`,
        projectInterest: sql`excluded.project_interest`,
        maskedPhone: sql`excluded.masked_phone`,
        maskedMedicalRecordNo: sql`excluded.masked_medical_record_no`,
        lastTouchSummary: sql`excluded.last_touch_summary`,
        nextAction: sql`excluded.next_action`,
        tags: sql`excluded.tags`,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(appointments)
    .values(getDemoAppointmentSeedRecords())
    .onConflictDoUpdate({
      target: appointments.id,
      set: {
        tenantId: sql`excluded.tenant_id`,
        customerId: sql`excluded.customer_id`,
        customerDisplayName: sql`excluded.customer_display_name`,
        project: sql`excluded.project`,
        scheduledAt: sql`excluded.scheduled_at`,
        consultantUserId: sql`excluded.consultant_user_id`,
        status: sql`excluded.status`,
        note: sql`excluded.note`,
        updatedAt: sql`now()`,
      },
    });

  await db
    .insert(treatmentSummaries)
    .values(getDemoTreatmentSummarySeedRecords())
    .onConflictDoUpdate({
      target: treatmentSummaries.id,
      set: {
        tenantId: sql`excluded.tenant_id`,
        customerId: sql`excluded.customer_id`,
        appointmentId: sql`excluded.appointment_id`,
        treatmentDate: sql`excluded.treatment_date`,
        treatmentProject: sql`excluded.treatment_project`,
        treatmentCategory: sql`excluded.treatment_category`,
        treatmentStage: sql`excluded.treatment_stage`,
        recoveryStage: sql`excluded.recovery_stage`,
        riskLevel: sql`excluded.risk_level`,
        ownerUserId: sql`excluded.owner_user_id`,
        summary: sql`excluded.summary`,
        nextCareAction: sql`excluded.next_care_action`,
        tags: sql`excluded.tags`,
        voidedAt: sql`excluded.voided_at`,
        voidedBy: sql`excluded.voided_by`,
        voidReasonCode: sql`excluded.void_reason_code`,
        voidReason: sql`excluded.void_reason`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  await db
    .insert(followUpTasks)
    .values(getDemoFollowUpTaskSeedRecords())
    .onConflictDoUpdate({
      target: followUpTasks.id,
      set: {
        tenantId: sql`excluded.tenant_id`,
        customerId: sql`excluded.customer_id`,
        customerDisplayName: sql`excluded.customer_display_name`,
        journeyId: sql`excluded.journey_id`,
        stage: sql`excluded.stage`,
        status: sql`excluded.status`,
        dueAt: sql`excluded.due_at`,
        suggestedAction: sql`excluded.suggested_action`,
        riskLevel: sql`excluded.risk_level`,
        sourceTreatmentSummaryId: sql`excluded.source_treatment_summary_id`,
        sourceSuggestionKey: sql`excluded.source_suggestion_key`,
        updatedBy: sql`excluded.updated_by`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  await db
    .insert(auditEvents)
    .values(getDemoAuditEventSeedRecords())
    .onConflictDoUpdate({
      target: auditEvents.eventId,
      set: {
        actorId: sql`excluded.actor_id`,
        actorRole: sql`excluded.actor_role`,
        tenantId: sql`excluded.tenant_id`,
        scope: sql`excluded.scope`,
        resource: sql`excluded.resource`,
        resourceId: sql`excluded.resource_id`,
        action: sql`excluded.action`,
        result: sql`excluded.result`,
        reason: sql`excluded.reason`,
        occurredAt: sql`excluded.occurred_at`,
        source: sql`excluded.source`,
      },
    });
}

async function runSeed() {
  assertDemoSeedExecutionAllowed();

  const queryClient = createPostgresClient();
  const db = createDatabase(queryClient);

  try {
    await seedDemoData(db);
  } finally {
    await queryClient.end();
  }
}

function isDirectRun() {
  return process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;
}

if (isDirectRun()) {
  runSeed().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
