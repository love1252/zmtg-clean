import { NextResponse } from 'next/server';
import { runPlatformAiRuntimeSmokeTest } from '@/modules/open-platform/server/platformAiRuntimeSmoke';

export async function POST() {
  try {
    return NextResponse.json(await runPlatformAiRuntimeSmokeTest(), { status: 200 });
  } catch {
    return NextResponse.json({
      ok: false,
      status: 'failed',
      latencyMs: 0,
      provider: null,
      model: null,
      checkedAt: new Date().toISOString(),
      errorCode: 'PROVIDER_REQUEST_FAILED',
    }, { status: 200 });
  }
}
