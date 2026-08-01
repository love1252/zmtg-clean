import { describe, expect, it, vi } from 'vitest';

import {
  createMembershipCommandId,
  createMembershipCommandService,
  createMembershipTransitionId,
  executeMembershipCommandWithUnitOfWork,
} from '@/modules/access-control/application/membership-command-service';
import type {
  MembershipCurrent,
  MembershipOwnerCommand,
} from '@/modules/access-control/domain/membership-lifecycle';
import {
  MembershipCommandPersistenceError,
  type ActiveMembershipBinding,
  type MembershipCommandTransactionPort,
  type MembershipCommandUnitOfWork,
} from '@/modules/access-control/ports/membership-command-unit-of-work';

const COMMAND_ID = `mcmd1_${'A'.repeat(43)}`;
const TRANSITION_ID = `mtr1_${'E'.repeat(43)}`;
const NOW = new Date('2026-08-01T08:00:01.000Z');

function current(overrides: Partial<MembershipCurrent> = {}): MembershipCurrent {
  return {
    membershipId: 'member-001',
    tenantId: 'tenant-001',
    userId: 'user-001',
    role: 'tenant_admin',
    displayName: '受控管理员',
    revision: 4,
    lifecycleStatus: 'active',
    provenanceSource: 'access_control_command',
    provenanceActorId: 'actor-001',
    provenanceReasonCode: 'membership_refresh',
    provenanceCommandId: `mcmd1_${'I'.repeat(43)}`,
    provenanceOccurredAt: '2026-08-01T07:00:00.000Z',
    provenanceRecordedAt: '2026-08-01T07:00:01.000Z',
    revokedAt: null,
    deletedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-08-01T07:00:01.000Z',
    ...overrides,
  };
}

function binding(overrides: Partial<ActiveMembershipBinding> = {}): ActiveMembershipBinding {
  return {
    bindingId: 'binding-001',
    accountId: 'user-001',
    tenantId: 'tenant-001',
    institutionId: 'institution-001',
    source: 'manual_admin',
    assignedBy: 'actor-001',
    assignedAt: '2026-07-01T00:00:00.000Z',
    expiresAt: null,
    version: 8,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function command<K extends Exclude<MembershipOwnerCommand['kind'], 'create'>>(
  kind: K,
  overrides: Record<string, unknown> = {},
): Extract<MembershipOwnerCommand, { kind: K }> {
  return {
    kind,
    commandId: COMMAND_ID,
    tenantId: 'tenant-001',
    membershipId: 'member-001',
    expectedRevision: 4,
    actorId: 'actor-002',
    reasonCode: `membership_${kind}`,
    occurredAt: '2026-08-01T08:00:00.000Z',
    ...(kind === 'refresh' ? { role: 'consultant' as const } : {}),
    ...overrides,
  } as Extract<MembershipOwnerCommand, { kind: K }>;
}

function createCommand(
  bindingRequest: Extract<MembershipOwnerCommand, { kind: 'create' }>['binding'] = null,
): Extract<MembershipOwnerCommand, { kind: 'create' }> {
  return {
    kind: 'create',
    commandId: COMMAND_ID,
    tenantId: 'tenant-001',
    membershipId: 'member-002',
    userId: 'user-002',
    role: 'tenant_operator',
    displayName: '运营成员',
    source: 'formal_onboarding',
    actorId: 'actor-002',
    reasonCode: 'formal_onboarding',
    occurredAt: '2026-08-01T08:00:00.000Z',
    expectedRevision: null,
    binding: bindingRequest,
  };
}

function unitOfWork(input: {
  current?: MembershipCurrent | null;
  activeBinding?: ActiveMembershipBinding | null;
  commandExists?: boolean;
  affected?: Partial<Record<'insertMembership' | 'updateMembershipByCas' | 'insertActiveBinding' | 'revokeActiveBindingByCas' | 'appendTransition', number>>;
  operations?: string[];
} = {}) {
  const operations = input.operations ?? [];
  const count = (name: keyof NonNullable<typeof input.affected>) =>
    input.affected?.[name] ?? 1;
  const record = <T extends unknown[], R>(name: string, value: R) =>
    vi.fn(async (..._args: T): Promise<R> => {
      operations.push(name);
      return value;
    });
  const uow: MembershipCommandUnitOfWork = {
    lockCreateIdentity: record('lock_create_identity', undefined),
    lockMembershipByTenantUser: record(
      'lock_current_by_tenant_user',
      input.current ?? null,
    ),
    lockMembershipById: record(
      'lock_current_by_id',
      input.current === undefined ? current() : input.current,
    ),
    lockActiveBinding: record(
      'lock_active_binding',
      input.activeBinding ?? null,
    ),
    commandExists: record('command_exists', input.commandExists ?? false),
    insertMembership: record('insert_membership', count('insertMembership')),
    updateMembershipByCas: record('update_membership_cas', count('updateMembershipByCas')),
    insertActiveBinding: record('insert_active_binding', count('insertActiveBinding')),
    revokeActiveBindingByCas: record(
      'revoke_binding_cas',
      count('revokeActiveBindingByCas'),
    ),
    appendTransition: record('append_transition', count('appendTransition')),
  };
  return { uow, operations };
}

function createMutex() {
  let tail = Promise.resolve();
  return async (): Promise<() => void> => {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = tail;
    tail = next;
    await previous;
    return release;
  };
}

function syntheticTransactionState(input: {
  current: MembershipCurrent | null;
  bindingVersion?: number | null;
  appendAffected?: number;
}) {
  let committedCurrent = input.current;
  let committedBindingVersion = input.bindingVersion ?? null;
  const committedCommands = new Set<string>();
  const acquireCreateLock = createMutex();
  const acquireMembershipLock = createMutex();
  let runCount = 0;

  const transactionPort: MembershipCommandTransactionPort = {
    run: async (work) => {
      runCount += 1;
      const releases: Array<() => void> = [];
      let draftCurrent: MembershipCurrent | null = null;
      let draftCurrentLoaded = false;
      let draftBindingVersion = committedBindingVersion;
      const stagedCommands = new Set<string>();

      const loadCurrent = (): MembershipCurrent | null => {
        if (!draftCurrentLoaded) {
          draftCurrent = committedCurrent;
          draftCurrentLoaded = true;
        }
        return draftCurrent;
      };
      const uow: MembershipCommandUnitOfWork = {
        lockCreateIdentity: async () => {
          releases.push(await acquireCreateLock());
        },
        lockMembershipByTenantUser: async () => loadCurrent(),
        lockMembershipById: async () => {
          releases.push(await acquireMembershipLock());
          return loadCurrent();
        },
        lockActiveBinding: async () =>
          draftBindingVersion === null
            ? null
            : binding({ version: draftBindingVersion }),
        commandExists: async ({ commandId }) => committedCommands.has(commandId),
        insertMembership: async (next) => {
          draftCurrent = next;
          draftCurrentLoaded = true;
          return 1;
        },
        updateMembershipByCas: async ({ next }) => {
          draftCurrent = next;
          draftCurrentLoaded = true;
          return 1;
        },
        insertActiveBinding: async () => {
          draftBindingVersion = 1;
          return 1;
        },
        revokeActiveBindingByCas: async ({ binding: lockedBinding }) => {
          draftBindingVersion = lockedBinding.version + 1;
          return 1;
        },
        appendTransition: async (membershipTransition) => {
          const affected = input.appendAffected ?? 1;
          if (affected === 1) stagedCommands.add(membershipTransition.commandId);
          return affected;
        },
      };

      try {
        const result = await work(uow);
        if (draftCurrentLoaded) committedCurrent = draftCurrent;
        committedBindingVersion = draftBindingVersion;
        for (const commandId of stagedCommands) committedCommands.add(commandId);
        return result;
      } finally {
        for (const release of releases.reverse()) release();
      }
    },
  };

  return {
    transactionPort,
    get current() {
      return committedCurrent;
    },
    get bindingVersion() {
      return committedBindingVersion;
    },
    get transitionCount() {
      return committedCommands.size;
    },
    get runCount() {
      return runCount;
    },
  };
}

const dependencies = {
  createTransitionId: () => TRANSITION_ID,
  now: () => NOW,
};

describe('Access Control Membership Owner command service', () => {
  it('生成 canonical 随机 command/evidence identity', () => {
    const commandIds = new Set(Array.from({ length: 8 }, createMembershipCommandId));
    const transitionIds = new Set(Array.from({ length: 8 }, createMembershipTransitionId));
    expect(commandIds.size).toBe(8);
    expect(transitionIds.size).toBe(8);
    for (const value of commandIds) {
      expect(value).toMatch(/^mcmd1_[A-Za-z0-9_-]{43}$/u);
      expect(Buffer.from(value.slice(6), 'base64url')).toHaveLength(32);
      expect(value).toMatch(/[AEIMQUYcgkosw048]$/u);
    }
    for (const value of transitionIds) {
      expect(value).toMatch(/^mtr1_[A-Za-z0-9_-]{43}$/u);
      expect(Buffer.from(value.slice(5), 'base64url')).toHaveLength(32);
      expect(value).toMatch(/[AEIMQUYcgkosw048]$/u);
    }
  });

  it('create 按 advisory→current→replay→current insert→evidence 顺序执行', async () => {
    const context = unitOfWork();
    const result = await executeMembershipCommandWithUnitOfWork({
      unitOfWork: context.uow,
      command: createCommand(),
      ...dependencies,
    });

    expect(result).toEqual({
      status: 'applied',
      commandId: COMMAND_ID,
      transitionId: TRANSITION_ID,
      membershipId: 'member-002',
      revision: 1,
      lifecycleStatus: 'active',
      role: 'tenant_operator',
      binding: { kind: 'unchanged' },
    });
    expect(context.operations).toEqual([
      'lock_create_identity',
      'lock_current_by_tenant_user',
      'command_exists',
      'insert_membership',
      'append_transition',
    ]);
  });

  it('create 显式 Binding 在同一 UoW 建立并保持独立 version', async () => {
    const context = unitOfWork();
    const result = await executeMembershipCommandWithUnitOfWork({
      unitOfWork: context.uow,
      command: createCommand({
        bindingId: 'binding-002',
        institutionId: 'institution-002',
        source: 'system',
        expiresAt: null,
      }),
      ...dependencies,
    });

    expect(result).toMatchObject({
      status: 'applied',
      revision: 1,
      binding: { kind: 'created', version: 1 },
    });
    expect(context.operations).toEqual([
      'lock_create_identity',
      'lock_current_by_tenant_user',
      'command_exists',
      'lock_active_binding',
      'insert_membership',
      'insert_active_binding',
      'append_transition',
    ]);
  });

  it('revoke/delete 固定 current→Binding→replay→CAS→Binding CAS→evidence', async () => {
    for (const kind of ['revoke', 'delete'] as const) {
      const context = unitOfWork({ activeBinding: binding() });
      const result = await executeMembershipCommandWithUnitOfWork({
        unitOfWork: context.uow,
        command: command(kind),
        ...dependencies,
      });
      expect(result).toMatchObject({
        status: 'applied',
        revision: 5,
        binding: { kind: 'revoked', version: 9 },
      });
      expect(context.operations).toEqual([
        'lock_current_by_id',
        'command_exists',
        'lock_active_binding',
        'update_membership_cas',
        'revoke_binding_cas',
        'append_transition',
      ]);
    }
  });

  it('refresh 与 reactivate 不读取或恢复 Binding', async () => {
    const refreshContext = unitOfWork();
    await executeMembershipCommandWithUnitOfWork({
      unitOfWork: refreshContext.uow,
      command: command('refresh'),
      ...dependencies,
    });
    expect(refreshContext.uow.lockActiveBinding).not.toHaveBeenCalled();

    const reactivateContext = unitOfWork({
      current: current({
        revision: 5,
        lifecycleStatus: 'revoked',
        provenanceOccurredAt: '2026-08-01T07:30:00.000Z',
        provenanceRecordedAt: '2026-08-01T07:30:01.000Z',
        revokedAt: '2026-08-01T07:30:00.000Z',
      }),
      activeBinding: binding(),
    });
    const result = await executeMembershipCommandWithUnitOfWork({
      unitOfWork: reactivateContext.uow,
      command: command('reactivate', { expectedRevision: 5 }),
      ...dependencies,
    });
    expect(result).toMatchObject({
      status: 'applied',
      lifecycleStatus: 'active',
      binding: { kind: 'unchanged' },
    });
    expect(reactivateContext.uow.lockActiveBinding).not.toHaveBeenCalled();
  });

  it('纯观察 refresh 零写入、零 evidence，commandId 不虚报为已消费', async () => {
    const context = unitOfWork();
    const result = await executeMembershipCommandWithUnitOfWork({
      unitOfWork: context.uow,
      command: command('refresh', { role: 'tenant_admin' }),
      ...dependencies,
    });
    expect(result).toEqual({
      status: 'observed',
      commandId: COMMAND_ID,
      membershipId: 'member-001',
      revision: 4,
      lifecycleStatus: 'active',
      role: 'tenant_admin',
      commandPersisted: false,
    });
    expect(context.operations).toEqual(['lock_current_by_id', 'command_exists']);
  });

  it('已提交 command identity 在任何 payload 比较和写入前拒绝', async () => {
    const context = unitOfWork({ commandExists: true, activeBinding: binding() });
    const result = await executeMembershipCommandWithUnitOfWork({
      unitOfWork: context.uow,
      command: {
        ...command('revoke', { reasonCode: 'different_payload' }),
        displayName: '不同 payload 也不得比较',
      } as MembershipOwnerCommand,
      ...dependencies,
    });
    expect(result).toEqual({ status: 'blocked', code: 'command_replay_rejected' });
    expect(context.uow.updateMembershipByCas).not.toHaveBeenCalled();
    expect(context.uow.revokeActiveBindingByCas).not.toHaveBeenCalled();
    expect(context.uow.appendTransition).not.toHaveBeenCalled();
  });

  it('domain existence/legacy 错误优先于仅对 apply 有意义的 Binding 错误', async () => {
    const existing = unitOfWork({
      current: current(),
      activeBinding: binding({ version: 2_147_483_647 }),
    });
    expect(await executeMembershipCommandWithUnitOfWork({
      unitOfWork: existing.uow,
      command: createCommand({
        bindingId: 'binding-002',
        institutionId: 'institution-002',
        source: 'system',
        expiresAt: null,
      }),
      ...dependencies,
    })).toEqual({ status: 'blocked', code: 'membership_already_exists' });

    const legacy = current({
      revision: null,
      lifecycleStatus: null,
      provenanceSource: null,
      provenanceActorId: null,
      provenanceReasonCode: null,
      provenanceCommandId: null,
      provenanceOccurredAt: null,
      provenanceRecordedAt: null,
      revokedAt: null,
      deletedAt: null,
    });
    const legacyContext = unitOfWork({
      current: legacy,
      activeBinding: binding({ version: 2_147_483_647 }),
    });
    expect(await executeMembershipCommandWithUnitOfWork({
      unitOfWork: legacyContext.uow,
      command: command('revoke'),
      ...dependencies,
    })).toEqual({ status: 'blocked', code: 'legacy_membership_not_calibrated' });
  });

  it.each([
    ['current', { updateMembershipByCas: 0 }],
    ['binding', { revokeActiveBindingByCas: 2 }],
    ['evidence', { appendTransition: 0 }],
] as const)('%s affected rows 非 1 时令外层事务失败且不自动重试', async (_label, affected) => {
    let attempts = 0;
    const context = unitOfWork({ activeBinding: binding(), affected: { ...affected } });
    const transactionPort: MembershipCommandTransactionPort = {
      run: vi.fn(async (work) => {
        attempts += 1;
        return work(context.uow);
      }),
    };
    const service = createMembershipCommandService({ transactionPort, ...dependencies });
    const result = await service.execute(command('revoke'));

    expect(result).toEqual({
      status: 'blocked',
      code: 'membership_command_affected_rows_invalid',
    });
    expect(attempts).toBe(1);
    expect(transactionPort.run).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['create current', { insertMembership: 0 } as const, createCommand()],
    [
      'create binding',
      { insertActiveBinding: 2 } as const,
      createCommand({
        bindingId: 'binding-002',
        institutionId: 'institution-002',
        source: 'system',
        expiresAt: null,
      }),
    ],
  ])('%s affected rows 非 1 时固定失败', async (_label, affected, ownerCommand) => {
    const context = unitOfWork({ affected });
    const transactionPort: MembershipCommandTransactionPort = {
      run: vi.fn(async (work) => work(context.uow)),
    };
    const service = createMembershipCommandService({ transactionPort, ...dependencies });
    expect(await service.execute(ownerCommand)).toEqual({
      status: 'blocked',
      code: 'membership_command_affected_rows_invalid',
    });
  });

  it('create expected-absence 并发由自然键锁串行，最多一个提交', async () => {
    const state = syntheticTransactionState({ current: null });
    let transitionSequence = 0;
    const service = createMembershipCommandService({
      transactionPort: state.transactionPort,
      createTransitionId: () => {
        transitionSequence += 1;
        return `mtr1_${(transitionSequence === 1 ? 'A' : 'E').repeat(43)}`;
      },
      now: () => NOW,
    });
    const second = {
      ...createCommand(),
      commandId: `mcmd1_${'Q'.repeat(43)}`,
      membershipId: 'member-003',
    };

    const results = await Promise.all([
      service.execute(createCommand()),
      service.execute(second),
    ]);
    expect(results.filter((result) => result.status === 'applied')).toHaveLength(1);
    expect(results.filter(
      (result) => result.status === 'blocked' && result.code === 'membership_already_exists',
    )).toHaveLength(1);
    expect(state.current).toMatchObject({ membershipId: 'member-002', revision: 1 });
    expect(state.transitionCount).toBe(1);
    expect(state.runCount).toBe(2);
  });

  it('同一旧 revision 并发命令通过 current 锁与 CAS 最多一个提交', async () => {
    const state = syntheticTransactionState({ current: current() });
    let transitionSequence = 0;
    const service = createMembershipCommandService({
      transactionPort: state.transactionPort,
      createTransitionId: () => {
        transitionSequence += 1;
        return `mtr1_${(transitionSequence === 1 ? 'A' : 'E').repeat(43)}`;
      },
      now: () => NOW,
    });
    const results = await Promise.all([
      service.execute(command('refresh', { role: 'consultant' })),
      service.execute(command('refresh', {
        commandId: `mcmd1_${'Q'.repeat(43)}`,
        role: 'customer_service',
      })),
    ]);

    expect(results.filter((result) => result.status === 'applied')).toHaveLength(1);
    expect(results.filter(
      (result) => result.status === 'blocked' && result.code === 'membership_revision_stale',
    )).toHaveLength(1);
    expect(state.current?.revision).toBe(5);
    expect(state.transitionCount).toBe(1);
    expect(state.runCount).toBe(2);
  });

  it('evidence 失败后 staged current 与 Binding 均不提交', async () => {
    const state = syntheticTransactionState({
      current: current(),
      bindingVersion: 8,
      appendAffected: 0,
    });
    const service = createMembershipCommandService({
      transactionPort: state.transactionPort,
      ...dependencies,
    });
    expect(await service.execute(command('revoke'))).toEqual({
      status: 'blocked',
      code: 'membership_command_affected_rows_invalid',
    });
    expect(state.current).toEqual(current());
    expect(state.bindingVersion).toBe(8);
    expect(state.transitionCount).toBe(0);
    expect(state.runCount).toBe(1);
  });

  it('Binding version 上限在任何写入前阻断', async () => {
    const context = unitOfWork({
      activeBinding: binding({ version: 2_147_483_647 }),
    });
    const result = await executeMembershipCommandWithUnitOfWork({
      unitOfWork: context.uow,
      command: command('revoke'),
      ...dependencies,
    });
    expect(result).toEqual({ status: 'blocked', code: 'binding_version_exhausted' });
    expect(context.uow.updateMembershipByCas).not.toHaveBeenCalled();
  });

  it('已有 transaction-bound UoW 入口不打开嵌套事务', async () => {
    const context = unitOfWork();
    await executeMembershipCommandWithUnitOfWork({
      unitOfWork: context.uow,
      command: command('refresh'),
      ...dependencies,
    });
    expect('transaction' in context.uow).toBe(false);
  });

  it('数据库异常仅映射固定低敏码且事务调用精确一次', async () => {
    const transactionPort: MembershipCommandTransactionPort = {
      run: vi.fn(async () => {
        throw new MembershipCommandPersistenceError(
          'membership_command_concurrency_conflict',
        );
      }),
    };
    const service = createMembershipCommandService({ transactionPort, ...dependencies });
    expect(await service.execute(command('refresh'))).toEqual({
      status: 'blocked',
      code: 'membership_command_concurrency_conflict',
    });
    expect(transactionPort.run).toHaveBeenCalledTimes(1);
  });
});
