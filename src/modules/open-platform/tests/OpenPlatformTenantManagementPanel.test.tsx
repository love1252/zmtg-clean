import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenPlatformTenantManagementPanel } from '@/modules/open-platform/components/OpenPlatformTenantManagementPanel';

const tenantRecord = {
  tenantId: 'demo-tenant-001',
  tenantName: '智美天工演示机构',
  tenantStatus: 'active',
  createdAt: '2026-05-30T00:00:00.000Z',
  updatedAt: '2026-05-31T00:00:00.000Z',
  planName: '成长版',
  planCode: 'growth-care',
  planStatus: 'active',
  assignmentStatus: 'active',
  startedAt: '2026-05-31T00:00:00.000Z',
  expiresAt: null,
  maxCustomers: 5000,
  maxAppointments: 2000,
  maxFollowUps: 10000,
  maxAiCalls: 50000,
  currentCustomers: 24,
  currentAppointments: 12,
  currentFollowUps: 36,
  currentAiCalls: 0,
  snapshotAt: '2026-05-31T08:00:00.000Z',
  customers: [{ phoneNumber: '13800000000' }],
  appointments: [{ customerId: 'cust_001' }],
  followUpTasks: [{ customerId: 'cust_001' }],
  treatmentRecord: '完整治疗记录正文',
  consultationTranscript: '咨询对话全文',
  medicalRecordNo: 'MR-RAW-001',
  idNumber: '110101199001010011',
  sql: 'select * from customers',
  stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_should_not_render',
  secret: 'raw-secret',
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

function fetchPath(input: Parameters<typeof fetch>[0]) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

type MockTenantFetchOptions =
  | Response[]
  | {
      tenantResponses?: Response[];
      auditEventsResponse?: Response;
    };

function defaultAuditEventsResponse() {
  return jsonResponse({
    records: [],
    pageInfo: {
      hasMore: false,
      limit: 100,
      nextCursor: null,
    },
  });
}

function mockTenantFetch(options: MockTenantFetchOptions) {
  const tenantResponses = Array.isArray(options) ? [...options] : [...(options.tenantResponses ?? [])];
  const auditEventsResponse = Array.isArray(options)
    ? defaultAuditEventsResponse()
    : options.auditEventsResponse ?? defaultAuditEventsResponse();

  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
    const path = fetchPath(input);
    if (path === '/api/open-platform/tenants') {
      const response = tenantResponses.length > 1 ? tenantResponses.shift() : tenantResponses[0];
      if (!response) {
        throw new Error('没有配置更多平台租户 fetch 响应');
      }

      return response.clone();
    }

    if (path.startsWith('/api/open-platform/audit-events')) {
      return auditEventsResponse.clone();
    }

    throw new Error(`没有为 ${path} 配置 fetch mock`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

function expectNoSensitiveTenantContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('客户明细');
  expect(text).not.toContain('预约明细');
  expect(text).not.toContain('followUpTasks');
  expect(text).not.toContain('随访任务明细');
  expect(text).not.toContain('phoneNumber');
  expect(text).not.toContain('手机号原文');
  expect(text).not.toContain('13800000000');
  expect(text).not.toContain('idNumber');
  expect(text).not.toContain('身份证号');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('medicalRecordNo');
  expect(text).not.toContain('病历号原文');
  expect(text).not.toContain('MR-RAW-001');
  expect(text).not.toContain('treatmentRecord');
  expect(text).not.toContain('治疗记录');
  expect(text).not.toContain('病历正文');
  expect(text).not.toContain('完整治疗记录正文');
  expect(text).not.toContain('consultationTranscript');
  expect(text).not.toContain('咨询对话');
  expect(text).not.toContain('咨询对话全文');
  expect(text).not.toContain('SQL');
  expect(text).not.toContain('select * from customers');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('连接串');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
  expect(text).not.toContain('sk_test_should_not_render');
}

function expectNoPlatformDemoMisleadingClaims(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('AI 已接入');
  expect(text).not.toContain('AI 自动客服');
  expect(text).not.toContain('RAG 已完成');
  expect(text).not.toContain('Agent 已上线');
  expect(text).not.toContain('支付已完成');
  expect(text).not.toContain('合同已完成');
  expect(text).not.toContain('发票已完成');
  expect(text).not.toContain('Webhook 已接入');
  expect(text).not.toContain('OAuth 已接入');
  expect(text).not.toContain('完整计费后台');
  expect(text).not.toContain('自动升级套餐');
  expect(text).not.toContain('自动触达');
}

function commercialHealthSection() {
  const heading = screen.getByRole('heading', { name: '商业化健康' });
  const section = heading.closest('article');
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

describe('平台端租户管理面板', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('请求平台租户 API 并展示租户、状态、套餐、配额和当前用量', async () => {
    const fetchMock = mockTenantFetch([jsonResponse({ records: [tenantRecord] })]);
    const { container } = render(<OpenPlatformTenantManagementPanel />);

    expect(screen.getByRole('heading', { name: '租户管理' })).toBeInTheDocument();
    expect(screen.getByText(/平台侧查看机构、套餐和配额边界/)).toBeInTheDocument();
    expect(screen.getByText(/当前展示为受控 demo 租户/)).toBeInTheDocument();
    expect(screen.getByText('正在加载租户管理数据...')).toBeInTheDocument();
    expect((await screen.findAllByText('智美天工演示机构')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('运行中')).toBeInTheDocument();
    expect(screen.getByText('租户 ID：demo-tenant-001')).toBeInTheDocument();
    expect(screen.getByText('成长版')).toBeInTheDocument();
    expect(screen.getByText('套餐编号：growth-care')).toBeInTheDocument();
    expect(screen.getByText('套餐状态：active')).toBeInTheDocument();
    expect(screen.getByText('分配状态：active')).toBeInTheDocument();
    expect(screen.getByText('客户数')).toBeInTheDocument();
    expect(screen.getByText('24 / 5000')).toBeInTheDocument();
    expect(screen.getByText('预约数')).toBeInTheDocument();
    expect(screen.getByText('12 / 2000')).toBeInTheDocument();
    expect(screen.getByText('随访任务')).toBeInTheDocument();
    expect(screen.getByText('36 / 10000')).toBeInTheDocument();
    expect(screen.getByText('AI 调用')).toBeInTheDocument();
    expect(screen.getByText('0 / 50000')).toBeInTheDocument();
    expect(screen.getByText('快照时间：2026年5月31日 16:00')).toBeInTheDocument();
    expect(fetchPath(fetchMock.mock.calls[0]?.[0] ?? '')).toBe('/api/open-platform/tenants');
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({ cache: 'no-store' });
    expectNoSensitiveTenantContent(container);
    expectNoPlatformDemoMisleadingClaims(container);
  });

  it('展示商业化健康摘要、配额风险、配置缺失和 quota denied 信号', async () => {
    const riskyTenant = {
      ...tenantRecord,
      tenantId: 'tenant-risk',
      tenantName: '配额风险机构',
      maxCustomers: 100,
      currentCustomers: 88,
    };
    const missingConfigTenant = {
      ...tenantRecord,
      tenantId: 'tenant-missing-config',
      tenantName: '配置缺失机构',
      planName: null,
      planCode: null,
      planStatus: null,
      assignmentStatus: null,
      maxCustomers: null,
      maxAppointments: null,
      maxFollowUps: null,
      maxAiCalls: null,
      currentCustomers: null,
      currentAppointments: null,
      currentFollowUps: null,
      currentAiCalls: null,
      snapshotAt: null,
    };
    const fetchMock = mockTenantFetch({
      tenantResponses: [jsonResponse({ records: [riskyTenant, missingConfigTenant] })],
      auditEventsResponse: jsonResponse({
        records: [
          {
            id: 'audit_quota_denied_001',
            tenantId: 'tenant-risk',
            resource: 'customer',
            resourceId: 'cust_raw_should_not_render',
            action: 'create',
            result: 'denied',
            reason: 'quota_exceeded_customers',
            actorId: 'demo-user-admin',
            actorRole: 'tenant_admin',
            occurredAt: '2026-05-31T10:00:00.000Z',
            requestBody: { phoneNumber: '13800000000' },
            metadata: { sql: 'select * from audit_events' },
            stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
            token: 'sk_test_should_not_render',
            secret: 'raw-secret',
          },
        ],
        pageInfo: {
          hasMore: false,
          limit: 100,
          nextCursor: null,
        },
      }),
    });
    const { container } = render(<OpenPlatformTenantManagementPanel />);

    expect(await screen.findByRole('heading', { name: '商业化健康' })).toBeInTheDocument();
    const section = commercialHealthSection();

    expect(within(section).getByText('套餐覆盖率')).toBeInTheDocument();
    expect(
      within(section).getByText('商业化健康是运营辅助，不是完整计费系统。'),
    ).toBeInTheDocument();
    expect(
      within(section).getByText('quota denied 是演示审计信号，不会自行变更套餐或发起触达动作。'),
    ).toBeInTheDocument();
    expect(within(section).getByText('50%')).toBeInTheDocument();
    expect(within(section).getByText('配额风险项')).toBeInTheDocument();
    expect(within(section).getAllByText('配置缺失租户').length).toBeGreaterThan(0);
    expect(within(section).getByText('近期 quota denied')).toBeInTheDocument();
    expect(within(section).getAllByText('配额风险机构').length).toBeGreaterThan(0);
    expect(within(section).getByText(/客户.*88 \/ 100/)).toBeInTheDocument();
    expect(within(section).getByText('配置缺失机构')).toBeInTheDocument();
    expect(within(section).getByText('缺少 active plan')).toBeInTheDocument();
    expect(within(section).getByText(/缺少 quota limit/)).toBeInTheDocument();
    expect(within(section).getByText('缺少 quota snapshot')).toBeInTheDocument();
    expect(within(section).getByText(/quota_exceeded_customers/)).toBeInTheDocument();
    expect(within(section).getAllByText(/customer/).length).toBeGreaterThan(0);
    expect(within(section).getAllByText(/运营参考/).length).toBeGreaterThan(0);
    expect(within(section).getAllByText(/配额快照/).length).toBeGreaterThan(0);
    expect(section.textContent ?? '').not.toContain('强一致');
    expect(section.textContent ?? '').not.toContain('enforcement');
    expect(fetchMock.mock.calls.map(([input]) => fetchPath(input))).toEqual(
      expect.arrayContaining([
        '/api/open-platform/tenants',
        '/api/open-platform/audit-events?result=denied&limit=100',
      ]),
    );
    expectNoSensitiveTenantContent(container);
    expectNoPlatformDemoMisleadingClaims(container);
    expect(container.textContent ?? '').not.toContain('requestBody');
    expect(container.textContent ?? '').not.toContain('metadata');
    expect(container.textContent ?? '').not.toContain('cust_raw_should_not_render');
  });

  it('展示 loading 状态', () => {
    const pending = deferredResponse();
    vi.stubGlobal('fetch', vi.fn(async () => pending.promise));

    render(<OpenPlatformTenantManagementPanel />);

    expect(screen.getByText('正在加载租户管理数据...')).toBeInTheDocument();
  });

  it('展示 empty 状态', async () => {
    mockTenantFetch([jsonResponse({ records: [] })]);

    render(<OpenPlatformTenantManagementPanel />);

    expect(await screen.findByText('暂无受控 demo 租户')).toBeInTheDocument();
    expect(screen.getByText('当前没有可展示的 demo 租户、套餐或配额快照。')).toBeInTheDocument();
    expect(screen.getByText('暂无需要收尾关注的商业化健康信号')).toBeInTheDocument();
  });

  it.each([
    [403, '没有访问权限', '当前账号没有查看租户管理的权限'],
    [503, '数据服务暂时不可用', '租户治理视图暂时不可用，请稍后刷新或切换演示备份'],
  ])('展示 %s 错误态', async (status, apiMessage, visibleMessage) => {
    mockTenantFetch([jsonResponse({ error: apiMessage }, { status })]);

    render(<OpenPlatformTenantManagementPanel />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
  });

  it('无套餐和无配额快照租户稳定展示占位', async () => {
    mockTenantFetch([
      jsonResponse({
        records: [
          {
            ...tenantRecord,
            tenantId: 'demo-tenant-003',
            tenantName: '未分配套餐机构',
            tenantStatus: 'suspended',
            planName: null,
            planCode: null,
            planStatus: null,
            assignmentStatus: null,
            startedAt: null,
            expiresAt: null,
            maxCustomers: null,
            maxAppointments: null,
            maxFollowUps: null,
            maxAiCalls: null,
            currentCustomers: null,
            currentAppointments: null,
            currentFollowUps: null,
            currentAiCalls: null,
            snapshotAt: null,
          },
        ],
      }),
    ]);

    render(<OpenPlatformTenantManagementPanel />);

    expect((await screen.findAllByText('未分配套餐机构')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('- / -')).toHaveLength(4);
    expect(screen.getByText('快照时间：-')).toBeInTheDocument();
  });

  it('AI 调用配额为 0 / 0 时明确当前未启用 AI 调用配额', async () => {
    mockTenantFetch([
      jsonResponse({
        records: [
          {
            ...tenantRecord,
            maxAiCalls: 0,
            currentAiCalls: 0,
          },
        ],
      }),
    ]);

    const { container } = render(<OpenPlatformTenantManagementPanel />);

    expect((await screen.findAllByText('智美天工演示机构')).length).toBeGreaterThan(0);
    expect(screen.getByText('0 / 0')).toBeInTheDocument();
    expect(screen.getByText('当前未启用 AI 调用配额')).toBeInTheDocument();
    expectNoPlatformDemoMisleadingClaims(container);
  });
});
