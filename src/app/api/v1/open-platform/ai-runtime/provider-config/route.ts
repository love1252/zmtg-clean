import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import {
  getPlatformAiProviderConfigStatus,
  savePlatformAiProviderConfig,
  type PlatformAiProviderConfigSaveInput,
} from '@/modules/open-platform/server/platformAiProviderConfig';
import { createPlatformAiProviderConfigRepository } from '@/modules/open-platform/server/platformAiProviderConfigRepository';

function lowSensitiveError(status: number, errorCode: 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_FAILED' | 'ENCRYPTION_NOT_CONFIGURED' | 'PROVIDER_CONFIG_UNAVAILABLE') {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function requirePlatformAccess(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) return { ok: false as const, response: lowSensitiveError(401, 'UNAUTHORIZED') };
  if (accessContext.scope !== 'platform') return { ok: false as const, response: lowSensitiveError(403, 'FORBIDDEN') };

  return { ok: true as const };
}

function getRepository() {
  return createPlatformAiProviderConfigRepository(getDatabase());
}

export async function GET(request: Request) {
  const access = requirePlatformAccess(request);
  if (!access.ok) return access.response;

  try {
    return NextResponse.json(
      await getPlatformAiProviderConfigStatus({ repository: getRepository() }),
      { status: 200 },
    );
  } catch {
    return lowSensitiveError(200, 'PROVIDER_CONFIG_UNAVAILABLE');
  }
}

export async function POST(request: Request) {
  const access = requirePlatformAccess(request);
  if (!access.ok) return access.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return lowSensitiveError(400, 'VALIDATION_FAILED');
  }

  try {
    const result = await savePlatformAiProviderConfig({
      repository: getRepository(),
      input: payload as PlatformAiProviderConfigSaveInput,
    });

    if (result.status === 'validation_failed') {
      return NextResponse.json(result.payload, { status: 400 });
    }
    if (result.status === 'encryption_unavailable') {
      return NextResponse.json(result.payload, { status: 503 });
    }

    return NextResponse.json(result.payload, { status: 200 });
  } catch {
    return lowSensitiveError(200, 'PROVIDER_CONFIG_UNAVAILABLE');
  }
}
