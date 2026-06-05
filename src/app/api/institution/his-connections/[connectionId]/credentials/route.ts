import {
  credentialRouteConfigs,
  handleMutationCredentialRoute,
  type HisConnectionCredentialRouteContext,
} from '@/app/api/institution/his-connections/[connectionId]/credentials/credential-route';

export async function POST(request: Request, context: HisConnectionCredentialRouteContext) {
  return handleMutationCredentialRoute(request, context, credentialRouteConfigs.create);
}

export async function PATCH(request: Request, context: HisConnectionCredentialRouteContext) {
  return handleMutationCredentialRoute(request, context, credentialRouteConfigs.update);
}
