import { NextResponse } from 'next/server';
import { evaluateWeComCustomerContactPrecheck, type WeComCustomerContactPrecheckAction } from '@/modules/institution/domain/wecom-customer-contact-precheck';
import { readWeComCustomerContactPrecheckConfig } from '@/modules/institution/server/wecom-customer-contact-precheck-runtime';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

function isPrecheckAction(value: unknown): value is WeComCustomerContactPrecheckAction {
  return value === 'evaluate';
}

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

function extractAction(value: unknown): WeComCustomerContactPrecheckAction | null {
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

function evaluateConfig() {
  return evaluateWeComCustomerContactPrecheck(readWeComCustomerContactPrecheckConfig());
}

export async function GET(request: Request) {
  const forbidden = forbiddenResponse(request, { resource: 'real_channel', action: 'read' });
  if (forbidden) return forbidden;

  return NextResponse.json(evaluateConfig());
}

export async function POST(request: Request) {
  const forbidden = forbiddenResponse(request, { resource: 'open_connection', action: 'test_connection' });
  if (forbidden) return forbidden;

  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });

  const action = extractAction(body.value);
  if (!action) return NextResponse.json({ error: 'invalid_action', reason: 'invalid_action' }, { status: 400 });

  return NextResponse.json(evaluateConfig());
}
