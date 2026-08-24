import { beforeEach, describe, expect, it, vi } from 'vitest';

const seams = vi.hoisted(() => ({
  genuineDecisions: new WeakSet<object>(),
  resolveCapabilityStatus: vi.fn(),
  scopeMatches: true,
  workspaceScopeKey: 'W'.repeat(43),
}));

vi.mock('@/modules/security/server/institution-section-guard', () => ({
  isInstitutionNavigationAuthorizationV1(value: unknown) {
    return value !== null
      && typeof value === 'object'
      && seams.genuineDecisions.has(value);
  },
  readInstitutionNavigationWorkspaceScopeKeyV1(value: unknown) {
    return value !== null
      && typeof value === 'object'
      && seams.genuineDecisions.has(value)
      ? seams.workspaceScopeKey
      : null;
  },
  matchesInstitutionNavigationAuthorizationScopeV1(value: unknown) {
    return seams.scopeMatches
      && value !== null
      && typeof value === 'object'
      && seams.genuineDecisions.has(value);
  },
}));

vi.mock('@/server/orchestration/institution-capability-authority', () => ({
  resolveInstitutionCapabilityAuthorityStatusV1:
    seams.resolveCapabilityStatus,
}));

import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import type { InstitutionNavigationSectionIdV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { resolveInstitutionShellAuthorizationV1 } from '@/modules/institution-shell/server/institution-shell-authorization';
import type { InstitutionNavigationAuthorizationV1 } from '@/modules/security/server/institution-section-guard';

function navigationDecision(
  targetSectionId: InstitutionNavigationSectionIdV1,
  targetAccess: 'allowed' | 'blocked',
) {
  const decision = Object.freeze({
    kind: 'institution_navigation_authorization' as const,
    targetSectionId,
    targetAccess,
    availableSectionIds: Object.freeze([
      'workbench',
      'customers',
      'conversations',
      'care',
    ] as const),
  });
  seams.genuineDecisions.add(decision);
  return decision as unknown as InstitutionNavigationAuthorizationV1;
}

function capabilityStatus(
  customerDecision: 'operational' | 'hidden' = 'operational',
): CapabilityStatusV1 {
  const freshness = Object.freeze({
    observedAt: '2026-08-24T15:00:00.000Z',
    freshUntil: '2026-08-24T15:00:05.000Z',
  });
  const definitions = [
    ['page_workbench', 'operational'],
    ['page_customer_list', customerDecision],
    ['page_conversation_queue', 'operational'],
  ] as const;
  return {
    contractVersion: 'v1',
    scope: { tenantId: 'tenant-shell-001', institutionId: 'institution-shell-001' },
    readiness: 'ready',
    freshness,
    partitions: definitions.map(([key]) => ({
      key,
      readiness: 'ready',
      freshness,
      failureCode: null,
    })),
    data: {
      capabilities: definitions.map(([key, decision]) => ({
        key,
        decision,
        dimensions: {
          codeMaturity: decision === 'hidden' ? 'unverified' : 'verified',
          institutionAuthorization:
            decision === 'hidden' ? 'not_authorized' : 'authorized',
          connectionAvailability: 'not_required',
          dataReadiness: decision === 'hidden' ? 'not_required' : 'ready',
          productionRelease:
            decision === 'hidden' ? 'not_released' : 'pilot_released',
        },
        safeSummary: null,
        diagnosticTargetKey: null,
      })),
    },
    failureCode: null,
  };
}

describe('机构端 Shell 统一服务端授权映射', () => {
  beforeEach(() => {
    seams.resolveCapabilityStatus.mockReset();
    seams.scopeMatches = true;
  });

  it('当前栏目被阻断时仍计算其他已授权页面目标，不改变当前页阻断事实', async () => {
    seams.resolveCapabilityStatus.mockResolvedValueOnce(capabilityStatus());
    const decision = navigationDecision('system', 'blocked');

    const result = await resolveInstitutionShellAuthorizationV1(decision);

    expect(decision.targetAccess).toBe('blocked');
    expect(result.availableNavigationTargets.map((target) => target.pathname)).toEqual([
      '/hospital',
      '/hospital/customers',
      '/hospital/conversations',
    ]);
    expect(result.workspaceScopeKey).toBe(seams.workspaceScopeKey);
  });

  it('当前页面 capability-off 时仍保留其他已授权目标并排除当前页面', async () => {
    seams.resolveCapabilityStatus.mockResolvedValueOnce(capabilityStatus('hidden'));

    const result = await resolveInstitutionShellAuthorizationV1(
      navigationDecision('customers', 'allowed'),
    );

    expect(result.availableNavigationTargets.map((target) => target.pathname)).toEqual([
      '/hospital',
      '/hospital/conversations',
    ]);
  });

  it('请求授权缺失时不调用 Capability Authority，且不返回 Workspace Scope Key', async () => {
    await expect(resolveInstitutionShellAuthorizationV1(null)).resolves.toMatchObject({
      availableSectionIds: [],
      availableNavigationTargets: [],
      capabilityStatus: null,
      workspaceScopeKey: null,
    });
    expect(seams.resolveCapabilityStatus).not.toHaveBeenCalled();
  });

  it('Capability Authority 抛错或返回 null 时不返回 Workspace Scope Key', async () => {
    seams.resolveCapabilityStatus.mockRejectedValueOnce(new Error('authority unavailable'));
    const failed = await resolveInstitutionShellAuthorizationV1(
      navigationDecision('customers', 'allowed'),
    );
    expect(failed.availableNavigationTargets).toEqual([]);
    expect(failed.capabilityStatus).toBeNull();
    expect(failed.workspaceScopeKey).toBeNull();

    seams.resolveCapabilityStatus.mockResolvedValueOnce(null);
    const unavailable = await resolveInstitutionShellAuthorizationV1(
      navigationDecision('customers', 'allowed'),
    );
    expect(unavailable.availableNavigationTargets).toEqual([]);
    expect(unavailable.capabilityStatus).toBeNull();
    expect(unavailable.workspaceScopeKey).toBeNull();
  });

  it('Capability envelope 不可用时不返回 Workspace Scope Key', async () => {
    seams.resolveCapabilityStatus.mockResolvedValueOnce({
      ...capabilityStatus(),
      readiness: 'unavailable',
      data: null,
      failureCode: 'upstream_unavailable',
    } satisfies CapabilityStatusV1);

    const result = await resolveInstitutionShellAuthorizationV1(
      navigationDecision('customers', 'allowed'),
    );

    expect(result.availableNavigationTargets).toEqual([]);
    expect(result.capabilityStatus).toBeNull();
    expect(result.workspaceScopeKey).toBeNull();

    seams.resolveCapabilityStatus.mockResolvedValueOnce({
      ...capabilityStatus(),
      partitions: null,
    } as unknown as CapabilityStatusV1);
    const invalid = await resolveInstitutionShellAuthorizationV1(
      navigationDecision('customers', 'allowed'),
    );
    expect(invalid.availableNavigationTargets).toEqual([]);
    expect(invalid.capabilityStatus).toBeNull();
    expect(invalid.workspaceScopeKey).toBeNull();
  });

  it('Capability Authority 的 tenant 或 institution 与导航决策不一致时 fail-closed', async () => {
    seams.scopeMatches = false;
    seams.resolveCapabilityStatus.mockResolvedValueOnce(capabilityStatus());

    const result = await resolveInstitutionShellAuthorizationV1(
      navigationDecision('customers', 'allowed'),
    );

    expect(result.availableNavigationTargets).toEqual([]);
    expect(result.capabilityStatus).toBeNull();
    expect(result.workspaceScopeKey).toBeNull();
  });
});
