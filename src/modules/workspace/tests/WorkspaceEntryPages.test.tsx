import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HospitalPage from '@/app/hospital/page';
import OpenPlatformPage from '@/app/open-platform/page';

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
  platformAuditEvents?: unknown[];
  platformTenants?: unknown[];
  platformTenantError?: {
    status: number;
    message: string;
  };
  timeline?: unknown;
  treatmentSummaryRecord?: unknown;
  treatmentSummaryMutationError?: {
    status: number;
    message: string;
  };
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
    platformAuditEvents = [platformAuditEventRecord],
    platformTenants = [platformTenantRecord],
    platformTenantError,
    timeline = customerTimelineResponse,
    treatmentSummaryRecord = phase13CreatedTreatmentSummary,
    treatmentSummaryMutationError,
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

      if (path === '/api/institution/customers/cust_phase5_closeout/timeline') {
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

async function expectMetric(label: string, value: string) {
  const metricCard = screen.getByText(label).closest('article');
  expect(metricCard).not.toBeNull();
  expect(await within(metricCard as HTMLElement).findByText(value)).toBeInTheDocument();
}

function expectNoInstitutionMutation(fetchMock: ReturnType<typeof mockWorkspaceFetch>) {
  const institutionCalls = fetchMock.mock.calls.filter(([input]) =>
    fetchPath(input).startsWith('/api/institution/'),
  );

  expect(institutionCalls).toHaveLength(3);
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
  expect(text).not.toContain('phase12-raw-secret');
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
  expect(text).not.toContain('自动触达客户');
  expect(text).not.toContain('微信');
  expect(text).not.toContain('企业微信');
  expect(text).not.toContain('企微触达');
  expect(text).not.toContain('短信发送');
  expect(text).not.toContain('发送短信');
  expect(text).not.toContain('电话外呼');
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

    expect(await screen.findByRole('heading', { name: /让咨询团队/ })).toBeInTheDocument();
    expect(screen.getByText('先看到增长机会')).toBeInTheDocument();
    expect(screen.getByText('正在加载机构运营摘要...')).toBeInTheDocument();
    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', { cache: 'no-store' });
    await expectMetric('当前客户摘要', '2');
    await expectMetric('高优先级客户', '1');
    await expectMetric('待确认预约', '1');
    await expectMetric('待处理随访', '1');
    expect(screen.getByText('高风险随访')).toBeInTheDocument();
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
    expect(screen.getByText('客户旅程看板')).toBeInTheDocument();
    expect(screen.getByText('当前行动队列')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/customers', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/appointments', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/followups', { cache: 'no-store' });
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
    expect(screen.getByText('不会调用 AI provider，客户沟通需由人员确认执行。')).toBeInTheDocument();

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

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /新增|删除|作废/u })).not.toBeInTheDocument();
    expectNoSensitiveTreatmentSummaryManagementContent(container);
  });

  it('机构入口 smoke 覆盖治疗摘要随访建议人工确认创建', async () => {
    const fetchMock = mockWorkspaceFetch();
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
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

  it('机构入口 smoke 覆盖重复确认随访任务时展示稳定冲突提示', async () => {
    const fetchMock = mockWorkspaceFetch({
      followUpTaskError: {
        status: 409,
        message: '该护理随访任务已存在，请勿重复创建',
      },
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
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

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
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

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();

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
    expect(screen.getByText('治疗结构化摘要')).toBeInTheDocument();
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

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));
    expect(await screen.findByText('Phase5 客户A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 Phase5 客户A' }));

    expect(await screen.findByRole('dialog', { name: '客户详情时间线' })).toBeInTheDocument();
    expect(screen.getByText('治疗结构化摘要')).toBeInTheDocument();
    expect(screen.getByText('暂无治疗摘要')).toBeInTheDocument();
  });

  it('机构入口 smoke 覆盖治疗摘要结构化录入成功后刷新时间线', async () => {
    const fetchMock = mockWorkspaceFetch({
      timeline: [customerTimelineResponse, customerTimelineAfterPhase13Create],
    });
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
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

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
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

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));

    expect(await screen.findByText('暂无客户摘要')).toBeInTheDocument();
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

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '预约中心' }));

    expect(await screen.findByText('暂无预约记录')).toBeInTheDocument();
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

  it('机构导航清晰标注已接入和后续占位入口', async () => {
    const fetchMock = mockWorkspaceFetch();
    render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
    expect(screen.getAllByText('已接入').length).toBeGreaterThanOrEqual(8);
    expect(screen.getAllByText('后续占位').length).toBeGreaterThanOrEqual(6);

    fireEvent.click(screen.getByRole('button', { name: '客服工作台' }));
    expect(screen.getByText('客服工作台仍为后续占位')).toBeInTheDocument();
    expect(screen.getByText('已真实接入：工作台、客户中心、预约中心、智能随访、治疗摘要管理、审计日志。')).toBeInTheDocument();
    expect(screen.getByText('后续占位：客服工作台、知识库、数据分析。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '知识库' }));
    expect(screen.getByText('知识库仍为后续占位')).toBeInTheDocument();
    expect(screen.getByText('本入口不会在 Phase 6 触发客服、知识库或数据分析真实功能请求。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '数据分析' }));
    expect(screen.getByText('数据分析仍为后续占位')).toBeInTheDocument();
    expectNoInstitutionMutation(fetchMock);
  });

  it('机构端移动导航可切换已接入业务页', async () => {
    const fetchMock = mockWorkspaceFetch();
    render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();

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

  it('机构入口 smoke 覆盖审计日志入口和敏感字段边界', async () => {
    const fetchMock = mockWorkspaceFetch();
    const { container } = render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
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
    });
    render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
    expect(await screen.findByText('暂无可计算运营摘要')).toBeInTheDocument();
    await expectMetric('当前客户摘要', '0');
    await expectMetric('高优先级客户', '0');
    await expectMetric('待确认预约', '0');
    await expectMetric('待处理随访', '0');
    expect(screen.getByText('当前客户、预约和随访 records 为空。')).toBeInTheDocument();
    expect(screen.getByText('当前没有可展示的待处理行动。')).toBeInTheDocument();
    expectNoInstitutionMutation(fetchMock);
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有访问机构首页数据的权限'],
    [503, '数据服务暂时不可用', '数据服务暂时不可用'],
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

    expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
    expect(screen.getByText('让平台运营可观测')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '平台总览' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '首页与品牌' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '权限与审计' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '平台端移动导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：开放连接中心' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出平台' })).toBeInTheDocument();
    expect(screen.getByText('平台增长与调用趋势')).toBeInTheDocument();
    expect(screen.getByText('开放接口治理')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '开放平台基础治理' })).toBeInTheDocument();
    expect(screen.getByText('服务端租户上下文')).toBeInTheDocument();
    expect(screen.getByText('权限样例矩阵')).toBeInTheDocument();
    expect(screen.getByText('审计事件词汇')).toBeInTheDocument();
  });

  it('平台端租户管理入口接入租户 API 并展示套餐配额摘要', async () => {
    const fetchMock = mockWorkspaceFetch({ role: 'platform_admin' });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '租户管理' }));

    expect(screen.getByText('正在加载租户管理数据...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '租户管理' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '商业化健康' })).toBeInTheDocument();
    expect(screen.getByText('套餐覆盖率')).toBeInTheDocument();
    expect(screen.getByText('暂无商业化健康信号')).toBeInTheDocument();
    expect(screen.getByText('智美天工演示机构')).toBeInTheDocument();
    expect(screen.getByText('租户状态：active')).toBeInTheDocument();
    expect(screen.getByText('套餐名称：成长版')).toBeInTheDocument();
    expect(screen.getByText('套餐 code：growth-care')).toBeInTheDocument();
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
    expect(commercialHealthAuditCall).toBeDefined();
    expect(commercialHealthAuditCall?.[1]).toEqual({ cache: 'no-store' });
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
  });

  it('平台端租户管理入口 smoke 覆盖商业化健康信号和安全边界', async () => {
    const fetchMock = mockWorkspaceFetch({
      role: 'platform_admin',
      platformTenants: [platformCommercialRiskTenant, platformCommercialMissingTenant],
      platformAuditEvents: [platformQuotaDeniedAuditEventRecord],
    });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '租户管理' }));

    expect(await screen.findByRole('heading', { name: '商业化健康' })).toBeInTheDocument();
    const commercialHealthSection = screen.getByRole('heading', { name: '商业化健康' }).closest('article');
    expect(commercialHealthSection).not.toBeNull();
    const commercialHealth = commercialHealthSection as HTMLElement;

    expect(within(commercialHealth).getByText('套餐覆盖率')).toBeInTheDocument();
    expect(within(commercialHealth).getByText('50%')).toBeInTheDocument();
    expect(within(commercialHealth).getByText('配额风险项')).toBeInTheDocument();
    expect(within(commercialHealth).getAllByText('配置缺失租户').length).toBeGreaterThan(0);
    expect(within(commercialHealth).getByText('近期 quota denied')).toBeInTheDocument();
    expect(within(commercialHealth).getByText('Phase11 配额风险机构')).toBeInTheDocument();
    expect(within(commercialHealth).getByText(/客户.*88 \/ 100/)).toBeInTheDocument();
    expect(within(commercialHealth).getByText('Phase11 配置缺失机构')).toBeInTheDocument();
    expect(within(commercialHealth).getByText('缺少 active plan')).toBeInTheDocument();
    expect(within(commercialHealth).getByText(/缺少 quota limit/)).toBeInTheDocument();
    expect(within(commercialHealth).getByText('缺少 quota snapshot')).toBeInTheDocument();
    expect(within(commercialHealth).getByText(/quota_exceeded_customers/)).toBeInTheDocument();
    expect(within(commercialHealth).getAllByText(/customer/).length).toBeGreaterThan(0);
    expect(within(commercialHealth).getAllByText(/运营参考/).length).toBeGreaterThan(0);
    expect(within(commercialHealth).getAllByText(/配额快照/).length).toBeGreaterThan(0);
    expect(commercialHealth.textContent ?? '').not.toContain('强一致');
    expect(commercialHealth.textContent ?? '').not.toContain('enforcement');

    expect(fetchMock).toHaveBeenCalledWith('/api/open-platform/tenants', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/open-platform/audit-events?result=denied&limit=100', {
      cache: 'no-store',
    });
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
  });

  it('平台端租户管理入口展示 empty 状态', async () => {
    const fetchMock = mockWorkspaceFetch({ role: 'platform_admin', platformTenants: [] });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '租户管理' }));

    expect(await screen.findByText('暂无租户运营元数据')).toBeInTheDocument();
    expect(screen.getByText('当前没有可展示的租户套餐和配额数据。')).toBeInTheDocument();
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
  });

  it.each([
    [403, '没有访问权限', '当前账号没有查看租户管理的权限'],
    [503, '数据服务暂时不可用', '租户管理数据暂时不可用'],
  ])('平台端租户管理入口处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    const fetchMock = mockWorkspaceFetch({
      role: 'platform_admin',
      platformTenantError: { status, message: apiMessage },
    });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '租户管理' }));

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expectNoPlatformTenantMutation(fetchMock);
    expectNoSensitivePlatformTenantContent(container);
  });

  it('平台端权限与审计入口展示审计日志并保持敏感字段边界', async () => {
    const fetchMock = mockWorkspaceFetch({ role: 'platform_admin' });
    const { container } = render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '权限与审计' }));

    expect(await screen.findByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('audit_phase8_platform')).toBeInTheDocument();
    expect(screen.getByText('租户 ID：demo-tenant-001')).toBeInTheDocument();
    expect(screen.getByText('资源类型：customer')).toBeInTheDocument();
    expect(screen.getByText('结果：allowed')).toBeInTheDocument();
    expect(screen.getByLabelText('租户 ID')).toBeInTheDocument();

    const auditCall = fetchMock.mock.calls.find(
      ([input]) => fetchPath(input) === '/api/open-platform/audit-events',
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
