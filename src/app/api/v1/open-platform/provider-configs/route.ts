import { NextResponse } from 'next/server';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { isSupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';
import {
  listVendorProviderConfigs,
  getVendorProviderConfig,
  saveVendorProviderConfig,
  deleteVendorProviderConfig,
} from '@/modules/open-platform/server/vendorProviderConfig';
import type { VendorProviderConfigSaveInput } from '@/modules/open-platform/server/vendorProviderConfigTypes';
import { createVendorProviderConfigRepository } from '@/modules/open-platform/server/vendorProviderConfigRepository';

function lowSensitiveError(status: number, errorCode: 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_FAILED' | 'ENCRYPTION_NOT_CONFIGURED' | 'NOT_FOUND' | 'PROVIDER_CONFIG_UNAVAILABLE') {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

function requirePlatformAccess(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) return { ok: false as const, response: lowSensitiveError(401, 'UNAUTHORIZED') };
  if (accessContext.scope !== 'platform') return { ok: false as const, response: lowSensitiveError(403, 'FORBIDDEN') };

  return { ok: true as const };
}

function getRepository() {
  return createVendorProviderConfigRepository(getDatabase());
}

export async function GET(request: Request) {
  const access = requirePlatformAccess(request);
  if (!access.ok) return access.response;

  try {
    const params = new URL(request.url).searchParams;
    const vendorParam = params.get('vendor');

    if (vendorParam) {
      if (!isSupportedVendor(vendorParam)) {
        return lowSensitiveError(400, 'VALIDATION_FAILED');
      }

      const config = await getVendorProviderConfig({
        repository: getRepository(),
        vendor: vendorParam,
      });

      if (!config) {
        return lowSensitiveError(404, 'NOT_FOUND');
      }

      return NextResponse.json(config, { status: 200 });
    }

    const result = await listVendorProviderConfigs({
      repository: getRepository(),
    });

    return NextResponse.json(result, { status: 200 });
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
    const result = await saveVendorProviderConfig({
      repository: getRepository(),
      input: payload as VendorProviderConfigSaveInput,
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

export async function PUT(request: Request) {
  const access = requirePlatformAccess(request);
  if (!access.ok) return access.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return lowSensitiveError(400, 'VALIDATION_FAILED');
  }

  try {
    const result = await saveVendorProviderConfig({
      repository: getRepository(),
      input: payload as VendorProviderConfigSaveInput,
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

export async function DELETE(request: Request) {
  const access = requirePlatformAccess(request);
  if (!access.ok) return access.response;

  try {
    const params = new URL(request.url).searchParams;
    const vendorParam = params.get('vendor');

    if (!vendorParam || !isSupportedVendor(vendorParam)) {
      return lowSensitiveError(400, 'VALIDATION_FAILED');
    }

    const result = await deleteVendorProviderConfig({
      repository: getRepository(),
      vendor: vendorParam,
    });

    if (result.status === 'not_found') {
      return NextResponse.json(result.payload, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return lowSensitiveError(200, 'PROVIDER_CONFIG_UNAVAILABLE');
  }
}
