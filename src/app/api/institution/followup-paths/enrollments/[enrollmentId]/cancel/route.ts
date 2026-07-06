import { NextResponse } from 'next/server';
import { createAuditEvent, createDeniedAccessAuditEvent, type AuditReason } from '@/modules/audit/domain/audit-events';
import { cancelFollowUpPathEnrollment } from '@/modules/institution/server/followup-path-enrollment-service';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

function createUpdateDeniedAudit(input: {
  context: AccessContext;
  reason: AuditReason;
  occurredAt: string;
  resourceId?: string | null;
}) {
  return createDeniedAccessAuditEvent({
    eventId: createAuditEventId(),
    context: input.context,
    resource: 'follow_up',
    action: 'update',
    reason: input.reason,
    occurredAt: input.occurredAt,
    resourceId: input.resourceId,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ enrollmentId: string }> },
) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { enrollmentId } = await params;
  if (!enrollmentId) {
    return NextResponse.json({ error: 'enrollmentId 不可为空' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);
    const occurredAt = new Date().toISOString();
    const decision = canAccessResource({
      context,
      resource: 'follow_up',
      action: 'update',
      targetTenantId: context.tenantId,
    });

    if (!decision.allowed || !context.tenantId) {
      await auditRepository.record(
        createUpdateDeniedAudit({
          context,
          reason: decision.allowed ? 'missing_tenant' : decision.reason,
          occurredAt,
          resourceId: enrollmentId,
        }),
      );
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    return await db.transaction(async (transactionDatabase) => {
      const transactionDb = transactionDatabase as unknown as TenantDatabase;
      const transactionAuditRepository = createAuditEventRepository(transactionDb);
      const result = await cancelFollowUpPathEnrollment({
        context,
        enrollmentId,
        tenantBusinessRepository: createTenantBusinessRepository(transactionDb),
      });

      if (result.kind === 'cancelled') {
        await transactionAuditRepository.record(
          createAuditEvent({
            eventId: createAuditEventId(),
            context,
            resource: 'follow_up',
            resourceId: enrollmentId,
            action: 'update',
            result: 'allowed',
            reason: decision.reason,
            occurredAt,
          }),
        );
        return NextResponse.json({ record: result.enrollment });
      }

      const reason: AuditReason =
        result.kind === 'conflict'
          ? result.reason
          : result.kind === 'forbidden'
            ? result.reason
            : 'not_found_or_not_owned';
      await transactionAuditRepository.record(
        createUpdateDeniedAudit({ context, reason, occurredAt, resourceId: enrollmentId }),
      );

      if (result.kind === 'conflict') {
        return NextResponse.json(
          { code: result.reason, error: '该路径实例当前不可取消' },
          { status: 409 },
        );
      }
      if (result.kind === 'forbidden') {
        return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
      }

      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
