import { NextResponse } from 'next/server';
import {
  createHisConnectionRepository,
  type HisConnectionReadModel,
} from '@/modules/institution/server/his-connection-repository';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
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
