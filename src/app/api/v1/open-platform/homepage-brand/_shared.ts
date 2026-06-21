import { NextResponse } from 'next/server';

import { getDatabase } from '@/server/db/client';
import { createLocalHomepageBrandAssetStorage } from '@/modules/open-platform/server/homepage-brand-asset-storage';
import { createLocalHomepageBrandRepository } from '@/modules/open-platform/server/homepage-brand-local-repository';
import { createHomepageBrandRepository } from '@/modules/open-platform/server/homepage-brand-repository';
import type {
  HomepageBrandAssetRecord,
  HomepageBrandAssetRepository,
} from '@/modules/open-platform/server/homepage-brand-service';
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

function isHomepageBrandMigrationUnavailableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const code = 'code' in error ? String((error as { code?: unknown }).code) : '';
  const message = error instanceof Error ? error.message : '';
  const normalizedMessage = message.toLowerCase();

  return (
    code === '42P01' ||
    (
      normalizedMessage.includes('homepage_brand') &&
      (normalizedMessage.includes('does not exist') || normalizedMessage.includes('relation'))
    ) ||
    (
      normalizedMessage.includes('relation') &&
      normalizedMessage.includes('does not exist')
    )
  );
}

function shouldUseLocalRepositoryFallback(error: unknown) {
  if (isHomepageBrandMigrationUnavailableError(error)) return true;
  return process.env.NODE_ENV !== 'production';
}

async function withLocalFallback<T>(
  action: () => Promise<T>,
  fallback: () => Promise<T>,
) {
  try {
    return await action();
  } catch (error) {
    if (shouldUseLocalRepositoryFallback(error)) return fallback();
    throw error;
  }
}

export function createHomepageBrandRepositoryWithLocalFallback(
  primary: HomepageBrandAssetRepository,
  fallback: HomepageBrandAssetRepository,
): HomepageBrandAssetRepository {
  return {
    findConfig: (id) => withLocalFallback(
      () => primary.findConfig(id),
      () => fallback.findConfig(id),
    ),
    upsertConfigDraft: (record) => withLocalFallback(
      () => primary.upsertConfigDraft(record),
      () => fallback.upsertConfigDraft(record),
    ),
    listVersions: (configId) => withLocalFallback(
      () => primary.listVersions(configId),
      () => fallback.listVersions(configId),
    ),
    findVersion: (versionId) => withLocalFallback(
      () => primary.findVersion(versionId),
      () => fallback.findVersion(versionId),
    ),
    createVersion: (record) => withLocalFallback(
      () => primary.createVersion(record),
      () => fallback.createVersion(record),
    ),
    markConfigPublished: (input) => withLocalFallback(
      () => primary.markConfigPublished(input),
      () => fallback.markConfigPublished(input),
    ),
    createAuditLog: (record) => withLocalFallback(
      () => primary.createAuditLog(record),
      () => fallback.createAuditLog(record),
    ),
    listAuditLogs: (configId) => withLocalFallback(
      () => primary.listAuditLogs(configId),
      () => fallback.listAuditLogs(configId),
    ),
    createAsset: (record) => withLocalFallback(
      () => primary.createAsset(record),
      () => fallback.createAsset(record),
    ),
    listAssets: () => withLocalFallback(
      () => primary.listAssets(),
      () => fallback.listAssets(),
    ),
  };
}

export function getHomepageBrandRepository() {
  try {
    return createHomepageBrandRepositoryWithLocalFallback(
      createHomepageBrandRepository(getDatabase()),
      createLocalHomepageBrandRepository(),
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('DATABASE_URL is required')) {
      return createLocalHomepageBrandRepository();
    }
    throw error;
  }
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
