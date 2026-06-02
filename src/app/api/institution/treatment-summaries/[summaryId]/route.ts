import { NextResponse } from 'next/server';
import {
  createAuditEvent,
  createDeniedAccessAuditEvent,
  type AuditReason,
} from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  mapTreatmentSummaryRecordToTimelineDto,
  type UpdateTreatmentSummaryDraft,
} from '@/modules/institution/domain/treatment-summaries';
import {
  createTreatmentSummaryRepository,
  type UpdateTreatmentSummaryValues,
} from '@/modules/institution/server/treatment-summary-repository';
import { parseUpdateTreatmentSummaryPayload } from '@/modules/institution/server/treatment-summary-write-input';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

type TreatmentSummaryUpdateRouteContext = {
  params: Promise<{ summaryId: string }>;
};

async function getSummaryId(context: TreatmentSummaryUpdateRouteContext) {
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

function createDeniedTreatmentSummaryUpdateAuditEvent(input: {
  context: AccessContext;
  reason: AuditReason;
  occurredAt: string;
  resourceId?: string | null;
}) {
  return createDeniedAccessAuditEvent({
    eventId: createAuditEventId(),
    context: input.context,
    resource: 'treatment_summary',
    resourceId: input.resourceId,
    action: 'update',
    reason: input.reason,
    occurredAt: input.occurredAt,
  });
}

function toTreatmentSummaryUpdateValues(
  value: UpdateTreatmentSummaryDraft,
): UpdateTreatmentSummaryValues {
  const { treatmentDate, ...rest } = value;

  return {
    ...rest,
    ...(treatmentDate ? { treatmentDate: new Date(treatmentDate) } : {}),
  };
}

export async function PATCH(
  request: Request,
  context: TreatmentSummaryUpdateRouteContext,
) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const db = getDatabase();
    const auditRepository = createAuditEventRepository(db);
    const occurredAt = new Date().toISOString();
    const summaryId = await getSummaryId(context);
    const decision = canAccessResource({
      context: accessContext,
      resource: 'treatment_summary',
      action: 'update',
      targetTenantId: accessContext.tenantId,
    });

    if (!decision.allowed) {
      await auditRepository.record(
        createDeniedTreatmentSummaryUpdateAuditEvent({
          context: accessContext,
          reason: decision.reason,
          occurredAt,
          resourceId: summaryId || null,
        }),
      );

      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    if (!accessContext.tenantId) {
      await auditRepository.record(
        createDeniedTreatmentSummaryUpdateAuditEvent({
          context: accessContext,
          reason: 'missing_tenant',
          occurredAt,
          resourceId: summaryId || null,
        }),
      );

      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const tenantId = accessContext.tenantId;

    return await db.transaction(async (transactionDatabase) => {
      const transactionTenantDatabase = transactionDatabase as unknown as TenantDatabase;
      const treatmentSummaryRepository =
        createTreatmentSummaryRepository(transactionTenantDatabase);
      const transactionAuditRepository = createAuditEventRepository(transactionTenantDatabase);
      const existing = summaryId
        ? await treatmentSummaryRepository.getTreatmentSummaryByTenant({
            tenantId,
            id: summaryId,
          })
        : null;

      if (!existing) {
        await transactionAuditRepository.record(
          createDeniedTreatmentSummaryUpdateAuditEvent({
            context: accessContext,
            reason: 'not_found_or_not_owned',
            occurredAt,
            resourceId: summaryId || null,
          }),
        );

        return NextResponse.json({ error: '记录不存在' }, { status: 404 });
      }

      const body = await readJsonBody(request);
      if (!body.ok) {
        await transactionAuditRepository.record(
          createDeniedTreatmentSummaryUpdateAuditEvent({
            context: accessContext,
            reason: 'invalid_treatment_summary_payload',
            occurredAt,
            resourceId: summaryId,
          }),
        );

        return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
      }

      const parsed = parseUpdateTreatmentSummaryPayload(body.value);
      if (!parsed.ok) {
        await transactionAuditRepository.record(
          createDeniedTreatmentSummaryUpdateAuditEvent({
            context: accessContext,
            reason: 'invalid_treatment_summary_payload',
            occurredAt,
            resourceId: summaryId,
          }),
        );

        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }

      const updateResult = await treatmentSummaryRepository.updateTreatmentSummaryByTenant({
        tenantId,
        summaryId,
        values: toTreatmentSummaryUpdateValues(parsed.value),
      });

      if (updateResult.kind === 'not_found_or_not_owned') {
        await transactionAuditRepository.record(
          createDeniedTreatmentSummaryUpdateAuditEvent({
            context: accessContext,
            reason: 'not_found_or_not_owned',
            occurredAt,
            resourceId: summaryId,
          }),
        );

        return NextResponse.json({ error: '记录不存在' }, { status: 404 });
      }

      if (updateResult.kind === 'invalid_reference') {
        const reason: AuditReason =
          updateResult.reason === 'customer_mismatch'
            ? 'invalid_treatment_summary_reference'
            : 'not_found_or_not_owned';
        await transactionAuditRepository.record(
          createDeniedTreatmentSummaryUpdateAuditEvent({
            context: accessContext,
            reason,
            occurredAt,
            resourceId: summaryId,
          }),
        );

        if (updateResult.reason === 'customer_mismatch') {
          return NextResponse.json({ error: '预约不属于当前客户' }, { status: 409 });
        }

        return NextResponse.json({ error: '记录不存在' }, { status: 404 });
      }

      await transactionAuditRepository.record(
        createAuditEvent({
          eventId: createAuditEventId(),
          context: accessContext,
          resource: 'treatment_summary',
          resourceId: updateResult.record.id,
          action: 'update',
          result: 'allowed',
          reason: decision.reason,
          occurredAt,
        }),
      );

      return NextResponse.json({
        record: mapTreatmentSummaryRecordToTimelineDto(updateResult.record),
      });
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
