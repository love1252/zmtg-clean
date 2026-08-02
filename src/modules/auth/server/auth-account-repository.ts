import { and, eq, isNull } from 'drizzle-orm';
import {
  type AuthAccountRecord,
  type AuthAccountStatus,
} from '@/modules/auth/domain/auth-account';
import type { TenantDatabase } from '@/server/db/client';
import { authUsers } from '@/server/db/schema';

export type ExpectedLoginAccountState = Readonly<{
  passwordHash: string;
  passwordUpdatedAt: Date;
  passwordResetRequired: boolean;
  status: AuthAccountStatus;
  lastLoginAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  updatedAt: Date;
}>;

export type LoginAccountStateWriteResult = 'recorded' | 'state_changed';

function loginAccountStateCondition(
  accountId: string,
  expectedState: ExpectedLoginAccountState,
) {
  return and(
    eq(authUsers.id, accountId),
    eq(authUsers.passwordHash, expectedState.passwordHash),
    eq(authUsers.passwordUpdatedAt, expectedState.passwordUpdatedAt),
    eq(authUsers.passwordResetRequired, expectedState.passwordResetRequired),
    eq(authUsers.status, expectedState.status),
    expectedState.lastLoginAt === null
      ? isNull(authUsers.lastLoginAt)
      : eq(authUsers.lastLoginAt, expectedState.lastLoginAt),
    eq(authUsers.failedLoginCount, expectedState.failedLoginCount),
    expectedState.lockedUntil === null
      ? isNull(authUsers.lockedUntil)
      : eq(authUsers.lockedUntil, expectedState.lockedUntil),
    eq(authUsers.updatedAt, expectedState.updatedAt),
  );
}

function loginAccountStateWriteResult(
  rows: Array<{ accountId: string }>,
  accountId: string,
): LoginAccountStateWriteResult {
  return rows.length === 1 && rows[0]?.accountId === accountId
    ? 'recorded'
    : 'state_changed';
}

export type AuthAccountRepository = {
  createAccount(record: AuthAccountRecord): Promise<AuthAccountRecord>;
  findAccountByUsername(username: string): Promise<AuthAccountRecord | null>;
  recordLoginFailure(input: {
    accountId: string;
    expectedState: ExpectedLoginAccountState;
    failedAt: Date;
    updatedBy: string;
    failedLoginCount: number;
    status: AuthAccountStatus;
    lockedUntil: Date | null;
  }): Promise<LoginAccountStateWriteResult>;
  recordLoginSuccess(input: {
    accountId: string;
    expectedState: ExpectedLoginAccountState;
    loggedInAt: Date;
    updatedBy: string;
    status: AuthAccountStatus;
  }): Promise<LoginAccountStateWriteResult>;
  updateAccountStatus(input: {
    accountId: string;
    status: AuthAccountStatus;
    lockedUntil: Date | null;
    updatedAt: Date;
    updatedBy: string;
  }): Promise<void>;
  updatePassword(input: {
    accountId: string;
    passwordHash: string;
    passwordUpdatedAt: Date;
    passwordResetRequired: boolean;
    status: AuthAccountStatus;
    updatedAt: Date;
    updatedBy: string;
  }): Promise<void>;
};

export function createAuthAccountRepository(
  database: TenantDatabase,
): AuthAccountRepository {
  return {
    async createAccount(record) {
      const rows = await database.insert(authUsers).values(record).returning();
      return (rows[0] ?? record) as AuthAccountRecord;
    },

    async findAccountByUsername(username) {
      const rows = await database
        .select()
        .from(authUsers)
        .where(eq(authUsers.username, username))
        .limit(1);

      return (rows[0] as AuthAccountRecord | undefined) ?? null;
    },

    async recordLoginFailure(input) {
      const rows = await database
        .update(authUsers)
        .set({
          failedLoginCount: input.failedLoginCount,
          lockedUntil: input.lockedUntil,
          status: input.status,
          updatedAt: input.failedAt,
          updatedBy: input.updatedBy,
        })
        .where(loginAccountStateCondition(input.accountId, input.expectedState))
        .returning({ accountId: authUsers.id });

      return loginAccountStateWriteResult(rows, input.accountId);
    },

    async recordLoginSuccess(input) {
      const rows = await database
        .update(authUsers)
        .set({
          failedLoginCount: 0,
          lastLoginAt: input.loggedInAt,
          lockedUntil: null,
          status: input.status,
          updatedAt: input.loggedInAt,
          updatedBy: input.updatedBy,
        })
        .where(loginAccountStateCondition(input.accountId, input.expectedState))
        .returning({ accountId: authUsers.id });

      return loginAccountStateWriteResult(rows, input.accountId);
    },

    async updateAccountStatus(input) {
      await database
        .update(authUsers)
        .set({
          lockedUntil: input.lockedUntil,
          status: input.status,
          updatedAt: input.updatedAt,
          updatedBy: input.updatedBy,
        })
        .where(eq(authUsers.id, input.accountId));
    },

    async updatePassword(input) {
      await database
        .update(authUsers)
        .set({
          failedLoginCount: 0,
          lockedUntil: null,
          passwordHash: input.passwordHash,
          passwordResetRequired: input.passwordResetRequired,
          passwordUpdatedAt: input.passwordUpdatedAt,
          status: input.status,
          updatedAt: input.updatedAt,
          updatedBy: input.updatedBy,
        })
        .where(eq(authUsers.id, input.accountId));
    },
  };
}
