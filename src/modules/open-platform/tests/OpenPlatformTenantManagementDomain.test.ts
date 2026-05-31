import { describe, expect, it } from 'vitest';
import * as tenantManagementDomain from '@/modules/open-platform/domain/tenant-management';
import {
  mapTenantManagementRecordToDto,
  tenantManagementDtoFields,
} from '@/modules/open-platform/domain/tenant-management';

const record = {
  tenantId: 'demo-tenant-001',
  tenantName: '智美天工演示机构',
  tenantStatus: 'active',
  planName: '成长版',
  planCode: 'growth-care',
  planStatus: 'active',
  assignmentStatus: 'active',
  startedAt: new Date('2026-05-31T00:00:00.000Z'),
  expiresAt: null,
  maxCustomers: 5000,
  maxAppointments: 2000,
  maxFollowUps: 10000,
  maxAiCalls: 50000,
  currentCustomers: 24,
  currentAppointments: 12,
  currentFollowUps: 36,
  currentAiCalls: 0,
  snapshotAt: new Date('2026-05-31T08:00:00.000Z'),
  phoneNumber: '13800000000',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR-RAW-001',
  treatmentRecord: '完整治疗记录正文',
  consultationTranscript: '咨询对话全文',
  sql: 'select * from customers',
  stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_should_not_render',
  secret: 'raw-secret',
};

describe('平台租户管理领域 DTO', () => {
  it('只输出租户运营元数据白名单字段', () => {
    const dto = mapTenantManagementRecordToDto(record);

    expect(Object.keys(dto).sort()).toEqual([...tenantManagementDtoFields].sort());
    expect(dto).toEqual({
      tenantId: 'demo-tenant-001',
      tenantName: '智美天工演示机构',
      tenantStatus: 'active',
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
    });
  });

  it('无套餐或无配额快照时稳定返回 null 配额字段', () => {
    const dto = mapTenantManagementRecordToDto({
      tenantId: 'demo-tenant-003',
      tenantName: '未分配套餐机构',
      tenantStatus: 'suspended',
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
    });

    expect(dto).toEqual({
      tenantId: 'demo-tenant-003',
      tenantName: '未分配套餐机构',
      tenantStatus: 'suspended',
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
    });
  });

  it('DTO 不返回业务明细、PII、审计请求体或服务端错误细节', () => {
    const dto = mapTenantManagementRecordToDto(record);
    const serialized = JSON.stringify(dto);

    expect(serialized).not.toContain('phoneNumber');
    expect(serialized).not.toContain('13800000000');
    expect(serialized).not.toContain('idNumber');
    expect(serialized).not.toContain('110101199001010011');
    expect(serialized).not.toContain('medicalRecordNo');
    expect(serialized).not.toContain('MR-RAW-001');
    expect(serialized).not.toContain('treatmentRecord');
    expect(serialized).not.toContain('完整治疗记录正文');
    expect(serialized).not.toContain('consultationTranscript');
    expect(serialized).not.toContain('咨询对话全文');
    expect(serialized).not.toContain('sql');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('secret');
  });

  it('不暴露套餐 enforcement 能力', () => {
    expect(Object.keys(tenantManagementDomain)).not.toEqual(
      expect.arrayContaining([
        'assertTenantQuota',
        'canCreateCustomer',
        'enforceTenantPlan',
        'enforceTenantQuota',
      ]),
    );
  });
});
