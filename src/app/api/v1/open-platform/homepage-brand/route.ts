import { NextResponse } from 'next/server';

import { getHomepageBrandManagementViewService } from '@/modules/open-platform/server/homepage-brand-service';
import { getHomepageBrandRepository, lowSensitiveError, requirePlatformAccess, safeViewPayload } from './_shared';

export async function GET(request: Request) {
  const access = requirePlatformAccess(request);
  if (!access.ok) return access.response;

  try {
    const view = await getHomepageBrandManagementViewService({
      repository: getHomepageBrandRepository(),
    });
    return NextResponse.json(safeViewPayload(view), { status: 200 });
  } catch {
    return lowSensitiveError(200, 'HOMEPAGE_BRAND_UNAVAILABLE');
  }
}
