import { readApprovedPrototypeAsset } from '@/modules/institution-v11-preview/server/approved-prototype-assets';
import { isInstitutionV11VisualPreviewEnabled } from '@/modules/institution-v11-preview/server/visual-preview-gate';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: Readonly<{ params: Promise<{ assetPath: string[] }> }>,
) {
  if (!isInstitutionV11VisualPreviewEnabled()) {
    return new Response('Not found', { status: 404 });
  }

  const { assetPath } = await context.params;
  const asset = await readApprovedPrototypeAsset(assetPath);
  if (!asset) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self' data: blob:; base-uri 'self'; connect-src 'none'; font-src 'self' data:; form-action 'self'; frame-ancestors 'self'; img-src 'self' data: blob:; object-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
      'Content-Type': asset.contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}
