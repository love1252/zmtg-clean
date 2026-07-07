import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  allowedFollowUpMessageAudit,
  deniedFollowUpMessageAudit,
  responseForFollowUpMessageConflict,
} from '@/modules/institution/server/followup-message-draft-api';
import { approveMessageDraft } from '@/modules/institution/server/followup-message-draft-service';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const { draftId } = await params;
  if (!draftId) return NextResponse.json({ error: 'draftId 不可为空' }, { status: 400 });

  try {
    const db = getDatabase();
    const occurredAt = new Date().toISOString();
    const auditRepository = createAuditEventRepository(db);
    const decision = canAccessResource({ context, resource: 'follow_up', action: 'update', targetTenantId: context.tenantId });

    if (!decision.allowed || !context.tenantId) {
      await auditRepository.record(deniedFollowUpMessageAudit({ context, action: 'update', reason: decision.allowed ? 'missing_tenant' : decision.reason, occurredAt, resourceId: draftId }));
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    return await db.transaction(async (transactionDatabase) => {
      const transactionDb = transactionDatabase as unknown as TenantDatabase;
      const transactionAuditRepository = createAuditEventRepository(transactionDb);
      const result = await approveMessageDraft({
        context,
        draftId,
        tenantBusinessRepository: createTenantBusinessRepository(transactionDb),
        auditRepository: transactionAuditRepository,
        occurredAt,
      });

      if (result.kind === 'updated' || result.kind === 'updated_with_delivery') {
        await transactionAuditRepository.record(allowedFollowUpMessageAudit({ context, action: 'update', reason: 'message_draft_approved', occurredAt, resourceId: result.draft.draftId }));
        return NextResponse.json({ record: result.draft, delivery: result.kind === 'updated_with_delivery' ? result.delivery : null });
      }

      const reason = result.kind === 'conflict' ? result.reason : result.kind === 'forbidden' ? result.reason : 'not_found_or_not_owned';
      await transactionAuditRepository.record(deniedFollowUpMessageAudit({ context, action: 'update', reason, occurredAt, resourceId: draftId }));
      if (result.kind === 'conflict') return responseForFollowUpMessageConflict(result.reason);
      if (result.kind === 'forbidden') return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
