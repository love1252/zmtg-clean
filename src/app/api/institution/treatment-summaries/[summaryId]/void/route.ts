import { NextResponse } from 'next/server';
import {
  createAuditEvent,
  createDeniedAccessAuditEvent,
  type AuditReason,
} from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type { InstitutionTreatmentSummaryListItem } from '@/modules/institution/domain/treatment-summaries';
import { createTreatmentSummaryRepository } from '@/modules/institution/server/treatment-summary-repository';
import { parseVoidTreatmentSummaryPayload } from '@/modules/institution/server/treatment-summary-write-input';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

type TreatmentSummaryVoidRouteContext = {
  params: Promise<{ summaryId: string }>;
};

type TreatmentSummaryVoidDto = Omit<InstitutionTreatmentSummaryListItem, 'customerId'>;

async function getSummaryId(context: TreatmentSummaryVoidRouteContext) {
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

function createDeniedTreatmentSummaryVoidAuditEvent(input: {
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

function mapTreatmentSummaryVoidDto(
  record: InstitutionTreatmentSummaryListItem,
): TreatmentSummaryVoidDto {
  return {
    id: record.id,
    appointmentId: record.appointmentId,
    treatmentDate: record.treatmentDate,
    treatmentProject: record.treatmentProject,
    treatmentCategory: record.treatmentCategory,
    treatmentStage: record.treatmentStage,
    recoveryStage: record.recoveryStage,
    riskLevel: record.riskLevel,
    ownerUserId: record.ownerUserId,
    summary: record.summary,
    nextCareAction: record.nextCareAction,
    tags: [...record.tags],
    status: record.status,
    voidedAt: record.voidedAt,
    voidedBy: record.voidedBy,
    voidReasonCode: record.voidReasonCode,
    voidReason: record.voidReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function POST(
  request: Request,
  context: TreatmentSummaryVoidRouteContext,
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
        createDeniedTreatmentSummaryVoidAuditEvent({
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
        createDeniedTreatmentSummaryVoidAuditEvent({
          context: accessContext,
          reason: 'missing_tenant',
          occurredAt,
          resourceId: summaryId || null,
        }),
      );

      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      await auditRepository.record(
        createDeniedTreatmentSummaryVoidAuditEvent({
          context: accessContext,
          reason: 'invalid_treatment_summary_void_payload',
          occurredAt,
          resourceId: summaryId || null,
        }),
      );

      return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
    }

    const parsed = parseVoidTreatmentSummaryPayload(body.value);
    if (!parsed.ok) {
      await auditRepository.record(
        createDeniedTreatmentSummaryVoidAuditEvent({
          context: accessContext,
          reason: 'invalid_treatment_summary_void_payload',
          occurredAt,
          resourceId: summaryId || null,
        }),
      );

      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const tenantId = accessContext.tenantId;

    return await db.transaction(async (transactionDatabase) => {
      const transactionTenantDatabase = transactionDatabase as unknown as TenantDatabase;
      const treatmentSummaryRepository =
        createTreatmentSummaryRepository(transactionTenantDatabase);
      const transactionAuditRepository = createAuditEventRepository(transactionTenantDatabase);
      const result = await treatmentSummaryRepository.voidTreatmentSummaryByTenant({
        tenantId,
        summaryId,
        voidedBy: accessContext.userId,
        reasonCode: parsed.value.reasonCode,
        reasonText: parsed.value.reasonText,
      });

      if (result.kind === 'not_found_or_not_owned') {
        await transactionAuditRepository.record(
          createDeniedTreatmentSummaryVoidAuditEvent({
            context: accessContext,
            reason: 'not_found_or_not_owned',
            occurredAt,
            resourceId: summaryId || null,
          }),
        );

        return NextResponse.json({ error: '记录不存在' }, { status: 404 });
      }

      if (result.kind === 'already_voided') {
        await transactionAuditRepository.record(
          createAuditEvent({
            eventId: createAuditEventId(),
            context: accessContext,
            resource: 'treatment_summary',
            resourceId: result.record.id,
            action: 'update',
            result: 'allowed',
            reason: 'treatment_summary_already_voided',
            occurredAt,
          }),
        );

        return NextResponse.json(
          {
            error: '治疗摘要已作废',
            record: mapTreatmentSummaryVoidDto(result.record),
          },
          { status: 409 },
        );
      }

      await transactionAuditRepository.record(
        createAuditEvent({
          eventId: createAuditEventId(),
          context: accessContext,
          resource: 'treatment_summary',
          resourceId: result.record.id,
          action: 'update',
          result: 'allowed',
          reason: 'treatment_summary_voided',
          occurredAt,
        }),
      );

      return NextResponse.json({
        record: mapTreatmentSummaryVoidDto(result.record),
      });
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
