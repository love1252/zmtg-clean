import { NextResponse } from 'next/server';
import { runPlatformAiRuntimeSmokeTest } from '@/modules/open-platform/server/platformAiRuntimeSmoke';
import { createPlatformAiProviderConfigRepository } from '@/modules/open-platform/server/platformAiProviderConfigRepository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function unauthorizedSmokeResponse(status: 401 | 403) {
  return NextResponse.json({
    ok: false,
    status: 'failed',
    latencyMs: 0,
    provider: null,
    model: null,
    checkedAt: new Date().toISOString(),
    errorCode: 'UNAUTHORIZED',
  }, { status });
}

function requirePlatformAccess(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) return { ok: false as const, response: unauthorizedSmokeResponse(401) };
  if (accessContext.scope !== 'platform') return { ok: false as const, response: unauthorizedSmokeResponse(403) };

  return { ok: true as const };
}

function getOptionalProviderConfigRepository() {
  try {
    return createPlatformAiProviderConfigRepository(getDatabase());
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  try {
    const access = requirePlatformAccess(request);
    if (!access.ok) return access.response;

    const providerConfigRepository = getOptionalProviderConfigRepository();
    return NextResponse.json(
      await runPlatformAiRuntimeSmokeTest(
        providerConfigRepository ? { providerConfigRepository } : undefined,
      ),
      { status: 200 },
    );
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
