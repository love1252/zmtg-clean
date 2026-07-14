import { NextResponse } from 'next/server';
import { types as nodeTypes } from 'node:util';

import {
  decodeDemoSession,
  DEMO_SESSION_COOKIE,
  readCookieValue,
} from '@/modules/auth/server/demo-session';
import type { AuthSession } from '@/modules/auth/domain/session';
import type {
  WeComCustomerMappingReviewActionCommand,
  WeComCustomerMappingReviewFailureCode,
} from '@/modules/institution/domain/wecom-customer-mapping-review-actions';
import type {
  WeComCustomerMappingReviewActionMockRuntime,
} from '@/modules/institution/server/wecom-customer-mapping-review-action-mock-runtime';
import {
  canAccessResource,
  type AccessContext,
  type AccessDecision,
} from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import {
  validateSameOriginMutationRequest,
  type SameOriginMutationValidationResult,
} from '@/modules/security/server/mutation-request-security';

const MAX_BODY_BYTES = 4096;
const MAX_BODY_CHUNKS = 128;
const contentLengthPattern = /^(?:0|[1-9][0-9]*)$/;
const mappingIdPattern = /^[A-Za-z0-9_-]{1,64}$/;
const requestKeys = ['action', 'expectedVersion', 'idempotencyKey', 'reasonCode', 'note'] as const;
const requiredRequestKeys = ['action', 'expectedVersion', 'idempotencyKey', 'reasonCode'] as const;
const noStoreHeaders = { 'cache-control': 'no-store' } as const;
const capturedIsProxy = nodeTypes.isProxy;
const capturedIsUint8Array = nodeTypes.isUint8Array;
const capturedGetPrototypeOf = Object.getPrototypeOf;
const capturedOwnKeys = Reflect.ownKeys;
const capturedGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

type RouteContext = Readonly<{ params: Promise<{ mappingId: string }> }>;
type AuthorizedContext = AccessContext & {
  scope: 'tenant';
  tenantId: string;
  institutionId: string;
};
type HandlerDependencies = Readonly<{
  runtime: WeComCustomerMappingReviewActionMockRuntime;
  getSession?: (request: Request) => AuthSession | null;
  getAccessContext?: (request: Request) => AccessContext | null;
  canAccess?: (input: Parameters<typeof canAccessResource>[0]) => AccessDecision;
  validateOrigin?: (request: Request) => SameOriginMutationValidationResult;
}>;

type ErrorCode =
  | WeComCustomerMappingReviewFailureCode
  | 'method_not_allowed'
  | 'unsupported_media_type'
  | 'request_body_too_large'
  | 'request_body_length_invalid'
  | 'request_body_length_mismatch'
  | 'request_body_encoding_invalid'
  | 'csrf_validation_failed'
  | 'mock_runtime_capacity_exceeded';

function jsonNoStore(payload: unknown, status: number) {
  return NextResponse.json(payload, { status, headers: noStoreHeaders });
}

function errorResponse(code: ErrorCode, status: number) {
  return jsonNoStore({ code }, status);
}

function mediaTypeIsJson(request: Request) {
  return request.headers.get('content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase() === 'application/json';
}

type BoundedBodyReadFailureReason =
  | 'body_too_large'
  | 'body_length_invalid'
  | 'body_length_mismatch'
  | 'body_encoding_invalid'
  | 'body_missing';

type BoundedBodyReadResult =
  | { ok: true; text: string }
  | { ok: false; reason: BoundedBodyReadFailureReason };

function parseContentLength(value: string | null):
  | { ok: true; value: number | null }
  | { ok: false } {
  if (value === null) return { ok: true, value: null };
  if (!contentLengthPattern.test(value)) return { ok: false };
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? { ok: true, value: parsed } : { ok: false };
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try {
    await reader.cancel();
  } catch {
    // Cancellation is best-effort; the response remains fail-closed.
  }
}

async function readBoundedBody(request: Request): Promise<BoundedBodyReadResult> {
  const parsedLength = parseContentLength(request.headers.get('content-length'));
  if (!parsedLength.ok) return { ok: false, reason: 'body_length_invalid' };
  if (parsedLength.value !== null && parsedLength.value > MAX_BODY_BYTES) {
    return { ok: false, reason: 'body_too_large' };
  }
  if (!request.body) return { ok: false, reason: 'body_missing' };

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch {
    return { ok: false, reason: 'body_encoding_invalid' };
  }
  let chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let chunkCount = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      if (!capturedIsUint8Array(item.value)) {
        chunks = [];
        await cancelReader(reader);
        return { ok: false, reason: 'body_encoding_invalid' };
      }
      chunkCount += 1;
      totalBytes += item.value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        chunks = [];
        await cancelReader(reader);
        return { ok: false, reason: 'body_too_large' };
      }
      if (chunkCount > MAX_BODY_CHUNKS) {
        chunks = [];
        await cancelReader(reader);
        return { ok: false, reason: 'body_length_invalid' };
      }
      chunks.push(item.value);
    }
  } catch {
    chunks = [];
    await cancelReader(reader);
    return { ok: false, reason: 'body_encoding_invalid' };
  }

  if (parsedLength.value !== null && totalBytes !== parsedLength.value) {
    chunks = [];
    return { ok: false, reason: 'body_length_mismatch' };
  }
  if (totalBytes === 0) return { ok: false, reason: 'body_missing' };

  try {
    const body = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    chunks = [];
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(body) };
  } catch {
    chunks = [];
    return { ok: false, reason: 'body_encoding_invalid' };
  }
}

function bodyReadErrorResponse(reason: BoundedBodyReadFailureReason) {
  switch (reason) {
    case 'body_too_large':
      return errorResponse('request_body_too_large', 413);
    case 'body_length_invalid':
      return errorResponse('request_body_length_invalid', 400);
    case 'body_length_mismatch':
      return errorResponse('request_body_length_mismatch', 400);
    case 'body_encoding_invalid':
      return errorResponse('request_body_encoding_invalid', 400);
    case 'body_missing':
      return errorResponse('request_contract_invalid', 400);
  }
}

function captureExactRequest(value: unknown): Omit<WeComCustomerMappingReviewActionCommand, 'mappingId'> | null {
  if (value === null || typeof value !== 'object' || capturedIsProxy(value) || Array.isArray(value)) return null;
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  try {
    prototype = capturedGetPrototypeOf(value);
    keys = capturedOwnKeys(value);
  } catch {
    return null;
  }
  if (prototype !== Object.prototype && prototype !== null) return null;
  if (keys.some((key) => typeof key !== 'string')) return null;
  const stringKeys = keys as string[];
  if (
    stringKeys.some((key) => !requestKeys.includes(key as (typeof requestKeys)[number]))
    || requiredRequestKeys.some((key) => !stringKeys.includes(key))
  ) return null;

  const captured: Record<string, unknown> = Object.create(null);
  for (const key of stringKeys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = capturedGetOwnPropertyDescriptor(value, key);
    } catch {
      return null;
    }
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor) || descriptor.get || descriptor.set) {
      return null;
    }
    captured[key] = descriptor.value;
  }
  return captured as Omit<WeComCustomerMappingReviewActionCommand, 'mappingId'>;
}

function statusForDomainFailure(code: WeComCustomerMappingReviewFailureCode) {
  switch (code) {
    case 'request_contract_invalid':
    case 'sensitive_input_blocked':
    case 'idempotency_key_invalid':
      return 400;
    case 'unauthenticated':
      return 401;
    case 'permission_denied':
    case 'tenant_context_missing':
    case 'tenant_mismatch':
      return 403;
    case 'mapping_unavailable':
      return 404;
    case 'action_not_allowed':
    case 'version_conflict':
    case 'idempotency_conflict':
    case 'idempotency_in_progress':
    case 'idempotency_record_invalid':
      return 409;
    default:
      return 503;
  }
}

function authenticatedSessionFromRequest(request: Request) {
  return decodeDemoSession(
    readCookieValue(request.headers.get('cookie'), DEMO_SESSION_COOKIE),
  );
}

export function createWeComCustomerMappingReviewActionsPostHandler(
  dependencies: HandlerDependencies,
) {
  const getSession = dependencies.getSession ?? authenticatedSessionFromRequest;
  const getAccessContext = dependencies.getAccessContext ?? getDemoAccessContextFromRequest;
  const canAccess = dependencies.canAccess ?? canAccessResource;
  const validateOrigin = dependencies.validateOrigin ?? validateSameOriginMutationRequest;

  return async function post(
    request: Request,
    routeContext: RouteContext,
  ): Promise<NextResponse> {
    if (request.method !== 'POST') return errorResponse('method_not_allowed', 405);

    const session = getSession(request);
    if (!session) return errorResponse('unauthenticated', 401);

    if (!mediaTypeIsJson(request)) return errorResponse('unsupported_media_type', 415);

    if (!validateOrigin(request).ok) return errorResponse('csrf_validation_failed', 403);

    const body = await readBoundedBody(request);
    if (!body.ok) return bodyReadErrorResponse(body.reason);

    const context = getAccessContext(request);
    if (
      !context
      || context.scope !== 'tenant'
      || !context.tenantId
      || !context.institutionId
    ) return errorResponse('permission_denied', 403);
    const authorizedContext = context as AuthorizedContext;

    const readDecision = canAccess({
      context: authorizedContext,
      resource: 'customer',
      action: 'read',
      targetTenantId: authorizedContext.tenantId,
    });
    const mutationDecision = canAccess({
      context: authorizedContext,
      resource: 'customer',
      action: 'mapping_review',
      targetTenantId: authorizedContext.tenantId,
    });
    if (!readDecision.allowed || !mutationDecision.allowed) {
      return errorResponse('permission_denied', 403);
    }

    let rawBody: unknown;
    try {
      rawBody = JSON.parse(body.text) as unknown;
    } catch {
      return errorResponse('request_contract_invalid', 400);
    }
    const parsed = captureExactRequest(rawBody);
    if (!parsed) return errorResponse('request_contract_invalid', 400);

    const { mappingId } = await routeContext.params;
    if (!mappingIdPattern.test(mappingId)) return errorResponse('request_contract_invalid', 400);

    const ownership = dependencies.runtime.resolveMappingOwnership({
      tenantId: authorizedContext.tenantId,
      institutionId: authorizedContext.institutionId,
      mappingId,
    });
    if (ownership === 'mock_runtime_capacity_exceeded') {
      return errorResponse('mock_runtime_capacity_exceeded', 503);
    }
    if (ownership === 'transaction_failed') return errorResponse('transaction_failed', 503);
    if (ownership === 'mapping_unavailable') return errorResponse('mapping_unavailable', 404);

    try {
      const result = dependencies.runtime.execute({
        context: authorizedContext,
        command: { mappingId, ...parsed },
      });
      if (!result.ok) {
        if (result.reasonCode === 'mock_runtime_capacity_exceeded') {
          return errorResponse(result.reasonCode, 503);
        }
        return errorResponse(result.reasonCode, statusForDomainFailure(result.reasonCode));
      }
      return jsonNoStore(result.responsePayload, 200);
    } catch {
      return errorResponse('transaction_failed', 503);
    }
  };
}
