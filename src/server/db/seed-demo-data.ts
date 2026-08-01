import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inArray, or } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import { assertDemoSeedAllowed } from '@/server/db/seed-guard';
import {
  appointments,
  auditEvents,
  authUsers,
  customers,
  followUpTasks,
  tenantAuthorizationSnapshots,
  tenantCommercialRecords,
  tenantMembers,
  tenantPlanAssignments,
  tenantPlans,
  tenantPlanVersions,
  tenantQuotaSnapshots,
  tenants,
  treatmentSummaries,
} from '@/server/db/schema';

const trialYunlanTenantId = 'trial-tenant-yunlan';
const trialBaiyueTenantId = 'trial-tenant-baiyue';
const starterXingheTenantId = 'starter-tenant-xinghe';
const starterXingheInstitutionId = 'starter-inst-xinghe';
const starterYubaiTenantId = 'starter-tenant-yubai';
const growthChengxingTenantId = 'growth-tenant-chengxing';
const growthChengxingInstitutionId = 'growth-inst-chengxing';
const growthQingmangTenantId = 'growth-tenant-qingmang';
const primaryDemoTenantId = growthChengxingTenantId;
const demoTenantId = primaryDemoTenantId;
const secondaryTenantId = starterXingheTenantId;
const demoSeedStartedAt = new Date('2026-06-01T09:00:00+08:00');
const demoSeedSnapshotAt = new Date('2026-06-02T09:00:00+08:00');
export const demoSeedProductionGuardMessage =
  'demo seed 仅允许明确确认的 local/demo loopback 数据库；production/staging 环境始终拒绝';
export const demoSeedAuthUserOwnershipConflictMessage =
  'demo seed auth user ownership conflict';
export const demoSeedDatabaseWriteDisabledMessage =
  'demo seed 数据库写入已关闭；Membership 必须由 Access Control Owner command 管理';

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

function cloneJsonRecord(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
}

function readStringList(json: unknown, key: string) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  const value = (json as Record<string, unknown>)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

const demoTenantRecords: Array<typeof tenants.$inferInsert> = [
  {
    id: trialYunlanTenantId,
    name: '云澜轻美诊所',
    status: 'active',
  },
  {
    id: trialBaiyueTenantId,
    name: '柏悦皮肤管理中心',
    status: 'active',
  },
  {
    id: starterXingheTenantId,
    name: '星禾医美门诊',
    status: 'active',
  },
  {
    id: starterYubaiTenantId,
    name: '予白皮肤管理',
    status: 'active',
  },
  {
    id: growthChengxingTenantId,
    name: '澄星医疗美容',
    status: 'active',
  },
  {
    id: growthQingmangTenantId,
    name: '青芒美学连锁',
    status: 'active',
  },
];

const demoTenantPlanRecords: Array<typeof tenantPlans.$inferInsert> = [
  {
    id: 'plan-starter-care',
    name: '基础版',
    code: 'starter-care',
    description: '适合单店或小机构正式试用客户档案、知识库和基础连接器。',
    status: 'active',
  },
  {
    id: 'plan-growth-care',
    name: '专业版',
    code: 'growth-care',
    description: '适合成熟机构或多角色团队试用客户分层、AI 运营和连接器能力。',
    status: 'active',
  },
  {
    id: 'plan-trial-care',
    name: '试用版',
    code: 'trial-care',
    description: '适合意向客户和演示客户体验核心流程。',
    status: 'active',
  },
];

const demoTenantPlanVersionRecords: Array<typeof tenantPlanVersions.$inferInsert> = [
  {
    id: 'plan-version-trial-care-2026-commercial-trial',
    planId: 'plan-trial-care',
    versionCode: '2026-commercial-trial',
    status: 'published',
    displayName: '试用版',
    displayPrice: '试用版展示价（未定价）',
    priceNote: '仅用于商业试用演示，不代表正式报价。',
    agentLimit: 1,
    seatLimit: 1,
    monthlyAiCallLimit: 5000,
    knowledgeStorageGb: 1,
    connectorEntitlementsJson: {
      connectors: ['企微演示'],
    },
    serviceEntitlementsJson: {
      services: ['新手引导', '图文/视频教程', '平台演示配置'],
    },
    featureEntitlementsJson: {
      features: ['客户管理体验', '智能随访示例', '知识库示例', 'AI 助手体验'],
    },
    quotaEntitlementsJson: {
      agentLimit: 1,
      seatLimit: 1,
      monthlyAiCallLimit: 5000,
      knowledgeStorageMb: 100,
    },
    changeSummary: '初始化商业试用版权益',
    createdBy: 'demo-user-platform',
    updatedBy: 'demo-user-platform',
    publishedBy: 'demo-user-platform',
    publishedAt: demoSeedStartedAt,
    retiredAt: null,
    createdAt: demoSeedStartedAt,
    updatedAt: demoSeedStartedAt,
  },
  {
    id: 'plan-version-starter-care-2026-commercial-trial',
    planId: 'plan-starter-care',
    versionCode: '2026-commercial-trial',
    status: 'published',
    displayName: '基础版',
    displayPrice: '基础版展示价（未定价）',
    priceNote: '仅用于商业试用演示，不代表正式报价。',
    agentLimit: 1,
    seatLimit: 5,
    monthlyAiCallLimit: 50000,
    knowledgeStorageGb: 1,
    connectorEntitlementsJson: {
      connectors: ['企微'],
    },
    serviceEntitlementsJson: {
      services: ['新手引导', '图文/视频教程', '1 次基础配置', '1 次线上培训'],
    },
    featureEntitlementsJson: {
      features: ['客户管理', '智能随访', '知识库管理', 'AI 智能助手', 'AI 客服辅助'],
    },
    quotaEntitlementsJson: {
      agentLimit: 1,
      seatLimit: 5,
      monthlyAiCallLimit: 50000,
      knowledgeStorageMb: 500,
    },
    changeSummary: '初始化商业基础版权益',
    createdBy: 'demo-user-platform',
    updatedBy: 'demo-user-platform',
    publishedBy: 'demo-user-platform',
    publishedAt: demoSeedStartedAt,
    retiredAt: null,
    createdAt: demoSeedStartedAt,
    updatedAt: demoSeedStartedAt,
  },
  {
    id: 'plan-version-growth-care-2026-commercial-trial',
    planId: 'plan-growth-care',
    versionCode: '2026-commercial-trial',
    status: 'published',
    displayName: '专业版',
    displayPrice: '专业版展示价（未定价）',
    priceNote: '仅用于商业试用演示，不代表正式报价。',
    agentLimit: 3,
    seatLimit: 20,
    monthlyAiCallLimit: 300000,
    knowledgeStorageGb: 2,
    connectorEntitlementsJson: {
      connectors: ['企微', 'HIS', 'CRM'],
    },
    serviceEntitlementsJson: {
      services: ['专属配置支持', '多角色培训', '进阶模板', '专属上线检查'],
    },
    featureEntitlementsJson: {
      features: ['客户 360 档案', '多场景随访 SOP', '知识库管理', '多 Agent 分工', '完整数据报表'],
    },
    quotaEntitlementsJson: {
      agentLimit: 3,
      seatLimit: 20,
      monthlyAiCallLimit: 300000,
      knowledgeStorageMb: 2048,
    },
    changeSummary: '初始化商业专业版权益',
    createdBy: 'demo-user-platform',
    updatedBy: 'demo-user-platform',
    publishedBy: 'demo-user-platform',
    publishedAt: demoSeedStartedAt,
    retiredAt: null,
    createdAt: demoSeedStartedAt,
    updatedAt: demoSeedStartedAt,
  },
];

const demoTenantPlanAssignmentRecords: Array<typeof tenantPlanAssignments.$inferInsert> = [
  {
    id: 'assign-trial-tenant-yunlan-trial',
    tenantId: trialYunlanTenantId,
    planId: 'plan-trial-care',
    planVersionId: 'plan-version-trial-care-2026-commercial-trial',
    status: 'active',
    startedAt: demoSeedStartedAt,
    expiresAt: null,
  },
  {
    id: 'assign-trial-tenant-baiyue-trial',
    tenantId: trialBaiyueTenantId,
    planId: 'plan-trial-care',
    planVersionId: 'plan-version-trial-care-2026-commercial-trial',
    status: 'active',
    startedAt: demoSeedStartedAt,
    expiresAt: null,
  },
  {
    id: 'assign-starter-tenant-xinghe-starter',
    tenantId: starterXingheTenantId,
    planId: 'plan-starter-care',
    planVersionId: 'plan-version-starter-care-2026-commercial-trial',
    status: 'active',
    startedAt: demoSeedStartedAt,
    expiresAt: null,
  },
  {
    id: 'assign-starter-tenant-yubai-starter',
    tenantId: starterYubaiTenantId,
    planId: 'plan-starter-care',
    planVersionId: 'plan-version-starter-care-2026-commercial-trial',
    status: 'active',
    startedAt: demoSeedStartedAt,
    expiresAt: null,
  },
  {
    id: 'assign-growth-tenant-chengxing-growth',
    tenantId: growthChengxingTenantId,
    planId: 'plan-growth-care',
    planVersionId: 'plan-version-growth-care-2026-commercial-trial',
    status: 'active',
    startedAt: demoSeedStartedAt,
    expiresAt: null,
  },
  {
    id: 'assign-growth-tenant-qingmang-growth',
    tenantId: growthQingmangTenantId,
    planId: 'plan-growth-care',
    planVersionId: 'plan-version-growth-care-2026-commercial-trial',
    status: 'active',
    startedAt: demoSeedStartedAt,
    expiresAt: null,
  },
];

function buildTenantGrantSnapshotRecord(input: {
  id: string;
  tenantId: string;
  planAssignmentId: string;
  planVersionId: string;
  status: 'active' | 'superseded' | 'revoked';
  generatedAt: Date;
  supersededAt: Date | null;
}) {
  const version = demoTenantPlanVersionRecords.find((record) => record.id === input.planVersionId);
  const plan = version
    ? demoTenantPlanRecords.find((record) => record.id === version.planId)
    : undefined;

  if (!version || !plan) {
    throw new Error(`Demo authorization snapshot references missing plan version: ${input.id}`);
  }

  const quotaJson = cloneJsonRecord(version.quotaEntitlementsJson);

  return {
    id: input.id,
    tenantId: input.tenantId,
    planAssignmentId: input.planAssignmentId,
    planVersionId: input.planVersionId,
    status: input.status,
    snapshotJson: {
      planId: version.planId,
      planCode: plan.code,
      planName: plan.name,
      planVersionId: version.id,
      versionCode: version.versionCode,
      displayName: version.displayName,
      displayPrice: version.displayPrice,
    },
    quotaJson,
    connectorJson: {
      connectors: readStringList(version.connectorEntitlementsJson, 'connectors'),
    },
    serviceJson: {
      services: readStringList(version.serviceEntitlementsJson, 'services'),
    },
    sourceChangeRecordId: null,
    generatedBy: 'demo-user-platform',
    generatedAt: input.generatedAt,
    supersededAt: input.supersededAt,
    createdAt: input.generatedAt,
  } satisfies typeof tenantAuthorizationSnapshots.$inferInsert;
}

const demoTenantAuthorizationSnapshotRecords: Array<
  typeof tenantAuthorizationSnapshots.$inferInsert
> = [
  buildTenantGrantSnapshotRecord({
    id: 'auth-trial-tenant-yunlan-current',
    tenantId: trialYunlanTenantId,
    planAssignmentId: 'assign-trial-tenant-yunlan-trial',
    planVersionId: 'plan-version-trial-care-2026-commercial-trial',
    status: 'active',
    generatedAt: demoSeedSnapshotAt,
    supersededAt: null,
  }),
  buildTenantGrantSnapshotRecord({
    id: 'auth-trial-tenant-baiyue-current',
    tenantId: trialBaiyueTenantId,
    planAssignmentId: 'assign-trial-tenant-baiyue-trial',
    planVersionId: 'plan-version-trial-care-2026-commercial-trial',
    status: 'active',
    generatedAt: demoSeedSnapshotAt,
    supersededAt: null,
  }),
  buildTenantGrantSnapshotRecord({
    id: 'auth-starter-tenant-xinghe-current',
    tenantId: starterXingheTenantId,
    planAssignmentId: 'assign-starter-tenant-xinghe-starter',
    planVersionId: 'plan-version-starter-care-2026-commercial-trial',
    status: 'active',
    generatedAt: demoSeedSnapshotAt,
    supersededAt: null,
  }),
  buildTenantGrantSnapshotRecord({
    id: 'auth-starter-tenant-yubai-current',
    tenantId: starterYubaiTenantId,
    planAssignmentId: 'assign-starter-tenant-yubai-starter',
    planVersionId: 'plan-version-starter-care-2026-commercial-trial',
    status: 'active',
    generatedAt: demoSeedSnapshotAt,
    supersededAt: null,
  }),
  buildTenantGrantSnapshotRecord({
    id: 'auth-growth-tenant-chengxing-current',
    tenantId: growthChengxingTenantId,
    planAssignmentId: 'assign-growth-tenant-chengxing-growth',
    planVersionId: 'plan-version-growth-care-2026-commercial-trial',
    status: 'active',
    generatedAt: demoSeedSnapshotAt,
    supersededAt: null,
  }),
  buildTenantGrantSnapshotRecord({
    id: 'auth-growth-tenant-qingmang-current',
    tenantId: growthQingmangTenantId,
    planAssignmentId: 'assign-growth-tenant-qingmang-growth',
    planVersionId: 'plan-version-growth-care-2026-commercial-trial',
    status: 'active',
    generatedAt: demoSeedSnapshotAt,
    supersededAt: null,
  }),
];

const demoTenantQuotaSnapshotRecords: Array<typeof tenantQuotaSnapshots.$inferInsert> = [
  {
    id: 'quota-trial-tenant-yunlan-current',
    tenantId: trialYunlanTenantId,
    planAssignmentId: 'assign-trial-tenant-yunlan-trial',
    maxCustomers: 80,
    maxAppointments: 120,
    maxFollowUps: 200,
    maxAiCalls: 5000,
    currentCustomers: 18,
    currentAppointments: 26,
    currentFollowUps: 35,
    currentAiCalls: 0,
    snapshotAt: demoSeedSnapshotAt,
  },
  {
    id: 'quota-trial-tenant-baiyue-current',
    tenantId: trialBaiyueTenantId,
    planAssignmentId: 'assign-trial-tenant-baiyue-trial',
    maxCustomers: 80,
    maxAppointments: 120,
    maxFollowUps: 200,
    maxAiCalls: 5000,
    currentCustomers: 24,
    currentAppointments: 32,
    currentFollowUps: 48,
    currentAiCalls: 0,
    snapshotAt: demoSeedSnapshotAt,
  },
  {
    id: 'quota-starter-tenant-xinghe-current',
    tenantId: starterXingheTenantId,
    planAssignmentId: 'assign-starter-tenant-xinghe-starter',
    maxCustomers: 500,
    maxAppointments: 800,
    maxFollowUps: 1200,
    maxAiCalls: 50000,
    currentCustomers: 128,
    currentAppointments: 186,
    currentFollowUps: 260,
    currentAiCalls: 0,
    snapshotAt: demoSeedSnapshotAt,
  },
  {
    id: 'quota-starter-tenant-yubai-current',
    tenantId: starterYubaiTenantId,
    planAssignmentId: 'assign-starter-tenant-yubai-starter',
    maxCustomers: 500,
    maxAppointments: 800,
    maxFollowUps: 1200,
    maxAiCalls: 50000,
    currentCustomers: 166,
    currentAppointments: 248,
    currentFollowUps: 388,
    currentAiCalls: 0,
    snapshotAt: demoSeedSnapshotAt,
  },
  {
    id: 'quota-growth-tenant-chengxing-current',
    tenantId: growthChengxingTenantId,
    planAssignmentId: 'assign-growth-tenant-chengxing-growth',
    maxCustomers: 2000,
    maxAppointments: 3000,
    maxFollowUps: 5000,
    maxAiCalls: 300000,
    currentCustomers: 680,
    currentAppointments: 980,
    currentFollowUps: 1520,
    currentAiCalls: 0,
    snapshotAt: demoSeedSnapshotAt,
  },
  {
    id: 'quota-growth-tenant-qingmang-current',
    tenantId: growthQingmangTenantId,
    planAssignmentId: 'assign-growth-tenant-qingmang-growth',
    maxCustomers: 2000,
    maxAppointments: 3000,
    maxFollowUps: 5000,
    maxAiCalls: 300000,
    currentCustomers: 920,
    currentAppointments: 1360,
    currentFollowUps: 2180,
    currentAiCalls: 0,
    snapshotAt: demoSeedSnapshotAt,
  },
];

const legacySeedActorId = 'legacy-demo-seed-actor';
const demoDisabledPasswordHash = 'disabled-demo-account-no-login-credential';
const demoSeedMemberProfiles = [
  {
    id: 'member-trial-yunlan-admin',
    tenantId: trialYunlanTenantId,
    userId: 'trial-user-yunlan-admin',
    username: 'legacy_seed_yunlan_admin_anchor',
    role: 'tenant_admin',
    displayName: '云澜管理员',
  },
  {
    id: 'member-trial-baiyue-admin',
    tenantId: trialBaiyueTenantId,
    userId: 'trial-user-baiyue-admin',
    username: 'legacy_seed_baiyue_admin_anchor',
    role: 'tenant_admin',
    displayName: '柏悦管理员',
  },
  {
    id: 'member-starter-xinghe-admin',
    tenantId: starterXingheTenantId,
    userId: 'starter-user-xinghe-admin',
    username: 'legacy_seed_xinghe_admin_anchor',
    role: 'tenant_admin',
    displayName: '星禾管理员',
  },
  {
    id: 'member-starter-yubai-admin',
    tenantId: starterYubaiTenantId,
    userId: 'starter-user-yubai-admin',
    username: 'legacy_seed_yubai_admin_anchor',
    role: 'tenant_admin',
    displayName: '予白管理员',
  },
  {
    id: 'member-growth-chengxing-admin',
    tenantId: growthChengxingTenantId,
    userId: 'growth-user-chengxing-admin',
    username: 'legacy_seed_chengxing_admin_anchor',
    role: 'tenant_admin',
    displayName: '澄星管理员',
  },
  {
    id: 'member-growth-qingmang-admin',
    tenantId: growthQingmangTenantId,
    userId: 'growth-user-qingmang-admin',
    username: 'legacy_seed_qingmang_admin_anchor',
    role: 'tenant_admin',
    displayName: '青芒管理员',
  },
  {
    id: 'member-demo-admin',
    tenantId: growthChengxingTenantId,
    userId: 'demo-user-admin',
    username: 'legacy_seed_demo_admin_anchor',
    role: 'tenant_admin',
    displayName: '演示管理员',
  },
  {
    id: 'member-demo-ops',
    tenantId: growthChengxingTenantId,
    userId: 'demo-user-ops',
    username: 'legacy_seed_demo_ops_anchor',
    role: 'tenant_operator',
    displayName: '周运营',
  },
  {
    id: 'member-demo-consultant',
    tenantId: growthChengxingTenantId,
    userId: 'demo-user-consultant',
    username: 'legacy_seed_demo_consultant_anchor',
    role: 'consultant',
    displayName: '许咨询',
  },
  {
    id: 'member-demo-service',
    tenantId: growthChengxingTenantId,
    userId: 'demo-user-service',
    username: 'legacy_seed_demo_service_anchor',
    role: 'customer_service',
    displayName: '赵客服',
  },
  {
    id: 'member-demo-assistant',
    tenantId: growthChengxingTenantId,
    userId: 'demo-user-assistant',
    username: 'legacy_seed_demo_assistant_anchor',
    role: 'tenant_operator',
    displayName: '陈医助',
  },
] as const;

const demoSeedAuthUserRecords: Array<typeof authUsers.$inferInsert> = demoSeedMemberProfiles.map(
  (profile) => ({
    id: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    phone: null,
    email: null,
    passwordHash: demoDisabledPasswordHash,
    passwordUpdatedAt: demoSeedStartedAt,
    passwordResetRequired: true,
    status: 'disabled',
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdBy: legacySeedActorId,
    updatedBy: legacySeedActorId,
    createdAt: demoSeedStartedAt,
    updatedAt: demoSeedStartedAt,
  }),
);

const demoTenantMemberRecords: Array<typeof tenantMembers.$inferInsert> =
  demoSeedMemberProfiles.map((profile) => ({
    id: profile.id,
    tenantId: profile.tenantId,
    userId: profile.userId,
    role: profile.role,
    displayName: profile.displayName,
  }));


const demoTenantCommercialRecordRecords: Array<typeof tenantCommercialRecords.$inferInsert> = [
  {
    id: 'commercial-demo-order-001',
    tenantId: demoTenantId,
    recordType: 'order',
    status: 'pending',
    displayCode: 'ORDER-DEMO-001',
    displayAmount: '参考金额（未结算）',
    periodLabel: '2026-06 演示周期',
    relatedPlanChangeId: null,
    note: '仅用于人工流程占位，不触发交易。',
    occurredAt: new Date('2026-06-02T10:00:00+08:00'),
    createdBy: 'demo-user-platform',
    updatedBy: 'demo-user-platform',
    createdAt: demoSeedSnapshotAt,
    updatedAt: demoSeedSnapshotAt,
  },
  {
    id: 'commercial-demo-contract-001',
    tenantId: demoTenantId,
    recordType: 'contract',
    status: 'manual_review',
    displayCode: 'CONTRACT-DEMO-001',
    displayAmount: null,
    periodLabel: '2026-06 演示周期',
    relatedPlanChangeId: null,
    note: '仅用于人工商务资料占位，不承载正文或签章。',
    occurredAt: new Date('2026-06-02T10:10:00+08:00'),
    createdBy: 'demo-user-platform',
    updatedBy: 'demo-user-platform',
    createdAt: demoSeedSnapshotAt,
    updatedAt: demoSeedSnapshotAt,
  },
  {
    id: 'commercial-demo-invoice-001',
    tenantId: demoTenantId,
    recordType: 'invoice',
    status: 'draft',
    displayCode: 'INVOICE-DEMO-001',
    displayAmount: '参考金额（未开具）',
    periodLabel: '2026-06 演示周期',
    relatedPlanChangeId: null,
    note: '仅用于人工开票流程占位，不包含税号或票据原文。',
    occurredAt: new Date('2026-06-02T10:20:00+08:00'),
    createdBy: 'demo-user-platform',
    updatedBy: 'demo-user-platform',
    createdAt: demoSeedSnapshotAt,
    updatedAt: demoSeedSnapshotAt,
  },
  {
    id: 'commercial-demo-payment-001',
    tenantId: demoTenantId,
    recordType: 'payment',
    status: 'manual_review',
    displayCode: 'PAY-DEMO-001',
    displayAmount: '参考金额（待人工确认）',
    periodLabel: '2026-06 演示周期',
    relatedPlanChangeId: null,
    note: '仅用于人工回款状态占位，不触发交易。',
    occurredAt: new Date('2026-06-02T10:30:00+08:00'),
    createdBy: 'demo-user-platform',
    updatedBy: 'demo-user-platform',
    createdAt: demoSeedSnapshotAt,
    updatedAt: demoSeedSnapshotAt,
  },
];

const demoCustomerSeedRecords: Array<typeof customers.$inferInsert> = [
  {
    id: 'demo-customer-shen-zhixia',
    tenantId: demoTenantId,
    institutionId: growthChengxingInstitutionId,
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
    institutionId: growthChengxingInstitutionId,
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
    institutionId: growthChengxingInstitutionId,
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
    institutionId: growthChengxingInstitutionId,
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
    institutionId: growthChengxingInstitutionId,
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
    institutionId: growthChengxingInstitutionId,
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
    institutionId: growthChengxingInstitutionId,
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
    institutionId: growthChengxingInstitutionId,
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
    institutionId: starterXingheInstitutionId,
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

export function getDemoTenantPlanVersionSeedRecords() {
  return demoTenantPlanVersionRecords.map((record) => ({
    ...record,
    connectorEntitlementsJson: cloneJsonRecord(record.connectorEntitlementsJson),
    serviceEntitlementsJson: cloneJsonRecord(record.serviceEntitlementsJson),
    featureEntitlementsJson: cloneJsonRecord(record.featureEntitlementsJson),
    quotaEntitlementsJson: cloneJsonRecord(record.quotaEntitlementsJson),
  }));
}

export function getDemoTenantPlanAssignmentSeedRecords() {
  return [...demoTenantPlanAssignmentRecords];
}

export function getDemoTenantAuthorizationSnapshotSeedRecords() {
  return demoTenantAuthorizationSnapshotRecords.map((record) => ({
    ...record,
    snapshotJson: cloneJsonRecord(record.snapshotJson),
    quotaJson: cloneJsonRecord(record.quotaJson),
    connectorJson: cloneJsonRecord(record.connectorJson),
    serviceJson: cloneJsonRecord(record.serviceJson),
  }));
}

export function getDemoTenantQuotaSnapshotSeedRecords() {
  return [...demoTenantQuotaSnapshotRecords];
}

export function getDemoTenantCommercialRecordSeedRecords() {
  return [...demoTenantCommercialRecordRecords];
}

export function getDemoSeedAuthUserRecords() {
  return [...demoSeedAuthUserRecords];
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

export function findMissingDemoSeedAuthUserReferences() {
  const authUserIds = new Set(getDemoSeedAuthUserRecords().map((record) => record.id));

  return getDemoTenantMemberSeedRecords().filter((record) => !authUserIds.has(record.userId));
}

export function assertDemoSeedAuthUserReferenceCoverage() {
  const missingMembers = findMissingDemoSeedAuthUserReferences();

  if (missingMembers.length > 0) {
    throw new Error(
      `Demo seed auth user references missing: ${missingMembers
        .map((record) => `${record.id}->${record.userId}`)
        .join(', ')}`,
    );
  }
}

export async function assertDemoSeedAuthUserOwnership(db: TenantDatabase) {
  const expectedUsers = getDemoSeedAuthUserRecords();
  const expectedById = new Map(expectedUsers.map((user) => [user.id, user]));
  const expectedByUsername = new Map(expectedUsers.map((user) => [user.username, user]));
  const existingUsers = await db
    .select({
      id: authUsers.id,
      username: authUsers.username,
      createdBy: authUsers.createdBy,
    })
    .from(authUsers)
    .where(
      or(
        inArray(
          authUsers.id,
          expectedUsers.map((user) => user.id),
        ),
        inArray(
          authUsers.username,
          expectedUsers.map((user) => user.username),
        ),
      ),
    );

  for (const existingUser of existingUsers) {
    const expectedByIdUser = expectedById.get(existingUser.id);
    const expectedByUsernameUser = expectedByUsername.get(existingUser.username);

    if (
      !expectedByIdUser ||
      !expectedByUsernameUser ||
      expectedByIdUser.id !== expectedByUsernameUser.id ||
      existingUser.username !== expectedByIdUser.username ||
      existingUser.createdBy !== legacySeedActorId
    ) {
      throw new Error(demoSeedAuthUserOwnershipConflictMessage);
    }
  }
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
  try {
    return assertDemoSeedAllowed(env);
  } catch {
    throw new Error(demoSeedProductionGuardMessage);
  }
}

/**
 * 旧 demo seed 写入口已关闭。
 *
 * 静态低敏 fixture 仍可供测试和只读预览使用；任何数据库写入必须经其事实 Owner 的独立命令
 * 边界。传入的 database 不得被读取，也不得通过 helper 或 raw SQL 恢复旧 Membership Writer。
 */
export async function seedDemoData(database: TenantDatabase): Promise<never> {
  void database;
  throw new Error(demoSeedDatabaseWriteDisabledMessage);
}

type SeedRuntimeDependencies = {
  createPostgresClient: (...args: never[]) => unknown;
  createDatabase: (...args: never[]) => unknown;
  seedDemoData: typeof seedDemoData;
};

export async function runSeed(
  env: NodeJS.ProcessEnv = process.env,
  dependencies?: SeedRuntimeDependencies,
): Promise<never> {
  void env;
  void dependencies;
  throw new Error(demoSeedDatabaseWriteDisabledMessage);
}

function isDirectRun() {
  return process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;
}

if (isDirectRun()) {
  runSeed().catch(() => {
    console.error('demo seed 执行失败');
    process.exit(1);
  });
}
