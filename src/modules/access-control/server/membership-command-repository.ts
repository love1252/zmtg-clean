import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type {
  MembershipCurrent,
  MembershipTransition,
} from '@/modules/access-control/domain/membership-lifecycle';
import {
  MembershipCommandPersistenceError,
  type ActiveMembershipBinding,
  type InsertMembershipBindingRow,
  type MembershipCommandPersistenceErrorCode,
  type MembershipCommandTransactionPort,
  type MembershipCommandUnitOfWork,
} from '@/modules/access-control/ports/membership-command-unit-of-work';
import type { TenantDatabase } from '@/server/db/client';
import {
  authAccountInstitutionBindings,
  tenantMembers,
  tenantMembershipTransitions,
} from '@/server/db/schema';

export const MEMBERSHIP_COMMAND_TRANSACTION_OPTIONS = Object.freeze({
  isolationLevel: 'serializable' as const,
  accessMode: 'read write' as const,
});
export const MEMBERSHIP_COMMAND_STATEMENT_TIMEOUT_MS = 5_000;
export const MEMBERSHIP_COMMAND_LOCK_TIMEOUT_MS = 1_000;
export const MEMBERSHIP_COMMAND_IDLE_TIMEOUT_MS = 5_000;

type MembershipRow = typeof tenantMembers.$inferSelect;
type BindingRow = typeof authAccountInstitutionBindings.$inferSelect;
declare const membershipCommandTransactionDatabaseBrand: unique symbol;

/**
 * 只允许由已经进入外层事务的 composition root 显式构造该品牌类型。
 * 普通 TenantDatabase 不能直接传给 transaction-bound UoW 工厂。
 */
export type MembershipCommandTransactionDatabase = TenantDatabase & {
  readonly [membershipCommandTransactionDatabaseBrand]: true;
};

const TIMEOUT_CODES = new Set(['25P03', '25P04', '55P03', '57014']);
const CONCURRENCY_CODES = new Set(['40001', '40P01']);
const CONNECTION_CODES = new Set([
  'CONNECTION_CLOSED',
  'CONNECTION_DESTROYED',
  'CONNECTION_ENDED',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

class MembershipCommandCallbackFailure {
  constructor(readonly reason: unknown) {}
}

function errorProperty(error: unknown, key: string): string | null {
  if (error === null || typeof error !== 'object') return null;
  const value = Reflect.get(error, key);
  return typeof value === 'string' ? value : null;
}

function mapDatabaseError(error: unknown): MembershipCommandPersistenceError {
  if (error instanceof MembershipCommandPersistenceError) return error;
  const code = errorProperty(error, 'code');
  const constraint = errorProperty(error, 'constraint_name') ??
    errorProperty(error, 'constraint');

  if (code && TIMEOUT_CODES.has(code)) {
    return new MembershipCommandPersistenceError('membership_command_timeout');
  }
  if (code && CONCURRENCY_CODES.has(code)) {
    return new MembershipCommandPersistenceError(
      'membership_command_concurrency_conflict',
    );
  }
  if (code && CONNECTION_CODES.has(code)) {
    return new MembershipCommandPersistenceError(
      'membership_command_repository_unavailable',
    );
  }
  if (code === '23505') {
    if (constraint === 'tenant_membership_transitions_tenant_command_unique') {
      return new MembershipCommandPersistenceError('command_replay_rejected');
    }
    if (constraint === 'tenant_membership_transitions_membership_revision_unique') {
      return new MembershipCommandPersistenceError('membership_cas_conflict');
    }
    if (constraint === 'tenant_members_tenant_user_unique_idx') {
      return new MembershipCommandPersistenceError('membership_create_conflict');
    }
    if (constraint === 'auth_account_institution_bindings_active_account_tenant_unique_idx') {
      return new MembershipCommandPersistenceError('binding_conflict');
    }
  }
  if (code?.startsWith('23')) {
    return new MembershipCommandPersistenceError(
      'membership_command_constraint_conflict',
    );
  }
  return new MembershipCommandPersistenceError(
    'membership_command_repository_unavailable',
  );
}

async function runDatabaseOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

function toCanonicalInstant(value: Date | null): string | null {
  if (value === null || !(value instanceof Date) || Number.isNaN(value.valueOf())) {
    return value === null ? null : fail('membership_command_repository_unavailable');
  }
  return value.toISOString();
}

function fail(code: MembershipCommandPersistenceErrorCode): never {
  throw new MembershipCommandPersistenceError(code);
}

function mapMembershipRow(row: MembershipRow): MembershipCurrent {
  const createdAt = toCanonicalInstant(row.createdAt);
  const updatedAt = toCanonicalInstant(row.updatedAt);
  if (createdAt === null || updatedAt === null) {
    fail('membership_command_repository_unavailable');
  }
  return Object.freeze({
    membershipId: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    role: row.role,
    displayName: row.displayName,
    revision: row.revision,
    lifecycleStatus: row.lifecycleStatus,
    provenanceSource: row.currentProvenanceSource,
    provenanceActorId: row.currentProvenanceActorId,
    provenanceReasonCode: row.currentProvenanceReasonCode,
    provenanceCommandId: row.currentProvenanceCommandId,
    provenanceOccurredAt: toCanonicalInstant(row.currentProvenanceOccurredAt),
    provenanceRecordedAt: toCanonicalInstant(row.currentProvenanceRecordedAt),
    revokedAt: toCanonicalInstant(row.revokedAt),
    deletedAt: toCanonicalInstant(row.deletedAt),
    createdAt,
    updatedAt,
  });
}

function mapActiveBinding(row: BindingRow): ActiveMembershipBinding {
  const assignedAt = toCanonicalInstant(row.assignedAt);
  const createdAt = toCanonicalInstant(row.createdAt);
  const updatedAt = toCanonicalInstant(row.updatedAt);
  if (
    row.status !== 'active' ||
    row.revokedAt !== null ||
    assignedAt === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    fail('membership_command_repository_unavailable');
  }
  return Object.freeze({
    bindingId: row.id,
    accountId: row.accountId,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    source: row.source,
    assignedBy: row.assignedBy,
    assignedAt,
    expiresAt: toCanonicalInstant(row.expiresAt),
    version: row.version,
    createdAt,
    updatedAt,
  });
}

function requireAtMostOne<T>(rows: readonly T[]): T | null {
  if (rows.length > 1) fail('membership_command_repository_unavailable');
  return rows[0] ?? null;
}

function affectedRows(rows: readonly unknown[]): number {
  if (!Array.isArray(rows)) fail('membership_command_affected_rows_invalid');
  return rows.length;
}

/**
 * 为已经存在的外层事务创建 UoW。调用方负责事务、超时与回滚；本函数绝不
 * 开启嵌套事务。M3 composition root 必须使用该入口。
 */
export function createTransactionBoundMembershipCommandUnitOfWork(
  database: MembershipCommandTransactionDatabase,
  isActive: () => boolean,
): MembershipCommandUnitOfWork {
  const assertActive = (): void => {
    if (!isActive()) fail('membership_command_repository_unavailable');
  };

  const unitOfWork: MembershipCommandUnitOfWork = {
    lockCreateIdentity: async (input): Promise<void> => {
      assertActive();
      await runDatabaseOperation(() =>
        database.execute(sql`
          SELECT pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtext(${`membership-create:${input.tenantId}`}),
            pg_catalog.hashtext(${input.userId})
          )
        `),
      );
    },
    lockMembershipByTenantUser: async (input): Promise<MembershipCurrent | null> => {
      assertActive();
      const rows = await runDatabaseOperation(() =>
        database
          .select()
          .from(tenantMembers)
          .where(and(
            eq(tenantMembers.tenantId, input.tenantId),
            eq(tenantMembers.userId, input.userId),
          ))
          .limit(2)
          .for('update'),
      );
      const row = requireAtMostOne(rows);
      return row === null ? null : mapMembershipRow(row);
    },
    lockMembershipById: async (input): Promise<MembershipCurrent | null> => {
      assertActive();
      const rows = await runDatabaseOperation(() =>
        database
          .select()
          .from(tenantMembers)
          .where(and(
            eq(tenantMembers.tenantId, input.tenantId),
            eq(tenantMembers.id, input.membershipId),
          ))
          .limit(2)
          .for('update'),
      );
      const row = requireAtMostOne(rows);
      return row === null ? null : mapMembershipRow(row);
    },
    lockActiveBinding: async (input): Promise<ActiveMembershipBinding | null> => {
      assertActive();
      const rows = await runDatabaseOperation(() =>
        database
          .select()
          .from(authAccountInstitutionBindings)
          .where(and(
            eq(authAccountInstitutionBindings.tenantId, input.tenantId),
            eq(authAccountInstitutionBindings.accountId, input.accountId),
            eq(authAccountInstitutionBindings.status, 'active'),
          ))
          .orderBy(asc(authAccountInstitutionBindings.id))
          .limit(2)
          .for('update'),
      );
      const row = requireAtMostOne(rows);
      return row === null ? null : mapActiveBinding(row);
    },
    commandExists: async (input): Promise<boolean> => {
      assertActive();
      const rows = await runDatabaseOperation(() =>
        database
          .select({ id: tenantMembershipTransitions.id })
          .from(tenantMembershipTransitions)
          .where(and(
            eq(tenantMembershipTransitions.tenantId, input.tenantId),
            eq(tenantMembershipTransitions.commandId, input.commandId),
          ))
          .limit(2),
      );
      return requireAtMostOne(rows) !== null;
    },
    insertMembership: async (current): Promise<number> => {
      assertActive();
      const rows = await runDatabaseOperation(() =>
        database
          .insert(tenantMembers)
          .values({
            id: current.membershipId,
            tenantId: current.tenantId,
            userId: current.userId,
            role: current.role,
            displayName: current.displayName,
            revision: current.revision,
            lifecycleStatus: current.lifecycleStatus,
            currentProvenanceSource: current.provenanceSource,
            currentProvenanceActorId: current.provenanceActorId,
            currentProvenanceReasonCode: current.provenanceReasonCode,
            currentProvenanceCommandId: current.provenanceCommandId,
            currentProvenanceOccurredAt: current.provenanceOccurredAt === null
              ? null
              : new Date(current.provenanceOccurredAt),
            currentProvenanceRecordedAt: current.provenanceRecordedAt === null
              ? null
              : new Date(current.provenanceRecordedAt),
            revokedAt: current.revokedAt === null ? null : new Date(current.revokedAt),
            deletedAt: current.deletedAt === null ? null : new Date(current.deletedAt),
            createdAt: new Date(current.createdAt),
            updatedAt: new Date(current.updatedAt),
          })
          .returning({ id: tenantMembers.id }),
      );
      return affectedRows(rows);
    },
    updateMembershipByCas: async (input): Promise<number> => {
      assertActive();
      const rows = await runDatabaseOperation(() =>
        database
          .update(tenantMembers)
          .set({
            role: input.next.role,
            revision: input.next.revision,
            lifecycleStatus: input.next.lifecycleStatus,
            currentProvenanceSource: input.next.provenanceSource,
            currentProvenanceActorId: input.next.provenanceActorId,
            currentProvenanceReasonCode: input.next.provenanceReasonCode,
            currentProvenanceCommandId: input.next.provenanceCommandId,
            currentProvenanceOccurredAt: input.next.provenanceOccurredAt === null
              ? null
              : new Date(input.next.provenanceOccurredAt),
            currentProvenanceRecordedAt: input.next.provenanceRecordedAt === null
              ? null
              : new Date(input.next.provenanceRecordedAt),
            revokedAt: input.next.revokedAt === null
              ? null
              : new Date(input.next.revokedAt),
            deletedAt: input.next.deletedAt === null
              ? null
              : new Date(input.next.deletedAt),
            updatedAt: new Date(input.next.updatedAt),
          })
          .where(and(
            eq(tenantMembers.tenantId, input.previous.tenantId),
            eq(tenantMembers.id, input.previous.membershipId),
            eq(tenantMembers.userId, input.previous.userId),
            eq(tenantMembers.revision, input.expectedRevision),
            eq(tenantMembers.lifecycleStatus, input.expectedLifecycleStatus),
          ))
          .returning({ id: tenantMembers.id }),
      );
      return affectedRows(rows);
    },
    insertActiveBinding: async (row: InsertMembershipBindingRow): Promise<number> => {
      assertActive();
      const rows = await runDatabaseOperation(() =>
        database
          .insert(authAccountInstitutionBindings)
          .values({
            id: row.bindingId,
            accountId: row.accountId,
            tenantId: row.tenantId,
            institutionId: row.institutionId,
            status: 'active',
            source: row.source,
            assignedBy: row.assignedBy,
            assignedAt: new Date(row.assignedAt),
            expiresAt: row.expiresAt === null ? null : new Date(row.expiresAt),
            revokedAt: null,
            version: 1,
            createdAt: new Date(row.recordedAt),
            updatedAt: new Date(row.recordedAt),
          })
          .returning({ id: authAccountInstitutionBindings.id }),
      );
      return affectedRows(rows);
    },
    revokeActiveBindingByCas: async (input): Promise<number> => {
      assertActive();
      const rows = await runDatabaseOperation(() =>
        database
          .update(authAccountInstitutionBindings)
          .set({
            status: 'revoked',
            revokedAt: new Date(input.revokedAt),
            version: input.binding.version + 1,
            updatedAt: new Date(input.recordedAt),
          })
          .where(and(
            eq(authAccountInstitutionBindings.id, input.binding.bindingId),
            eq(authAccountInstitutionBindings.tenantId, input.binding.tenantId),
            eq(authAccountInstitutionBindings.accountId, input.binding.accountId),
            eq(authAccountInstitutionBindings.status, 'active'),
            eq(authAccountInstitutionBindings.version, input.binding.version),
            isNull(authAccountInstitutionBindings.revokedAt),
          ))
          .returning({ id: authAccountInstitutionBindings.id }),
      );
      return affectedRows(rows);
    },
    appendTransition: async (transition: MembershipTransition): Promise<number> => {
      assertActive();
      const rows = await runDatabaseOperation(() =>
        database
          .insert(tenantMembershipTransitions)
          .values({
            id: transition.transitionId,
            tenantId: transition.tenantId,
            membershipId: transition.membershipId,
            commandId: transition.commandId,
            transitionType: transition.transitionType,
            source: transition.source,
            actorId: transition.actorId,
            reasonCode: transition.reasonCode,
            fromRevision: transition.fromRevision,
            toRevision: transition.toRevision,
            fromLifecycleStatus: transition.fromLifecycleStatus,
            toLifecycleStatus: transition.toLifecycleStatus,
            fromRole: transition.fromRole,
            toRole: transition.toRole,
            occurredAt: new Date(transition.occurredAt),
            recordedAt: new Date(transition.recordedAt),
          })
          .returning({ id: tenantMembershipTransitions.id }),
      );
      return affectedRows(rows);
    },
  };
  return Object.freeze(unitOfWork);
}

export function createMembershipCommandTransactionPort(
  database: TenantDatabase,
): MembershipCommandTransactionPort {
  return Object.freeze({
    run: async <T>(
      work: (unitOfWork: MembershipCommandUnitOfWork) => Promise<T>,
    ): Promise<T> => {
      try {
        const result = await database.transaction(
          async (transactionDatabase) => {
            const transaction = transactionDatabase as unknown as
              MembershipCommandTransactionDatabase;
            await runDatabaseOperation(() => transaction.execute(sql`
              SET LOCAL statement_timeout = '5000ms'
            `));
            await runDatabaseOperation(() => transaction.execute(sql`
              SET LOCAL lock_timeout = '1000ms'
            `));
            await runDatabaseOperation(() => transaction.execute(sql`
              SET LOCAL idle_in_transaction_session_timeout = '5000ms'
            `));

            let active = true;
            const unitOfWork = createTransactionBoundMembershipCommandUnitOfWork(
              transaction,
              () => active,
            );
            try {
              return { value: await work(unitOfWork) };
            } catch (error) {
              throw new MembershipCommandCallbackFailure(error);
            } finally {
              active = false;
            }
          },
          MEMBERSHIP_COMMAND_TRANSACTION_OPTIONS,
        );
        return result.value;
      } catch (error) {
        if (error instanceof MembershipCommandCallbackFailure) {
          throw error.reason;
        }
        throw mapDatabaseError(error);
      }
    },
  });
}
