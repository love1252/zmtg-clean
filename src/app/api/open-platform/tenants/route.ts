import { NextResponse } from 'next/server';
import {
  tenantManagementDtoFields,
  type TenantManagementListItem,
} from '@/modules/open-platform/domain/tenant-management';
import { createTenantManagementRepository } from '@/modules/open-platform/server/tenant-management-repository';
import {
  canAccessResource,
  type AccessContext,
} from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

type TenantManagementResponseItem = Pick<
  TenantManagementListItem,
  (typeof tenantManagementDtoFields)[number]
>;

function canReadPlatformTenants(context: AccessContext) {
  if (context.scope !== 'platform') return false;

  return canAccessResource({
    context,
    resource: 'tenant',
    action: 'read_detail',
  }).allowed;
}

function mapOpenPlatformTenant(record: TenantManagementListItem): TenantManagementResponseItem {
  return {
    tenantId: record.tenantId,
    tenantName: record.tenantName,
    tenantStatus: record.tenantStatus,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    planName: record.planName,
    planCode: record.planCode,
    planStatus: record.planStatus,
    assignmentStatus: record.assignmentStatus,
    startedAt: record.startedAt,
    expiresAt: record.expiresAt,
    maxCustomers: record.maxCustomers,
    maxAppointments: record.maxAppointments,
    maxFollowUps: record.maxFollowUps,
    maxAiCalls: record.maxAiCalls,
    currentCustomers: record.currentCustomers,
    currentAppointments: record.currentAppointments,
    currentFollowUps: record.currentFollowUps,
    currentAiCalls: record.currentAiCalls,
    snapshotAt: record.snapshotAt,
  };
}

export async function GET(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  if (!canReadPlatformTenants(context)) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  try {
    const db = getDatabase();
    const tenantManagementRepository = createTenantManagementRepository(db);
    const records = await tenantManagementRepository.listTenantManagementRecords();

    return NextResponse.json({
      records: records.map(mapOpenPlatformTenant),
    });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
