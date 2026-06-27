import { NextResponse } from 'next/server';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';
import { createAiCallUsageRepository } from '@/modules/institution/server/institution-ai-call-usage-repository';
import { listPlatformAiUsageSummaryService } from '@/modules/institution/server/institution-ai-call-service';

function lowSensitiveError(status: number, errorCode: 'UNAUTHORIZED' | 'FORBIDDEN' | 'SERVICE_UNAVAILABLE') {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

export async function GET(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) {
    return lowSensitiveError(401, 'UNAUTHORIZED');
  }
  if (accessContext.scope !== 'platform') {
    return lowSensitiveError(403, 'FORBIDDEN');
  }

  try {
    const result = await listPlatformAiUsageSummaryService({
      repository: createAiCallUsageRepository(getDatabase()),
    });

    return NextResponse.json(result, { status: 200 });
  } catch {
    return lowSensitiveError(200, 'SERVICE_UNAVAILABLE');
  }
}
