import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readWeComReachOutSafety,
  recordWeComReachOutConsent,
  reservePreparedAttempt,
} from '@/modules/institution/server/trusted-reachout-safety-service';

const context = {
  source: 'demo_session',
  userId: 'admin-1',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-1',
  institutionId: 'institution-1',
} as const;
const scope = { tenantId: 'tenant-1', institutionId: 'institution-1', customerId: 'customer-1' };

function frequency(overrides: Record<string, unknown> = {}) {
  return {
    id: 'frequency-1',
    ...scope,
    channelType: 'wechat_work' as const,
    windowStartedAt: '2026-07-11T00:00:00.000Z',
    windowEndsAt: '2026-07-12T00:00:00.000Z',
    preparedCount: 1,
    completedCount: 0,
    maxPreparedCount: 1 as const,
    maxCompletedCount: 1 as const,
    nextAllowedAt: '2026-07-12T00:00:00.000Z',
    lastPreparedRef: 'wrop_operation-1',
    lastCompletedRef: null,
    version: 1,
    ...overrides,
  };
}

function consent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'consent-1',
    ...scope,
    channelType: 'wechat_work' as const,
    status: 'consented' as const,
    sourceType: 'customer_explicit_written' as const,
    evidenceRef: 'wcc-generated',
    recordedBy: 'admin-1',
    recordedAt: '2026-07-11T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

describe('可信企业微信触达安全服务', () => {
  const customerRepository = { getCustomerByTenantAndInstitution: vi.fn() };
  const safetyRepository = {
    findConsent: vi.fn(),
    findConsentForUpdate: vi.fn(),
    upsertConsent: vi.fn(),
    findFrequency: vi.fn(),
    createFrequencyIfAbsent: vi.fn(),
    updateFrequencyWhenVersion: vi.fn(),
  };
  const auditRepository = { record: vi.fn() };
  let id = 0;
  const createId = () => `generated-${++id}`;

  beforeEach(() => {
    vi.clearAllMocks();
    id = 0;
    customerRepository.getCustomerByTenantAndInstitution.mockResolvedValue({ id: 'customer-1' });
    safetyRepository.findConsent.mockResolvedValue(null);
    safetyRepository.findConsentForUpdate.mockResolvedValue(null);
    safetyRepository.findFrequency.mockResolvedValue(null);
    auditRepository.record.mockResolvedValue(undefined);
  });

  it('无许可和频控记录对外返回 unknown 与保守默认值', async () => {
    const result = await readWeComReachOutSafety({ scope, repositories: { customerRepository, safetyRepository } as never });
    expect(result).toEqual({ kind: 'found', safety: {
      consent: { status: 'unknown', sourceType: null, recordedAt: null },
      frequency: {
        windowStartedAt: null, windowEndsAt: null, preparedCount: 0, completedCount: 0,
        maxPreparedCount: 1, maxCompletedCount: 1, nextAllowedAt: null,
      },
    } });
  });

  it('跨机构或不存在客户统一 not_found 且不读取安全状态', async () => {
    customerRepository.getCustomerByTenantAndInstitution.mockResolvedValue(null);
    expect(await readWeComReachOutSafety({ scope, repositories: { customerRepository, safetyRepository } as never }))
      .toEqual({ kind: 'customer_not_found' });
    expect(safetyRepository.findConsent).not.toHaveBeenCalled();
  });

  it('服务端生成 evidenceRef，许可写入和 audit 位于同一依赖集合', async () => {
    safetyRepository.upsertConsent.mockImplementation(async (input) => consent(input));
    const result = await recordWeComReachOutConsent({
      context, scope, action: 'record_consent', sourceType: 'customer_explicit_written',
      confirmation: '我确认客户已明确同意通过企业微信联系', occurredAt: '2026-07-11T00:00:00.000Z',
      createId, repositories: { customerRepository, safetyRepository, auditRepository } as never,
    });
    expect(result.kind).toBe('updated');
    expect(safetyRepository.upsertConsent).toHaveBeenCalledWith(expect.objectContaining({
      evidenceRef: 'wcc_generated-1', status: 'consented', expectedVersion: null,
    }));
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'wecom_reachout_consent_recorded', result: 'transitioned',
    }));
  });

  it('相同状态与来源幂等，不重复写入或审计', async () => {
    safetyRepository.findConsentForUpdate.mockResolvedValue(consent());
    const result = await recordWeComReachOutConsent({
      context, scope, action: 'record_consent', sourceType: 'customer_explicit_written',
      confirmation: '我确认客户已明确同意通过企业微信联系', occurredAt: '2026-07-11T00:00:00.000Z',
      createId, repositories: { customerRepository, safetyRepository, auditRepository } as never,
    });
    expect(result.kind).toBe('idempotent');
    expect(safetyRepository.upsertConsent).not.toHaveBeenCalled();
    expect(auditRepository.record).not.toHaveBeenCalled();
  });

  it('CAS 失败返回 conflict，避免并发覆盖', async () => {
    safetyRepository.findConsentForUpdate.mockResolvedValue(consent({ status: 'opted_out', sourceType: 'customer_opt_out_request' }));
    safetyRepository.upsertConsent.mockResolvedValue(null);
    const result = await recordWeComReachOutConsent({
      context, scope, action: 'record_consent', sourceType: 'customer_explicit_verbal',
      confirmation: '我确认客户已明确同意通过企业微信联系', occurredAt: '2026-07-11T00:00:00.000Z',
      createId, repositories: { customerRepository, safetyRepository, auditRepository } as never,
    });
    expect(result).toEqual({ kind: 'conflict' });
    expect(safetyRepository.upsertConsent).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 1 }));
  });

  it('opt-out 优先于频控阻断且不写频控', async () => {
    safetyRepository.findConsentForUpdate.mockResolvedValue(consent({ status: 'opted_out' }));
    expect((await reservePreparedAttempt({
      context, scope, systemOperationId: 'operation-2', occurredAt: '2026-07-11T01:00:00.000Z', createId,
      repositories: { safetyRepository, auditRepository } as never,
    })).kind).toBe('opted_out');
    expect(safetyRepository.findConsentForUpdate).toHaveBeenCalledWith(scope);
    expect(safetyRepository.findFrequency).not.toHaveBeenCalled();
  });

  it('无 consent row 的锁定读取仍按 unknown 失败关闭', async () => {
    safetyRepository.findConsentForUpdate.mockResolvedValue(null);
    const result = await reservePreparedAttempt({
      context, scope, systemOperationId: 'operation-2', occurredAt: '2026-07-11T01:00:00.000Z', createId,
      repositories: { safetyRepository, auditRepository } as never,
    });
    expect(result.kind).toBe('consent_required');
    expect(safetyRepository.findFrequency).not.toHaveBeenCalled();
    expect(auditRepository.record).not.toHaveBeenCalled();
  });

  it('首次预留、同 ref 幂等和窗口内超限', async () => {
    safetyRepository.findConsentForUpdate.mockResolvedValue(consent());
    safetyRepository.createFrequencyIfAbsent.mockResolvedValue(frequency());
    expect((await reservePreparedAttempt({
      context, scope, systemOperationId: 'operation-1', occurredAt: '2026-07-11T00:00:00.000Z', createId,
      repositories: { safetyRepository, auditRepository } as never,
    })).kind).toBe('reserved');

    safetyRepository.findFrequency.mockResolvedValue(frequency());
    expect((await reservePreparedAttempt({
      context, scope, systemOperationId: 'operation-1', occurredAt: '2026-07-11T01:00:00.000Z', createId,
      repositories: { safetyRepository, auditRepository } as never,
    })).kind).toBe('idempotent');

    expect((await reservePreparedAttempt({
      context, scope, systemOperationId: 'operation-2', occurredAt: '2026-07-11T01:00:00.000Z', createId,
      repositories: { safetyRepository, auditRepository } as never,
    })).kind).toBe('frequency_cap_reached');
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({ reason: 'wecom_reachout_frequency_blocked' }));
  });

  it('窗口过期以 CAS 原子重置并预留', async () => {
    safetyRepository.findConsentForUpdate.mockResolvedValue(consent());
    safetyRepository.findFrequency.mockResolvedValue(frequency());
    safetyRepository.updateFrequencyWhenVersion.mockResolvedValue(frequency({
      windowStartedAt: '2026-07-12T01:00:00.000Z', windowEndsAt: '2026-07-13T01:00:00.000Z',
      lastPreparedRef: 'wrop_operation-2', version: 2,
    }));
    const result = await reservePreparedAttempt({
      context, scope, systemOperationId: 'operation-2', occurredAt: '2026-07-12T01:00:00.000Z', createId,
      repositories: { safetyRepository, auditRepository } as never,
    });
    expect(result.kind).toBe('reserved');
    expect(safetyRepository.updateFrequencyWhenVersion).toHaveBeenCalledWith(expect.objectContaining({
      preparedCount: 1, completedCount: 0, expectedVersion: 1,
      windowStartedAt: new Date('2026-07-12T01:00:00.000Z'),
      operationRef: 'wrop_operation-2',
    }));
  });

  it('拒绝非低敏系统 operation ID，且不读取或写入频控', async () => {
    const result = await reservePreparedAttempt({
      context, scope, systemOperationId: 'customer@example.com', occurredAt: '2026-07-11T01:00:00.000Z', createId,
      repositories: { safetyRepository, auditRepository } as never,
    });
    expect(result.kind).toBe('invalid_operation');
    expect(safetyRepository.findConsentForUpdate).not.toHaveBeenCalled();
    expect(safetyRepository.findFrequency).not.toHaveBeenCalled();
  });

  it('CAS 连续冲突最多重试 3 次且不写 audit', async () => {
    safetyRepository.findConsentForUpdate.mockResolvedValue(consent());
    safetyRepository.findFrequency.mockResolvedValue(frequency({ preparedCount: 0, lastPreparedRef: null }));
    safetyRepository.updateFrequencyWhenVersion.mockResolvedValue(null);
    const result = await reservePreparedAttempt({
      context, scope, systemOperationId: 'operation-2', occurredAt: '2026-07-11T01:00:00.000Z', createId,
      repositories: { safetyRepository, auditRepository } as never,
    });
    expect(result.kind).toBe('conflict');
    expect(safetyRepository.updateFrequencyWhenVersion).toHaveBeenCalledTimes(3);
    expect(auditRepository.record).not.toHaveBeenCalled();
  });

  it('两个写链路固定按 consent row lock → frequency/CAS → audit 顺序执行', async () => {
    const order: string[] = [];
    safetyRepository.findConsentForUpdate.mockImplementation(async () => {
      order.push('consent_lock');
      return consent();
    });
    safetyRepository.findFrequency.mockImplementation(async () => {
      order.push('frequency_read');
      return null;
    });
    safetyRepository.createFrequencyIfAbsent.mockImplementation(async () => {
      order.push('frequency_write');
      return frequency();
    });
    auditRepository.record.mockImplementation(async () => {
      order.push('audit');
    });

    await reservePreparedAttempt({
      context, scope, systemOperationId: 'operation-1', occurredAt: '2026-07-11T01:00:00.000Z', createId,
      repositories: { safetyRepository, auditRepository } as never,
    });
    expect(order).toEqual(['consent_lock', 'frequency_read', 'frequency_write', 'audit']);

    order.length = 0;
    safetyRepository.upsertConsent.mockImplementation(async (input) => {
      order.push('consent_write');
      return consent(input);
    });
    await recordWeComReachOutConsent({
      context, scope, action: 'record_opt_out', sourceType: 'customer_opt_out_request',
      confirmation: '我确认客户已明确要求停止企业微信联系', occurredAt: '2026-07-11T02:00:00.000Z',
      createId, repositories: { customerRepository, safetyRepository, auditRepository } as never,
    });
    expect(order).toEqual(['consent_lock', 'consent_write', 'audit']);
  });

  it('reserve 等待 consent 锁定读取完成后才读取 frequency，不能用旧 consent 绕过', async () => {
    let releaseLock!: (value: ReturnType<typeof consent>) => void;
    safetyRepository.findConsentForUpdate.mockReturnValue(new Promise((resolve) => {
      releaseLock = resolve;
    }));
    const pending = reservePreparedAttempt({
      context, scope, systemOperationId: 'operation-2', occurredAt: '2026-07-11T01:00:00.000Z', createId,
      repositories: { safetyRepository, auditRepository } as never,
    });
    await Promise.resolve();
    expect(safetyRepository.findFrequency).not.toHaveBeenCalled();

    releaseLock(consent({ status: 'opted_out', sourceType: 'customer_opt_out_request' }));
    expect((await pending).kind).toBe('opted_out');
    expect(safetyRepository.findFrequency).not.toHaveBeenCalled();
  });
});
