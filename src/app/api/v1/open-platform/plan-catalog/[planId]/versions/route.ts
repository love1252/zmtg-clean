import { createPlanVersionDraftService } from '@/modules/open-platform/server/plan-catalog-service';
import {
  getPlanCatalogRepository,
  lowSensitivePlanCatalogError,
  planCatalogMutationResponse,
  readJsonBody,
  requirePlanCatalogAccess,
} from '../../_shared';

type RouteContext = {
  params: Promise<{ planId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const access = requirePlanCatalogAccess(request, 'manage');
  if (!access.ok) return access.response;

  const [params, body] = await Promise.all([context.params, readJsonBody(request)]);
  const input = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  try {
    const result = await createPlanVersionDraftService({
      repository: getPlanCatalogRepository(),
      actorId: access.accessContext.userId,
      planId: params.planId,
      sourceVersionId: typeof input.sourceVersionId === 'string' ? input.sourceVersionId : undefined,
    });

    return planCatalogMutationResponse(result);
  } catch {
    return lowSensitivePlanCatalogError(503, 'PLAN_CATALOG_UNAVAILABLE');
  }
}
