import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { BindingTransitionEvidence } from '@/modules/access-control/domain/binding-lifecycle';
import type {
  CompleteMembershipCurrent,
  MembershipCurrent,
  MembershipTransition,
} from '@/modules/access-control/domain/membership-lifecycle';
import {
  MembershipCommandPersistenceError,
  type MembershipCommandUnitOfWork,
} from '@/modules/access-control/ports/membership-command-unit-of-work';
import {
  MEMBERSHIP_COMMAND_TRANSACTION_OPTIONS,
  createMembershipCommandTransactionPort,
  createTransactionBoundMembershipCommandUnitOfWork,
  type MembershipCommandTransactionDatabase,
} from '@/modules/access-control/server/membership-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  authAccountInstitutionBindings,
  authAccountInstitutionBindingTransitions,
  tenantMembers,
  tenantMembershipTransitions,
} from '@/server/db/schema';

const NOW = '2026-08-01T08:00:01.000Z';

function current(
  overrides: Partial<CompleteMembershipCurrent> = {},
): CompleteMembershipCurrent {
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
    provenanceCommandId: `mcmd1_${'A'.repeat(43)}`,
    provenanceOccurredAt: '2026-08-01T08:00:00.000Z',
    provenanceRecordedAt: NOW,
    revokedAt: null,
    deletedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: NOW,
    ...overrides,
  };
}

function transition(): MembershipTransition {
  return {
    transitionId: `mtr1_${'E'.repeat(43)}`,
    tenantId: 'tenant-001',
    membershipId: 'member-001',
    commandId: `mcmd1_${'I'.repeat(43)}`,
    transitionType: 'refresh',
    source: 'access_control_command',
    actorId: 'actor-001',
    reasonCode: 'membership_refresh',
    fromRevision: 4,
    toRevision: 5,
    fromLifecycleStatus: 'active',
    toLifecycleStatus: 'active',
    fromRole: 'tenant_admin',
    toRole: 'consultant',
    occurredAt: '2026-08-01T08:00:00.000Z',
    recordedAt: NOW,
  };
}

function bindingTransition(): BindingTransitionEvidence {
  return {
    transitionId: `btr1_${'M'.repeat(43)}`,
    tenantId: 'tenant-001',
    bindingId: 'binding-001',
    replacementBindingId: null,
    commandId: `bcmd1_${'A'.repeat(43)}`,
    transitionType: 'revoke',
    provenanceSource: 'access_control_command',
    assignmentSource: 'manual_admin',
    actorId: 'actor-001',
    reasonCode: 'binding_revoke',
    fromStatus: 'active',
    toStatus: 'revoked',
    fromVersion: 8,
    toVersion: 9,
    membershipRevision: 4,
    scopeRevision: null,
    occurredAt: '2026-08-01T08:00:00.000Z',
    recordedAt: NOW,
  };
}

describe('Access Control Membership transaction repository', () => {
  it('Owner Writer 只接受完整 current，nullable 读取候选不能直接写入', () => {
    type InsertCurrent = Parameters<MembershipCommandUnitOfWork['insertMembership']>[0];
    type UpdateInput = Parameters<MembershipCommandUnitOfWork['updateMembershipByCas']>[0];

    expectTypeOf<InsertCurrent>().toEqualTypeOf<CompleteMembershipCurrent>();
    expectTypeOf<UpdateInput['previous']>().toEqualTypeOf<CompleteMembershipCurrent>();
    expectTypeOf<UpdateInput['next']>().toEqualTypeOf<CompleteMembershipCurrent>();
    expectTypeOf<MembershipCurrent>().not.toMatchTypeOf<CompleteMembershipCurrent>();
  });

  it('普通 TenantDatabase 不能冒充 transaction-bound 品牌类型', () => {
    expectTypeOf<TenantDatabase>().not.toMatchTypeOf<MembershipCommandTransactionDatabase>();
  });

  it('只开启一次 SERIALIZABLE READ WRITE 外层事务并固定三个 SET LOCAL', async () => {
    const execute = vi.fn(async (_statement: SQL) => []);
    const transaction = vi.fn(async (
      callback: (database: TenantDatabase) => Promise<unknown>,
      options: unknown,
    ) => {
      expect(options).toEqual(MEMBERSHIP_COMMAND_TRANSACTION_OPTIONS);
      return callback({ execute } as unknown as TenantDatabase);
    });
    const port = createMembershipCommandTransactionPort({
      transaction,
    } as unknown as TenantDatabase);

    await expect(port.run(async () => 'ok')).resolves.toBe('ok');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(3);
    const statements = execute.mock.calls.map(([statement]) =>
      new PgDialect().sqlToQuery(statement as SQL).sql,
    );
    expect(statements).toEqual([
      expect.stringContaining("SET LOCAL statement_timeout = '5000ms'"),
      expect.stringContaining("SET LOCAL lock_timeout = '1000ms'"),
      expect.stringContaining("SET LOCAL idle_in_transaction_session_timeout = '5000ms'"),
    ]);
  });

  it('transaction-bound UoW 在回调结束后失效且 callback 错误原样穿透', async () => {
    const execute = vi.fn(async (_statement: SQL) => []);
    const transaction = vi.fn(async (
      callback: (database: TenantDatabase) => Promise<unknown>,
    ) => callback({ execute } as unknown as TenantDatabase));
    const port = createMembershipCommandTransactionPort({
      transaction,
    } as unknown as TenantDatabase);
    let captured: MembershipCommandUnitOfWork | null = null;
    await port.run(async (unitOfWork) => {
      captured = unitOfWork;
      return undefined;
    });
    expect(captured).not.toBeNull();
    await expect(captured!.lockCreateIdentity({
      tenantId: 'tenant-001',
      userId: 'user-001',
    })).rejects.toMatchObject({
      code: 'membership_command_repository_unavailable',
      message: 'membership_command_repository_unavailable',
    });

    const callbackFailure = new MembershipCommandPersistenceError(
      'membership_command_affected_rows_invalid',
    );
    await expect(port.run(async () => {
      throw callbackFailure;
    })).rejects.toBe(callbackFailure);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('create advisory lock 使用绑定参数，不拼接 SQL raw', async () => {
    const execute = vi.fn(async (_statement: SQL) => []);
    const unitOfWork = createTransactionBoundMembershipCommandUnitOfWork({
      execute,
    } as unknown as MembershipCommandTransactionDatabase, () => true);
    await unitOfWork.lockCreateIdentity({
      tenantId: 'tenant-001',
      userId: 'user-001',
    });

    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]![0] as SQL);
    expect(query.sql).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(query.sql).toContain('pg_catalog.hashtext($1)');
    expect(query.sql).toContain('pg_catalog.hashtext($2)');
    expect(query.params).toEqual([
      'membership-create:tenant-001',
      'user-001',
    ]);
  });

  it('Membership adoption CAS 同步写入 displayName/revision/provenance 且不改 identity', async () => {
    let condition: SQL | undefined;
    const returning = vi.fn(async () => [{ id: 'member-001' }]);
    const where = vi.fn((value: SQL) => {
      condition = value;
      return { returning };
    });
    const set = vi.fn((_values: unknown) => ({ where }));
    const update = vi.fn(() => ({ set }));
    const unitOfWork = createTransactionBoundMembershipCommandUnitOfWork({
      update,
    } as unknown as MembershipCommandTransactionDatabase, () => true);
    const previous = current({
      displayName: '演示管理员',
      revision: 1,
      provenanceSource: 'legacy_calibration',
      provenanceActorId: null,
      provenanceReasonCode: 'legacy_unknown',
      provenanceCommandId: `mcal1_${'a'.repeat(64)}`,
      provenanceOccurredAt: null,
    });
    const next = current({
      displayName: '系统管理员',
      revision: 2,
      provenanceReasonCode: 'post_rebuild_formal_identity_adoption',
      provenanceCommandId: `mcmd1_${'M'.repeat(43)}`,
    });

    await expect(unitOfWork.updateMembershipByCas({
      previous,
      next,
      expectedRevision: 1,
      expectedLifecycleStatus: 'active',
    })).resolves.toBe(1);
    expect(update).toHaveBeenCalledWith(tenantMembers);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      role: 'tenant_admin',
      displayName: '系统管理员',
      revision: 2,
      lifecycleStatus: 'active',
      currentProvenanceCommandId: next.provenanceCommandId,
    }));
    const mutation = set.mock.calls[0]?.[0];
    expect(mutation).not.toHaveProperty('id');
    expect(mutation).not.toHaveProperty('tenantId');
    expect(mutation).not.toHaveProperty('userId');
    const compiled = new PgDialect().sqlToQuery(condition!);
    expect(compiled.sql).toContain('"tenant_id" =');
    expect(compiled.sql).toContain('"id" =');
    expect(compiled.sql).toContain('"user_id" =');
    expect(compiled.sql).toContain('"revision" =');
    expect(compiled.sql).toContain('"lifecycle_status" =');
    expect(returning).toHaveBeenCalledTimes(1);
  });

  it('Binding 撤销使用独立 version CAS 且无 Membership revision 复用', async () => {
    let condition: SQL | undefined;
    const returning = vi.fn(async () => [{ id: 'binding-001' }]);
    const where = vi.fn((value: SQL) => {
      condition = value;
      return { returning };
    });
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const unitOfWork = createTransactionBoundMembershipCommandUnitOfWork({
      update,
    } as unknown as MembershipCommandTransactionDatabase, () => true);

    await expect(unitOfWork.revokeActiveBindingByCas({
      binding: {
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
      },
      revokedAt: '2026-08-01T08:00:00.000Z',
      recordedAt: NOW,
    })).resolves.toBe(1);
    expect(update).toHaveBeenCalledWith(authAccountInstitutionBindings);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      status: 'revoked',
      version: 9,
    }));
    const compiled = new PgDialect().sqlToQuery(condition!);
    expect(compiled.sql).toContain('"status" =');
    expect(compiled.sql).toContain('"version" =');
    expect(compiled.sql).toContain('"revoked_at" is null');
  });

  it('create 显式写入完整 current envelope，transition 只执行 INSERT', async () => {
    const membershipReturning = vi.fn(async () => [{ id: 'member-001' }]);
    const transitionReturning = vi.fn(async () => [{ id: 'transition-001' }]);
    const membershipValues = vi.fn(() => ({ returning: membershipReturning }));
    const transitionValues = vi.fn(() => ({ returning: transitionReturning }));
    const insert = vi.fn((table: unknown) => ({
      values: table === tenantMembers ? membershipValues : transitionValues,
    }));
    const unitOfWork = createTransactionBoundMembershipCommandUnitOfWork({
      insert,
    } as unknown as MembershipCommandTransactionDatabase, () => true);

    await expect(unitOfWork.insertMembership(current())).resolves.toBe(1);
    await expect(unitOfWork.appendTransition(transition())).resolves.toBe(1);
    expect(membershipValues).toHaveBeenCalledWith(expect.objectContaining({
      revision: 4,
      lifecycleStatus: 'active',
      currentProvenanceSource: 'access_control_command',
      currentProvenanceActorId: 'actor-001',
      currentProvenanceReasonCode: 'membership_refresh',
      currentProvenanceCommandId: expect.stringMatching(/^mcmd1_/u),
      currentProvenanceOccurredAt: expect.any(Date),
      currentProvenanceRecordedAt: expect.any(Date),
      revokedAt: null,
      deletedAt: null,
    }));
    expect(transitionValues).toHaveBeenCalledWith(expect.objectContaining({
      transitionType: 'refresh',
      fromRevision: 4,
      toRevision: 5,
    }));
  });

  it('command UNIQUE 与未知数据库错误只暴露固定低敏码', async () => {
    const replayReturning = vi.fn(async () => {
      throw {
        code: '23505',
        constraint_name: 'tenant_membership_transitions_tenant_command_unique',
        detail: '不得外泄',
      };
    });
    const replayValues = vi.fn(() => ({ returning: replayReturning }));
    const replayUow = createTransactionBoundMembershipCommandUnitOfWork({
      insert: vi.fn(() => ({ values: replayValues })),
    } as unknown as MembershipCommandTransactionDatabase, () => true);
    await expect(replayUow.appendTransition(transition())).rejects.toEqual(
      new MembershipCommandPersistenceError('command_replay_rejected'),
    );

    const unknownUow = createTransactionBoundMembershipCommandUnitOfWork({
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => {
            throw new Error('raw private database failure');
          }),
        })),
      })),
    } as unknown as MembershipCommandTransactionDatabase, () => true);
    await expect(unknownUow.appendTransition(transition())).rejects.toMatchObject({
      code: 'membership_command_repository_unavailable',
      message: 'membership_command_repository_unavailable',
    });
  });


  it('Binding transition evidence 只执行 append-only INSERT 并完整映射版本域', async () => {
    const returning = vi.fn(async () => [{ id: 'binding-transition-001' }]);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn((table: unknown) => {
      expect(table).toBe(authAccountInstitutionBindingTransitions);
      return { values };
    });
    const unitOfWork = createTransactionBoundMembershipCommandUnitOfWork({
      insert,
    } as unknown as MembershipCommandTransactionDatabase, () => true);

    await expect(
      unitOfWork.appendBindingTransition(bindingTransition()),
    ).resolves.toBe(1);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      transitionType: 'revoke',
      fromVersion: 8,
      toVersion: 9,
      membershipRevision: 4,
      scopeRevision: null,
      occurredAt: expect.any(Date),
      recordedAt: expect.any(Date),
    }));
    expect(returning).toHaveBeenCalledTimes(1);
  });

  it('实现静态锁定无 retry/upsert/DDL/transition mutation 与仅一个 transaction opener', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/modules/access-control/server/membership-command-repository.ts',
      ),
      'utf8',
    );
    expect(source.match(/\.transaction\(/gu)).toHaveLength(1);
    expect(source.match(/\.for\('update'\)/gu)).toHaveLength(4);
    expect(source).toContain('.insert(tenantMembershipTransitions)');
    expect(source).toContain('.insert(authAccountInstitutionBindingTransitions)');
    expect(source).not.toContain('.update(tenantMembershipTransitions)');
    expect(source).not.toContain('.delete(tenantMembershipTransitions)');
    expect(source).not.toMatch(/onConflict|ON\s+CONFLICT|upsert|IF\s+NOT\s+EXISTS/iu);
    expect(source).not.toMatch(/CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE|DROP\s+/iu);
    expect(source).not.toContain('sql.raw');
    expect(source).not.toMatch(/retry|setTimeout/iu);
    expect(source).not.toContain('DATABASE_URL');
    expect(source).toContain('.returning({ id: tenantMembershipTransitions.id })');
    expect(source).toContain(
      '.returning({ id: authAccountInstitutionBindingTransitions.id })',
    );
  });

  it('完整 current 写入契约不使用 cast、非空断言或 nullable recordedAt 分支', () => {
    const domainSource = readFileSync(
      join(process.cwd(), 'src/modules/access-control/domain/membership-lifecycle.ts'),
      'utf8',
    );
    const serviceSource = readFileSync(
      join(
        process.cwd(),
        'src/modules/access-control/application/membership-command-service.ts',
      ),
      'utf8',
    );
    const repositorySource = readFileSync(
      join(
        process.cwd(),
        'src/modules/access-control/server/membership-command-repository.ts',
      ),
      'utf8',
    );

    expect(domainSource).not.toMatch(/\bas number\b|as MembershipLifecycleStatus/u);
    expect(serviceSource).not.toContain('current!');
    expect(serviceSource).not.toContain('as number');
    expect(serviceSource).not.toMatch(/lifecycleStatus\s+as/u);
    expect(repositorySource).not.toContain('provenanceRecordedAt === null');
  });

  it('active Binding 查询按 id 稳定排序且多行 fail-closed', async () => {
    const rows = [
      { id: 'binding-001' },
      { id: 'binding-002' },
    ];
    const forUpdate = vi.fn(async () => rows);
    const limit = vi.fn(() => ({ for: forUpdate }));
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const unitOfWork = createTransactionBoundMembershipCommandUnitOfWork({
      select,
    } as unknown as MembershipCommandTransactionDatabase, () => true);

    await expect(unitOfWork.lockActiveBinding({
      tenantId: 'tenant-001',
      accountId: 'user-001',
    })).rejects.toMatchObject({
      code: 'membership_command_repository_unavailable',
    });
    expect(orderBy).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(2);
    expect(forUpdate).toHaveBeenCalledWith('update');
  });

  it('transition 表和 Binding 表保持明确归属', () => {
    expect(tenantMembershipTransitions.id.name).toBe('id');
    expect(authAccountInstitutionBindings.version.name).toBe('version');
    expect(authAccountInstitutionBindingTransitions.toVersion.name).toBe('to_version');
  });
});
