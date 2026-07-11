import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateAndPersistWeComDryRunSnapshot } from '@/modules/institution/server/wecom-dry-run-snapshot-service';

const context = {
  source: 'demo_session',
  userId: 'admin-1', role: 'tenant_admin', scope: 'tenant', tenantId: 'tenant-1', institutionId: 'institution-1',
} as const;
const base = {
  context,
  tenantId: 'tenant-1',
  institutionId: 'institution-1',
  officialRoute: 'official_wecom_self_built' as const,
  proofInstitutionRef: 'institution-placeholder-1',
  callbackPlaceholderRef: 'callback-placeholder-example-test',
  hasTestWeComEnvironment: true,
  hasSecretKeeperConfirmed: true,
  confirmation: '我确认仅保存低敏 dry-run 评估快照且不启用真实发送',
  occurredAt: '2026-07-11T00:00:00.000Z',
};

describe('企业微信 dry-run 最新评估快照服务', () => {
  const safetyRepository = { upsertDryRunSnapshot: vi.fn() };
  const auditRepository = { record: vi.fn() };
  let sequence = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    sequence = 0;
    safetyRepository.upsertDryRunSnapshot.mockImplementation(async (input) => ({ ...input, evaluatedAt: input.evaluatedAt.toISOString(), version: 1 }));
    auditRepository.record.mockResolvedValue(undefined);
  });

  it('只由 evaluator 的 ready 结果写入，真实发送字段恒为 false', async () => {
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, createId: () => `generated-${++sequence}`, repositories: { safetyRepository, auditRepository } as never,
    });
    expect(result.config.configStatus).toBe('dry_run_ready');
    expect(safetyRepository.upsertDryRunSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      configStatus: 'dry_run_ready', preflightStatus: 'mock_ready', proofEligibleMock: true,
      allowRealSend: false, externalChannelEnabled: false,
      realSendAllowed: false, dryRunOnly: true,
    }));
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'wecom_reachout_dry_run_snapshot_ready', result: 'transitioned',
    }));
  });

  it('后续 blocked 评估覆盖旧 ready，不保留陈旧 ready', async () => {
    await evaluateAndPersistWeComDryRunSnapshot({
      ...base, callbackPlaceholderRef: 'callback-reference', createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository } as never,
    });
    expect(safetyRepository.upsertDryRunSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({
      configStatus: 'blocked_missing_callback_url',
      preflightStatus: 'blocked_route_unverified',
      proofEligibleMock: false,
    }));
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'wecom_reachout_dry_run_snapshot_blocked', result: 'denied',
    }));
  });

  it('近似确认不能伪造 ready 状态', async () => {
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, confirmation: '确认保存', createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository } as never,
    });
    expect(result.config.configStatus).toBe('blocked_missing_manual_confirmation');
    expect(result.snapshot.configStatus).not.toBe('dry_run_ready');
  });

  it.each([
    ['测试环境未确认', { hasTestWeComEnvironment: false }],
    ['secret keeper 未确认', { hasSecretKeeperConfirmed: false }],
    ['callback 占位未验证', { callbackPlaceholderRef: 'callback-reference' }],
    ['人工确认不精确', { confirmation: '确认保存' }],
  ])('缺少条件时服务端派生为不可用：%s', async (_label, override) => {
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, ...override, createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository } as never,
    });
    expect(result.config.configStatus).not.toBe('dry_run_ready');
    expect(result.snapshot.proofEligibleMock).toBe(false);
    expect(result.snapshot.preflightStatus).not.toBe('mock_ready');
  });
});
