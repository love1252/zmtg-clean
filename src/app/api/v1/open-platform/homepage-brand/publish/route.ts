import { NextResponse } from 'next/server';

import { publishHomepageBrandConfigService } from '@/modules/open-platform/server/homepage-brand-service';
import { getHomepageBrandRepository, lowSensitiveError, requirePlatformAccess } from '../_shared';

export async function POST(request: Request) {
  const access = requirePlatformAccess(request);
  if (!access.ok) return access.response;

  let payload: { summary?: string };
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  try {
    const result = await publishHomepageBrandConfigService({
      repository: getHomepageBrandRepository(),
      input: {
        actorId: access.accessContext.userId,
        summary: payload.summary ?? '',
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
