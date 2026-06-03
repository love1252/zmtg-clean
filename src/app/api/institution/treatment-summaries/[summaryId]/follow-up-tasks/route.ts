import { NextResponse } from 'next/server';
import {
  createAuditEvent,
  createDeniedAccessAuditEvent,
  type AuditReason,
} from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { confirmTreatmentFollowUpTask } from '@/modules/institution/server/treatment-followup-confirmation';
import { parseTreatmentFollowUpSuggestionSelection } from '@/modules/institution/server/treatment-followup-suggestions';
import { createTreatmentSummaryRepository } from '@/modules/institution/server/treatment-summary-repository';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

type TreatmentFollowUpTaskRouteContext = {
  params: Promise<{ summaryId: string }>;
};

async function getSummaryId(context: TreatmentFollowUpTaskRouteContext) {
  const params = await context.params;
  return params.summaryId.trim();
}

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

function createDeniedFollowUpAuditEvent(input: {
  context: AccessContext;
  reason: AuditReason;
  occurredAt: string;
  resourceId?: string | null;
}) {
  return createDeniedAccessAuditEvent({
    eventId: createAuditEventId(),
    context: input.context,
    resource: 'follow_up',
    resourceId: input.resourceId,
    action: 'update',
    reason: input.reason,
    occurredAt: input.occurredAt,
  });
}

export async function POST(request: Request, context: TreatmentFollowUpTaskRouteContext) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);
    const occurredAt = new Date().toISOString();
    const decision = canAccessResource({
      context: accessContext,
      resource: 'follow_up',
      action: 'update',
      targetTenantId: accessContext.tenantId,
    });

    if (!decision.allowed) {
      await auditRepository.record(
        createDeniedFollowUpAuditEvent({
          context: accessContext,
          reason: decision.reason,
          occurredAt,
        }),
      );

      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    if (!accessContext.tenantId) {
      await auditRepository.record(
        createDeniedFollowUpAuditEvent({
          context: accessContext,
          reason: 'missing_tenant',
          occurredAt,
        }),
      );

      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const tenantId = accessContext.tenantId;
    const body = await readJsonBody(request);
    if (!body.ok) {
      await auditRepository.record(
        createDeniedFollowUpAuditEvent({
          context: accessContext,
          reason: 'invalid_follow_up_suggestion',
          occurredAt,
        }),
      );

      return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
    }

    const parsed = parseTreatmentFollowUpSuggestionSelection(body.value);
    if (!parsed.ok) {
      await auditRepository.record(
        createDeniedFollowUpAuditEvent({
          context: accessContext,
          reason: 'invalid_follow_up_suggestion',
          occurredAt,
        }),
      );

      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const summaryId = await getSummaryId(context);

    return await db.transaction(async (transactionDatabase) => {
      const transactionTenantDatabase = transactionDatabase as unknown as TenantDatabase;
      const treatmentSummaryRepository =
        createTreatmentSummaryRepository(transactionTenantDatabase);
      const tenantBusinessRepository = createTenantBusinessRepository(transactionTenantDatabase);
      const transactionAuditRepository = createAuditEventRepository(transactionTenantDatabase);
      const result = await confirmTreatmentFollowUpTask({
        tenantId,
        summaryId,
        selection: parsed.value,
        treatmentSummaryRepository,
        tenantBusinessRepository,
      });

      if (result.kind === 'not_found') {
        await transactionAuditRepository.record(
          createDeniedFollowUpAuditEvent({
            context: accessContext,
            reason: 'not_found_or_not_owned',
            occurredAt,
          }),
        );

        return NextResponse.json({ error: '记录不存在' }, { status: 404 });
      }

      if (result.kind === 'voided') {
        await transactionAuditRepository.record(
          createDeniedFollowUpAuditEvent({
            context: accessContext,
            resourceId: summaryId,
            reason: 'voided_treatment_summary_follow_up_blocked',
            occurredAt,
          }),
        );

        return NextResponse.json(
          { error: '治疗摘要已作废，不能继续创建来源随访任务' },
          { status: 409 },
        );
      }

      if (result.kind === 'invalid_suggestion') {
        await transactionAuditRepository.record(
          createDeniedFollowUpAuditEvent({
            context: accessContext,
            reason: 'invalid_follow_up_suggestion',
            occurredAt,
          }),
        );

        return NextResponse.json(
          { error: '随访建议已失效，请重新生成后再确认' },
          { status: 409 },
        );
      }

      if (result.kind === 'conflict') {
        await transactionAuditRepository.record(
          createDeniedFollowUpAuditEvent({
            context: accessContext,
            resourceId: result.resourceId,
            reason: result.reason,
            occurredAt,
          }),
        );

        return NextResponse.json(
          { error: '该护理随访任务已存在，请勿重复创建' },
          { status: 409 },
        );
      }

      await transactionAuditRepository.record(
        createAuditEvent({
          eventId: createAuditEventId(),
          context: accessContext,
          resource: 'follow_up',
          resourceId: result.task.id,
          action: 'update',
          result: 'allowed',
          reason: decision.reason,
          occurredAt,
        }),
      );

      return NextResponse.json({ record: result.task }, { status: 201 });
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
