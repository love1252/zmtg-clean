import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  evaluatePreflight: vi.fn(),
  issueConfirmation: vi.fn(),
  rejectExecution: vi.fn(),
}));

vi.mock('@/modules/security/server/access-context', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getDemoAccessContextFromRequest: mocks.getContext,
}));
vi.mock(
  '@/modules/institution/server/wecom-real-send-execution-shell-service',
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    evaluateBroadcastTaskPreflight: mocks.evaluatePreflight,
    issueBroadcastTaskConfirmation: mocks.issueConfirmation,
    rejectBroadcastTaskExecutionBecauseProviderDisabled: mocks.rejectExecution,
  }),
);

import {
  GET,
  POST,
} from '@/app/api/institution/followup-message-drafts/[draftId]/wecom-customer-broadcast-task/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const adminContext: AccessContext = {
  userId: 'admin-a',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  source: 'server_session',
};
const params = { params: Promise.resolve({ draftId: 'draft-a' }) };
const endpoint =
  'http://localhost/api/institution/followup-message-drafts/draft-a/wecom-customer-broadcast-task';

function getRequest() {
  return new Request(endpoint);
}

function postRequest(body: unknown, headers?: HeadersInit) {
  return new Request(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function expectNoStore(response: Response) {
  expect(response.headers.get('cache-control')).toContain('no-store');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getContext.mockReturnValue(adminContext);
  mocks.evaluatePreflight.mockResolvedValue({
    status: 'blocked',
    proofKind: 'customer_broadcast_task',
    directSend: false,
    requiresEmployeeConfirmation: true,
    reasonCode: 'proof_environment_unavailable',
  });
  mocks.issueConfirmation.mockResolvedValue({
    kind: 'blocked',
    reasonCode: 'proof_environment_unavailable',
  });
  mocks.rejectExecution.mockImplementation(({ operationRef }) => ({
    kind: 'blocked',
    operationRef,
    reasonCode: 'provider_disabled',
  }));
});

describe('WeCom customer broadcast task API shell', () => {
  it('GET 对未登录和非正式会话分别返回 401/403，不进入 preflight service', async () => {
    mocks.getContext.mockReturnValueOnce(null);
    const response401 = await GET(getRequest(), params);
    expect(response401.status).toBe(401);
    expectNoStore(response401);

    mocks.getContext.mockReturnValue({ ...adminContext, source: 'demo_session' });
    const response403 = await GET(getRequest(), params);
    expect(response403.status).toBe(403);
    expectNoStore(response403);
    expect(mocks.evaluatePreflight).not.toHaveBeenCalled();
  });

  it('GET 不读取 body，只返回低敏 no-store preflight', async () => {
    const request = getRequest();
    const text = vi.spyOn(request, 'text');
    const response = await GET(request, params);

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(text).not.toHaveBeenCalled();
    expect(mocks.evaluatePreflight).toHaveBeenCalledWith(expect.objectContaining({
      context: adminContext,
      draftId: 'draft-a',
    }));
    expect(await response.json()).toEqual({
      status: 'blocked',
      proofKind: 'customer_broadcast_task',
      directSend: false,
      requiresEmployeeConfirmation: true,
      reasonCode: 'proof_environment_unavailable',
    });
  });

  it('POST 401/403 在读取 body 前返回，且不进入 shell', async () => {
    mocks.getContext.mockReturnValueOnce(null);
    const unauthenticated = postRequest({ action: 'issue_confirmation' });
    const unauthenticatedText = vi.spyOn(unauthenticated, 'text');
    const response401 = await POST(unauthenticated, params);
    expect(response401.status).toBe(401);
    expectNoStore(response401);
    expect(unauthenticatedText).not.toHaveBeenCalled();

    for (const deniedContext of [
      { ...adminContext, source: 'demo_session' as const },
      { ...adminContext, role: 'tenant_operator' as const },
      { ...adminContext, institutionId: null },
      { ...adminContext, source: undefined } as unknown as AccessContext,
    ]) {
      mocks.getContext.mockReturnValue(deniedContext);
      const forbidden = postRequest({ action: 'issue_confirmation' });
      const forbiddenText = vi.spyOn(forbidden, 'text');
      const response403 = await POST(forbidden, params);
      expect(response403.status).toBe(403);
      expectNoStore(response403);
      expect(forbiddenText).not.toHaveBeenCalled();
    }
    expect(mocks.issueConfirmation).not.toHaveBeenCalled();
    expect(mocks.rejectExecution).not.toHaveBeenCalled();
  });

  it('POST 仅接受 application/json media type，检查发生在读取 body 前', async () => {
    for (const contentType of ['text/plain', 'application/x-www-form-urlencoded', '']) {
      const request = postRequest(
        { action: 'issue_confirmation' },
        { 'content-type': contentType },
      );
      const text = vi.spyOn(request, 'text');
      const response = await POST(request, params);
      expect(response.status).toBe(415);
      expectNoStore(response);
      expect(text).not.toHaveBeenCalled();
    }

    const charsetJson = postRequest(
      { action: 'issue_confirmation' },
      { 'content-type': 'application/json; charset=utf-8' },
    );
    expect((await POST(charsetJson, params)).status).toBe(503);
  });

  it('POST 执行 Content-Length 与实际 UTF-8 1024 bytes 双重上限', async () => {
    const headerOversized = postRequest(
      { action: 'issue_confirmation' },
      { 'content-length': '1025' },
    );
    const headerText = vi.spyOn(headerOversized, 'text');
    const headerResponse = await POST(headerOversized, params);
    expect(headerResponse.status).toBe(413);
    expect(headerText).not.toHaveBeenCalled();

    const utf8Oversized = new Request(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify('客'.repeat(400)),
    });
    expect(utf8Oversized.headers.get('content-length')).toBeNull();
    const utf8Response = await POST(utf8Oversized, params);
    expect(utf8Response.status).toBe(413);
    expectNoStore(utf8Response);
    expect(mocks.issueConfirmation).not.toHaveBeenCalled();
  });

  it('exact union 拒绝 malformed JSON、unknown action、缺字段和禁止业务字段', async () => {
    const malformed = new Request(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect((await POST(malformed, params)).status).toBe(400);

    const invalidBodies = [
      {},
      { action: 'unknown' },
      { action: 'issue_confirmation', operationRef: 'wrsproof-a' },
      { action: 'create_task_once', operationRef: 'wrsproof-a' },
      { action: 'create_task_once', confirmationToken: 'opaque' },
    ];
    for (const body of invalidBodies) {
      expect((await POST(postRequest(body), params)).status).toBe(400);
    }

    for (const forbiddenField of [
      'tenantId', 'institutionId', 'customerId', 'content', 'recipient',
      'external_userid', 'UserID', 'providerUrl', 'secret', 'access_token', 'rawResponse',
    ]) {
      const response = await POST(postRequest({
        action: 'issue_confirmation',
        [forbiddenField]: 'forbidden',
      }), params);
      expect(response.status).toBe(400);
    }
    expect(mocks.issueConfirmation).not.toHaveBeenCalled();
    expect(mocks.rejectExecution).not.toHaveBeenCalled();
  });

  it('issue_confirmation 仅 action，签发响应 no-store 且低敏', async () => {
    mocks.issueConfirmation.mockResolvedValue({
      kind: 'issued',
      operationRef: 'wrsproof-a',
      confirmationToken: 'opaque-token-once',
      expiresAt: '2026-07-12T08:04:00.000Z',
      idempotent: false,
    });
    const response = await POST(postRequest({ action: 'issue_confirmation' }), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(mocks.issueConfirmation).toHaveBeenCalledWith(expect.objectContaining({
      context: adminContext,
      draftId: 'draft-a',
    }));
    expect(payload).toEqual({
      status: 'ready',
      proofKind: 'customer_broadcast_task',
      directSend: false,
      requiresEmployeeConfirmation: true,
      reasonCode: 'confirmation_issued',
      operationRef: 'wrsproof-a',
      confirmationToken: 'opaque-token-once',
      expiresAt: '2026-07-12T08:04:00.000Z',
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /recipient|external_userid|userid|secret|access_token|rawResponse|providerUrl|tenantId|institutionId|customerId|content/iu,
    );
  });

  it('existing operation 不重发旧 token', async () => {
    mocks.issueConfirmation.mockResolvedValue({
      kind: 'existing',
      operationRef: 'wrsproof-a',
      operationStatus: 'requested',
      idempotent: true,
    });
    const response = await POST(postRequest({ action: 'issue_confirmation' }), params);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expectNoStore(response);
    expect(payload).toMatchObject({
      status: 'blocked',
      reasonCode: 'confirmation_already_issued',
      operationStatus: 'requested',
    });
    expect(payload).not.toHaveProperty('confirmationToken');
  });

  it('create_task_once 固定 provider_disabled，不向 shell 传 token、不 consume/attempted', async () => {
    const response = await POST(postRequest({
      action: 'create_task_once',
      operationRef: 'wrsproof-a',
      confirmationToken: 'opaque-token-once',
    }), params);
    const payload = await response.json();

    expect(response.status).toBe(503);
    expectNoStore(response);
    expect(mocks.rejectExecution).toHaveBeenCalledWith({ operationRef: 'wrsproof-a' });
    expect(mocks.issueConfirmation).not.toHaveBeenCalled();
    expect(payload).toEqual({
      status: 'blocked',
      proofKind: 'customer_broadcast_task',
      directSend: false,
      requiresEmployeeConfirmation: true,
      reasonCode: 'provider_disabled',
      operationRef: 'wrsproof-a',
    });
    expect(JSON.stringify(mocks.rejectExecution.mock.calls)).not.toContain('opaque-token-once');
    expect(payload).not.toHaveProperty('confirmationToken');
    expect(payload).not.toHaveProperty('operationStatus');
  });

  it('GET/POST 服务异常只返回低敏 no-store 503', async () => {
    mocks.evaluatePreflight.mockRejectedValueOnce(new Error('sensitive diagnostic'));
    const getResponse = await GET(getRequest(), params);
    expect(getResponse.status).toBe(503);
    expectNoStore(getResponse);
    expect(JSON.stringify(await getResponse.json())).not.toContain('sensitive diagnostic');

    mocks.issueConfirmation.mockRejectedValueOnce(new Error('sensitive diagnostic'));
    const postResponse = await POST(postRequest({ action: 'issue_confirmation' }), params);
    expect(postResponse.status).toBe(503);
    expectNoStore(postResponse);
    expect(JSON.stringify(await postResponse.json())).not.toContain('sensitive diagnostic');
  });

  it('route 不实现 provider/consume/网络/环境读取，服务端 fetch=0', async () => {
    const source = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../../../app/api/institution/followup-message-drafts/[draftId]/wecom-customer-broadcast-task/route.ts',
      ),
      'utf8',
    );
    expect(source).not.toMatch(
      /\bfetch\s*\(|consumeRealSendProofConfirmation|https?:\/\/|process\.env|add_msg_template/iu,
    );

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await GET(getRequest(), params);
    await POST(postRequest({ action: 'issue_confirmation' }), params);
    await POST(postRequest({
      action: 'create_task_once',
      operationRef: 'wrsproof-a',
      confirmationToken: 'opaque-token-once',
    }), params);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
