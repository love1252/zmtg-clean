import { NextResponse } from 'next/server';
import {
  testHisConnectionForTenantService,
  type HisConnectionTestConnectionDto,
  type HisConnectionTestConnectionServiceResult,
} from '@/modules/institution/server/his-connection-test-connection-service';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type HisConnectionTestConnectionRouteContext = {
  params: Promise<{ connectionId: string }>;
};

async function getConnectionId(context: HisConnectionTestConnectionRouteContext) {
  const params = await context.params;
  return params.connectionId.trim();
}

function canTestHisConnection(
  context: AccessContext,
): context is AccessContext & { tenantId: string } {
  const decision = canAccessResource({
    context,
    resource: 'open_connection',
    action: 'test_connection',
    targetTenantId: context.tenantId,
  });

  return decision.allowed && Boolean(context.tenantId);
}

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

async function readEmptyJsonBody(request: Request): Promise<{ ok: true } | { ok: false }> {
  if (request.body === null) {
    return { ok: true };
  }

  try {
    const value: unknown = await request.json();

    if (!isJsonObject(value)) {
      return { ok: false };
    }

    return Object.keys(value).length === 0 ? { ok: true } : { ok: false };
  } catch {
    return { ok: false };
  }
}

function pickTestConnectionDto(dto: HisConnectionTestConnectionDto) {
  if (dto.ok) {
    return {
      ok: true,
      healthStatus: dto.healthStatus,
      checkedAt: dto.checkedAt,
    };
  }

  return {
    ok: false,
    code: dto.code,
    error: dto.error,
    healthStatus: dto.healthStatus,
    ...(dto.checkedAt === undefined ? {} : { checkedAt: dto.checkedAt }),
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

function validationFailedResponse() {
  return NextResponse.json(
    { code: 'validation_failed', error: '请求格式不正确' },
    { status: 400 },
  );
}

function connectionNotActiveResponse(dto: HisConnectionTestConnectionDto) {
  return NextResponse.json(pickTestConnectionDto(dto), { status: 409 });
}

function serviceUnavailableResponse() {
  return NextResponse.json(
    { code: 'service_unavailable', error: '数据服务暂时不可用' },
    { status: 503 },
  );
}

function mapServiceResultToResponse(result: HisConnectionTestConnectionServiceResult) {
  switch (result.status) {
    case 'tested':
      return NextResponse.json(pickTestConnectionDto(result.dto));
    case 'connection_not_active':
      return connectionNotActiveResponse(result.dto);
    case 'validation_failed':
      return validationFailedResponse();
    case 'not_found':
      return notFoundResponse();
    case 'service_unavailable':
      return serviceUnavailableResponse();
  }
}

export async function POST(
  request: Request,
  context: HisConnectionTestConnectionRouteContext,
) {
  const connectionId = await getConnectionId(context);
  if (!connectionId) {
    return notFoundResponse();
  }

  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return unauthorizedResponse();
  }

  if (!canTestHisConnection(accessContext)) {
    return forbiddenResponse();
  }

  const parsed = await readEmptyJsonBody(request);
  if (!parsed.ok) {
    return validationFailedResponse();
  }

  try {
    const result = await testHisConnectionForTenantService({
      accessContext,
      connectionId,
      database: getDatabase(),
    });

    return mapServiceResultToResponse(result);
  } catch {
    return serviceUnavailableResponse();
  }
}
