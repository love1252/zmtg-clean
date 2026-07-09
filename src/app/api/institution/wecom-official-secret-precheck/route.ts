import { NextResponse } from 'next/server';
import { evaluateWeComOfficialSecretPrecheck, summarizeWeComOfficialSecretPrecheckConfig, type WeComOfficialSecretPrecheckAction } from '@/modules/institution/domain/wecom-official-secret-precheck';
import { createWeComOfficialTokenPreflightClient, readWeComOfficialSecretPrecheckConfig } from '@/modules/institution/server/wecom-official-secret-precheck-runtime';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

function isPrecheckAction(value: unknown): value is WeComOfficialSecretPrecheckAction {
  return value === 'preflight' || value === 'send';
}

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

function extractAction(value: unknown): WeComOfficialSecretPrecheckAction | null {
  if (typeof value !== 'object' || value === null) return null;
  const action = (value as { action?: unknown }).action;
  return isPrecheckAction(action) ? action : null;
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

export async function GET(request: Request) {
  const forbidden = forbiddenResponse(request, { resource: 'real_channel', action: 'read' });
  if (forbidden) return forbidden;

  const config = readWeComOfficialSecretPrecheckConfig();
  return NextResponse.json(summarizeWeComOfficialSecretPrecheckConfig(config));
}

export async function POST(request: Request) {
  const forbidden = forbiddenResponse(request, { resource: 'open_connection', action: 'test_connection' });
  if (forbidden) return forbidden;

  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });

  const action = extractAction(body.value);
  if (!action) return NextResponse.json({ error: 'invalid_action', reason: 'invalid_action' }, { status: 400 });

  const config = readWeComOfficialSecretPrecheckConfig();
  const result = await evaluateWeComOfficialSecretPrecheck({
    config,
    action,
    tokenClient: action === 'preflight' && config.networkEnabled
      ? createWeComOfficialTokenPreflightClient()
      : undefined,
  });

  return NextResponse.json(result);
}
