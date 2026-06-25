import { publishPlanVersionService } from '@/modules/open-platform/server/plan-catalog-service';
import {
  getPlanCatalogRepository,
  lowSensitivePlanCatalogError,
  planCatalogMutationResponse,
  requirePlanCatalogAccess,
} from '../../../_shared';

type RouteContext = {
  params: Promise<{ versionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const access = requirePlanCatalogAccess(request, 'manage');
  if (!access.ok) return access.response;

  const params = await context.params;

  try {
    const result = await publishPlanVersionService({
      repository: getPlanCatalogRepository(),
      actorId: access.accessContext.userId,
      versionId: params.versionId,
    });

    return planCatalogMutationResponse(result);
  } catch {
    return lowSensitivePlanCatalogError(503, 'PLAN_CATALOG_UNAVAILABLE');
  }
}
