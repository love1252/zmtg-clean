import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  allowedFollowUpMessageAudit,
  deniedFollowUpMessageAudit,
  parseCreateMessageDraftPayload,
  readFollowUpMessageJsonBody,
  responseForFollowUpMessageConflict,
} from '@/modules/institution/server/followup-message-draft-api';
import {
  createMessageDraftForFollowUpTask,
  listMessageDraftsForFollowUpTask,
} from '@/modules/institution/server/followup-message-draft-service';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

export async function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const taskId = new URL(request.url).searchParams.get('taskId')?.trim() ?? '';
  if (!taskId) return NextResponse.json({ error: 'taskId 不可为空' }, { status: 400 });

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
        deniedFollowUpMessageAudit({
          context,
          action: 'read_own_tenant',
          reason: decision.allowed ? 'missing_tenant' : decision.reason,
          occurredAt,
          resourceId: taskId,
        }),
      );
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const result = await listMessageDraftsForFollowUpTask({
      context,
      followUpTaskId: taskId,
      tenantBusinessRepository: createTenantBusinessRepository(db),
    });

    if (result.kind === 'success') {
      await auditRepository.record(
        allowedFollowUpMessageAudit({
          context,
          action: 'read_own_tenant',
          reason: decision.reason,
          occurredAt,
          resourceId: taskId,
        }),
      );
      return NextResponse.json({ records: result.drafts });
    }

    const reason = result.kind === 'forbidden' ? result.reason : 'not_found_or_not_owned';
    await auditRepository.record(
      deniedFollowUpMessageAudit({ context, action: 'read_own_tenant', reason, occurredAt, resourceId: taskId }),
    );
    if (result.kind === 'forbidden') return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const body = await readFollowUpMessageJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  const parsed = parseCreateMessageDraftPayload(body.value);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const db = getDatabase();
    const occurredAt = new Date().toISOString();
    const auditRepository = createAuditEventRepository(db);
    const decision = canAccessResource({
      context,
      resource: 'follow_up',
      action: 'create',
      targetTenantId: context.tenantId,
    });

    if (!decision.allowed || !context.tenantId) {
      await auditRepository.record(
        deniedFollowUpMessageAudit({
          context,
          action: 'create',
          reason: decision.allowed ? 'missing_tenant' : decision.reason,
          occurredAt,
          resourceId: parsed.value.followUpTaskId,
        }),
      );
      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    return await db.transaction(async (transactionDatabase) => {
      const transactionDb = transactionDatabase as unknown as TenantDatabase;
      const transactionAuditRepository = createAuditEventRepository(transactionDb);
      const result = await createMessageDraftForFollowUpTask({
        context,
        followUpTaskId: parsed.value.followUpTaskId,
        templateId: parsed.value.templateId,
        tenantBusinessRepository: createTenantBusinessRepository(transactionDb),
        occurredAt,
      });

      if (result.kind === 'created') {
        await transactionAuditRepository.record(
          allowedFollowUpMessageAudit({
            context,
            action: 'create',
            reason: 'message_draft_created',
            occurredAt,
            resourceId: result.draft.draftId,
          }),
        );
        return NextResponse.json({ record: result.draft }, { status: 201 });
      }

      const reason = result.kind === 'conflict'
        ? result.reason
        : result.kind === 'forbidden'
          ? result.reason
          : 'not_found_or_not_owned';
      await transactionAuditRepository.record(
        deniedFollowUpMessageAudit({
          context,
          action: 'create',
          reason,
          occurredAt,
          resourceId: result.kind === 'conflict' ? result.resourceId : parsed.value.followUpTaskId,
        }),
      );

      if (result.kind === 'conflict') return responseForFollowUpMessageConflict(result.reason);
      if (result.kind === 'forbidden') return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
