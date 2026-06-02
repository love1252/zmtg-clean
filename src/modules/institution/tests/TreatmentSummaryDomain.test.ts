import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  deriveTreatmentSummaryStatus,
  mapTreatmentSummaryRecordToListItem,
  mapTreatmentSummaryRecordToTimelineDto,
  type TreatmentSummaryRecord,
} from '@/modules/institution/domain/treatment-summaries';

const treatmentSummaryRecord = {
  id: 'trt_001',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_qin_review',
  appointmentId: 'appt_qin_arrived',
  treatmentDate: '2026-05-30T03:45:00.000Z',
  treatmentProject: '玻尿酸复诊',
  treatmentCategory: 'injection_review',
  treatmentStage: 'D7 复诊',
  recoveryStage: 'D7',
  riskLevel: 'watch',
  ownerUserId: 'doctor-lin',
  summary: '结构化摘要：恢复进展稳定，安排补水护理观察。',
  nextCareAction: 'D14 人工回访恢复阶段。',
  tags: ['结构化摘要', '复诊'],
  status: 'active',
  voidedAt: null,
  voidedBy: null,
  voidReasonCode: null,
  voidReason: null,
  createdAt: '2026-05-30T03:45:00.000Z',
  updatedAt: '2026-05-30T03:45:00.000Z',
} satisfies TreatmentSummaryRecord;

const forbiddenTextPattern =
  /完整治疗记录正文|完整病历正文|诊疗原文|咨询对话全文|blocked-treatment-record-value|blocked-medical-record-value|blocked-phone-value|blocked-id-value|blocked-stack-value/i;

const forbiddenFieldPattern =
  /tenantId|customerId|phoneNumber|idNumber|medicalRecordNo|treatmentRecord|treatmentRecordBody|medicalRecord|medicalRecordBody|diagnosisText|clinicalNote|consultationTranscript|imageUrl|fileUrl|requestBody|sql|stack|token|secret|databaseUrl|rawPayload|aiGeneratedContent|externalSyncPayload/i;

const listForbiddenFieldPattern =
  /tenantId|phoneNumber|idNumber|medicalRecordNo|customerDisplayName|maskedPhone|maskedMedicalRecordNo|appointmentNote|followUpSuggestedAction|treatmentRecord|treatmentRecordBody|medicalRecord|medicalRecordBody|diagnosisText|clinicalNote|consultationTranscript|imageUrl|fileUrl|requestBody|sql|stack|token|secret|databaseUrl|rawPayload|aiGeneratedContent|externalSyncPayload/i;

function listFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);

    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

describe('治疗结构化摘要领域模型', () => {
  it('治疗摘要 DTO 只返回客户时间线允许的白名单字段', () => {
    const dto = mapTreatmentSummaryRecordToTimelineDto({
      ...treatmentSummaryRecord,
      treatmentRecord: 'blocked-treatment-record-value',
      medicalRecordBody: 'blocked-medical-record-value',
      phoneNumber: 'blocked-phone-value',
      idNumber: 'blocked-id-value',
      stack: 'blocked-stack-value',
    } as TreatmentSummaryRecord & Record<string, unknown>);
    const serialized = JSON.stringify(dto);

    expect(dto).toEqual({
      id: 'trt_001',
      appointmentId: 'appt_qin_arrived',
      treatmentDate: '2026-05-30T03:45:00.000Z',
      treatmentProject: '玻尿酸复诊',
      treatmentCategory: 'injection_review',
      treatmentStage: 'D7 复诊',
      recoveryStage: 'D7',
      riskLevel: 'watch',
      ownerUserId: 'doctor-lin',
      summary: '结构化摘要：恢复进展稳定，安排补水护理观察。',
      nextCareAction: 'D14 人工回访恢复阶段。',
      tags: ['结构化摘要', '复诊'],
      status: 'active',
      voidedAt: null,
      voidedBy: null,
      voidReasonCode: null,
      voidReason: null,
      createdAt: '2026-05-30T03:45:00.000Z',
      updatedAt: '2026-05-30T03:45:00.000Z',
    });
    expect(Object.keys(dto)).toEqual([
      'id',
      'appointmentId',
      'treatmentDate',
      'treatmentProject',
      'treatmentCategory',
      'treatmentStage',
      'recoveryStage',
      'riskLevel',
      'ownerUserId',
      'summary',
      'nextCareAction',
      'tags',
      'status',
      'voidedAt',
      'voidedBy',
      'voidReasonCode',
      'voidReason',
      'createdAt',
      'updatedAt',
    ]);
    expect(serialized).not.toMatch(forbiddenTextPattern);
    expect(serialized).not.toMatch(forbiddenFieldPattern);
  });

  it('治疗摘要 DTO 克隆 tags 且支持无预约关联', () => {
    const record = {
      ...treatmentSummaryRecord,
      appointmentId: null,
      tags: ['术后关怀'],
    };
    const dto = mapTreatmentSummaryRecordToTimelineDto(record);

    record.tags.push('不应影响 DTO');

    expect(dto.appointmentId).toBeNull();
    expect(dto.tags).toEqual(['术后关怀']);
  });

  it('治疗摘要列表 DTO 只返回管理列表允许的白名单字段', () => {
    const dto = mapTreatmentSummaryRecordToListItem({
      ...treatmentSummaryRecord,
      treatmentRecord: 'blocked-treatment-record-value',
      medicalRecordBody: 'blocked-medical-record-value',
      phoneNumber: 'blocked-phone-value',
      idNumber: 'blocked-id-value',
      customerDisplayName: '客户姓名',
      appointmentNote: '预约详情',
      followUpSuggestedAction: '随访明细',
      stack: 'blocked-stack-value',
    } as TreatmentSummaryRecord & Record<string, unknown>);
    const serialized = JSON.stringify(dto);

    expect(dto).toEqual({
      id: 'trt_001',
      customerId: 'cust_qin_review',
      appointmentId: 'appt_qin_arrived',
      treatmentDate: '2026-05-30T03:45:00.000Z',
      treatmentProject: '玻尿酸复诊',
      treatmentCategory: 'injection_review',
      treatmentStage: 'D7 复诊',
      recoveryStage: 'D7',
      riskLevel: 'watch',
      ownerUserId: 'doctor-lin',
      summary: '结构化摘要：恢复进展稳定，安排补水护理观察。',
      nextCareAction: 'D14 人工回访恢复阶段。',
      tags: ['结构化摘要', '复诊'],
      status: 'active',
      voidedAt: null,
      voidedBy: null,
      voidReasonCode: null,
      voidReason: null,
      createdAt: '2026-05-30T03:45:00.000Z',
      updatedAt: '2026-05-30T03:45:00.000Z',
    });
    expect(Object.keys(dto)).toEqual([
      'id',
      'customerId',
      'appointmentId',
      'treatmentDate',
      'treatmentProject',
      'treatmentCategory',
      'treatmentStage',
      'recoveryStage',
      'riskLevel',
      'ownerUserId',
      'summary',
      'nextCareAction',
      'tags',
      'status',
      'voidedAt',
      'voidedBy',
      'voidReasonCode',
      'voidReason',
      'createdAt',
      'updatedAt',
    ]);
    expect(serialized).not.toMatch(forbiddenTextPattern);
    expect(serialized).not.toMatch(listForbiddenFieldPattern);
  });

  it('治疗摘要列表 DTO 克隆 tags，避免外部修改影响响应', () => {
    const record = {
      ...treatmentSummaryRecord,
      tags: ['结构化摘要'],
    };
    const dto = mapTreatmentSummaryRecordToListItem(record);

    record.tags.push('不应影响 DTO');

    expect(dto.tags).toEqual(['结构化摘要']);
  });

  it('根据 voidedAt 派生治疗摘要 active / voided 状态', () => {
    expect(deriveTreatmentSummaryStatus(null)).toBe('active');
    expect(deriveTreatmentSummaryStatus('2026-06-02T09:00:00.000Z')).toBe('voided');

    const dto = mapTreatmentSummaryRecordToListItem({
      ...treatmentSummaryRecord,
      status: 'voided',
      voidedAt: '2026-06-02T09:00:00.000Z',
      voidedBy: 'demo-user-admin',
      voidReasonCode: 'duplicate_summary',
      voidReason: '重复录入，保留较新的治疗摘要',
    });

    expect(dto).toMatchObject({
      status: 'voided',
      voidedAt: '2026-06-02T09:00:00.000Z',
      voidedBy: 'demo-user-admin',
      voidReasonCode: 'duplicate_summary',
      voidReason: '重复录入，保留较新的治疗摘要',
    });
    expect(JSON.stringify(dto)).not.toMatch(listForbiddenFieldPattern);
  });

  it('治疗摘要 API route 只允许结构化摘要、受控编辑、Phase 15 随访联动与 Phase 19 作废入口', () => {
    const apiFiles = listFiles(join(process.cwd(), 'src/app/api')).filter((file) =>
      /treatment-summary|treatment-summaries/i.test(file),
    ).sort();
    const uiFiles = listFiles(join(process.cwd(), 'src/modules/institution/components')).filter(
      (file) => /treatment-summary|treatment-summaries/i.test(file),
    );

    expect(apiFiles).toEqual([
      join(
        process.cwd(),
        'src/app/api/institution/customers/[customerId]/treatment-summaries/route.ts',
      ),
      join(
        process.cwd(),
        'src/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route.ts',
      ),
      join(
        process.cwd(),
        'src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts',
      ),
      join(
        process.cwd(),
        'src/app/api/institution/treatment-summaries/[summaryId]/route.ts',
      ),
      join(
        process.cwd(),
        'src/app/api/institution/treatment-summaries/[summaryId]/void/route.ts',
      ),
      join(process.cwd(), 'src/app/api/institution/treatment-summaries/route.ts'),
    ]);
    expect(uiFiles).toEqual([]);

    const editRoute = readFileSync(
      join(
        process.cwd(),
        'src/app/api/institution/treatment-summaries/[summaryId]/route.ts',
      ),
      'utf8',
    );
    expect(editRoute).toContain('export async function PATCH');
    expect(editRoute).not.toMatch(/DELETE|void|作废|revision|diff/i);
  });
});
