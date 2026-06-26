import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  handleTenantBusinessListRequest,
  handleTenantBusinessMutationRequest,
} from '@/modules/institution/server/tenant-business-api';
import { parseFollowUpTaskListQuery } from '@/modules/institution/server/follow-up-task-query-parser';
import { runTenantBusinessAuditTransaction } from '@/modules/institution/server/tenant-business-audit-transaction';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { checkTenantQuotaForCreate } from '@/modules/institution/server/tenant-quota-enforcement';
import {
  parseFollowUpTransitionPayload,
} from '@/modules/institution/server/tenant-business-write-input';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

export async function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const parsedQuery = parseFollowUpTaskListQuery(new URL(request.url).searchParams);
  if (!parsedQuery.ok) {
    return NextResponse.json({ error: parsedQuery.error }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const repository = createTenantBusinessRepository(db);
    const auditRepository = createAuditEventRepository(db);

    return await handleTenantBusinessListRequest({
      context,
      resource: 'follow_up',
      list: (tenantId) =>
        repository.listFollowUpTasksByTenant({
          tenantId,
          filters: parsedQuery.filters,
        }),
      auditRepository,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
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
          const result = await repository.transitionFollowUpTask({
            tenantId,
            id: parsed.value.id,
            nextStatus: parsed.value.nextStatus,
            actorId: context.userId,
            occurredAt: new Date().toISOString(),
          });

          if (result.kind !== 'updated') {
            return result;
          }

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
        const quotaDecision = await checkTenantQuotaForCreate({ database: db, tenantId, resource: 'appointments' });
        if (!quotaDecision.allowed) return { kind: 'quota_denied', decision: quotaDecision };
        try {
          return await runTenantBusinessAuditTransaction(db, async ({ repository, auditRepository }) => {
            const customerExists = await repository.customerExistsByTenant({ tenantId, id: customerId });
            if (!customerExists) return { kind: 'not_found' };
            const record = await repository.createFollowUpTaskFromTreatmentSummarySuggestion({
              id: globalThis.crypto.randomUUID(), tenantId, customerId,
              customerDisplayName: customerDisplayName || '客户',
              journeyId: `manual-${Date.now()}`, stage, status: st, dueAt,
              suggestedAction, riskLevel: rl,
              sourceTreatmentSummaryId: '', sourceSuggestionKey: `manual-${Date.now()}`,
            });
            if (record.kind !== 'created') return { kind: 'conflict' as const, reason: 'stale_transition' as const };
            await auditRepository.record({ ...successAuditEvent, resourceId: record.task.id });
            return { kind: 'success' as const, record: record.task };
          });
        } catch (error) { if (isFollowUpCustomerReferenceError(error)) return { kind: 'not_found' }; throw error; }
      },
      auditRepository, successStatus: 201,
    });
  } catch { return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 }); }
}
