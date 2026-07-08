import { describe, expect, it } from 'vitest';
import {
  getCustomerImportRowsForExecution,
  lowSensitiveCustomerImportAllowedFields,
  previewLowSensitiveCustomerImport,
} from '@/modules/institution/domain/customer-import';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';

const occurredAt = '2026-07-08T10:00:00.000Z';

const validLowSensitiveRow = {
  customerDisplayName: '低敏客户A',
  customerAlias: 'A 客户',
  gender: '未指定',
  ageRange: '30-39',
  customerStage: 'consulting',
  treatmentProject: '皮肤管理',
  lastVisitDate: '2026-07-01',
  nextFollowUpDate: '2026-07-15',
  ownerEmployeeName: '咨询师A',
  ownerEmployeeRef: 'employee-ref-a',
  sourceChannel: '线下咨询低敏来源',
  tagSummary: '低敏标签',
  noteSummary: '仅导入低敏摘要',
  externalCustomerRef: 'external-ref-low-sensitive-a',
  importedCustomerRef: 'import-ref-a',
};

function createExistingCustomer(overrides: Partial<CustomerRecordSummary> = {}): CustomerRecordSummary {
  return {
    id: 'cust_existing',
    tenantId: 'tenant-a',
    displayName: '低敏客户A',
    lifecycle: 'consulting',
    priority: 'observe',
    ownerUserId: 'employee-ref-a',
    projectInterest: '皮肤管理',
    maskedPhone: 'masked-import-only',
    maskedMedicalRecordNo: 'masked-import-record',
    lastTouchSummary: '最近到访:2026-07-01',
    nextAction: '下次随访:2026-07-15',
    tags: ['低敏导入', 'institution_ref:inst-a', 'imported_ref:import-ref-a'],
    gender: '未指定',
    birthDate: '低敏年龄:30-39',
    referralSource: '线下咨询低敏来源',
    notes: 'importBatch:batch-a；importedCustomerRef:import-ref-a',
    ...overrides,
  };
}

describe('low sensitive customer import domain', () => {
  it('预检允许低敏白名单字段并返回边界说明', () => {
    const preview = previewLowSensitiveCustomerImport({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      operatorRef: 'operator-a',
      rows: [validLowSensitiveRow],
      occurredAt,
    });

    expect(preview.totalCount).toBe(1);
    expect(preview.successCount).toBe(1);
    expect(preview.failureCount).toBe(0);
    expect(preview.skippedCount).toBe(0);
    expect(preview.canExecute).toBe(true);
    expect(preview.importBatch.fieldWhitelist).toEqual([...lowSensitiveCustomerImportAllowedFields]);
    expect(preview.boundary).toMatchObject({
      mode: 'low_sensitive_customer_import',
      noHis: true,
      noRealWeCom: true,
      noRealSend: true,
    });
  });

  it('拒绝非白名单字段和高敏字段 / 高敏内容', () => {
    const preview = previewLowSensitiveCustomerImport({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      operatorRef: 'operator-a',
      rows: [
        {
          ...validLowSensitiveRow,
          phoneNumber: '13800000000',
          idNumber: '110101199001010011',
          medicalRecordNo: 'MR-RAW-001',
          chatRecord: '聊天记录原文',
          accessToken: 'zmtg_sk_secret_token',
          unsupportedColumn: '不允许字段',
        },
      ],
      occurredAt,
    });

    const issues = preview.importBatch.rows[0]?.issues ?? [];
    expect(preview.successCount).toBe(0);
    expect(preview.skippedCount).toBe(1);
    expect(issues.map((issue) => issue.reason)).toContain('unsupported_field');
    expect(issues.map((issue) => issue.reason)).toContain('sensitive_field_detected');
    expect(JSON.stringify(preview)).not.toContain('phoneNumber');
    expect(JSON.stringify(preview)).not.toContain('idNumber');
    expect(JSON.stringify(preview)).not.toContain('medicalRecordNo');
    expect(JSON.stringify(preview)).not.toContain('chatRecord');
    expect(JSON.stringify(preview)).not.toContain('accessToken');
    expect(JSON.stringify(preview)).not.toContain('13800000000');
    expect(JSON.stringify(preview)).not.toContain('110101199001010011');
    expect(JSON.stringify(preview)).not.toContain('zmtg_sk_secret_token');
    expect(JSON.stringify(preview)).not.toContain('DATABASE_URL');
  });

  it('覆盖必填缺失、日期错误、空行和嵌套 payload 失败原因', () => {
    const preview = previewLowSensitiveCustomerImport({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      operatorRef: 'operator-a',
      rows: [
        { treatmentProject: '皮肤管理' },
        { ...validLowSensitiveRow, lastVisitDate: '2026-02-31' },
        {},
        { ...validLowSensitiveRow, noteSummary: { raw: '嵌套对象' } },
      ],
      occurredAt,
    });

    const reasons = preview.importBatch.rows.flatMap((row) => row.issues.map((issue) => issue.reason));
    expect(reasons).toContain('missing_required_field');
    expect(reasons).toContain('invalid_date');
    expect(reasons).toContain('empty_row');
    expect(reasons).toContain('unsafe_payload');
  });

  it('只在同一 tenant / institution 的低敏 ref 范围内识别重复客户候选', () => {
    const sameInstitutionPreview = previewLowSensitiveCustomerImport({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      operatorRef: 'operator-a',
      rows: [validLowSensitiveRow],
      existingCustomers: [createExistingCustomer()],
      occurredAt,
    });

    expect(sameInstitutionPreview.importBatch.rows[0]?.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: 'duplicated_customer' })]),
    );

    const otherInstitutionPreview = previewLowSensitiveCustomerImport({
      tenantId: 'tenant-a',
      institutionId: 'inst-b',
      operatorRef: 'operator-a',
      rows: [validLowSensitiveRow],
      existingCustomers: [createExistingCustomer()],
      occurredAt,
    });

    expect(otherInstitutionPreview.successCount).toBe(1);
    expect(otherInstitutionPreview.importBatch.rows[0]?.issues).toHaveLength(0);
  });

  it('执行时仅映射合法低敏行并写入现有客户运营字段', () => {
    const { preview, drafts } = getCustomerImportRowsForExecution({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      operatorRef: 'operator-a',
      rows: [
        validLowSensitiveRow,
        { ...validLowSensitiveRow, customerDisplayName: '', importedCustomerRef: 'bad-row' },
      ],
      occurredAt,
      importBatchId: 'batch-a',
    });

    expect(preview.totalCount).toBe(2);
    expect(preview.successCount).toBe(1);
    expect(preview.skippedCount).toBe(1);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      tenantId: 'tenant-a',
      displayName: '低敏客户A',
      projectInterest: '皮肤管理',
      maskedPhone: 'masked-import-only',
      maskedMedicalRecordNo: 'masked-import-record',
      birthDate: '低敏年龄:30-39',
    });
    expect(drafts[0]?.tags).toEqual(
      expect.arrayContaining(['低敏导入', 'institution_ref:inst-a', 'imported_ref:import-ref-a']),
    );
    expect(JSON.stringify(drafts)).not.toContain('13800000000');
    expect(JSON.stringify(drafts)).not.toContain('110101199001010011');
  });
});
