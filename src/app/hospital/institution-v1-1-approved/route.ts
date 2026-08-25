import { readApprovedPrototypeAsset } from '@/modules/institution-v11-preview/server/approved-prototype-assets';
import { isInstitutionV11HospitalSyncEnabled } from '@/modules/institution-v11-preview/server/visual-preview-gate';
import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import { isInstitutionRequestAuthorizationV1 } from '@/modules/security/server/institution-request-authorization';
import { isInstitutionNavigationAuthorizationV1 } from '@/modules/security/server/institution-section-guard';

export const dynamic = 'force-dynamic';

const APPROVED_RUNTIME_CSP = [
  "default-src 'self' data: blob:",
  "base-uri 'self'",
  "connect-src 'none'",
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

async function canCurrentInstitutionEnterApprovedPrototypeV1() {
  try {
    const requestAuthorization = await resolveInstitutionServerAuthorizationV1();
    if (!isInstitutionRequestAuthorizationV1(requestAuthorization)) return false;

    const navigationAuthorization =
      await requestAuthorization.authorizeCurrentInstitutionNavigationV1({
        targetSectionId: 'workbench',
      });

    return (
      isInstitutionNavigationAuthorizationV1(navigationAuthorization) &&
      navigationAuthorization.targetSectionId === 'workbench' &&
      navigationAuthorization.targetAccess === 'allowed'
    );
  } catch {
    return false;
  }
}

export async function GET() {
  if (!isInstitutionV11HospitalSyncEnabled()) return notFoundResponse();
  if (!(await canCurrentInstitutionEnterApprovedPrototypeV1())) {
    return notFoundResponse();
  }

  const asset = await readApprovedPrototypeAsset(['institution.html']);
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
