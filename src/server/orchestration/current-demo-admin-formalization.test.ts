import { describe, expect, it, vi } from 'vitest';

import {
  CURRENT_DEMO_ADMIN_FORMALIZATION_TASK,
  CURRENT_DEMO_ADMIN_FORMALIZATION_VERSION,
  CurrentDemoAdminPhaseExecutionError,
  classifyCurrentDemoAccount,
  classifyCurrentDemoBinding,
  classifyCurrentDemoMembership,
  classifyCurrentDemoProvisioning,
  decideCurrentDemoPhaseA,
  orchestrateCurrentDemoAdminFormalization,
  type CurrentDemoAdminAuthorityManifest,
  type CurrentDemoAdminFormalizationPhasePorts,
} from './current-demo-admin-formalization';

const manifest: CurrentDemoAdminAuthorityManifest = Object.freeze({
  task: CURRENT_DEMO_ADMIN_FORMALIZATION_TASK,
  version: CURRENT_DEMO_ADMIN_FORMALIZATION_VERSION,
  authorityRef: 'S39-AUTH-20260816-001',
  targetEnvironment: 'local_candidate',
  username: 'admin',
  accountId: 'demo-user-admin',
  accountDisplayName: '系统管理员',
  tenantId: 'growth-tenant-chengxing',
  tenantName: '澄星医疗美容',
  institutionId: 'growth-inst-chengxing',
  institutionName: '澄星医疗美容',
  membershipId: 'membership-chengxing-admin',
  bindingId: 'binding-chengxing-admin',
  timezone: 'Asia/Shanghai',
  currency: 'CNY',
  approvedAt: '2026-08-16T00:00:00.000Z',
  effectiveAt: '2026-08-16T00:00:00.000Z',
  effectiveFromBusinessDate: '2026-08-16',
  assignmentSource: 'manual_admin',
  provenanceSource: 'access_control_command',
  reasonCode: 'post_rebuild_formal_provisioning',
  expectedCodeSha: 'a'.repeat(40),
  executionWindowNotAfter: '2026-08-17T00:00:00.000Z',
});

const exactAccount = Object.freeze({
  id: 'demo-user-admin',
  username: 'admin',
  displayName: '系统管理员',
  phone: null,
  email: null,
  passwordResetRequired: false,
  status: 'active',
  lastLoginAt: null,
  failedLoginCount: 0,
  lockedUntil: null,
  createdBy: 'demo-user-admin',
  updatedBy: 'demo-user-admin',
});

const exactMembership = Object.freeze({
  membershipId: manifest.membershipId,
  tenantId: manifest.tenantId,
  userId: manifest.accountId,
  role: 'tenant_admin',
  displayName: '系统管理员',
  revision: 1,
  lifecycleStatus: 'active',
  provenanceSource: 'formal_onboarding',
  provenanceActorId: 'demo-user-admin',
  provenanceReasonCode: 'formal_onboarding',
});

const exactBinding = Object.freeze({
  bindingId: manifest.bindingId,
  accountId: manifest.accountId,
  tenantId: manifest.tenantId,
  institutionId: manifest.institutionId,
  status: 'active',
  source: 'manual_admin',
  expiresAt: null,
  version: 1,
});

function phases(
  overrides: Partial<CurrentDemoAdminFormalizationPhasePorts> = {},
): CurrentDemoAdminFormalizationPhasePorts {
  return {
    runPhaseA: vi.fn(async () => ({
      phase: 'candidate' as const,
      accountState: 'missing' as const,
      membershipState: 'missing' as const,
      databaseWriteExecuted: false,
    })),
    runPhaseB: vi.fn(async () => ({
      phase: 'candidate' as const,
      scopeState: 'missing' as const,
      contextState: 'missing' as const,
      databaseWriteExecuted: false,
    })),
    runPhaseC: vi.fn(async () => ({
      phase: 'candidate' as const,
      bindingState: 'missing' as const,
      databaseWriteExecuted: false,
    })),
    ...overrides,
  };
}

describe('current demo admin formalization semantic decisions', () => {
  it('classifies missing and exact formal Auth account', () => {
    expect(classifyCurrentDemoAccount(null)).toBe('missing');
    expect(classifyCurrentDemoAccount(exactAccount)).toBe('reused');
  });

  it('rejects generic password-reset account semantics', () => {
    expect(classifyCurrentDemoAccount({
      ...exactAccount,
      status: 'password_reset_required',
      passwordResetRequired: true,
    })).toBe('conflict');
  });

  it('reuses an exact account after mutable login metadata changes', () => {
    expect(classifyCurrentDemoAccount({
      ...exactAccount,
      lastLoginAt: new Date('2026-08-16T02:00:00.000Z'),
      failedLoginCount: 4,
      updatedBy: 'runtime-auth-owner',
    })).toBe('reused');
  });

  it.each([
    ['id', 'other-account'],
    ['username', 'other-admin'],
    ['displayName', '其他管理员'],
    ['phone', '13800000000'],
    ['email', 'admin@example.test'],
    ['passwordResetRequired', true],
    ['status', 'disabled'],
    ['lockedUntil', new Date('2026-08-17T00:00:00.000Z')],
    ['createdBy', 'other-account'],
  ] as const)('rejects account security mismatch in %s', (key, value) => {
    expect(classifyCurrentDemoAccount({
      ...exactAccount,
      [key]: value,
    })).toBe('conflict');
  });

  it('classifies missing and exact formal Membership', () => {
    expect(classifyCurrentDemoMembership(null, manifest)).toBe('missing');
    expect(classifyCurrentDemoMembership(exactMembership, manifest)).toBe('reused');
  });

  it.each([
    ['membershipId', 'other-membership'],
    ['role', 'staff'],
    ['revision', 2],
    ['provenanceSource', 'legacy_calibration'],
  ] as const)('rejects Membership semantic mismatch in %s', (key, value) => {
    expect(classifyCurrentDemoMembership({
      ...exactMembership,
      [key]: value,
    }, manifest)).toBe('conflict');
  });

  it('classifies canonical provisioning all-missing and exact-reused', () => {
    expect(classifyCurrentDemoProvisioning({
      input: 1,
      insertedCandidate: 1,
      reusedCandidate: 0,
      conflict: 0,
      unexpected: 0,
    })).toBe('missing');
    expect(classifyCurrentDemoProvisioning({
      input: 1,
      insertedCandidate: 0,
      reusedCandidate: 1,
      conflict: 0,
      unexpected: 0,
    })).toBe('reused');
  });

  it('fails closed on partial, conflict, or malformed provisioning counts', () => {
    expect(classifyCurrentDemoProvisioning({
      input: 1,
      insertedCandidate: 0,
      reusedCandidate: 0,
      conflict: 1,
      unexpected: 0,
    })).toBe('conflict');
    expect(classifyCurrentDemoProvisioning({
      input: 1,
      insertedCandidate: 0,
      reusedCandidate: 0,
      conflict: 0,
      unexpected: 1,
    })).toBe('unexpected');
    expect(classifyCurrentDemoProvisioning({
      input: 1,
      insertedCandidate: 0,
      reusedCandidate: 0,
      conflict: 0,
      unexpected: 0,
    })).toBe('unexpected');
  });

  it('classifies missing, exact, and other active Binding without rebind', () => {
    expect(classifyCurrentDemoBinding(null, manifest)).toBe('missing');
    expect(classifyCurrentDemoBinding(exactBinding, manifest)).toBe('reused');
    expect(classifyCurrentDemoBinding({
      ...exactBinding,
      bindingId: 'other-active-binding',
    }, manifest)).toBe('conflict');
    expect(classifyCurrentDemoBinding({
      ...exactBinding,
      bindingId: 'other-active-binding',
      institutionId: 'growth-inst-other',
    }, manifest)).toBe('conflict');
  });

  it('allows account exact plus Membership missing', () => {
    expect(decideCurrentDemoPhaseA({
      mode: 'dry-run',
      accountState: 'reused',
      membershipState: 'missing',
    })).toBe('candidate');
  });

  it('rejects account missing plus Membership existing', () => {
    expect(decideCurrentDemoPhaseA({
      mode: 'dry-run',
      accountState: 'missing',
      membershipState: 'reused',
    })).toBe('conflict');
  });

  it('requires existing account password verification in execute mode', () => {
    expect(decideCurrentDemoPhaseA({
      mode: 'execute',
      accountState: 'reused',
      membershipState: 'reused',
      passwordVerified: false,
    })).toBe('conflict');
    expect(decideCurrentDemoPhaseA({
      mode: 'execute',
      accountState: 'reused',
      membershipState: 'reused',
      passwordVerified: true,
    })).toBe('reused');
  });
});

describe('current demo admin formalization state machine', () => {
  it('models all missing as three dry-run candidates without writes', async () => {
    const result = await orchestrateCurrentDemoAdminFormalization({
      mode: 'dry-run',
      manifest,
      password: null,
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: phases(),
    });
    expect(result).toMatchObject({
      phaseA: 'candidate',
      phaseB: 'candidate',
      phaseC: 'candidate',
      databaseWriteExecuted: false,
      conflictCount: 0,
      unexpectedCount: 0,
    });
  });

  it('exposes the password only to Phase A', async () => {
    const port = phases();
    await orchestrateCurrentDemoAdminFormalization({
      mode: 'dry-run',
      manifest,
      password: 'phase-a-only',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: port,
    });
    expect(Object.keys(vi.mocked(port.runPhaseA).mock.calls[0]![0]).sort())
      .toEqual(['manifest', 'mode', 'now', 'password']);
    expect(Object.keys(vi.mocked(port.runPhaseB).mock.calls[0]![0]).sort())
      .toEqual(['manifest', 'mode']);
    expect(Object.keys(vi.mocked(port.runPhaseC).mock.calls[0]![0]).sort())
      .toEqual(['manifest', 'mode', 'now', 'phaseA']);
  });

  it('models all complete as fully reused', async () => {
    const result = await orchestrateCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'not-logged',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: phases({
        runPhaseA: vi.fn(async () => ({
          phase: 'reused',
          accountState: 'reused',
          membershipState: 'reused',
          databaseWriteExecuted: false,
        } as const)),
        runPhaseB: vi.fn(async () => ({
          phase: 'reused',
          scopeState: 'reused',
          contextState: 'reused',
          databaseWriteExecuted: false,
        } as const)),
        runPhaseC: vi.fn(async () => ({
          phase: 'reused',
          bindingState: 'reused',
          databaseWriteExecuted: false,
        } as const)),
      }),
    });
    expect(result).toMatchObject({
      phaseA: 'reused',
      phaseB: 'reused',
      phaseC: 'reused',
      databaseWriteExecuted: false,
    });
  });

  it('supports A complete and B missing without granting Binding early', async () => {
    const port = phases({
      runPhaseA: vi.fn(async () => ({
        phase: 'reused',
        accountState: 'reused',
        membershipState: 'reused',
        databaseWriteExecuted: false,
      } as const)),
      runPhaseB: vi.fn(async () => ({
        phase: 'conflict',
        scopeState: 'conflict',
        contextState: 'conflict',
        databaseWriteExecuted: false,
      } as const)),
    });
    const result = await orchestrateCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'not-logged',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: port,
    });
    expect(result.phaseC).toBe('not_run');
    expect(port.runPhaseC).not.toHaveBeenCalled();
  });

  it('supports A+B complete and C missing as an isolated final phase', async () => {
    const result = await orchestrateCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'not-logged',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: phases({
        runPhaseA: vi.fn(async () => ({
          phase: 'reused',
          accountState: 'reused',
          membershipState: 'reused',
          databaseWriteExecuted: false,
        } as const)),
        runPhaseB: vi.fn(async () => ({
          phase: 'reused',
          scopeState: 'reused',
          contextState: 'reused',
          databaseWriteExecuted: false,
        } as const)),
        runPhaseC: vi.fn(async () => ({
          phase: 'applied',
          bindingState: 'applied',
          databaseWriteExecuted: true,
        } as const)),
      }),
    });
    expect(result).toMatchObject({
      phaseA: 'reused',
      phaseB: 'reused',
      phaseC: 'applied',
      databaseWriteExecuted: true,
    });
  });

  it('stops after a conflict and never retries later phases', async () => {
    const port = phases({
      runPhaseA: vi.fn(async () => ({
        phase: 'conflict',
        accountState: 'conflict',
        membershipState: 'missing',
        databaseWriteExecuted: false,
      } as const)),
    });
    const result = await orchestrateCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'not-logged',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: port,
    });
    expect(result.conflictCount).toBe(1);
    expect(port.runPhaseA).toHaveBeenCalledTimes(1);
    expect(port.runPhaseB).not.toHaveBeenCalled();
    expect(port.runPhaseC).not.toHaveBeenCalled();
  });

  it('marks a pre-write failure unexpected without claiming a write', async () => {
    const throwing = phases({
      runPhaseA: vi.fn(async () => {
        throw new Error('sensitive database detail');
      }),
    });
    const thrownResult = await orchestrateCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'not-logged',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: throwing,
    });
    expect(thrownResult.phaseA).toBe('unexpected');
    expect(thrownResult.unexpectedCount).toBe(2);
    expect(thrownResult.databaseWriteExecuted).toBe(false);
  });

  it('preserves may-have-committed after owner write and recheck failures', async () => {
    const phaseAWriteFailure = await orchestrateCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'not-logged',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: phases({
        runPhaseA: vi.fn(async () => {
          throw new CurrentDemoAdminPhaseExecutionError('phase_a', true);
        }),
      }),
    });
    expect(phaseAWriteFailure).toMatchObject({
      phaseA: 'unexpected',
      databaseWriteExecuted: true,
    });

    const phaseBRecheckFailure = await orchestrateCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'not-logged',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: phases({
        runPhaseA: vi.fn(async () => ({
          phase: 'reused',
          accountState: 'reused',
          membershipState: 'reused',
          databaseWriteExecuted: false,
        } as const)),
        runPhaseB: vi.fn(async () => {
          throw new CurrentDemoAdminPhaseExecutionError('phase_b', true);
        }),
      }),
    });
    expect(phaseBRecheckFailure).toMatchObject({
      phaseB: 'unexpected',
      databaseWriteExecuted: true,
    });
  });

  it('turns malformed phase outcomes into fail-closed unexpected', async () => {

    const malformed = phases({
      runPhaseA: vi.fn(async () => ({
        phase: 'applied',
        accountState: 'applied',
        membershipState: 'applied',
        databaseWriteExecuted: true,
      } as const)),
    });
    const malformedResult = await orchestrateCurrentDemoAdminFormalization({
      mode: 'dry-run',
      manifest,
      password: null,
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: malformed,
    });
    expect(malformedResult.phaseA).toBe('unexpected');
  });
});
