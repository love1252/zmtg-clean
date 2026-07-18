import { NextResponse } from 'next/server';

export type HisConnectionCredentialRouteContext = {
  params: Promise<{ connectionId: string }>;
};

const disabledCredentialRouteConfig = Object.freeze({});

export const credentialRouteConfigs = Object.freeze({
  create: disabledCredentialRouteConfig,
  update: disabledCredentialRouteConfig,
  rotate: disabledCredentialRouteConfig,
  clear: disabledCredentialRouteConfig,
  revoke: disabledCredentialRouteConfig,
});

const noStoreHeaders = Object.freeze({ 'cache-control': 'no-store' } as const);

const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '机构 HIS 连接凭证操作暂未启用。',
});

function capabilityDisabledResponse() {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: noStoreHeaders,
  });
}

/**
 * Credential mutation routes remain fail-closed until the institution authorization,
 * persistence, audit, and credential-storage boundaries are approved for runtime use.
 * Do not inspect request or route input, initialize dependencies, or touch credentials here.
 */
export function handleMutationCredentialRoute(
  _request: Request,
  _context: HisConnectionCredentialRouteContext,
  _config: unknown,
) {
  return capabilityDisabledResponse();
}

export function handleReasonCredentialRoute(
  _request: Request,
  _context: HisConnectionCredentialRouteContext,
  _config: unknown,
) {
  return capabilityDisabledResponse();
}
