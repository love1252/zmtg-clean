import { previewTenantPlanChangeService } from '@/modules/open-platform/server/tenant-plan-change-service';
import {
  getTenantPlanChangeRepository,
  lowSensitiveTenantPlanChangeError,
  readJsonBody,
  requireTenantPlanChangeAccess,
  tenantPlanChangeMutationResponse,
  type TenantPlanChangeRouteContext,
} from '../_plan-change-shared';

export async function POST(request: Request, context: TenantPlanChangeRouteContext) {
  const access = requireTenantPlanChangeAccess(request);
  if (!access.ok) return access.response;

  const [params, payload] = await Promise.all([context.params, readJsonBody(request)]);

  try {
    const result = await previewTenantPlanChangeService({
      repository: getTenantPlanChangeRepository(),
      tenantId: params.tenantId,
      payload,
    });
    return tenantPlanChangeMutationResponse(result);
  } catch {
    return lowSensitiveTenantPlanChangeError(503, 'TENANT_PLAN_CHANGE_UNAVAILABLE');
  }
}
