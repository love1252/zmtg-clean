import { NextResponse } from 'next/server';
import { createDeniedAccessAuditEvent } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  createHisConnectionRepository,
  type HisConnectionReadModel,
} from '@/modules/institution/server/his-connection-repository';
import { parseUpdateHisConnectionInput } from '@/modules/institution/server/his-connection-write-input';
import {
  softDeleteHisConnectionForTenantService,
  type HisConnectionStatusServiceResult,
} from '@/modules/institution/server/his-connection-status-service';
import {
  updateHisConnectionForTenantService,
  type UpdateHisConnectionForTenantServiceResult,
} from '@/modules/institution/server/his-connection-write-service';
import {
  canAccessResource,
  type AccessContext,
  type AccessDecision,
} from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type HisConnectionDetailRouteContext = {
  params: Promise<{ connectionId: string }>;
};

type HisConnectionApiDto = {
  connectionId: string;
  connectionName: string;
  sourceSystem: string;
  vendorType: string;
  systemType: string;
  status: HisConnectionReadModel['status'];
  credentialConfigured: boolean;
  healthStatus: HisConnectionReadModel['healthStatus'];
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

type AccessDeniedReason = Extract<AccessDecision, { allowed: false }>['reason'];
type HisConnectionRouteDeniedReason = AccessDeniedReason | 'invalid_his_connection_payload';
type StatusRouteInput = {
  reasonCode?: string;
};

async function getConnectionId(context: HisConnectionDetailRouteContext) {
  const params = await context.params;
  return params.connectionId.trim();
}

function canReadHisConnections(
  context: AccessContext,
): context is AccessContext & { tenantId: string } {
  const decision = canAccessResource({
    context,
    resource: 'open_connection',
    action: 'read_own_tenant',
    targetTenantId: context.tenantId,
  });

  return decision.allowed && Boolean(context.tenantId);
}

function getUpdateHisConnectionDeniedReason(
  context: AccessContext,
): HisConnectionRouteDeniedReason | null {
  const decision = canAccessResource({
    context,
    resource: 'open_connection',
    action: 'update',
    targetTenantId: context.tenantId,
  });

  if (!decision.allowed) {
    return decision.reason;
  }

  return context.tenantId ? null : 'missing_tenant';
}

function getDeleteHisConnectionDeniedReason(
  context: AccessContext,
): AccessDeniedReason | null {
  const decision = canAccessResource({
    context,
    resource: 'open_connection',
    action: 'delete',
    targetTenantId: context.tenantId,
  });

  if (!decision.allowed) {
    return decision.reason;
  }

  return context.tenantId ? null : 'missing_tenant';
}

function isVisibleToTenant(record: HisConnectionReadModel, tenantId: string) {
  return record.tenantId === tenantId && record.deletedAt === null;
}

function mapHisConnectionToApiDto(record: HisConnectionReadModel): HisConnectionApiDto {
  return {
    connectionId: record.connectionId,
    connectionName: record.connectionName,
    sourceSystem: record.sourceSystem,
    vendorType: record.vendorType,
    systemType: record.systemType,
    status: record.status,
    credentialConfigured: record.credentialConfigured,
    healthStatus: record.healthStatus,
    lastCheckedAt: record.lastCheckedAt,
    lastErrorCode: record.lastErrorCode,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    revokedAt: record.revokedAt,
  };
}

function unauthorizedResponse() {
  return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
}

function notFoundResponse() {
  return NextResponse.json({ code: 'not_found', error: '记录不存在' }, { status: 404 });
}

function serviceUnavailableResponse() {
  return NextResponse.json(
    { code: 'service_unavailable', error: '数据服务暂时不可用' },
    { status: 503 },
  );
}

function validationFailedResponse() {
  return NextResponse.json(
    { code: 'validation_failed', error: '请求格式不正确' },
    { status: 400 },
  );
}

function conflictResponse() {
  return NextResponse.json({ code: 'conflict', error: '连接名称已存在' }, { status: 409 });
}

function statusConflictResponse(code: 'conflict' | 'invalid_transition') {
  return NextResponse.json(
    { code, error: '当前状态不允许执行该操作' },
    { status: 409 },
  );
}

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

async function readStatusJson(request: Request): Promise<
  | { ok: true; value: StatusRouteInput }
  | { ok: false }
> {
  if (request.body === null) {
    return { ok: true, value: {} };
  }

  try {
    const value: unknown = await request.json();

    if (!isJsonObject(value)) {
      return { ok: false };
    }

    const keys = Object.keys(value);
    if (keys.some((key) => key !== 'reasonCode')) {
      return { ok: false };
    }

    if (value.reasonCode === undefined) {
      return { ok: true, value: {} };
    }

    if (typeof value.reasonCode !== 'string') {
      return { ok: false };
    }

    const reasonCode = value.reasonCode.trim();
    return {
      ok: true,
      value: reasonCode.length > 0 ? { reasonCode } : {},
    };
  } catch {
    return { ok: false };
  }
}

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

async function recordHisConnectionRouteDeniedAudit(input: {
  accessContext: AccessContext;
  connectionId: string;
  action: 'update' | 'delete';
  reason: HisConnectionRouteDeniedReason;
}) {
  try {
    const auditRepository = createAuditEventRepository(getDatabase());
    await auditRepository.record(
      createDeniedAccessAuditEvent({
        eventId: createAuditEventId(),
        context: input.accessContext,
        resource: 'open_connection',
        resourceId: input.connectionId,
        action: input.action,
        reason: input.reason,
        occurredAt: new Date().toISOString(),
      }),
    );

    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

function mapUpdateServiceResultToResponse(result: UpdateHisConnectionForTenantServiceResult) {
  switch (result.status) {
    case 'updated':
      return NextResponse.json(result.dto);
    case 'validation_failed':
      return validationFailedResponse();
    case 'conflict':
      return conflictResponse();
    case 'not_found':
      return notFoundResponse();
    case 'service_unavailable':
      return serviceUnavailableResponse();
  }
}

function mapSoftDeleteServiceResultToResponse(result: HisConnectionStatusServiceResult) {
  switch (result.status) {
    case 'deleted':
      return NextResponse.json(result.dto);
    case 'validation_failed':
      return validationFailedResponse();
    case 'not_found':
      return notFoundResponse();
    case 'conflict':
      return statusConflictResponse('conflict');
    case 'invalid_transition':
      return statusConflictResponse('invalid_transition');
    case 'service_unavailable':
    case 'paused':
    case 'resumed':
    case 'revoked':
      return serviceUnavailableResponse();
  }
}

export async function GET(request: Request, context: HisConnectionDetailRouteContext) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return unauthorizedResponse();
  }

  if (!canReadHisConnections(accessContext)) {
    return forbiddenResponse();
  }

  const connectionId = await getConnectionId(context);
  if (!connectionId) {
    return notFoundResponse();
  }

  try {
    const repository = createHisConnectionRepository(getDatabase());
    const record = await repository.getHisConnectionByTenant({
      tenantId: accessContext.tenantId,
      connectionId,
    });

    if (!record || !isVisibleToTenant(record, accessContext.tenantId)) {
      return notFoundResponse();
    }

    return NextResponse.json({ record: mapHisConnectionToApiDto(record) });
  } catch {
    return serviceUnavailableResponse();
  }
}

export async function DELETE(request: Request, context: HisConnectionDetailRouteContext) {
  const connectionId = await getConnectionId(context);
  if (!connectionId) {
    return notFoundResponse();
  }

  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return unauthorizedResponse();
  }

  const deleteDeniedReason = getDeleteHisConnectionDeniedReason(accessContext);
  if (deleteDeniedReason) {
    const auditResult = await recordHisConnectionRouteDeniedAudit({
      accessContext,
      connectionId,
      action: 'delete',
      reason: deleteDeniedReason,
    });
    if (!auditResult.ok) {
      return serviceUnavailableResponse();
    }

    return forbiddenResponse();
  }

  const parsed = await readStatusJson(request);
  if (!parsed.ok) {
    return validationFailedResponse();
  }

  try {
    const result = await softDeleteHisConnectionForTenantService({
      accessContext,
      connectionId,
      database: getDatabase(),
      ...(parsed.value.reasonCode === undefined ? {} : { reasonCode: parsed.value.reasonCode }),
    });

    return mapSoftDeleteServiceResultToResponse(result);
  } catch {
    return serviceUnavailableResponse();
  }
}

export async function PATCH(request: Request, context: HisConnectionDetailRouteContext) {
  const connectionId = await getConnectionId(context);
  if (!connectionId) {
    return notFoundResponse();
  }

  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return unauthorizedResponse();
  }

  const deniedReason = getUpdateHisConnectionDeniedReason(accessContext);
  if (deniedReason) {
    const auditResult = await recordHisConnectionRouteDeniedAudit({
      accessContext,
      connectionId,
      action: 'update',
      reason: deniedReason,
    });
    if (!auditResult.ok) {
      return serviceUnavailableResponse();
    }

    return forbiddenResponse();
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    const auditResult = await recordHisConnectionRouteDeniedAudit({
      accessContext,
      connectionId,
      action: 'update',
      reason: 'invalid_his_connection_payload',
    });
    if (!auditResult.ok) {
      return serviceUnavailableResponse();
    }

    return validationFailedResponse();
  }

  const parsed = parseUpdateHisConnectionInput(body.value);
  if (!parsed.ok) {
    const auditResult = await recordHisConnectionRouteDeniedAudit({
      accessContext,
      connectionId,
      action: 'update',
      reason: 'invalid_his_connection_payload',
    });
    if (!auditResult.ok) {
      return serviceUnavailableResponse();
    }

    return validationFailedResponse();
  }

  try {
    const result = await updateHisConnectionForTenantService({
      accessContext,
      connectionId,
      database: getDatabase(),
      metadata: parsed.value,
    });

    return mapUpdateServiceResultToResponse(result);
  } catch {
    return serviceUnavailableResponse();
  }
}
