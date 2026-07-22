import { and, eq } from 'drizzle-orm';
import type {
  AuthAccountInstitutionBindingRecord,
  AuthAccountRecord,
  AuthAccountStatus,
  AuthTenantMembershipRecord,
} from '@/modules/auth/domain/auth-account';
import type { AuthRole, AuthSessionUser } from '@/modules/auth/domain/session';
import type { TenantDatabase } from '@/server/db/client';
import {
  authAccountInstitutionBindings,
  authUsers,
  tenantMembers,
} from '@/server/db/schema';

/**
 * Low-sensitivity row returned by the single authoritative membership query.
 * It deliberately excludes credentials and contact/profile fields.
 */
export type CurrentInstitutionMembershipFactRow = {
  accountId: string;
  accountStatus: AuthAccountStatus;
  accountPasswordResetRequired: boolean;
  accountLockedUntil: Date | null;
  membershipId: string;
  membershipTenantId: string;
  membershipUserId: string;
  membershipRole: AuthRole;
  membershipUpdatedAt: Date;
  bindingId: string | null;
  bindingAccountId: string | null;
  bindingTenantId: string | null;
  bindingInstitutionId: string | null;
  bindingStatus: AuthAccountInstitutionBindingRecord['status'] | null;
  bindingSource: AuthAccountInstitutionBindingRecord['source'] | null;
  bindingAssignedAt: Date | null;
  bindingExpiresAt: Date | null;
  bindingRevokedAt: Date | null;
  bindingVersion: number | null;
};

export type AuthAccountInstitutionMembershipFactRepository = {
  findCurrentInstitutionMembershipFacts(input: {
    accountId: string;
    tenantId: string;
  }): Promise<CurrentInstitutionMembershipFactRow[]>;
};

export type FormalServerSessionUserRepositoryV1 = {
  findCurrentFormalSessionUser(input: {
    accountId: string;
    tenantId: string;
    institutionId: string;
  }): Promise<Readonly<AuthSessionUser> | null>;
};

type FormalServerSessionUserRowV1 = {
  accountId: string;
  accountUsername: string;
  accountDisplayName: string;
  accountStatus: AuthAccountStatus;
  accountPasswordResetRequired: boolean;
  accountLockedUntil: Date | null;
  membershipTenantId: string;
  membershipUserId: string;
  membershipRole: AuthRole;
  membershipDisplayName: string;
  bindingAccountId: string;
  bindingTenantId: string;
  bindingInstitutionId: string;
  bindingStatus: AuthAccountInstitutionBindingRecord['status'];
  bindingExpiresAt: Date | null;
  bindingRevokedAt: Date | null;
};

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

export function createAuthAccountRepository(
  database: TenantDatabase,
): AuthAccountRepository &
  AuthAccountInstitutionMembershipFactRepository &
  FormalServerSessionUserRepositoryV1 {
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

    async findCurrentInstitutionMembershipFacts(input) {
      const rows = await database
        .select({
          accountId: authUsers.id,
          accountStatus: authUsers.status,
          accountPasswordResetRequired: authUsers.passwordResetRequired,
          accountLockedUntil: authUsers.lockedUntil,
          membershipId: tenantMembers.id,
          membershipTenantId: tenantMembers.tenantId,
          membershipUserId: tenantMembers.userId,
          membershipRole: tenantMembers.role,
          membershipUpdatedAt: tenantMembers.updatedAt,
          bindingId: authAccountInstitutionBindings.id,
          bindingAccountId: authAccountInstitutionBindings.accountId,
          bindingTenantId: authAccountInstitutionBindings.tenantId,
          bindingInstitutionId: authAccountInstitutionBindings.institutionId,
          bindingStatus: authAccountInstitutionBindings.status,
          bindingSource: authAccountInstitutionBindings.source,
          bindingAssignedAt: authAccountInstitutionBindings.assignedAt,
          bindingExpiresAt: authAccountInstitutionBindings.expiresAt,
          bindingRevokedAt: authAccountInstitutionBindings.revokedAt,
          bindingVersion: authAccountInstitutionBindings.version,
        })
        .from(authUsers)
        .innerJoin(
          tenantMembers,
          and(
            eq(tenantMembers.userId, authUsers.id),
            eq(tenantMembers.tenantId, input.tenantId),
          ),
        )
        .leftJoin(
          authAccountInstitutionBindings,
          and(
            eq(authAccountInstitutionBindings.accountId, authUsers.id),
            eq(authAccountInstitutionBindings.tenantId, tenantMembers.tenantId),
            eq(authAccountInstitutionBindings.status, 'active'),
          ),
        )
        .where(eq(authUsers.id, input.accountId))
        .limit(2);

      return rows as CurrentInstitutionMembershipFactRow[];
    },

    async findCurrentFormalSessionUser(input) {
      const rows = await database
        .select({
          accountId: authUsers.id,
          accountUsername: authUsers.username,
          accountDisplayName: authUsers.displayName,
          accountStatus: authUsers.status,
          accountPasswordResetRequired: authUsers.passwordResetRequired,
          accountLockedUntil: authUsers.lockedUntil,
          membershipTenantId: tenantMembers.tenantId,
          membershipUserId: tenantMembers.userId,
          membershipRole: tenantMembers.role,
          membershipDisplayName: tenantMembers.displayName,
          bindingAccountId: authAccountInstitutionBindings.accountId,
          bindingTenantId: authAccountInstitutionBindings.tenantId,
          bindingInstitutionId: authAccountInstitutionBindings.institutionId,
          bindingStatus: authAccountInstitutionBindings.status,
          bindingExpiresAt: authAccountInstitutionBindings.expiresAt,
          bindingRevokedAt: authAccountInstitutionBindings.revokedAt,
        })
        .from(authUsers)
        .innerJoin(
          tenantMembers,
          and(
            eq(tenantMembers.userId, authUsers.id),
            eq(tenantMembers.tenantId, input.tenantId),
          ),
        )
        .innerJoin(
          authAccountInstitutionBindings,
          and(
            eq(authAccountInstitutionBindings.accountId, authUsers.id),
            eq(authAccountInstitutionBindings.tenantId, tenantMembers.tenantId),
            eq(
              authAccountInstitutionBindings.institutionId,
              input.institutionId,
            ),
          ),
        )
        .where(eq(authUsers.id, input.accountId))
        .limit(2);

      if (rows.length !== 1) return null;
      const row = rows[0] as FormalServerSessionUserRowV1 | undefined;
      if (!row) return null;
      const nowEpochMs = Date.now();
      let lockedUntilEpochMs: number | null = null;
      let expiresAtEpochMs: number | null = null;
      try {
        lockedUntilEpochMs = row.accountLockedUntil === null
          ? null
          : Date.prototype.getTime.call(row.accountLockedUntil);
        expiresAtEpochMs = row.bindingExpiresAt === null
          ? null
          : Date.prototype.getTime.call(row.bindingExpiresAt);
      } catch {
        return null;
      }
      if (
        !Number.isFinite(nowEpochMs) ||
        (lockedUntilEpochMs !== null && !Number.isFinite(lockedUntilEpochMs)) ||
        (expiresAtEpochMs !== null && !Number.isFinite(expiresAtEpochMs)) ||
        row.accountId !== input.accountId ||
        row.membershipUserId !== input.accountId ||
        row.bindingAccountId !== input.accountId ||
        row.membershipTenantId !== input.tenantId ||
        row.bindingTenantId !== input.tenantId ||
        row.bindingInstitutionId !== input.institutionId ||
        row.accountStatus !== 'active' ||
        row.accountPasswordResetRequired ||
        (lockedUntilEpochMs !== null && lockedUntilEpochMs > nowEpochMs) ||
        row.bindingStatus !== 'active' ||
        row.bindingRevokedAt !== null ||
        (expiresAtEpochMs !== null && expiresAtEpochMs <= nowEpochMs)
      ) {
        return null;
      }

      return Object.freeze({
        id: row.accountId,
        username: row.accountUsername,
        name: row.membershipDisplayName || row.accountDisplayName,
        role: row.membershipRole,
        tenantId: row.membershipTenantId,
        institutionId: row.bindingInstitutionId,
      });
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
