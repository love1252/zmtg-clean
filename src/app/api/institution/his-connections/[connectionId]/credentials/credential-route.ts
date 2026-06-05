import { NextResponse } from 'next/server';
import { createDeniedAccessAuditEvent } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  mapHisConnectionCredentialErrorToDto,
  type HisConnectionCredentialErrorCode,
} from '@/modules/institution/server/his-connection-credential-dto';
import {
  parseClearHisConnectionCredentialInput,
  parseCreateHisConnectionCredentialInput,
  parseRevokeHisConnectionCredentialInput,
  parseRotateHisConnectionCredentialInput,
  parseUpdateHisConnectionCredentialInput,
  type HisConnectionCredentialMutationInput,
  type HisConnectionCredentialReasonInput,
} from '@/modules/institution/server/his-connection-credential-input';
import {
  clearHisConnectionCredentialForTenantService,
  createHisConnectionCredentialForTenantService,
  revokeHisConnectionCredentialForTenantService,
  rotateHisConnectionCredentialForTenantService,
  type HisConnectionCredentialServiceResult,
  updateHisConnectionCredentialForTenantService,
} from '@/modules/institution/server/his-connection-credential-service';
import { createInMemoryHisConnectionCredentialStorage } from '@/modules/institution/server/his-connection-credential-storage';
import {
  canAccessResource,
  type AccessContext,
  type AccessDecision,
} from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

export type HisConnectionCredentialRouteContext = {
  params: Promise<{ connectionId: string }>;
};

type AccessDeniedReason = Extract<AccessDecision, { allowed: false }>['reason'];
type CredentialRouteDeniedReason = AccessDeniedReason | 'invalid_his_connection_payload';
type ParseResult<T> = { ok: true; value: T } | { ok: false; error: 'validation_failed' };

type MutationRouteConfig = {
  parser: (input: unknown) => ParseResult<HisConnectionCredentialMutationInput>;
  service:
    | typeof createHisConnectionCredentialForTenantService
    | typeof updateHisConnectionCredentialForTenantService
    | typeof rotateHisConnectionCredentialForTenantService;
  successStatus: 200 | 201;
};

type ReasonRouteConfig = {
  parser: (input: unknown) => ParseResult<HisConnectionCredentialReasonInput>;
  service:
    | typeof clearHisConnectionCredentialForTenantService
    | typeof revokeHisConnectionCredentialForTenantService;
};

const credentialStorage = createInMemoryHisConnectionCredentialStorage();

export const credentialRouteConfigs = {
  create: {
    parser: parseCreateHisConnectionCredentialInput,
    service: createHisConnectionCredentialForTenantService,
    successStatus: 201,
  },
  update: {
    parser: parseUpdateHisConnectionCredentialInput,
    service: updateHisConnectionCredentialForTenantService,
    successStatus: 200,
  },
  rotate: {
    parser: parseRotateHisConnectionCredentialInput,
    service: rotateHisConnectionCredentialForTenantService,
    successStatus: 200,
  },
  clear: {
    parser: parseClearHisConnectionCredentialInput,
    service: clearHisConnectionCredentialForTenantService,
  },
  revoke: {
    parser: parseRevokeHisConnectionCredentialInput,
    service: revokeHisConnectionCredentialForTenantService,
  },
} satisfies {
  create: MutationRouteConfig;
  update: MutationRouteConfig;
  rotate: MutationRouteConfig;
  clear: ReasonRouteConfig;
  revoke: ReasonRouteConfig;
};

async function getConnectionId(context: HisConnectionCredentialRouteContext) {
  const params = await context.params;
  return params.connectionId.trim();
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

function credentialErrorResponse(code: HisConnectionCredentialErrorCode, status: number) {
  return NextResponse.json(mapHisConnectionCredentialErrorToDto(code), { status });
}

function validationFailedResponse() {
  return credentialErrorResponse('validation_failed', 400);
}

function invalidStateTransitionResponse() {
  return credentialErrorResponse('invalid_state_transition', 409);
}

function serviceUnavailableResponse() {
  return credentialErrorResponse('service_unavailable', 503);
}

function getManageCredentialsDeniedReason(context: AccessContext): AccessDeniedReason | null {
  const decision = canAccessResource({
    context,
    resource: 'open_connection',
    action: 'manage_credentials',
    targetTenantId: context.tenantId,
  });

  if (!decision.allowed) {
    return decision.reason;
  }

  return context.tenantId ? null : 'missing_tenant';
}

async function readJsonBody(request: Request) {
  if (request.body === null) {
    return { ok: true as const, value: {} };
  }

  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

async function recordCredentialRouteDeniedAudit(input: {
  accessContext: AccessContext;
  connectionId: string;
  reason: CredentialRouteDeniedReason;
}) {
  try {
    const auditRepository = createAuditEventRepository(getDatabase());
    await auditRepository.record(
      createDeniedAccessAuditEvent({
        eventId: createAuditEventId(),
        context: input.accessContext,
        resource: 'open_connection',
        resourceId: input.connectionId,
        action: 'manage_credentials',
        reason: input.reason,
        occurredAt: new Date().toISOString(),
      }),
    );

    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

function mapServiceResultToResponse(
  result: HisConnectionCredentialServiceResult,
  successStatus: 200 | 201,
) {
  switch (result.status) {
    case 'created':
    case 'updated':
    case 'rotated':
    case 'cleared':
    case 'revoked':
      return NextResponse.json(result.dto, { status: successStatus });
    case 'validation_failed':
      return validationFailedResponse();
    case 'not_found':
      return credentialErrorResponse('not_found', 404);
    case 'invalid_state_transition':
      return invalidStateTransitionResponse();
    case 'service_unavailable':
      return serviceUnavailableResponse();
  }
}

async function prepareCredentialRoute(request: Request, context: HisConnectionCredentialRouteContext) {
  const connectionId = await getConnectionId(context);
  if (!connectionId) {
    return { ok: false as const, response: notFoundResponse() };
  }

  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return { ok: false as const, response: unauthorizedResponse() };
  }

  const deniedReason = getManageCredentialsDeniedReason(accessContext);
  if (deniedReason) {
    const auditResult = await recordCredentialRouteDeniedAudit({
      accessContext,
      connectionId,
      reason: deniedReason,
    });
    if (!auditResult.ok) {
      return { ok: false as const, response: serviceUnavailableResponse() };
    }

    return { ok: false as const, response: forbiddenResponse() };
  }

  return { ok: true as const, accessContext, connectionId };
}

export async function handleMutationCredentialRoute(
  request: Request,
  context: HisConnectionCredentialRouteContext,
  config: MutationRouteConfig,
) {
  const prepared = await prepareCredentialRoute(request, context);
  if (!prepared.ok) {
    return prepared.response;
  }

  const body = await readJsonBody(request);
  const parsed = body.ok ? config.parser(body.value) : { ok: false as const };
  if (!parsed.ok) {
    const auditResult = await recordCredentialRouteDeniedAudit({
      accessContext: prepared.accessContext,
      connectionId: prepared.connectionId,
      reason: 'invalid_his_connection_payload',
    });
    if (!auditResult.ok) {
      return serviceUnavailableResponse();
    }

    return validationFailedResponse();
  }

  try {
    const result = await config.service({
      accessContext: prepared.accessContext,
      connectionId: prepared.connectionId,
      database: getDatabase(),
      credentialInput: parsed.value,
      credentialStorage,
      auditEventRepositoryFactory: createAuditEventRepository,
    });

    return mapServiceResultToResponse(result, config.successStatus);
  } catch {
    return serviceUnavailableResponse();
  }
}

export async function handleReasonCredentialRoute(
  request: Request,
  context: HisConnectionCredentialRouteContext,
  config: ReasonRouteConfig,
) {
  const prepared = await prepareCredentialRoute(request, context);
  if (!prepared.ok) {
    return prepared.response;
  }

  const body = await readJsonBody(request);
  const parsed = body.ok ? config.parser(body.value) : { ok: false as const };
  if (!parsed.ok) {
    const auditResult = await recordCredentialRouteDeniedAudit({
      accessContext: prepared.accessContext,
      connectionId: prepared.connectionId,
      reason: 'invalid_his_connection_payload',
    });
    if (!auditResult.ok) {
      return serviceUnavailableResponse();
    }

    return validationFailedResponse();
  }

  try {
    const result = await config.service({
      accessContext: prepared.accessContext,
      connectionId: prepared.connectionId,
      database: getDatabase(),
      credentialInput: parsed.value,
      auditEventRepositoryFactory: createAuditEventRepository,
    });

    return mapServiceResultToResponse(result, 200);
  } catch {
    return serviceUnavailableResponse();
  }
}
