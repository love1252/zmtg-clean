import { NextResponse } from 'next/server';
import type { AuditEventListItem } from '@/modules/audit/domain/audit-event-query';
import { parseAuditEventQueryParams } from '@/modules/audit/server/audit-event-query-parser';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type { AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function canReadInstitutionAuditEvents(
  context: AccessContext,
): context is AccessContext & { tenantId: string } {
  return context.scope === 'tenant' && context.role === 'tenant_admin' && Boolean(context.tenantId);
}

function queryParamsWithoutTenantId(request: Request) {
  const params = new URL(request.url).searchParams;
  const sanitized = new URLSearchParams(params);
  sanitized.delete('tenantId');
  return sanitized;
}

function mapInstitutionAuditEvent(record: AuditEventListItem) {
  return {
    id: record.id,
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

  if (!canReadInstitutionAuditEvents(context)) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  const parsed = parseAuditEventQueryParams(queryParamsWithoutTenantId(request));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);
    const result = await auditRepository.listAuditEvents({
      scope: { kind: 'institution', tenantId: context.tenantId },
      query: parsed.query,
    });
    const scopedRecords = result.records.filter((record) => record.tenantId === context.tenantId);

    return NextResponse.json({
      records: scopedRecords.map(mapInstitutionAuditEvent),
      pageInfo: result.pageInfo,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
