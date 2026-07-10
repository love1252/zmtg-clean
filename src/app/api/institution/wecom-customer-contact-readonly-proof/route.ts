import { NextResponse } from 'next/server';
import {
  evaluateWeComCustomerContactReadonlyProof,
  isWeComCustomerContactReadonlyProofExecutionReady,
  summarizeWeComCustomerContactReadonlyProofConfig,
  weComCustomerContactReadonlyProofAction,
  weComCustomerContactReadonlyProofConfirmation,
} from '@/modules/institution/domain/wecom-customer-contact-readonly-proof';
import {
  createWeComCustomerContactReadonlyProofClient,
  readWeComCustomerContactReadonlyProofConfig,
} from '@/modules/institution/server/wecom-customer-contact-readonly-proof-runtime';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

const proofRequestKeys = ['action', 'confirmation'] as const;
const proofRequestMaxBytes = 512;

type ProofRequest = {
  action: typeof weComCustomerContactReadonlyProofAction;
  confirmation: typeof weComCustomerContactReadonlyProofConfirmation;
};

async function readJsonBody(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > proofRequestMaxBytes) {
    return { ok: false as const };
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > proofRequestMaxBytes) {
      return { ok: false as const };
    }
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const };
  }
}

function extractProofRequest(value: unknown): ProofRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const keys = Object.keys(value);
  if (
    keys.length !== proofRequestKeys.length ||
    !proofRequestKeys.every((key) => keys.includes(key))
  ) {
    return null;
  }

  const body = value as { action?: unknown; confirmation?: unknown };
  if (
    body.action !== weComCustomerContactReadonlyProofAction ||
    body.confirmation !== weComCustomerContactReadonlyProofConfirmation
  ) {
    return null;
  }

  return {
    action: body.action,
    confirmation: body.confirmation,
  };
}

function forbiddenResponse(
  request: Request,
  permission:
    | { resource: 'real_channel'; action: 'read' }
    | { resource: 'open_connection'; action: 'test_connection' },
): NextResponse | null {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const decision = canAccessResource({
    context,
    resource: permission.resource,
    action: permission.action,
    targetTenantId: context.tenantId,
  });

  if (!decision.allowed || !context.tenantId || !context.institutionId) {
    return NextResponse.json({ error: '没有访问权限' }, { status: 403 });
  }

  return null;
}

export async function GET(request: Request) {
  const forbidden = forbiddenResponse(request, { resource: 'real_channel', action: 'read' });
  if (forbidden) return forbidden;

  return NextResponse.json(
    summarizeWeComCustomerContactReadonlyProofConfig(
      readWeComCustomerContactReadonlyProofConfig(),
    ),
  );
}

export async function POST(request: Request) {
  const forbidden = forbiddenResponse(request, {
    resource: 'open_connection',
    action: 'test_connection',
  });
  if (forbidden) return forbidden;

  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });

  const proofRequest = extractProofRequest(body.value);
  if (!proofRequest) {
    return NextResponse.json(
      { error: 'invalid_readonly_proof_request', reason: 'invalid_readonly_proof_request' },
      { status: 400 },
    );
  }

  const config = readWeComCustomerContactReadonlyProofConfig();
  const result = await evaluateWeComCustomerContactReadonlyProof({
    config,
    confirmed: true,
    client: isWeComCustomerContactReadonlyProofExecutionReady(config)
      ? createWeComCustomerContactReadonlyProofClient()
      : undefined,
  });

  return NextResponse.json(result);
}
