import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { MembershipCurrent } from '@/modules/access-control/domain/membership-lifecycle';
import type { AuthAccountRecord } from '@/modules/auth/domain/auth-account';
import {
  CURRENT_DEMO_ADMIN_FORMALIZATION_TASK,
  CURRENT_DEMO_ADMIN_FORMALIZATION_VERSION,
  CurrentDemoAdminPhaseExecutionError,
  type CurrentDemoAdminAuthorityManifest,
  type CurrentDemoAdminFormalizationPhasePorts,
} from '@/server/orchestration/current-demo-admin-formalization';
import {
  createCurrentDemoAdminFormalizationPhasePorts,
  executeCurrentDemoAdminFormalization,
  runPhaseADryRun,
  runPhaseAExecute,
  runCurrentDemoAdminFormalization,
} from './current-demo-admin-formalization-executor';

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
  membershipId: 'member-demo-admin',
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

const LEGACY_CALIBRATION_COMMAND_ID = `mcal1_${'a'.repeat(64)}`;
const RUNTIME_MEMBERSHIP_COMMAND_ID = `mcmd1_${'A'.repeat(43)}`;
const HISTORICAL_AT = new Date('2025-01-01T00:00:00.000Z');

const legacyAccount: AuthAccountRecord = Object.freeze({
  id: manifest.accountId,
  username: 'legacy_seed_demo_admin_anchor',
  displayName: '演示管理员',
  phone: null,
  email: null,
  passwordHash: 'legacy-hash',
  passwordUpdatedAt: HISTORICAL_AT,
  passwordResetRequired: true,
  status: 'disabled',
  lastLoginAt: null,
  failedLoginCount: 0,
  lockedUntil: null,
  createdBy: 'legacy-demo-seed-actor',
  updatedBy: 'legacy-demo-seed-actor',
  createdAt: HISTORICAL_AT,
  updatedAt: HISTORICAL_AT,
});

function formalAccount(now: Date): AuthAccountRecord {
  return Object.freeze({
    ...legacyAccount,
    username: manifest.username,
    displayName: manifest.accountDisplayName,
    passwordHash: 'formal-hash',
    passwordUpdatedAt: now,
    passwordResetRequired: false,
    status: 'active',
    updatedBy: manifest.accountId,
    updatedAt: now,
  });
}

const legacyMembership: MembershipCurrent = Object.freeze({
  membershipId: manifest.membershipId,
  tenantId: manifest.tenantId,
  userId: manifest.accountId,
  role: 'tenant_admin',
  displayName: '演示管理员',
  revision: 1,
  lifecycleStatus: 'active',
  provenanceSource: 'legacy_calibration',
  provenanceActorId: null,
  provenanceReasonCode: 'legacy_unknown',
  provenanceCommandId: LEGACY_CALIBRATION_COMMAND_ID,
  provenanceOccurredAt: null,
  provenanceRecordedAt: '2026-08-01T00:00:00.000Z',
  revokedAt: null,
  deletedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

function adoptedMembership(now: Date): MembershipCurrent {
  return Object.freeze({
    ...legacyMembership,
    displayName: manifest.accountDisplayName,
    revision: 2,
    provenanceSource: 'access_control_command',
    provenanceActorId: manifest.accountId,
    provenanceReasonCode: 'post_rebuild_formal_identity_adoption',
    provenanceCommandId: RUNTIME_MEMBERSHIP_COMMAND_ID,
    provenanceOccurredAt: now.toISOString(),
    provenanceRecordedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}

function formalOnboardingMembership(now: Date): MembershipCurrent {
  return Object.freeze({
    ...legacyMembership,
    displayName: manifest.accountDisplayName,
    provenanceSource: 'formal_onboarding',
    provenanceActorId: manifest.accountId,
    provenanceReasonCode: 'formal_onboarding',
    provenanceCommandId: RUNTIME_MEMBERSHIP_COMMAND_ID,
    provenanceOccurredAt: now.toISOString(),
    provenanceRecordedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}

type MutableFacts = {
  account: boolean;
  membership: boolean;
  scopeContext: boolean;
  binding: boolean;
};

function inMemoryOwnerPorts(facts: MutableFacts) {
  const calls = {
    authOwnerWrites: 0,
    membershipOwnerWrites: 0,
    provisioningOwnerWrites: 0,
    bindingOwnerWrites: 0,
  };
  const ports: CurrentDemoAdminFormalizationPhasePorts = {
    async runPhaseA(input) {
      if (input.mode === 'dry-run') {
        return {
          phase: facts.account && facts.membership ? 'reused' : 'candidate',
          accountState: facts.account ? 'reused' : 'missing',
          membershipState: facts.membership ? 'reused' : 'missing',
          databaseWriteExecuted: false,
        };
      }
      let wrote = false;
      if (!facts.account) {
        facts.account = true;
        calls.authOwnerWrites += 1;
        wrote = true;
      }
      if (!facts.membership) {
        facts.membership = true;
        calls.membershipOwnerWrites += 1;
        wrote = true;
      }
      return {
        phase: wrote ? 'applied' : 'reused',
        accountState: calls.authOwnerWrites > 0 && wrote ? 'applied' : 'reused',
        membershipState:
          calls.membershipOwnerWrites > 0 && wrote ? 'applied' : 'reused',
        databaseWriteExecuted: wrote,
      };
    },
    async runPhaseB(input) {
      if (input.mode === 'dry-run') {
        return {
          phase: facts.scopeContext ? 'reused' : 'candidate',
          scopeState: facts.scopeContext ? 'reused' : 'missing',
          contextState: facts.scopeContext ? 'reused' : 'missing',
          databaseWriteExecuted: false,
        };
      }
      if (facts.scopeContext) {
        return {
          phase: 'reused',
          scopeState: 'reused',
          contextState: 'reused',
          databaseWriteExecuted: false,
        };
      }
      facts.scopeContext = true;
      calls.provisioningOwnerWrites += 1;
      return {
        phase: 'applied',
        scopeState: 'applied',
        contextState: 'applied',
        databaseWriteExecuted: true,
      };
    },
    async runPhaseC(input) {
      if (input.mode === 'dry-run') {
        return {
          phase: facts.binding ? 'reused' : 'candidate',
          bindingState: facts.binding ? 'reused' : 'missing',
          databaseWriteExecuted: false,
        };
      }
      if (facts.binding) {
        return {
          phase: 'reused',
          bindingState: 'reused',
          databaseWriteExecuted: false,
        };
      }
      facts.binding = true;
      calls.bindingOwnerWrites += 1;
      return {
        phase: 'applied',
        bindingState: 'applied',
        databaseWriteExecuted: true,
      };
    },
  };
  return { calls, ports };
}

function createPhaseAExecuteHarness(
  state: 'candidate' | 'reused' | 'mixed',
  options: Readonly<{ membershipBlocked?: boolean }> = {},
) {
  const now = new Date('2026-08-16T01:00:00.000Z');
  const transactionDatabase = { execute: vi.fn(async () => []) };
  let rolledBack = false;
  const transaction = vi.fn(async (
    work: (value: typeof transactionDatabase) => Promise<unknown>,
    _options: unknown,
  ) => {
    try {
      return await work(transactionDatabase);
    } catch (error) {
      rolledBack = true;
      throw error;
    }
  });
  let authAdopted = state === 'reused';
  let membershipAdopted = state === 'reused';
  const adoptedAccount = formalAccount(now);
  const membershipBefore = state === 'mixed'
    ? formalOnboardingMembership(now)
    : legacyMembership;
  const findAccountByUsername = vi.fn(async () =>
    authAdopted ? adoptedAccount : null);
  const findAccountById = vi.fn(async () =>
    authAdopted ? adoptedAccount : legacyAccount);
  const adoptLegacyAccount = vi.fn(async (_input: unknown) => {
    authAdopted = true;
    return 'recorded' as const;
  });
  const authRepository = {
    findAccountByUsername,
    findAccountById,
    adoptLegacyAccount,
  };
  const unitOfWork = {
    lockMembershipByTenantUser: vi.fn(async () =>
      membershipAdopted ? adoptedMembership(now) : membershipBefore),
    lockMembershipById: vi.fn(async () =>
      membershipAdopted ? adoptedMembership(now) : membershipBefore),
  };
  const executeMembershipCommand = vi.fn(async (_input: unknown) => {
    if (options.membershipBlocked) {
      return { status: 'blocked' as const, code: 'membership_transition_not_allowed' as const };
    }
    membershipAdopted = true;
    return {
      status: 'applied' as const,
      commandId: RUNTIME_MEMBERSHIP_COMMAND_ID,
      transitionId: `mtr1_${'E'.repeat(43)}`,
      membershipId: manifest.membershipId,
      revision: 2,
      lifecycleStatus: 'active' as const,
      role: 'tenant_admin',
      binding: { kind: 'unchanged' as const },
    };
  });
  const hashPassword = vi.fn(async () => 'formal-hash');
  const verifyPassword = vi.fn(async () => true);
  const createAuthRepository = vi.fn(() => authRepository);
  const createMembershipUnitOfWork = vi.fn((
    _transaction: unknown,
    _isActive: unknown,
  ) => unitOfWork);
  const createMembershipAdapter = vi.fn(() => {
    throw new Error('clean-create adapter should not run in this harness');
  });

  return {
    database: { transaction } as never,
    dependencies: {
      createAuthRepository,
      createMembershipUnitOfWork,
      createMembershipAdapter,
      createMembershipCommandId: vi.fn(() => RUNTIME_MEMBERSHIP_COMMAND_ID),
      executeMembershipCommand,
      hashPassword,
      verifyPassword,
    } as never,
    now,
    transaction,
    transactionDatabase,
    createAuthRepository,
    createMembershipUnitOfWork,
    findAccountByUsername,
    findAccountById,
    adoptLegacyAccount,
    executeMembershipCommand,
    hashPassword,
    verifyPassword,
    wasRolledBack: () => rolledBack,
  };
}

describe('current demo admin formalization executor', () => {
  it('Phase A dry-run reads formal username and historical id, classifying exact legacy pair',
    async () => {
      const transactionDatabase = {};
      const transaction = vi.fn(async (
        work: (value: typeof transactionDatabase) => Promise<unknown>,
        _options: unknown,
      ) => work(transactionDatabase));
      const findAccountByUsername = vi.fn(async () => null);
      const findAccountById = vi.fn(async () => legacyAccount);
      const findCurrentInstitutionMembershipFacts = vi.fn(async () => [{
        accountId: manifest.accountId,
        membershipId: manifest.membershipId,
        membershipTenantId: manifest.tenantId,
        membershipUserId: manifest.accountId,
        membershipRole: 'tenant_admin',
        membershipDisplayName: '演示管理员',
        membershipRevision: 1,
        membershipLifecycleStatus: 'active',
        membershipProvenanceSource: 'legacy_calibration',
        membershipProvenanceActorId: null,
        membershipProvenanceReasonCode: 'legacy_unknown',
        membershipProvenanceCommandId: LEGACY_CALIBRATION_COMMAND_ID,
        membershipProvenanceOccurredAt: null,
        membershipProvenanceRecordedAt:
          new Date('2026-08-01T00:00:00.000Z'),
        membershipRevokedAt: null,
        membershipDeletedAt: null,
        bindingId: null,
        bindingAccountId: null,
        bindingTenantId: null,
        bindingInstitutionId: null,
        bindingStatus: null,
        bindingSource: null,
        bindingAssignedAt: null,
        bindingExpiresAt: null,
        bindingRevokedAt: null,
        bindingVersion: null,
      }]);

      const result = await runPhaseADryRun(
        { transaction } as never,
        { manifest },
        {
          createAuthRepository: vi.fn(() => ({
            findAccountByUsername,
            findAccountById,
          })) as never,
          createMembershipRepository: vi.fn(() => ({
            findCurrentInstitutionMembershipFacts,
          })) as never,
        },
      );

      expect(result).toEqual({
        phase: 'candidate',
        accountState: 'candidate',
        membershipState: 'candidate',
        databaseWriteExecuted: false,
      });
      expect(findAccountByUsername).toHaveBeenCalledWith('admin');
      expect(findAccountById).toHaveBeenCalledWith('demo-user-admin');
      expect(transaction.mock.calls[0]?.[1]).toMatchObject({
        accessMode: 'read only',
      });
    });

  it('Phase A dry-run fails closed when another account occupies admin', async () => {
    const competingAccount: AuthAccountRecord = {
      ...formalAccount(new Date('2026-08-16T01:00:00.000Z')),
      id: 'other-account',
    };
    const transaction = vi.fn(async (
      work: (value: object) => Promise<unknown>,
      _options: unknown,
    ) => work({}));

    const result = await runPhaseADryRun(
      { transaction } as never,
      { manifest },
      {
        createAuthRepository: vi.fn(() => ({
          findAccountByUsername: vi.fn(async () => competingAccount),
          findAccountById: vi.fn(async () => legacyAccount),
        })) as never,
        createMembershipRepository: vi.fn(() => ({
          findCurrentInstitutionMembershipFacts: vi.fn(async () => []),
        })) as never,
      },
    );

    expect(result).toMatchObject({
      phase: 'conflict',
      accountState: 'conflict',
      databaseWriteExecuted: false,
    });
  });

  it('Phase A candidate pair adopts both Owners once in one transaction and rechecks',
    async () => {
      const harness = createPhaseAExecuteHarness('candidate');

      const result = await runPhaseAExecute(harness.database, {
        manifest,
        password: 'not-logged',
        now: harness.now,
      }, harness.dependencies);

      expect(result).toEqual({
        phase: 'applied',
        accountState: 'applied',
        membershipState: 'applied',
        databaseWriteExecuted: true,
      });
      expect(harness.transaction).toHaveBeenCalledOnce();
      expect(harness.transaction.mock.calls[0]?.[1]).toMatchObject({
        isolationLevel: 'serializable',
        accessMode: 'read write',
      });
      expect(harness.createAuthRepository)
        .toHaveBeenCalledWith(harness.transactionDatabase);
      expect(harness.createMembershipUnitOfWork.mock.calls[0]?.[0])
        .toBe(harness.transactionDatabase);
      expect(harness.adoptLegacyAccount).toHaveBeenCalledOnce();
      const adoption = harness.adoptLegacyAccount.mock.calls[0]?.[0];
      expect(adoption).toMatchObject({
        expected: {
          createdBy: 'legacy-demo-seed-actor',
          createdAt: HISTORICAL_AT,
        },
        username: 'admin',
        displayName: '系统管理员',
        passwordResetRequired: false,
        status: 'active',
      });
      expect(harness.executeMembershipCommand).toHaveBeenCalledOnce();
      expect(harness.executeMembershipCommand.mock.calls[0]?.[0])
        .toMatchObject({
          command: {
            kind: 'adopt_legacy',
            membershipId: 'member-demo-admin',
            expectedRevision: 1,
            expectedDisplayName: '演示管理员',
            displayName: '系统管理员',
            reasonCode: 'post_rebuild_formal_identity_adoption',
          },
        });
      expect(harness.findAccountById).toHaveBeenCalledTimes(2);
      expect(harness.findAccountByUsername).toHaveBeenCalledTimes(2);
      expect(harness.verifyPassword).toHaveBeenCalledOnce();
      expect(harness.wasRolledBack()).toBe(false);
    });

  it('Phase A rolls back when Membership adoption blocks after Auth adoption',
    async () => {
      const harness = createPhaseAExecuteHarness('candidate', {
        membershipBlocked: true,
      });

      await expect(runPhaseAExecute(harness.database, {
        manifest,
        password: 'not-logged',
        now: harness.now,
      }, harness.dependencies)).rejects.toMatchObject({
        phase: 'phase_a',
        databaseWriteExecuted: true,
      });
      expect(harness.adoptLegacyAccount).toHaveBeenCalledOnce();
      expect(harness.executeMembershipCommand).toHaveBeenCalledOnce();
      expect(harness.wasRolledBack()).toBe(true);
    });

  it('Phase A reused pair verifies password with zero writes', async () => {
    const harness = createPhaseAExecuteHarness('reused');

    const result = await runPhaseAExecute(harness.database, {
      manifest,
      password: 'not-logged',
      now: harness.now,
    }, harness.dependencies);

    expect(result.phase).toBe('reused');
    expect(result.databaseWriteExecuted).toBe(false);
    expect(harness.verifyPassword).toHaveBeenCalledOnce();
    expect(harness.hashPassword).not.toHaveBeenCalled();
    expect(harness.adoptLegacyAccount).not.toHaveBeenCalled();
    expect(harness.executeMembershipCommand).not.toHaveBeenCalled();
  });

  it('Phase A mixed pair conflicts with zero writes and no retry', async () => {
    const harness = createPhaseAExecuteHarness('mixed');

    const result = await runPhaseAExecute(harness.database, {
      manifest,
      password: 'not-logged',
      now: harness.now,
    }, harness.dependencies);

    expect(result.phase).toBe('conflict');
    expect(result.databaseWriteExecuted).toBe(false);
    expect(harness.hashPassword).not.toHaveBeenCalled();
    expect(harness.adoptLegacyAccount).not.toHaveBeenCalled();
    expect(harness.executeMembershipCommand).not.toHaveBeenCalled();
    expect(harness.transaction).toHaveBeenCalledOnce();
  });

  it('keeps dry-run password-free and write-free', async () => {
    const facts = {
      account: false,
      membership: false,
      scopeContext: false,
      binding: false,
    };
    const owner = inMemoryOwnerPorts(facts);
    const result = await executeCurrentDemoAdminFormalization({
      mode: 'dry-run',
      manifest,
      password: null,
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: owner.ports,
    });
    expect(result.databaseWriteExecuted).toBe(false);
    expect(facts).toEqual({
      account: false,
      membership: false,
      scopeContext: false,
      binding: false,
    });
    expect(owner.calls).toEqual({
      authOwnerWrites: 0,
      membershipOwnerWrites: 0,
      provisioningOwnerWrites: 0,
      bindingOwnerWrites: 0,
    });
  });

  it('applies all missing facts exactly once through phase owners', async () => {
    const facts = {
      account: false,
      membership: false,
      scopeContext: false,
      binding: false,
    };
    const owner = inMemoryOwnerPorts(facts);
    const first = await executeCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'never-output-this-password',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: owner.ports,
    });
    const second = await executeCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'never-output-this-password',
      now: new Date('2026-08-16T01:05:00.000Z'),
      phases: owner.ports,
    });
    expect(first).toMatchObject({
      phaseA: 'applied',
      phaseB: 'applied',
      phaseC: 'applied',
      databaseWriteExecuted: true,
    });
    expect(second).toMatchObject({
      phaseA: 'reused',
      phaseB: 'reused',
      phaseC: 'reused',
      databaseWriteExecuted: false,
    });
    expect(owner.calls).toEqual({
      authOwnerWrites: 1,
      membershipOwnerWrites: 1,
      provisioningOwnerWrites: 1,
      bindingOwnerWrites: 1,
    });
  });

  it.each([
    [{ account: true, membership: true, scopeContext: false, binding: false },
      { authOwnerWrites: 0, membershipOwnerWrites: 0,
        provisioningOwnerWrites: 1, bindingOwnerWrites: 1 }],
    [{ account: true, membership: true, scopeContext: true, binding: false },
      { authOwnerWrites: 0, membershipOwnerWrites: 0,
        provisioningOwnerWrites: 0, bindingOwnerWrites: 1 }],
    [{ account: true, membership: true, scopeContext: true, binding: true },
      { authOwnerWrites: 0, membershipOwnerWrites: 0,
        provisioningOwnerWrites: 0, bindingOwnerWrites: 0 }],
  ])('resumes safely from partial completion %#', async (initial, expected) => {
    const facts = { ...initial };
    const owner = inMemoryOwnerPorts(facts);
    const result = await executeCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'never-output-this-password',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: owner.ports,
    });
    expect(result.conflictCount).toBe(0);
    expect(result.unexpectedCount).toBe(0);
    expect(owner.calls).toEqual(expected);
  });

  it('does not auto-retry a failed Binding phase', async () => {
    const binding = vi.fn(async () => ({
      phase: 'conflict' as const,
      bindingState: 'conflict' as const,
      databaseWriteExecuted: false,
    }));
    const result = await executeCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'never-output-this-password',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: {
        runPhaseA: async () => ({
          phase: 'reused',
          accountState: 'reused',
          membershipState: 'reused',
          databaseWriteExecuted: false,
        }),
        runPhaseB: async () => ({
          phase: 'reused',
          scopeState: 'reused',
          contextState: 'reused',
          databaseWriteExecuted: false,
        }),
        runPhaseC: binding,
      },
    });
    expect(result.phaseC).toBe('conflict');
    expect(binding).toHaveBeenCalledTimes(1);
  });

  it('reports an execute failure before owner writes without a write flag', async () => {
    const result = await executeCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'never-output-this-password',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: {
        ...inMemoryOwnerPorts({
          account: true,
          membership: true,
          scopeContext: true,
          binding: true,
        }).ports,
        runPhaseA: async () => {
          throw new CurrentDemoAdminPhaseExecutionError('phase_a', false);
        },
      },
    });
    expect(result).toMatchObject({
      phaseA: 'unexpected',
      databaseWriteExecuted: false,
    });
  });

  it('reports an owner write failure as may-have-committed', async () => {
    const owner = inMemoryOwnerPorts({
      account: true,
      membership: true,
      scopeContext: true,
      binding: true,
    });
    const result = await executeCurrentDemoAdminFormalization({
      mode: 'execute',
      manifest,
      password: 'never-output-this-password',
      now: new Date('2026-08-16T01:00:00.000Z'),
      phases: {
        ...owner.ports,
        runPhaseB: async () => {
          throw new CurrentDemoAdminPhaseExecutionError('phase_b', true);
        },
      },
    });
    expect(result).toMatchObject({
      phaseB: 'unexpected',
      databaseWriteExecuted: true,
    });
  });

  it('reports a post-write Binding verification failure as may-have-committed',
    async () => {
      const owner = inMemoryOwnerPorts({
        account: true,
        membership: true,
        scopeContext: true,
        binding: false,
      });
      const result = await executeCurrentDemoAdminFormalization({
        mode: 'execute',
        manifest,
        password: 'never-output-this-password',
        now: new Date('2026-08-16T01:00:00.000Z'),
        phases: {
          ...owner.ports,
          runPhaseC: async () => {
            throw new CurrentDemoAdminPhaseExecutionError('phase_c', true);
          },
        },
      });
      expect(result).toMatchObject({
        phaseC: 'unexpected',
        databaseWriteExecuted: true,
      });
    });

  it('keeps every production dry-run phase on readonly owner paths', async () => {
    const sourcePath = path.join(
      process.cwd(),
      'scripts/db/current-demo-admin-formalization-executor.ts',
    );
    const source = await readFile(sourcePath, 'utf8');
    const phaseADryRun = source.slice(
      source.indexOf('async function runPhaseADryRun'),
      source.indexOf('async function runPhaseAExecute'),
    );
    const phaseBDryRun = source.slice(
      source.indexOf('function createPhaseBPort'),
      source.indexOf('let writeAttempted = false;',
        source.indexOf('function createPhaseBPort')),
    );
    const phaseCDryRun = source.slice(
      source.indexOf('async function runPhaseCDryRun'),
      source.indexOf('async function runPhaseCExecute'),
    );

    expect(phaseADryRun).toContain('READONLY_TRANSACTION_OPTIONS');
    expect(phaseADryRun).toContain(
      'dependencies.createMembershipRepository',
    );
    expect(phaseBDryRun).toContain('createProvisioningReadonlyPostgresAdapter');
    expect(phaseCDryRun).toContain('READONLY_TRANSACTION_OPTIONS');
    expect(phaseCDryRun).toContain(
      'createAuthoritativeInstitutionMembershipFactRepositoryV1',
    );
    for (const dryRunSource of [phaseADryRun, phaseBDryRun, phaseCDryRun]) {
      expect(dryRunSource).not.toMatch(/lockMembership|lockActive|lockBinding/u);
      expect(dryRunSource).not.toContain('createAccount');
      expect(dryRunSource).not.toContain(
        'createMembershipCommandTransactionPort',
      );
      expect(dryRunSource).not.toContain(
        'createMembershipCommandExternalTransactionAdapter',
      );
      expect(dryRunSource).not.toContain('executeBindingCommandWithUnitOfWork');
      expect(dryRunSource).not.toContain('createProvisioningWritePostgresAdapter');
      expect(dryRunSource).not.toContain('writeAdapter.write');
    }
  });

  it('passes explicit read-only transaction options to Phase A and C dry-run',
    async () => {
      const transaction = vi.fn(async (
        _work: unknown,
        _options: Readonly<{ accessMode: string }>,
      ) => ({
        phase: 'candidate' as const,
        accountState: 'missing' as const,
        membershipState: 'missing' as const,
        bindingState: 'missing' as const,
        databaseWriteExecuted: false,
      }));
      const ports = createCurrentDemoAdminFormalizationPhasePorts({
        database: { transaction } as never,
        postgresClient: {} as never,
      });
      const phaseA = await ports.runPhaseA({
        mode: 'dry-run',
        manifest,
        password: null,
        now: new Date('2026-08-16T01:00:00.000Z'),
      });
      const phaseC = await ports.runPhaseC({
        mode: 'dry-run',
        manifest,
        phaseA,
        now: new Date('2026-08-16T01:00:00.000Z'),
      });
      expect(phaseC.databaseWriteExecuted).toBe(false);
      expect(transaction).toHaveBeenCalledTimes(2);
      for (const call of transaction.mock.calls) {
        expect(call[1]).toMatchObject({ accessMode: 'read only' });
      }
    });

  it('does not let client cleanup failure mask a completed write result',
    async () => {
      const expected = Object.freeze({
        mode: 'execute' as const,
        accountState: 'applied' as const,
        membershipState: 'applied' as const,
        scopeState: 'applied' as const,
        contextState: 'applied' as const,
        bindingState: 'applied' as const,
        phaseA: 'applied' as const,
        phaseB: 'applied' as const,
        phaseC: 'applied' as const,
        conflictCount: 0,
        unexpectedCount: 0,
        databaseWriteExecuted: true,
      });
      const end = vi.fn(async () => {
        throw new Error('cleanup failed');
      });
      const result = await runCurrentDemoAdminFormalization({
        mode: 'execute',
        manifest,
        password: 'never-output-this-password',
        databaseUrl: 'not-opened-by-test-runtime',
        now: new Date('2026-08-16T01:00:00.000Z'),
      }, {
        createPostgresClient: vi.fn(() => ({ end })),
        createDatabase: vi.fn(() => ({})),
        createPhasePorts: vi.fn(() => ({})),
        execute: vi.fn(async () => expected),
      } as never);
      expect(result).toBe(expected);
      expect(end).toHaveBeenCalledOnce();
    });

  it('does not let client cleanup failure mask the orchestration error',
    async () => {
      const orchestrationError = new Error('orchestration failed');
      const end = vi.fn(async () => {
        throw new Error('cleanup failed');
      });
      const operation = runCurrentDemoAdminFormalization({
        mode: 'execute',
        manifest,
        password: 'never-output-this-password',
        databaseUrl: 'not-opened-by-test-runtime',
        now: new Date('2026-08-16T01:00:00.000Z'),
      }, {
        createPostgresClient: vi.fn(() => ({ end })),
        createDatabase: vi.fn(() => ({})),
        createPhasePorts: vi.fn(() => ({})),
        execute: vi.fn(async () => {
          throw orchestrationError;
        }),
      } as never);
      await expect(operation).rejects.toBe(orchestrationError);
      expect(end).toHaveBeenCalledOnce();
    });

  it('wires every persistence path through the frozen Owner implementation', async () => {
    const sourcePath = path.join(
      process.cwd(),
      'scripts/db/current-demo-admin-formalization-executor.ts',
    );
    const source = await readFile(sourcePath, 'utf8');
    expect(source).toContain('createAuthAccountRepository');
    expect(source).toContain('hashPasswordScrypt');
    expect(source).toContain('verifyPasswordScrypt');
    expect(source).toContain('createMembershipCommandExternalTransactionAdapter');
    expect(source).toContain('createProvisioningReadonlyPostgresAdapter');
    expect(source).toContain('createProvisioningWritePostgresAdapter');
    expect(source).toContain('toProvisioningExpectedTriplet');
    expect(source).toContain('createTransactionBoundInstitutionScopeAssertion');
    expect(source).toContain('executeBindingCommandWithUnitOfWork');
    expect(source).not.toContain('executeProvisioning(');
    expect(source).not.toMatch(/INSERT\s+INTO\s+auth_users/iu);
    expect(source).not.toMatch(/INSERT\s+INTO\s+tenant_members/iu);
    expect(source).not.toMatch(
      /INSERT\s+INTO\s+auth_account_institution_bindings/iu,
    );
    expect(source).not.toMatch(/INSERT\s+INTO\s+institution_/iu);
  });
});
