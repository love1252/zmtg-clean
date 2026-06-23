import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HospitalPage from '@/app/hospital/page';
import OpenPlatformPage from '@/app/open-platform/page';
import type { AuditEventListItem } from '@/modules/audit/domain/audit-event-query';
import type { AppointmentRecordSummary } from '@/modules/institution/domain/appointment-records';
import {
  buildCustomerTimelineResponse,
  type CustomerTimelineAuditSummary,
} from '@/modules/institution/domain/customer-timeline';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type { TenantFollowUpTask } from '@/modules/institution/domain/followup-workflow';
import {
  mapTreatmentSummaryRecordToListItem,
  type TreatmentSummaryRecord,
} from '@/modules/institution/domain/treatment-summaries';
import type { OpenPlatformTenantRecord } from '@/modules/open-platform/client/platform-tenant-management-client';
import {
  getDemoAppointmentSeedRecords,
  getDemoAuditEventSeedRecords,
  getDemoCustomerSeedRecords,
  getDemoFollowUpTaskSeedRecords,
  getDemoTenantPlanAssignmentSeedRecords,
  getDemoTenantPlanSeedRecords,
  getDemoTenantQuotaSnapshotSeedRecords,
  getDemoTenantSeedRecords,
  getDemoTreatmentSummarySeedRecords,
} from '@/server/db/seed-demo-data';

const customerRecord = {
  id: 'cust_phase5_closeout',
  tenantId: 'demo-tenant-001',
  displayName: 'Phase5 客户A',
  lifecycle: 'repurchase_window',
  priority: 'high',
  ownerUserId: 'consultant-phase5',
  projectInterest: 'Phase5 修复项目',
  maskedPhone: '138****1252',
  maskedMedicalRecordNo: 'MR****525',
  lastTouchSummary: 'Phase5 验收触达',
  nextAction: 'Phase5 收尾回访',
  tags: ['Phase5', '验收'],
};

const appointmentRecord = {
  id: 'appt_phase5_closeout',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_phase5_closeout',
  customerDisplayName: 'Phase5 客户A',
  project: 'Phase5 预约复诊',
  scheduledAt: '2026-06-01T10:30:00+08:00',
  consultantUserId: 'consultant-phase5',
  status: 'pending_confirmation',
  note: 'Phase5 验收预约',
};

const followUpRecord = {
  id: 'fu_phase5_closeout',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_phase5_closeout',
  customerDisplayName: 'Phase5 客户A',
  journeyId: 'journey_repurchase',
  stage: 'Phase5 D7 回访',
  status: 'due',
  dueAt: '2026-05-31T10:30:00+08:00',
  suggestedAction: 'Phase5 收尾人工回访',
  riskLevel: 'watch',
  updatedBy: null,
  updatedAt: null,
};

const postCareCustomerRecord = {
  ...customerRecord,
  id: 'cust_phase6_post_care',
  displayName: 'Phase6 客户B',
  lifecycle: 'post_care',
  priority: 'medium',
  projectInterest: 'Phase6 光电复诊',
  maskedPhone: '137****6606',
  maskedMedicalRecordNo: 'MR****606',
  lastTouchSummary: 'Phase6 术后反馈',
  nextAction: 'Phase6 客服回访',
  tags: ['Phase6', '术后'],
};

const rescheduleAppointmentRecord = {
  ...appointmentRecord,
  id: 'appt_phase6_reschedule',
  customerId: 'cust_phase6_post_care',
  customerDisplayName: 'Phase6 客户B',
  project: 'Phase6 改约复诊',
  scheduledAt: '2026-06-02T14:30:00+08:00',
  status: 'reschedule_requested',
  note: 'Phase6 需要协调档期',
};

const urgentFollowUpRecord = {
  ...followUpRecord,
  id: 'fu_phase6_urgent',
  customerId: 'cust_phase6_post_care',
  customerDisplayName: 'Phase6 客户B',
  stage: 'Phase6 D3 异常反馈',
  dueAt: '2026-05-31T09:30:00+08:00',
  suggestedAction: 'Phase6 客服优先回访',
  riskLevel: 'urgent',
};

const auditEventRecord = {
  id: 'audit_phase8_institution',
  tenantId: 'demo-tenant-001',
  resource: 'customer',
  resourceId: 'cust_phase5_closeout',
  action: 'update',
  result: 'allowed',
  reason: 'allowed_by_policy',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  occurredAt: '2026-05-31T09:00:00.000Z',
  sql: 'select * from audit_events',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase8_should_not_render',
};

const followUpPathAnalysisRecord = {
  scope: 'followup_path_operational_analysis_v1',
  analysisAt: '2026-06-03T08:00:00.000Z',
  templateSuggestionCount: 6,
  confirmedSourceTaskCount: 4,
  completedTaskCount: 2,
  overdueTaskCount: 1,
  voidedSummaryBlockedCount: 1,
  duplicateSourceTaskConflictCount: 1,
  notes: [
    '只统计 template_path_followup 模板建议。',
    '作废阻断和重复来源冲突仅来自可识别审计事件。',
  ],
  warnings: ['部分重复来源任务冲突审计未能通过 resourceId 关联到模板路径来源任务，未计入正式数量。'],
  dataSourceNote: '基于当前租户治疗摘要、模板驱动建议、来源随访任务和审计事件只读聚合。',
  boundaryNote: '仅返回聚合指标，不返回客户明细、任务列表、治疗正文或 raw audit payload。',
  tenantId: 'other-tenant',
  customerId: 'cust_phase21_sensitive',
  customerDisplayName: 'Phase21 客户明细不应展示',
  taskId: 'fu_phase21_sensitive',
  taskList: ['任务列表不应展示'],
  treatmentRecordBody: '完整治疗记录正文不应展示',
  medicalRecordBody: '完整病历正文不应展示',
  consultationTranscript: '咨询对话全文不应展示',
  imageFileOriginal: '图片文件原文不应展示',
  rawAuditPayload: 'requestBody 不应展示',
  sql: 'select * from follow_up_tasks',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase21_should_not_render',
  secret: 'phase21-secret',
};

const hisConnectionRecord = {
  connectionId: 'his_conn_active',
  connectionName: '星澜 HIS 只读连接',
  sourceSystem: 'his',
  vendorType: 'demo_vendor',
  systemType: 'his',
  status: 'active',
  credentialConfigured: true,
  healthStatus: 'healthy',
  lastCheckedAt: '2026-06-03T08:30:00.000Z',
  lastErrorCode: 'SAFE_TIMEOUT',
  createdAt: '2026-06-03T08:00:00.000Z',
  updatedAt: '2026-06-03T08:20:00.000Z',
  revokedAt: null,
  tenantId: 'tenant_should_not_render',
  deletedAt: '2026-06-03T09:00:00.000Z',
  credentialRef: 'cred_ref_internal_only',
  token: 'token_should_not_render',
  secret: 'secret_should_not_render',
  apiKey: 'sk_test_should_not_render',
  oauthToken: 'oauth_should_not_render',
  basicAuth: 'basic_auth_should_not_render',
  signingKey: 'signing_key_should_not_render',
  privateKey: 'private_key_should_not_render',
  connectionString: 'postgres://tenant:secret@localhost:5432/zmtg',
  rawHisPayload: 'raw HIS payload should not render',
  requestBody: '完整请求体不应展示',
  responseBody: '完整响应体不应展示',
  sql: 'select * from his_connections',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
};

const draftHisConnectionRecord = {
  ...hisConnectionRecord,
  connectionId: 'his_conn_draft',
  connectionName: '草稿 HIS 连接',
  status: 'draft',
  credentialConfigured: false,
  healthStatus: 'unknown',
  lastCheckedAt: null,
  lastErrorCode: null,
  createdAt: '2026-06-03T08:05:00.000Z',
  updatedAt: '2026-06-03T08:05:00.000Z',
};

const treatmentSummaryManagementRecord = {
  id: 'trt_phase14_management',
  customerId: 'cust_phase5_closeout',
  appointmentId: 'appt_phase5_closeout',
  treatmentDate: '2026-06-02T16:30:00+08:00',
  treatmentProject: 'Phase14 治疗摘要管理项目',
  treatmentCategory: 'phase14_skin_repair',
  treatmentStage: 'Phase14 D14 复诊',
  recoveryStage: 'Phase14 D14',
  riskLevel: 'watch',
  ownerUserId: 'doctor-phase14',
  summary: 'Phase14 结构化摘要：恢复稳定，安排补水。',
  nextCareAction: 'Phase14 D21 人工回访恢复阶段。',
  tags: ['Phase14 结构化摘要', '复诊'],
  createdAt: '2026-06-02T16:30:00+08:00',
  updatedAt: '2026-06-02T17:00:00+08:00',
  tenantId: 'demo-tenant-001',
  customerDisplayName: 'Phase14 客户明细不应展示',
  appointmentNote: 'Phase14 预约明细不应展示',
  followUpSuggestedAction: 'Phase14 随访明细不应展示',
  phoneNumber: '13800001252',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR202605310001',
  fullTreatmentRecord: '完整治疗记录正文不应展示',
  medicalRecordText: '完整病历正文不应展示',
  diagnosisText: '诊疗原文不应展示',
  consultationTranscript: '咨询对话全文不应展示',
  imageFileOriginal: '图片文件原文不应展示',
  aiGeneratedContent: 'AI 生成内容不应展示',
  externalSyncPayload: '外部系统同步原文不应展示',
  requestBody: { phoneNumber: '13800001252' },
  sql: 'select * from treatment_summaries',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase14_should_not_render',
  secret: 'phase14-raw-secret',
};

const filteredTreatmentSummaryManagementRecord = {
  ...treatmentSummaryManagementRecord,
  id: 'trt_phase14_filtered',
  customerId: 'cust_phase14_filtered',
  treatmentProject: 'Phase14 筛选后治疗摘要',
  treatmentCategory: 'phase14_filtered_repair',
  treatmentStage: 'Phase14 D21 复诊',
  recoveryStage: 'Phase14 D21',
  summary: 'Phase14 筛选摘要：风险已复核，继续观察。',
  nextCareAction: 'Phase14 D28 人工确认恢复状态。',
};

const nextTreatmentSummaryManagementRecord = {
  ...treatmentSummaryManagementRecord,
  id: 'trt_phase14_next_page',
  customerId: 'cust_phase14_next',
  appointmentId: null,
  treatmentProject: 'Phase14 下一页治疗摘要',
  treatmentCategory: 'phase14_next_repair',
  treatmentStage: 'Phase14 D28 复诊',
  recoveryStage: 'Phase14 D28',
  riskLevel: 'normal',
  summary: 'Phase14 下一页摘要：恢复稳定。',
  nextCareAction: 'Phase14 结束本轮人工观察。',
};

const editedTreatmentSummaryManagementRecord = {
  ...treatmentSummaryManagementRecord,
  treatmentDate: '2026-06-03T10:00:00+08:00',
  treatmentProject: 'Phase18 编辑后治疗摘要',
  treatmentCategory: 'phase18_safe_edit',
  treatmentStage: 'Phase18 D21 复诊',
  recoveryStage: 'Phase18 D21',
  riskLevel: 'normal',
  ownerUserId: 'doctor-phase18',
  summary: 'Phase18 编辑摘要：结构化字段已修正。',
  nextCareAction: 'Phase18 D28 人工确认恢复状态。',
  tags: ['Phase18 编辑', '安全字段'],
  appointmentId: 'appt_phase18_edit',
  updatedAt: '2026-06-03T10:05:00+08:00',
};

const voidedTreatmentSummaryManagementRecord = {
  ...treatmentSummaryManagementRecord,
  status: 'voided',
  voidedAt: '2026-06-02T19:00:00+08:00',
  voidedBy: 'demo-user-admin',
  voidReasonCode: 'duplicate_summary',
  voidReason: '重复录入，保留较新的治疗摘要',
  updatedAt: '2026-06-02T19:00:00+08:00',
};

const treatmentFollowUpSuggestion = {
  suggestionKey: 'trt_phase14_management:watch_risk_followup:3d',
  ruleKey: 'watch_risk_followup',
  title: 'Phase15 关注风险治疗后随访',
  description: '请安排人工随访，确认恢复反馈和护理执行情况。',
  recommendedDueAt: '2026-06-05T08:30:00.000Z',
  priority: 'medium',
  riskLevel: 'watch',
  sourceTreatmentSummaryId: 'trt_phase14_management',
  sourceCustomerId: 'cust_phase5_closeout',
  sourceAppointmentId: 'appt_phase5_closeout',
  tags: ['护理随访'],
  reason: 'riskLevel 为 watch，需要在观察周期内人工跟进',
  sourceFields: ['riskLevel', 'treatmentDate'],
};

const phase20PostSurgeryTemplateSuggestion = {
  suggestionKey:
    'trt_phase14_management:template_path_followup:1d:post_surgery_repair:post_surgery_d1_urgent',
  ruleKey: 'template_path_followup',
  title: '术后修复 D1 高风险人工处理',
  description: '请人工确认“术后修复 D1 高风险人工处理”。建议处理角色：运营负责人。禁止自动触达。',
  recommendedDueAt: '2026-06-03T08:30:00.000Z',
  priority: 'high',
  riskLevel: 'urgent',
  sourceTreatmentSummaryId: 'trt_phase14_management',
  sourceCustomerId: 'cust_phase5_closeout',
  sourceAppointmentId: 'appt_phase5_closeout',
  tags: ['路径模板', 'post_surgery_repair', 'D1', '运营负责人'],
  reason: '路径模板 post_surgery_repair 命中节点 post_surgery_d1_urgent，要求人工确认并禁止自动触达',
  sourceFields: [
    'treatmentCategory',
    'treatmentProject',
    'treatmentStage',
    'recoveryStage',
    'riskLevel',
    'treatmentDate',
    'tags',
  ],
};

const phase20TemplateFollowUpSuggestions = [
  {
    suggestionKey:
      'trt_phase14_management:template_path_followup:1d:photoelectric_care:photoelectric_d1_watch',
    ruleKey: 'template_path_followup',
    title: '光电治疗 D1 反应人工确认',
    description: '请人工确认“光电治疗 D1 反应人工确认”。建议处理角色：医助。禁止自动触达。',
    recommendedDueAt: '2026-06-03T08:30:00.000Z',
    priority: 'medium',
    riskLevel: 'watch',
    sourceTreatmentSummaryId: 'trt_phase14_management',
    sourceCustomerId: 'cust_phase5_closeout',
    sourceAppointmentId: 'appt_phase5_closeout',
    tags: ['路径模板', 'photoelectric_care', 'D1', '医助'],
    reason: '路径模板 photoelectric_care 命中节点 photoelectric_d1_watch，要求人工确认并禁止自动触达',
    sourceFields: [
      'treatmentCategory',
      'treatmentProject',
      'treatmentStage',
      'recoveryStage',
      'riskLevel',
      'treatmentDate',
      'tags',
    ],
  },
  {
    suggestionKey:
      'trt_phase14_management:template_path_followup:3d:hydro_injection_care:hydro_injection_d3_care',
    ruleKey: 'template_path_followup',
    title: '水光注射 D3 护理完成确认',
    description: '请人工确认“水光注射 D3 护理完成确认”。建议处理角色：客服。禁止自动触达。',
    recommendedDueAt: '2026-06-05T08:30:00.000Z',
    priority: 'medium',
    riskLevel: 'watch',
    sourceTreatmentSummaryId: 'trt_phase14_management',
    sourceCustomerId: 'cust_phase5_closeout',
    sourceAppointmentId: 'appt_phase5_closeout',
    tags: ['路径模板', 'hydro_injection_care', 'D3', '客服'],
    reason: '路径模板 hydro_injection_care 命中节点 hydro_injection_d3_care，要求人工确认并禁止自动触达',
    sourceFields: [
      'treatmentCategory',
      'treatmentProject',
      'treatmentStage',
      'recoveryStage',
      'riskLevel',
      'treatmentDate',
      'tags',
    ],
  },
  phase20PostSurgeryTemplateSuggestion,
  {
    suggestionKey:
      'trt_phase14_management:template_path_followup:14d:skin_management:skin_management_stable',
    ruleKey: 'template_path_followup',
    title: '皮肤管理稳定期复购前人工确认',
    description: '请人工确认“皮肤管理稳定期复购前人工确认”。建议处理角色：咨询师。禁止自动触达。',
    recommendedDueAt: '2026-06-16T08:30:00.000Z',
    priority: 'low',
    riskLevel: 'normal',
    sourceTreatmentSummaryId: 'trt_phase14_management',
    sourceCustomerId: 'cust_phase5_closeout',
    sourceAppointmentId: 'appt_phase5_closeout',
    tags: ['路径模板', 'skin_management', 'stable', '咨询师'],
    reason: '路径模板 skin_management 命中节点 skin_management_stable，要求人工确认并禁止自动触达',
    sourceFields: [
      'treatmentCategory',
      'treatmentProject',
      'treatmentStage',
      'recoveryStage',
      'riskLevel',
      'treatmentDate',
      'tags',
    ],
  },
];

const treatmentFollowUpCreatedTask = {
  id: 'fu_phase15_confirmed',
  customerId: 'cust_phase5_closeout',
  customerDisplayName: 'Phase15 客户不应展示',
  journeyId: 'treatment_followup_watch_risk_followup',
  stage: 'Phase15 关注风险治疗后随访',
  status: 'scheduled',
  dueAt: '2026-06-05T08:30:00.000Z',
  suggestedAction: '请安排人工随访，确认恢复反馈和护理执行情况。',
  riskLevel: 'watch',
  updatedBy: null,
  updatedAt: null,
  sourceTreatmentSummaryId: 'trt_phase14_management',
  sourceSuggestionKey: 'trt_phase14_management:watch_risk_followup:3d',
  phoneNumber: '13800001252',
  consultationTranscript: '咨询对话全文不应展示',
  sql: 'select * from follow_up_tasks',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase15_should_not_render',
  secret: 'phase15-raw-secret',
};

const phase20TemplateFollowUpCreatedTask = {
  ...treatmentFollowUpCreatedTask,
  id: 'fu_phase20_template_confirmed',
  journeyId: 'treatment_followup_template_path_followup',
  stage: '术后修复 D1 高风险人工处理',
  dueAt: '2026-06-03T08:30:00.000Z',
  suggestedAction: phase20PostSurgeryTemplateSuggestion.description,
  riskLevel: 'urgent',
  sourceSuggestionKey: phase20PostSurgeryTemplateSuggestion.suggestionKey,
};

const phase16SourceFollowUpTask = {
  ...treatmentFollowUpCreatedTask,
  id: 'fu_phase16_source_active',
  customerDisplayName: 'Phase16 来源客户',
  stage: 'Phase16 治疗摘要来源随访',
  status: 'in_progress',
  source: 'treatment_summary',
  sourceTreatmentSummaryId: 'trt_phase14_management',
  sourceSuggestionKey: 'trt_phase14_management:watch_risk_followup:3d',
  medicalRecordNo: 'MR202605310001',
  fullTreatmentRecord: '完整治疗记录正文不应展示',
  medicalRecordText: '完整病历正文不应展示',
  diagnosisText: '诊疗原文不应展示',
  imageFileOriginal: '图片文件原文不应展示',
  aiGeneratedContent: 'AI 生成内容不应展示',
  externalSyncPayload: '外部系统同步原文不应展示',
};

const platformAuditEventRecord = {
  id: 'audit_phase8_platform',
  tenantId: 'demo-tenant-001',
  resource: 'customer',
  resourceId: 'cust_phase5_closeout',
  action: 'update',
  result: 'allowed',
  reason: 'allowed_by_policy',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  occurredAt: '2026-05-31T09:00:00.000Z',
  requestBody: { phoneNumber: '13800001252' },
  metadata: { sql: 'select * from audit_events' },
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase8_platform_should_not_render',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR202605310001',
  treatmentRecord: '完整治疗记录正文不应展示',
  consultationTranscript: '咨询对话全文不应展示',
};

const platformTenantRecord = {
  tenantId: 'demo-tenant-001',
  tenantName: '智美天工演示机构',
  tenantStatus: 'active',
  createdAt: '2026-05-30T00:00:00.000Z',
  updatedAt: '2026-05-31T00:00:00.000Z',
  planName: '成长版',
  planCode: 'growth-care',
  planStatus: 'active',
  assignmentStatus: 'active',
  startedAt: '2026-05-31T00:00:00.000Z',
  expiresAt: null,
  maxCustomers: 5000,
  maxAppointments: 2000,
  maxFollowUps: 10000,
  maxAiCalls: 50000,
  currentCustomers: 24,
  currentAppointments: 12,
  currentFollowUps: 36,
  currentAiCalls: 0,
  snapshotAt: '2026-05-31T08:00:00.000Z',
  customers: [{ phoneNumber: '13800001252' }],
  appointments: [{ customerId: 'cust_phase5_closeout' }],
  followUpTasks: [{ customerId: 'cust_phase5_closeout' }],
  treatmentRecord: '完整治疗记录正文不应展示',
  consultationTranscript: '咨询对话全文不应展示',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR202605310001',
  sql: 'select * from tenant_plans',
  requestBody: { phoneNumber: '13800001252' },
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase9_platform_should_not_render',
  secret: 'phase9-raw-secret',
};

const platformCommercialRiskTenant = {
  ...platformTenantRecord,
  tenantId: 'tenant_phase11_risk',
  tenantName: 'Phase11 配额风险机构',
  maxCustomers: 100,
  currentCustomers: 88,
  snapshotAt: '2026-05-31T10:00:00.000Z',
};

const platformCommercialMissingTenant = {
  ...platformTenantRecord,
  tenantId: 'tenant_phase11_missing',
  tenantName: 'Phase11 配置缺失机构',
  planName: null,
  planCode: null,
  planStatus: null,
  assignmentStatus: null,
  startedAt: null,
  expiresAt: null,
  maxCustomers: null,
  maxAppointments: null,
  maxFollowUps: null,
  maxAiCalls: null,
  currentCustomers: null,
  currentAppointments: null,
  currentFollowUps: null,
  currentAiCalls: null,
  snapshotAt: null,
};

const platformQuotaDeniedAuditEventRecord = {
  ...platformAuditEventRecord,
  id: 'audit_phase11_quota_denied',
  tenantId: 'tenant_phase11_risk',
  resource: 'customer',
  resourceId: 'cust_phase11_raw_should_not_render',
  action: 'create',
  result: 'denied',
  reason: 'quota_exceeded_customers',
  occurredAt: '2026-05-31T10:30:00.000Z',
  requestBody: { phoneNumber: '13800001252' },
  metadata: { sql: 'select * from tenant_quota_snapshots' },
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase11_platform_should_not_render',
  secret: 'phase11-raw-secret',
};

const customerTimelineResponse = {
  customer: {
    id: 'cust_phase5_closeout',
    displayName: 'Phase5 客户A',
    lifecycle: 'repurchase_window',
    priority: 'high',
    projectInterest: 'Phase5 修复项目',
    maskedPhone: '138****1252',
    maskedMedicalRecordNo: 'MR****525',
    ownerUserId: 'consultant-phase5',
    tags: ['Phase5', '验收'],
    lastTouchSummary: 'Phase5 验收触达',
    nextAction: 'Phase5 收尾回访',
    phoneNumber: '13800001252',
    idNumber: '110101199001010011',
    medicalRecordNo: 'MR202605310001',
  },
  appointments: [
    {
      id: 'appt_phase5_closeout',
      project: 'Phase5 预约复诊',
      scheduledAt: '2026-06-01T10:30:00+08:00',
      consultantUserId: 'consultant-phase5',
      status: 'pending_confirmation',
      note: 'Phase5 验收预约',
      treatmentRecord: '完整治疗记录正文不应展示',
    },
  ],
  followups: [
    {
      id: 'fu_phase5_closeout',
      journeyId: 'journey_repurchase',
      stage: 'Phase5 D7 回访',
      status: 'due',
      dueAt: '2026-05-31T10:30:00+08:00',
      suggestedAction: 'Phase5 收尾人工回访',
      riskLevel: 'watch',
      updatedBy: null,
      updatedAt: null,
      consultationTranscript: '咨询对话全文不应展示',
    },
  ],
  treatmentSummaries: [
    {
      id: 'trt_phase12_closeout',
      appointmentId: 'appt_phase5_closeout',
      treatmentDate: '2026-06-01T12:10:00+08:00',
      treatmentProject: 'Phase12 光电修复',
      treatmentCategory: 'phase12_laser_repair',
      treatmentStage: 'Phase12 D7 复诊',
      recoveryStage: 'Phase12 D7',
      riskLevel: 'watch',
      ownerUserId: 'doctor-phase12',
      summary: 'Phase12 结构化摘要：恢复稳定，安排补水护理。',
      nextCareAction: 'Phase12 D14 人工回访恢复阶段。',
      tags: ['Phase12 结构化摘要', '术后关怀'],
      createdAt: '2026-06-01T12:10:00+08:00',
      updatedAt: '2026-06-01T12:10:00+08:00',
      phoneNumber: '13800001252',
      idNumber: '110101199001010011',
      medicalRecordNo: 'MR202605310001',
      treatmentRecord: '完整治疗记录正文不应展示',
      medicalRecordBody: '完整病历正文不应展示',
      diagnosisText: '诊疗原文不应展示',
      consultationTranscript: '咨询对话全文不应展示',
      imageFileOriginal: '图片文件原文不应展示',
      aiGeneratedContent: 'AI 生成内容不应展示',
      externalSyncPayload: '外部系统同步原文不应展示',
      requestBody: { phoneNumber: '13800001252' },
      sql: 'select * from treatment_summaries',
      stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_phase12_should_not_render',
      secret: 'phase12-raw-secret',
    },
  ],
  auditEvents: [
    {
      id: 'audit_phase7_smoke',
      action: 'read',
      result: 'allowed',
      reason: 'allowed_by_policy',
      actor: { id: 'demo-user-admin', role: 'tenant_admin' },
      occurredAt: '2026-06-03T09:00:00.000Z',
      resource: 'customer',
      resourceId: 'cust_phase5_closeout',
      sql: 'select * from audit_events',
      stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_phase7_should_not_render',
    },
  ],
  timeline: [
    {
      id: 'audit:audit_phase7_smoke',
      type: 'audit',
      occurredAt: '2026-06-03T09:00:00.000Z',
      title: '审计：read',
      summary: 'allowed / allowed_by_policy',
      status: 'allowed',
      source: 'customer',
      relatedRecordId: 'cust_phase5_closeout',
    },
    {
      id: 'appointment:appt_phase5_closeout',
      type: 'appointment',
      occurredAt: '2026-06-01T10:30:00+08:00',
      title: 'Phase5 预约复诊预约',
      summary: 'Phase5 验收预约',
      status: 'pending_confirmation',
      source: 'appointment',
      relatedRecordId: 'appt_phase5_closeout',
    },
    {
      id: 'treatment_summary:trt_phase12_closeout',
      type: 'treatment_summary',
      occurredAt: '2026-06-01T12:10:00+08:00',
      title: 'Phase12 光电修复 · Phase12 D7 复诊',
      summary: 'Phase12 结构化摘要：恢复稳定，安排补水护理。',
      status: 'watch',
      source: 'treatment_summary',
      relatedRecordId: 'trt_phase12_closeout',
      riskLevel: 'watch',
      tags: ['Phase12 结构化摘要', '术后关怀'],
      treatmentRecord: '完整治疗记录正文不应展示',
      medicalRecordBody: '完整病历正文不应展示',
      diagnosisText: '诊疗原文不应展示',
      consultationTranscript: '咨询对话全文不应展示',
      imageFileOriginal: '图片文件原文不应展示',
      aiGeneratedContent: 'AI 生成内容不应展示',
      externalSyncPayload: '外部系统同步原文不应展示',
      requestBody: { phoneNumber: '13800001252' },
      sql: 'select * from treatment_summaries',
      stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_phase12_should_not_render',
      secret: 'phase12-raw-secret',
    },
    {
      id: 'follow_up:fu_phase5_closeout',
      type: 'follow_up',
      occurredAt: '2026-05-31T10:30:00+08:00',
      title: 'Phase5 D7 回访',
      summary: 'Phase5 收尾人工回访',
      status: 'due',
      source: 'follow_up',
      relatedRecordId: 'fu_phase5_closeout',
    },
  ],
};

const phase13CreatedTreatmentSummary = {
  id: 'trt_phase13_closeout',
  appointmentId: 'appt_phase5_closeout',
  treatmentDate: '2026-06-02T16:30:00+08:00',
  treatmentProject: 'Phase13 水光补水复诊',
  treatmentCategory: 'phase13_skin_repair',
  treatmentStage: 'Phase13 D14 复诊',
  recoveryStage: 'Phase13 D14',
  riskLevel: 'watch',
  ownerUserId: 'doctor-phase13',
  summary: 'Phase13 结构化摘要：恢复稳定，安排补水。',
  nextCareAction: 'Phase13 D21 人工回访恢复阶段。',
  tags: ['Phase13 结构化摘要', '复诊'],
  createdAt: '2026-06-02T16:30:00+08:00',
  updatedAt: '2026-06-02T16:30:00+08:00',
};

const customerTimelineAfterPhase13Create = {
  ...customerTimelineResponse,
  treatmentSummaries: [
    {
      ...phase13CreatedTreatmentSummary,
      phoneNumber: '13800001252',
      idNumber: '110101199001010011',
      rawMedicalRecordNo: 'MR202605310001',
      fullTreatmentRecord: '完整治疗记录正文不应展示',
      medicalRecordText: '完整病历正文不应展示',
      consultationTranscript: '咨询对话全文不应展示',
      imageUrl: 'https://example.test/raw-image.png',
      fileUrl: 'https://example.test/raw-file.pdf',
      aiGeneratedContent: 'AI 生成内容不应展示',
      externalSystemPayload: { raw: true },
      sql: 'select * from treatment_summaries',
      stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_phase13_should_not_render',
      secret: 'phase13-raw-secret',
    },
    ...customerTimelineResponse.treatmentSummaries,
  ],
  timeline: [
    {
      id: 'treatment_summary:trt_phase13_closeout',
      type: 'treatment_summary',
      occurredAt: '2026-06-02T16:30:00+08:00',
      title: 'Phase13 水光补水复诊 · Phase13 D14 复诊',
      summary: 'Phase13 结构化摘要：恢复稳定，安排补水。',
      status: 'watch',
      source: 'treatment_summary',
      relatedRecordId: 'trt_phase13_closeout',
      riskLevel: 'watch',
      tags: ['Phase13 结构化摘要', '复诊'],
      fullTreatmentRecord: '完整治疗记录正文不应展示',
      medicalRecordText: '完整病历正文不应展示',
      consultationTranscript: '咨询对话全文不应展示',
      sql: 'select * from treatment_summaries',
      stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_phase13_should_not_render',
      secret: 'phase13-raw-secret',
    },
    ...customerTimelineResponse.timeline,
  ],
};

const customerTimelineWithVoidedTreatmentSummary = {
  ...customerTimelineResponse,
  treatmentSummaries: [
    {
      ...customerTimelineResponse.treatmentSummaries[0],
      id: 'trt_phase19_timeline_voided',
      treatmentProject: 'Phase19 作废时间线摘要',
      treatmentStage: 'Phase19 D7 复核',
      summary: 'Phase19 作废摘要：仅保留历史追溯。',
      nextCareAction: '不再基于该摘要生成随访建议。',
      tags: ['已作废', 'Phase19 作废治理'],
      status: 'voided',
      voidedAt: '2026-06-02T19:00:00+08:00',
      voidedBy: 'demo-user-admin',
      voidReasonCode: 'duplicate_summary',
      voidReason: '重复录入，保留较新的治疗摘要',
      phoneNumber: '13800001252',
      idNumber: '110101199001010011',
      medicalRecordNo: 'MR202605310001',
      fullTreatmentRecord: '完整治疗记录正文不应展示',
      medicalRecordText: '完整病历正文不应展示',
      diagnosisText: '诊疗原文不应展示',
      consultationTranscript: '咨询对话全文不应展示',
      imageFileOriginal: '图片文件原文不应展示',
      aiGeneratedContent: 'AI 生成内容不应展示',
      externalSyncPayload: '外部系统同步原文不应展示',
      sql: 'select * from treatment_summaries',
      stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_phase19_timeline_should_not_render',
      secret: 'phase19-timeline-secret',
    },
  ],
  timeline: [
    {
      id: 'treatment_summary:trt_phase19_timeline_voided',
      type: 'treatment_summary',
      occurredAt: '2026-06-02T19:00:00+08:00',
      title: 'Phase19 作废时间线摘要 · Phase19 D7 复核',
      summary: 'Phase19 作废摘要：仅保留历史追溯。',
      status: 'voided',
      source: 'treatment_summary',
      relatedRecordId: 'trt_phase19_timeline_voided',
      riskLevel: 'watch',
      tags: ['已作废', 'Phase19 作废治理'],
      fullTreatmentRecord: '完整治疗记录正文不应展示',
      medicalRecordText: '完整病历正文不应展示',
      diagnosisText: '诊疗原文不应展示',
      consultationTranscript: '咨询对话全文不应展示',
      imageFileOriginal: '图片文件原文不应展示',
      aiGeneratedContent: 'AI 生成内容不应展示',
      externalSyncPayload: '外部系统同步原文不应展示',
      sql: 'select * from treatment_summaries',
      stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_phase19_timeline_should_not_render',
      secret: 'phase19-timeline-secret',
    },
    ...customerTimelineResponse.timeline.filter((event) => event.type !== 'treatment_summary'),
  ],
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

function fetchPath(input: Parameters<typeof fetch>[0]) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

type KnowledgeBaseDemoReadonlyMockStatus = 'disabled' | 'denied' | 'empty' | 'ready';

function buildKnowledgeBaseDemoReadonlyMockResponse(status: KnowledgeBaseDemoReadonlyMockStatus) {
  const hasContent = status === 'ready';
  const statusTextByStatus = {
    disabled: 'disabled / skipped',
    denied: 'denied / denied',
    empty: 'empty / empty',
    ready: 'ready / readonly',
  } satisfies Record<KnowledgeBaseDemoReadonlyMockStatus, string>;
  const descriptionByStatus = {
    disabled: '该知识库只读入口API 暂未开启',
    denied: '当前账号没有访问知识库只读入口API 的权限',
    empty: '暂无可展示知识库只读入口内容',
    ready: '知识库只读入口API 可用于低敏只读预览',
  } satisfies Record<KnowledgeBaseDemoReadonlyMockStatus, string>;

  return {
    requestId: `mock-demo-readonly-${status}`,
    tenantId: 'demo-tenant-a',
    institutionId: 'demo-inst-a',
    workspaceId: 'demo-workspace-a',
    status,
    summary: {
      title: '知识库只读入口API 契约',
      statusText: statusTextByStatus[status],
      description: descriptionByStatus[status],
    },
    categories: hasContent
      ? [
          {
            categoryId: 'platform-knowledge-base',
            label: '平台知识库',
            summary: 'platform:1 / published:1 / draft:0 / archived:0 / disabled:0',
            readonly: true,
          },
          {
            categoryId: 'institution-knowledge-base',
            label: '机构知识库',
            summary: 'institution:1 / published:0 / draft:1 / archived:0 / disabled:0',
            readonly: true,
          },
        ]
      : [],
    folders: hasContent
      ? [
          {
            folderId: 'catalog-summary',
            label: '目录总览',
            summary: '平台知识库 / FAQ；机构知识库 / FAQ',
            readonly: true,
          },
          {
            folderId: 'visibility-summary',
            label: '可见范围',
            summary: 'specified_institution:demo-inst-a；institution_private:demo-inst-a',
            readonly: true,
          },
        ]
      : [],
    knowledgeItems: hasContent
      ? [
          {
            itemId: 'publish-status-summary',
            title: '发布状态总览',
            summary: 'published:1 / draft:1',
            status,
            readonly: true,
          },
          {
            itemId: 'version-summary',
            title: '版本总览',
            summary: 'v1；v2-review',
            status,
            readonly: true,
          },
          {
            itemId: 'audit-summary',
            title: '审计总览',
            summary: 'approved:1 / pending:1',
            status,
            readonly: true,
          },
        ]
      : [],
    taskRecords: [
      {
        recordId: `demo-readonly-facade-${status}`,
        status: hasContent ? 'ready' : status,
        title: '知识库只读入口facade',
        failureReason: hasContent ? 'not_available' : descriptionByStatus[status],
        readonly: true,
      },
    ],
    searchPreview: {
      mode: 'readonly_preview',
      query: '知识库只读预览',
      resultCount: hasContent ? 2 : 0,
      results: hasContent
        ? [
            {
              previewId: 'platform-knowledge-base-preview',
              title: '平台知识库 只读 预览',
              snippet: 'platform:1 / published:1 / draft:0 / archived:0 / disabled:0',
              sourceKind: 'demo',
              readonly: true,
            },
            {
              previewId: 'institution-knowledge-base-preview',
              title: '机构知识库 开发数据 预览',
              snippet: 'institution:1 / published:0 / draft:1 / archived:0 / disabled:0',
              sourceKind: 'seed',
              readonly: true,
            },
          ]
        : [],
      readonly: true,
    },
    facade: {
      status,
      facadeStatus: status,
      governanceSummary: hasContent ? '治理总览：ready demo readonly' : 'not_available',
      demoSourceSummary: hasContent ? 'demo source ready' : 'not_available',
      readonly: true,
    },
    riskFlags: hasContent ? ['none'] : [],
    recommendedReadonlyActions: hasContent ? ['review_demo_readonly_summary'] : [],
    readonly: true,
  };
}

type WorkspaceDashboardReadonlyAggregationMockStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'partial'
  | 'stale'
  | 'ready';

function buildWorkspaceDashboardReadonlyAggregationMockResponse(
  status: WorkspaceDashboardReadonlyAggregationMockStatus,
) {
  const hasContent = status === 'partial' || status === 'stale' || status === 'ready';
  const statusTextByStatus = {
    disabled: 'disabled / skipped',
    denied: 'denied / denied',
    empty: 'empty / empty',
    partial: 'partial / partial',
    stale: 'stale / stale',
    ready: 'ready / readonly',
  } satisfies Record<WorkspaceDashboardReadonlyAggregationMockStatus, string>;
  const dashboardStatusByStatus = {
    disabled: 'disabled',
    denied: 'denied',
    empty: 'empty',
    partial: 'partial',
    stale: 'stale',
    ready: 'ready',
  } satisfies Record<WorkspaceDashboardReadonlyAggregationMockStatus, string>;
  const descriptionByStatus = {
    disabled: '该 workspace dashboard 只读聚合能力暂未开启',
    denied: '当前账号没有访问权限',
    empty: '暂无可展示 workspace dashboard 只读聚合',
    partial: 'workspace dashboard 部分来源不完整，仅展示可用只读摘要',
    stale: 'workspace dashboard 只读聚合可能已过期',
    ready: 'workspace dashboard 只读聚合可用于 demo 摘要展示',
  } satisfies Record<WorkspaceDashboardReadonlyAggregationMockStatus, string>;
  const sectionSummary = hasContent ? 'ready / items:2 / blocked:1 / exception:0' : 'not_available';
  const knowledgeSummary =
    status === 'partial'
      ? 'partial / audit_source_missing,reviewing_version_present'
      : status === 'stale'
        ? 'stale / reviewing_version_present,stale_audit_present'
        : hasContent
          ? 'ready / reviewing_version_present'
          : 'not_available';
  const readonlyPolicySummary = hasContent ? 'ready / readonly' : 'not_available';
  const riskFlags = hasContent
    ? ['business_loop_blocked', 'management_config_blocked', 'reviewing_version_present']
    : [];
  const recommendedReadonlyActions = hasContent
    ? [
        'review_business_loop_blockers_readonly',
        'review_management_config_blockers_readonly',
        'review_knowledge_governance_risks_readonly',
      ]
    : [];

  return {
    requestId: `mock-workspace-dashboard-readonly-${status}`,
    tenantId: 'demo-tenant-a',
    institutionId: 'demo-inst-a',
    workspaceId: 'demo-workspace-a',
    status,
    dashboardStatus: dashboardStatusByStatus[status],
    summary: {
      title: 'workspace dashboard readonly aggregation API 契约',
      statusText: statusTextByStatus[status],
      description: descriptionByStatus[status],
    },
    businessLoop: {
      sectionId: 'business-loop',
      label: '业务闭环只读聚合',
      summary: sectionSummary,
      readonly: true,
    },
    managementConfig: {
      sectionId: 'management-config',
      label: '管理配置只读聚合',
      summary: hasContent ? 'ready / items:2 / blocked:1 / missing:0' : 'not_available',
      readonly: true,
    },
    knowledgeGovernance: {
      sectionId: 'knowledge-governance',
      label: '知识库治理只读聚合',
      summary: knowledgeSummary,
      readonly: true,
    },
    readonlyPolicy: {
      sectionId: 'readonly-policy',
      label: '只读策略与低敏白名单',
      summary: readonlyPolicySummary,
      readonly: true,
    },
    taskRecords: [
      {
        recordId: `workspace-dashboard-readonly-aggregation-${status}`,
        status: hasContent ? status : status === 'disabled' ? 'skipped' : status === 'denied' ? 'blocked' : 'empty',
        title: 'workspace dashboard readonly aggregation',
        failureReason: hasContent ? 'not_available' : descriptionByStatus[status],
        readonly: true,
      },
    ],
    aggregation: {
      status,
      reasonCode:
        status === 'ready'
          ? 'workspace_dashboard_readonly_aggregation_ready'
          : status === 'partial'
            ? 'workspace_dashboard_readonly_aggregation_partial'
            : status === 'stale'
              ? 'workspace_dashboard_readonly_aggregation_stale'
              : status === 'empty'
                ? 'no_workspace_dashboard_readonly_candidates'
                : status === 'denied'
                  ? 'permission_denied'
                  : 'feature_flag_disabled',
      resultCode:
        status === 'ready'
          ? 'readonly'
          : status === 'partial'
            ? 'partial'
            : status === 'stale'
              ? 'stale'
              : status === 'denied'
                ? 'denied'
                : status === 'empty'
                  ? 'empty'
                  : 'skipped',
      dashboardStatus: dashboardStatusByStatus[status],
      businessLoopSummary: sectionSummary,
      managementConfigSummary: hasContent ? 'ready / items:2 / blocked:1 / missing:0' : 'not_available',
      knowledgeGovernanceSummary: knowledgeSummary,
      fieldWhitelistSummary: hasContent ? 'ready / unknown:0 / forbidden:0' : 'not_available',
      readonlyFeaturePolicySummary: readonlyPolicySummary,
      readonly: true,
    },
    riskFlags,
    recommendedReadonlyActions,
    readonly: true,
  };
}

function buildWorkspaceDashboardReadonlyAggregationUnsafeMockResponse() {
  const response = buildWorkspaceDashboardReadonlyAggregationMockResponse('ready');

  return {
    ...response,
    summary: {
      ...response.summary,
      description: 'raw payload token secret credential HIS 真实客户 模型 embedding vector retrieval',
    },
    businessLoop: {
      ...response.businessLoop,
      summary: '创建任务 预约 触达 营销 成交 支付 合同 发票',
    },
    managementConfig: {
      ...response.managementConfig,
      summary: 'upload parse chunk runtime worker stack',
    },
    knowledgeGovernance: {
      ...response.knowledgeGovernance,
      summary: '真实客户姓名 张三 手机号 13800001252',
    },
    readonlyPolicy: {
      ...response.readonlyPolicy,
      summary: 'credential token secret',
    },
    taskRecords: [
      {
        recordId: 'workspace-dashboard-readonly-aggregation-ready',
        status: 'ready',
        title: '创建任务 预约 触达 营销 成交',
        failureReason: 'worker stack /tmp/demo dependency error',
        readonly: true,
      },
    ],
    riskFlags: ['raw_payload_present', 'token_secret_present'],
    recommendedReadonlyActions: ['createTask', 'autoMarketing', 'payment_contract_invoice'],
  };
}

function buildKnowledgeBaseDemoReadonlyUnsafeMockResponse() {
  const response = buildKnowledgeBaseDemoReadonlyMockResponse('ready');

  return {
    ...response,
    summary: {
      ...response.summary,
      title: '真实客户姓名 张三 知识库',
      description: 'raw HIS payload credentialRef 模型输出 支付已完成 合同已完成 发票已完成',
    },
    categories: [
      {
        categoryId: 'platform-knowledge-base',
        label: '真实客户标签 张三',
        summary: '手机号 13800001252 身份证 110101199001010011',
        readonly: true,
      },
    ],
    folders: [
      {
        folderId: 'catalog-summary',
        label: 'HIS 原始目录',
        summary: 'credential token secret apiKey',
        readonly: true,
      },
    ],
    knowledgeItems: [
      {
        itemId: 'publish-status-summary',
        title: '模型输出摘要',
        summary: 'embedding vector retrieval 真实检索召回',
        status: 'ready',
        readonly: true,
      },
    ],
    taskRecords: [
      {
        recordId: 'demo-readonly-facade-ready',
        status: 'ready',
        title: '创建任务 预约 触达 营销 成交',
        failureReason: 'worker stack /tmp/demo dependency error',
        readonly: true,
      },
    ],
    searchPreview: {
      ...response.searchPreview,
      query: 'AI 问答入口 retrieval',
      results: [
        {
          previewId: 'platform-knowledge-base-preview',
          title: '真实知识正文',
          snippet: '完整病历正文 embedding vector retrieval',
          sourceKind: 'demo',
          readonly: true,
        },
      ],
    },
  };
}

const readonlyDashboardDemoForbiddenFragments = [
  '上传',
  '编辑',
  '删除',
  '发布',
  '下架',
  '回滚',
  '创建任务',
  '预约',
  '触达',
  '营销',
  '成交',
  '支付',
  '合同',
  '发票',
  'raw',
  'payload',
  'token',
  'secret',
  'credential',
  'HIS',
  '真实客户',
  '模型',
] as const;

const knowledgeBaseSearchReadyResponse = {
  status: 'ready',
  readonly: true,
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
  query: '水光 护理',
  mode: 'demo_search_mock_embedding',
  resultCount: 2,
  results: [
    {
      resultId: 'kb-search-result-hydro-care',
      chunkId: 'kb-chunk-hydro-care',
      documentId: 'kb-document-hydro-care',
      title: '水光术后护理 只读 知识',
      snippet: 'chunk:0 / chars:128',
      scoreBand: 'high',
      sourceKind: 'demo',
      chunkIndex: 0,
      readonly: true,
    },
    {
      resultId: 'kb-search-result-photoelectric-care',
      chunkId: 'kb-chunk-photoelectric-care',
      documentId: 'kb-document-photoelectric-care',
      title: '光电治疗恢复 开发数据 知识',
      snippet: 'chunk:1 / chars:96',
      scoreBand: 'medium',
      sourceKind: 'seed',
      chunkIndex: 1,
      readonly: true,
    },
  ],
} as const;

type WorkspaceTreatmentSummaryPage = {
  records: unknown[];
  pageInfo: unknown;
};

type WorkspaceFetchOptions = {
  role?: 'tenant_admin' | 'platform_admin';
  customers?: unknown[];
  appointments?: unknown[];
  followups?: unknown[];
  followUpSourceResponses?: Record<string, unknown[]>;
  treatmentSummaries?: unknown[];
  treatmentSummaryPageInfo?: unknown;
  treatmentSummaryPages?: WorkspaceTreatmentSummaryPage[];
  auditEvents?: unknown[];
  followUpPathAnalysis?: unknown;
  followUpPathAnalysisError?: {
    status: number;
    message: string;
  };
  hisConnections?: unknown[];
  hisConnectionDetails?: Record<string, unknown>;
  hisConnectionListError?: {
    status: number;
    message: string;
  };
  hisConnectionDetailError?: {
    status: number;
    message: string;
  };
  platformAuditEvents?: unknown[];
  platformTenants?: unknown[];
  platformTenantError?: {
    status: number;
    message: string;
  };
  knowledgeBaseDemoReadonlyResponse?: unknown;
  knowledgeBaseDemoReadonlyError?: {
    status: number;
    message: string;
  };
  knowledgeBaseDemoReadonlyPending?: boolean;
  knowledgeBaseSearchResponse?: unknown;
  knowledgeBaseSearchError?: {
    status: number;
    message: string;
  };
  knowledgeBaseSearchPending?: boolean;
  workspaceDashboardReadonlyAggregationResponse?: unknown;
  workspaceDashboardReadonlyAggregationError?: {
    status: number;
    message: string;
  };
  workspaceDashboardReadonlyAggregationPending?: boolean;
  timeline?: unknown;
  treatmentSummaryRecord?: unknown;
  treatmentSummaryMutationError?: {
    status: number;
    message: string;
  };
  treatmentSummaryUpdateRecord?: unknown;
  treatmentSummaryUpdateError?: {
    status: number;
    message: string;
  };
  treatmentSummaryVoidRecord?: unknown;
  followUpSuggestions?: unknown[];
  followUpTaskRecord?: unknown;
  followUpTaskError?: {
    status: number;
    message: string;
  };
  institutionError?: {
      path:
      | '/api/institution/customers'
      | '/api/institution/appointments'
      | '/api/institution/followups'
      | '/api/institution/follow-up-path-analysis'
      | '/api/institution/audit-events';
    status: number;
    message: string;
  };
  institutionMutationError?: {
    path: '/api/institution/customers' | '/api/institution/appointments';
    status: number;
    message: string;
  };
};

function mockWorkspaceFetch(options: WorkspaceFetchOptions = {}) {
  const {
    role = 'tenant_admin',
    customers = [customerRecord, postCareCustomerRecord],
    appointments = [appointmentRecord, rescheduleAppointmentRecord],
    followups = [urgentFollowUpRecord, { ...followUpRecord, status: 'scheduled' }],
    followUpSourceResponses,
    treatmentSummaries = [treatmentSummaryManagementRecord],
    treatmentSummaryPageInfo = {
      hasMore: false,
      limit: 50,
      nextCursor: null,
    },
    treatmentSummaryPages,
    auditEvents = [auditEventRecord],
    followUpPathAnalysis = followUpPathAnalysisRecord,
    followUpPathAnalysisError,
    hisConnections = [hisConnectionRecord, draftHisConnectionRecord],
    hisConnectionDetails,
    hisConnectionListError,
    hisConnectionDetailError,
    platformAuditEvents = [platformAuditEventRecord],
    platformTenants = [platformTenantRecord],
    platformTenantError,
    knowledgeBaseDemoReadonlyResponse = buildKnowledgeBaseDemoReadonlyMockResponse('ready'),
    knowledgeBaseDemoReadonlyError,
    knowledgeBaseDemoReadonlyPending = false,
    knowledgeBaseSearchResponse = knowledgeBaseSearchReadyResponse,
    knowledgeBaseSearchError,
    knowledgeBaseSearchPending = false,
    workspaceDashboardReadonlyAggregationResponse =
      buildWorkspaceDashboardReadonlyAggregationMockResponse('ready'),
    workspaceDashboardReadonlyAggregationError,
    workspaceDashboardReadonlyAggregationPending = false,
    timeline = customerTimelineResponse,
    treatmentSummaryRecord = phase13CreatedTreatmentSummary,
    treatmentSummaryMutationError,
    treatmentSummaryUpdateRecord = editedTreatmentSummaryManagementRecord,
    treatmentSummaryUpdateError,
    treatmentSummaryVoidRecord = voidedTreatmentSummaryManagementRecord,
    followUpSuggestions = [treatmentFollowUpSuggestion],
    followUpTaskRecord = treatmentFollowUpCreatedTask,
    followUpTaskError,
    institutionError,
    institutionMutationError,
  } = options;
  const timelineQueue = Array.isArray(timeline) ? [...timeline] : [timeline];
  const fallbackTimeline = timelineQueue[timelineQueue.length - 1] ?? timeline;
  const treatmentSummaryPageQueue = treatmentSummaryPages ? [...treatmentSummaryPages] : null;
  let didReadFollowUpSuggestions = false;
  const fallbackTreatmentSummaryPage = treatmentSummaryPageQueue?.[
    treatmentSummaryPageQueue.length - 1
  ] ?? {
    records: treatmentSummaries,
    pageInfo: treatmentSummaryPageInfo,
  };

  const fetchMock = vi.fn(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const path = fetchPath(input);
      const method = init?.method ?? 'GET';

      if (path === '/api/auth/session') {
        return jsonResponse({ authenticated: true, user: { role } });
      }

      if (path === '/api/v1/knowledge-base/demo-readonly') {
        if (knowledgeBaseDemoReadonlyPending) {
          return new Promise<Response>(() => {});
        }

        if (knowledgeBaseDemoReadonlyError) {
          return jsonResponse(
            { error: knowledgeBaseDemoReadonlyError.message },
            { status: knowledgeBaseDemoReadonlyError.status },
          );
        }

        return jsonResponse(knowledgeBaseDemoReadonlyResponse);
      }

      if (path.startsWith('/api/v1/knowledge-base/runtime/search')) {
        if (knowledgeBaseSearchPending) {
          return new Promise<Response>(() => {});
        }

        if (knowledgeBaseSearchError) {
          return jsonResponse(
            { error: knowledgeBaseSearchError.message },
            { status: knowledgeBaseSearchError.status },
          );
        }

        return jsonResponse(knowledgeBaseSearchResponse);
      }

      if (path === '/api/v1/workspace-dashboard/readonly-aggregation') {
        if (workspaceDashboardReadonlyAggregationPending) {
          return new Promise<Response>(() => {});
        }

        if (workspaceDashboardReadonlyAggregationError) {
          return jsonResponse(
            { error: workspaceDashboardReadonlyAggregationError.message },
            { status: workspaceDashboardReadonlyAggregationError.status },
          );
        }

        return jsonResponse(workspaceDashboardReadonlyAggregationResponse);
      }

      if (institutionError?.path === path) {
        return jsonResponse({ error: institutionError.message }, { status: institutionError.status });
      }

      if (institutionMutationError?.path === path && method === 'POST') {
        return jsonResponse(
          { error: institutionMutationError.message },
          { status: institutionMutationError.status },
        );
      }

      if (path === '/api/institution/customers') {
        return jsonResponse({ records: customers });
      }

      if (path === '/api/institution/appointments') {
        return jsonResponse({ records: appointments });
      }

      if (path.startsWith('/api/institution/followups?')) {
        return jsonResponse({ records: followUpSourceResponses?.[path] ?? [] });
      }

      if (path === '/api/institution/followups') {
        return jsonResponse({ records: followups });
      }

      if (path === '/api/institution/follow-up-path-analysis') {
        if (followUpPathAnalysisError) {
          return jsonResponse(
            { error: followUpPathAnalysisError.message },
            { status: followUpPathAnalysisError.status },
          );
        }

        return jsonResponse(followUpPathAnalysis);
      }

      if (path === '/api/institution/his-connections') {
        if (hisConnectionListError) {
          return jsonResponse(
            { error: hisConnectionListError.message },
            { status: hisConnectionListError.status },
          );
        }

        return jsonResponse({ records: hisConnections });
      }

      if (path.startsWith('/api/institution/knowledge-management/items')) {
        return jsonResponse({
          requestId: 'institution-knowledge-management-items',
          readonly: true,
          dataSource: 'repository',
          records: [
            {
              knowledgeId: 'knowledge-workspace-visible',
              title: '工作台授权知识库',
              category: '术后护理',
              status: 'ready',
              readonlyStatus: 'readonly',
              sourceKind: 'demo',
              descriptionPreview: '机构端只读低敏摘要。',
              chunkCount: 2,
              visibility: 'platform_authorized',
              updatedAt: '2026-06-13T08:00:00.000Z',
              createdAt: '2026-06-13T08:00:00.000Z',
            },
          ],
          pageInfo: {
            page: 1,
            pageSize: 10,
            total: 1,
            pageCount: 1,
            hasPreviousPage: false,
            hasNextPage: false,
          },
        });
      }

      if (path.startsWith('/api/institution/his-connections/')) {
        if (hisConnectionDetailError) {
          return jsonResponse(
            { error: hisConnectionDetailError.message },
            { status: hisConnectionDetailError.status },
          );
        }

        const connectionId = decodeURIComponent(path.split('/').at(-1) ?? '');
        const record =
          hisConnectionDetails?.[connectionId] ??
          hisConnections.find(
            (connection) =>
              typeof connection === 'object' &&
              connection !== null &&
              'connectionId' in connection &&
              connection.connectionId === connectionId,
          );

        if (!record) {
          return jsonResponse({ error: 'not_found' }, { status: 404 });
        }

        return jsonResponse({ record });
      }

      if (path.includes('/follow-up-suggestions')) {
        const suggestions = didReadFollowUpSuggestions ? [] : followUpSuggestions;
        didReadFollowUpSuggestions = true;
        return jsonResponse({ suggestions });
      }

      if (path.includes('/follow-up-tasks') && method === 'POST') {
        if (followUpTaskError) {
          return jsonResponse(
            { error: followUpTaskError.message },
            { status: followUpTaskError.status },
          );
        }

        return jsonResponse({ record: followUpTaskRecord }, { status: 201 });
      }

      if (
        path === '/api/institution/treatment-summaries/trt_phase14_management' &&
        method === 'PATCH'
      ) {
        if (treatmentSummaryUpdateError) {
          return jsonResponse(
            { error: treatmentSummaryUpdateError.message },
            { status: treatmentSummaryUpdateError.status },
          );
        }

        return jsonResponse({ record: treatmentSummaryUpdateRecord });
      }

      if (
        path === '/api/institution/treatment-summaries/trt_phase14_management/void' &&
        method === 'POST'
      ) {
        return jsonResponse({ record: treatmentSummaryVoidRecord });
      }

      if (path.startsWith('/api/institution/treatment-summaries')) {
        return jsonResponse(
          treatmentSummaryPageQueue?.shift() ?? fallbackTreatmentSummaryPage,
        );
      }

      if (path === '/api/institution/audit-events') {
        return jsonResponse({
          records: auditEvents,
          pageInfo: {
            hasMore: false,
            limit: 50,
            nextCursor: null,
          },
        });
      }

      if (path.startsWith('/api/open-platform/audit-events')) {
        return jsonResponse({
          records: platformAuditEvents,
          pageInfo: {
            hasMore: false,
            limit: 50,
            nextCursor: null,
          },
        });
      }

      if (path === '/api/open-platform/tenants') {
        if (platformTenantError) {
          return jsonResponse(
            { error: platformTenantError.message },
            { status: platformTenantError.status },
          );
        }

        return jsonResponse({ records: platformTenants });
      }

      if (
        path === '/api/institution/customers/cust_phase5_closeout/treatment-summaries' &&
        method === 'POST'
      ) {
        if (treatmentSummaryMutationError) {
          return jsonResponse(
            { error: treatmentSummaryMutationError.message },
            { status: treatmentSummaryMutationError.status },
          );
        }

        return jsonResponse({ record: treatmentSummaryRecord }, { status: 201 });
      }

      if (path.startsWith('/api/institution/customers/') && path.endsWith('/timeline')) {
        return jsonResponse(timelineQueue.shift() ?? fallbackTimeline);
      }

      throw new Error(`没有为 ${path} 配置 fetch mock`);
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mutationBody(fetchMock: ReturnType<typeof mockWorkspaceFetch>, path: string) {
  const call = fetchMock.mock.calls.find(
    ([input, init]) => fetchPath(input) === path && init?.method === 'POST',
  );

  expect(call).toBeDefined();
  const [, init] = call!;
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

function requestBodyByMethod(
  fetchMock: ReturnType<typeof mockWorkspaceFetch>,
  path: string,
  method: 'POST' | 'PATCH',
) {
  const call = fetchMock.mock.calls.find(
    ([input, init]) => fetchPath(input) === path && init?.method === method,
  );

  expect(call).toBeDefined();
  const [, init] = call!;
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

function fillTreatmentSummaryForm(drawer: HTMLElement) {
  const drawerView = within(drawer);

  fireEvent.change(drawerView.getByLabelText('治疗时间'), {
    target: { value: '2026-06-02T16:30:00+08:00' },
  });
  fireEvent.change(drawerView.getByLabelText('治疗项目'), {
    target: { value: 'Phase13 水光补水复诊' },
  });
  fireEvent.change(drawerView.getByLabelText('治疗类别'), {
    target: { value: 'phase13_skin_repair' },
  });
  fireEvent.change(drawerView.getByLabelText('治疗阶段'), {
    target: { value: 'Phase13 D14 复诊' },
  });
  fireEvent.change(drawerView.getByLabelText('恢复阶段'), {
    target: { value: 'Phase13 D14' },
  });
  fireEvent.change(drawerView.getByLabelText('风险等级'), {
    target: { value: 'watch' },
  });
  fireEvent.change(drawerView.getByLabelText('负责人 ID'), {
    target: { value: 'doctor-phase13' },
  });
  fireEvent.change(drawerView.getByLabelText('摘要'), {
    target: { value: 'Phase13 结构化摘要：恢复稳定，安排补水。' },
  });
  fireEvent.change(drawerView.getByLabelText('下一步护理'), {
    target: { value: 'Phase13 D21 人工回访恢复阶段。' },
  });
  fireEvent.change(drawerView.getByLabelText('标签'), {
    target: { value: 'Phase13 结构化摘要, 复诊' },
  });
  fireEvent.change(drawerView.getByLabelText('关联预约 ID（可选）'), {
    target: { value: 'appt_phase5_closeout' },
  });
}

function expectSafeTreatmentSummaryBody(body: Record<string, unknown>) {
  const serializedBody = JSON.stringify(body);

  expect(body).toEqual({
    treatmentDate: '2026-06-02T16:30:00+08:00',
    treatmentProject: 'Phase13 水光补水复诊',
    treatmentCategory: 'phase13_skin_repair',
    treatmentStage: 'Phase13 D14 复诊',
    recoveryStage: 'Phase13 D14',
    riskLevel: 'watch',
    ownerUserId: 'doctor-phase13',
    summary: 'Phase13 结构化摘要：恢复稳定，安排补水。',
    nextCareAction: 'Phase13 D21 人工回访恢复阶段。',
    tags: ['Phase13 结构化摘要', '复诊'],
    appointmentId: 'appt_phase5_closeout',
  });
  expect(serializedBody).not.toContain('tenantId');
  expect(serializedBody).not.toContain('customerId');
  expect(serializedBody).not.toContain('unknownField');
  expect(serializedBody).not.toContain('phoneNumber');
  expect(serializedBody).not.toContain('idNumber');
  expect(serializedBody).not.toContain('rawMedicalRecordNo');
  expect(serializedBody).not.toContain('fullTreatmentRecord');
  expect(serializedBody).not.toContain('medicalRecordText');
  expect(serializedBody).not.toContain('consultationTranscript');
  expect(serializedBody).not.toContain('imageUrl');
  expect(serializedBody).not.toContain('fileUrl');
  expect(serializedBody).not.toContain('aiGeneratedContent');
  expect(serializedBody).not.toContain('externalSystemPayload');
  expect(serializedBody).not.toContain('13800001252');
  expect(serializedBody).not.toContain('110101199001010011');
  expect(serializedBody).not.toContain('MR202605310001');
  expect(serializedBody).not.toContain('完整治疗记录正文');
  expect(serializedBody).not.toContain('完整病历正文');
  expect(serializedBody).not.toContain('咨询对话全文');
}

function expectSafeTreatmentSummaryEditBody(body: Record<string, unknown>) {
  const serializedBody = JSON.stringify(body);

  expect(body).toEqual({
    treatmentDate: '2026-06-03T10:00:00+08:00',
    treatmentProject: 'Phase18 编辑后治疗摘要',
    treatmentCategory: 'phase18_safe_edit',
    treatmentStage: 'Phase18 D21 复诊',
    recoveryStage: 'Phase18 D21',
    riskLevel: 'normal',
    ownerUserId: 'doctor-phase18',
    summary: 'Phase18 编辑摘要：结构化字段已修正。',
    nextCareAction: 'Phase18 D28 人工确认恢复状态。',
    tags: ['Phase18 编辑', '安全字段'],
    appointmentId: 'appt_phase18_edit',
  });
  expect(body).not.toHaveProperty('tenantId');
  expect(body).not.toHaveProperty('customerId');
  expect(body).not.toHaveProperty('id');
  expect(body).not.toHaveProperty('createdAt');
  expect(body).not.toHaveProperty('updatedAt');
  expect(serializedBody).not.toContain('unknownField');
  expect(serializedBody).not.toContain('fullTreatmentRecord');
  expect(serializedBody).not.toContain('medicalRecordText');
  expect(serializedBody).not.toContain('diagnosisText');
  expect(serializedBody).not.toContain('consultationTranscript');
  expect(serializedBody).not.toContain('phoneNumber');
  expect(serializedBody).not.toContain('idNumber');
  expect(serializedBody).not.toContain('rawMedicalRecordNo');
  expect(serializedBody).not.toContain('imageUrl');
  expect(serializedBody).not.toContain('fileUrl');
  expect(serializedBody).not.toContain('aiGeneratedContent');
  expect(serializedBody).not.toContain('externalSystemPayload');
  expect(serializedBody).not.toContain('sql');
  expect(serializedBody).not.toContain('stack');
  expect(serializedBody).not.toContain('token');
  expect(serializedBody).not.toContain('secret');
  expect(serializedBody).not.toContain('DATABASE_URL');
  expect(serializedBody).not.toContain('postgres://');
  expect(serializedBody).not.toContain('13800001252');
  expect(serializedBody).not.toContain('110101199001010011');
  expect(serializedBody).not.toContain('MR202605310001');
  expect(serializedBody).not.toContain('完整治疗记录正文');
  expect(serializedBody).not.toContain('完整病历正文');
  expect(serializedBody).not.toContain('诊疗原文');
  expect(serializedBody).not.toContain('咨询对话全文');
}

async function expectMetric(label: string, value: string) {
  const metricCard = screen.getByText(label).closest('article');
  expect(metricCard).not.toBeNull();
  expect(await within(metricCard as HTMLElement).findByText(value)).toBeInTheDocument();
}

function expectNoInstitutionMutation(fetchMock: ReturnType<typeof mockWorkspaceFetch>) {
  const institutionCalls = fetchMock.mock.calls.filter(([input]) =>
    fetchPath(input).startsWith('/api/institution/'),
  );

  expect(institutionCalls.length).toBeGreaterThan(0);
  for (const [input, init] of institutionCalls) {
    expect(fetchPath(input)).not.toContain('tenantId');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body ? String(init.body) : '').not.toContain('tenantId');
  }
}

function expectOnlyInstitutionReadCalls(fetchMock: ReturnType<typeof mockWorkspaceFetch>) {
  const institutionCalls = fetchMock.mock.calls.filter(([input]) =>
    fetchPath(input).startsWith('/api/institution/'),
  );

  expect(institutionCalls.length).toBeGreaterThan(0);
  for (const [input, init] of institutionCalls) {
    expect(fetchPath(input)).not.toContain('tenantId');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body ? String(init.body) : '').not.toContain('tenantId');
  }
}

function expectOnlyHisConnectionReadCalls(fetchMock: ReturnType<typeof mockWorkspaceFetch>) {
  const hisConnectionCalls = fetchMock.mock.calls.filter(([input]) =>
    fetchPath(input).startsWith('/api/institution/his-connections'),
  );

  expect(hisConnectionCalls.length).toBeGreaterThan(0);
  for (const [input, init] of hisConnectionCalls) {
    const path = fetchPath(input);

    expect(path).toMatch(/^\/api\/institution\/his-connections(?:\/[^/?#]+)?$/u);
    expect(path).not.toContain('tenantId');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(JSON.stringify(init ?? {})).not.toContain('tenantId');
  }
}

function expectNoSensitiveHisConnectionContent(container: HTMLElement) {
  const content = container.textContent ?? '';

  expect(content).not.toContain('tenant_should_not_render');
  expect(content).not.toContain('deletedAt');
  expect(content).not.toContain('credentialRef');
  expect(content).not.toContain('cred_ref_internal_only');
  expect(content).not.toContain('token_should_not_render');
  expect(content).not.toContain('secret_should_not_render');
  expect(content).not.toContain('sk_test_should_not_render');
  expect(content).not.toContain('oauth_should_not_render');
  expect(content).not.toContain('basic_auth_should_not_render');
  expect(content).not.toContain('signing_key_should_not_render');
  expect(content).not.toContain('private_key_should_not_render');
  expect(content).not.toContain('postgres://');
  expect(content).not.toContain('raw HIS payload should not render');
  expect(content).not.toContain('完整请求体不应展示');
  expect(content).not.toContain('完整响应体不应展示');
  expect(content).not.toContain('select * from his_connections');
  expect(content).not.toContain('DATABASE_URL');
  expect(content).not.toContain('stack');
}

function expectNoHisConnectionWriteActionButtons() {
  for (const label of ['创建', '编辑', '删除', '暂停', '恢复', '撤销', '配置凭证', '测试连接']) {
    expect(screen.queryByRole('button', { name: new RegExp(label, 'u') })).not.toBeInTheDocument();
  }
}

type DemoCustomerSeed = ReturnType<typeof getDemoCustomerSeedRecords>[number];
type DemoAppointmentSeed = ReturnType<typeof getDemoAppointmentSeedRecords>[number];
type DemoTreatmentSummarySeed = ReturnType<typeof getDemoTreatmentSummarySeedRecords>[number];
type DemoFollowUpTaskSeed = ReturnType<typeof getDemoFollowUpTaskSeedRecords>[number];
type DemoAuditEventSeed = ReturnType<typeof getDemoAuditEventSeedRecords>[number];

function toIsoStringForDemoSmoke(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function requireIsoStringForDemoSmoke(value: Date | string | null | undefined) {
  return toIsoStringForDemoSmoke(value) ?? '';
}

function mapDemoCustomerSeed(record: DemoCustomerSeed): CustomerRecordSummary {
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
    tags: [...(record.tags ?? [])],
  };
}

function mapDemoAppointmentSeed(record: DemoAppointmentSeed): AppointmentRecordSummary {
  return {
    id: record.id,
    tenantId: record.tenantId,
    customerId: record.customerId,
    customerDisplayName: record.customerDisplayName,
    project: record.project,
    scheduledAt: requireIsoStringForDemoSmoke(record.scheduledAt),
    consultantUserId: record.consultantUserId,
    status: record.status,
    note: record.note,
  };
}

function mapDemoTreatmentSummarySeed(record: DemoTreatmentSummarySeed): TreatmentSummaryRecord {
  const voidedAt = toIsoStringForDemoSmoke(record.voidedAt);

  return {
    id: record.id,
    tenantId: record.tenantId,
    customerId: record.customerId,
    appointmentId: record.appointmentId ?? null,
    treatmentDate: requireIsoStringForDemoSmoke(record.treatmentDate),
    treatmentProject: record.treatmentProject,
    treatmentCategory: record.treatmentCategory,
    treatmentStage: record.treatmentStage,
    recoveryStage: record.recoveryStage,
    riskLevel: record.riskLevel,
    ownerUserId: record.ownerUserId,
    summary: record.summary,
    nextCareAction: record.nextCareAction,
    tags: [...(record.tags ?? [])],
    status: voidedAt ? 'voided' : 'active',
    voidedAt,
    voidedBy: record.voidedBy ?? null,
    voidReasonCode: record.voidReasonCode ?? null,
    voidReason: record.voidReason ?? null,
    createdAt: requireIsoStringForDemoSmoke(record.createdAt),
    updatedAt: requireIsoStringForDemoSmoke(record.updatedAt),
  };
}

function mapDemoFollowUpTaskSeed(record: DemoFollowUpTaskSeed): TenantFollowUpTask {
  const sourceTreatmentSummaryId = record.sourceTreatmentSummaryId ?? null;

  return {
    id: record.id,
    tenantId: record.tenantId,
    customerId: record.customerId,
    customerDisplayName: record.customerDisplayName,
    journeyId: record.journeyId,
    stage: record.stage,
    status: record.status,
    dueAt: requireIsoStringForDemoSmoke(record.dueAt),
    suggestedAction: record.suggestedAction,
    riskLevel: record.riskLevel,
    updatedBy: record.updatedBy ?? null,
    updatedAt: toIsoStringForDemoSmoke(record.updatedAt),
    source: sourceTreatmentSummaryId ? 'treatment_summary' : null,
    sourceTreatmentSummaryId,
    sourceSuggestionKey: record.sourceSuggestionKey ?? null,
  };
}

function mapDemoAuditEventSeed(record: DemoAuditEventSeed): AuditEventListItem {
  return {
    id: record.eventId,
    tenantId: record.tenantId ?? null,
    resource: record.resource,
    resourceId: record.resourceId ?? null,
    action: record.action,
    result: record.result,
    reason: record.reason,
    actorId: record.actorId,
    actorRole: record.actorRole,
    occurredAt: requireIsoStringForDemoSmoke(record.occurredAt),
  };
}

function mapDemoTimelineAuditEvent(record: AuditEventListItem): CustomerTimelineAuditSummary {
  return {
    id: record.id,
    action: record.action,
    result: record.result,
    reason: record.reason,
    actor: {
      id: record.actorId,
      role: record.actorRole,
    },
    occurredAt: record.occurredAt,
    resource: record.resource,
    resourceId: record.resourceId,
  };
}

function buildDemoPlatformTenants(): OpenPlatformTenantRecord[] {
  const plansById = new Map(getDemoTenantPlanSeedRecords().map((record) => [record.id, record]));
  const assignmentsByTenantId = new Map(
    getDemoTenantPlanAssignmentSeedRecords().map((record) => [record.tenantId, record]),
  );
  const quotaSnapshotsByTenantId = new Map(
    getDemoTenantQuotaSnapshotSeedRecords().map((record) => [record.tenantId, record]),
  );

  return getDemoTenantSeedRecords().map((tenant) => {
    const assignment = assignmentsByTenantId.get(tenant.id);
    const plan = assignment ? plansById.get(assignment.planId) : undefined;
    const quota = quotaSnapshotsByTenantId.get(tenant.id);

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantStatus: tenant.status ?? 'active',
      createdAt: '2026-06-01T01:00:00.000Z',
      updatedAt: '2026-06-02T01:00:00.000Z',
      planName: plan?.name ?? null,
      planCode: plan?.code ?? null,
      planStatus: plan?.status ?? null,
      planVersionId: null,
      planVersionCode: null,
      planDisplayName: null,
      planDisplayPrice: null,
      assignmentStatus: assignment?.status ?? null,
      startedAt: toIsoStringForDemoSmoke(assignment?.startedAt),
      expiresAt: toIsoStringForDemoSmoke(assignment?.expiresAt),
      agentLimit: null,
      seatLimit: null,
      monthlyAiCallLimit: null,
      knowledgeStorageGb: null,
      connectorEntitlements: [],
      serviceEntitlements: [],
      authorizationSnapshotId: null,
      authorizationSnapshotStatus: null,
      authorizationGeneratedAt: null,
      maxCustomers: quota?.maxCustomers ?? null,
      maxAppointments: quota?.maxAppointments ?? null,
      maxFollowUps: quota?.maxFollowUps ?? null,
      maxAiCalls: quota?.maxAiCalls ?? null,
      currentCustomers: quota?.currentCustomers ?? null,
      currentAppointments: quota?.currentAppointments ?? null,
      currentFollowUps: quota?.currentFollowUps ?? null,
      currentAiCalls: quota?.currentAiCalls ?? null,
      snapshotAt: toIsoStringForDemoSmoke(quota?.snapshotAt),
    };
  });
}

function buildDemoFollowUpSourceResponses(followups: TenantFollowUpTask[]) {
  return getDemoTreatmentSummarySeedRecords().reduce<Record<string, TenantFollowUpTask[]>>(
    (responses, summary) => {
      const path = `/api/institution/followups?source=treatment_summary&sourceTreatmentSummaryId=${summary.id}`;
      responses[path] = followups.filter((task) => task.sourceTreatmentSummaryId === summary.id);
      return responses;
    },
    {},
  );
}

function buildDemoSeedWorkspaceSmokeFixtures() {
  const customers = getDemoCustomerSeedRecords()
    .filter((record) => record.tenantId === 'demo-tenant-001')
    .map(mapDemoCustomerSeed);
  const appointments = getDemoAppointmentSeedRecords()
    .filter((record) => record.tenantId === 'demo-tenant-001')
    .map(mapDemoAppointmentSeed);
  const followups = getDemoFollowUpTaskSeedRecords()
    .filter((record) => record.tenantId === 'demo-tenant-001')
    .map(mapDemoFollowUpTaskSeed);
  const treatmentSummaryRecords = getDemoTreatmentSummarySeedRecords()
    .filter((record) => record.tenantId === 'demo-tenant-001')
    .map(mapDemoTreatmentSummarySeed);
  const treatmentSummaries = treatmentSummaryRecords.map(mapTreatmentSummaryRecordToListItem);
  const auditEvents = getDemoAuditEventSeedRecords()
    .filter((record) => record.scope === 'tenant' && record.tenantId === 'demo-tenant-001')
    .map(mapDemoAuditEventSeed);
  const platformAuditEvents = getDemoAuditEventSeedRecords()
    .filter((record) => record.scope === 'platform' || record.result === 'denied')
    .map(mapDemoAuditEventSeed);
  const shenZhixiaTimeline = buildCustomerTimelineResponse({
    customer: customers.find((record) => record.id === 'demo-customer-shen-zhixia') ?? customers[0],
    appointments: appointments.filter((record) => record.customerId === 'demo-customer-shen-zhixia'),
    followups: followups.filter((record) => record.customerId === 'demo-customer-shen-zhixia'),
    treatmentSummaries: treatmentSummaryRecords.filter(
      (record) => record.customerId === 'demo-customer-shen-zhixia',
    ),
    auditEvents: auditEvents
      .filter((record) =>
        ['demo-customer-shen-zhixia', 'demo-appt-shen-treatment', 'TS-001'].includes(
          record.resourceId ?? '',
        ),
      )
      .map(mapDemoTimelineAuditEvent),
  });

  return {
    customers,
    appointments,
    followups,
    treatmentSummaries,
    auditEvents,
    platformAuditEvents,
    platformTenants: buildDemoPlatformTenants(),
    shenZhixiaTimeline,
    followUpSourceResponses: buildDemoFollowUpSourceResponses(followups),
  };
}

function expectNoSensitiveCustomerTimelineContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('13800001252');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('MR202605310001');
  expect(text).not.toContain('完整治疗记录正文不应展示');
  expect(text).not.toContain('完整病历正文不应展示');
  expect(text).not.toContain('诊疗原文不应展示');
  expect(text).not.toContain('咨询对话全文不应展示');
  expect(text).not.toContain('图片文件原文不应展示');
  expect(text).not.toContain('AI 生成内容不应展示');
  expect(text).not.toContain('外部系统同步原文不应展示');
  expect(text).not.toContain('AI provider');
  expect(text).not.toContain('RAG');
  expect(text).not.toContain('Agent');
  expect(text).not.toContain('外部系统同步');
  expect(text).not.toContain('requestBody');
  expect(text).not.toContain('select * from audit_events');
  expect(text).not.toContain('select * from treatment_summaries');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
  expect(text).not.toContain('sk_test_phase7_should_not_render');
  expect(text).not.toContain('sk_test_phase12_should_not_render');
  expect(text).not.toContain('sk_test_phase19_timeline_should_not_render');
  expect(text).not.toContain('phase12-raw-secret');
  expect(text).not.toContain('phase19-timeline-secret');
}

function expectNoSensitiveAuditContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('tenantId');
  expect(text).not.toContain('select * from audit_events');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
  expect(text).not.toContain('sk_test_phase8_should_not_render');
}

function expectNoSensitiveTreatmentSummaryManagementContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('tenantId');
  expect(text).not.toContain('customerDisplayName');
  expect(text).not.toContain('appointmentNote');
  expect(text).not.toContain('followUpSuggestedAction');
  expect(text).not.toContain('Phase14 客户明细不应展示');
  expect(text).not.toContain('Phase14 预约明细不应展示');
  expect(text).not.toContain('Phase14 随访明细不应展示');
  expect(text).not.toContain('Phase15 客户不应展示');
  expect(text).not.toContain('13800001252');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('MR202605310001');
  expect(text).not.toContain('完整治疗记录正文不应展示');
  expect(text).not.toContain('完整病历正文不应展示');
  expect(text).not.toContain('诊疗原文不应展示');
  expect(text).not.toContain('咨询对话全文不应展示');
  expect(text).not.toContain('图片文件原文不应展示');
  expect(text).not.toContain('AI 生成内容不应展示');
  expect(text).not.toContain('外部系统同步原文不应展示');
  expect(text).not.toContain('requestBody');
  expect(text).not.toContain('select * from treatment_summaries');
  expect(text).not.toContain('select * from follow_up_tasks');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
  expect(text).not.toContain('sk_test_phase14_should_not_render');
  expect(text).not.toContain('sk_test_phase15_should_not_render');
  expect(text).not.toContain('phase14-raw-secret');
  expect(text).not.toContain('phase15-raw-secret');
  expect(text).not.toContain('自动发送');
  expect(text).not.toContain('自动推送');
  expect(text).not.toContain('系统自动触达客户');
  expect(text).not.toContain('已启用自动触达');
  expect(text).not.toContain('微信');
  expect(text).not.toContain('企业微信');
  expect(text).not.toContain('企微触达');
  expect(text).not.toContain('短信发送');
  expect(text).not.toContain('发送短信');
  expect(text).not.toContain('电话外呼');
}

function expectNoInstitutionDemoMisleadingClaims(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('AI 开发主线');
  expect(text).not.toContain('系统自动触达客户');
  expect(text).not.toContain('已启用自动触达');
  expect(text).not.toContain('真实 HIS 同步');
  expect(text).not.toContain('自动发微信');
  expect(text).not.toContain('AI 自动客服');
}

function expectNoPlatformDemoMisleadingClaims(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('AI 已接入');
  expect(text).not.toContain('AI 自动客服');
  expect(text).not.toContain('RAG 已完成');
  expect(text).not.toContain('Agent 已上线');
  expect(text).not.toContain('支付已完成');
  expect(text).not.toContain('合同已完成');
  expect(text).not.toContain('发票已完成');
  expect(text).not.toContain('Webhook 已接入');
  expect(text).not.toContain('OAuth 已接入');
  expect(text).not.toContain('完整计费后台');
  expect(text).not.toContain('自动升级套餐');
  expect(text).not.toContain('自动触达');
}

function expectNoSensitivePlatformAuditContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('13800001252');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('MR202605310001');
  expect(text).not.toContain('完整治疗记录正文不应展示');
  expect(text).not.toContain('咨询对话全文不应展示');
  expect(text).not.toContain('requestBody');
  expect(text).not.toContain('metadata');
  expect(text).not.toContain('select * from audit_events');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
  expect(text).not.toContain('sk_test_phase8_platform_should_not_render');
}

function expectNoSensitivePlatformTenantContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('客户明细');
  expect(text).not.toContain('预约明细');
  expect(text).not.toContain('followUpTasks');
  expect(text).not.toContain('随访任务明细');
  expect(text).not.toContain('phoneNumber');
  expect(text).not.toContain('手机号原文');
  expect(text).not.toContain('13800001252');
  expect(text).not.toContain('idNumber');
  expect(text).not.toContain('身份证号');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('medicalRecordNo');
  expect(text).not.toContain('病历号原文');
  expect(text).not.toContain('MR202605310001');
  expect(text).not.toContain('treatmentRecord');
  expect(text).not.toContain('治疗记录');
  expect(text).not.toContain('病历正文');
  expect(text).not.toContain('完整治疗记录正文不应展示');
  expect(text).not.toContain('consultationTranscript');
  expect(text).not.toContain('咨询对话');
  expect(text).not.toContain('咨询对话全文不应展示');
  expect(text).not.toContain('requestBody');
  expect(text).not.toContain('SQL');
  expect(text).not.toContain('select * from tenant_plans');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('连接串');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
  expect(text).not.toContain('sk_test_phase9_platform_should_not_render');
  expect(text).not.toContain('sk_test_phase11_platform_should_not_render');
  expect(text).not.toContain('phase9-raw-secret');
  expect(text).not.toContain('phase11-raw-secret');
  expect(text).not.toContain('cust_phase11_raw_should_not_render');
}

function expectNoPlatformTenantMutation(fetchMock: ReturnType<typeof mockWorkspaceFetch>) {
  const tenantCalls = fetchMock.mock.calls.filter(
    ([input]) => fetchPath(input) === '/api/open-platform/tenants',
  );

  expect(tenantCalls.length).toBeGreaterThan(0);
  for (const [, init] of tenantCalls) {
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body).toBeUndefined();
  }
}

describe('工作台入口页面', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('机构工作台首页从真实 API 派生指标和行动摘要', async () => {
    const fetchMock = mockWorkspaceFetch();
    const { container } = render(<HospitalPage />);

    expect(await screen.findByRole('heading', { name: /今日治疗后随访重点/ })).toBeInTheDocument();
    expect(screen.getByText('待人工确认的后续动作')).toBeInTheDocument();
    expect(screen.getByText('正在加载机构运营摘要...')).toBeInTheDocument();
    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    expect(screen.queryByText('当前为受控 demo 数据')).not.toBeInTheDocument();
    expect(screen.queryByText('UI mock-only')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '随访路径运营分析' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', { cache: 'no-store' });
    await expectMetric('客户总数', '2');
    await expectMetric('高优先级客户', '1');
    await expectMetric('待确认预约', '1');
    await expectMetric('待处理随访', '1');
    await expectMetric('模板建议数', '6');
    await expectMetric('人工确认任务数', '4');
    await expectMetric('已完成任务数', '2');
    await expectMetric('超时任务数', '1');
    await expectMetric('作废摘要阻断数', '1');
    await expectMetric('重复来源任务冲突数', '1');
    expect(screen.getByText('只读聚合')).toBeInTheDocument();
    expect(screen.getByText('只统计 template_path_followup 模板建议。')).toBeInTheDocument();
    expect(screen.getByText('基于当前租户治疗摘要、模板驱动建议、来源随访任务和审计事件只读聚合。')).toBeInTheDocument();
    expect(screen.getByText('仅返回聚合指标，不返回客户明细、任务列表、治疗正文或 raw audit payload。')).toBeInTheDocument();
    expect(screen.getByText('当前为只读聚合指标')).toBeInTheDocument();
    expect(screen.getByText('不展示客户明细')).toBeInTheDocument();
    expect(screen.getByText('不展示任务列表')).toBeInTheDocument();
    expect(screen.getByText('不展示治疗正文、病历正文、咨询全文')).toBeInTheDocument();
    expect(screen.getAllByText('不自动触达客户').length).toBeGreaterThan(0);
    expect(screen.getByText('不接 AI')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '知识库只读入口' })).toBeInTheDocument();
    expect(screen.getByText('只读入口')).toBeInTheDocument();
    expect(screen.getAllByText('未接入真实数据').length).toBeGreaterThan(0);
    expect(screen.getByText('只调用现有 GET API')).toBeInTheDocument();
    expect(screen.getByText('只读 search API')).toBeInTheDocument();
    expect(screen.getByText('只读搜索 / 受控本地索引')).toBeInTheDocument();
    expect(screen.getByText('不接 DB')).toBeInTheDocument();
    expect(screen.getByText('不接真实外部院内系统')).toBeInTheDocument();
    expect(screen.getByText('不读取凭证')).toBeInTheDocument();
    expect(screen.getByText('不使用真实业务个人数据')).toBeInTheDocument();
    expect(screen.getByText('不展示智能推断细节')).toBeInTheDocument();
    expect(await screen.findByText('知识库只读入口已就绪')).toBeInTheDocument();
    expect(screen.getAllByText('ready / readonly').length).toBeGreaterThan(0);
    expect(screen.getByText('知识库只读入口API 可用于低敏只读预览')).toBeInTheDocument();
    expect(screen.getByText('知识库只读入口API 契约')).toBeInTheDocument();
    expect(screen.getByText('categories')).toBeInTheDocument();
    expect(screen.getByText('folders')).toBeInTheDocument();
    expect(screen.getByText('knowledgeItems')).toBeInTheDocument();
    expect(screen.getAllByText('taskRecords').length).toBeGreaterThan(0);
    expect(screen.getByText('searchPreview')).toBeInTheDocument();
    expect(screen.getByText('平台知识库')).toBeInTheDocument();
    expect(screen.getByText('机构知识库')).toBeInTheDocument();
    expect(screen.getByText('目录总览')).toBeInTheDocument();
    expect(screen.getByText('可见范围')).toBeInTheDocument();
    expect(screen.queryByText('发布状态总览')).not.toBeInTheDocument();
    expect(screen.getAllByText('低敏摘要已隐藏').length).toBeGreaterThan(0);
    expect(screen.getByText('版本总览')).toBeInTheDocument();
    expect(screen.getByText('审计总览')).toBeInTheDocument();
    expect(screen.getByText('知识库只读入口facade')).toBeInTheDocument();
    expect(screen.getByText('readonly_preview')).toBeInTheDocument();
    expect(screen.getByText('知识库只读预览')).toBeInTheDocument();
    expect(screen.getByText('平台知识库 只读 预览')).toBeInTheDocument();
    expect(screen.getByText('机构知识库 开发数据 预览')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'workspace dashboard readonly aggregation' })).toBeInTheDocument();
    expect(screen.getByText('workspace dashboard readonly aggregation 已就绪')).toBeInTheDocument();
    expect(screen.getByText('businessLoopSummary')).toBeInTheDocument();
    expect(screen.getByText('managementConfigSummary')).toBeInTheDocument();
    expect(screen.getByText('knowledgeGovernanceSummary')).toBeInTheDocument();
    expect(screen.getByText('fieldWhitelistSummary')).toBeInTheDocument();
    expect(screen.getByText('readonlyFeaturePolicySummary')).toBeInTheDocument();
    expect(screen.getByText('review_business_loop_blockers_readonly')).toBeInTheDocument();
    expect(screen.getByText(/部分重复来源任务冲突审计未能通过 resourceId/u)).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('Phase21 客户明细不应展示');
    expect(container.textContent ?? '').not.toContain('fu_phase21_sensitive');
    expect(container.textContent ?? '').not.toContain('任务列表不应展示');
    expect(container.textContent ?? '').not.toContain('完整治疗记录正文不应展示');
    expect(container.textContent ?? '').not.toContain('完整病历正文不应展示');
    expect(container.textContent ?? '').not.toContain('咨询对话全文不应展示');
    expect(container.textContent ?? '').not.toContain('图片文件原文不应展示');
    expect(container.textContent ?? '').not.toContain('requestBody 不应展示');
    expect(container.textContent ?? '').not.toContain('select * from follow_up_tasks');
    expect(container.textContent ?? '').not.toContain('DATABASE_URL');
    expect(container.textContent ?? '').not.toContain('postgres://');
    expect(container.textContent ?? '').not.toContain('stack');
    expect(container.textContent ?? '').not.toContain('token');
    expect(container.textContent ?? '').not.toContain('secret');
    expect(container.textContent ?? '').not.toContain('AI 已接入');
    expect(container.textContent ?? '').not.toContain('自动发微信');
    expect(container.textContent ?? '').not.toContain('已接 HIS');
    expect(container.textContent ?? '').not.toContain('已接企微');
    expect(screen.getByText('重点随访')).toBeInTheDocument();
    expect(screen.getByText('Phase6 客户B：Phase6 D3 异常反馈')).toBeInTheDocument();
    expect(screen.getByText('Phase5 客户A：Phase5 预约复诊')).toBeInTheDocument();
    expect(screen.getByText('Phase5 客户A：Phase5 修复项目')).toBeInTheDocument();
    expect(screen.queryByText('今日高意向客户 18 位')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 已按承接优先级排序')).not.toBeInTheDocument();
    expect(screen.queryByText('实时同步')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 经营副驾驶建议')).not.toBeInTheDocument();
    expect(screen.getAllByText('智美天工').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '工作台' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客户中心' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '机构端移动导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：客户中心' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出工作台' })).toBeInTheDocument();
    expect(screen.getByText('近期需要人工处理')).toBeInTheDocument();
    expect(screen.getAllByText(/客户、预约、随访任务统一进入运营视图/u).length).toBeGreaterThan(0);
    expect(screen.getByText('客户旅程看板')).toBeInTheDocument();
    expect(screen.getByText('当前行动队列')).toBeInTheDocument();
    expectNoInstitutionDemoMisleadingClaims(container);
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/customers', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/appointments', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/followups', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/follow-up-path-analysis', {
      cache: 'no-store',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/knowledge-base/demo-readonly', {
      cache: 'no-store',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/workspace-dashboard/readonly-aggregation', {
      cache: 'no-store',
    });
    const knowledgeBaseDemoReadonlyCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/v1/knowledge-base/demo-readonly',
    );
    expect(knowledgeBaseDemoReadonlyCall).toBeDefined();
    expect(knowledgeBaseDemoReadonlyCall?.[1]?.method).toBeUndefined();
    expect(knowledgeBaseDemoReadonlyCall?.[1]?.body).toBeUndefined();
    const workspaceDashboardReadonlyAggregationCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/v1/workspace-dashboard/readonly-aggregation',
    );
    expect(workspaceDashboardReadonlyAggregationCall).toBeDefined();
    expect(workspaceDashboardReadonlyAggregationCall?.[1]?.method).toBeUndefined();
    expect(workspaceDashboardReadonlyAggregationCall?.[1]?.body).toBeUndefined();
    const analysisCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/institution/follow-up-path-analysis',
    );
    expect(analysisCall).toBeDefined();
    expect(fetchPath(analysisCall![0])).not.toContain('tenantId');
    expect(analysisCall![1]?.body).toBeUndefined();
    expectNoInstitutionMutation(fetchMock);

    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));
    expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
    expect(screen.getByText('客户优先级队列')).toBeInTheDocument();
    expect(await screen.findByText('Phase5 客户A')).toBeInTheDocument();
    expect(screen.getByText('脱敏手机号：138****1252')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '预约中心' }));
    expect(screen.getByRole('heading', { name: '预约中心' })).toBeInTheDocument();
    expect(await screen.findByText('Phase5 预约复诊')).toBeInTheDocument();
    expect(screen.getByText('数据边界')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Phase5 客户A' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '智能随访' }));
    expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
    expect(screen.getByText('今日随访任务')).toBeInTheDocument();
    expect(await screen.findByText('Phase5 D7 回访')).toBeInTheDocument();
    expect(screen.getByText('任务需人工处理，不会主动向客户发送消息。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '治疗摘要管理' }));
    expect(screen.getByRole('heading', { name: '治疗摘要管理' })).toBeInTheDocument();
    expect(await screen.findByText('Phase14 治疗摘要管理项目')).toBeInTheDocument();
    expect(screen.getByText('治疗类别：phase14_skin_repair')).toBeInTheDocument();
    expect(screen.getByText('摘要：Phase14 结构化摘要：恢复稳定，安排补水。')).toBeInTheDocument();
    const treatmentSummaryCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/institution/treatment-summaries',
    );
    expect(treatmentSummaryCall).toBeDefined();
    expect(treatmentSummaryCall?.[1]).toEqual({ cache: 'no-store' });
    expect(treatmentSummaryCall?.[1]?.method).toBeUndefined();
    expect(treatmentSummaryCall?.[1]?.body).toBeUndefined();
    expectNoSensitiveTreatmentSummaryManagementContent(container);

    fireEvent.click(screen.getByRole('button', { name: '审计日志' }));
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(await screen.findByText('audit_phase8_institution')).toBeInTheDocument();
    expect(screen.getByText('资源 ID：cust_phase5_closeout')).toBeInTheDocument();
    expectOnlyInstitutionReadCalls(fetchMock);
  });

  it('机构工作台知识库只读入口入口展示 loading 状态', async () => {
    mockWorkspaceFetch({ knowledgeBaseDemoReadonlyPending: true });
    render(<HospitalPage />);

    const knowledgeBaseEntry = (await screen.findByRole('heading', {
      name: '知识库只读入口',
    })).closest('section');

    expect(knowledgeBaseEntry).not.toBeNull();
    expect(
      within(knowledgeBaseEntry as HTMLElement).getByText('正在加载知识库只读入口...'),
    ).toBeInTheDocument();
  });

  it('机构工作台知识库只读入口入口展示低敏 error 状态', async () => {
    const fetchMock = mockWorkspaceFetch({
      knowledgeBaseDemoReadonlyError: {
        status: 503,
        message: 'worker stack /tmp/demo dependency error',
      },
    });
    render(<HospitalPage />);

    const knowledgeBaseEntry = (await screen.findByRole('heading', {
      name: '知识库只读入口',
    })).closest('section');
    const knowledgeBaseEntryView = within(knowledgeBaseEntry as HTMLElement);

    expect(await knowledgeBaseEntryView.findByText('知识库只读入口暂时不可用')).toBeInTheDocument();
    expect(knowledgeBaseEntry?.textContent ?? '').not.toContain('worker');
    expect(knowledgeBaseEntry?.textContent ?? '').not.toContain('/tmp/demo');
    expect(knowledgeBaseEntry?.textContent ?? '').not.toContain('dependency error');
    expect(
      fetchMock.mock.calls.some(
        ([input]) => fetchPath(input) === '/api/v1/knowledge-base/demo-readonly',
      ),
    ).toBe(true);
  });

  it('机构工作台知识库只读入口入口不渲染敏感字段或行动按钮', async () => {
    mockWorkspaceFetch({
      knowledgeBaseDemoReadonlyResponse: buildKnowledgeBaseDemoReadonlyUnsafeMockResponse(),
    });
    render(<HospitalPage />);

    const knowledgeBaseEntry = (await screen.findByRole('heading', {
      name: '知识库只读入口',
    })).closest('section');

    expect(await within(knowledgeBaseEntry as HTMLElement).findByText('知识库只读入口已就绪')).toBeInTheDocument();
    const knowledgeBaseEntryText = knowledgeBaseEntry?.textContent ?? '';
    expect(knowledgeBaseEntryText).toContain('低敏摘要已隐藏');
    expect(knowledgeBaseEntryText).not.toContain('真实客户姓名');
    expect(knowledgeBaseEntryText).not.toContain('张三');
    expect(knowledgeBaseEntryText).not.toContain('13800001252');
    expect(knowledgeBaseEntryText).not.toContain('110101199001010011');
    expect(knowledgeBaseEntryText).not.toContain('HIS 原始目录');
    expect(knowledgeBaseEntryText).not.toContain('credential token secret apiKey');
    expect(knowledgeBaseEntryText).not.toContain('token');
    expect(knowledgeBaseEntryText).not.toContain('secret');
    expect(knowledgeBaseEntryText).not.toContain('apiKey');
    expect(knowledgeBaseEntryText).not.toContain('worker');
    expect(knowledgeBaseEntryText).not.toContain('/tmp/demo');
    expect(knowledgeBaseEntryText).not.toContain('dependency error');
    expect(knowledgeBaseEntryText).not.toContain('模型输出');
    expect(knowledgeBaseEntryText).not.toContain('真实知识正文');
    expect(knowledgeBaseEntryText).not.toContain('真实检索召回');
    expect(knowledgeBaseEntryText).not.toContain('支付已完成');
    expect(knowledgeBaseEntryText).not.toContain('合同已完成');
    expect(knowledgeBaseEntryText).not.toContain('发票已完成');
    expect(within(knowledgeBaseEntry as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it('机构工作台知识库只读入口ready 入口只展示低敏只读验收字段', async () => {
    const fetchMock = mockWorkspaceFetch({
      knowledgeBaseDemoReadonlyResponse: buildKnowledgeBaseDemoReadonlyMockResponse('ready'),
    });
    render(<HospitalPage />);

    const knowledgeBaseEntry = (await screen.findByRole('heading', {
      name: '知识库只读入口',
    })).closest('section');
    const knowledgeBaseEntryView = within(knowledgeBaseEntry as HTMLElement);

    expect(await knowledgeBaseEntryView.findByText('知识库只读入口已就绪')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('categories')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('folders')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('knowledgeItems')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('taskRecords')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('searchPreview')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('平台知识库')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('目录总览')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('版本总览')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('知识库只读预览')).toBeInTheDocument();
    expect(within(knowledgeBaseEntry as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.every(
        ([input, init]) =>
          fetchPath(input) !== '/api/v1/knowledge-base/demo-readonly' ||
          ((init?.method ?? 'GET') === 'GET' && init?.body === undefined),
      ),
    ).toBe(true);
  });

  it('机构工作台知识库只读入口ready 入口展示演示分层和 demo preview 边界', async () => {
    mockWorkspaceFetch({
      knowledgeBaseDemoReadonlyResponse: buildKnowledgeBaseDemoReadonlyMockResponse('ready'),
    });
    render(<HospitalPage />);

    const knowledgeBaseEntry = (await screen.findByRole('heading', {
      name: '知识库只读入口',
    })).closest('section');
    const knowledgeBaseEntryView = within(knowledgeBaseEntry as HTMLElement);

    expect(await knowledgeBaseEntryView.findByText('知识库只读入口已就绪')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getAllByText('只读 / 空态').length).toBeGreaterThan(0);
    expect(knowledgeBaseEntryView.getByText('知识库展示结构')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('分类摘要 categories')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('目录摘要 folders')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('知识条目 knowledgeItems')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('只读任务 taskRecords')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('预览 searchPreview')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('当前无真实知识库记录时仅展示空结构，不进行真实查找')).toBeInTheDocument();
    expect(within(knowledgeBaseEntry as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it('机构工作台知识库只读入口搜索展示 ready / empty / error / loading 且只调用 GET', async () => {
    const fetchMock = mockWorkspaceFetch();
    render(<HospitalPage />);

    const knowledgeBaseEntry = (await screen.findByRole('heading', {
      name: '知识库只读入口',
    })).closest('section');
    const knowledgeBaseEntryView = within(knowledgeBaseEntry as HTMLElement);

    expect(await knowledgeBaseEntryView.findByText('知识库只读入口已就绪')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('只读搜索 / 受控本地索引')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByLabelText('知识库只读搜索查询')).toBeInTheDocument();

    fireEvent.change(knowledgeBaseEntryView.getByLabelText('知识库只读搜索查询'), {
      target: { value: '水光 护理' },
    });

    expect(await knowledgeBaseEntryView.findByText('正在加载知识库只读搜索...')).toBeInTheDocument();
    expect(await knowledgeBaseEntryView.findByText('水光术后护理 只读 知识')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('光电治疗恢复 开发数据 知识')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getByText('scoreBand: high')).toBeInTheDocument();
    expect(knowledgeBaseEntryView.getAllByText(/readonly/u).length).toBeGreaterThan(0);

    const searchCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).startsWith('/api/v1/knowledge-base/runtime/search?q='),
    );
    expect(searchCall).toBeDefined();
    expect(new URL(fetchPath(searchCall![0]), 'http://localhost').searchParams.get('q')).toBe(
      '水光 护理',
    );
    expect(searchCall?.[1]).toEqual({ cache: 'no-store' });
    expect(searchCall?.[1]?.method).toBeUndefined();
    expect(searchCall?.[1]?.body).toBeUndefined();
    expect(within(knowledgeBaseEntry as HTMLElement).queryByRole('button')).not.toBeInTheDocument();

    vi.unstubAllGlobals();
    mockWorkspaceFetch({
      knowledgeBaseSearchResponse: {
        status: 'empty',
        readonly: true,
        tenantId: 'demo-tenant-a',
        institutionId: 'demo-inst-a',
        workspaceId: 'demo-workspace-a',
        query: '无结果',
        mode: 'demo_search_mock_embedding',
        resultCount: 0,
        results: [],
      },
    });
    render(<HospitalPage />);
    const emptyEntry = (await screen.findAllByRole('heading', {
      name: '知识库只读入口',
    })).at(-1)?.closest('section');
    const emptyEntryView = within(emptyEntry as HTMLElement);
    fireEvent.change(emptyEntryView.getByLabelText('知识库只读搜索查询'), {
      target: { value: '无结果' },
    });
    expect(await emptyEntryView.findByText('暂无只读搜索结果')).toBeInTheDocument();

    vi.unstubAllGlobals();
    mockWorkspaceFetch({
      knowledgeBaseSearchError: {
        status: 503,
        message: 'worker stack /tmp/demo dependency error',
      },
    });
    render(<HospitalPage />);
    const errorEntry = (await screen.findAllByRole('heading', {
      name: '知识库只读入口',
    })).at(-1)?.closest('section');
    const errorEntryView = within(errorEntry as HTMLElement);
    fireEvent.change(errorEntryView.getByLabelText('知识库只读搜索查询'), {
      target: { value: '错误' },
    });
    expect(await errorEntryView.findByText('知识库只读搜索暂时不可用')).toBeInTheDocument();
    expect(errorEntry?.textContent ?? '').not.toContain('worker');
    expect(errorEntry?.textContent ?? '').not.toContain('/tmp/demo');
    expect(errorEntry?.textContent ?? '').not.toContain('dependency error');

    vi.unstubAllGlobals();
    const pendingFetchMock = mockWorkspaceFetch({ knowledgeBaseSearchPending: true });
    const { unmount } = render(<HospitalPage />);
    const pendingEntry = (await screen.findAllByRole('heading', {
      name: '知识库只读入口',
    })).at(-1)?.closest('section');
    const pendingEntryView = within(pendingEntry as HTMLElement);
    fireEvent.change(pendingEntryView.getByLabelText('知识库只读搜索查询'), {
      target: { value: '等待' },
    });
    expect(await pendingEntryView.findByText('正在加载知识库只读搜索...')).toBeInTheDocument();
    expect(pendingFetchMock).toHaveBeenCalled();
    unmount();
  });

  it('机构工作台 workspace dashboard readonly aggregation ready 入口展示状态和治理分组', async () => {
    mockWorkspaceFetch({
      workspaceDashboardReadonlyAggregationResponse:
        buildWorkspaceDashboardReadonlyAggregationMockResponse('ready'),
    });
    render(<HospitalPage />);

    const readonlyAggregationEntry = (await screen.findByRole('heading', {
      name: 'workspace dashboard readonly aggregation',
    })).closest('section');
    const readonlyAggregationEntryView = within(readonlyAggregationEntry as HTMLElement);

    expect(
      await readonlyAggregationEntryView.findByText(
        'workspace dashboard readonly aggregation 已就绪',
      ),
    ).toBeInTheDocument();
    expect(readonlyAggregationEntryView.getByText('状态总览')).toBeInTheDocument();
    expect(readonlyAggregationEntryView.getByText('status / dashboardStatus')).toBeInTheDocument();
    expect(readonlyAggregationEntryView.getByText('核心聚合摘要')).toBeInTheDocument();
    expect(readonlyAggregationEntryView.getByText('治理提示')).toBeInTheDocument();
    expect(readonlyAggregationEntryView.getByText('只读动作提示')).toBeInTheDocument();
    expect(readonlyAggregationEntryView.getByText('review_business_loop_blockers_readonly')).toBeInTheDocument();
    expect(within(readonlyAggregationEntry as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it('机构工作台两条 readonly demo 链路不展示敏感或 mutation 片段', async () => {
    mockWorkspaceFetch({
      knowledgeBaseDemoReadonlyResponse: buildKnowledgeBaseDemoReadonlyMockResponse('ready'),
      workspaceDashboardReadonlyAggregationResponse:
        buildWorkspaceDashboardReadonlyAggregationMockResponse('ready'),
    });
    render(<HospitalPage />);

    const knowledgeBaseEntry = (await screen.findByRole('heading', {
      name: '知识库只读入口',
    })).closest('section');
    const readonlyAggregationEntry = (await screen.findByRole('heading', {
      name: 'workspace dashboard readonly aggregation',
    })).closest('section');

    await within(knowledgeBaseEntry as HTMLElement).findByText('知识库只读入口已就绪');
    await within(readonlyAggregationEntry as HTMLElement).findByText(
      'workspace dashboard readonly aggregation 已就绪',
    );

    const combinedReadonlyDemoText = [
      knowledgeBaseEntry?.textContent ?? '',
      readonlyAggregationEntry?.textContent ?? '',
    ].join(' ');

    for (const fragment of readonlyDashboardDemoForbiddenFragments) {
      expect(combinedReadonlyDemoText).not.toContain(fragment);
    }
    expect(within(knowledgeBaseEntry as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
    expect(within(readonlyAggregationEntry as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    ['disabled', '知识库只读入口暂未开启', 'disabled / skipped'],
    ['denied', '当前账号没有知识库只读入口访问权限', 'denied / denied'],
    ['empty', '暂无可展示知识库只读入口内容', 'empty / empty'],
  ] as const)(
    '机构工作台知识库只读入口入口展示 %s 状态',
    async (status, label, statusText) => {
      const fetchMock = mockWorkspaceFetch({
        knowledgeBaseDemoReadonlyResponse: buildKnowledgeBaseDemoReadonlyMockResponse(status),
      });
      render(<HospitalPage />);

      const knowledgeBaseEntry = (await screen.findByRole('heading', {
        name: '知识库只读入口',
      })).closest('section');
      const knowledgeBaseEntryView = within(knowledgeBaseEntry as HTMLElement);

      expect((await knowledgeBaseEntryView.findAllByText(label)).length).toBeGreaterThan(0);
      expect(knowledgeBaseEntryView.getByText(statusText)).toBeInTheDocument();
      expect(
        fetchMock.mock.calls.every(
          ([input, init]) =>
            fetchPath(input) !== '/api/v1/knowledge-base/demo-readonly' ||
            ((init?.method ?? 'GET') === 'GET' && init?.body === undefined),
        ),
      ).toBe(true);
    },
  );

  it('机构工作台 workspace dashboard readonly aggregation 展示 loading 状态', async () => {
    mockWorkspaceFetch({ workspaceDashboardReadonlyAggregationPending: true });
    render(<HospitalPage />);

    const readonlyAggregationEntry = (await screen.findByRole('heading', {
      name: 'workspace dashboard readonly aggregation',
    })).closest('section');

    expect(readonlyAggregationEntry).not.toBeNull();
    expect(
      within(readonlyAggregationEntry as HTMLElement).getByText(
        '正在加载 workspace dashboard readonly aggregation...',
      ),
    ).toBeInTheDocument();
  });

  it('机构工作台 workspace dashboard readonly aggregation 展示低敏 error 状态', async () => {
    const fetchMock = mockWorkspaceFetch({
      workspaceDashboardReadonlyAggregationError: {
        status: 503,
        message: 'worker stack /tmp/demo dependency error',
      },
    });
    render(<HospitalPage />);

    const readonlyAggregationEntry = (await screen.findByRole('heading', {
      name: 'workspace dashboard readonly aggregation',
    })).closest('section');
    const readonlyAggregationEntryView = within(readonlyAggregationEntry as HTMLElement);

    expect(
      await readonlyAggregationEntryView.findByText(
        'workspace dashboard readonly aggregation 暂时不可用',
      ),
    ).toBeInTheDocument();
    expect(readonlyAggregationEntry?.textContent ?? '').not.toContain('worker');
    expect(readonlyAggregationEntry?.textContent ?? '').not.toContain('/tmp/demo');
    expect(readonlyAggregationEntry?.textContent ?? '').not.toContain('dependency error');
    expect(
      fetchMock.mock.calls.some(
        ([input]) => fetchPath(input) === '/api/v1/workspace-dashboard/readonly-aggregation',
      ),
    ).toBe(true);
  });

  it('机构工作台 workspace dashboard readonly aggregation 不渲染敏感字段或行动按钮', async () => {
    mockWorkspaceFetch({
      workspaceDashboardReadonlyAggregationResponse:
        buildWorkspaceDashboardReadonlyAggregationUnsafeMockResponse(),
    });
    render(<HospitalPage />);

    const readonlyAggregationEntry = (await screen.findByRole('heading', {
      name: 'workspace dashboard readonly aggregation',
    })).closest('section');

    expect(
      await within(readonlyAggregationEntry as HTMLElement).findByText(
        'workspace dashboard readonly aggregation 已就绪',
      ),
    ).toBeInTheDocument();
    const readonlyAggregationText = readonlyAggregationEntry?.textContent ?? '';
    expect(readonlyAggregationText).toContain('低敏摘要已隐藏');
    expect(readonlyAggregationText).not.toContain('raw');
    expect(readonlyAggregationText).not.toContain('payload');
    expect(readonlyAggregationText).not.toContain('token');
    expect(readonlyAggregationText).not.toContain('secret');
    expect(readonlyAggregationText).not.toContain('credential');
    expect(readonlyAggregationText).not.toContain('HIS');
    expect(readonlyAggregationText).not.toContain('真实客户');
    expect(readonlyAggregationText).not.toContain('张三');
    expect(readonlyAggregationText).not.toContain('13800001252');
    expect(readonlyAggregationText).not.toContain('模型');
    expect(readonlyAggregationText).not.toContain('embedding');
    expect(readonlyAggregationText).not.toContain('vector');
    expect(readonlyAggregationText).not.toContain('retrieval');
    expect(readonlyAggregationText).not.toContain('upload');
    expect(readonlyAggregationText).not.toContain('parse');
    expect(readonlyAggregationText).not.toContain('chunk');
    expect(readonlyAggregationText).not.toContain('创建任务');
    expect(readonlyAggregationText).not.toContain('预约');
    expect(readonlyAggregationText).not.toContain('触达');
    expect(readonlyAggregationText).not.toContain('营销');
    expect(readonlyAggregationText).not.toContain('成交');
    expect(readonlyAggregationText).not.toContain('支付');
    expect(readonlyAggregationText).not.toContain('合同');
    expect(readonlyAggregationText).not.toContain('发票');
    expect(within(readonlyAggregationEntry as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    ['disabled', 'workspace dashboard readonly aggregation 暂未开启', 'disabled / skipped'],
    ['denied', '当前账号没有 workspace dashboard readonly aggregation 访问权限', 'denied / denied'],
    ['empty', '暂无可展示 workspace dashboard readonly aggregation', 'empty / empty'],
    ['partial', 'workspace dashboard readonly aggregation 部分可用', 'partial / partial'],
    ['stale', 'workspace dashboard readonly aggregation 可能已过期', 'stale / stale'],
    ['ready', 'workspace dashboard readonly aggregation 已就绪', 'ready / readonly'],
  ] as const)(
    '机构工作台 workspace dashboard readonly aggregation 展示 %s 状态',
    async (status, label, statusText) => {
      const fetchMock = mockWorkspaceFetch({
        workspaceDashboardReadonlyAggregationResponse:
          buildWorkspaceDashboardReadonlyAggregationMockResponse(status),
      });
      render(<HospitalPage />);

      const readonlyAggregationEntry = (await screen.findByRole('heading', {
        name: 'workspace dashboard readonly aggregation',
      })).closest('section');
      const readonlyAggregationEntryView = within(readonlyAggregationEntry as HTMLElement);

      expect((await readonlyAggregationEntryView.findAllByText(label)).length).toBeGreaterThan(0);
      expect(readonlyAggregationEntryView.getAllByText(statusText).length).toBeGreaterThan(0);
      expect(
        fetchMock.mock.calls.every(
          ([input, init]) =>
            fetchPath(input) !== '/api/v1/workspace-dashboard/readonly-aggregation' ||
            ((init?.method ?? 'GET') === 'GET' && init?.body === undefined),
        ),
      ).toBe(true);
    },
  );

  it('demo seed smoke 支撑机构端开发主线入口、客户、预约、时间线、摘要、随访和审计', async () => {
    const demoSeed = buildDemoSeedWorkspaceSmokeFixtures();
    const fetchMock = mockWorkspaceFetch({
      customers: demoSeed.customers,
      appointments: demoSeed.appointments,
      followups: demoSeed.followups,
      treatmentSummaries: demoSeed.treatmentSummaries,
      auditEvents: demoSeed.auditEvents,
      timeline: demoSeed.shenZhixiaTimeline,
      followUpSourceResponses: demoSeed.followUpSourceResponses,
      followUpSuggestions: [],
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByRole('heading', { name: /今日治疗后随访重点/ })).toBeInTheDocument();
    expect(screen.getByText('待人工确认的后续动作')).toBeInTheDocument();
    await expectMetric('客户总数', '8');
    await expectMetric('待确认预约', '1');
    await expectMetric('待处理随访', '2');
    expect(await screen.findByText('顾安然：D2 术后重点关怀')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));
    expect(await screen.findByText('沈知夏')).toBeInTheDocument();
    expect(screen.getByText('叶舒颜')).toBeInTheDocument();
    expect(screen.getByText('唐以沫')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 沈知夏' }));
    const drawer = await screen.findByRole('dialog', { name: '客户详情时间线' });
    expect(within(drawer).getAllByText('沈知夏').length).toBeGreaterThan(0);
    expect(within(drawer).getByText('光子嫩肤治疗预约')).toBeInTheDocument();
    expect(within(drawer).getByText('光子嫩肤 · 术后即时护理')).toBeInTheDocument();
    expect(within(drawer).getAllByText('D3 光子术后回访').length).toBeGreaterThan(0);
    fireEvent.click(within(drawer).getByRole('button', { name: '关闭客户详情' }));

    fireEvent.click(screen.getByRole('button', { name: '预约中心' }));
    expect(await screen.findByText('光子嫩肤治疗')).toBeInTheDocument();
    expect(screen.getByText('预约数据用于串联客户旅程，不代表外部 HIS 已完成同步。')).toBeInTheDocument();
    expect(screen.getByText('水光复诊')).toBeInTheDocument();
    expect(screen.getByText('面诊预约')).toBeInTheDocument();
    expect(screen.getByText('皮肤管理复购面诊')).toBeInTheDocument();
    expect(screen.getAllByText('已完成').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已确认').length).toBeGreaterThan(0);
    expect(screen.getAllByText('待确认').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已取消').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '治疗摘要管理' }));
    expect(await screen.findByText('光子嫩肤')).toBeInTheDocument();
    expect(screen.getByText('射频修复')).toBeInTheDocument();
    expect(screen.getByText('水光术后复查')).toBeInTheDocument();
    expect(screen.getAllByText('可作为运营依据').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已编辑').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已作废').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 TS-005' }));
    const summaryDialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    expect(within(summaryDialog).getAllByText('已作废').length).toBeGreaterThan(0);
    expect(within(summaryDialog).getByText('作废时间')).toBeInTheDocument();
    expect(within(summaryDialog).getByText('作废人')).toBeInTheDocument();
    expect(within(summaryDialog).getAllByText('demo-user-admin').length).toBeGreaterThan(0);
    expect(within(summaryDialog).getByText('作废原因')).toBeInTheDocument();
    expect(within(summaryDialog).getByText('摘要录入依据不完整，仅保留历史追溯')).toBeInTheDocument();
    fireEvent.click(within(summaryDialog).getByRole('button', { name: '查看随访建议' }));
    expect(
      within(summaryDialog).getByText('治疗摘要已作废，不能继续生成随访建议或来源随访任务。'),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => fetchPath(input).includes('/follow-up-tasks'))).toBe(
      false,
    );

    fireEvent.click(screen.getByRole('button', { name: '智能随访' }));
    expect(await screen.findByText('D3 光子术后回访')).toBeInTheDocument();
    expect(screen.getAllByText('来源：治疗摘要').length).toBeGreaterThan(0);
    expect(screen.getAllByText('建议 key 用于来源追踪和避免重复创建。').length).toBeGreaterThan(0);
    expect(screen.getByText('建议 key：TS-006:watch_risk_followup:3d')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '审计日志' }));
    expect(screen.getByText('关键操作可追踪')).toBeInTheDocument();
    expect(await screen.findByText('demo-audit-customer-created-shen')).toBeInTheDocument();
    expect(screen.getByText('demo-audit-treatment-edited-ts004')).toBeInTheDocument();
    expect(await screen.findByText('demo-audit-treatment-voided-ts005')).toBeInTheDocument();
    expect(screen.getByText('原因：treatment_summary_voided')).toBeInTheDocument();
    expect(screen.getByText('demo-audit-follow-up-created-shen')).toBeInTheDocument();
    expect(screen.getByText('demo-audit-role-denied-export')).toBeInTheDocument();
    expect(screen.getByText('demo-audit-quota-denied-appointment')).toBeInTheDocument();
    expectNoSensitiveTreatmentSummaryManagementContent(container);
    expectNoInstitutionDemoMisleadingClaims(container);
  });

  it('demo seed smoke 支撑平台端 4 个租户、3 个当前套餐和 AI 配额边界', async () => {
    const demoSeed = buildDemoSeedWorkspaceSmokeFixtures();
    const fetchMock = mockWorkspaceFetch({
      role: 'platform_admin',
      platformTenants: demoSeed.platformTenants,
      platformAuditEvents: demoSeed.platformAuditEvents,
    });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: '平台总览' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '租户管理' }));

    expect(await screen.findByRole('heading', { name: '租户管理' })).toBeInTheDocument();
    expect(screen.getAllByText('星澜医美中心').length).toBeGreaterThan(0);
    expect(screen.getAllByText('青禾皮肤管理').length).toBeGreaterThan(0);
    expect(screen.getAllByText('澄镜医疗美容').length).toBeGreaterThan(0);
    expect(screen.getAllByText('远山医美连锁').length).toBeGreaterThan(0);
    expect(screen.getByText(/平台侧查看机构、套餐和配额边界/)).toBeInTheDocument();
    expect(screen.getByText(/支持受控开通测试租户并生成授权快照/)).toBeInTheDocument();
    expect(screen.getAllByText('专业版').length).toBeGreaterThan(0);
    expect(screen.getByText('基础版')).toBeInTheDocument();
    expect(screen.getByText('试用版')).toBeInTheDocument();
    expect(screen.queryByText('集团版')).not.toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(
      /\b(Starter|Growth|Trial|Enterprise|Plan)\b/,
    );
    expect(screen.getAllByText('0 / 0').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText('当前未启用 AI 调用配额').length).toBeGreaterThanOrEqual(4);
    expectNoPlatformDemoMisleadingClaims(container);

    expect(screen.queryByRole('heading', { name: '商业化健康' })).not.toBeInTheDocument();
    expect(screen.queryByText(/quota_exceeded_appointments/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/open-platform/tenants', { cache: 'no-store' });
    expect(fetchMock.mock.calls.map(([input]) => fetchPath(input))).not.toContain(
      '/api/open-platform/audit-events?result=denied&limit=100',
    );
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
  });

  it('机构入口 smoke 覆盖治疗摘要管理筛选、分页、安全详情和敏感字段边界', async () => {
    const fetchMock = mockWorkspaceFetch({
      treatmentSummaryPages: [
        {
          records: [treatmentSummaryManagementRecord],
          pageInfo: {
            hasMore: false,
            limit: 50,
            nextCursor: null,
          },
        },
        {
          records: [filteredTreatmentSummaryManagementRecord],
          pageInfo: {
            hasMore: true,
            limit: 1,
            nextCursor: 'cursor_phase14_next',
          },
        },
        {
          records: [nextTreatmentSummaryManagementRecord],
          pageInfo: {
            hasMore: false,
            limit: 1,
            nextCursor: null,
          },
        },
      ],
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '治疗摘要管理' }));

    expect(screen.getByRole('heading', { name: '治疗摘要管理' })).toBeInTheDocument();
    expect(await screen.findByText('Phase14 治疗摘要管理项目')).toBeInTheDocument();
    const initialCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/institution/treatment-summaries',
    );
    expect(initialCall).toBeDefined();
    expect(initialCall?.[1]).toEqual({ cache: 'no-store' });

    fireEvent.change(screen.getByLabelText('客户 ID'), {
      target: { value: 'cust_phase14_filtered' },
    });
    fireEvent.change(screen.getByLabelText('治疗项目'), {
      target: { value: 'Phase14 筛选后治疗摘要' },
    });
    fireEvent.change(screen.getByLabelText('风险等级'), { target: { value: 'watch' } });
    fireEvent.change(screen.getByLabelText('开始时间'), {
      target: { value: '2026-06-01T00:00' },
    });
    fireEvent.change(screen.getByLabelText('结束时间'), {
      target: { value: '2026-06-04T23:59' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    expect(await screen.findByText('Phase14 筛选后治疗摘要')).toBeInTheDocument();
    const filteredCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).startsWith('/api/institution/treatment-summaries?'),
    );
    expect(filteredCall).toBeDefined();
    const filteredUrl = new URL(fetchPath(filteredCall![0]), 'http://localhost');
    expect(filteredUrl.pathname).toBe('/api/institution/treatment-summaries');
    expect([...filteredUrl.searchParams.keys()]).toEqual([
      'customerId',
      'treatmentProject',
      'riskLevel',
      'from',
      'to',
    ]);
    expect(filteredUrl.searchParams.get('customerId')).toBe('cust_phase14_filtered');
    expect(filteredUrl.searchParams.get('treatmentProject')).toBe('Phase14 筛选后治疗摘要');
    expect(filteredUrl.searchParams.get('riskLevel')).toBe('watch');
    expect(filteredUrl.searchParams.get('from')).toBeTruthy();
    expect(filteredUrl.searchParams.get('to')).toBeTruthy();
    expect(filteredUrl.searchParams.get('tenantId')).toBeNull();
    expect(filteredCall?.[1]).toEqual({ cache: 'no-store' });

    fireEvent.click(screen.getByRole('button', { name: '加载更多治疗摘要' }));
    expect(await screen.findByText('Phase14 下一页治疗摘要')).toBeInTheDocument();
    const loadMoreCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).includes('cursor=cursor_phase14_next'),
    );
    expect(loadMoreCall).toBeDefined();
    expect(fetchPath(loadMoreCall![0])).not.toContain('tenantId');
    expect(loadMoreCall?.[1]).toEqual({ cache: 'no-store' });

    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_filtered' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    expect(within(dialog).getAllByText('Phase14 筛选后治疗摘要').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('客户 ID')).toBeInTheDocument();
    expect(within(dialog).getByText('cust_phase14_filtered')).toBeInTheDocument();
    expect(within(dialog).getByText('预约 ID')).toBeInTheDocument();
    expect(within(dialog).getByText('appt_phase5_closeout')).toBeInTheDocument();
    expect(within(dialog).getByText('下一步护理建议')).toBeInTheDocument();

    const treatmentSummaryCalls = fetchMock.mock.calls.filter(([input]) =>
      fetchPath(input).startsWith('/api/institution/treatment-summaries'),
    );
    expect(treatmentSummaryCalls).toHaveLength(3);
    for (const [input, init] of treatmentSummaryCalls) {
      expect(fetchPath(input)).not.toContain('tenantId');
      expect(init?.method ?? 'GET').toBe('GET');
      expect(init?.body).toBeUndefined();
    }
    expect(within(dialog).getByRole('button', { name: '编辑治疗摘要' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '作废治疗摘要' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新增|删除|批量作废/u })).not.toBeInTheDocument();
    expectNoSensitiveTreatmentSummaryManagementContent(container);
  });

  it('机构入口 smoke 覆盖治疗摘要编辑成功、刷新和安全 payload 边界', async () => {
    const fetchMock = mockWorkspaceFetch({
      treatmentSummaryPages: [
        {
          records: [treatmentSummaryManagementRecord],
          pageInfo: {
            hasMore: false,
            limit: 50,
            nextCursor: null,
          },
        },
        {
          records: [editedTreatmentSummaryManagementRecord],
          pageInfo: {
            hasMore: false,
            limit: 50,
            nextCursor: null,
          },
        },
      ],
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '治疗摘要管理' }));
    expect(screen.getByRole('heading', { name: '治疗摘要管理' })).toBeInTheDocument();
    expect(await screen.findByText('Phase14 治疗摘要管理项目')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_management' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    expect(within(dialog).getByRole('button', { name: '编辑治疗摘要' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '编辑治疗摘要' }));
    expect(within(dialog).getByRole('form', { name: '编辑治疗摘要表单' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('治疗时间')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('治疗项目')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('治疗类别')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('治疗阶段')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('恢复阶段')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('风险等级')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('负责人 ID')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('摘要')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('下一步护理建议')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('标签')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('预约 ID')).toBeInTheDocument();
    expect(
      within(dialog).getByText('编辑治疗摘要不会自动修改既有随访任务，也不会重新生成随访建议。'),
    ).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('治疗时间'), {
      target: { value: '2026-06-03T10:00' },
    });
    fireEvent.change(within(dialog).getByLabelText('治疗项目'), {
      target: { value: 'Phase18 编辑后治疗摘要' },
    });
    fireEvent.change(within(dialog).getByLabelText('治疗类别'), {
      target: { value: 'phase18_safe_edit' },
    });
    fireEvent.change(within(dialog).getByLabelText('治疗阶段'), {
      target: { value: 'Phase18 D21 复诊' },
    });
    fireEvent.change(within(dialog).getByLabelText('恢复阶段'), {
      target: { value: 'Phase18 D21' },
    });
    fireEvent.change(within(dialog).getByLabelText('风险等级'), {
      target: { value: 'normal' },
    });
    fireEvent.change(within(dialog).getByLabelText('负责人 ID'), {
      target: { value: 'doctor-phase18' },
    });
    fireEvent.change(within(dialog).getByLabelText('摘要'), {
      target: { value: 'Phase18 编辑摘要：结构化字段已修正。' },
    });
    fireEvent.change(within(dialog).getByLabelText('下一步护理建议'), {
      target: { value: 'Phase18 D28 人工确认恢复状态。' },
    });
    fireEvent.change(within(dialog).getByLabelText('标签'), {
      target: { value: 'Phase18 编辑，安全字段，Phase18 编辑' },
    });
    fireEvent.change(within(dialog).getByLabelText('预约 ID'), {
      target: { value: 'appt_phase18_edit' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存编辑' }));

    expect(await within(dialog).findByText('治疗摘要已更新')).toBeInTheDocument();
    expect((await screen.findAllByText('Phase18 编辑后治疗摘要')).length).toBeGreaterThan(1);
    expect(within(dialog).getAllByText('Phase18 编辑后治疗摘要').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('Phase18 编辑摘要：结构化字段已修正。').length).toBeGreaterThan(
      1,
    );

    expectSafeTreatmentSummaryEditBody(
      requestBodyByMethod(
        fetchMock,
        '/api/institution/treatment-summaries/trt_phase14_management',
        'PATCH',
      ),
    );

    const treatmentSummaryListCalls = fetchMock.mock.calls.filter(
      ([input, init]) =>
        fetchPath(input) === '/api/institution/treatment-summaries' &&
        init?.method === undefined,
    );
    expect(treatmentSummaryListCalls).toHaveLength(2);

    const requestPaths = fetchMock.mock.calls.map(([input]) => fetchPath(input));
    expect(requestPaths.some((path) => path.endsWith('/follow-up-suggestions'))).toBe(false);
    expect(requestPaths.some((path) => path.endsWith('/follow-up-tasks'))).toBe(false);
    expect(screen.queryByRole('button', { name: /删除|批量作废/u })).not.toBeInTheDocument();
    expectNoSensitiveTreatmentSummaryManagementContent(container);
  });

  it('机构入口 smoke 覆盖治疗摘要作废状态展示、来源任务提示和建议阻断', async () => {
    const fetchMock = mockWorkspaceFetch({
      treatmentSummaryPages: [
        {
          records: [treatmentSummaryManagementRecord],
          pageInfo: {
            hasMore: false,
            limit: 50,
            nextCursor: null,
          },
        },
        {
          records: [voidedTreatmentSummaryManagementRecord],
          pageInfo: {
            hasMore: false,
            limit: 50,
            nextCursor: null,
          },
        },
      ],
      followUpSourceResponses: {
        '/api/institution/followups?source=treatment_summary&sourceTreatmentSummaryId=trt_phase14_management': [
          phase16SourceFollowUpTask,
        ],
      },
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '治疗摘要管理' }));
    expect(await screen.findByText('Phase14 治疗摘要管理项目')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_management' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    fireEvent.click(within(dialog).getByRole('button', { name: '作废治疗摘要' }));
    fireEvent.change(within(dialog).getByLabelText('作废原因分类'), {
      target: { value: 'duplicate_summary' },
    });
    fireEvent.change(within(dialog).getByLabelText('作废原因说明'), {
      target: { value: '重复录入，保留较新的治疗摘要' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '确认作废' }));

    expect(await within(dialog).findByText('治疗摘要已作废')).toBeInTheDocument();
    expect(within(dialog).getAllByText('已作废').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('作废时间')).toBeInTheDocument();
    expect(within(dialog).getAllByText('2026-06-02 19:00').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('作废人')).toBeInTheDocument();
    expect(within(dialog).getByText('demo-user-admin')).toBeInTheDocument();
    expect(within(dialog).getByText('作废原因')).toBeInTheDocument();
    expect(within(dialog).getByText('重复录入，保留较新的治疗摘要')).toBeInTheDocument();
    expect(within(dialog).getByText('该治疗摘要已作废，仅保留历史追溯。')).toBeInTheDocument();
    expect(
      within(dialog).getByText('作废摘要不会继续生成新的随访建议或来源随访任务。'),
    ).toBeInTheDocument();
    expect(await within(dialog).findByText('来源治疗摘要已作废')).toBeInTheDocument();
    expect(
      within(dialog).getByText('既有来源随访任务仍保留，不会自动取消或修改任务状态。'),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '查看随访建议' }));
    expect(
      within(dialog).getByText('治疗摘要已作废，不能继续生成随访建议或来源随访任务。'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '确认创建随访任务' })).not.toBeInTheDocument();

    const voidBody = requestBodyByMethod(
      fetchMock,
      '/api/institution/treatment-summaries/trt_phase14_management/void',
      'POST',
    );
    expect(voidBody).toEqual({
      reasonCode: 'duplicate_summary',
      reasonText: '重复录入，保留较新的治疗摘要',
    });
    const serializedBody = JSON.stringify(voidBody);
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('完整治疗记录正文');
    expect(serializedBody).not.toContain('完整病历正文');
    expect(serializedBody).not.toContain('咨询对话全文');
    expect(serializedBody).not.toContain('DATABASE_URL');

    const requestPaths = fetchMock.mock.calls.map(([input]) => fetchPath(input));
    expect(requestPaths).toContain(
      '/api/institution/followups?source=treatment_summary&sourceTreatmentSummaryId=trt_phase14_management',
    );
    expect(requestPaths.some((path) => path.endsWith('/follow-up-suggestions'))).toBe(false);
    expect(requestPaths.some((path) => path.endsWith('/follow-up-tasks'))).toBe(false);
    expect(screen.queryByRole('button', { name: /删除|批量作废/u })).not.toBeInTheDocument();
    expectNoSensitiveTreatmentSummaryManagementContent(container);
  });

  it('机构入口 smoke 覆盖客户 timeline 作废治疗摘要节点和历史追溯提示', async () => {
    const fetchMock = mockWorkspaceFetch({
      timeline: customerTimelineWithVoidedTreatmentSummary,
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));
    expect(await screen.findByText('Phase5 客户A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 Phase5 客户A' }));

    const dialog = await screen.findByRole('dialog', { name: '客户详情时间线' });
    const drawer = within(dialog);
    expect(drawer.getByText('治疗后结构化摘要')).toBeInTheDocument();
    expect(drawer.getAllByText('Phase19 作废时间线摘要').length).toBeGreaterThan(0);
    expect(drawer.getAllByText('已作废').length).toBeGreaterThan(0);
    expect(drawer.getByText('作废不是删除，该治疗摘要仅保留历史追溯。')).toBeInTheDocument();
    expect(drawer.getByText('不再作为后续运营依据，也不会主动向客户发送消息。')).toBeInTheDocument();
    expect(drawer.getAllByText('状态：已作废').length).toBeGreaterThan(0);
    expect(drawer.getByText('Phase19 作废时间线摘要 · Phase19 D7 复核')).toBeInTheDocument();

    const timelineCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/institution/customers/cust_phase5_closeout/timeline',
    );
    expect(timelineCall).toBeDefined();
    expect(timelineCall?.[1]).toEqual({ cache: 'no-store' });
    expect(fetchPath(timelineCall![0])).not.toContain('tenantId');
    expect(timelineCall?.[1]?.method).toBeUndefined();
    expect(timelineCall?.[1]?.body).toBeUndefined();
    expectOnlyInstitutionReadCalls(fetchMock);
    expectNoSensitiveCustomerTimelineContent(container);
  });

  it('机构入口 smoke 覆盖治疗摘要编辑失败后保留输入并隐藏敏感错误', async () => {
    const fetchMock = mockWorkspaceFetch({
      treatmentSummaryUpdateError: {
        status: 503,
        message:
          'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg sql stack token secret',
      },
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '治疗摘要管理' }));
    expect(await screen.findByText('Phase14 治疗摘要管理项目')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_management' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    fireEvent.click(within(dialog).getByRole('button', { name: '编辑治疗摘要' }));

    const summaryInput = within(dialog).getByLabelText('摘要');
    fireEvent.change(summaryInput, {
      target: { value: 'Phase18 失败后仍保留的摘要输入' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存编辑' }));

    expect(await within(dialog).findByText('数据服务暂时不可用')).toBeInTheDocument();
    expect(summaryInput).toHaveValue('Phase18 失败后仍保留的摘要输入');

    expectNoSensitiveTreatmentSummaryManagementContent(container);
    const text = container.textContent ?? '';
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('sql stack');
    expect(text).not.toContain('token');
    expect(text).not.toContain('secret');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('机构入口 smoke 覆盖治疗摘要随访建议人工确认创建', async () => {
    const fetchMock = mockWorkspaceFetch();
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '治疗摘要管理' }));

    expect(await screen.findByText('Phase14 治疗摘要管理项目')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_management' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });

    fireEvent.click(within(dialog).getByRole('button', { name: '查看随访建议' }));

    expect(await within(dialog).findByText('Phase15 关注风险治疗后随访')).toBeInTheDocument();
    expect(
      within(dialog).getByText('建议仅供机构内部参考，需要人工确认后才会创建内部随访任务。'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('请安排人工随访，确认恢复反馈和护理执行情况。')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '确认创建随访任务' }));

    expect(await within(dialog).findByText('已创建内部随访任务')).toBeInTheDocument();
    const suggestionCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).endsWith('/follow-up-suggestions'),
    );
    const createCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).endsWith('/follow-up-tasks'),
    );
    expect(suggestionCall).toBeDefined();
    expect(createCall).toBeDefined();
    expect(fetchPath(suggestionCall![0])).toBe(
      '/api/institution/treatment-summaries/trt_phase14_management/follow-up-suggestions',
    );
    expect(suggestionCall![1]).toEqual({ cache: 'no-store' });
    expect(fetchPath(createCall![0])).toBe(
      '/api/institution/treatment-summaries/trt_phase14_management/follow-up-tasks',
    );
    expect(createCall![1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          suggestionKey: 'trt_phase14_management:watch_risk_followup:3d',
        }),
      }),
    );
    expect(String(createCall![1]?.body)).not.toContain('tenantId');
    expect(String(createCall![1]?.body)).not.toContain('customerId');
    expect(String(createCall![1]?.body)).not.toContain('suggestedAction');
    expectNoSensitiveTreatmentSummaryManagementContent(container);
  });

  it('机构入口 smoke 覆盖治疗路径模板建议展示和人工确认创建', async () => {
    const fetchMock = mockWorkspaceFetch({
      followUpSuggestions: [...phase20TemplateFollowUpSuggestions, treatmentFollowUpSuggestion],
      followUpTaskRecord: phase20TemplateFollowUpCreatedTask,
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '治疗摘要管理' }));

    expect(await screen.findByText('Phase14 治疗摘要管理项目')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_management' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });

    fireEvent.click(within(dialog).getByRole('button', { name: '查看随访建议' }));

    expect(await within(dialog).findByText('术后修复 D1 高风险人工处理')).toBeInTheDocument();
    expect(within(dialog).getAllByText('路径模板建议').length).toBeGreaterThanOrEqual(4);
    expect(within(dialog).getAllByText('来源：治疗项目路径模板').length).toBeGreaterThanOrEqual(4);
    expect(within(dialog).getByText('路径类型：光子 / 光电治疗')).toBeInTheDocument();
    expect(within(dialog).getByText('路径类型：水光 / 注射护理')).toBeInTheDocument();
    expect(within(dialog).getByText('路径类型：术后修复')).toBeInTheDocument();
    expect(within(dialog).getByText('路径类型：皮肤管理')).toBeInTheDocument();
    expect(within(dialog).getByText('Phase15 关注风险治疗后随访')).toBeInTheDocument();

    const templateCard = within(dialog)
      .getByText('术后修复 D1 高风险人工处理')
      .closest('article');
    expect(templateCard).not.toBeNull();
    const templateCardView = within(templateCard as HTMLElement);
    expect(templateCardView.getByText('建议处理角色：运营负责人')).toBeInTheDocument();
    expect(templateCardView.getByText('系统只生成内部随访建议')).toBeInTheDocument();
    expect(templateCardView.getByText('人工确认后创建内部随访任务')).toBeInTheDocument();
    expect(templateCardView.getByText('禁止自动触达客户')).toBeInTheDocument();
    expect(templateCardView.getByText('不自动回复客户')).toBeInTheDocument();
    expect(templateCardView.getByText('不接 AI')).toBeInTheDocument();
    fireEvent.click(
      templateCardView.getByRole('button', { name: '确认创建随访任务' }),
    );

    expect(await within(dialog).findByText('已创建内部随访任务')).toBeInTheDocument();
    const createCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).endsWith('/follow-up-tasks'),
    );
    expect(createCall).toBeDefined();
    expect(fetchPath(createCall![0])).toBe(
      '/api/institution/treatment-summaries/trt_phase14_management/follow-up-tasks',
    );
    expect(createCall![1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          suggestionKey: phase20PostSurgeryTemplateSuggestion.suggestionKey,
        }),
      }),
    );
    expect(String(createCall![1]?.body)).not.toContain('tenantId');
    expect(String(createCall![1]?.body)).not.toContain('customerId');
    expect(String(createCall![1]?.body)).not.toContain('suggestedAction');
    expect(container.textContent ?? '').not.toContain('AI 已接入');
    expect(container.textContent ?? '').not.toContain('AI 自动客服');
    expect(container.textContent ?? '').not.toContain('自动发微信');
    expect(container.textContent ?? '').not.toContain('已接 HIS');
    expect(container.textContent ?? '').not.toContain('已接企微');
    expectNoSensitiveTreatmentSummaryManagementContent(container);
  });

  it('机构入口 smoke 覆盖模板建议重复确认时走来源任务去重治理', async () => {
    const fetchMock = mockWorkspaceFetch({
      followUpSuggestions: [phase20PostSurgeryTemplateSuggestion],
      followUpTaskError: {
        status: 409,
        message: '该护理随访任务已存在，请勿重复创建',
      },
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '治疗摘要管理' }));

    expect(await screen.findByText('Phase14 治疗摘要管理项目')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_management' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });

    fireEvent.click(within(dialog).getByRole('button', { name: '查看随访建议' }));
    expect(await within(dialog).findByText('术后修复 D1 高风险人工处理')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '确认创建随访任务' }));

    expect(
      await within(dialog).findByText('该护理随访任务已存在，请勿重复创建'),
    ).toBeInTheDocument();
    const createCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).endsWith('/follow-up-tasks'),
    );
    expect(createCall).toBeDefined();
    expect(createCall![1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          suggestionKey: phase20PostSurgeryTemplateSuggestion.suggestionKey,
        }),
      }),
    );
    expect(String(createCall![1]?.body)).not.toContain('tenantId');
    expect(String(createCall![1]?.body)).not.toContain('customerId');
    expect(String(createCall![1]?.body)).not.toContain('suggestedAction');
    expectNoSensitiveTreatmentSummaryManagementContent(container);
  });

  it('机构入口 smoke 覆盖重复确认随访任务时展示稳定冲突提示', async () => {
    const fetchMock = mockWorkspaceFetch({
      followUpTaskError: {
        status: 409,
        message: '该护理随访任务已存在，请勿重复创建',
      },
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '治疗摘要管理' }));

    expect(await screen.findByText('Phase14 治疗摘要管理项目')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_management' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });

    fireEvent.click(within(dialog).getByRole('button', { name: '查看随访建议' }));
    expect(await within(dialog).findByText('Phase15 关注风险治疗后随访')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '确认创建随访任务' }));

    expect(
      await within(dialog).findByText('该护理随访任务已存在，请勿重复创建'),
    ).toBeInTheDocument();
    const createCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).endsWith('/follow-up-tasks'),
    );
    expect(createCall).toBeDefined();
    expect(createCall![1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          suggestionKey: 'trt_phase14_management:watch_risk_followup:3d',
        }),
      }),
    );
    expect(String(createCall![1]?.body)).not.toContain('tenantId');
    expect(String(createCall![1]?.body)).not.toContain('customerId');
    expect(String(createCall![1]?.body)).not.toContain('suggestedAction');
    expectNoSensitiveTreatmentSummaryManagementContent(container);
  });

  it('机构入口 smoke 覆盖 Phase16 随访来源筛选和重复任务只读提示', async () => {
    const fetchMock = mockWorkspaceFetch({
      followups: [followUpRecord, phase16SourceFollowUpTask],
      followUpSourceResponses: {
        '/api/institution/followups?source=treatment_summary': [phase16SourceFollowUpTask],
        '/api/institution/followups?source=treatment_summary&sourceTreatmentSummaryId=trt_phase14_management': [
          phase16SourceFollowUpTask,
        ],
      },
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '智能随访' }));

    expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
    expect(await screen.findByText('Phase16 治疗摘要来源随访')).toBeInTheDocument();
    expect(screen.getByText('来源：治疗摘要')).toBeInTheDocument();
    expect(screen.getByText('来源摘要：trt_phase14_management')).toBeInTheDocument();
    expect(
      screen.getByText('建议 key：trt_phase14_management:watch_risk_followup:3d'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('来源筛选'), {
      target: { value: 'treatment_summary' },
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/institution/followups?source=treatment_summary',
        { cache: 'no-store' },
      ),
    );
    expect(await screen.findByText('Phase16 治疗摘要来源随访')).toBeInTheDocument();
    expect(screen.queryByText('Phase5 D7 回访')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '治疗摘要管理' }));
    expect(await screen.findByText('Phase14 治疗摘要管理项目')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看安全详情 trt_phase14_management' }));
    const dialog = await screen.findByRole('dialog', { name: '治疗摘要安全详情' });
    fireEvent.click(within(dialog).getByRole('button', { name: '查看随访建议' }));

    expect(await within(dialog).findByText('Phase15 关注风险治疗后随访')).toBeInTheDocument();
    expect(
      within(dialog).getByText('该建议已有进行中的随访任务，请在智能随访中继续处理。'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('活跃任务状态：处理中')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '已存在活跃随访任务' })).toBeDisabled();

    const sourceRequestPaths = fetchMock.mock.calls
      .map(([input]) => fetchPath(input))
      .filter((path) => path.startsWith('/api/institution/followups?source='));
    expect(sourceRequestPaths).toContain('/api/institution/followups?source=treatment_summary');
    expect(sourceRequestPaths).toContain(
      '/api/institution/followups?source=treatment_summary&sourceTreatmentSummaryId=trt_phase14_management',
    );
    expect(sourceRequestPaths.join('\n')).not.toContain('tenantId');
    expect(
      fetchMock.mock.calls.some(([input]) => fetchPath(input).endsWith('/follow-up-tasks')),
    ).toBe(false);
    expect(container.textContent ?? '').not.toContain('自动发送微信');
    expect(container.textContent ?? '').not.toContain('自动短信');
    expect(container.textContent ?? '').not.toContain('电话外呼');
    expect(container.textContent ?? '').not.toContain('自动触达');
    expectNoSensitiveTreatmentSummaryManagementContent(container);
  });

  it('机构入口 smoke 覆盖客户中心查看详情时间线', async () => {
    const fetchMock = mockWorkspaceFetch();
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));
    expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
    expect(await screen.findByText('Phase5 客户A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看详情 Phase5 客户A' }));

    expect(await screen.findByRole('dialog', { name: '客户详情时间线' })).toBeInTheDocument();
    expect(screen.getAllByText('脱敏手机号：138****1252').length).toBeGreaterThan(0);
    expect(screen.getAllByText('脱敏病历号：MR****525').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Phase5 预约复诊').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Phase5 D7 回访').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Phase5 收尾人工回访').length).toBeGreaterThan(0);
    expect(screen.getByText('治疗后结构化摘要')).toBeInTheDocument();
    expect(screen.getAllByText('Phase12 光电修复').length).toBeGreaterThan(0);
    expect(screen.getByText('治疗时间：2026-06-01 12:10')).toBeInTheDocument();
    expect(screen.getByText('类别：phase12_laser_repair')).toBeInTheDocument();
    expect(screen.getAllByText('阶段：Phase12 D7 复诊').length).toBeGreaterThan(0);
    expect(screen.getByText('恢复：Phase12 D7')).toBeInTheDocument();
    expect(screen.getAllByText('风险：关注').length).toBeGreaterThan(0);
    expect(screen.getByText('负责人：doctor-phase12')).toBeInTheDocument();
    expect(
      screen.getAllByText('Phase12 结构化摘要：恢复稳定，安排补水护理。').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('下一步护理：Phase12 D14 人工回访恢复阶段。')).toBeInTheDocument();
    expect(screen.getAllByText('Phase12 结构化摘要').length).toBeGreaterThan(0);
    expect(screen.getAllByText('术后关怀').length).toBeGreaterThan(0);
    expect(screen.getByText('Phase12 光电修复 · Phase12 D7 复诊')).toBeInTheDocument();
    expect(screen.getByText('审计：read')).toBeInTheDocument();
    expect(screen.getByText('audit_phase7_smoke')).toBeInTheDocument();
    expect(screen.getAllByText('allowed / allowed_by_policy').length).toBeGreaterThan(0);

    const timelineCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/institution/customers/cust_phase5_closeout/timeline',
    );
    expect(timelineCall).toBeDefined();
    expect(timelineCall?.[1]).toEqual({ cache: 'no-store' });
    expect(fetchPath(timelineCall![0])).not.toContain('tenantId');
    expect(timelineCall?.[1]?.method).toBeUndefined();
    expect(timelineCall?.[1]?.body).toBeUndefined();
    expectOnlyInstitutionReadCalls(fetchMock);
    expectNoSensitiveCustomerTimelineContent(container);

    fireEvent.click(screen.getByRole('button', { name: '关闭客户详情' }));
    expect(screen.queryByRole('dialog', { name: '客户详情时间线' })).not.toBeInTheDocument();
    expect(screen.getByText('Phase5 客户A')).toBeInTheDocument();
  });

  it('机构入口 smoke 覆盖客户详情治疗摘要空态', async () => {
    mockWorkspaceFetch({
      timeline: {
        ...customerTimelineResponse,
        treatmentSummaries: [],
        timeline: customerTimelineResponse.timeline.filter(
          (event) => event.type !== 'treatment_summary',
        ),
      },
    });
    render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));
    expect(await screen.findByText('Phase5 客户A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 Phase5 客户A' }));

    expect(await screen.findByRole('dialog', { name: '客户详情时间线' })).toBeInTheDocument();
    expect(screen.getByText('治疗后结构化摘要')).toBeInTheDocument();
    expect(screen.getByText('暂无治疗后结构化摘要')).toBeInTheDocument();
  });

  it('机构入口 smoke 覆盖治疗摘要结构化录入成功后刷新时间线', async () => {
    const fetchMock = mockWorkspaceFetch({
      timeline: [customerTimelineResponse, customerTimelineAfterPhase13Create],
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));
    expect(await screen.findByText('Phase5 客户A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 Phase5 客户A' }));

    const drawer = await screen.findByRole('dialog', { name: '客户详情时间线' });
    const drawerView = within(drawer);
    fireEvent.click(drawerView.getByRole('button', { name: '添加治疗摘要' }));

    expect(drawerView.getByLabelText('治疗时间')).toBeInTheDocument();
    expect(drawerView.getByLabelText('治疗项目')).toBeInTheDocument();
    expect(drawerView.getByLabelText('治疗类别')).toBeInTheDocument();
    expect(drawerView.getByLabelText('治疗阶段')).toBeInTheDocument();
    expect(drawerView.getByLabelText('恢复阶段')).toBeInTheDocument();
    expect(drawerView.getByLabelText('风险等级')).toBeInTheDocument();
    expect(drawerView.getByLabelText('负责人 ID')).toBeInTheDocument();
    expect(drawerView.getByLabelText('摘要')).toBeInTheDocument();
    expect(drawerView.getByLabelText('下一步护理')).toBeInTheDocument();
    expect(drawerView.getByLabelText('标签')).toBeInTheDocument();
    expect(drawerView.getByLabelText('关联预约 ID（可选）')).toBeInTheDocument();
    expect(drawer.textContent ?? '').not.toContain('完整治疗记录正文入口');
    expect(drawer.textContent ?? '').not.toContain('完整病历正文入口');
    expect(drawer.textContent ?? '').not.toContain('咨询全文入口');
    expect(drawer.querySelector('input[type="file"]')).toBeNull();
    expect(drawer.textContent ?? '').not.toContain('AI 生成');

    fillTreatmentSummaryForm(drawer);
    fireEvent.click(drawerView.getByRole('button', { name: '保存治疗摘要' }));

    expect(await screen.findByText('治疗摘要已添加')).toBeInTheDocument();
    expect(await screen.findByText('Phase13 水光补水复诊 · Phase13 D14 复诊')).toBeInTheDocument();
    expect(screen.getAllByText('Phase13 水光补水复诊').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Phase13 结构化摘要：恢复稳定，安排补水。').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Phase13 结构化摘要').length).toBeGreaterThan(0);

    expectSafeTreatmentSummaryBody(
      mutationBody(
        fetchMock,
        '/api/institution/customers/cust_phase5_closeout/treatment-summaries',
      ),
    );
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => fetchPath(input) === '/api/institution/customers/cust_phase5_closeout/timeline',
      ),
    ).toHaveLength(2);
    expectNoSensitiveCustomerTimelineContent(container);
  });

  it('机构入口 smoke 覆盖治疗摘要提交失败后保留输入并隐藏敏感错误', async () => {
    const fetchMock = mockWorkspaceFetch({
      treatmentSummaryMutationError: {
        status: 503,
        message:
          'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret 连接串',
      },
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));
    expect(await screen.findByText('Phase5 客户A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 Phase5 客户A' }));

    const drawer = await screen.findByRole('dialog', { name: '客户详情时间线' });
    const drawerView = within(drawer);
    fireEvent.click(drawerView.getByRole('button', { name: '添加治疗摘要' }));
    fillTreatmentSummaryForm(drawer);
    fireEvent.click(drawerView.getByRole('button', { name: '保存治疗摘要' }));

    expect(await screen.findByText('数据服务暂时不可用')).toBeInTheDocument();
    expect(drawerView.getByLabelText('治疗项目')).toHaveValue('Phase13 水光补水复诊');
    expectSafeTreatmentSummaryBody(
      mutationBody(
        fetchMock,
        '/api/institution/customers/cust_phase5_closeout/treatment-summaries',
      ),
    );
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => fetchPath(input) === '/api/institution/customers/cust_phase5_closeout/timeline',
      ),
    ).toHaveLength(1);

    const text = container.textContent ?? '';
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('stack');
    expect(text).not.toContain('token');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('连接串');
  });

  it('机构入口 smoke 覆盖客户创建配额错误态', async () => {
    const fetchMock = mockWorkspaceFetch({
      customers: [],
      institutionMutationError: {
        path: '/api/institution/customers',
        status: 409,
        message:
          'quota_exceeded_customers DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret',
      },
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));

    expect(await screen.findByText('暂无客户记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: 'Phase10 客户' } });
    fireEvent.change(screen.getByLabelText('负责人 ID'), { target: { value: 'consultant-phase10' } });
    fireEvent.change(screen.getByLabelText('项目兴趣'), { target: { value: 'Phase10 修复项目' } });
    fireEvent.change(screen.getByLabelText('脱敏手机号展示值'), { target: { value: '138****1010' } });
    fireEvent.change(screen.getByLabelText('脱敏病历号展示值'), { target: { value: 'MR****010' } });
    fireEvent.change(screen.getByLabelText('最近触达摘要'), { target: { value: 'Phase10 收尾验证' } });
    fireEvent.change(screen.getByLabelText('下一步动作'), { target: { value: '联系平台管理员' } });
    fireEvent.click(screen.getByRole('button', { name: '创建客户' }));

    expect(
      await screen.findByText('当前套餐的客户数量已达上限，请联系平台管理员调整套餐或配额。'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('客户姓名')).toHaveValue('Phase10 客户');

    const serializedBody = JSON.stringify(mutationBody(fetchMock, '/api/institution/customers'));
    const text = container.textContent ?? '';

    expect(serializedBody).not.toContain('tenantId');
    expect(text).not.toContain('quota_exceeded_customers');
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('stack');
    expect(text).not.toContain('token');
    expect(text).not.toContain('secret');
  });

  it('机构入口 smoke 覆盖预约创建配额错误态', async () => {
    const fetchMock = mockWorkspaceFetch({
      appointments: [],
      institutionMutationError: {
        path: '/api/institution/appointments',
        status: 409,
        message: 'missing_quota_limit DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret',
      },
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '预约中心' }));

    expect(await screen.findByText('暂无可串联的预约记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('预约客户'), { target: { value: 'cust_phase5_closeout' } });
    fireEvent.change(screen.getByLabelText('预约项目'), { target: { value: 'Phase10 复诊' } });
    fireEvent.change(screen.getByLabelText('预约时间'), { target: { value: '2026-06-01T10:30:00+08:00' } });
    fireEvent.change(screen.getByLabelText('顾问 ID'), { target: { value: 'consultant-phase10' } });
    fireEvent.change(screen.getByLabelText('预约备注'), { target: { value: 'Phase10 收尾验证' } });
    fireEvent.click(screen.getByRole('button', { name: '新建预约' }));

    expect(
      await screen.findByText('当前机构套餐配额未配置完整，暂不能新增数据，请联系平台管理员。'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('预约项目')).toHaveValue('Phase10 复诊');

    const serializedBody = JSON.stringify(mutationBody(fetchMock, '/api/institution/appointments'));
    const text = container.textContent ?? '';

    expect(serializedBody).not.toContain('tenantId');
    expect(text).not.toContain('missing_quota_limit');
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('stack');
    expect(text).not.toContain('token');
    expect(text).not.toContain('secret');
  });

  it('机构导航清晰标注开发主线和后续入口', async () => {
    const fetchMock = mockWorkspaceFetch();
    render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    expect(screen.getAllByText('开发主线').length).toBeGreaterThanOrEqual(8);
    expect(screen.getAllByText('后续').length).toBeGreaterThanOrEqual(4);

    fireEvent.click(screen.getByRole('button', { name: '客服工作台' }));
    expect(screen.getByText('客服工作台暂不进入本次开发主线')).toBeInTheDocument();
    expect(
      screen.getByText('本次主线：工作台、客户中心、预约中心、智能随访、治疗摘要管理、审计日志、HIS 连接配置、知识库只读列表。'),
    ).toBeInTheDocument();
    expect(screen.getByText('后续：客服工作台、数据分析。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '知识库' }));
    expect(await screen.findByRole('heading', { name: '知识库' })).toBeInTheDocument();
    expect(await screen.findByText('工作台授权知识库')).toBeInTheDocument();
    expect(screen.getByText('机构端只读低敏摘要。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '数据分析' }));
    expect(screen.getByText('数据分析暂不进入本次开发主线')).toBeInTheDocument();
    expectNoInstitutionMutation(fetchMock);
  });

  it('机构端移动导航可切换开发主线业务页', async () => {
    const fetchMock = mockWorkspaceFetch();
    render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '移动导航：客户中心' }));
    expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
    expect(await screen.findByText('Phase5 客户A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '移动导航：预约中心' }));
    expect(screen.getByRole('heading', { name: '预约中心' })).toBeInTheDocument();
    expect(await screen.findByText('Phase5 预约复诊')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '移动导航：智能随访' }));
    expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
    expect(await screen.findByText('Phase5 D7 回访')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '移动导航：治疗摘要管理' }));
    expect(screen.getByRole('heading', { name: '治疗摘要管理' })).toBeInTheDocument();
    expect(await screen.findByText('Phase14 治疗摘要管理项目')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '移动导航：审计日志' }));
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(await screen.findByText('audit_phase8_institution')).toBeInTheDocument();
    expectOnlyInstitutionReadCalls(fetchMock);
  });

  it('机构入口 smoke 覆盖 HIS 连接配置只读入口、安全摘要和敏感字段边界', async () => {
    const fetchMock = mockWorkspaceFetch();
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'HIS 连接配置' }));

    expect(await screen.findByRole('heading', { name: 'HIS 连接配置' })).toBeInTheDocument();
    expect((await screen.findAllByText('星澜 HIS 只读连接')).length).toBeGreaterThan(0);
    expect(screen.getByText('草稿 HIS 连接')).toBeInTheDocument();
    expect(screen.getAllByText('来源系统：his').length).toBeGreaterThan(0);
    expect(screen.getAllByText('厂商类型：demo_vendor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('系统类型：his').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已启用').length).toBeGreaterThan(0);
    expect(screen.getAllByText('草稿').length).toBeGreaterThan(0);
    expect(screen.getAllByText('正常').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未检查').length).toBeGreaterThan(0);
    expect(screen.getAllByText('凭证已配置').length).toBeGreaterThan(0);
    expect(screen.getAllByText('凭证未配置').length).toBeGreaterThan(0);
    expect(screen.getAllByText('最近检查：2026-06-03T08:30:00.000Z').length).toBeGreaterThan(0);
    expect(screen.getAllByText('最近错误码：SAFE_TIMEOUT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('创建时间：2026-06-03T08:00:00.000Z').length).toBeGreaterThan(0);
    expect(screen.getAllByText('更新时间：2026-06-03T08:20:00.000Z').length).toBeGreaterThan(0);
    expect(screen.getAllByText('撤销时间：未记录').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '安全详情' })).toBeInTheDocument();
    expect(screen.getByText('配置凭证、测试连接、启停连接需后续单独实现。')).toBeInTheDocument();
    expect(
      screen.getByText('这些状态只是后端只读状态展示，不代表测试连接或真实 HIS 调用已实现。'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/institution/his-connections', {
        cache: 'no-store',
      });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/institution/his-connections/his_conn_active',
        { cache: 'no-store' },
      );
    });
    expectOnlyHisConnectionReadCalls(fetchMock);
    expectNoSensitiveHisConnectionContent(container);
    expectNoHisConnectionWriteActionButtons();
    expect(
      fetchMock.mock.calls.some(([input]) => /^https?:\/\//u.test(fetchPath(input))),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        /wecom|wechat|openai|rag|agent|follow-up-tasks/u.test(fetchPath(input)),
      ),
    ).toBe(false);
  });

  it('机构入口 smoke 覆盖 HIS 连接配置空态', async () => {
    const fetchMock = mockWorkspaceFetch({ hisConnections: [] });
    render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'HIS 连接配置' }));
    expect(await screen.findByText('暂无 HIS 连接配置')).toBeInTheDocument();
    expect(
      screen.getByText('当前机构尚未登记连接配置。配置凭证、测试连接和启停连接需后续单独实现。'),
    ).toBeInTheDocument();
    expectOnlyHisConnectionReadCalls(fetchMock);
  });

  it('机构入口 smoke 覆盖 HIS 连接配置加载失败稳定文案', async () => {
    const fetchMock = mockWorkspaceFetch({
      hisConnectionListError: {
        status: 503,
        message: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret',
      },
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'HIS 连接配置' }));
    expect(await screen.findByText('HIS 连接配置暂时不可用')).toBeInTheDocument();
    expectNoSensitiveHisConnectionContent(container);
    expectOnlyHisConnectionReadCalls(fetchMock);
  });

  it('机构入口 smoke 覆盖审计日志入口和敏感字段边界', async () => {
    const fetchMock = mockWorkspaceFetch();
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '审计日志' }));

    expect(await screen.findByText('audit_phase8_institution')).toBeInTheDocument();
    expect(screen.getByText('资源类型：customer')).toBeInTheDocument();
    expect(screen.getByText('操作：update')).toBeInTheDocument();
    expect(screen.getByText('结果：allowed')).toBeInTheDocument();
    expect(screen.queryByText('租户 ID：demo-tenant-001')).not.toBeInTheDocument();

    const auditCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/institution/audit-events',
    );
    expect(auditCall).toBeDefined();
    expect(auditCall?.[1]).toEqual({ cache: 'no-store' });
    expect(fetchPath(auditCall![0])).not.toContain('tenantId');
    expect(auditCall?.[1]?.method).toBeUndefined();
    expect(auditCall?.[1]?.body).toBeUndefined();

    fireEvent.change(screen.getByLabelText('资源 ID'), { target: { value: 'cust_phase5_closeout' } });
    fireEvent.change(screen.getByLabelText('操作者 ID'), { target: { value: 'demo-user-admin' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          fetchPath(input).startsWith('/api/institution/audit-events?'),
        ),
      ).toBe(true),
    );
    const filteredAuditCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).startsWith('/api/institution/audit-events?'),
    );
    const filteredAuditPath = fetchPath(filteredAuditCall![0]);
    expect(filteredAuditPath).toContain('resourceId=cust_phase5_closeout');
    expect(filteredAuditPath).toContain('actorId=demo-user-admin');
    expect(filteredAuditPath).not.toContain('tenantId');
    expect(filteredAuditCall?.[1]).toEqual({ cache: 'no-store' });
    expectOnlyInstitutionReadCalls(fetchMock);
    expectNoSensitiveAuditContent(container);
  });

  it('机构工作台首页展示空状态', async () => {
    const fetchMock = mockWorkspaceFetch({
      customers: [],
      appointments: [],
      followups: [],
      followUpPathAnalysis: {
        ...followUpPathAnalysisRecord,
        templateSuggestionCount: 0,
        confirmedSourceTaskCount: 0,
        completedTaskCount: 0,
        overdueTaskCount: 0,
        voidedSummaryBlockedCount: 0,
        duplicateSourceTaskConflictCount: 0,
        warnings: [],
      },
    });
    render(<HospitalPage />);

    expect(await screen.findByText('当前为 API 数据')).toBeInTheDocument();
    expect(await screen.findByText('暂无可计算运营摘要')).toBeInTheDocument();
    await expectMetric('客户总数', '0');
    await expectMetric('高优先级客户', '0');
    await expectMetric('待确认预约', '0');
    await expectMetric('待处理随访', '0');
    await expectMetric('模板建议数', '0');
    expect(screen.getByText('暂无随访路径运营指标')).toBeInTheDocument();
    expect(screen.getByText('当前没有客户、预约或随访任务可进入运营视图。')).toBeInTheDocument();
    expect(screen.getByText('当前没有可展示的待处理行动。')).toBeInTheDocument();
    expectNoInstitutionMutation(fetchMock);
  });

  it('机构工作台首页处理随访路径运营分析 API 失败态且不泄露错误详情', async () => {
    const fetchMock = mockWorkspaceFetch({
      followUpPathAnalysisError: {
        status: 503,
        message: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret',
      },
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('随访路径运营分析暂时无法加载')).toBeInTheDocument();
    expect(screen.getByText('请稍后刷新页面，当前模块不会影响客户、预约和随访摘要。')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('DATABASE_URL');
    expect(container.textContent ?? '').not.toContain('postgres://');
    expect(container.textContent ?? '').not.toContain('stack');
    expect(container.textContent ?? '').not.toContain('token');
    expect(container.textContent ?? '').not.toContain('secret');
    expectNoInstitutionMutation(fetchMock);
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有访问机构首页数据的权限'],
    [503, '数据服务暂时不可用', '数据服务暂时不可用，请稍后刷新或切换到开发空态'],
  ])('机构工作台首页处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    const fetchMock = mockWorkspaceFetch({
      institutionError: {
        path: '/api/institution/customers',
        status,
        message: apiMessage,
      },
    });
    render(<HospitalPage />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expect(screen.queryByText('今日高意向客户 18 位')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 已按承接优先级排序')).not.toBeInTheDocument();
    expect(screen.queryByText('实时同步')).not.toBeInTheDocument();
    expectNoInstitutionMutation(fetchMock);
  });

  it('渲染平台控制台页面壳', async () => {
    mockWorkspaceFetch({ role: 'platform_admin' });
    render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: '平台总览' })).toBeInTheDocument();
    expect(screen.getByText('有效套餐覆盖率')).toBeInTheDocument();
    expect(screen.getByText('拒绝审计信号')).toBeInTheDocument();
    expect(screen.getByText('治理工作队列')).toBeInTheDocument();
    expect(screen.getByText('能力边界')).toBeInTheDocument();
    expect(screen.queryByText('平台收尾趋势参考')).not.toBeInTheDocument();
    expect(screen.queryByText('系统健康状态')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 调用趋势')).not.toBeInTheDocument();
    expect(screen.queryByText('本轮范围')).not.toBeInTheDocument();
    expect(screen.queryByText('历史参考视图')).not.toBeInTheDocument();
    expect(screen.queryByText('服务状态参考')).not.toBeInTheDocument();
    expect(screen.queryByText('预警与待办')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '平台总览' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '首页与品牌' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '平台审计日志' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '平台端移动导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：开放连接路线' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出平台' })).toBeInTheDocument();
    const overviewHero = screen.getByRole('heading', { name: '平台总览' }).closest('section');
    expect(overviewHero).not.toBeNull();
    expect(overviewHero).toHaveClass('rounded-xl', 'py-4', 'lg:py-5');
    expect(screen.getByRole('heading', { name: '平台总览' })).toHaveClass('text-2xl', 'sm:text-[28px]');
    expect(within(overviewHero as HTMLElement).queryByText('真实库数据')).not.toBeInTheDocument();
    expect(within(overviewHero as HTMLElement).queryByText('受控示例')).not.toBeInTheDocument();
    expect(within(overviewHero as HTMLElement).queryByText('长期路线')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '开放平台基础治理' })).not.toBeInTheDocument();
    expect(screen.queryByText('服务端租户上下文')).not.toBeInTheDocument();
    expect(screen.queryByText('权限样例矩阵')).not.toBeInTheDocument();
    expect(screen.queryByText('审计事件词汇')).not.toBeInTheDocument();
  });

  it('平台总览在无租户时展示真实零值而不是静态演示指标', async () => {
    const fetchMock = mockWorkspaceFetch({ role: 'platform_admin', platformTenants: [] });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: '平台总览' })).toBeInTheDocument();

    const metricSection = screen.getByLabelText('核心运营指标');
    expect(within(metricSection).getByText('活跃租户数')).toBeInTheDocument();
    expect(within(metricSection).getByText('有效套餐覆盖率')).toBeInTheDocument();
    expect(within(metricSection).getByText('0%')).toBeInTheDocument();
    expect(within(metricSection).getByText('0 / 0 个活跃租户')).toBeInTheDocument();
    expect(within(metricSection).getAllByText('0')).toHaveLength(5);
    expect(metricSection.textContent).not.toContain('18');
    expect(metricSection.textContent).not.toContain('83%');
    expect(metricSection.textContent).not.toContain('配额拒绝 5');
    expect(screen.getByText('暂无配置缺失租户')).toBeInTheDocument();
    expect(screen.getByText('暂无配额风险')).toBeInTheDocument();
    expect(screen.getByText('平台审计日志已清空或未接入本页聚合')).toBeInTheDocument();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/open-platform/tenants', { cache: 'no-store' }),
    );
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
  });

  it('平台端桌面侧边栏默认展开，可收起为固定图标栏并保持栏目切换', async () => {
    const fetchMock = mockWorkspaceFetch({ role: 'platform_admin' });
    render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: '平台总览' })).toBeInTheDocument();

    const sidebar = screen.getByLabelText('平台端侧边栏');
    const mainContent = screen.getByLabelText('平台端主内容');
    const topbar = screen.getByLabelText('平台端顶栏');
    const desktopNav = screen.getByRole('navigation', { name: '平台端桌面导航' });
    const collapseButton = screen.getByRole('button', { name: '收起侧边栏' });
    const brandArea = screen.getByLabelText('平台端品牌区');
    const brandLogo = brandArea.querySelector('img');

    expect(sidebar).toHaveAttribute('data-sidebar-state', 'expanded');
    expect(sidebar).toHaveClass('fixed', 'md:w-[228px]');
    expect(mainContent).toHaveClass('md:pl-[228px]');
    expect(topbar).toHaveClass('fixed', 'top-0', 'right-0', 'md:left-[228px]');
    expect(brandArea).toHaveClass('w-[228px]');
    expect(brandLogo).toHaveClass('h-12', 'w-12');
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    expect(within(desktopNav).getByText('租户管理')).toBeInTheDocument();

    fireEvent.click(collapseButton);

    expect(sidebar).toHaveAttribute('data-sidebar-state', 'collapsed');
    expect(sidebar).toHaveClass('fixed', 'md:w-16');
    expect(mainContent).toHaveClass('md:pl-16');
    expect(topbar).toHaveClass('fixed', 'top-0', 'right-0', 'md:left-16');
    expect(screen.getByRole('button', { name: '展开侧边栏' })).toHaveAttribute('aria-expanded', 'false');
    expect(brandArea).toHaveClass('w-[228px]');
    expect(within(brandArea).getByText('智美天工管理后台')).toBeInTheDocument();
    expect(within(brandArea).getByText('平台控制台')).toBeInTheDocument();
    expect(within(desktopNav).queryByText('租户管理')).not.toBeInTheDocument();

    fireEvent.click(within(desktopNav).getByRole('button', { name: '租户管理' }));

    expect(await screen.findByRole('heading', { name: '租户管理' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/open-platform/tenants', { cache: 'no-store' });

    fireEvent.click(screen.getByRole('button', { name: '展开侧边栏' }));

    expect(sidebar).toHaveAttribute('data-sidebar-state', 'expanded');
    expect(sidebar).toHaveClass('md:w-[228px]');
    expect(mainContent).toHaveClass('md:pl-[228px]');
    expect(topbar).toHaveClass('fixed', 'top-0', 'right-0', 'md:left-[228px]');
    expect(screen.getByRole('button', { name: '收起侧边栏' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(desktopNav).getByText('租户管理')).toBeInTheDocument();
  });

  it('平台端租户管理入口接入租户 API 并展示套餐配额摘要', async () => {
    const fetchMock = mockWorkspaceFetch({ role: 'platform_admin' });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: '平台总览' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '租户管理' }));

    expect(screen.getByText('正在加载租户管理数据...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '租户管理' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '商业化健康' })).not.toBeInTheDocument();
    expect(screen.queryByText('套餐覆盖率')).not.toBeInTheDocument();
    expect(screen.queryByText('暂无需要收尾关注的商业化健康信号')).not.toBeInTheDocument();
    expect(screen.getAllByText('智美天工演示机构').length).toBeGreaterThan(0);
    expect(screen.getByText('运行中')).toBeInTheDocument();
    expect(screen.getByText('成长版')).toBeInTheDocument();
    expect(screen.getByText('套餐编号：growth-care')).toBeInTheDocument();
    expect(screen.getByText('24 / 5000')).toBeInTheDocument();
    expect(screen.getByText('12 / 2000')).toBeInTheDocument();
    expect(screen.getByText('36 / 10000')).toBeInTheDocument();
    expect(screen.getByText('0 / 50000')).toBeInTheDocument();
    expect(screen.getByText('快照时间：2026年5月31日 16:00')).toBeInTheDocument();

    const tenantCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/open-platform/tenants',
    );
    expect(tenantCall).toBeDefined();
    expect(tenantCall?.[1]).toEqual({ cache: 'no-store' });
    expect(tenantCall?.[1]?.method).toBeUndefined();
    expect(tenantCall?.[1]?.body).toBeUndefined();
    const commercialHealthAuditCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/open-platform/audit-events?result=denied&limit=100',
    );
    expect(commercialHealthAuditCall).toBeUndefined();
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
  });

  it('平台端租户管理入口不再展示旧商业化健康卡片或审计信号', async () => {
    const fetchMock = mockWorkspaceFetch({
      role: 'platform_admin',
      platformTenants: [platformCommercialRiskTenant, platformCommercialMissingTenant],
      platformAuditEvents: [platformQuotaDeniedAuditEventRecord],
    });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: '平台总览' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '租户管理' }));

    expect(await screen.findByRole('heading', { name: '租户管理' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '商业化健康' })).not.toBeInTheDocument();
    expect(screen.queryByText('只读运营辅助')).not.toBeInTheDocument();
    expect(screen.queryByText('套餐覆盖率')).not.toBeInTheDocument();
    expect(screen.queryByText(/quota denied/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Phase11 配额风险机构').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Phase11 配置缺失机构').length).toBeGreaterThan(0);

    expect(fetchMock).toHaveBeenCalledWith('/api/open-platform/tenants', { cache: 'no-store' });
    expect(fetchMock.mock.calls.map(([input]) => fetchPath(input))).not.toContain(
      '/api/open-platform/audit-events?result=denied&limit=100',
    );
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
    expectNoPlatformDemoMisleadingClaims(container);
  });

  it('平台端租户管理入口展示 empty 状态', async () => {
    const fetchMock = mockWorkspaceFetch({ role: 'platform_admin', platformTenants: [] });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: '平台总览' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '租户管理' }));

    expect(await screen.findByText('暂无租户记录')).toBeInTheDocument();
    expect(screen.getByText('当前没有可展示的租户、套餐或配额快照。')).toBeInTheDocument();
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
  });

  it.each([
    [403, '没有访问权限', '当前账号没有查看租户管理的权限'],
    [503, '数据服务暂时不可用', '租户治理视图暂时不可用，请稍后刷新或切换到开发空态'],
  ])('平台端租户管理入口处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    const fetchMock = mockWorkspaceFetch({
      role: 'platform_admin',
      platformTenantError: { status, message: apiMessage },
    });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: '平台总览' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '租户管理' }));

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
  });

  it('平台端平台审计日志入口只展示审计日志并保持敏感字段边界', async () => {
    const fetchMock = mockWorkspaceFetch({ role: 'platform_admin' });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: '平台总览' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '平台审计日志' }));

    expect(await screen.findByRole('heading', { name: '平台审计日志' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '开放平台基础治理' })).not.toBeInTheDocument();
    expect(screen.queryByText('租户隔离原则')).not.toBeInTheDocument();
    expect(screen.queryByText('权限样例矩阵')).not.toBeInTheDocument();
    expect(screen.queryByText('连接生命周期')).not.toBeInTheDocument();
    expect(screen.queryByText('审计事件词汇')).not.toBeInTheDocument();
    expect(screen.getByText(/只展示白名单字段/)).toBeInTheDocument();
    expect(screen.getByText('audit_phase8_platform')).toBeInTheDocument();
    expect(screen.getByText('租户 ID：demo-tenant-001')).toBeInTheDocument();
    expect(screen.getByText('资源类型：客户')).toBeInTheDocument();
    expect(screen.getByText('结果：通过')).toBeInTheDocument();
    expect(screen.getByLabelText('租户 ID')).toBeInTheDocument();

    const auditCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/open-platform/audit-events?limit=10',
    );
    expect(auditCall).toBeDefined();
    expect(auditCall?.[1]).toEqual({ cache: 'no-store' });
    expect(auditCall?.[1]?.method).toBeUndefined();
    expect(auditCall?.[1]?.body).toBeUndefined();

    fireEvent.change(screen.getByLabelText('租户 ID'), { target: { value: 'demo-tenant-001' } });
    fireEvent.change(screen.getByLabelText('资源类型'), { target: { value: 'customer' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) =>
          fetchPath(input).includes('tenantId=demo-tenant-001'),
        ),
      ).toBe(true),
    );
    const filteredAuditCall = fetchMock.mock.calls.find(([input]) =>
      fetchPath(input).includes('tenantId=demo-tenant-001'),
    );
    const filteredAuditPath = fetchPath(filteredAuditCall![0]);
    expect(filteredAuditPath).toContain('/api/open-platform/audit-events?');
    expect(filteredAuditPath).toContain('resource=customer');
    expect(filteredAuditCall?.[1]).toEqual({ cache: 'no-store' });
    expectNoSensitivePlatformAuditContent(container);
  });
});
