import { NextResponse } from 'next/server';

import { getDatabase } from '@/server/db/client';
import { createLocalHomepageBrandAssetStorage } from '@/modules/open-platform/server/homepage-brand-asset-storage';
import { createHomepageBrandRepository } from '@/modules/open-platform/server/homepage-brand-repository';
import type { HomepageBrandAssetRecord } from '@/modules/open-platform/server/homepage-brand-service';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

export function lowSensitiveError(
  status: number,
  errorCode: 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_FAILED' | 'HOMEPAGE_BRAND_UNAVAILABLE',
) {
  return NextResponse.json({ ok: false, errorCode }, { status });
}

export function requirePlatformAccess(request: Request) {
  const accessContext = getDemoAccessContextFromRequest(request);
  if (!accessContext) return { ok: false as const, response: lowSensitiveError(401, 'UNAUTHORIZED') };
  if (accessContext.scope !== 'platform') {
    return { ok: false as const, response: lowSensitiveError(403, 'FORBIDDEN') };
  }

  return { ok: true as const, accessContext };
}

export function getHomepageBrandRepository() {
  return createHomepageBrandRepository(getDatabase());
}

export function getHomepageBrandAssetStorage() {
  return createLocalHomepageBrandAssetStorage();
}

export function assetDto(asset: HomepageBrandAssetRecord) {
  return {
    id: asset.id,
    kind: asset.kind,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    publicUrl: asset.publicUrl,
    uploadedBy: asset.uploadedBy,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export function safeViewPayload(view: Awaited<ReturnType<
  typeof import('@/modules/open-platform/server/homepage-brand-service').getHomepageBrandManagementViewService
>>) {
  return {
    ...view,
    publishedAt: view.publishedAt,
    versions: view.versions.map((version) => ({
      ...version,
      publishedAt: version.publishedAt.toISOString(),
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    })),
    assets: view.assets.map(assetDto),
    auditLogs: view.auditLogs.map((auditLog) => ({
      ...auditLog,
      createdAt: auditLog.createdAt.toISOString(),
    })),
  };
}
