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

export type AdoptLegacyAccountInput = Readonly<{
  accountId: string;
  expected: AuthAccountRecord;
  username: string;
  displayName: string;
  passwordHash: string;
  passwordUpdatedAt: Date;
  passwordResetRequired: boolean;
  status: AuthAccountStatus;
  failedLoginCount: number;
  lockedUntil: Date | null;
  updatedAt: Date;
  updatedBy: string;
}>;

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

function legacyAccountAdoptionCondition(input: AdoptLegacyAccountInput) {
  const expected = input.expected;
  return and(
    eq(authUsers.id, input.accountId),
    eq(authUsers.id, expected.id),
    eq(authUsers.username, expected.username),
    eq(authUsers.displayName, expected.displayName),
    expected.phone === null
      ? isNull(authUsers.phone)
      : eq(authUsers.phone, expected.phone),
    expected.email === null
      ? isNull(authUsers.email)
      : eq(authUsers.email, expected.email),
    eq(authUsers.passwordHash, expected.passwordHash),
    eq(authUsers.passwordUpdatedAt, expected.passwordUpdatedAt),
    eq(authUsers.passwordResetRequired, expected.passwordResetRequired),
    eq(authUsers.status, expected.status),
    expected.lastLoginAt === null
      ? isNull(authUsers.lastLoginAt)
      : eq(authUsers.lastLoginAt, expected.lastLoginAt),
    eq(authUsers.failedLoginCount, expected.failedLoginCount),
    expected.lockedUntil === null
      ? isNull(authUsers.lockedUntil)
      : eq(authUsers.lockedUntil, expected.lockedUntil),
    eq(authUsers.createdBy, expected.createdBy),
    eq(authUsers.updatedBy, expected.updatedBy),
    eq(authUsers.createdAt, expected.createdAt),
    eq(authUsers.updatedAt, expected.updatedAt),
  );
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

export type AuthAccountLegacyAdoptionRepository = Readonly<{
  findAccountById(accountId: string): Promise<AuthAccountRecord | null>;
  adoptLegacyAccount(
    input: AdoptLegacyAccountInput,
  ): Promise<LoginAccountStateWriteResult>;
}>;

export function createAuthAccountRepository(
  database: TenantDatabase,
): AuthAccountRepository & AuthAccountLegacyAdoptionRepository {
  return {
    async createAccount(record) {
      const rows = await database.insert(authUsers).values(record).returning();
      return (rows[0] ?? record) as AuthAccountRecord;
    },

    async findAccountById(accountId) {
      const rows = await database
        .select()
        .from(authUsers)
        .where(eq(authUsers.id, accountId))
        .limit(1);

      return (rows[0] as AuthAccountRecord | undefined) ?? null;
    },

    async findAccountByUsername(username) {
      const rows = await database
        .select()
        .from(authUsers)
        .where(eq(authUsers.username, username))
        .limit(1);

      return (rows[0] as AuthAccountRecord | undefined) ?? null;
    },

    async adoptLegacyAccount(input) {
      const rows = await database
        .update(authUsers)
        .set({
          username: input.username,
          displayName: input.displayName,
          passwordHash: input.passwordHash,
          passwordUpdatedAt: input.passwordUpdatedAt,
          passwordResetRequired: input.passwordResetRequired,
          status: input.status,
          failedLoginCount: input.failedLoginCount,
          lockedUntil: input.lockedUntil,
          updatedAt: input.updatedAt,
          updatedBy: input.updatedBy,
        })
        .where(legacyAccountAdoptionCondition(input))
        .returning({ accountId: authUsers.id });

      return loginAccountStateWriteResult(rows, input.accountId);
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
