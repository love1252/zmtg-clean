import { NextResponse } from 'next/server';
import {
  weComReachOutConsentActions,
  weComReachOutConsentConfirmations,
  weComReachOutConsentSourceTypes,
  decideWeComReachOutConsentTransition,
  type WeComReachOutConsentAction,
  type WeComReachOutConsentSourceType,
} from '@/modules/institution/domain/trusted-reachout-safety';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { createTrustedReachOutSafetyRepository } from '@/modules/institution/server/trusted-reachout-safety-repository';
import {
  readWeComReachOutSafety,
  recordWeComReachOutConsent,
} from '@/modules/institution/server/trusted-reachout-safety-service';
import { runTrustedReachOutSafetyTransaction } from '@/modules/institution/server/trusted-reachout-safety-transaction';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

const requestKeys = ['action', 'sourceType', 'confirmation'] as const;
const requestMaxBytes = 512;

type ConsentRequest = {
  action: WeComReachOutConsentAction;
  sourceType: WeComReachOutConsentSourceType;
  confirmation: string;
};

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `reachout_${Date.now()}`;
}

function accessResponse(request: Request, action: 'read' | 'update'):
  | { ok: true; context: AccessContext & { tenantId: string; institutionId: string } }
  | { ok: false; response: NextResponse } {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) return { ok: false, response: NextResponse.json({ error: '请先登录' }, { status: 401 }) };
  const decision = canAccessResource({ context, resource: 'customer', action, targetTenantId: context.tenantId });
  if (!decision.allowed || !context.tenantId || !context.institutionId) {
    return { ok: false, response: NextResponse.json({ error: '没有访问权限' }, { status: 403 }) };
  }
  return { ok: true, context: context as AccessContext & { tenantId: string; institutionId: string } };
}

async function readJsonBody(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > requestMaxBytes) {
    return { ok: false as const, reason: 'body_too_large' as const };
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > requestMaxBytes) {
      return { ok: false as const, reason: 'body_too_large' as const };
    }
    return { ok: true as const, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const, reason: 'invalid_request' as const };
  }
}

function parseRequest(value: unknown): ConsentRequest | null {
  if (!value || Object.prototype.toString.call(value) !== '[object Object]') return null;
  const keys = Object.keys(value);
  if (keys.length !== requestKeys.length || !requestKeys.every((key) => keys.includes(key))) return null;
  const body = value as Record<string, unknown>;
  if (!weComReachOutConsentActions.includes(body.action as WeComReachOutConsentAction)) return null;
  if (!weComReachOutConsentSourceTypes.includes(body.sourceType as WeComReachOutConsentSourceType)) return null;
  const action = body.action as WeComReachOutConsentAction;
  if (body.confirmation !== weComReachOutConsentConfirmations[action]) return null;
  const sourceType = body.sourceType as WeComReachOutConsentSourceType;
  if (decideWeComReachOutConsentTransition({
    action,
    sourceType,
    confirmation: weComReachOutConsentConfirmations[action],
  }).kind !== 'transition') return null;
  return {
    action,
    sourceType,
    confirmation: weComReachOutConsentConfirmations[action],
  };
}

function customerIdFrom(params: Promise<{ customerId: string }>) {
  return params.then(({ customerId }) => customerId.trim());
}

export async function GET(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const access = accessResponse(request, 'read');
  if (!access.ok) return access.response;
  const customerId = await customerIdFrom(params);
  if (!customerId || customerId.length > 64) return NextResponse.json({ error: '客户不存在或不属于当前机构' }, { status: 404 });

  try {
    const database = getDatabase();
    const result = await readWeComReachOutSafety({
      scope: { tenantId: access.context.tenantId, institutionId: access.context.institutionId, customerId },
      repositories: {
        customerRepository: createTenantBusinessRepository(database),
        safetyRepository: createTrustedReachOutSafetyRepository(database),
      },
    });
    if (result.kind === 'customer_not_found') {
      return NextResponse.json({ code: 'customer_not_found', error: '客户不存在或不属于当前机构' }, { status: 404 });
    }
    const canWrite = canAccessResource({
      context: access.context, resource: 'customer', action: 'update', targetTenantId: access.context.tenantId,
    }).allowed;
    return NextResponse.json({ safety: result.safety, canWrite, channelType: 'wechat_work' });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const access = accessResponse(request, 'update');
  if (!access.ok) return access.response;
  const customerId = await customerIdFrom(params);
  if (!customerId || customerId.length > 64) return NextResponse.json({ error: '客户不存在或不属于当前机构' }, { status: 404 });

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({
      code: body.reason,
      error: body.reason === 'body_too_large' ? '请求体不能超过 512 bytes' : '请求格式不正确',
    }, { status: body.reason === 'body_too_large' ? 413 : 400 });
  }
  const parsed = parseRequest(body.value);
  if (!parsed) return NextResponse.json({ code: 'invalid_request', error: '请求格式不正确' }, { status: 400 });

  try {
    const database = getDatabase();
    const result = await runTrustedReachOutSafetyTransaction(database, (repositories) =>
      recordWeComReachOutConsent({
        context: access.context,
        scope: { tenantId: access.context.tenantId, institutionId: access.context.institutionId, customerId },
        ...parsed,
        occurredAt: new Date().toISOString(),
        createId,
        repositories,
      }));
    if (result.kind === 'customer_not_found') {
      return NextResponse.json({ code: 'customer_not_found', error: '客户不存在或不属于当前机构' }, { status: 404 });
    }
    if (result.kind === 'invalid_action') {
      return NextResponse.json({ code: 'invalid_request', error: '请求格式不正确' }, { status: 400 });
    }
    if (result.kind === 'conflict') {
      return NextResponse.json({ code: 'conflict', error: '许可状态已变化，请刷新后重试' }, { status: 409 });
    }
    return NextResponse.json({ outcome: result.kind, consent: {
      status: result.consent.status,
      sourceType: result.consent.sourceType,
      recordedAt: result.consent.recordedAt,
    } });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
