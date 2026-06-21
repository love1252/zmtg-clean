import { NextResponse } from 'next/server';

import type { HomepageBrandConfig } from '@/modules/marketing/domain/homepageBrandConfig';
import { saveHomepageBrandDraftService } from '@/modules/open-platform/server/homepage-brand-service';
import { getHomepageBrandRepository, lowSensitiveError, requirePlatformAccess } from '../_shared';

export async function PUT(request: Request) {
  const access = requirePlatformAccess(request);
  if (!access.ok) return access.response;

  let payload: { config?: HomepageBrandConfig };
  try {
    payload = await request.json();
  } catch {
    return lowSensitiveError(400, 'VALIDATION_FAILED');
  }

  if (!payload.config) {
    return lowSensitiveError(400, 'VALIDATION_FAILED');
  }

  try {
    const result = await saveHomepageBrandDraftService({
      repository: getHomepageBrandRepository(),
      input: {
        actorId: access.accessContext.userId,
        config: payload.config,
      },
    });

    if (result.status === 'validation_error') {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return lowSensitiveError(503, 'HOMEPAGE_BRAND_UNAVAILABLE');
  }
}
