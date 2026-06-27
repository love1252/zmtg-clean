import { NextResponse } from 'next/server';

import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { createTenantPlanBindingRepository } from '@/modules/open-platform/server/tenant-plan-binding-repository';
import { createTenantWithPlanService } from '@/modules/open-platform/server/tenant-plan-binding-service';
import { getDatabase } from '@/server/db/client';
import { getTenantPlanQuotaLimitsByCode } from '@/modules/institution/domain/quota-enforcement';

function lowSensitiveError(status: number, errorCode: string) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function canCreateTenantWithPlan(context: AccessContext) {
  if (context.scope !== 'platform') return false;
  return canAccessResource({
    context,
    resource: 'tenant',
    action: 'manage_status',
  }).allowed;
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return lowSensitiveError(401, 'UNAUTHORIZED');
  if (!canCreateTenantWithPlan(context)) return lowSensitiveError(403, 'FORBIDDEN');

  try {
    const payload = await readJsonBody(request);
    const db = getDatabase();
    const repository = createTenantPlanBindingRepository(db);

    // 创建租户前检查目标套餐的 maxStaffSeats（受信常量来源，与 checkTenantQuotaForCreate 一致）
    const rawPlanVersionId = typeof payload === 'object' && payload !== null && 'planVersionId' in payload
      ? String((payload as Record<string, unknown>).planVersionId).trim()
      : '';
    if (rawPlanVersionId) {
      const planVersion = await repository.findPublishedPlanVersionById(rawPlanVersionId);
      if (planVersion) {
        const limits = getTenantPlanQuotaLimitsByCode(planVersion.planCode);
        const maxStaffSeats = limits?.maxStaffSeats ?? null;
        if (!(typeof maxStaffSeats === 'number' && maxStaffSeats >= 1)) {
          return NextResponse.json(
            { code: 'quota_exceeded_staff_seats', error: '员工席位已达到当前套餐上限，请联系平台管理员调整套餐' },
            { status: 409 },
          );
        }
      }
    }

    const result = await createTenantWithPlanService({
      repository,
      actorId: context.userId,
      actorRole: context.role,
      auditSource: context.source,
      payload,
    });

    if (result.status === 'validation_error') {
      return NextResponse.json({ ok: false, ...result }, { status: 400 });
    }
    if (result.status === 'not_found') {
      return lowSensitiveError(404, result.errorCode);
    }

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch {
    return lowSensitiveError(503, 'TENANT_PLAN_BINDING_UNAVAILABLE');
  }
}
