import { NextResponse } from 'next/server';
import { createDeniedAccessAuditEvent } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  revokeHisConnectionForTenantService,
  type HisConnectionStatusServiceResult,
} from '@/modules/institution/server/his-connection-status-service';
import {
  canAccessResource,
  type AccessContext,
  type AccessDecision,
} from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type HisConnectionStatusRouteContext = {
  params: Promise<{ connectionId: string }>;
};

type StatusRouteInput = {
  reasonCode?: string;
};

type AccessDeniedReason = Extract<AccessDecision, { allowed: false }>['reason'];

async function getConnectionId(context: HisConnectionStatusRouteContext) {
  const params = await context.params;
  return params.connectionId.trim();
}

function getManageStatusDeniedReason(context: AccessContext): AccessDeniedReason | null {
  const decision = canAccessResource({
    context,
    resource: 'open_connection',
    action: 'manage_status',
    targetTenantId: context.tenantId,
  });

  if (!decision.allowed) {
    return decision.reason;
  }

  return context.tenantId ? null : 'missing_tenant';
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

function unauthorizedResponse() {
  return NextResponse.json({ code: 'unauthorized', error: '请先登录' }, { status: 401 });
}

function forbiddenResponse() {
  return NextResponse.json({ code: 'forbidden', error: '没有访问权限' }, { status: 403 });
}

function notFoundResponse() {
  return NextResponse.json({ code: 'not_found', error: '记录不存在' }, { status: 404 });
}

function validationFailedResponse() {
  return NextResponse.json(
    { code: 'validation_failed', error: '请求格式不正确' },
    { status: 400 },
  );
}

function conflictResponse(code: 'conflict' | 'invalid_transition') {
  return NextResponse.json(
    { code, error: '当前状态不允许执行该操作' },
    { status: 409 },
  );
}

function serviceUnavailableResponse() {
  return NextResponse.json(
    { code: 'service_unavailable', error: '数据服务暂时不可用' },
    { status: 503 },
  );
}

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

async function recordStatusRouteDeniedAudit(input: {
  accessContext: AccessContext;
  connectionId: string;
  reason: AccessDeniedReason;
}) {
  try {
    const auditRepository = createAuditEventRepository(getDatabase());
    await auditRepository.record(
      createDeniedAccessAuditEvent({
        eventId: createAuditEventId(),
        context: input.accessContext,
        resource: 'open_connection',
        resourceId: input.connectionId,
        action: 'manage_status',
        reason: input.reason,
        occurredAt: new Date().toISOString(),
      }),
    );

    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

function mapRevokeServiceResultToResponse(result: HisConnectionStatusServiceResult) {
  switch (result.status) {
    case 'revoked':
      return NextResponse.json(result.dto);
    case 'validation_failed':
      return validationFailedResponse();
    case 'not_found':
      return notFoundResponse();
    case 'conflict':
      return conflictResponse('conflict');
    case 'invalid_transition':
      return conflictResponse('invalid_transition');
    case 'service_unavailable':
    case 'paused':
    case 'resumed':
    case 'deleted':
      return serviceUnavailableResponse();
  }
}

export async function POST(request: Request, context: HisConnectionStatusRouteContext) {
  const connectionId = await getConnectionId(context);
  if (!connectionId) {
    return notFoundResponse();
  }

  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return unauthorizedResponse();
  }

  const deniedReason = getManageStatusDeniedReason(accessContext);
  if (deniedReason) {
    const auditResult = await recordStatusRouteDeniedAudit({
      accessContext,
      connectionId,
      reason: deniedReason,
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
    const result = await revokeHisConnectionForTenantService({
      accessContext,
      connectionId,
      database: getDatabase(),
      ...(parsed.value.reasonCode === undefined ? {} : { reasonCode: parsed.value.reasonCode }),
    });

    return mapRevokeServiceResultToResponse(result);
  } catch {
    return serviceUnavailableResponse();
  }
}
