import { readApprovedPrototypeAsset } from '@/modules/institution-v11-preview/server/approved-prototype-assets';
import { resolveApprovedPrototypeRuntimeContextV1 } from '@/modules/institution-v11-preview/server/approved-prototype-runtime-context';
import { isInstitutionV11HospitalSyncEnabled } from '@/modules/institution-v11-preview/server/visual-preview-gate';

export const dynamic = 'force-dynamic';

const APPROVED_RUNTIME_CSP = [
  "default-src 'self' data: blob:",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "form-action 'none'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob:",
  "object-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
].join('; ');

function notFoundResponse() {
  return new Response('Not found', { status: 404 });
}

export async function GET() {
  if (!isInstitutionV11HospitalSyncEnabled()) return notFoundResponse();
  const runtimeContext = await resolveApprovedPrototypeRuntimeContextV1();
  if (!runtimeContext) return notFoundResponse();

  const asset = await readApprovedPrototypeAsset(
    ['institution.html'],
    undefined,
    runtimeContext,
  );
  if (!asset) return notFoundResponse();

  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': APPROVED_RUNTIME_CSP,
      'Content-Type': asset.contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}
