import { describe, expect, it } from 'vitest';
import {
  buildCustomerTimelineResponse,
  type CustomerTimelineAuditSummary,
} from '@/modules/institution/domain/customer-timeline';
import type { AppointmentRecordSummary } from '@/modules/institution/domain/appointment-records';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type { TenantFollowUpTask } from '@/modules/institution/domain/followup-workflow';
import type { TreatmentSummaryRecord } from '@/modules/institution/domain/treatment-summaries';

const customer = {
  id: 'cust_001',
  tenantId: 'demo-tenant-001',
  displayName: '王女士',
  lifecycle: 'repurchase_window',
  priority: 'high',
  ownerUserId: 'consultant-lin',
  projectInterest: '热玛吉修复组合',
  maskedPhone: '138****1208',
  maskedMedicalRecordNo: 'MR****001',
  lastTouchSummary: '术后第 28 天',
  nextAction: '人工回访',
  tags: ['高价值'],
  phoneNumber: '13800000000',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR-RAW-001',
  treatmentRecord: '完整治疗记录正文',
  consultationTranscript: '咨询对话全文',
} satisfies CustomerRecordSummary & {
  phoneNumber: string;
  idNumber: string;
  medicalRecordNo: string;
  treatmentRecord: string;
  consultationTranscript: string;
};

const appointments = [
  {
    id: 'appt_001',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_001',
    customerDisplayName: '王女士',
    project: '水光补水',
    scheduledAt: '2026-06-02T02:30:00.000Z',
    consultantUserId: 'consultant-xu',
    status: 'confirmed',
    note: '已确认到院',
    requestBody: { tenantId: 'other-tenant' },
  } satisfies AppointmentRecordSummary & { requestBody: Record<string, unknown> },
];

const followups = [
  {
    id: 'fu_001',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_001',
    customerDisplayName: '王女士',
    journeyId: 'journey_repurchase',
    stage: 'D28 复购建议',
    status: 'due',
    dueAt: '2026-06-01T10:00:00.000Z',
    suggestedAction: '人工回访',
    riskLevel: 'urgent',
    updatedBy: null,
    updatedAt: null,
    sql: 'select * from customers',
  } satisfies TenantFollowUpTask & { sql: string },
];

const auditEvents = [
  {
    id: 'audit_evt_001',
    action: 'update',
    result: 'allowed',
    reason: 'allowed_by_policy',
    actor: { id: 'demo-user-admin', role: 'tenant_admin' },
    occurredAt: '2026-06-03T09:00:00.000Z',
    resource: 'customer',
    resourceId: 'cust_001',
    metadata: { requestBody: { phoneNumber: '13800000000' } },
    stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  } satisfies CustomerTimelineAuditSummary & {
    metadata: Record<string, unknown>;
    stack: string;
  },
];

const treatmentSummaries = [
  {
    id: 'trt_001',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_001',
    appointmentId: 'appt_001',
    treatmentDate: '2026-06-01T12:00:00.000Z',
    treatmentProject: '光电修复',
    treatmentCategory: 'laser_repair',
    treatmentStage: 'D7 复诊',
    recoveryStage: 'D7',
    riskLevel: 'watch',
    ownerUserId: 'doctor-lin',
    summary: '结构化摘要：红肿减轻，安排补水护理。',
    nextCareAction: 'D14 人工回访恢复阶段。',
    tags: ['结构化摘要', '术后关怀'],
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
    treatmentRecord: '完整治疗记录正文',
    medicalRecordBody: '完整病历正文',
    consultationTranscript: '咨询对话全文',
  } satisfies TreatmentSummaryRecord & {
    treatmentRecord: string;
    medicalRecordBody: string;
    consultationTranscript: string;
  },
];

describe('客户详情时间线领域模型', () => {
  it('构建客户详情时间线响应且只保留脱敏结构化摘要', () => {
    const response = buildCustomerTimelineResponse({
      customer,
      appointments,
      followups,
      treatmentSummaries,
      auditEvents,
    });
    const serialized = JSON.stringify(response);

    expect(response.customer).toEqual({
      id: 'cust_001',
      displayName: '王女士',
      lifecycle: 'repurchase_window',
      priority: 'high',
      projectInterest: '热玛吉修复组合',
      maskedPhone: '138****1208',
      maskedMedicalRecordNo: 'MR****001',
      ownerUserId: 'consultant-lin',
      tags: ['高价值'],
      lastTouchSummary: '术后第 28 天',
      nextAction: '人工回访',
    });
    expect(response.appointments).toEqual([
      {
        id: 'appt_001',
        project: '水光补水',
        scheduledAt: '2026-06-02T02:30:00.000Z',
        consultantUserId: 'consultant-xu',
        status: 'confirmed',
        note: '已确认到院',
      },
    ]);
    expect(response.followups).toEqual([
      {
        id: 'fu_001',
        journeyId: 'journey_repurchase',
        stage: 'D28 复购建议',
        status: 'due',
        dueAt: '2026-06-01T10:00:00.000Z',
        suggestedAction: '人工回访',
        riskLevel: 'urgent',
        updatedBy: null,
        updatedAt: null,
      },
    ]);
    expect(response.auditEvents).toEqual([
      {
        id: 'audit_evt_001',
        action: 'update',
        result: 'allowed',
        reason: 'allowed_by_policy',
        actor: { id: 'demo-user-admin', role: 'tenant_admin' },
        occurredAt: '2026-06-03T09:00:00.000Z',
        resource: 'customer',
        resourceId: 'cust_001',
      },
    ]);
    expect(response.treatmentSummaries).toEqual([
      {
        id: 'trt_001',
        appointmentId: 'appt_001',
        treatmentDate: '2026-06-01T12:00:00.000Z',
        treatmentProject: '光电修复',
        treatmentCategory: 'laser_repair',
        treatmentStage: 'D7 复诊',
        recoveryStage: 'D7',
        riskLevel: 'watch',
        ownerUserId: 'doctor-lin',
        summary: '结构化摘要：红肿减轻，安排补水护理。',
        nextCareAction: 'D14 人工回访恢复阶段。',
        tags: ['结构化摘要', '术后关怀'],
        createdAt: '2026-06-01T12:00:00.000Z',
        updatedAt: '2026-06-01T12:00:00.000Z',
      },
    ]);
    expect(serialized).not.toContain('tenantId');
    expect(serialized).not.toContain('13800000000');
    expect(serialized).not.toContain('110101199001010011');
    expect(serialized).not.toContain('MR-RAW-001');
    expect(serialized).not.toContain('完整治疗记录正文');
    expect(serialized).not.toContain('完整病历正文');
    expect(serialized).not.toContain('咨询对话全文');
    expect(serialized).not.toContain('requestBody');
    expect(serialized).not.toContain('metadata');
    expect(serialized).not.toContain('select * from customers');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
  });

  it('按时间倒序构建结构化 timeline events，客户摘要事件稳定排在最后', () => {
    const response = buildCustomerTimelineResponse({
      customer,
      appointments,
      followups,
      treatmentSummaries,
      auditEvents,
    });

    expect(response.timeline.map((event) => event.id)).toEqual([
      'audit:audit_evt_001',
      'appointment:appt_001',
      'treatment_summary:trt_001',
      'follow_up:fu_001',
      'customer:cust_001',
    ]);
    expect(response.timeline).toEqual([
      expect.objectContaining({
        type: 'audit',
        occurredAt: '2026-06-03T09:00:00.000Z',
        source: 'customer',
        relatedRecordId: 'cust_001',
      }),
      expect.objectContaining({
        type: 'appointment',
        occurredAt: '2026-06-02T02:30:00.000Z',
        source: 'appointment',
        relatedRecordId: 'appt_001',
      }),
      expect.objectContaining({
        type: 'treatment_summary',
        occurredAt: '2026-06-01T12:00:00.000Z',
        title: '光电修复 · D7 复诊',
        summary: '结构化摘要：红肿减轻，安排补水护理。',
        status: 'watch',
        source: 'treatment_summary',
        relatedRecordId: 'trt_001',
        riskLevel: 'watch',
        tags: ['结构化摘要', '术后关怀'],
      }),
      expect.objectContaining({
        type: 'follow_up',
        occurredAt: '2026-06-01T10:00:00.000Z',
        source: 'follow_up',
        relatedRecordId: 'fu_001',
      }),
      expect.objectContaining({
        type: 'customer_summary',
        occurredAt: null,
        source: 'customer',
        relatedRecordId: 'cust_001',
      }),
    ]);
  });
});
