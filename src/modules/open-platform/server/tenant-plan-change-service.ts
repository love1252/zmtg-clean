import { randomUUID } from 'node:crypto';

import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import {
  normalizeTenantOpeningContact,
  type TenantManagementListItem,
} from '@/modules/open-platform/domain/tenant-management';
import {
  buildTenantPlanChangePreview,
  parseTenantPlanChangePayload,
  type TenantPlanChangePreview,
} from '@/modules/open-platform/domain/tenant-plan-change';
import {
  buildAuthorizationSnapshotPayload,
  buildSecurityBoundarySnapshot,
  type TenantPlanPublishedVersionRecord,
} from '@/modules/open-platform/domain/tenant-plan-binding';
import type { AccessRole } from '@/modules/security/domain/access-control';

export type TenantCurrentPlanStateRecord = {
  tenant: {
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  assignment: {
    id: string;
    tenantId: string;
    planId: string;
    planVersionId: string | null;
    status: string;
    startedAt: Date;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  planVersion: TenantPlanPublishedVersionRecord;
  authorizationSnapshot: {
    id: string;
    tenantId: string;
    planAssignmentId: string;
    planVersionId: string;
    status: string;
    snapshotJson: Record<string, unknown>;
    generatedAt: Date;
  };
};

export type TenantPlanChangeApplyInput = {
  tenant: TenantCurrentPlanStateRecord['tenant'];
  currentAssignment: TenantCurrentPlanStateRecord['assignment'];
  currentAuthorizationSnapshot: TenantCurrentPlanStateRecord['authorizationSnapshot'];
  toPlanVersion: TenantPlanPublishedVersionRecord;
  newAssignment: {
    id: string;
    tenantId: string;
    planId: string;
    planVersionId: string;
    status: 'active';
    startedAt: Date;
    expiresAt: null;
    createdAt: Date;
    updatedAt: Date;
  };
  newAuthorizationSnapshot: {
    id: string;
    tenantId: string;
    planAssignmentId: string;
    planVersionId: string;
    status: 'active';
    snapshotJson: Record<string, unknown>;
    quotaJson: Record<string, unknown>;
    connectorJson: Record<string, unknown>;
    serviceJson: Record<string, unknown>;
    sourceChangeRecordId: string;
    generatedBy: string;
    generatedAt: Date;
    supersededAt: null;
    createdAt: Date;
  };
  changeRecord: {
    id: string;
    tenantId: string;
    fromPlanVersionId: string | null;
    toPlanVersionId: string;
    fromSnapshotId: string | null;
    toSnapshotId: string;
    status: 'applied';
    diffJson: Record<string, unknown>;
    reason: string;
    requestedBy: string;
    appliedBy: string;
    appliedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  auditEvent: TenantAuditEvent;
  appliedAt: Date;
};

export type TenantPlanChangeRepository = {
  findCurrentTenantPlanState(tenantId: string): Promise<TenantCurrentPlanStateRecord | null>;
  findPublishedPlanVersionById(versionId: string): Promise<TenantPlanPublishedVersionRecord | null>;
  applyTenantPlanChange(input: TenantPlanChangeApplyInput): Promise<{
    status: 'plan_changed';
    changeRecordId: string;
    auditEventId: string;
    tenant: TenantManagementListItem;
  }>;
};

type IdFactory = (prefix: string) => string;

type TenantPlanChangeServiceResult =
  | { status: 'validation_error'; errors: string[] }
  | { status: 'not_found'; errorCode: 'CURRENT_PLAN_NOT_FOUND' | 'PUBLISHED_PLAN_VERSION_NOT_FOUND' }
  | { status: 'invalid_transition'; errorCode: 'SAME_PLAN_VERSION' }
  | { status: 'preview_ready'; preview: TenantPlanChangePreview }
  | {
      status: 'plan_changed';
      changeRecordId: string;
      auditEventId: string;
      tenant: TenantManagementListItem;
    };

function defaultIdFactory(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 12)}`;
}

function nowDate(input?: () => Date) {
  return input ? input() : new Date();
}

async function buildPreview(input: {
  repository: TenantPlanChangeRepository;
  tenantId: string;
  payload: unknown;
}): Promise<
  | { ok: true; currentState: TenantCurrentPlanStateRecord; toPlanVersion: TenantPlanPublishedVersionRecord; preview: TenantPlanChangePreview; reason: string }
  | Exclude<TenantPlanChangeServiceResult, { status: 'preview_ready' | 'plan_changed' }>
> {
  const parsed = parseTenantPlanChangePayload(input.payload);
  if (!parsed.ok) return { status: 'validation_error', errors: parsed.errors };

  const currentState = await input.repository.findCurrentTenantPlanState(input.tenantId);
  if (!currentState) return { status: 'not_found', errorCode: 'CURRENT_PLAN_NOT_FOUND' };

  const toPlanVersion = await input.repository.findPublishedPlanVersionById(
    parsed.value.toPlanVersionId,
  );
  if (!toPlanVersion) return { status: 'not_found', errorCode: 'PUBLISHED_PLAN_VERSION_NOT_FOUND' };
  if (currentState.planVersion.versionId === toPlanVersion.versionId) {
    return { status: 'invalid_transition', errorCode: 'SAME_PLAN_VERSION' };
  }

  return {
    ok: true,
    currentState,
    toPlanVersion,
    reason: parsed.value.reason,
    preview: buildTenantPlanChangePreview({
      tenantId: input.tenantId,
      fromPlanVersion: currentState.planVersion,
      toPlanVersion,
    }),
  };
}

export async function previewTenantPlanChangeService(input: {
  repository: TenantPlanChangeRepository;
  tenantId: string;
  payload: unknown;
}): Promise<TenantPlanChangeServiceResult> {
  const preview = await buildPreview(input);
  if (!('ok' in preview)) return preview;

  return {
    status: 'preview_ready',
    preview: preview.preview,
  };
}

export async function applyTenantPlanChangeService(input: {
  repository: TenantPlanChangeRepository;
  actorId: string;
  actorRole: AccessRole;
  tenantId: string;
  payload: unknown;
  now?: () => Date;
  idFactory?: IdFactory;
}): Promise<TenantPlanChangeServiceResult> {
  const preview = await buildPreview(input);
  if (!('ok' in preview)) return preview;

  const current = nowDate(input.now);
  const idFactory = input.idFactory ?? defaultIdFactory;
  const assignmentId = idFactory('tenant-plan-assignment');
  const snapshotId = idFactory('tenant-authorization-snapshot');
  const changeRecordId = idFactory('tenant-plan-change');
  const auditEventId = idFactory('audit-event');
  const snapshotPayload = buildAuthorizationSnapshotPayload(preview.toPlanVersion);
  const currentSnapshotJson = preview.currentState.authorizationSnapshot.snapshotJson;
  const preservedOpeningContact = normalizeTenantOpeningContact(currentSnapshotJson.openingContact);
  const preservedSnapshotJson = {
    ...snapshotPayload.snapshotJson,
    ...(preservedOpeningContact ? { openingContact: preservedOpeningContact } : {}),
    securityBoundary: buildSecurityBoundarySnapshot(),
  };
  const currentAuthorizationSnapshotForWrite = {
    ...preview.currentState.authorizationSnapshot,
    snapshotJson: preservedOpeningContact ? { openingContact: preservedOpeningContact } : {},
  };

  return input.repository.applyTenantPlanChange({
    tenant: preview.currentState.tenant,
    currentAssignment: preview.currentState.assignment,
    currentAuthorizationSnapshot: currentAuthorizationSnapshotForWrite,
    toPlanVersion: preview.toPlanVersion,
    newAssignment: {
      id: assignmentId,
      tenantId: input.tenantId,
      planId: preview.toPlanVersion.planId,
      planVersionId: preview.toPlanVersion.versionId,
      status: 'active',
      startedAt: current,
      expiresAt: null,
      createdAt: current,
      updatedAt: current,
    },
    newAuthorizationSnapshot: {
      id: snapshotId,
      tenantId: input.tenantId,
      planAssignmentId: assignmentId,
      planVersionId: preview.toPlanVersion.versionId,
      status: 'active',
      snapshotJson: preservedSnapshotJson,
      quotaJson: snapshotPayload.quotaJson,
      connectorJson: snapshotPayload.connectorJson,
      serviceJson: snapshotPayload.serviceJson,
      sourceChangeRecordId: changeRecordId,
      generatedBy: input.actorId,
      generatedAt: current,
      supersededAt: null,
      createdAt: current,
    },
    changeRecord: {
      id: changeRecordId,
      tenantId: input.tenantId,
      fromPlanVersionId: preview.currentState.planVersion.versionId,
      toPlanVersionId: preview.toPlanVersion.versionId,
      fromSnapshotId: preview.currentState.authorizationSnapshot.id,
      toSnapshotId: snapshotId,
      status: 'applied',
      diffJson: preview.preview,
      reason: preview.reason,
      requestedBy: input.actorId,
      appliedBy: input.actorId,
      appliedAt: current,
      createdAt: current,
      updatedAt: current,
    },
    auditEvent: {
      eventId: auditEventId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      tenantId: input.tenantId,
      scope: 'platform',
      resource: 'tenant',
      resourceId: input.tenantId,
      action: 'manage_status',
      result: 'transitioned',
      reason: 'tenant_plan_changed',
      occurredAt: current.toISOString(),
      source: 'server_session',
    },
    appliedAt: current,
  });
}
