import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

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

describe('current demo admin formalization executor', () => {
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
      'createAuthoritativeInstitutionMembershipFactRepositoryV1',
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
