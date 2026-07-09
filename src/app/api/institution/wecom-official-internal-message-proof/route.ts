import { NextResponse } from 'next/server';
import {
  evaluateWeComOfficialInternalMessageProof,
  summarizeWeComOfficialInternalMessageProofConfig,
  weComOfficialInternalMessageProofAction,
  weComOfficialInternalMessageProofConfirmation,
} from '@/modules/institution/domain/wecom-official-internal-message-proof';
import {
  createWeComOfficialInternalMessageProofClient,
  readWeComOfficialInternalMessageProofConfig,
} from '@/modules/institution/server/wecom-official-internal-message-proof-runtime';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

function forbiddenResponse(
  request: Request,
  permission: { resource: 'real_channel'; action: 'read' } | { resource: 'open_connection'; action: 'test_connection' },
): NextResponse | null {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const decision = canAccessResource({
    context,
    resource: permission.resource,
    action: permission.action,
    targetTenantId: context.tenantId,
  });

  if (!decision.allowed || !context.tenantId) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  return null;
}

function extractProofRequest(value: unknown): { ok: true; confirmed: boolean } | { ok: false; reason: 'invalid_action' | 'invalid_confirmation' } {
  if (typeof value !== 'object' || value === null) return { ok: false, reason: 'invalid_action' };

  const action = (value as { action?: unknown }).action;
  if (action !== weComOfficialInternalMessageProofAction) return { ok: false, reason: 'invalid_action' };

  const confirmation = (value as { confirmation?: unknown }).confirmation;
  if (confirmation !== weComOfficialInternalMessageProofConfirmation) {
    return { ok: false, reason: 'invalid_confirmation' };
  }

  return { ok: true, confirmed: true };
}

export async function GET(request: Request) {
  const forbidden = forbiddenResponse(request, { resource: 'real_channel', action: 'read' });
  if (forbidden) return forbidden;

  const config = readWeComOfficialInternalMessageProofConfig();
  return NextResponse.json(summarizeWeComOfficialInternalMessageProofConfig(config));
}

export async function POST(request: Request) {
  const forbidden = forbiddenResponse(request, { resource: 'open_connection', action: 'test_connection' });
  if (forbidden) return forbidden;

  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });

  const proofRequest = extractProofRequest(body.value);
  if (!proofRequest.ok) {
    return NextResponse.json({ error: proofRequest.reason, reason: proofRequest.reason }, { status: 400 });
  }

  const config = readWeComOfficialInternalMessageProofConfig();
  const result = await evaluateWeComOfficialInternalMessageProof({
    config,
    confirmed: proofRequest.confirmed,
    client: config.networkEnabled && config.realSendEnabled
      ? createWeComOfficialInternalMessageProofClient()
      : undefined,
  });

  return NextResponse.json(result);
}
