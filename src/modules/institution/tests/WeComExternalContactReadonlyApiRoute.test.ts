import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/institution/wecom/external-contacts/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/server/access-context')>();
  return {
    ...actual,
    getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
  };
});

const tenantContext: AccessContext = {
  userId: 'tenant-operator',
  role: 'tenant_operator',
  scope: 'tenant',
  tenantId: 'tenant-mock-api-001',
  institutionId: 'institution-mock-api-001',
  source: 'demo_session',
};

const forbiddenKeys = [
  'access_token',
  'secret',
  'external_userid',
  'userid',
  'phone',
  'mobile',
  'idCard',
  'chatContent',
  'conversationContent',
  'chatArchiveKey',
  'webhookPayload',
  'apiResponse',
];

function request(query = '') {
  return new Request(`http://localhost/api/institution/wecom/external-contacts${query}`);
}

async function responseJson(response: Response) {
  return await response.json() as Record<string, unknown>;
}

function expectForbiddenFieldsAbsent(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const key of forbiddenKeys) {
    expect(serialized).not.toContain(`"${key}"`);
  }
  expect(serialized).not.toMatch(/1[3-9]\d{9}/u);
  expect(serialized).not.toMatch(/\d{17}[\dXx]/u);
  expect(serialized).not.toContain('qyapi.weixin.qq.com');
  expect(serialized).not.toContain('add_msg_template');
  expect(serialized).not.toContain('send_result');
}

describe('机构端企业微信外部联系人只读 API', () => {
  beforeEach(() => {
    routeMocks.getDemoAccessContextFromRequest.mockReset();
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    vi.unstubAllGlobals();
  });

  it('返回当前 tenant 的 mock/demo 低敏只读 payload 且不调用网络', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(request());
    const payload = await responseJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      sourceKind: 'controlled_mock_fixture',
      dataMode: 'mock',
      readonly: true,
      mockDemo: true,
      containsRealCustomerData: false,
      authorizationStatus: 'authorized',
      providerState: 'mock_only',
      syncStatus: 'mock_ready',
      failClosed: false,
      reason: 'mock_readonly_ready',
      forbiddenFieldsBlocked: false,
      fieldPolicy: {
        whitelistApplied: true,
        forbiddenFieldsReturned: false,
        notice: 'raw_identifiers_credentials_and_conversation_content_blocked',
      },
    });
    expect(payload.contacts).toHaveLength(4);
    expect(payload.mappingCandidates).toHaveLength(4);
    expect(payload.manualReview).toHaveLength(4);
    expect(payload.auditSummary).toEqual({
      eventCount: 0,
      blockedEventCount: 0,
      events: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectForbiddenFieldsAbsent(payload);
  });

  it('只返回低敏联系人、匹配和人工复核字段', async () => {
    const payload = await responseJson(await GET(request()));
    const contacts = payload.contacts as Array<Record<string, unknown>>;
    const mappings = payload.mappingCandidates as Array<Record<string, unknown>>;
    const reviews = payload.manualReview as Array<Record<string, unknown>>;

    expect(Object.keys(contacts[0]).sort()).toEqual([
      'contactReference',
      'displayName',
      'owners',
      'tags',
      'sourceType',
      'addedAtDate',
      'remarkSummary',
      'mappingStatus',
      'lastSyncedAt',
      'syncStatus',
      'manualReviewStatus',
    ].sort());
    expect(contacts.map((contact) => contact.mappingStatus)).toEqual([
      'candidate',
      'matched',
      'conflict',
      'manual_review_required',
    ]);
    expect(mappings.map((mapping) => mapping.mappingStatus)).toEqual([
      'candidate',
      'matched',
      'conflict',
      'manual_review_required',
    ]);
    expect(reviews.map((review) => review.reviewStatus)).toEqual([
      'pending',
      'approved',
      'rejected',
      'needs_more_info',
    ]);
    expectForbiddenFieldsAbsent(payload);
  });

  it.each([
    ['provider_disabled', 'disabled', 'provider_disabled'],
    ['external_disabled', 'external_disabled', 'external_provider_disabled'],
    ['not_configured', 'mock_only', 'authorization_not_available'],
    ['revoked', 'mock_only', 'authorization_not_available'],
    ['expired', 'mock_only', 'authorization_not_available'],
  ] as const)('%s 场景保持 fail-closed', async (scenario, providerState, reason) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(request(`?scenario=${scenario}`));
    const payload = await responseJson(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      providerState,
      syncStatus: 'syncing_disabled',
      failClosed: true,
      reason,
      contacts: [],
      mappingCandidates: [],
      manualReview: [],
      lastSyncedAt: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectForbiddenFieldsAbsent(payload);
  });

  it('忽略 tenantId 查询参数且不会返回跨 tenant 数据', async () => {
    const response = await GET(request('?tenantId=tenant-other'));
    const payload = await responseJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(serialized).not.toContain('tenant-other');
    expect(serialized).not.toContain('tenantId');
    expectForbiddenFieldsAbsent(payload);
  });

  it('未登录时返回 401 且不生成联系人 payload', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const response = await GET(request());
    const payload = await responseJson(response);

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: '请先登录' });
    expect(payload).not.toHaveProperty('contacts');
  });

  it('平台账号和缺少 tenant 的上下文返回 403', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      userId: 'platform-admin',
      role: 'platform_admin',
      scope: 'platform',
      tenantId: null,
      source: 'demo_session',
    } satisfies AccessContext);

    const response = await GET(request());
    const payload = await responseJson(response);

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: '没有访问权限' });
    expect(payload).not.toHaveProperty('contacts');
  });
});
