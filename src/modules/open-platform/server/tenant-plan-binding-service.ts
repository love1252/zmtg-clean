import { randomUUID } from 'node:crypto';

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

export type TenantPlanBindingRepository = {
  listPublishedPlanVersions(): Promise<TenantPlanPublishedVersionRecord[]>;
  findPublishedPlanVersionById(versionId: string): Promise<TenantPlanPublishedVersionRecord | null>;
  createTenantWithPlanAuthorization(input: {
    planVersion: TenantPlanPublishedVersionRecord;
    tenant: {
      id: string;
      name: string;
      status: 'active';
      createdAt: Date;
      updatedAt: Date;
    };
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
  }): Promise<TenantManagementListItem>;
};

type IdFactory = (prefix: string) => string;

function defaultIdFactory(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 12)}`;
}

function nowDate(input?: () => Date) {
  return input ? input() : new Date();
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
  const assignmentId = idFactory('tenant-plan-assignment');
  const snapshotId = idFactory('tenant-authorization-snapshot');
  const auditEventId = idFactory('audit-event');
  const snapshotPayload = buildAuthorizationSnapshotPayload(planVersion);
  const expiresAt = isTrialPlanVersion(planVersion) ? calculateTrialExpiresAt(current) : null;
  const openingContact = buildOpeningContactSnapshot(parsed.value);
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
      status: 'active',
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
  });

  return {
    status: 'tenant_created' as const,
    tenant,
  };
}
