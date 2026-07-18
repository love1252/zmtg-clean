import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  handleTenantBusinessMutationRequest,
} from '@/modules/institution/server/tenant-business-api';
import { runTenantBusinessAuditTransaction } from '@/modules/institution/server/tenant-business-audit-transaction';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import {
  parseFollowUpTransitionPayload,
} from '@/modules/institution/server/tenant-business-write-input';
import { recordFollowUpTaskStatusTimelineEvent } from '@/modules/institution/server/followup-customer-timeline-service';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

const followUpListReadDisabled = Object.freeze({
  code: 'follow_up_list_capability_disabled',
  error: '随访列表能力暂未启用',
});

/**
 * No request data is inspected until an institution-scoped server guard and reader exist.
 * This deliberately avoids demo-session, parser, database, repository, and audit side effects.
 */
export async function GET(_request: Request) {
  return NextResponse.json(followUpListReadDisabled, { status: 503 });
}

export async function PATCH(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const parsed = parseFollowUpTransitionPayload(body.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);

    return await handleTenantBusinessMutationRequest({
      context,
      resource: 'follow_up',
      action: 'update',
      mutate: ({ tenantId, successAuditEvent }) =>
        runTenantBusinessAuditTransaction(db, async ({ repository, auditRepository }) => {
          const occurredAt = new Date().toISOString();
          const result = await repository.transitionFollowUpTask({
            tenantId,
            id: parsed.value.id,
            nextStatus: parsed.value.nextStatus,
            actorId: context.userId,
            occurredAt,
          });

          if (result.kind !== 'updated') {
            return result;
          }

          await recordFollowUpTaskStatusTimelineEvent({
            context,
            tenantBusinessRepository: repository,
            task: result.task,
            occurredAt,
          });
          await auditRepository.record({ ...successAuditEvent, resourceId: result.task.id });

          return { kind: 'success', record: result.task };
        }),
      auditRepository,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

function isFollowUpCustomerReferenceError(error: unknown) {
  const databaseError = error as { code?: unknown; constraint?: unknown; constraint_name?: unknown; message?: unknown };
  const constraintName = databaseError.constraint_name ?? databaseError.constraint;
  return (
    databaseError.code === '23503' &&
    (constraintName === 'follow_up_tasks_tenant_customer_fk' ||
      (typeof databaseError.message === 'string' && databaseError.message.includes('follow_up_tasks_tenant_customer_fk')))
  );
}

export async function POST(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });

  const payload = body.value as Record<string, unknown>;
  const customerId = typeof payload.customerId === 'string' ? payload.customerId.trim() : '';
  const customerDisplayName = typeof payload.customerDisplayName === 'string' ? payload.customerDisplayName.trim() : '';
  const stage = typeof payload.stage === 'string' ? payload.stage.trim() : '';
  const dueAt = typeof payload.dueAt === 'string' ? payload.dueAt.trim() : '';
  const suggestedAction = typeof payload.suggestedAction === 'string' ? payload.suggestedAction.trim() : '';
  const rl = typeof payload.riskLevel === 'string' && ['normal','watch','urgent'].includes(payload.riskLevel) ? payload.riskLevel as 'normal'|'watch'|'urgent' : 'normal';
  const st = typeof payload.status === 'string' && ['scheduled','due'].includes(payload.status) ? payload.status as 'scheduled'|'due' : 'scheduled';

  if (!customerId || !stage || !dueAt) return NextResponse.json({ error: 'customerId、stage、dueAt 不可为空' }, { status: 400 });

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);
    return await handleTenantBusinessMutationRequest({
      context, resource: 'follow_up', action: 'create',
      mutate: async ({ tenantId, successAuditEvent }) => {
        try {
          return await runTenantBusinessAuditTransaction(db, async ({ repository, auditRepository }) => {
            // 使用手动创建路径，不关联治疗摘要来源
            const record = await repository.createManualFollowUpTask({
              id: globalThis.crypto.randomUUID(),
              tenantId,
              customerId,
              customerDisplayName: customerDisplayName || '客户',
              stage,
              status: st,
              dueAt,
              suggestedAction,
              riskLevel: rl,
            });
            if (record.kind !== 'created') {
              return { kind: 'not_found' as const };
            }
            await auditRepository.record({ ...successAuditEvent, resourceId: record.task.id });
            return { kind: 'success' as const, record: record.task };
          });
        } catch (error) { if (isFollowUpCustomerReferenceError(error)) return { kind: 'not_found' }; throw error; }
      },
      auditRepository, successStatus: 201,
    });
  } catch { return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 }); }
}
