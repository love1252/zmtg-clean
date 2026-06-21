import { NextResponse } from 'next/server';

import { listHomepageBrandVersionsService } from '@/modules/open-platform/server/homepage-brand-service';
import { getHomepageBrandRepository, lowSensitiveError, requirePlatformAccess } from '../_shared';

export async function GET(request: Request) {
  const access = requirePlatformAccess(request);
  if (!access.ok) return access.response;

  try {
    const result = await listHomepageBrandVersionsService({
      repository: getHomepageBrandRepository(),
    });

    return NextResponse.json(
      {
        versions: result.versions.map((version) => ({
          ...version,
          publishedAt: version.publishedAt.toISOString(),
          createdAt: version.createdAt.toISOString(),
          updatedAt: version.updatedAt.toISOString(),
        })),
      },
      { status: 200 },
    );
  } catch {
    return lowSensitiveError(200, 'HOMEPAGE_BRAND_UNAVAILABLE');
  }
}
