import { randomUUID } from 'node:crypto';

import {
  normalizeAuthUsername,
  type AuthAccountRecord,
  type AuthTenantMembershipRecord,
} from '@/modules/auth/domain/auth-account';
import { hashPasswordScrypt } from '@/modules/auth/server/password-hash';
import type { AuthAccountPasswordHasher } from '@/modules/auth/server/auth-account-service';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { TenantManagementListItem } from '@/modules/open-platform/domain/tenant-management';
import {
  buildOpeningContactSnapshot,
  buildAuthorizationSnapshotPayload,
  buildSecurityBoundarySnapshot,
  calculateTrialExpiresAt,
  isTrialPlanVersion,
  mapPublishedPlanVersionToOption,
  parseCreateTenantWithPlanPayload,
  type TenantPlanPublishedVersionRecord,
} from '@/modules/open-platform/domain/tenant-plan-binding';

type TenantContactRecord = {
  id: string;
  tenantId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  initialAdminUserId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantPlanBindingRepository = {
  listPublishedPlanVersions(): Promise<TenantPlanPublishedVersionRecord[]>;
  findPublishedPlanVersionById(versionId: string): Promise<TenantPlanPublishedVersionRecord | null>;
  createTenantWithPlanAuthorization(input: {
    planVersion: TenantPlanPublishedVersionRecord;
    tenant: {
      id: string;
      name: string;
      status: 'active' | 'trialing';
      createdAt: Date;
      updatedAt: Date;
    };
    authAccount: AuthAccountRecord;
    tenantMember: AuthTenantMembershipRecord;
    tenantContact: TenantContactRecord;
    assignment: {
      id: string;
      tenantId: string;
      planId: string;
      planVersionId: string;
      status: 'active';
      startedAt: Date;
      expiresAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };
    authorizationSnapshot: {
      id: string;
      tenantId: string;
      planAssignmentId: string;
      planVersionId: string;
      status: 'active';
      snapshotJson: Record<string, unknown>;
      quotaJson: Record<string, unknown>;
      connectorJson: Record<string, unknown>;
      serviceJson: Record<string, unknown>;
      sourceChangeRecordId: null;
      generatedBy: string;
      generatedAt: Date;
      supersededAt: null;
      createdAt: Date;
    };
    auditEvent: TenantAuditEvent;
    accountAuditEvent: TenantAuditEvent;
  }): Promise<TenantManagementListItem>;
};

type IdFactory = (prefix: string) => string;
type PasswordHasher = Pick<AuthAccountPasswordHasher, 'hash'>;

function defaultIdFactory(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 12)}`;
}

function defaultTemporaryPasswordFactory() {
  return randomUUID();
}

function nowDate(input?: () => Date) {
  return input ? input() : new Date();
}

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function parseAdminContact(input: {
  adminContact?: string;
  contactPhone?: string;
  contactEmail?: string;
}) {
  const adminContact = optionalText(input.adminContact);

  if (!adminContact) {
    const contactPhone = optionalText(input.contactPhone);
    const contactEmail = optionalText(input.contactEmail);
    return { phone: contactPhone, email: contactEmail };
  }

  if (adminContact.includes('@')) {
    return { phone: null, email: adminContact };
  }

  return { phone: adminContact, email: null };
}

export async function listTenantPlanOptionsService(input: {
  repository: TenantPlanBindingRepository;
}) {
  const records = await input.repository.listPublishedPlanVersions();
  return {
    options: records.map(mapPublishedPlanVersionToOption),
  };
}

export async function createTenantWithPlanService(input: {
  repository: TenantPlanBindingRepository;
  actorId: string;
  actorRole: TenantAuditEvent['actorRole'];
  auditSource: TenantAuditEvent['source'];
  payload: unknown;
  now?: () => Date;
  idFactory?: IdFactory;
  passwordHasher?: PasswordHasher;
  temporaryPasswordFactory?: () => string;
}) {
  const parsed = parseCreateTenantWithPlanPayload(input.payload);
  if (!parsed.ok) {
    return { status: 'validation_error' as const, errors: parsed.errors };
  }

  const planVersion = await input.repository.findPublishedPlanVersionById(parsed.value.planVersionId);
  if (!planVersion) {
    return { status: 'not_found' as const, errorCode: 'PUBLISHED_PLAN_VERSION_NOT_FOUND' };
  }

  const current = nowDate(input.now);
  const idFactory = input.idFactory ?? defaultIdFactory;
  const tenantId = idFactory('tenant');
  const authUserId = idFactory('auth-user');
  const tenantMemberId = idFactory('tenant-member');
  const tenantContactId = idFactory('tenant-contact');
  const assignmentId = idFactory('tenant-plan-assignment');
  const snapshotId = idFactory('tenant-authorization-snapshot');
  const auditEventId = idFactory('audit-event');
  const accountAuditEventId = idFactory('audit-event-account');
  const snapshotPayload = buildAuthorizationSnapshotPayload(planVersion);
  const isTrial = isTrialPlanVersion(planVersion);
  const expiresAt = isTrial ? calculateTrialExpiresAt(current) : null;
  const openingContact = buildOpeningContactSnapshot(parsed.value);
  const adminDisplayName = parsed.value.adminName ?? parsed.value.contactName ?? parsed.value.tenantName;
  const adminUsername = normalizeAuthUsername(parsed.value.adminAccount ?? `${tenantId}-admin`);
  const adminContact = parseAdminContact(parsed.value);
  const contactName = parsed.value.contactName ?? adminDisplayName;
  const contactPhone = parsed.value.contactPhone ?? adminContact.phone ?? '';
  const passwordHasher = input.passwordHasher ?? { hash: hashPasswordScrypt };
  const passwordToHash = parsed.value.initialPassword ?? (input.temporaryPasswordFactory ?? defaultTemporaryPasswordFactory)();
  const passwordHash = await passwordHasher.hash(passwordToHash);
  const snapshotJson: Record<string, unknown> = {
    ...snapshotPayload.snapshotJson,
    ...(expiresAt
      ? {
          trialPeriod: {
            startedAt: current.toISOString(),
            expiresAt: expiresAt.toISOString(),
            durationDays: 10,
          },
        }
      : {}),
    ...(openingContact ? { openingContact } : {}),
    securityBoundary: buildSecurityBoundarySnapshot(),
  };
  const tenant = await input.repository.createTenantWithPlanAuthorization({
    planVersion,
    tenant: {
      id: tenantId,
      name: parsed.value.tenantName,
      status: isTrial ? 'trialing' : 'active',
      createdAt: current,
      updatedAt: current,
    },
    authAccount: {
      id: authUserId,
      username: adminUsername,
      displayName: adminDisplayName,
      phone: adminContact.phone,
      email: adminContact.email,
      passwordHash,
      passwordUpdatedAt: current,
      passwordResetRequired: true,
      status: 'password_reset_required',
      lastLoginAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      createdBy: input.actorId,
      updatedBy: input.actorId,
      createdAt: current,
      updatedAt: current,
    },
    tenantMember: {
      id: tenantMemberId,
      tenantId,
      userId: authUserId,
      role: 'tenant_admin',
      displayName: adminDisplayName,
      createdAt: current,
      updatedAt: current,
    },
    tenantContact: {
      id: tenantContactId,
      tenantId,
      contactName,
      contactPhone,
      contactEmail: optionalText(parsed.value.contactEmail),
      initialAdminUserId: authUserId,
      createdBy: input.actorId,
      updatedBy: input.actorId,
      createdAt: current,
      updatedAt: current,
    },
    assignment: {
      id: assignmentId,
      tenantId,
      planId: planVersion.planId,
      planVersionId: planVersion.versionId,
      status: 'active',
      startedAt: current,
      expiresAt,
      createdAt: current,
      updatedAt: current,
    },
    authorizationSnapshot: {
      id: snapshotId,
      tenantId,
      planAssignmentId: assignmentId,
      planVersionId: planVersion.versionId,
      status: 'active',
      snapshotJson,
      quotaJson: snapshotPayload.quotaJson,
      connectorJson: snapshotPayload.connectorJson,
      serviceJson: snapshotPayload.serviceJson,
      sourceChangeRecordId: null,
      generatedBy: input.actorId,
      generatedAt: current,
      supersededAt: null,
      createdAt: current,
    },
    auditEvent: {
      eventId: auditEventId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      tenantId,
      scope: 'platform',
      resource: 'tenant',
      resourceId: tenantId,
      action: 'create',
      result: 'allowed',
      reason: 'tenant_plan_assignment_created',
      occurredAt: current.toISOString(),
      source: input.auditSource,
    },
    accountAuditEvent: {
      eventId: accountAuditEventId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      tenantId,
      scope: 'platform',
      resource: 'tenant_member',
      resourceId: tenantMemberId,
      action: 'create',
      result: 'allowed',
      reason: 'tenant_account_created',
      occurredAt: current.toISOString(),
      source: input.auditSource,
    },
  });

  return {
    status: 'tenant_created' as const,
    tenant,
  };
}
