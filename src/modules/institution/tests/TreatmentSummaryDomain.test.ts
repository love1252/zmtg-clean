import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
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
  createdAt: '2026-05-30T03:45:00.000Z',
  updatedAt: '2026-05-30T03:45:00.000Z',
} satisfies TreatmentSummaryRecord;

const forbiddenTextPattern =
  /完整治疗记录正文|完整病历正文|诊疗原文|咨询对话全文|blocked-treatment-record-value|blocked-medical-record-value|blocked-phone-value|blocked-id-value|blocked-stack-value/i;

const forbiddenFieldPattern =
  /tenantId|customerId|phoneNumber|idNumber|medicalRecordNo|treatmentRecord|treatmentRecordBody|medicalRecord|medicalRecordBody|diagnosisText|clinicalNote|consultationTranscript|imageUrl|fileUrl|requestBody|sql|stack|token|secret|databaseUrl|rawPayload|aiGeneratedContent|externalSyncPayload/i;

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

  it('Phase 12 PR 2 不新增治疗摘要 API route 或 UI 文件', () => {
    const apiFiles = listFiles(join(process.cwd(), 'src/app/api')).filter((file) =>
      /treatment-summary|treatment-summaries/i.test(file),
    );
    const uiFiles = listFiles(join(process.cwd(), 'src/modules/institution/components')).filter(
      (file) => /treatment-summary|treatment-summaries/i.test(file),
    );

    expect(apiFiles).toEqual([]);
    expect(uiFiles).toEqual([]);
  });
});
