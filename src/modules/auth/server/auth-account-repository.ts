import { and, eq } from 'drizzle-orm';
import type {
  AuthAccountInstitutionBindingRecord,
  AuthAccountRecord,
  AuthAccountStatus,
  AuthTenantMembershipRecord,
} from '@/modules/auth/domain/auth-account';
import type { TenantDatabase } from '@/server/db/client';
import {
  authAccountInstitutionBindings,
  authUsers,
  tenantMembers,
} from '@/server/db/schema';

export type AuthAccountRepository = {
  createAccount(record: AuthAccountRecord): Promise<AuthAccountRecord>;
  findAccountByUsername(username: string): Promise<AuthAccountRecord | null>;
  findPrimaryTenantMembershipByUserId(userId: string): Promise<AuthTenantMembershipRecord | null>;
  listActiveInstitutionBindingsByAccountAndTenant(input: {
    accountId: string;
    tenantId: string;
  }): Promise<AuthAccountInstitutionBindingRecord[]>;
  recordLoginFailure(input: {
    accountId: string;
    failedAt: Date;
    updatedBy: string;
    failedLoginCount: number;
    status: AuthAccountStatus;
    lockedUntil: Date | null;
  }): Promise<void>;
  recordLoginSuccess(input: {
    accountId: string;
    loggedInAt: Date;
    updatedBy: string;
    status: AuthAccountStatus;
  }): Promise<void>;
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

export function createAuthAccountRepository(database: TenantDatabase): AuthAccountRepository {
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

    async findPrimaryTenantMembershipByUserId(userId) {
      const rows = await database
        .select()
        .from(tenantMembers)
        .where(eq(tenantMembers.userId, userId))
        .limit(1);

      return (rows[0] as AuthTenantMembershipRecord | undefined) ?? null;
    },

    async listActiveInstitutionBindingsByAccountAndTenant(input) {
      const rows = await database
        .select()
        .from(authAccountInstitutionBindings)
        .where(and(
          eq(authAccountInstitutionBindings.accountId, input.accountId),
          eq(authAccountInstitutionBindings.tenantId, input.tenantId),
          eq(authAccountInstitutionBindings.status, 'active'),
        ))
        .limit(2);

      return rows as AuthAccountInstitutionBindingRecord[];
    },

    async recordLoginFailure(input) {
      await database
        .update(authUsers)
        .set({
          failedLoginCount: input.failedLoginCount,
          lockedUntil: input.lockedUntil,
          status: input.status,
          updatedAt: input.failedAt,
          updatedBy: input.updatedBy,
        })
        .where(eq(authUsers.id, input.accountId));
    },

    async recordLoginSuccess(input) {
      await database
        .update(authUsers)
        .set({
          failedLoginCount: 0,
          lastLoginAt: input.loggedInAt,
          lockedUntil: null,
          status: input.status,
          updatedAt: input.loggedInAt,
          updatedBy: input.updatedBy,
        })
        .where(eq(authUsers.id, input.accountId));
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
