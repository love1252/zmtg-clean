import { createLocalHomepageBrandAssetStorage } from '@/modules/open-platform/server/homepage-brand-asset-storage';
import type { HomepageBrandAssetKind } from '@/modules/open-platform/server/homepage-brand-service';

type HomepageBrandAssetRouteContext = {
  params: Promise<{ kind: string; filename: string }>;
};

const allowedKinds = new Set<HomepageBrandAssetKind>([
  'logo',
  'night_logo',
  'mark_logo',
  'hero_background',
  'share_image',
]);

function contentTypeForFilename(filename: string) {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

function isSafeFilename(filename: string) {
  return Boolean(filename) && !filename.includes('/') && !filename.includes('\\') && !filename.includes('..');
}

async function readParams(context: HomepageBrandAssetRouteContext) {
  return context.params;
}

export async function GET(_request: Request, context: HomepageBrandAssetRouteContext) {
  const params = await readParams(context);
  if (!allowedKinds.has(params.kind as HomepageBrandAssetKind) || !isSafeFilename(params.filename)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const content = await createLocalHomepageBrandAssetStorage().read({
      storageKey: `homepage-brand/${params.kind}/${params.filename}`,
    });

    return new Response(content.slice().buffer, {
      status: 200,
      headers: {
        'cache-control': 'public, max-age=31536000, immutable',
        'content-length': String(content.byteLength),
        'content-type': contentTypeForFilename(params.filename),
        'x-content-type-options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
