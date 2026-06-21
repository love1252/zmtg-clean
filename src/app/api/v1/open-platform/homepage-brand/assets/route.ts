import { NextResponse } from 'next/server';

import {
  uploadHomepageBrandAssetService,
  type HomepageBrandAssetKind,
  type HomepageBrandUploadFileLike,
} from '@/modules/open-platform/server/homepage-brand-service';
import {
  assetDto,
  getHomepageBrandAssetStorage,
  getHomepageBrandRepository,
  lowSensitiveError,
  requirePlatformAccess,
} from '../_shared';

const allowedKinds = new Set<HomepageBrandAssetKind>([
  'logo',
  'night_logo',
  'mark_logo',
  'hero_background',
  'share_image',
]);

function inferMimeType(filename: string, mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized && normalized !== 'application/octet-stream') return normalized;
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

function normalizeUploadFile(value: FormDataEntryValue | null): HomepageBrandUploadFileLike | null {
  if (!value || typeof value === 'string') return null;
  const candidate = value as Partial<HomepageBrandUploadFileLike>;
  if (
    typeof candidate.type === 'string' &&
    typeof candidate.size === 'number' &&
    typeof candidate.arrayBuffer === 'function'
  ) {
    const name = typeof candidate.name === 'string' ? candidate.name : 'brand-asset.png';
    return {
      name,
      type: inferMimeType(name, candidate.type),
      size: candidate.size,
      arrayBuffer: candidate.arrayBuffer.bind(candidate),
    };
  }

  return null;
}

export async function POST(request: Request) {
  const access = requirePlatformAccess(request);
  if (!access.ok) return access.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return lowSensitiveError(400, 'VALIDATION_FAILED');
  }

  const kind = formData.get('kind');
  const file = normalizeUploadFile(formData.get('file'));

  if (typeof kind !== 'string' || !allowedKinds.has(kind as HomepageBrandAssetKind) || !file) {
    return lowSensitiveError(400, 'VALIDATION_FAILED');
  }

  try {
    const result = await uploadHomepageBrandAssetService({
      repository: getHomepageBrandRepository(),
      storage: getHomepageBrandAssetStorage(),
      input: {
        actorId: access.accessContext.userId,
        kind: kind as HomepageBrandAssetKind,
        file,
      },
    });

    if (result.status === 'validation_error') {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ ...result, asset: assetDto(result.asset) }, { status: 200 });
  } catch {
    return lowSensitiveError(503, 'HOMEPAGE_BRAND_UNAVAILABLE');
  }
}
