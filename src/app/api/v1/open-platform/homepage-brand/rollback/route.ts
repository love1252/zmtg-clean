import { NextResponse } from 'next/server';

import { rollbackHomepageBrandConfigService } from '@/modules/open-platform/server/homepage-brand-service';
import { getHomepageBrandRepository, lowSensitiveError, requirePlatformAccess } from '../_shared';

export async function POST(request: Request) {
  const access = requirePlatformAccess(request);
  if (!access.ok) return access.response;

  let payload: { versionId?: string; summary?: string };
  try {
    payload = await request.json();
  } catch {
    return lowSensitiveError(400, 'VALIDATION_FAILED');
  }

  if (!payload.versionId) {
    return lowSensitiveError(400, 'VALIDATION_FAILED');
  }

  try {
    const result = await rollbackHomepageBrandConfigService({
      repository: getHomepageBrandRepository(),
      input: {
        actorId: access.accessContext.userId,
        versionId: payload.versionId,
        summary: payload.summary ?? '',
      },
    });

    if (result.status === 'not_found') {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return lowSensitiveError(503, 'HOMEPAGE_BRAND_UNAVAILABLE');
  }
}
