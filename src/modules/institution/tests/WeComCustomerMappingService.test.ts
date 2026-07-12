import { describe, expect, it, vi } from 'vitest';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type {
  CreateWeComCustomerMappingStateInput,
  UpdateWeComCustomerMappingStateInput,
  WeComCustomerMappingScope,
  WeComCustomerMappingState,
} from '@/modules/institution/server/wecom-customer-mapping-repository';
import {
  readWeComCustomerMapping,
  writeWeComCustomerMapping,
} from '@/modules/institution/server/wecom-customer-mapping-service';
import type { AccessContext } from '@/modules/security/domain/access-control';

const context: AccessContext = {
  userId: 'admin-a',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-a',
  institutionId: 'inst-a',
  source: 'demo_session',
};

function customer(id: string): CustomerRecordSummary {
  return {
    id,
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    displayName: `客户 ${id}`,
    lifecycle: 'consulting',
    priority: 'high',
    ownerUserId: 'owner-a',
    projectInterest: '项目',
    maskedPhone: '138****0000',
    maskedMedicalRecordNo: 'MR-***-01',
    lastTouchSummary: '低敏摘要',
    nextAction: '人工处理',
    tags: [],
    gender: '',
    birthDate: '',
    referralSource: '',
    notes: '',
  };
}

function state(status: WeComCustomerMappingState['status'], customerId = 'customer-a') {
  return {
    id: 'mapping-a',
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    proofContactId: 'live-contact-proof-01',
    proofEmployeeId: 'live-employee-proof-01',
    sourceMode: 'real_readonly_proof',
    customerId,
    status,
    decidedBy: 'admin-a',
    decidedAt: '2026-07-10T08:00:00.000Z',
    createdAt: '2026-07-10T08:00:00.000Z',
    updatedAt: '2026-07-10T08:00:00.000Z',
  } satisfies WeComCustomerMappingState;
}

function writeRepositories(current: WeComCustomerMappingState | null = null) {
  return {
    customerRepository: {
      getCustomerByTenantAndInstitution: vi.fn<
        (input: { id: string }) => Promise<CustomerRecordSummary | null>
      >(async ({ id }) => customer(id)),
      listCustomersByTenantAndInstitution: vi.fn(),
    },
    mappingRepository: {
      findByScope: vi.fn<(input: WeComCustomerMappingScope) => Promise<WeComCustomerMappingState | null>>(
        async () => current,
      ),
      findByScopeForUpdate: vi.fn<
        (input: WeComCustomerMappingScope) => Promise<WeComCustomerMappingState | null>
      >(async () => current),
      createIfAbsent: vi.fn<
        (input: CreateWeComCustomerMappingStateInput) => Promise<WeComCustomerMappingState | null>
      >(async (input) => state(input.status, input.customerId)),
      updateWhenCurrentStatus: vi.fn<
        (input: UpdateWeComCustomerMappingStateInput) => Promise<WeComCustomerMappingState | null>
      >(async (input) => state(input.status, input.customerId)),
    },
    auditRepository: {
      record: vi.fn<(event: TenantAuditEvent) => Promise<void>>(async () => undefined),
    },
  };
}

describe('WeComCustomerMappingService', () => {
  it('候选严格通过 tenant + institution 查询，最多 20 条并只映射低敏字段', async () => {
    const repositories = writeRepositories();
    repositories.customerRepository.listCustomersByTenantAndInstitution.mockResolvedValue([
      customer('customer-a'),
      customer('customer-b'),
    ]);

    const result = await readWeComCustomerMapping({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      repositories,
    });

    expect(repositories.customerRepository.listCustomersByTenantAndInstitution).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      limit: 20,
    });
    expect(result.candidates).toEqual([
      {
        customerId: 'customer-a',
        displayName: '客户 customer-a',
        maskedPhone: '138****0000',
        maskedMedicalRecordNo: 'MR-***-01',
        lifecycle: 'consulting',
        priority: 'high',
      },
      {
        customerId: 'customer-b',
        displayName: '客户 customer-b',
        maskedPhone: '138****0000',
        maskedMedicalRecordNo: 'MR-***-01',
        lifecycle: 'consulting',
        priority: 'high',
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/ownerUserId|notes|tags|external_userid|UserID|Secret|token/i);
  });

  it('当前映射客户不在前 20 条时单独查询并返回低敏摘要', async () => {
    const repositories = writeRepositories(state('confirmed', 'customer-z'));
    repositories.customerRepository.listCustomersByTenantAndInstitution.mockResolvedValue([
      customer('customer-a'),
    ]);

    const result = await readWeComCustomerMapping({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      repositories,
    });

    expect(repositories.customerRepository.getCustomerByTenantAndInstitution).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      id: 'customer-z',
    });
    expect(result.currentCustomer?.customerId).toBe('customer-z');
  });

  it.each([
    { action: 'confirm' as const, expectedStatus: 'confirmed' as const, expectedReason: 'wecom_customer_mapping_confirmed' as const },
    { action: 'reject' as const, expectedStatus: 'rejected' as const, expectedReason: 'wecom_customer_mapping_rejected' as const },
  ])('unreviewed + $action 使用 create-if-absent，并在同服务调用写成功 audit', async ({ action, expectedStatus, expectedReason }) => {
    const repositories = writeRepositories();

    const result = await writeWeComCustomerMapping({
      context,
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      action,
      customerId: 'customer-a',
      occurredAt: '2026-07-10T09:00:00.000Z',
      createId: () => 'generated-id',
      repositories,
    });

    expect(result.kind).toBe('updated');
    expect(repositories.mappingRepository.createIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({ status: expectedStatus, customerId: 'customer-a' }),
    );
    expect(repositories.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'customer',
        resourceId: 'customer-a',
        result: 'transitioned',
        reason: expectedReason,
      }),
    );
  });

  it('confirmed + revoke 使用 expectedStatus + expectedCustomerId 条件更新并写 revoked audit', async () => {
    const repositories = writeRepositories(state('confirmed'));

    const result = await writeWeComCustomerMapping({
      context,
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      action: 'revoke',
      customerId: 'customer-a',
      occurredAt: '2026-07-10T09:00:00.000Z',
      createId: () => 'generated-id',
      repositories,
    });

    expect(result.kind).toBe('updated');
    expect(repositories.mappingRepository.updateWhenCurrentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStatus: 'confirmed',
        expectedCustomerId: 'customer-a',
        status: 'revoked',
      }),
    );
    expect(repositories.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'wecom_customer_mapping_revoked' }),
    );
  });

  it('同客户幂等不更新也不重复写成功 audit', async () => {
    const repositories = writeRepositories(state('confirmed'));

    const result = await writeWeComCustomerMapping({
      context,
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      action: 'confirm',
      customerId: 'customer-a',
      occurredAt: '2026-07-10T09:00:00.000Z',
      createId: () => 'generated-id',
      repositories,
    });

    expect(result.kind).toBe('idempotent');
    expect(repositories.mappingRepository.createIfAbsent).not.toHaveBeenCalled();
    expect(repositories.mappingRepository.updateWhenCurrentStatus).not.toHaveBeenCalled();
    expect(repositories.auditRepository.record).not.toHaveBeenCalled();
  });

  it.each([
    { current: state('confirmed'), action: 'confirm' as const, customerId: 'customer-b', expectedKind: 'conflict', expectedReason: 'wecom_customer_mapping_conflict_blocked' },
    { current: state('rejected'), action: 'revoke' as const, customerId: 'customer-a', expectedKind: 'invalid_transition', expectedReason: 'wecom_customer_mapping_invalid_transition' },
  ])('失败转换 $expectedKind 不更新原状态并记录低敏 blocked audit', async ({ current, action, customerId, expectedKind, expectedReason }) => {
    const repositories = writeRepositories(current);

    const result = await writeWeComCustomerMapping({
      context,
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      action,
      customerId,
      occurredAt: '2026-07-10T09:00:00.000Z',
      createId: () => 'generated-id',
      repositories,
    });

    expect(result.kind).toBe(expectedKind);
    expect(repositories.mappingRepository.updateWhenCurrentStatus).not.toHaveBeenCalled();
    expect(repositories.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: customerId, result: 'denied', reason: expectedReason }),
    );
  });

  it('expectedStatus stale update 返回 conflict，不覆盖并记录 blocked audit', async () => {
    const repositories = writeRepositories(state('revoked'));
    repositories.mappingRepository.updateWhenCurrentStatus.mockResolvedValue(null);

    const result = await writeWeComCustomerMapping({
      context,
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      action: 'confirm',
      customerId: 'customer-a',
      occurredAt: '2026-07-10T09:00:00.000Z',
      createId: () => 'generated-id',
      repositories,
    });

    expect(result).toEqual({ kind: 'conflict' });
    expect(repositories.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'wecom_customer_mapping_conflict_blocked' }),
    );
  });

  it('expectedCustomerId stale update 返回 conflict，不覆盖并记录 blocked audit', async () => {
    const repositories = writeRepositories(state('revoked', 'customer-a'));
    repositories.mappingRepository.updateWhenCurrentStatus.mockResolvedValue(null);

    const result = await writeWeComCustomerMapping({
      context,
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      action: 'confirm',
      customerId: 'customer-b',
      occurredAt: '2026-07-10T09:00:00.000Z',
      createId: () => 'generated-id',
      repositories,
    });

    expect(result).toEqual({ kind: 'conflict' });
    expect(repositories.mappingRepository.updateWhenCurrentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'customer-b',
        expectedCustomerId: 'customer-a',
        expectedStatus: 'revoked',
      }),
    );
    expect(repositories.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'wecom_customer_mapping_conflict_blocked' }),
    );
  });

  it('create-if-absent 并发冲突返回 conflict，不覆盖并记录 blocked audit', async () => {
    const repositories = writeRepositories();
    repositories.mappingRepository.createIfAbsent.mockResolvedValue(null);

    const result = await writeWeComCustomerMapping({
      context,
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      action: 'confirm',
      customerId: 'customer-a',
      occurredAt: '2026-07-10T09:00:00.000Z',
      createId: () => 'generated-id',
      repositories,
    });

    expect(result).toEqual({ kind: 'conflict' });
    expect(repositories.mappingRepository.updateWhenCurrentStatus).not.toHaveBeenCalled();
    expect(repositories.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'wecom_customer_mapping_conflict_blocked' }),
    );
  });

  it('客户不存在或跨机构时不读取 tenant-only 客户，也不泄露 resourceId', async () => {
    const repositories = writeRepositories();
    repositories.customerRepository.getCustomerByTenantAndInstitution.mockResolvedValue(null);

    const result = await writeWeComCustomerMapping({
      context,
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      action: 'confirm',
      customerId: 'other-inst-customer',
      occurredAt: '2026-07-10T09:00:00.000Z',
      createId: () => 'generated-id',
      repositories,
    });

    expect(result).toEqual({ kind: 'customer_not_found' });
    expect(repositories.mappingRepository.findByScope).not.toHaveBeenCalled();
    expect(repositories.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'customer',
        reason: 'wecom_customer_mapping_customer_not_found',
      }),
    );
    const [audit] = repositories.auditRepository.record.mock.calls[0];
    expect(audit).not.toHaveProperty('resourceId');
  });
});
