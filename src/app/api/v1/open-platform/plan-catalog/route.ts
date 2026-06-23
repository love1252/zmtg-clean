import { NextResponse } from 'next/server';

import { getPlanCatalogService } from '@/modules/open-platform/server/plan-catalog-service';
import {
  getPlanCatalogRepository,
  lowSensitivePlanCatalogError,
  requirePlanCatalogAccess,
} from './_shared';

export async function GET(request: Request) {
  const access = requirePlanCatalogAccess(request, 'read');
  if (!access.ok) return access.response;

  try {
    const payload = await getPlanCatalogService({
      repository: getPlanCatalogRepository(),
    });
    return NextResponse.json(payload, { status: 200 });
  } catch {
    return lowSensitivePlanCatalogError(503, 'PLAN_CATALOG_UNAVAILABLE');
  }
}
