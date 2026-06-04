import { NextResponse } from 'next/server';
import {
  createHisConnectionRepository,
  type HisConnectionReadModel,
} from '@/modules/institution/server/his-connection-repository';
import { parseCreateHisConnectionInput } from '@/modules/institution/server/his-connection-write-input';
import {
  createHisConnectionForTenantService,
  type CreateHisConnectionForTenantServiceResult,
} from '@/modules/institution/server/his-connection-write-service';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

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

function canCreateHisConnections(
  context: AccessContext,
): context is AccessContext & { tenantId: string } {
  const decision = canAccessResource({
    context,
    resource: 'open_connection',
    action: 'create',
    targetTenantId: context.tenantId,
  });

  return decision.allowed && Boolean(context.tenantId);
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

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

function mapCreateServiceResultToResponse(result: CreateHisConnectionForTenantServiceResult) {
  switch (result.status) {
    case 'created':
      return NextResponse.json(result.dto, { status: 201 });
    case 'validation_failed':
      return validationFailedResponse();
    case 'conflict':
      return conflictResponse();
    case 'service_unavailable':
      return serviceUnavailableResponse();
  }
}

export async function GET(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return unauthorizedResponse();
  }

  if (!canReadHisConnections(accessContext)) {
    return forbiddenResponse();
  }

  try {
    const repository = createHisConnectionRepository(getDatabase());
    const records = await repository.listHisConnectionsByTenant(accessContext.tenantId);

    return NextResponse.json({
      records: records
        .filter((record) => isVisibleToTenant(record, accessContext.tenantId))
        .map(mapHisConnectionToApiDto),
    });
  } catch {
    return serviceUnavailableResponse();
  }
}

export async function POST(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return unauthorizedResponse();
  }

  if (!canCreateHisConnections(accessContext)) {
    return forbiddenResponse();
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return validationFailedResponse();
  }

  const parsed = parseCreateHisConnectionInput(body.value);
  if (!parsed.ok) {
    return validationFailedResponse();
  }

  try {
    const result = await createHisConnectionForTenantService({
      accessContext,
      database: getDatabase(),
      metadata: parsed.value,
    });

    return mapCreateServiceResultToResponse(result);
  } catch {
    return serviceUnavailableResponse();
  }
}
