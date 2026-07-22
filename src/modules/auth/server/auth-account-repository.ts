import { and, eq } from 'drizzle-orm';
import { isProxy } from 'node:util/types';
import {
  isAuthAccountStatus,
  type AuthAccountInstitutionBindingRecord,
  type AuthAccountRecord,
  type AuthAccountStatus,
  type AuthTenantMembershipRecord,
} from '@/modules/auth/domain/auth-account';
import {
  isAuthRole,
  type AuthRole,
  type AuthSessionUser,
} from '@/modules/auth/domain/session';
import { isInstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { isInstitutionScopeIdV1 } from '@/modules/security/domain/institution-access';
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
  }): Promise<FormalServerSessionUserResolutionV1>;
};

declare const formalServerSessionUserSnapshotMarkerV1: unique symbol;

export type FormalServerSessionUserSnapshotV1 = Readonly<{
  readonly [formalServerSessionUserSnapshotMarkerV1]: 'formal_server_session_user_snapshot_v1';
}>;

export type FormalServerSessionUserResolutionV1 =
  | Readonly<{
      kind: 'resolved';
      snapshot: FormalServerSessionUserSnapshotV1;
    }>
  | Readonly<{ kind: 'denied' }>
  | Readonly<{ kind: 'invalid' }>
  | Readonly<{ kind: 'unavailable' }>;

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
  bindingId: string;
  bindingAccountId: string;
  bindingTenantId: string;
  bindingInstitutionId: string;
  bindingStatus: AuthAccountInstitutionBindingRecord['status'];
  bindingSource: AuthAccountInstitutionBindingRecord['source'];
  bindingAssignedAt: Date;
  bindingExpiresAt: Date | null;
  bindingRevokedAt: Date | null;
  bindingVersion: number;
};

type FormalServerSessionUserQueryV1 = Readonly<{
  accountId: string;
  tenantId: string;
  institutionId: string;
}>;

const FORMAL_SESSION_USER_QUERY_KEYS = Object.freeze([
  'accountId',
  'tenantId',
  'institutionId',
] as const);

const FORMAL_SESSION_USER_ROW_KEYS = Object.freeze([
  'accountId',
  'accountUsername',
  'accountDisplayName',
  'accountStatus',
  'accountPasswordResetRequired',
  'accountLockedUntil',
  'membershipTenantId',
  'membershipUserId',
  'membershipRole',
  'membershipDisplayName',
  'bindingId',
  'bindingAccountId',
  'bindingTenantId',
  'bindingInstitutionId',
  'bindingStatus',
  'bindingSource',
  'bindingAssignedAt',
  'bindingExpiresAt',
  'bindingRevokedAt',
  'bindingVersion',
] as const satisfies readonly (keyof FormalServerSessionUserRowV1)[]);

const formalServerSessionUserSnapshotHandlesV1 = new WeakSet<object>();
const formalServerSessionUserSnapshotValuesV1 = new WeakMap<
  object,
  Readonly<AuthSessionUser>
>();
const formalSessionUserDeniedV1 = Object.freeze({ kind: 'denied' } as const);
const formalSessionUserInvalidV1 = Object.freeze({ kind: 'invalid' } as const);
const formalSessionUserUnavailableV1 = Object.freeze({
  kind: 'unavailable',
} as const);

function snapshotExactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== 'string') ||
      expectedKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(descriptors, key),
      )
    ) {
      return null;
    }
    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotExactRows(value: unknown): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > 2
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const expectedKeys = [
      ...Array.from({ length: value.length }, (_, index) => String(index)),
      'length',
    ];
    if (
      Reflect.ownKeys(descriptors).length !== expectedKeys.length ||
      expectedKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(descriptors, key),
      )
    ) {
      return null;
    }
    const rows: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      rows.push(descriptor.value);
    }
    return Object.freeze(rows);
  } catch {
    return null;
  }
}

function dateEpochMs(value: unknown): number | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Date.prototype
    ) {
      return null;
    }
    const epochMs = Date.prototype.getTime.call(value);
    return Number.isFinite(epochMs) ? epochMs : null;
  } catch {
    return null;
  }
}

function parseFormalSessionUserQueryV1(
  value: unknown,
): FormalServerSessionUserQueryV1 | null {
  const snapshot = snapshotExactPlainRecord(
    value,
    FORMAL_SESSION_USER_QUERY_KEYS,
  );
  if (
    !snapshot ||
    !isInstitutionScopeIdV1(snapshot.accountId) ||
    !isInstitutionScopeIdV1(snapshot.tenantId) ||
    !isInstitutionScopeIdV1(snapshot.institutionId)
  ) {
    return null;
  }
  return Object.freeze({
    accountId: snapshot.accountId,
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
  });
}

function mintFormalServerSessionUserSnapshotV1(
  sessionUser: Readonly<AuthSessionUser>,
): FormalServerSessionUserSnapshotV1 {
  const handle = Object.freeze({}) as FormalServerSessionUserSnapshotV1;
  formalServerSessionUserSnapshotHandlesV1.add(handle);
  formalServerSessionUserSnapshotValuesV1.set(handle, sessionUser);
  return handle;
}

export function isFormalServerSessionUserSnapshotV1(
  value: unknown,
): value is FormalServerSessionUserSnapshotV1 {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !isProxy(value) &&
      formalServerSessionUserSnapshotHandlesV1.has(value)
    );
  } catch {
    return false;
  }
}

export function consumeFormalServerSessionUserSnapshotV1(
  value: unknown,
): Readonly<AuthSessionUser> | null {
  if (!isFormalServerSessionUserSnapshotV1(value)) return null;
  const sessionUser = formalServerSessionUserSnapshotValuesV1.get(value);
  if (!sessionUser) return null;
  formalServerSessionUserSnapshotValuesV1.delete(value);
  formalServerSessionUserSnapshotHandlesV1.delete(value);
  return sessionUser;
}

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
      const query = parseFormalSessionUserQueryV1(input);
      if (!query) return formalSessionUserInvalidV1;

      let rowsValue: unknown;
      try {
        rowsValue = await database
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
              eq(tenantMembers.tenantId, query.tenantId),
            ),
          )
          .innerJoin(
            authAccountInstitutionBindings,
            and(
              eq(authAccountInstitutionBindings.accountId, authUsers.id),
              eq(authAccountInstitutionBindings.tenantId, tenantMembers.tenantId),
              eq(
                authAccountInstitutionBindings.institutionId,
                query.institutionId,
              ),
              eq(authAccountInstitutionBindings.status, 'active'),
            ),
          )
          .where(eq(authUsers.id, query.accountId))
          .limit(2);
      } catch {
        return formalSessionUserUnavailableV1;
      }

      const rows = snapshotExactRows(rowsValue);
      if (!rows) return formalSessionUserInvalidV1;
      if (rows.length === 0) return formalSessionUserDeniedV1;
      if (rows.length !== 1) return formalSessionUserInvalidV1;
      const row = snapshotExactPlainRecord(
        rows[0],
        FORMAL_SESSION_USER_ROW_KEYS,
      );
      if (!row) return formalSessionUserInvalidV1;

      let nowEpochMs: number;
      try {
        nowEpochMs = Date.now();
      } catch {
        return formalSessionUserUnavailableV1;
      }
      if (!Number.isFinite(nowEpochMs)) {
        return formalSessionUserUnavailableV1;
      }
      const lockedUntilEpochMs = row.accountLockedUntil === null
        ? null
        : dateEpochMs(row.accountLockedUntil);
      const assignedAtEpochMs = dateEpochMs(row.bindingAssignedAt);
      const expiresAtEpochMs = row.bindingExpiresAt === null
        ? null
        : dateEpochMs(row.bindingExpiresAt);
      const revokedAtEpochMs = row.bindingRevokedAt === null
        ? null
        : dateEpochMs(row.bindingRevokedAt);
      if (
        !isInstitutionScopeIdV1(row.accountId) ||
        !isInstitutionScopeIdV1(row.membershipUserId) ||
        !isInstitutionScopeIdV1(row.membershipTenantId) ||
        !isInstitutionScopeIdV1(row.bindingId) ||
        !isInstitutionScopeIdV1(row.bindingAccountId) ||
        !isInstitutionScopeIdV1(row.bindingTenantId) ||
        !isInstitutionScopeIdV1(row.bindingInstitutionId) ||
        typeof row.accountUsername !== 'string' ||
        row.accountUsername.length === 0 ||
        typeof row.accountDisplayName !== 'string' ||
        typeof row.membershipDisplayName !== 'string' ||
        !isAuthAccountStatus(row.accountStatus) ||
        typeof row.accountPasswordResetRequired !== 'boolean' ||
        !isAuthRole(row.membershipRole) ||
        (row.bindingStatus !== 'active' && row.bindingStatus !== 'revoked') ||
        (row.bindingSource !== 'manual_admin' &&
          row.bindingSource !== 'migration_placeholder' &&
          row.bindingSource !== 'system') ||
        !Number.isSafeInteger(row.bindingVersion) ||
        Number(row.bindingVersion) <= 0 ||
        (row.accountLockedUntil !== null && lockedUntilEpochMs === null) ||
        assignedAtEpochMs === null ||
        (row.bindingExpiresAt !== null && expiresAtEpochMs === null) ||
        (row.bindingRevokedAt !== null && revokedAtEpochMs === null) ||
        row.accountId !== query.accountId ||
        row.membershipUserId !== query.accountId ||
        row.bindingAccountId !== query.accountId ||
        row.membershipTenantId !== query.tenantId ||
        row.bindingTenantId !== query.tenantId ||
        row.bindingInstitutionId !== query.institutionId
      ) {
        return formalSessionUserInvalidV1;
      }

      if (
        row.accountStatus !== 'active' ||
        row.accountPasswordResetRequired ||
        (lockedUntilEpochMs !== null && lockedUntilEpochMs > nowEpochMs) ||
        !isInstitutionRoleV1(row.membershipRole) ||
        row.bindingStatus === 'revoked' ||
        row.bindingSource === 'migration_placeholder' ||
        assignedAtEpochMs > nowEpochMs ||
        revokedAtEpochMs !== null ||
        (expiresAtEpochMs !== null && expiresAtEpochMs <= nowEpochMs)
      ) {
        return formalSessionUserDeniedV1;
      }

      return Object.freeze({
        kind: 'resolved',
        snapshot: mintFormalServerSessionUserSnapshotV1(
          Object.freeze({
            id: row.accountId,
            username: row.accountUsername,
            name: row.membershipDisplayName || row.accountDisplayName,
            role: row.membershipRole,
            tenantId: row.membershipTenantId,
            institutionId: row.bindingInstitutionId,
          }),
        ),
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
