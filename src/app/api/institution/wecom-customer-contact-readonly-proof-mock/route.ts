import { NextResponse } from 'next/server';
import { evaluateWeComCustomerContactPrecheck } from '@/modules/institution/domain/wecom-customer-contact-precheck';
import {
  createWeComCustomerContactReadonlyProofMockDetail,
  createWeComCustomerContactReadonlyProofMockList,
} from '@/modules/institution/domain/wecom-customer-contact-readonly-proof-mock';
import { readWeComCustomerContactPrecheckConfig } from '@/modules/institution/server/wecom-customer-contact-precheck-runtime';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

const detailRequestKeys = ['action', 'proofContactId'] as const;

type DetailRequest = {
  action: 'detail';
  proofContactId: string;
};

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

function extractDetailRequest(value: unknown): DetailRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const keys = Object.keys(value);
  if (
    keys.length !== detailRequestKeys.length ||
    !detailRequestKeys.every((key) => keys.includes(key))
  ) {
    return null;
  }

  const body = value as { action?: unknown; proofContactId?: unknown };
  if (
    body.action !== 'detail' ||
    typeof body.proofContactId !== 'string' ||
    body.proofContactId !== body.proofContactId.trim() ||
    !body.proofContactId
  ) {
    return null;
  }

  return { action: body.action, proofContactId: body.proofContactId };
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

function evaluatePrecheck() {
  return evaluateWeComCustomerContactPrecheck(readWeComCustomerContactPrecheckConfig());
}

export async function GET(request: Request) {
  const forbidden = forbiddenResponse(request, { resource: 'real_channel', action: 'read' });
  if (forbidden) return forbidden;

  return NextResponse.json(createWeComCustomerContactReadonlyProofMockList(evaluatePrecheck()));
}

export async function POST(request: Request) {
  const forbidden = forbiddenResponse(request, { resource: 'open_connection', action: 'test_connection' });
  if (forbidden) return forbidden;

  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });

  const detailRequest = extractDetailRequest(body.value);
  if (!detailRequest) {
    return NextResponse.json({ error: 'invalid_detail_request', reason: 'invalid_detail_request' }, { status: 400 });
  }

  const detail = createWeComCustomerContactReadonlyProofMockDetail({
    precheck: evaluatePrecheck(),
    proofContactId: detailRequest.proofContactId,
  });

  if (detail.mockProofStatus === 'mock_contact_not_found') {
    return NextResponse.json(detail, { status: 404 });
  }

  return NextResponse.json(detail);
}
