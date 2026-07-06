import { NextResponse } from 'next/server';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { buildCustomerTimelineResponse } from '@/modules/institution/domain/customer-timeline';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { createTreatmentSummaryRepository } from '@/modules/institution/server/treatment-summary-repository';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type CustomerTimelineRouteContext = {
  params: Promise<{ customerId: string }>;
};

async function getCustomerId(context: CustomerTimelineRouteContext) {
  const params = await context.params;
  return params.customerId.trim();
}

export async function GET(request: Request, context: CustomerTimelineRouteContext) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const decision = canAccessResource({
    context: accessContext,
    resource: 'customer',
    action: 'read_own_tenant',
    targetTenantId: accessContext.tenantId,
  });

  if (!decision.allowed || !accessContext.tenantId) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  const customerId = await getCustomerId(context);
  if (!customerId) {
    return NextResponse.json({ error: '记录不存在' }, { status: 404 });
  }

  try {
    const db = getDatabase();
    const repository = createTenantBusinessRepository(db);
    const auditRepository = createAuditEventRepository(db);
    const treatmentSummaryRepository = createTreatmentSummaryRepository(db);
    const tenantId = accessContext.tenantId;
    const customer = await repository.getCustomerByTenant({
      tenantId,
      id: customerId,
    });

    if (!customer) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }

    const [appointments, followups, treatmentSummaries, auditEvents, followUpTimelineEvents, followUpOverview] = await Promise.all([
      repository.listAppointmentsByTenantAndCustomer({ tenantId, customerId }),
      repository.listFollowUpTasksByTenantAndCustomer({ tenantId, customerId }),
      treatmentSummaryRepository.listTreatmentSummariesByTenantAndCustomer({
        tenantId,
        customerId,
      }),
      auditRepository.listCustomerAuditEventsByResourceId({ tenantId, customerId }),
      repository.listCustomerFollowUpTimelineEvents({
        tenantId,
        institutionId: accessContext.institutionId ?? null,
        customerId,
      }),
      repository.getCustomerFollowUpOverview({
        tenantId,
        institutionId: accessContext.institutionId ?? null,
        customerId,
      }),
    ]);

    return NextResponse.json(
      buildCustomerTimelineResponse({
        customer,
        appointments,
        followups,
        treatmentSummaries,
        auditEvents,
        followUpTimelineEvents: followUpTimelineEvents.map((event) => ({
          eventId: event.id,
          customerId: event.customerId,
          eventType: event.eventType,
          eventTitle: event.eventTitle,
          safeSummary: event.safeSummary,
          riskLevel: event.riskLevel,
          occurredAt: event.occurredAt,
          sourceType: event.sourceType,
          sourceId: event.sourceId,
          safeReasonCode: event.safeReasonCode,
        })),
        followUpOverview,
      }),
    );
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
