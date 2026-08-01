import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  MembershipCommandPersistenceError,
} from '@/modules/access-control/ports/membership-command-unit-of-work';
import {
  MembershipExternalTransactionError,
  createMembershipCommandExternalTransactionAdapter,
  type FormalOnboardingMembershipCommands,
} from '@/modules/access-control/server/membership-command-external-transaction';
import type { MembershipCommandTransactionDatabase } from '@/modules/access-control/server/membership-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  tenantMembers,
  tenantMembershipTransitions,
} from '@/server/db/schema';

const COMMAND_ID = `mcmd1_${'A'.repeat(43)}`;
const TRANSITION_ID = `mtr1_${'E'.repeat(43)}`;
const NOW = new Date('2026-08-02T08:00:01.000Z');

const INTENT = Object.freeze({
  membershipId: 'membership-001',
  tenantId: 'tenant-001',
  userId: 'user-001',
  role: 'tenant_admin' as const,
  displayName: '受控管理员',
  actorId: 'actor-001',
  occurredAt: '2026-08-02T08:00:00.000Z',
});

function createTransactionDatabase(input: Readonly<{
  failExecuteAt?: number;
  membershipInsertAffected?: number;
}> = {}) {
  const operations: string[] = [];
  let executeCount = 0;
  const transaction = vi.fn(async () => {
    throw new Error('不得开启嵌套事务');
  });
  const execute = vi.fn(async (statement: SQL) => {
    executeCount += 1;
    if (executeCount === input.failExecuteAt) {
      throw new Error('raw database error must not escape');
    }
    const compiled = new PgDialect().sqlToQuery(statement);
    operations.push(compiled.sql.replace(/\s+/gu, ' ').trim());
    return [];
  });
  const select = vi.fn((projection?: unknown) => ({
    from: (table: unknown) => ({
      where: () => ({
        limit: () => {
          if (projection === undefined && table === tenantMembers) {
            return {
              for: async () => {
                operations.push('select:membership:for-update');
                return [];
              },
            };
          }
          operations.push('select:transition-command');
          return Promise.resolve([]);
        },
      }),
    }),
  }));
  const insert = vi.fn((table: unknown) => ({
    values: () => ({
      returning: async () => {
        if (table === tenantMembers) {
          operations.push('insert:membership');
          return input.membershipInsertAffected === 0
            ? []
            : [{ id: INTENT.membershipId }];
        }
        if (table === tenantMembershipTransitions) {
          operations.push('insert:transition');
          return [{ id: TRANSITION_ID }];
        }
        throw new Error('unexpected table');
      },
    }),
  }));

  return {
    database: {
      execute,
      insert,
      select,
      transaction,
    } as unknown as TenantDatabase,
    execute,
    operations,
    transaction,
  };
}

function createAdapter() {
  return createMembershipCommandExternalTransactionAdapter({
    createCommandId: () => COMMAND_ID,
    createTransitionId: () => TRANSITION_ID,
    now: () => NOW,
  });
}

describe('Access Control Membership 外部事务适配器', () => {
  it('普通数据库与命令回调均不暴露 transaction-bound 品牌类型', () => {
    expectTypeOf<TenantDatabase>().not.toMatchTypeOf<MembershipCommandTransactionDatabase>();
    expectTypeOf<Parameters<FormalOnboardingMembershipCommands['createMembership']>[0]>()
      .not.toMatchTypeOf<MembershipCommandTransactionDatabase>();
  });

  it('在首个 DML 前设置三个 timeout，并在既有事务内精确创建一次 Membership', async () => {
    const state = createTransactionDatabase();
    const adapter = createAdapter();

    await expect(adapter.run(state.database, async (commands) => {
      state.operations.push('work:start');
      await commands.createMembership(INTENT);
      return 'ok';
    })).resolves.toBe('ok');

    expect(adapter.transactionOptions).toEqual({
      isolationLevel: 'serializable',
      accessMode: 'read write',
    });
    expect(state.transaction).not.toHaveBeenCalled();
    expect(state.operations.slice(0, 4)).toEqual([
      expect.stringContaining("SET LOCAL statement_timeout = '5000ms'"),
      expect.stringContaining("SET LOCAL lock_timeout = '1000ms'"),
      expect.stringContaining("SET LOCAL idle_in_transaction_session_timeout = '5000ms'"),
      'work:start',
    ]);
    expect(state.operations).toEqual([
      expect.stringContaining("SET LOCAL statement_timeout = '5000ms'"),
      expect.stringContaining("SET LOCAL lock_timeout = '1000ms'"),
      expect.stringContaining("SET LOCAL idle_in_transaction_session_timeout = '5000ms'"),
      'work:start',
      expect.stringContaining('pg_catalog.pg_advisory_xact_lock'),
      'select:membership:for-update',
      'select:transition-command',
      'insert:membership',
      'insert:transition',
    ]);
  });

  it('零次或重复命令调用均 fail-closed', async () => {
    const missing = createTransactionDatabase();
    await expect(createAdapter().run(missing.database, async () => undefined))
      .rejects.toEqual(new MembershipExternalTransactionError(
        'membership_onboarding_invocation_count_invalid',
      ));

    const repeated = createTransactionDatabase();
    await expect(createAdapter().run(repeated.database, async (commands) => {
      await commands.createMembership(INTENT);
      await commands.createMembership(INTENT);
    })).rejects.toEqual(new MembershipExternalTransactionError(
      'membership_onboarding_invocation_count_invalid',
    ));
    expect(repeated.operations.filter((operation) =>
      operation === 'insert:membership')).toHaveLength(1);
    expect(repeated.operations.filter((operation) =>
      operation === 'insert:transition')).toHaveLength(1);

    const swallowed = createTransactionDatabase();
    await expect(createAdapter().run(swallowed.database, async (commands) => {
      await commands.createMembership(INTENT);
      try {
        await commands.createMembership(INTENT);
      } catch {
        // 即使下游错误地吞掉第二次调用错误，run 结束门禁仍必须拒绝提交。
      }
    })).rejects.toEqual(new MembershipExternalTransactionError(
      'membership_onboarding_invocation_count_invalid',
    ));
  });

  it('Owner command 的精确阻断码保持低敏且不执行 Membership DML', async () => {
    const state = createTransactionDatabase();
    await expect(createAdapter().run(state.database, async (commands) => {
      await commands.createMembership({ ...INTENT, tenantId: '' });
    })).rejects.toEqual(new MembershipExternalTransactionError(
      'membership_command_shape_invalid',
    ));
    expect(state.operations).not.toContain('insert:membership');
    expect(state.operations).not.toContain('insert:transition');
  });

  it('Membership affected rows 不为 1 时保留固定持久化错误并停止 evidence', async () => {
    const state = createTransactionDatabase({ membershipInsertAffected: 0 });
    await expect(createAdapter().run(state.database, async (commands) => {
      await commands.createMembership(INTENT);
    })).rejects.toEqual(new MembershipCommandPersistenceError(
      'membership_command_affected_rows_invalid',
    ));
    expect(state.operations).toContain('insert:membership');
    expect(state.operations).not.toContain('insert:transition');
  });

  it('SET LOCAL 失败映射为固定持久化错误且不进入 work', async () => {
    const state = createTransactionDatabase({ failExecuteAt: 2 });
    const work = vi.fn(async () => undefined);
    await expect(createAdapter().run(state.database, work)).rejects.toEqual(
      new MembershipCommandPersistenceError(
        'membership_command_repository_unavailable',
      ),
    );
    expect(work).not.toHaveBeenCalled();
    expect(state.operations).not.toContain('insert:membership');
  });

  it('下游 callback 错误原样穿透，回调结束后命令作用域立即失效', async () => {
    const callbackFailure = new Error('downstream rollback sentinel');
    const failedState = createTransactionDatabase();
    await expect(createAdapter().run(failedState.database, async (commands) => {
      await commands.createMembership(INTENT);
      throw callbackFailure;
    })).rejects.toBe(callbackFailure);

    const completedState = createTransactionDatabase();
    let captured: FormalOnboardingMembershipCommands | null = null;
    await createAdapter().run(completedState.database, async (commands) => {
      captured = commands;
      await commands.createMembership(INTENT);
    });
    await expect(captured!.createMembership(INTENT)).rejects.toEqual(
      new MembershipCommandPersistenceError(
        'membership_command_repository_unavailable',
      ),
    );
    expect(completedState.operations.filter((operation) =>
      operation === 'insert:membership')).toHaveLength(1);
  });

  it('实现静态锁定为无嵌套事务、无重试、无私有配置输出的唯一品牌适配点', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/modules/access-control/server/membership-command-external-transaction.ts',
      ),
      'utf8',
    );
    expect(source).not.toContain('.transaction(');
    expect(source.match(/MembershipCommandTransactionDatabase/gu)).toHaveLength(2);
    expect(source).not.toMatch(/retry|setTimeout|sql\.raw/iu);
    expect(source).not.toContain('DATABASE_URL');
    expect(source).not.toMatch(/console\.|logger\./u);
  });
});
