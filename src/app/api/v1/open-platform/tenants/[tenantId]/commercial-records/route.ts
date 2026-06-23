import { NextResponse } from 'next/server';

import type { TenantCommercialRecordDto } from '@/modules/open-platform/domain/tenant-commercial-records';
import { createTenantCommercialRecordsRepository } from '@/modules/open-platform/server/tenant-commercial-records-repository';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type TenantCommercialRecordsRouteContext = {
  params: Promise<{ tenantId: string }>;
};

function lowSensitiveError(status: number, errorCode: string) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function canReadTenantCommercialRecords(context: AccessContext) {
  if (context.scope !== 'platform') return false;
  return canAccessResource({
    context,
    resource: 'tenant',
    action: 'read_detail',
  }).allowed;
}

function mapSafeCommercialRecord(record: TenantCommercialRecordDto): TenantCommercialRecordDto {
  return {
    recordId: record.recordId,
    tenantId: record.tenantId,
    recordType: record.recordType,
    recordTypeLabel: record.recordTypeLabel,
    status: record.status,
    statusLabel: record.statusLabel,
    displayCode: record.displayCode,
    displayAmount: record.displayAmount,
    periodLabel: record.periodLabel,
    relatedPlanChangeId: record.relatedPlanChangeId,
    occurredAt: record.occurredAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function GET(request: Request, context: TenantCommercialRecordsRouteContext) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) return lowSensitiveError(401, 'UNAUTHORIZED');
  if (!canReadTenantCommercialRecords(accessContext)) return lowSensitiveError(403, 'FORBIDDEN');

  const { tenantId } = await context.params;

  try {
    const repository = createTenantCommercialRecordsRepository(getDatabase());
    const records = await repository.listTenantCommercialRecords(tenantId);

    return NextResponse.json(
      { ok: true, records: records.map(mapSafeCommercialRecord) },
      { status: 200 },
    );
  } catch {
    return lowSensitiveError(503, 'TENANT_COMMERCIAL_RECORDS_UNAVAILABLE');
  }
}
