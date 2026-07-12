import { NextResponse } from 'next/server';

import {
  WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY,
  WE_COM_CUSTOMER_BROADCAST_TASK_PROOF_KIND,
} from '@/modules/institution/domain/wecom-customer-broadcast-task-provider';
import {
  evaluateBroadcastTaskPreflight,
  issueBroadcastTaskConfirmation,
  rejectBroadcastTaskExecutionBecauseProviderDisabled,
} from '@/modules/institution/server/wecom-real-send-execution-shell-service';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

const MAX_BODY_BYTES = 1024;
const NO_STORE_HEADERS = { 'cache-control': 'no-store' } as const;

type RouteContext = { params: Promise<{ draftId: string }> };
type AuthorizedContext = AccessContext & {
  source: 'server_session';
  scope: 'tenant';
  tenantId: string;
  institutionId: string;
  role: 'tenant_admin';
};
type RequestBody =
  | Readonly<{ action: 'issue_confirmation' }>
  | Readonly<{
      action: 'create_task_once';
      operationRef: string;
      confirmationToken: string;
    }>;

function jsonNoStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

function accessResponse(request: Request):
  | { ok: true; context: AuthorizedContext }
  | { ok: false; response: NextResponse } {
  const context = getDemoAccessContextFromRequest(request);
  if (!context) {
    return { ok: false, response: jsonNoStore({ error: '请先登录' }, 401) };
  }
  const decision = canAccessResource({
    context,
    resource: 'real_channel',
    action: 'execute_once',
    targetTenantId: context.tenantId,
  });
  if (
    !decision.allowed ||
    context.source !== 'server_session' ||
    context.scope !== 'tenant' ||
    !context.tenantId ||
    !context.institutionId ||
    context.role !== 'tenant_admin'
  ) {
    return { ok: false, response: jsonNoStore({ error: '没有访问权限' }, 403) };
  }
  return { ok: true, context: context as AuthorizedContext };
}

function requestDraftId(value: string) {
  const draftId = value.trim();
  return draftId && draftId.length <= 64 ? draftId : null;
}

function isJsonContentType(request: Request) {
  const mediaType = request.headers.get('content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase();
  return mediaType === 'application/json';
}

async function readBoundedJsonBody(request: Request): Promise<
  | { ok: true; value: unknown }
  | { ok: false; code: 'body_too_large' | 'invalid_request'; status: 413 | 400 }
> {
  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return { ok: false, code: 'body_too_large', status: 413 };
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
      return { ok: false, code: 'body_too_large', status: 413 };
    }
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, code: 'invalid_request', status: 400 };
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function hasExactKeys(input: Record<string, unknown>, expectedKeys: readonly string[]) {
  const actual = Object.keys(input).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseRequestBody(input: unknown): RequestBody | null {
  if (!isRecord(input) || typeof input.action !== 'string') return null;
  if (input.action === 'issue_confirmation') {
    return hasExactKeys(input, ['action']) ? { action: 'issue_confirmation' } : null;
  }
  if (input.action !== 'create_task_once' || !hasExactKeys(
    input,
    ['action', 'operationRef', 'confirmationToken'],
  )) return null;

  const operationRef = typeof input.operationRef === 'string' ? input.operationRef.trim() : '';
  const confirmationToken = typeof input.confirmationToken === 'string'
    ? input.confirmationToken.trim()
    : '';
  if (
    !operationRef ||
    operationRef.length > 96 ||
    !confirmationToken ||
    confirmationToken.length > 256
  ) return null;
  return { action: 'create_task_once', operationRef, confirmationToken };
}

function capabilityPayload() {
  return {
    proofKind: WE_COM_CUSTOMER_BROADCAST_TASK_PROOF_KIND,
    directSend: WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY.directSend,
    requiresEmployeeConfirmation:
      WE_COM_CUSTOMER_BROADCAST_TASK_CAPABILITY.requiresEmployeeConfirmation,
  };
}

export async function GET(request: Request, { params }: RouteContext) {
  const access = accessResponse(request);
  if (!access.ok) return access.response;
  const draftId = requestDraftId((await params).draftId);
  if (!draftId) return jsonNoStore({ code: 'draft_not_found', error: '记录不存在' }, 404);

  try {
    const result = await evaluateBroadcastTaskPreflight({
      context: access.context,
      draftId,
      occurredAt: new Date().toISOString(),
    });
    return jsonNoStore(result);
  } catch {
    return jsonNoStore({ code: 'service_unavailable', error: '数据服务暂时不可用' }, 503);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const access = accessResponse(request);
  if (!access.ok) return access.response;
  const draftId = requestDraftId((await params).draftId);
  if (!draftId) return jsonNoStore({ code: 'draft_not_found', error: '记录不存在' }, 404);
  if (!isJsonContentType(request)) {
    return jsonNoStore(
      { code: 'unsupported_media_type', error: 'Content-Type 必须为 application/json' },
      415,
    );
  }

  const body = await readBoundedJsonBody(request);
  if (!body.ok) return jsonNoStore({ code: body.code, error: '请求格式不正确' }, body.status);
  const parsed = parseRequestBody(body.value);
  if (!parsed) return jsonNoStore({ code: 'invalid_request', error: '请求格式不正确' }, 400);

  try {
    if (parsed.action === 'create_task_once') {
      const result = rejectBroadcastTaskExecutionBecauseProviderDisabled({
        operationRef: parsed.operationRef,
      });
      return jsonNoStore({
        status: 'blocked',
        ...capabilityPayload(),
        reasonCode: result.reasonCode,
        operationRef: result.operationRef,
      }, 503);
    }

    const result = await issueBroadcastTaskConfirmation({
      context: access.context,
      draftId,
      occurredAt: new Date().toISOString(),
      createId: () => globalThis.crypto.randomUUID(),
    });
    if (result.kind === 'blocked') {
      return jsonNoStore({
        status: 'blocked',
        ...capabilityPayload(),
        reasonCode: result.reasonCode,
      }, result.reasonCode === 'proof_environment_unavailable' ? 503 : 422);
    }
    if (result.kind === 'existing') {
      return jsonNoStore({
        status: 'blocked',
        ...capabilityPayload(),
        reasonCode: 'confirmation_already_issued',
        operationRef: result.operationRef,
        operationStatus: result.operationStatus,
      }, 409);
    }
    return jsonNoStore({
      status: 'ready',
      ...capabilityPayload(),
      reasonCode: 'confirmation_issued',
      operationRef: result.operationRef,
      confirmationToken: result.confirmationToken,
      expiresAt: result.expiresAt,
    });
  } catch {
    return jsonNoStore({ code: 'service_unavailable', error: '数据服务暂时不可用' }, 503);
  }
}
