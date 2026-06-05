import {
  credentialRouteConfigs,
  handleReasonCredentialRoute,
  type HisConnectionCredentialRouteContext,
} from '@/app/api/institution/his-connections/[connectionId]/credentials/credential-route';

export async function POST(request: Request, context: HisConnectionCredentialRouteContext) {
  return handleReasonCredentialRoute(request, context, credentialRouteConfigs.revoke);
}
