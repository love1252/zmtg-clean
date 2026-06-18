import { NextResponse } from 'next/server';
import { createVendorProviderConfigRepository } from '@/modules/open-platform/server/vendorProviderConfigRepository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';
import { isSupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';
import {
  runMultiVendorSmokeTest,
  type PlatformAiRuntimeSmokeResult,
} from '@/modules/open-platform/server/vendorProviderSmoke';

function lowSensitiveError(status: number, errorCode: string) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function requirePlatformAccess(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) return { ok: false as const, response: lowSensitiveError(401, 'UNAUTHORIZED') };
  if (accessContext.scope !== 'platform') return { ok: false as const, response: lowSensitiveError(403, 'FORBIDDEN') };

  return { ok: true as const };
}

export async function POST(request: Request) {
  const access = requirePlatformAccess(request);
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json().catch(() => null);
  } catch {
    body = null;
  }

  const vendorParam = typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>).vendor
    : new URL(request.url).searchParams.get('vendor');

  if (typeof vendorParam !== 'string' || !isSupportedVendor(vendorParam)) {
    return lowSensitiveError(400, 'VALIDATION_FAILED');
  }

  try {
    const repository = createVendorProviderConfigRepository(getDatabase());
    const result = await runMultiVendorSmokeTest({ repository, vendor: vendorParam });

    if (result.status === 'vendor_not_configured') {
      return NextResponse.json(result.payload, { status: 200 });
    }

    return NextResponse.json(result.payload, { status: 200 });
  } catch {
    return NextResponse.json({
      ok: false,
      status: 'failed',
      latencyMs: 0,
      provider: null,
      model: null,
      checkedAt: new Date().toISOString(),
      errorCode: null,
    } satisfies PlatformAiRuntimeSmokeResult, { status: 200 });
  }
}
