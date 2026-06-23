import { savePlanVersionDraftService } from '@/modules/open-platform/server/plan-catalog-service';
import {
  getPlanCatalogRepository,
  lowSensitivePlanCatalogError,
  planCatalogMutationResponse,
  readJsonBody,
  requirePlanCatalogAccess,
} from '../../_shared';

type RouteContext = {
  params: Promise<{ versionId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const access = requirePlanCatalogAccess(request, 'manage');
  if (!access.ok) return access.response;

  const [params, payload] = await Promise.all([context.params, readJsonBody(request)]);

  try {
    const result = await savePlanVersionDraftService({
      repository: getPlanCatalogRepository(),
      actorId: access.accessContext.userId,
      versionId: params.versionId,
      payload,
    });

    return planCatalogMutationResponse(result);
  } catch {
    return lowSensitivePlanCatalogError(503, 'PLAN_CATALOG_UNAVAILABLE');
  }
}
