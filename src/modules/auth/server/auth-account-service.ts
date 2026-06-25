import {
  buildFailedPasswordLoginState,
  canStartPasswordCredentialLogin,
  normalizeAuthUsername,
  toAuthSessionUser,
  toSafeAuthAccount,
  type AuthAccountRecord,
  type AuthAccountStatus,
  type SafeAuthAccount,
} from '@/modules/auth/domain/auth-account';
import {
  hashPasswordScrypt,
  verifyPasswordScrypt,
} from '@/modules/auth/server/password-hash';
import type { AuthAccountRepository } from '@/modules/auth/server/auth-account-repository';

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

      const loginDecision = canStartPasswordCredentialLogin(account, timestamp);
      if (!loginDecision.allowed) {
        return {
          status: 'rejected' as const,
          reason: loginDecision.reason,
        };
      }

      const passwordMatched = await passwordHasher.verify(
        command.plaintextPassword,
        account.passwordHash,
      );

      if (!passwordMatched) {
        const failureState = buildFailedPasswordLoginState(account, {
          now: timestamp,
          maxFailedAttempts: lockPolicy.maxFailedAttempts,
          lockMinutes: lockPolicy.lockMinutes,
        });
        await input.repository.recordLoginFailure({
          accountId: account.id,
          failedAt: timestamp,
          updatedBy: account.id,
          ...failureState,
        });

        return {
          status: 'rejected' as const,
          reason: 'invalid_credentials' as const,
        };
      }

      const membership = await input.repository.findPrimaryTenantMembershipByUserId(account.id);
      if (!membership || command.scope !== 'institution') {
        return {
          status: 'rejected' as const,
          reason: 'tenant_membership_missing' as const,
        };
      }

      const status = nextSuccessStatus(account);
      await input.repository.recordLoginSuccess({
        accountId: account.id,
        loggedInAt: timestamp,
        updatedBy: account.id,
        status,
      });

      return {
        status: 'authenticated' as const,
        passwordResetRequired: loginDecision.passwordResetRequired,
        user: toAuthSessionUser({ account, membership }),
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
