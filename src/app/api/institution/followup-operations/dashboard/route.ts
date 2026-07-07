import { NextResponse } from 'next/server';
import { createAuditEvent, createDeniedAccessAuditEvent, type AuditReason } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { getFollowUpOperationsDashboard } from '@/modules/institution/server/followup-operations-dashboard-service';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

function deniedAudit(input: {
  context: AccessContext;
  reason: AuditReason;
  occurredAt: string;
}) {
  return createDeniedAccessAuditEvent({
    eventId: createAuditEventId(),
    context: input.context,
    resource: 'follow_up',
    action: 'read_own_tenant',
    reason: input.reason,
    occurredAt: input.occurredAt,
  });
}

export async function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);
    const occurredAt = new Date().toISOString();
    const decision = canAccessResource({
      context,
      resource: 'follow_up',
      action: 'read_own_tenant',
      targetTenantId: context.tenantId,
    });

    if (!decision.allowed || !context.tenantId) {
      await auditRepository.record(
        deniedAudit({
          context,
          reason: decision.allowed ? 'missing_tenant' : decision.reason,
          occurredAt,
        }),
      );
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const result = await getFollowUpOperationsDashboard({
      context,
      tenantBusinessRepository: createTenantBusinessRepository(db),
      now: new Date(occurredAt),
    });

    if (result.kind !== 'success') {
      await auditRepository.record(
        deniedAudit({ context, reason: result.reason, occurredAt }),
      );
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    await auditRepository.record(
      createAuditEvent({
        eventId: createAuditEventId(),
        context,
        resource: 'follow_up',
        action: 'read_own_tenant',
        result: 'allowed',
        reason: decision.reason,
        occurredAt,
      }),
    );

    return NextResponse.json(result.dashboard);
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
