import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  InstitutionChannelDryRunSnapshot,
  TrustedReachOutSafetyRepository,
} from '@/modules/institution/server/trusted-reachout-safety-repository';
import { evaluateAndPersistWeComDryRunSnapshot } from '@/modules/institution/server/wecom-dry-run-snapshot-service';
import { mintVerifiedInstitutionAuditAttributionForOrchestrationV1 } from '@/modules/audit/domain/audit-events';

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
const auditAttribution = mintVerifiedInstitutionAuditAttributionForOrchestrationV1({
  formalPair: { tenantId: 'tenant-1', institutionId: 'institution-1', observedAt: '2026-07-11T00:00:00.000Z' },
  businessPair: { tenantId: 'tenant-1', institutionId: 'institution-1' },
})!;
if (!auditAttribution) throw new Error('test audit attribution unavailable');

describe('企业微信 dry-run 最新评估快照服务', () => {
  type SnapshotWrite = Parameters<TrustedReachOutSafetyRepository['upsertDryRunSnapshot']>[0];
  let currentSnapshot: InstitutionChannelDryRunSnapshot | null = null;
  const safetyRepository = { upsertDryRunSnapshot: vi.fn(), findDryRunSnapshot: vi.fn() };
  const auditRepository = { recordAttributed: vi.fn() };
  let sequence = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    sequence = 0;
    currentSnapshot = null;
    safetyRepository.upsertDryRunSnapshot.mockImplementation(async (input: SnapshotWrite) => {
      if (currentSnapshot) {
        const currentTime = new Date(currentSnapshot.evaluatedAt).getTime();
        const incomingTime = input.evaluatedAt.getTime();
        const isSameTimeSafetyTightening = currentTime === incomingTime
          && currentSnapshot.configStatus === 'dry_run_ready'
          && input.configStatus !== 'dry_run_ready';
        if (currentTime > incomingTime || (currentTime === incomingTime && !isSameTimeSafetyTightening)) {
          return null;
        }
      }
      const next: InstitutionChannelDryRunSnapshot = {
        ...input,
        evaluatedAt: input.evaluatedAt.toISOString(),
        version: (currentSnapshot?.version ?? 0) + 1,
      };
      currentSnapshot = next;
      return next;
    });
    safetyRepository.findDryRunSnapshot.mockImplementation(async () => currentSnapshot);
    auditRepository.recordAttributed.mockResolvedValue(undefined);
  });

  it('只由 evaluator 的 ready 结果写入，真实发送字段恒为 false', async () => {
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, createId: () => `generated-${++sequence}`, repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    expect(result.config.configStatus).toBe('dry_run_ready');
    expect(safetyRepository.upsertDryRunSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      configStatus: 'dry_run_ready', preflightStatus: 'mock_ready', proofEligibleMock: true,
      allowRealSend: false, externalChannelEnabled: false,
      realSendAllowed: false, dryRunOnly: true,
    }));
    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'wecom_reachout_dry_run_snapshot_ready', result: 'transitioned',
    }));
  });

  it('后续 blocked 评估覆盖旧 ready，不保留陈旧 ready', async () => {
    await evaluateAndPersistWeComDryRunSnapshot({
      ...base, occurredAt: '2026-07-11T01:00:00.000Z', createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, callbackPlaceholderRef: 'callback-reference', occurredAt: '2026-07-11T02:00:00.000Z',
      createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    expect(safetyRepository.upsertDryRunSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({
      configStatus: 'blocked_missing_callback_url',
      preflightStatus: 'blocked_route_unverified',
      proofEligibleMock: false,
    }));
    expect(result.snapshot.configStatus).toBe('blocked_missing_callback_url');
    expect(result.snapshot.version).toBe(2);
    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'wecom_reachout_dry_run_snapshot_blocked', result: 'denied',
    }));
  });

  it('较旧 ready 后到时不能覆盖较新的 blocked，且 stale 不增加 version', async () => {
    await evaluateAndPersistWeComDryRunSnapshot({
      ...base, callbackPlaceholderRef: 'callback-reference', occurredAt: '2026-07-11T02:00:00.000Z',
      createId: () => `generated-${++sequence}`, repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, occurredAt: '2026-07-11T01:00:00.000Z', createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    expect(result.config.configStatus).toBe('dry_run_ready');
    expect(result.snapshot.configStatus).toBe('blocked_missing_callback_url');
    expect(result.snapshot.version).toBe(1);
    expect(safetyRepository.findDryRunSnapshot).toHaveBeenCalledOnce();
    expect(auditRepository.recordAttributed).toHaveBeenLastCalledWith(expect.objectContaining({
      reason: 'wecom_reachout_dry_run_snapshot_blocked', result: 'denied',
    }));
  });

  it('较新的 ready 可以覆盖较旧 blocked', async () => {
    await evaluateAndPersistWeComDryRunSnapshot({
      ...base, callbackPlaceholderRef: 'callback-reference', occurredAt: '2026-07-11T01:00:00.000Z',
      createId: () => `generated-${++sequence}`, repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, occurredAt: '2026-07-11T02:00:00.000Z', createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    expect(result.snapshot.configStatus).toBe('dry_run_ready');
    expect(result.snapshot.version).toBe(2);
  });

  it('相同 evaluatedAt 不得造成 blocked → ready 安全回退', async () => {
    await evaluateAndPersistWeComDryRunSnapshot({
      ...base, callbackPlaceholderRef: 'callback-reference', occurredAt: '2026-07-11T02:00:00.000Z',
      createId: () => `generated-${++sequence}`, repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, occurredAt: '2026-07-11T02:00:00.000Z', createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    expect(result.snapshot.configStatus).toBe('blocked_missing_callback_url');
    expect(result.snapshot.version).toBe(1);
  });

  it('相同 evaluatedAt 允许 ready → blocked 安全收紧并增加 version', async () => {
    await evaluateAndPersistWeComDryRunSnapshot({
      ...base, occurredAt: '2026-07-11T02:00:00.000Z', createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, callbackPlaceholderRef: 'callback-reference', occurredAt: '2026-07-11T02:00:00.000Z',
      createId: () => `generated-${++sequence}`, repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    expect(result.snapshot.configStatus).toBe('blocked_missing_callback_url');
    expect(result.snapshot.version).toBe(2);
    expect(auditRepository.recordAttributed).toHaveBeenLastCalledWith(expect.objectContaining({
      reason: 'wecom_reachout_dry_run_snapshot_blocked', result: 'denied',
    }));
  });

  it('相同 evaluatedAt 的 ready → ready 不更新 version', async () => {
    await evaluateAndPersistWeComDryRunSnapshot({
      ...base, occurredAt: '2026-07-11T02:00:00.000Z', createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, occurredAt: '2026-07-11T02:00:00.000Z', createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    expect(result.snapshot.configStatus).toBe('dry_run_ready');
    expect(result.snapshot.version).toBe(1);
  });

  it('相同 evaluatedAt 的 blocked → blocked 不更新 version', async () => {
    await evaluateAndPersistWeComDryRunSnapshot({
      ...base, callbackPlaceholderRef: 'callback-reference', occurredAt: '2026-07-11T02:00:00.000Z',
      createId: () => `generated-${++sequence}`, repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, callbackPlaceholderRef: 'callback-reference', occurredAt: '2026-07-11T02:00:00.000Z',
      createId: () => `generated-${++sequence}`, repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    expect(result.snapshot.configStatus).toBe('blocked_missing_callback_url');
    expect(result.snapshot.version).toBe(1);
  });

  it('较旧 blocked 后到时不能覆盖较新的 ready', async () => {
    await evaluateAndPersistWeComDryRunSnapshot({
      ...base, occurredAt: '2026-07-11T02:00:00.000Z', createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, callbackPlaceholderRef: 'callback-reference', occurredAt: '2026-07-11T01:00:00.000Z',
      createId: () => `generated-${++sequence}`, repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    expect(result.config.configStatus).toBe('blocked_missing_callback_url');
    expect(result.snapshot.configStatus).toBe('dry_run_ready');
    expect(result.snapshot.version).toBe(1);
  });

  it('近似确认不能伪造 ready 状态', async () => {
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, confirmation: '确认保存', createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
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
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    expect(result.config.configStatus).not.toBe('dry_run_ready');
    expect(result.snapshot.proofEligibleMock).toBe(false);
    expect(result.snapshot.preflightStatus).not.toBe('mock_ready');
  });

  it.each([
    'official_wecom_third_party',
    'official_wecom_service_provider',
  ] as const)('V0.8 非 self-built 官方路线不能 trusted ready：%s', async (officialRoute) => {
    const result = await evaluateAndPersistWeComDryRunSnapshot({
      ...base, officialRoute, createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    expect(result.config.configStatus).not.toBe('dry_run_ready');
    expect(result.snapshot.preflightStatus).toBe('blocked_route_unverified');
    expect(result.snapshot.proofEligibleMock).toBe(false);
  });

  it('同时间 ready → blocked 更新在 audit 失败时回滚', async () => {
    await evaluateAndPersistWeComDryRunSnapshot({
      ...base, occurredAt: '2026-07-11T02:00:00.000Z', createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    });
    const before = currentSnapshot;
    auditRepository.recordAttributed.mockRejectedValue(new Error('audit unavailable'));
    async function transaction<T>(operation: () => Promise<T>) {
      const rollbackSnapshot = currentSnapshot;
      try {
        return await operation();
      } catch (error) {
        currentSnapshot = rollbackSnapshot;
        throw error;
      }
    }
    await expect(transaction(() => evaluateAndPersistWeComDryRunSnapshot({
      ...base, callbackPlaceholderRef: 'callback-reference', occurredAt: '2026-07-11T02:00:00.000Z',
      createId: () => `generated-${++sequence}`,
      repositories: { safetyRepository, auditRepository, auditAttribution } as never,
    }))).rejects.toThrow('audit unavailable');
    expect(currentSnapshot).toEqual(before);
    expect(currentSnapshot).toEqual(expect.objectContaining({
      configStatus: 'dry_run_ready', version: 1,
    }));
  });
});
