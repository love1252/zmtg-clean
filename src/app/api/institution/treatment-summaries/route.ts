import { NextResponse } from 'next/server';
import {
  createAuditEvent,
  createDeniedAccessAuditEvent,
  type AuditReason,
} from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type { InstitutionTreatmentSummaryListItem } from '@/modules/institution/domain/treatment-summaries';
import { parseTreatmentSummaryQueryParams } from '@/modules/institution/server/treatment-summary-query-parser';
import { createTreatmentSummaryRepository } from '@/modules/institution/server/treatment-summary-repository';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

function createDeniedTreatmentSummaryReadAuditEvent(input: {
  context: AccessContext;
  reason: AuditReason;
  occurredAt: string;
}) {
  return createDeniedAccessAuditEvent({
    eventId: createAuditEventId(),
    context: input.context,
    resource: 'treatment_summary',
    action: 'read_own_tenant',
    reason: input.reason,
    occurredAt: input.occurredAt,
  });
}

function mapTreatmentSummaryListItemToSafeDto(
  item: InstitutionTreatmentSummaryListItem,
): InstitutionTreatmentSummaryListItem {
  return {
    id: item.id,
    customerId: item.customerId,
    appointmentId: item.appointmentId,
    treatmentDate: item.treatmentDate,
    treatmentProject: item.treatmentProject,
    treatmentCategory: item.treatmentCategory,
    treatmentStage: item.treatmentStage,
    recoveryStage: item.recoveryStage,
    riskLevel: item.riskLevel,
    ownerUserId: item.ownerUserId,
    summary: item.summary,
    nextCareAction: item.nextCareAction,
    tags: [...item.tags],
    status: item.status,
    voidedAt: item.voidedAt,
    voidedBy: item.voidedBy,
    voidReasonCode: item.voidReasonCode,
    voidReason: item.voidReason,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function GET(request: Request) {
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
      action: 'read_own_tenant',
      targetTenantId: accessContext.tenantId,
    });

    if (!decision.allowed) {
      await auditRepository.record(
        createDeniedTreatmentSummaryReadAuditEvent({
          context: accessContext,
          reason: decision.reason,
          occurredAt,
        }),
      );

      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    if (!accessContext.tenantId) {
      await auditRepository.record(
        createDeniedTreatmentSummaryReadAuditEvent({
          context: accessContext,
          reason: 'missing_tenant',
          occurredAt,
        }),
      );

      return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
    }

    const parsed = parseTreatmentSummaryQueryParams(new URL(request.url).searchParams);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const treatmentSummaryRepository = createTreatmentSummaryRepository(db);
    const result = await treatmentSummaryRepository.listTreatmentSummariesByTenant({
      tenantId: accessContext.tenantId,
      query: parsed.query,
    });

    await auditRepository.record(
      createAuditEvent({
        eventId: createAuditEventId(),
        context: accessContext,
        resource: 'treatment_summary',
        action: 'read_own_tenant',
        result: 'allowed',
        reason: decision.reason,
        occurredAt,
      }),
    );

    return NextResponse.json({
      records: result.records.map(mapTreatmentSummaryListItemToSafeDto),
      pageInfo: result.pageInfo,
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
