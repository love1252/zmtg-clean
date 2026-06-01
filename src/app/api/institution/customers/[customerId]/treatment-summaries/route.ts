import { NextResponse } from 'next/server';
import {
  createAuditEvent,
  createDeniedAccessAuditEvent,
  type AuditReason,
} from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { mapTreatmentSummaryRecordToTimelineDto } from '@/modules/institution/domain/treatment-summaries';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { createTreatmentSummaryRepository } from '@/modules/institution/server/treatment-summary-repository';
import { parseCreateTreatmentSummaryPayload } from '@/modules/institution/server/treatment-summary-write-input';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

type TreatmentSummaryCreateRouteContext = {
  params: Promise<{ customerId: string }>;
};

async function getCustomerId(context: TreatmentSummaryCreateRouteContext) {
  const params = await context.params;
  return params.customerId.trim();
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

function createDeniedTreatmentSummaryAuditEvent(input: {
  context: AccessContext;
  reason: AuditReason;
  occurredAt: string;
}) {
  return createDeniedAccessAuditEvent({
    eventId: createAuditEventId(),
    context: input.context,
    resource: 'treatment_summary',
    action: 'create',
    reason: input.reason,
    occurredAt: input.occurredAt,
  });
}

export async function POST(
  request: Request,
  context: TreatmentSummaryCreateRouteContext,
) {
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
      resource: 'treatment_summary',
      action: 'create',
      targetTenantId: accessContext.tenantId,
    });

    if (!decision.allowed) {
      await auditRepository.record(
        createDeniedTreatmentSummaryAuditEvent({
          context: accessContext,
          reason: decision.reason,
          occurredAt,
        }),
      );

      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    if (!accessContext.tenantId) {
      await auditRepository.record(
        createDeniedTreatmentSummaryAuditEvent({
          context: accessContext,
          reason: 'missing_tenant',
          occurredAt,
        }),
      );

      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      await auditRepository.record(
        createDeniedTreatmentSummaryAuditEvent({
          context: accessContext,
          reason: 'invalid_treatment_summary_payload',
          occurredAt,
        }),
      );

      return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
    }

    const parsed = parseCreateTreatmentSummaryPayload(body.value);
    if (!parsed.ok) {
      await auditRepository.record(
        createDeniedTreatmentSummaryAuditEvent({
          context: accessContext,
          reason: 'invalid_treatment_summary_payload',
          occurredAt,
        }),
      );

      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const tenantId = accessContext.tenantId;
    const customerId = await getCustomerId(context);

    return await db.transaction(async (transactionDatabase) => {
      const transactionTenantDatabase = transactionDatabase as unknown as TenantDatabase;
      const repository = createTenantBusinessRepository(transactionTenantDatabase);
      const treatmentSummaryRepository =
        createTreatmentSummaryRepository(transactionTenantDatabase);
      const transactionAuditRepository = createAuditEventRepository(transactionTenantDatabase);

      const customer = customerId
        ? await repository.getCustomerByTenant({ tenantId, id: customerId })
        : null;
      if (!customer) {
        await transactionAuditRepository.record(
          createDeniedTreatmentSummaryAuditEvent({
            context: accessContext,
            reason: 'not_found_or_not_owned',
            occurredAt,
          }),
        );

        return NextResponse.json({ error: '记录不存在' }, { status: 404 });
      }

      if (parsed.value.appointmentId) {
        const appointmentOwnership =
          await treatmentSummaryRepository.checkAppointmentBelongsToTenantAndCustomer({
            tenantId,
            customerId,
            appointmentId: parsed.value.appointmentId,
          });

        if (appointmentOwnership.kind === 'not_found_or_not_owned') {
          await transactionAuditRepository.record(
            createDeniedTreatmentSummaryAuditEvent({
              context: accessContext,
              reason: 'not_found_or_not_owned',
              occurredAt,
            }),
          );

          return NextResponse.json({ error: '记录不存在' }, { status: 404 });
        }

        if (appointmentOwnership.kind === 'customer_mismatch') {
          await transactionAuditRepository.record(
            createDeniedTreatmentSummaryAuditEvent({
              context: accessContext,
              reason: 'invalid_treatment_summary_reference',
              occurredAt,
            }),
          );

          return NextResponse.json({ error: '预约不属于当前客户' }, { status: 409 });
        }
      }

      const record = await treatmentSummaryRepository.createTreatmentSummary({
        id: globalThis.crypto.randomUUID(),
        tenantId,
        customerId,
        appointmentId: parsed.value.appointmentId,
        treatmentDate: new Date(parsed.value.treatmentDate),
        treatmentProject: parsed.value.treatmentProject,
        treatmentCategory: parsed.value.treatmentCategory,
        treatmentStage: parsed.value.treatmentStage,
        recoveryStage: parsed.value.recoveryStage,
        riskLevel: parsed.value.riskLevel,
        ownerUserId: parsed.value.ownerUserId,
        summary: parsed.value.summary,
        nextCareAction: parsed.value.nextCareAction,
        tags: parsed.value.tags,
      });

      await transactionAuditRepository.record(
        createAuditEvent({
          eventId: createAuditEventId(),
          context: accessContext,
          resource: 'treatment_summary',
          resourceId: record.id,
          action: 'create',
          result: 'allowed',
          reason: decision.reason,
          occurredAt,
        }),
      );

      return NextResponse.json(
        { record: mapTreatmentSummaryRecordToTimelineDto(record) },
        { status: 201 },
      );
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
