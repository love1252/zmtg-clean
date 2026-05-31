import { NextResponse } from 'next/server';
import type {
  AuditEventListItem,
  AuditEventQueryScope,
} from '@/modules/audit/domain/audit-event-query';
import { parseAuditEventQueryParams } from '@/modules/audit/server/audit-event-query-parser';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type { AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

const tenantIdPattern = /^[A-Za-z0-9_:-]{1,96}$/u;

function canReadOpenPlatformAuditEvents(context: AccessContext) {
  return (
    context.scope === 'platform' &&
    (context.role === 'platform_admin' || context.role === 'security_auditor')
  );
}

function parsePlatformTenantId(params: URLSearchParams) {
  const tenantIds = params.getAll('tenantId');
  if (tenantIds.length === 0) {
    return { ok: true as const, tenantId: undefined };
  }

  if (tenantIds.length > 1) {
    return { ok: false as const, error: 'tenantId 只能出现一次' };
  }

  const tenantId = tenantIds[0]?.trim() ?? '';
  if (!tenantIdPattern.test(tenantId)) {
    return { ok: false as const, error: 'tenantId 格式不正确' };
  }

  return { ok: true as const, tenantId };
}

function queryParamsWithoutTenantId(request: Request) {
  const params = new URL(request.url).searchParams;
  const sanitized = new URLSearchParams(params);
  sanitized.delete('tenantId');
  return sanitized;
}

function mapOpenPlatformAuditEvent(record: AuditEventListItem) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    resource: record.resource,
    resourceId: record.resourceId,
    action: record.action,
    result: record.result,
    reason: record.reason,
    actorId: record.actorId,
    actorRole: record.actorRole,
    occurredAt: record.occurredAt,
  };
}

export async function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  if (!canReadOpenPlatformAuditEvents(context)) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const parsedTenantId = parsePlatformTenantId(params);
  if (!parsedTenantId.ok) {
    return NextResponse.json({ error: parsedTenantId.error }, { status: 400 });
  }

  const parsed = parseAuditEventQueryParams(queryParamsWithoutTenantId(request));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);
    const scope: AuditEventQueryScope = parsedTenantId.tenantId
      ? { kind: 'platform', tenantId: parsedTenantId.tenantId }
      : { kind: 'platform' };
    const result = await auditRepository.listAuditEvents({
      scope,
      query: parsed.query,
    });
    const records = parsedTenantId.tenantId
      ? result.records.filter((record) => record.tenantId === parsedTenantId.tenantId)
      : result.records;

    return NextResponse.json({
      records: records.map(mapOpenPlatformAuditEvent),
      pageInfo: result.pageInfo,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
