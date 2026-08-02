export const AUTH_ACCOUNT_STATUSES = [
  'active',
  'password_reset_required',
  'disabled',
  'locked',
] as const;

export type AuthAccountStatus = (typeof AUTH_ACCOUNT_STATUSES)[number];

export type AuthAccountRecord = {
  id: string;
  username: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  passwordHash: string;
  passwordUpdatedAt: Date;
  passwordResetRequired: boolean;
  status: AuthAccountStatus;
  lastLoginAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SafeAuthAccount = Omit<AuthAccountRecord, 'passwordHash'>;

export type PasswordCredentialLoginDecision =
  | {
      allowed: true;
      passwordResetRequired: boolean;
    }
  | {
      allowed: false;
      reason: 'account_disabled' | 'account_locked';
      lockedUntil?: Date | null;
    };

export type FailedPasswordLoginState = {
  failedLoginCount: number;
  status: AuthAccountStatus;
  lockedUntil: Date | null;
};

export function isAuthAccountStatus(value: unknown): value is AuthAccountStatus {
  return typeof value === 'string' && AUTH_ACCOUNT_STATUSES.includes(value as AuthAccountStatus);
}

export function normalizeAuthUsername(value: string) {
  return value.trim().toLowerCase();
}

export function canStartPasswordCredentialLogin(
  account: AuthAccountRecord,
  now: Date,
): PasswordCredentialLoginDecision {
  if (account.status === 'disabled') {
    return {
      allowed: false,
      reason: 'account_disabled',
    };
  }

  const lockedUntil = account.lockedUntil;
  const isFutureLock = lockedUntil ? lockedUntil.getTime() > now.getTime() : false;
  const isIndefiniteLock = account.status === 'locked' && !lockedUntil;

  if (isFutureLock || isIndefiniteLock) {
    return {
      allowed: false,
      reason: 'account_locked',
      lockedUntil,
    };
  }

  return {
    allowed: true,
    passwordResetRequired: account.passwordResetRequired || account.status === 'password_reset_required',
  };
}

export function buildFailedPasswordLoginState(
  account: AuthAccountRecord,
  input: {
    now: Date;
    maxFailedAttempts: number;
    lockMinutes: number;
  },
): FailedPasswordLoginState {
  const failedLoginCount = Math.max(0, account.failedLoginCount) + 1;
  const shouldLock = failedLoginCount >= input.maxFailedAttempts;

  if (shouldLock) {
    return {
      failedLoginCount,
      status: 'locked',
      lockedUntil: new Date(input.now.getTime() + input.lockMinutes * 60 * 1000),
    };
  }

  return {
    failedLoginCount,
    status: account.status === 'password_reset_required' ? 'password_reset_required' : 'active',
    lockedUntil: null,
  };
}

export function toSafeAuthAccount(account: AuthAccountRecord): SafeAuthAccount {
  const { passwordHash: _passwordHash, ...safeAccount } = account;
  return safeAccount;
}
