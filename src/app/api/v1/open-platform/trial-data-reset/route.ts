import { NextResponse } from 'next/server';

import {
  getTrialDataOverview,
  trialDataResetDisabledErrorCode,
} from '@/modules/open-platform/server/trial-data-reset-service';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function lowSensitiveError(status: number, errorCode: string) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

export async function GET(_request: Request) {
  const context = getDemoAccessContextFromRequest(_request);
  if (!context) return lowSensitiveError(401, 'UNAUTHORIZED');
  if (context.scope !== 'platform') return lowSensitiveError(403, 'FORBIDDEN');

  try {
    const overview = await getTrialDataOverview(getDatabase());
    return NextResponse.json({ ok: true, overview });
  } catch {
    return lowSensitiveError(503, 'TRIAL_DATA_OVERVIEW_UNAVAILABLE');
  }
}

export async function POST(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return lowSensitiveError(401, 'UNAUTHORIZED');
  if (context.scope !== 'platform') return lowSensitiveError(403, 'FORBIDDEN');
  return lowSensitiveError(503, trialDataResetDisabledErrorCode);
}
