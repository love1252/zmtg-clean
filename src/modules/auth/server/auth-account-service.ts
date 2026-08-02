import {
  buildFailedPasswordLoginState,
  canStartPasswordCredentialLogin,
  normalizeAuthUsername,
  toSafeAuthAccount,
  type AuthAccountRecord,
  type AuthAccountStatus,
  type SafeAuthAccount,
} from '@/modules/auth/domain/auth-account';
import {
  hashPasswordScrypt,
  verifyPasswordScrypt,
} from '@/modules/auth/server/password-hash';
import type {
  AuthAccountRepository,
  ExpectedLoginAccountState,
} from '@/modules/auth/server/auth-account-repository';

export type { AuthAccountRepository } from '@/modules/auth/server/auth-account-repository';

export type AuthAccountPasswordHasher = {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
};

export type AuthAccountService = ReturnType<typeof createAuthAccountService>;

type CreatePasswordAccountInput = {
  id: string;
  username: string;
  displayName: string;
  phone?: string | null;
  email?: string | null;
  plaintextPassword: string;
  actorId: string;
};

type AuthenticatePasswordAccountInput = {
  username: string;
  plaintextPassword: string;
  scope: 'institution' | 'platform';
};

type ResetPasswordInput = {
  accountId: string;
  plaintextPassword: string;
  actorId: string;
};

const DEFAULT_LOCK_POLICY = {
  maxFailedAttempts: 5,
  lockMinutes: 15,
};

const defaultPasswordHasher: AuthAccountPasswordHasher = {
  hash: hashPasswordScrypt,
  verify: verifyPasswordScrypt,
};

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isBlankPassword(value: string) {
  return value.trim().length === 0;
}

function nextSuccessStatus(account: AuthAccountRecord): AuthAccountStatus {
  return account.passwordResetRequired || account.status === 'password_reset_required'
    ? 'password_reset_required'
    : 'active';
}

function frozenDate(value: Date): Date {
  return Object.freeze(new Date(value.getTime()));
}

function frozenNullableDate(value: Date | null): Date | null {
  return value === null ? null : frozenDate(value);
}

function freezeAuthAccountSnapshot(account: AuthAccountRecord): Readonly<AuthAccountRecord> {
  return Object.freeze({
    ...account,
    passwordUpdatedAt: frozenDate(account.passwordUpdatedAt),
    lastLoginAt: frozenNullableDate(account.lastLoginAt),
    lockedUntil: frozenNullableDate(account.lockedUntil),
    createdAt: frozenDate(account.createdAt),
    updatedAt: frozenDate(account.updatedAt),
  });
}

function freezeExpectedLoginAccountState(
  account: Readonly<AuthAccountRecord>,
): ExpectedLoginAccountState {
  return Object.freeze({
    passwordHash: account.passwordHash,
    passwordUpdatedAt: frozenDate(account.passwordUpdatedAt),
    passwordResetRequired: account.passwordResetRequired,
    status: account.status,
    lastLoginAt: frozenNullableDate(account.lastLoginAt),
    failedLoginCount: account.failedLoginCount,
    lockedUntil: frozenNullableDate(account.lockedUntil),
    updatedAt: frozenDate(account.updatedAt),
  });
}

export function createAuthAccountService(input: {
  repository: AuthAccountRepository;
  passwordHasher?: AuthAccountPasswordHasher;
  now?: () => Date;
  lockPolicy?: {
    maxFailedAttempts: number;
    lockMinutes: number;
  };
}) {
  const passwordHasher = input.passwordHasher ?? defaultPasswordHasher;
  const now = input.now ?? (() => new Date());
  const lockPolicy = input.lockPolicy ?? DEFAULT_LOCK_POLICY;

  return {
    async createPasswordAccount(command: CreatePasswordAccountInput): Promise<{
      status: 'created';
      account: SafeAuthAccount;
    } | {
      status: 'rejected';
      reason: 'password_required';
    }> {
      if (isBlankPassword(command.plaintextPassword)) {
        return {
          status: 'rejected',
          reason: 'password_required',
        };
      }

      const timestamp = now();
      const passwordHash = await passwordHasher.hash(command.plaintextPassword);
      const account: AuthAccountRecord = {
        id: command.id,
        username: normalizeAuthUsername(command.username),
        displayName: command.displayName.trim(),
        phone: optionalText(command.phone),
        email: optionalText(command.email),
        passwordHash,
        passwordUpdatedAt: timestamp,
        passwordResetRequired: true,
        status: 'password_reset_required',
        lastLoginAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        createdBy: command.actorId,
        updatedBy: command.actorId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const created = await input.repository.createAccount(account);

      return {
        status: 'created',
        account: toSafeAuthAccount(created),
      };
    },

    async authenticatePasswordAccount(command: AuthenticatePasswordAccountInput) {
      const timestamp = now();
      const username = normalizeAuthUsername(command.username);
      const account = await input.repository.findAccountByUsername(username);

      if (!account) {
        return {
          status: 'rejected' as const,
          reason: 'invalid_credentials' as const,
        };
      }

      const accountSnapshot = freezeAuthAccountSnapshot(account);
      const expectedState = freezeExpectedLoginAccountState(accountSnapshot);
      const loginDecision = canStartPasswordCredentialLogin(accountSnapshot, timestamp);
      if (!loginDecision.allowed) {
        return {
          status: 'rejected' as const,
          reason: loginDecision.reason,
        };
      }

      const passwordMatched = await passwordHasher.verify(
        command.plaintextPassword,
        accountSnapshot.passwordHash,
      );

      if (!passwordMatched) {
        const failureState = buildFailedPasswordLoginState(accountSnapshot, {
          now: timestamp,
          maxFailedAttempts: lockPolicy.maxFailedAttempts,
          lockMinutes: lockPolicy.lockMinutes,
        });
        const writeResult = await input.repository.recordLoginFailure({
          accountId: accountSnapshot.id,
          expectedState,
          failedAt: timestamp,
          updatedBy: accountSnapshot.id,
          ...failureState,
        });

        if (writeResult !== 'recorded') {
          return {
            status: 'rejected' as const,
            reason: 'state_changed' as const,
          };
        }

        return {
          status: 'rejected' as const,
          reason: 'invalid_credentials' as const,
        };
      }

      if (command.scope !== 'institution') {
        return {
          status: 'rejected' as const,
          reason: 'tenant_membership_missing' as const,
        };
      }

      const status = nextSuccessStatus(accountSnapshot);
      const writeResult = await input.repository.recordLoginSuccess({
        accountId: accountSnapshot.id,
        expectedState,
        loggedInAt: timestamp,
        updatedBy: accountSnapshot.id,
        status,
      });

      if (writeResult !== 'recorded') {
        return {
          status: 'rejected' as const,
          reason: 'state_changed' as const,
        };
      }

      return {
        status: 'authenticated' as const,
        passwordResetRequired: loginDecision.passwordResetRequired,
        account: toSafeAuthAccount(accountSnapshot),
      };
    },

    async resetPassword(command: ResetPasswordInput) {
      if (isBlankPassword(command.plaintextPassword)) {
        return {
          status: 'rejected' as const,
          reason: 'password_required' as const,
        };
      }

      const timestamp = now();
      const passwordHash = await passwordHasher.hash(command.plaintextPassword);
      await input.repository.updatePassword({
        accountId: command.accountId,
        passwordHash,
        passwordUpdatedAt: timestamp,
        passwordResetRequired: true,
        status: 'password_reset_required',
        updatedAt: timestamp,
        updatedBy: command.actorId,
      });

      return {
        status: 'password_reset_required' as const,
      };
    },

    async updateAccountStatus(command: {
      accountId: string;
      status: AuthAccountStatus;
      actorId: string;
      lockedUntil?: Date | null;
    }) {
      const timestamp = now();
      await input.repository.updateAccountStatus({
        accountId: command.accountId,
        status: command.status,
        lockedUntil: command.lockedUntil ?? null,
        updatedAt: timestamp,
        updatedBy: command.actorId,
      });

      return {
        status: command.status,
      };
    },
  };
}
