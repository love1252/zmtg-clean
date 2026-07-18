import { describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/institution/wecom/customer-mapping-reviews/[mappingId]/actions/route';
import { DEMO_SESSION_COOKIE, encodeDemoSession } from '@/modules/auth/server/demo-session';
import { executeWeComCustomerMappingReviewAction } from '@/modules/institution/domain/wecom-customer-mapping-review-actions';
import {
  createWeComCustomerMappingReviewActionsPostHandler,
} from '@/app/api/institution/wecom/customer-mapping-reviews/[mappingId]/actions/handler';
import {
  WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS,
  createWeComCustomerMappingReviewActionMockRuntime,
  type WeComCustomerMappingReviewActionMockRuntime,
  type WeComCustomerMappingReviewMockFixture,
} from '@/modules/institution/server/wecom-customer-mapping-review-action-mock-runtime';
import type { AccessContext } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';
import { validateSameOriginMutationRequest } from '@/modules/security/server/mutation-request-security';

const origin = 'http://localhost';
const routeUrl = `${origin}/api/institution/wecom/customer-mapping-reviews/mock-map-pending/actions`;
const tenantAdmin: AccessContext = {
  userId: 'reviewer-a',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  source: 'server_session',
};
const tenantOperator: AccessContext = {
  ...tenantAdmin,
  userId: 'operator-a',
  role: 'tenant_operator',
};
const readOnlyUser: AccessContext = {
  ...tenantAdmin,
  userId: 'consultant-a',
  role: 'consultant',
};

const fixtures: readonly WeComCustomerMappingReviewMockFixture[] = [
  { mappingId: 'mock-map-pending', tenantId: 'tenant-a', institutionId: 'institution-a', state: 'pending_review', version: 0 },
  { mappingId: 'mock-map-more-info', tenantId: 'tenant-a', institutionId: 'institution-a', state: 'needs_more_info', version: 4 },
  { mappingId: 'mock-map-conflict', tenantId: 'tenant-a', institutionId: 'institution-a', state: 'conflict', version: 2 },
  { mappingId: 'mock-map-approved', tenantId: 'tenant-a', institutionId: 'institution-a', state: 'approved_pending_link', version: 8 },
  { mappingId: 'mock-map-disabled', tenantId: 'tenant-a', institutionId: 'institution-a', state: 'disabled', version: 3 },
  { mappingId: 'mock-map-tenant-b', tenantId: 'tenant-b', institutionId: 'institution-b', state: 'pending_review', version: 0 },
  { mappingId: 'mock-map-shared', tenantId: 'tenant-a', institutionId: 'institution-a', state: 'pending_review', version: 0 },
  { mappingId: 'mock-map-shared', tenantId: 'tenant-b', institutionId: 'institution-b', state: 'pending_review', version: 7 },
];

const validBody = (overrides: Record<string, unknown> = {}) => ({
  action: 'approve_candidate',
  expectedVersion: 0,
  idempotencyKey: 'idem-key-00000001',
  reasonCode: 'manual_evidence_confirmed',
  ...overrides,
});

function request(
  body: unknown = validBody(),
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    rawBody?: string;
  } = {},
) {
  return new Request(options.url ?? routeUrl, {
    method: options.method ?? 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'sec-fetch-site': 'same-origin',
      ...options.headers,
    },
    body: options.method === 'GET'
      ? undefined
      : options.rawBody ?? JSON.stringify(body),
  });
}

function streamRequest(input: {
  chunks: readonly Uint8Array[];
  contentLength?: string;
  onPull?: (index: number) => void;
  onCancel?: (reason: unknown) => void;
  requestMethodSpies?: boolean;
}) {
  let nextChunk = 0;
  let providedBytes = 0;
  let cancelCount = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      input.onPull?.(nextChunk);
      if (nextChunk >= input.chunks.length) {
        controller.close();
        return;
      }
      const chunk = input.chunks[nextChunk++];
      providedBytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel(reason) {
      cancelCount += 1;
      input.onCancel?.(reason);
    },
  }, { highWaterMark: 0 });
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin,
    'sec-fetch-site': 'same-origin',
  };
  if (input.contentLength !== undefined) headers['content-length'] = input.contentLength;
  const result = new Request(routeUrl, {
    method: 'POST',
    headers,
    body: stream,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  const textSpy = input.requestMethodSpies ? vi.spyOn(result, 'text') : null;
  const arrayBufferSpy = input.requestMethodSpies ? vi.spyOn(result, 'arrayBuffer') : null;
  const jsonSpy = input.requestMethodSpies ? vi.spyOn(result, 'json') : null;
  const formDataSpy = input.requestMethodSpies ? vi.spyOn(result, 'formData') : null;
  return {
    request: result,
    get providedBytes() { return providedBytes; },
    get pullCount() { return nextChunk; },
    get cancelCount() { return cancelCount; },
    methodSpies: [textSpy, arrayBufferSpy, jsonSpy, formDataSpy].filter(Boolean) as ReturnType<typeof vi.spyOn>[],
  };
}

function params(mappingId = 'mock-map-pending') {
  return { params: Promise.resolve({ mappingId }) };
}

function setup(options: {
  context?: AccessContext | null;
  runtime?: WeComCustomerMappingReviewActionMockRuntime;
  now?: () => number;
  runtimeOptions?: Parameters<typeof createWeComCustomerMappingReviewActionMockRuntime>[0];
} = {}) {
  const runtime = options.runtime ?? createWeComCustomerMappingReviewActionMockRuntime({
    fixtures,
    now: options.now,
    ...options.runtimeOptions,
  });
  const handler = createWeComCustomerMappingReviewActionsPostHandler({
    runtime,
    getSession: () => options.context === null ? null : ({ authenticatedForTest: true } as never),
    getAccessContext: () => options.context === undefined ? tenantAdmin : options.context,
  });
  return { handler, runtime };
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function expectNoStore(response: Response) {
  expect(response.headers.get('cache-control')).toBe('no-store');
}

function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expectNoStore(response);
  return expect(response.json()).resolves.toEqual({ code });
}

function successKeys() {
  return [
    'action',
    'auditSummary',
    'autoMergePerformed',
    'idempotentReplay',
    'mappingId',
    'mockDemo',
    'nextStatus',
    'nextVersion',
    'ok',
    'persistenceMode',
    'previousStatus',
    'previousVersion',
    'realCustomerRelationshipWritten',
    'reasonCode',
  ].sort();
}

describe('POST 企业微信客户匹配人工复核路由关闭与 handler 单测', () => {
  it('route 对所有输入 capability-off，既不读取请求/参数也不返回 mock 或事实字段', async () => {
    let requestTrapCount = 0;
    let contextTrapCount = 0;
    const hostileRequest = new Proxy({}, {
      get() {
        requestTrapCount += 1;
        throw new Error('request must not be read');
      },
      ownKeys() {
        requestTrapCount += 1;
        throw new Error('request keys must not be read');
      },
    }) as Request;
    const hostileContext = new Proxy({}, {
      get() {
        contextTrapCount += 1;
        throw new Error('params must not be read');
      },
      ownKeys() {
        contextTrapCount += 1;
        throw new Error('params keys must not be read');
      },
    }) as { params: Promise<{ mappingId: string }> };
    const oversized = streamRequest({
      chunks: [new Uint8Array(4097)],
      requestMethodSpies: true,
    });
    const crossScopeSession = encodeDemoSession({
      user: {
        id: 'demo-user-tenant-b',
        username: 'tenant-b',
        name: '机构 B 管理员',
        role: 'tenant_admin',
        tenantId: 'tenant-b',
        institutionId: 'institution-b',
      },
      expiresAt: Date.now() + 60_000,
      source: 'demo_session',
    });
    const responses = await Promise.all([
      POST(request(), params()),
      POST(request({ invalid: true }), params('invalid-mapping')),
      POST(request(validBody(), {
        headers: { cookie: `${DEMO_SESSION_COOKIE}=${crossScopeSession}` },
      }), params('mock-map-pending')),
      POST(request(undefined, {
        url: routeUrl.replace('mock-map-pending', 'mock-map-tenant-b'),
      }), params('mock-map-tenant-b')),
      POST(oversized.request, params('mock-map-pending')),
      POST(hostileRequest, hostileContext),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(503);
      expectNoStore(response);
      await expect(response.json()).resolves.toEqual({ code: 'capability_disabled' });
    }
    expect(requestTrapCount).toBe(0);
    expect(contextTrapCount).toBe(0);
    expect(oversized.pullCount).toBe(0);
    for (const spy of oversized.methodSpies) expect(spy).not.toHaveBeenCalled();
  });

  it('未登录先返回 401，且不因 Content-Type 泄漏后续校验', async () => {
    const { handler } = setup({ context: null });
    const response = await handler(request(undefined, { headers: { 'content-type': 'text/plain' } }), params());
    await expectError(response, 401, 'unauthenticated');
  });

  it('只有 customer:read 的角色不能替代 mapping_review mutation 权限', async () => {
    const { handler } = setup({ context: readOnlyUser });
    await expectError(await handler(request(), params()), 403, 'permission_denied');
  });

  it.each([
    ['platform scope', { ...tenantAdmin, role: 'platform_admin', scope: 'platform', tenantId: null, institutionId: null } as AccessContext],
    ['缺 tenant', { ...tenantAdmin, tenantId: null } as AccessContext],
    ['缺 institution', { ...tenantAdmin, institutionId: null } as AccessContext],
  ])('%s fail-closed 为 403', async (_label, context) => {
    const { handler } = setup({ context });
    await expectError(await handler(request(), params()), 403, 'permission_denied');
  });

  it('跨租户、跨机构与未知 mapping 使用相同低敏响应，且不改变目标 mapping', async () => {
    const { handler, runtime } = setup();
    const crossTenant = await handler(
      request(undefined, { url: routeUrl.replace('mock-map-pending', 'mock-map-tenant-b') }),
      params('mock-map-tenant-b'),
    );
    const unknown = await handler(request(), params('unknown-map'));
    const crossInstitutionHandler = createWeComCustomerMappingReviewActionsPostHandler({
      runtime,
      getSession: () => ({ authenticatedForTest: true } as never),
      getAccessContext: () => ({ ...tenantAdmin, institutionId: 'institution-other' }),
    });
    const crossInstitution = await crossInstitutionHandler(request(), params('mock-map-pending'));
    for (const response of [crossTenant, crossInstitution, unknown]) {
      await expectError(response, 404, 'mapping_unavailable');
    }
    const tenantB = { ...tenantAdmin, userId: 'reviewer-b', tenantId: 'tenant-b', institutionId: 'institution-b' };
    const tenantBHandler = createWeComCustomerMappingReviewActionsPostHandler({
      runtime,
      getSession: () => ({ authenticatedForTest: true } as never),
      getAccessContext: () => tenantB,
    });
    const success = await tenantBHandler(
      request(undefined, { url: routeUrl.replace('mock-map-pending', 'mock-map-tenant-b') }),
      params('mock-map-tenant-b'),
    );
    expect(success.status).toBe(200);
    expect(await success.json()).toMatchObject({ previousVersion: 0, nextVersion: 1 });
  });

  it.each([
    ['缺 Origin', { origin: '' }],
    ['跨源 Origin', { origin: 'https://attacker.invalid' }],
    ['cross-site fetch metadata', { 'sec-fetch-site': 'cross-site' }],
  ])('%s 使用固定低敏 CSRF code', async (_label, headers) => {
    const { handler } = setup();
    await expectError(await handler(request(undefined, { headers }), params()), 403, 'csrf_validation_failed');
  });

  it.each(['text/plain', 'application/problem+json', 'application/jsonp'])(
    '拒绝非 JSON Content-Type：%s',
    async (contentType) => {
      const { handler } = setup();
      await expectError(
        await handler(request(undefined, { headers: { 'content-type': contentType } }), params()),
        415,
        'unsupported_media_type',
      );
    },
  );

  it.each([
    ['合法且小于上限', '128', 128, 400, 'request_contract_invalid'],
    ['精确等于上限', '4096', 4096, 400, 'request_contract_invalid'],
    ['负数', '-1', 0, 400, 'request_body_length_invalid'],
    ['小数', '1.5', 0, 400, 'request_body_length_invalid'],
    ['前后空格', ' 32 ', 0, 400, 'request_body_length_invalid'],
    ['逗号多值', '32, 32', 0, 400, 'request_body_length_invalid'],
    ['极大整数', '999999999999999999999999999999', 0, 400, 'request_body_length_invalid'],
    ['非数字', 'abc', 0, 400, 'request_body_length_invalid'],
  ])('Content-Length %s 使用严格十进制规则', async (_label, header, actualBytes, status, code) => {
    const { handler } = setup();
    if (_label === '前后空格') {
      const streamed = streamRequest({ chunks: [], contentLength: '32' });
      const originalGet = streamed.request.headers.get.bind(streamed.request.headers);
      vi.spyOn(streamed.request.headers, 'get').mockImplementation((name) => (
        name.toLowerCase() === 'content-length' ? header : originalGet(name)
      ));
      await expectError(
        await handler(streamed.request, params()),
        400,
        'request_body_length_invalid',
      );
      expect(streamed.pullCount).toBe(0);
      return;
    }
    const body = new Uint8Array(actualBytes).fill(0x20);
    const streamed = streamRequest({ chunks: actualBytes ? [body] : [], contentLength: header });
    await expectError(await handler(streamed.request, params()), status, code);
  });

  it('Content-Length 大于上限时读取 body 前拒绝', async () => {
    const { handler } = setup();
    const streamed = streamRequest({
      chunks: [new Uint8Array(8192)],
      contentLength: '4097',
      requestMethodSpies: true,
    });
    await expectError(await handler(streamed.request, params()), 413, 'request_body_too_large');
    expect(streamed.pullCount).toBe(0);
    expect(streamed.providedBytes).toBe(0);
    expect(streamed.methodSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });

  it('缺失 Content-Length 时允许有界流式读取', async () => {
    const { handler } = setup();
    const encoded = new TextEncoder().encode(JSON.stringify(validBody()));
    const streamed = streamRequest({ chunks: [encoded], requestMethodSpies: true });
    expect((await handler(streamed.request, params())).status).toBe(200);
    expect(streamed.cancelCount).toBe(0);
    expect(streamed.methodSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });

  it('声明较小但实际未超限时固定拒绝长度不一致', async () => {
    const { handler } = setup();
    const encoded = new TextEncoder().encode(JSON.stringify(validBody()));
    const streamed = streamRequest({ chunks: [encoded], contentLength: '32' });
    await expectError(await handler(streamed.request, params()), 400, 'request_body_length_mismatch');

    const declaredLarger = streamRequest({
      chunks: [encoded],
      contentLength: String(encoded.byteLength + 1),
    });
    await expectError(
      await handler(declaredLarger.request, params()),
      400,
      'request_body_length_mismatch',
    );

    const exact = streamRequest({ chunks: [encoded], contentLength: String(encoded.byteLength) });
    expect((await handler(exact.request, params())).status).toBe(200);

    const leadingZero = streamRequest({ chunks: [encoded], contentLength: '01' });
    await expectError(
      await handler(leadingZero.request, params()),
      400,
      'request_body_length_invalid',
    );
    expect(leadingZero.pullCount).toBe(0);
  });

  it('无长度 chunked 流累计超限后立即 cancel，不完整读取且不调用 JSON/domain', async () => {
    const execute = vi.fn();
    const baseRuntime = createWeComCustomerMappingReviewActionMockRuntime({ fixtures });
    const runtime: WeComCustomerMappingReviewActionMockRuntime = {
      readMappingSnapshot: baseRuntime.readMappingSnapshot,
      resolveMappingOwnership: baseRuntime.resolveMappingOwnership,
      execute,
    };
    const { handler } = setup({ runtime });
    const chunks = Array.from({ length: 100 }, () => new Uint8Array(1024).fill(0x61));
    const streamed = streamRequest({ chunks, requestMethodSpies: true });
    const jsonParse = vi.spyOn(JSON, 'parse');
    try {
      const response = await handler(streamed.request, params());
      expect(response.status).toBe(413);
      expect(jsonParse).not.toHaveBeenCalled();
      expect(await response.json()).toEqual({ code: 'request_body_too_large' });
    } finally {
      jsonParse.mockRestore();
    }
    expect(execute).not.toHaveBeenCalled();
    expect(streamed.cancelCount).toBe(1);
    expect(streamed.pullCount).toBeLessThan(chunks.length);
    expect(streamed.providedBytes).toBeLessThan(1024 * chunks.length);
    expect(streamed.methodSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });

  it('伪造较小 Content-Length 的超限流仍按真实累计字节立即停止', async () => {
    const { handler } = setup();
    const chunks = Array.from({ length: 100 }, () => new Uint8Array(1024).fill(0x61));
    const streamed = streamRequest({ chunks, contentLength: '32', requestMethodSpies: true });
    await expectError(await handler(streamed.request, params()), 413, 'request_body_too_large');
    expect(streamed.cancelCount).toBe(1);
    expect(streamed.pullCount).toBeLessThan(chunks.length);
    expect(streamed.methodSpies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
  });

  it.each([
    ['4096 ASCII bytes', 4096, 400, 'request_contract_invalid'],
    ['4097 ASCII bytes', 4097, 413, 'request_body_too_large'],
  ])('%s 按真实 byteLength 判定', async (_label, size, status, code) => {
    const { handler } = setup();
    const streamed = streamRequest({ chunks: [new Uint8Array(size).fill(0x20)] });
    await expectError(await handler(streamed.request, params()), status, code);
  });

  it.each([
    ['中文', '证'.repeat(1400)],
    ['emoji', '😀'.repeat(1100)],
  ])('%s 的 JS 字符数较少但 UTF-8 超限时拒绝', async (_label, text) => {
    const { handler } = setup();
    const bytes = new TextEncoder().encode(text);
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(bytes.byteLength).toBeGreaterThan(4096);
    const streamed = streamRequest({ chunks: [bytes] });
    await expectError(await handler(streamed.request, params()), 413, 'request_body_too_large');
    expect(streamed.cancelCount).toBe(1);
  });

  it('多字节 UTF-8 字符拆分在 chunk 边界仍可严格解码', async () => {
    const { handler } = setup();
    const encoded = new TextEncoder().encode(JSON.stringify(validBody({ note: '依据😀确认' })));
    const emojiStart = encoded.findIndex((value) => value === 0xf0);
    const streamed = streamRequest({
      chunks: [encoded.slice(0, emojiStart + 2), encoded.slice(emojiStart + 2)],
    });
    expect((await handler(streamed.request, params())).status).toBe(200);
  });

  it('Content-Length 0 配合空 body 作为合法长度进入 body_missing', async () => {
    const { handler } = setup();
    const streamed = streamRequest({ chunks: [], contentLength: '0' });
    await expectError(await handler(streamed.request, params()), 400, 'request_contract_invalid');
  });

  it('reader.read 抛错时 cancel 并固定 fail-closed', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error('sensitive stream failure');
      },
    }, { highWaterMark: 0 });
    const failing = new Request(routeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
        'sec-fetch-site': 'same-origin',
      },
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    const { handler } = setup();
    const failingReader = failing.body!.getReader();
    const cancelSpy = vi.spyOn(failingReader, 'cancel');
    vi.spyOn(failing.body!, 'getReader').mockReturnValue(failingReader);
    await expectError(await handler(failing, params()), 400, 'request_body_encoding_invalid');
    expect(cancelSpy).toHaveBeenCalledOnce();

    const locked = streamRequest({ chunks: [new Uint8Array([0x7b, 0x7d])] });
    const heldReader = locked.request.body!.getReader();
    try {
      await expectError(await handler(locked.request, params()), 400, 'request_body_encoding_invalid');
    } finally {
      heldReader.releaseLock();
    }

    const cancelFailure = streamRequest({
      chunks: [new Uint8Array(4097)],
      onCancel: () => { throw new Error('sensitive cancel failure'); },
    });
    await expectError(
      await handler(cancelFailure.request, params()),
      413,
      'request_body_too_large',
    );
    expect(cancelFailure.cancelCount).toBe(1);

    const nonByteChunk = streamRequest({ chunks: [new Uint8Array([0x7b, 0x7d])] });
    const nonByteReader = {
      read: vi.fn().mockResolvedValueOnce({
        done: false,
        value: new Uint16Array([0x7b, 0x7d]),
      }),
      cancel: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(nonByteChunk.request.body!, 'getReader').mockReturnValue(nonByteReader as never);
    await expectError(
      await handler(nonByteChunk.request, params()),
      400,
      'request_body_encoding_invalid',
    );
    expect(nonByteReader.cancel).toHaveBeenCalledOnce();
  });

  it('malformed UTF-8 固定 fail-closed', async () => {
    const { handler } = setup();
    const streamed = streamRequest({ chunks: [new Uint8Array([0x7b, 0xc3, 0x28, 0x7d])] });
    await expectError(await handler(streamed.request, params()), 400, 'request_body_encoding_invalid');
  });

  it('空 body 固定 request_contract_invalid', async () => {
    const { handler } = setup();
    const streamed = streamRequest({ chunks: [] });
    await expectError(await handler(streamed.request, params()), 400, 'request_contract_invalid');

    const bodyNull = new Request(routeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin,
        'sec-fetch-site': 'same-origin',
      },
    });
    await expectError(await handler(bodyNull, params()), 400, 'request_contract_invalid');
  });

  it('超过最大 chunk 数时 cancel 并 fail-closed', async () => {
    const { handler } = setup();
    const encoded = new TextEncoder().encode(JSON.stringify(validBody()));
    const exactLimit = streamRequest({
      chunks: [...Array.from({ length: 127 }, () => new Uint8Array(0)), encoded],
    });
    expect((await handler(exactLimit.request, params())).status).toBe(200);

    const chunks = [...Array.from({ length: 129 }, () => new Uint8Array(0)), encoded];
    const streamed = streamRequest({ chunks });
    await expectError(await handler(streamed.request, params()), 400, 'request_body_length_invalid');
    expect(streamed.cancelCount).toBe(1);
    expect(streamed.pullCount).toBeLessThan(chunks.length);
  });

  it.each<[
    string,
    { method?: string; headers?: Record<string, string> },
  ]>([
    ['method', { method: 'GET' }],
    ['Content-Type', { headers: { 'content-type': 'text/plain' } }],
    ['Origin', { headers: { origin: 'https://attacker.invalid' } }],
  ])('%s 失败时不读取 body stream', async (_label, override) => {
    const { handler } = setup();
    const streamed = streamRequest({ chunks: [new Uint8Array(8192)] });
    const failing = override.method === 'GET'
      ? Object.defineProperty(Object.create(streamed.request) as Request, 'method', { value: 'GET' })
      : new Request(streamed.request.url, {
        method: 'POST',
        headers: { ...Object.fromEntries(streamed.request.headers), ...override.headers },
        body: streamed.request.body,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' });
    await handler(failing, params());
    expect(streamed.pullCount).toBe(0);
    expect(streamed.providedBytes).toBe(0);

    if (_label === 'Origin') {
      const fetchMetadata = streamRequest({ chunks: [new Uint8Array(8192)] });
      const crossSite = new Request(fetchMetadata.request.url, {
        method: 'POST',
        headers: {
          ...Object.fromEntries(fetchMetadata.request.headers),
          'sec-fetch-site': 'cross-site',
        },
        body: fetchMetadata.request.body,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' });
      await expectError(await handler(crossSite, params()), 403, 'csrf_validation_failed');
      expect(fetchMetadata.pullCount).toBe(0);
    }
  });

  it('authentication 失败时不读取 body stream', async () => {
    const { handler } = setup({ context: null });
    const streamed = streamRequest({ chunks: [new Uint8Array(8192)] });
    await expectError(await handler(streamed.request, params()), 401, 'unauthenticated');
    expect(streamed.pullCount).toBe(0);
  });

  it('非法 JSON 使用固定 code', async () => {
    const { handler } = setup();
    await expectError(
      await handler(request(undefined, { rawBody: '{"action":' }), params()),
      400,
      'request_contract_invalid',
    );
  });

  it.each([
    ['unknown key', validBody({ surprise: true })],
    ['tenantId', validBody({ tenantId: 'tenant-b' })],
    ['targetStatus', validBody({ targetStatus: 'linked' })],
    ['autoMerge', validBody({ autoMerge: true })],
    ['relationship payload', validBody({ relationship: { customerId: 'customer-secret' } })],
  ])('拒绝客户端提交 %s', async (_label, body) => {
    const { handler } = setup();
    await expectError(await handler(request(body), params()), 400, 'request_contract_invalid');
  });

  it.each([
    '',
    '../mock-map-pending',
    'mock map pending',
    `m${'x'.repeat(64)}`,
    '客户映射一',
  ])('严格拒绝非法 mappingId：%s', async (mappingId) => {
    const { handler } = setup();
    await expectError(
      await handler(request(undefined, { url: `${origin}/api/institution/wecom/customer-mapping-reviews/x/actions` }), params(mappingId)),
      400,
      'request_contract_invalid',
    );
  });

  it('非 POST 首先返回 405，且不产生 mutation', async () => {
    const { handler } = setup();
    await expectError(await handler(request(undefined, { method: 'GET' }), params()), 405, 'method_not_allowed');
    const response = await handler(request(), params());
    expect(response.status).toBe(200);
    expect((await json(response)).previousVersion).toBe(0);
  });

  it.each([
    ['approve_candidate', 'manual_evidence_confirmed', undefined, 'mock-map-pending', 0, 'approved_pending_link'],
    ['reject_candidate', 'evidence_not_sufficient', undefined, 'mock-map-pending', 0, 'rejected'],
    ['request_more_info', 'missing_low_sensitive_evidence', '请补充低敏核验依据', 'mock-map-pending', 0, 'needs_more_info'],
    ['mark_conflict', 'multiple_candidate_conflict', '存在多个候选，请人工判断', 'mock-map-pending', 0, 'conflict'],
    ['reopen_review', 'new_low_sensitive_evidence', '已有新的低敏依据', 'mock-map-approved', 8, 'reopened'],
  ])('五动作 %s 通过 domain 转换到 %s', async (action, reasonCode, note, mappingId, version, nextStatus) => {
    const { handler } = setup();
    const body = validBody({ action, reasonCode, expectedVersion: version, ...(note ? { note } : {}) });
    const response = await handler(
      request(body, { url: routeUrl.replace('mock-map-pending', mappingId as string) }),
      params(mappingId as string),
    );
    expect(response.status).toBe(200);
    const payload = await json(response);
    expect(payload).toMatchObject({ ok: true, action, nextStatus, previousVersion: version, nextVersion: (version as number) + 1 });
  });

  it('非法 transition 与 disabled 都不可绕过', async () => {
    const { handler } = setup();
    await expectError(
      await handler(
        request(validBody({ expectedVersion: 8 }), { url: routeUrl.replace('mock-map-pending', 'mock-map-approved') }),
        params('mock-map-approved'),
      ),
      409,
      'action_not_allowed',
    );
    await expectError(
      await handler(
        request(validBody({ expectedVersion: 3 }), { url: routeUrl.replace('mock-map-pending', 'mock-map-disabled') }),
        params('mock-map-disabled'),
      ),
      409,
      'action_not_allowed',
    );
  });

  it('approve 只进入 approved_pending_link，不进入 linked 或 merged', async () => {
    const { handler } = setup();
    const payload = await json(await handler(request(), params()));
    expect(payload.nextStatus).toBe('approved_pending_link');
    expect(JSON.stringify(payload)).not.toMatch(/\b(?:linked|merged)\b/);
  });

  it('completed replay 优先于 version 漂移并保持原结果', async () => {
    const { handler } = setup();
    const first = await json(await handler(request(), params()));
    const replay = await json(await handler(request(), params()));
    expect(replay).toMatchObject({
      idempotentReplay: true,
      previousVersion: 0,
      nextVersion: 1,
      nextStatus: first.nextStatus,
    });

    const seed = executeWeComCustomerMappingReviewAction(
      { mappingId: 'mock-map-pending', ...validBody() },
      { authenticated: true, tenantId: 'tenant-a', institutionId: 'institution-a', scope: 'tenant', capabilities: ['customer:read', 'customer:mapping_review'] },
      fixtures[0],
    );
    expect(seed.ok).toBe(true);
    if (!seed.ok || !seed.idempotencyRecord.completedResult) return;
    const mutableRecord = {
      ...seed.idempotencyRecord,
      completedResult: { ...seed.idempotencyRecord.completedResult },
    };
    const seededRuntime = createWeComCustomerMappingReviewActionMockRuntime({
      fixtures: [{
        ...fixtures[0],
        state: seed.mutationResult.nextState,
        version: seed.mutationResult.nextVersion,
      }],
      seedIdempotencyRecords: [{
        idempotencyKey: 'idem-key-00000001',
        record: mutableRecord,
      }],
    });
    mutableRecord.status = 'in_progress';
    mutableRecord.completedResult.nextVersion = 99;
    (mutableRecord as unknown as { completedResult: null }).completedResult = null;
    const seededHandler = createWeComCustomerMappingReviewActionsPostHandler({
      runtime: seededRuntime,
      getSession: () => ({ authenticatedForTest: true } as never),
      getAccessContext: () => tenantAdmin,
    });
    expect(await json(await seededHandler(request(), params()))).toMatchObject({
      idempotentReplay: true,
      previousVersion: 0,
      nextVersion: 1,
    });
  });

  it('相同 idempotencyKey 的 fingerprint 冲突 fail-closed', async () => {
    const { handler } = setup();
    expect((await handler(request(), params())).status).toBe(200);
    await expectError(
      await handler(request(validBody({ reasonCode: 'institution_record_match_confirmed' })), params()),
      409,
      'idempotency_conflict',
    );
  });

  it.each(['in_progress', 'invalid'] as const)('%s 幂等记录 fail-closed', async (kind) => {
    const seed = executeWeComCustomerMappingReviewAction(
      { mappingId: 'mock-map-pending', ...validBody() },
      { authenticated: true, tenantId: 'tenant-a', institutionId: 'institution-a', scope: 'tenant', capabilities: ['customer:read', 'customer:mapping_review'] },
      fixtures[0],
    );
    expect(seed.ok).toBe(true);
    if (!seed.ok) return;
    const record = kind === 'in_progress'
      ? { ...seed.idempotencyRecord, status: 'in_progress' as const, completedResult: null, completedResultDigest: null }
      : { ...seed.idempotencyRecord, requestFingerprint: 'sha256:invalid' };
    const { handler } = setup({
      runtimeOptions: kind === 'in_progress'
        ? {
            fixtures,
            seedIdempotencyRecords: [{ idempotencyKey: 'idem-key-00000001', record }],
          }
        : { fixtures, occupationRecord: () => record },
    });
    await expectError(
      await handler(request(), params()),
      kind === 'in_progress' ? 409 : 503,
      kind === 'in_progress' ? 'idempotency_in_progress' : 'idempotency_unavailable',
    );
    if (kind === 'invalid') {
      const invalidSeed = setup({
        runtimeOptions: {
          fixtures,
          seedIdempotencyRecords: [{ idempotencyKey: 'idem-key-00000001', record }],
        },
      });
      await expectError(
        await invalidSeed.handler(request(), params()),
        503,
        'transaction_failed',
      );
    }
  });

  it('version conflict 不写入状态或 completed record', async () => {
    const { handler } = setup();
    await expectError(
      await handler(request(validBody({ expectedVersion: 99 })), params()),
      409,
      'version_conflict',
    );
    expect((await handler(request(), params())).status).toBe(200);
  });

  it('approve/reject 并发竞争只有首个成功', async () => {
    const { handler } = setup();
    const approveBody = validBody();
    const rejectBody = validBody({
      action: 'reject_candidate',
      reasonCode: 'evidence_not_sufficient',
      idempotencyKey: 'idem-key-00000002',
    });
    const [approve, reject] = await Promise.all([
      handler(request(approveBody), params()),
      handler(request(rejectBody), params()),
    ]);
    expect([approve.status, reject.status].sort((a, b) => a - b)).toEqual([200, 409]);
    const winnerBody = approve.status === 200 ? approveBody : rejectBody;
    const loserBody = approve.status === 200 ? rejectBody : approveBody;
    const winner = await json(approve.status === 200 ? approve : reject);
    expect(winner).toMatchObject({
      previousVersion: 0,
      nextVersion: 1,
      auditSummary: { acceptedMutationCount: 1, replayCount: 0, eventCount: 2 },
    });
    const replay = await json(await handler(request(winnerBody), params()));
    expect(replay).toMatchObject({
      previousVersion: 0,
      nextVersion: 1,
      idempotentReplay: true,
      auditSummary: { acceptedMutationCount: 0, replayCount: 1, eventCount: 1 },
    });
    await expectError(await handler(request(loserBody), params()), 409, 'version_conflict');
    const reopen = await json(await handler(request(validBody({
      action: 'reopen_review',
      expectedVersion: 1,
      idempotencyKey: 'idem-key-00000003',
      reasonCode: 'new_low_sensitive_evidence',
      note: '补充新的低敏依据',
    })), params()));
    expect(reopen).toMatchObject({ previousVersion: 1, nextVersion: 2 });
  });

  it('occupation race 回到 domain 识别的已有 completed record', async () => {
    const seed = executeWeComCustomerMappingReviewAction(
      { mappingId: 'mock-map-pending', ...validBody() },
      { authenticated: true, tenantId: 'tenant-a', institutionId: 'institution-a', scope: 'tenant', capabilities: ['customer:read', 'customer:mapping_review'] },
      fixtures[0],
    );
    expect(seed.ok).toBe(true);
    if (!seed.ok) return;
    let occupationPending = true;
    const { handler } = setup({
      runtimeOptions: {
        fixtures,
        occupationRecord: () => {
          if (!occupationPending) return null;
          occupationPending = false;
          return seed.idempotencyRecord;
        },
      },
    });
    const payload = await json(await handler(request(), params()));
    expect(payload).toMatchObject({ ok: true, idempotentReplay: true, previousVersion: 0, nextVersion: 1 });
    const afterReplay = await json(await handler(request(validBody({
      action: 'reopen_review',
      expectedVersion: 1,
      idempotencyKey: 'idem-key-00000002',
      reasonCode: 'new_low_sensitive_evidence',
      note: '补充新的低敏依据',
    })), params()));
    expect(afterReplay).toMatchObject({ previousVersion: 1, nextVersion: 2 });

    const futureRecordRuntime = createWeComCustomerMappingReviewActionMockRuntime({
      fixtures,
      seedIdempotencyRecords: [{ idempotencyKey: 'idem-key-00000001', record: seed.idempotencyRecord }],
    });
    const futureRecordHandler = createWeComCustomerMappingReviewActionsPostHandler({
      runtime: futureRecordRuntime,
      getSession: () => ({ authenticatedForTest: true } as never),
      getAccessContext: () => tenantAdmin,
    });
    await expectError(
      await futureRecordHandler(request(), params()),
      409,
      'idempotency_record_invalid',
    );

    let nestedResult: { ok: boolean; reasonCode?: string } | null = null;
    let reentrantRuntime: WeComCustomerMappingReviewActionMockRuntime;
    reentrantRuntime = createWeComCustomerMappingReviewActionMockRuntime({
      fixtures,
      faultAt: () => {
        if (nestedResult === null) {
          nestedResult = reentrantRuntime.execute({
            context: tenantAdmin as AccessContext & { tenantId: string; institutionId: string },
            command: {
              mappingId: 'mock-map-pending',
              action: 'reject_candidate',
              expectedVersion: 0,
              idempotencyKey: 'idem-key-00000002',
              reasonCode: 'evidence_not_sufficient',
            },
          });
        }
        return null;
      },
    });
    const reentrantHandler = createWeComCustomerMappingReviewActionsPostHandler({
      runtime: reentrantRuntime,
      getSession: () => ({ authenticatedForTest: true } as never),
      getAccessContext: () => tenantAdmin,
    });
    expect((await reentrantHandler(request(), params())).status).toBe(200);
    expect(nestedResult).toMatchObject({ ok: false, reasonCode: 'transaction_failed' });
    expect(await json(await reentrantHandler(request(), params()))).toMatchObject({
      idempotentReplay: true,
      previousVersion: 0,
      nextVersion: 1,
    });
  });

  it.each(['audit', 'idempotency_record', 'output', 'transaction'] as const)(
    '%s 提交失败时全部回滚，重试不出现半成品',
    async (faultPoint) => {
      let activeFault: typeof faultPoint | null = faultPoint;
      const { handler } = setup({
        runtimeOptions: {
          fixtures,
          faultAt: () => {
            const fault = activeFault;
            activeFault = null;
            return fault;
          },
        },
      });
      const failed = await handler(request(), params());
      expect(failed.status).toBe(503);
      expect(await failed.json()).toEqual({
        code: faultPoint === 'audit'
          ? 'audit_unavailable'
          : faultPoint === 'output'
            ? 'response_contract_invalid'
            : 'transaction_failed',
      });
      const retry = await json(await handler(request(), params()));
      expect(retry).toMatchObject({ ok: true, idempotentReplay: false, previousVersion: 0, nextVersion: 1 });

      if (faultPoint === 'audit' || faultPoint === 'transaction') {
        activeFault = faultPoint;
        await expectError(
          await handler(request(), params()),
          503,
          faultPoint === 'audit' ? 'audit_unavailable' : 'transaction_failed',
        );
        expect(await json(await handler(request(), params()))).toMatchObject({
          ok: true,
          idempotentReplay: true,
          previousVersion: 0,
          nextVersion: 1,
        });

        const occupationSeed = executeWeComCustomerMappingReviewAction(
          { mappingId: 'mock-map-pending', ...validBody() },
          { authenticated: true, tenantId: 'tenant-a', institutionId: 'institution-a', scope: 'tenant', capabilities: ['customer:read', 'customer:mapping_review'] },
          fixtures[0],
        );
        expect(occupationSeed.ok).toBe(true);
        if (!occupationSeed.ok) return;
        let occupationAvailable = true;
        let occupationFault: typeof faultPoint | null = faultPoint;
        const occupationRuntime = createWeComCustomerMappingReviewActionMockRuntime({
          fixtures,
          occupationRecord: () => {
            if (!occupationAvailable) return null;
            occupationAvailable = false;
            return occupationSeed.idempotencyRecord;
          },
          faultAt: () => {
            const fault = occupationFault;
            occupationFault = null;
            return fault;
          },
        });
        const occupationHandler = createWeComCustomerMappingReviewActionsPostHandler({
          runtime: occupationRuntime,
          getSession: () => ({ authenticatedForTest: true } as never),
          getAccessContext: () => tenantAdmin,
        });
        await expectError(
          await occupationHandler(request(), params()),
          503,
          faultPoint === 'audit' ? 'audit_unavailable' : 'transaction_failed',
        );
        expect(await json(await occupationHandler(request(), params()))).toMatchObject({
          ok: true,
          idempotentReplay: false,
          previousVersion: 0,
          nextVersion: 1,
        });
      }
    },
  );

  it('domain 失败不保留 accepted audit 或占用幂等 key', async () => {
    const { handler } = setup();
    await expectError(
      await handler(
        request(validBody({ expectedVersion: 8 })),
        params('mock-map-approved'),
      ),
      409,
      'action_not_allowed',
    );
    const validReopen = validBody({
      action: 'reopen_review',
      expectedVersion: 8,
      reasonCode: 'new_low_sensitive_evidence',
      note: '补充新的低敏依据',
    });
    expect((await handler(request(validReopen), params('mock-map-approved'))).status).toBe(200);
  });

  it('tenant A 的相同 mappingId 与 key 不影响 tenant B', async () => {
    const runtime = createWeComCustomerMappingReviewActionMockRuntime({ fixtures });
    const handlerA = createWeComCustomerMappingReviewActionsPostHandler({ runtime, getSession: () => ({ authenticatedForTest: true } as never), getAccessContext: () => tenantAdmin });
    const contextB: AccessContext = { ...tenantAdmin, userId: 'reviewer-b', tenantId: 'tenant-b', institutionId: 'institution-b' };
    const handlerB = createWeComCustomerMappingReviewActionsPostHandler({ runtime, getSession: () => ({ authenticatedForTest: true } as never), getAccessContext: () => contextB });
    const url = routeUrl.replace('mock-map-pending', 'mock-map-shared');
    const a = await json(await handlerA(request(undefined, { url }), params('mock-map-shared')));
    const b = await json(await handlerB(request(validBody({ expectedVersion: 7 }), { url }), params('mock-map-shared')));
    expect(a).toMatchObject({ previousVersion: 0, nextVersion: 1 });
    expect(b).toMatchObject({ previousVersion: 7, nextVersion: 8 });
  });

  it.each([
    '手机号 13800138000',
    '身份证 11010519491231002X',
    'access token is forbidden',
    'external_userid=wm-secret',
    '聊天内容不应提交',
  ])('敏感 note 被 E3-A domain 阻断且不回显：%s', async (note) => {
    const { handler } = setup();
    const response = await handler(request(validBody({
      action: 'mark_conflict',
      reasonCode: 'multiple_candidate_conflict',
      note,
    })), params());
    await expectError(response, 400, 'sensitive_input_blocked');
  });

  it('错误不回显 body、note、idempotency key、Origin、stack 或异常', async () => {
    const { handler } = setup();
    const secretNote = 'access token secret-value';
    const key = 'idem-super-secret-01';
    const response = await handler(
      request(validBody({
        action: 'mark_conflict',
        reasonCode: 'multiple_candidate_conflict',
        note: secretNote,
        idempotencyKey: key,
      }), { headers: { origin: 'https://attacker.invalid' } }),
      params(),
    );
    const serialized = JSON.stringify(await response.json());
    expect(serialized).toBe('{"code":"csrf_validation_failed"}');
    expect(serialized).not.toContain(secretNote);
    expect(serialized).not.toContain(key);
    expect(serialized).not.toContain('attacker');
    expect(serialized).not.toContain('stack');
  });

  it('success/error 都使用 exact keys、no-store 与固定 mock 标记', async () => {
    const { handler } = setup();
    const successResponse = await handler(request(), params());
    expectNoStore(successResponse);
    const success = await json(successResponse);
    expect(Object.keys(success).sort()).toEqual(successKeys());
    expect(success).toMatchObject({
      mockDemo: true,
      persistenceMode: 'volatile_process_memory',
      autoMergePerformed: false,
      realCustomerRelationshipWritten: false,
    });
    expect(Object.keys(success.auditSummary as object).sort()).toEqual([
      'acceptedMutationCount',
      'eventCount',
      'replayCount',
    ]);

    const errorResponse = await handler(request(), params('unknown-map'));
    expectNoStore(errorResponse);
    expect(await errorResponse.json()).toEqual({ code: 'mapping_unavailable' });
  });

  it('每个 factory 创建独立 volatile runtime', async () => {
    const first = setup().handler;
    const second = setup().handler;
    expect((await json(await first(request(), params()))).previousVersion).toBe(0);
    expect((await json(await second(request(), params()))).previousVersion).toBe(0);
  });

  it('mapping、每 mapping 幂等记录与每 scope audit 容量有固定上限且不静默驱逐', async () => {
    expect(WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS).toEqual({
      maxMappings: 64,
      maxIdempotencyRecordsPerMapping: 32,
      maxAuditRecordsPerScope: 256,
      idempotencyRecordTtlMs: 900_000,
      auditRecordTtlMs: 900_000,
    });

    const overMappingRuntime = createWeComCustomerMappingReviewActionMockRuntime({
      fixtures: Array.from({ length: 65 }, (_, index) => ({
        mappingId: `mock-capacity-${index}`,
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
        state: 'pending_review' as const,
        version: 0,
      })),
    });
    const overMappingHandler = createWeComCustomerMappingReviewActionsPostHandler({
      runtime: overMappingRuntime,
      getSession: () => ({ authenticatedForTest: true } as never),
      getAccessContext: () => tenantAdmin,
    });
    await expectError(
      await overMappingHandler(
        request(undefined, { url: routeUrl.replace('mock-map-pending', 'mock-capacity-0') }),
        params('mock-capacity-0'),
      ),
      503,
      'mock_runtime_capacity_exceeded',
    );

    const capacityFixture: WeComCustomerMappingReviewMockFixture = {
      mappingId: 'mock-capacity', tenantId: 'tenant-a', institutionId: 'institution-a', state: 'pending_review', version: 0,
    };
    const seedRecords = Array.from({ length: 32 }, (_, index) => {
      const result = executeWeComCustomerMappingReviewAction(
        {
          mappingId: 'mock-capacity',
          ...validBody({ idempotencyKey: `capacity-key-${String(index).padStart(4, '0')}` }),
        },
        { authenticated: true, tenantId: 'tenant-a', institutionId: 'institution-a', scope: 'tenant', capabilities: ['customer:read', 'customer:mapping_review'] },
        capacityFixture,
      );
      if (!result.ok) throw new Error('seed failed');
      return { idempotencyKey: `capacity-key-${String(index).padStart(4, '0')}`, record: result.idempotencyRecord };
    });
    let capacityNow = 1_000;
    const runtime = createWeComCustomerMappingReviewActionMockRuntime({
      fixtures: [capacityFixture],
      seedIdempotencyRecords: seedRecords,
      now: () => capacityNow,
    });
    const handler = createWeComCustomerMappingReviewActionsPostHandler({ runtime, getSession: () => ({ authenticatedForTest: true } as never), getAccessContext: () => tenantAdmin });
    await expectError(
      await handler(
        request(validBody({ idempotencyKey: 'capacity-key-overflow' }), { url: routeUrl.replace('mock-map-pending', 'mock-capacity') }),
        params('mock-capacity'),
      ),
      503,
      'mock_runtime_capacity_exceeded',
    );

    capacityNow += WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS.idempotencyRecordTtlMs + 1;
    expect((await handler(
      request(validBody({ idempotencyKey: 'capacity-key-overflow' })),
      params('mock-capacity'),
    )).status).toBe(200);

    const extraSeedResult = executeWeComCustomerMappingReviewAction(
      {
        mappingId: 'mock-capacity',
        ...validBody({ idempotencyKey: 'capacity-key-extra-0001' }),
      },
      { authenticated: true, tenantId: 'tenant-a', institutionId: 'institution-a', scope: 'tenant', capabilities: ['customer:read', 'customer:mapping_review'] },
      capacityFixture,
    );
    if (!extraSeedResult.ok) throw new Error('extra seed failed');
    const overSeedRuntime = createWeComCustomerMappingReviewActionMockRuntime({
      fixtures: [capacityFixture],
      seedIdempotencyRecords: [
        ...seedRecords,
        { idempotencyKey: 'capacity-key-extra-0001', record: extraSeedResult.idempotencyRecord },
      ],
      now: () => 1_000,
    });
    const overSeedHandler = createWeComCustomerMappingReviewActionsPostHandler({
      runtime: overSeedRuntime,
      getSession: () => ({ authenticatedForTest: true } as never),
      getAccessContext: () => tenantAdmin,
    });
    await expectError(
      await overSeedHandler(request(), params('mock-capacity')),
      503,
      'mock_runtime_capacity_exceeded',
    );

    let auditNow = 1_000;
    const auditFixtures: readonly WeComCustomerMappingReviewMockFixture[] = [
      { mappingId: 'mock-audit-a', tenantId: 'tenant-a', institutionId: 'institution-a', state: 'pending_review', version: 0 },
      { mappingId: 'mock-audit-second', tenantId: 'tenant-a', institutionId: 'institution-a', state: 'pending_review', version: 0 },
      { mappingId: 'mock-audit-b', tenantId: 'tenant-b', institutionId: 'institution-b', state: 'pending_review', version: 0 },
    ];
    const auditRuntime = createWeComCustomerMappingReviewActionMockRuntime({
      fixtures: auditFixtures,
      now: () => auditNow,
    });
    const auditHandlerA = createWeComCustomerMappingReviewActionsPostHandler({
      runtime: auditRuntime,
      getSession: () => ({ authenticatedForTest: true } as never),
      getAccessContext: () => tenantAdmin,
    });
    const tenantBContext = { ...tenantAdmin, userId: 'reviewer-b', tenantId: 'tenant-b', institutionId: 'institution-b' };
    const auditHandlerB = createWeComCustomerMappingReviewActionsPostHandler({
      runtime: auditRuntime,
      getSession: () => ({ authenticatedForTest: true } as never),
      getAccessContext: () => tenantBContext,
    });
    expect((await auditHandlerA(request(), params('mock-audit-a'))).status).toBe(200);
    for (let index = 0; index < 254; index += 1) {
      expect((await auditHandlerA(request(), params('mock-audit-a'))).status).toBe(200);
    }
    await expectError(
      await auditHandlerA(request(), params('mock-audit-second')),
      503,
      'mock_runtime_capacity_exceeded',
    );
    expect((await auditHandlerB(request(), params('mock-audit-b'))).status).toBe(200);
    auditNow += WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS.auditRecordTtlMs + 1;
    expect((await auditHandlerA(request(), params('mock-audit-second'))).status).toBe(200);
  });

  it('TTL 到期后只清理本 scope 的幂等/audit，不承诺跨进程持久化', async () => {
    let now = 1_000;
    const runtime = createWeComCustomerMappingReviewActionMockRuntime({ fixtures, now: () => now });
    const handler = createWeComCustomerMappingReviewActionsPostHandler({ runtime, getSession: () => ({ authenticatedForTest: true } as never), getAccessContext: () => tenantAdmin });
    expect((await handler(request(), params())).status).toBe(200);
    now += WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS.idempotencyRecordTtlMs;
    expect(await json(await handler(request(), params()))).toMatchObject({
      idempotentReplay: true,
      previousVersion: 0,
      nextVersion: 1,
    });

    for (const invalidTime of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, now - 1]) {
      now = invalidTime;
      await expectError(await handler(request(), params()), 503, 'transaction_failed');
    }
    now = 1_000 + WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS.idempotencyRecordTtlMs;
    expect(await json(await handler(request(), params()))).toMatchObject({
      idempotentReplay: true,
      previousVersion: 0,
      nextVersion: 1,
    });

    now += 1;
    await expectError(await handler(request(), params()), 409, 'version_conflict');
    const afterExpiry = await json(await handler(request(validBody({
      action: 'reopen_review',
      expectedVersion: 1,
      idempotencyKey: 'idem-key-00000002',
      reasonCode: 'new_low_sensitive_evidence',
      note: '补充新的低敏依据',
    })), params()));
    expect(afterExpiry).toMatchObject({ previousVersion: 1, nextVersion: 2 });
  });

  it('固定执行 method→authentication→Content-Type→Origin→bounded body→context→read/mapping_review→strict JSON→ownership', async () => {
    const order: string[] = [];
    const runtime = createWeComCustomerMappingReviewActionMockRuntime({ fixtures });
    const wrappedRuntime: WeComCustomerMappingReviewActionMockRuntime = {
      readMappingSnapshot: (input) => runtime.readMappingSnapshot(input),
      resolveMappingOwnership: (input) => {
        order.push('ownership');
        return runtime.resolveMappingOwnership(input);
      },
      execute: (input) => runtime.execute(input),
    };
    const handler = createWeComCustomerMappingReviewActionsPostHandler({
      runtime: wrappedRuntime,
      getSession: () => {
        order.push('authentication');
        return { authenticatedForTest: true } as never;
      },
      validateOrigin: (input) => {
        order.push('origin');
        return validateSameOriginMutationRequest(input);
      },
      getAccessContext: () => {
        order.push('context');
        return tenantOperator;
      },
      canAccess: (input) => {
        order.push(input.action);
        return canAccessResource(input);
      },
    });
    const encoded = new TextEncoder().encode(JSON.stringify(validBody()));
    const streamed = streamRequest({
      chunks: [encoded],
      onPull: () => {
        if (!order.includes('bounded_body')) order.push('bounded_body');
      },
    });
    const jsonParse = JSON.parse;
    const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation((...args) => {
      order.push('strict_json');
      return jsonParse(...args);
    });
    try {
      expect((await handler(streamed.request, params())).status).toBe(200);
    } finally {
      parseSpy.mockRestore();
    }
    expect(order).toEqual([
      'authentication',
      'origin',
      'bounded_body',
      'context',
      'read',
      'mapping_review',
      'strict_json',
      'ownership',
    ]);
  });

  it('固定调用 canAccessResource(customer, read/mapping_review) 与 Origin helper', async () => {
    const accessSpy = vi.fn(canAccessResource);
    const originSpy = vi.fn(validateSameOriginMutationRequest);
    const runtime = createWeComCustomerMappingReviewActionMockRuntime({ fixtures });
    const handler = createWeComCustomerMappingReviewActionsPostHandler({
      runtime,
      getSession: () => ({ authenticatedForTest: true } as never),
      getAccessContext: () => tenantOperator,
      canAccess: accessSpy,
      validateOrigin: originSpy,
    });
    expect((await handler(request(), params())).status).toBe(200);
    expect(originSpy).toHaveBeenCalledOnce();
    expect(accessSpy).toHaveBeenNthCalledWith(1, {
      context: tenantOperator,
      resource: 'customer',
      action: 'read',
      targetTenantId: 'tenant-a',
    });
    expect(accessSpy).toHaveBeenNthCalledWith(2, {
      context: tenantOperator,
      resource: 'customer',
      action: 'mapping_review',
      targetTenantId: 'tenant-a',
    });
  });
});
