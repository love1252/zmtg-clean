import { describe, expect, it } from 'vitest';
import {
  appointments,
  auditEvents,
  customers,
  followUpTasks,
  tenantMembers,
  tenants,
} from '@/server/db/schema';

describe('数据库 schema', () => {
  it('定义租户业务和审计表', () => {
    expect(tenants).toBeDefined();
    expect(tenantMembers).toBeDefined();
    expect(customers).toBeDefined();
    expect(appointments).toBeDefined();
    expect(followUpTasks).toBeDefined();
    expect(auditEvents).toBeDefined();
  });

  it('客户 schema 只包含脱敏字段', () => {
    expect(customers.maskedPhone).toBeDefined();
    expect(customers.maskedMedicalRecordNo).toBeDefined();
    expect('phoneNumber' in customers).toBe(false);
    expect('idNumber' in customers).toBe(false);
    expect('medicalRecordNo' in customers).toBe(false);
    expect('treatmentRecord' in customers).toBe(false);
    expect('consultationTranscript' in customers).toBe(false);
  });
});
