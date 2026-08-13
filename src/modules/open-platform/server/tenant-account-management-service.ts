import { randomUUID } from 'node:crypto';

import type { AuthAccountStatus } from '@/modules/auth/domain/auth-account';
import type { AuthAccountPasswordHasher } from '@/modules/auth/server/auth-account-service';
import { hashPasswordScrypt } from '@/modules/auth/server/password-hash';
import {
  createAttributedTenantAuditEventV1,
  type AttributedTenantAuditEventV1,
  type TenantAuditEvent,
} from '@/modules/audit/domain/audit-events';
import type { AccessRole } from '@/modules/security/domain/access-control';

export type TenantAccountOperationAction = 'reset_password' | 'disable' | 'enable';

export type TenantAccountManagementRecord = {
  tenantId: string;
  accountId: string;
  tenantMemberId: string;
  username: string;
  displayName: string;
  role: 'tenant_admin';
  status: AuthAccountStatus;
  passwordResetRequired: boolean;
};

export type TenantAccountOperationResult = {
  status: 'account_updated';
  action: TenantAccountOperationAction;
  auditEventId: string;
  account: TenantAccountManagementRecord & {
    updatedAt: string;
  };
};

export type TenantAccountOperationInput = {
  action: TenantAccountOperationAction;
  account: TenantAccountManagementRecord;
  nextStatus: AuthAccountStatus;
  passwordResetRequired: boolean;
  passwordHash?: string;
  passwordUpdatedAt?: Date;
  lockedUntil: Date | null;
  updatedAt: Date;
  updatedBy: string;
  auditEvent: AttributedTenantAuditEventV1;
};

export type TenantAccountManagementRepository = {
  findInitialAdminAccountByTenantId(
    tenantId: string,
  ): Promise<TenantAccountManagementRecord | null>;
  applyTenantAccountOperation(
    input: TenantAccountOperationInput,
  ): Promise<TenantAccountOperationResult>;
};

type IdFactory = (prefix: string) => string;
type PasswordHasher = Pick<AuthAccountPasswordHasher, 'hash'>;

type ParsedTenantAccountPayload =
  | { ok: true; action: 'reset_password'; newPassword: string }
  | { ok: true; action: 'disable' | 'enable' }
  | { ok: false; errors: string[] };

type TenantAccountManagementServiceResult =
  | { status: 'validation_error'; errors: string[] }
  | { status: 'not_found'; errorCode: 'TENANT_ACCOUNT_NOT_FOUND' }
  | TenantAccountOperationResult;

function defaultIdFactory(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 12)}`;
}

function nowDate(input?: () => Date) {
  return input ? input() : new Date();
}

function isObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function readText(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseTenantAccountOperationPayload(input: unknown): ParsedTenantAccountPayload {
  const payload = isObject(input) ? input : {};
  const action = readText(payload, 'action');
  if (!action) return { ok: false, errors: ['ACTION_REQUIRED'] };

  if (!['reset_password', 'disable', 'enable'].includes(action)) {
    return { ok: false, errors: ['ACTION_UNSUPPORTED'] };
  }

  if (action === 'reset_password') {
    const newPassword = readText(payload, 'newPassword');
    if (!newPassword) return { ok: false, errors: ['PASSWORD_REQUIRED'] };
    return { ok: true, action, newPassword };
  }

  return { ok: true, action: action as 'disable' | 'enable' };
}

function buildAuditEvent(input: {
  action: TenantAccountOperationAction;
  actorId: string;
  actorRole: AccessRole;
  auditEventId: string;
  tenantId: string;
  tenantMemberId: string;
  occurredAt: Date;
}): AttributedTenantAuditEventV1 {
  const reasonByAction = {
    reset_password: 'tenant_account_password_reset',
    disable: 'tenant_account_disabled',
    enable: 'tenant_account_enabled',
  } as const;

  const event: TenantAuditEvent = {
    eventId: input.auditEventId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    tenantId: input.tenantId,
    scope: 'platform',
    resource: 'tenant_member',
    resourceId: input.tenantMemberId,
    action: input.action === 'reset_password' ? 'manage_credentials' : 'manage_status',
    result: 'transitioned',
    reason: reasonByAction[input.action],
    occurredAt: input.occurredAt.toISOString(),
    source: 'server_session',
  };
  const attributedEvent = createAttributedTenantAuditEventV1({
    event,
    attribution: {
      institutionAttribution: 'not_applicable',
      tenantId: event.tenantId,
      institutionId: null,
    },
  });
  if (!attributedEvent) throw new Error('invalid_tenant_account_audit_attribution');
  return attributedEvent;
}

export async function manageTenantAccountService(input: {
  repository: TenantAccountManagementRepository;
  actorId: string;
  actorRole: AccessRole;
  tenantId: string;
  payload: unknown;
  now?: () => Date;
  idFactory?: IdFactory;
  passwordHasher?: PasswordHasher;
}): Promise<TenantAccountManagementServiceResult> {
  const parsed = parseTenantAccountOperationPayload(input.payload);
  if (!parsed.ok) return { status: 'validation_error', errors: parsed.errors };

  const account = await input.repository.findInitialAdminAccountByTenantId(input.tenantId);
  if (!account) return { status: 'not_found', errorCode: 'TENANT_ACCOUNT_NOT_FOUND' };

  const current = nowDate(input.now);
  const idFactory = input.idFactory ?? defaultIdFactory;
  const auditEventId = idFactory('audit-event');
  const baseOperation = {
    action: parsed.action,
    account,
    lockedUntil: null,
    updatedAt: current,
    updatedBy: input.actorId,
    auditEvent: buildAuditEvent({
      action: parsed.action,
      actorId: input.actorId,
      actorRole: input.actorRole,
      auditEventId,
      tenantId: input.tenantId,
      tenantMemberId: account.tenantMemberId,
      occurredAt: current,
    }),
  };

  if (parsed.action === 'reset_password') {
    const passwordHasher = input.passwordHasher ?? { hash: hashPasswordScrypt };
    const passwordHash = await passwordHasher.hash(parsed.newPassword);
    return input.repository.applyTenantAccountOperation({
      ...baseOperation,
      nextStatus: 'password_reset_required',
      passwordResetRequired: true,
      passwordHash,
      passwordUpdatedAt: current,
    });
  }

  return input.repository.applyTenantAccountOperation({
    ...baseOperation,
    nextStatus: parsed.action === 'disable' ? 'disabled' : 'active',
    passwordResetRequired: account.passwordResetRequired,
  });
}
