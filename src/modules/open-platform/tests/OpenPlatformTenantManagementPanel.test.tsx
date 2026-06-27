import { fireEvent, render, screen, within } from '@testing-library/react';
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
  planVersionId: 'plan-version-growth-202606',
  planVersionCode: '2026-06-v1',
  planDisplayName: 'Growth Care 2026-06',
  planDisplayPrice: '¥2999/月',
  assignmentStatus: 'active',
  startedAt: '2026-05-31T00:00:00.000Z',
  expiresAt: null,
  agentLimit: 3,
  seatLimit: 40,
  monthlyAiCallLimit: 300000,
  knowledgeStorageGb: 100,
  connectorEntitlements: ['企微', 'HIS'],
  serviceEntitlements: ['上线培训', '季度复盘'],
  authorizationSnapshotId: 'auth-snapshot-demo-tenant-001-active',
  authorizationSnapshotStatus: 'active',
  authorizationGeneratedAt: '2026-06-23T02:00:00.000Z',
  openingContact: {
    contactName: '陈磊',
    contactPhone: '13985162773',
    contactEmail: 'contact@example.com',
    adminName: '陈磊',
    adminAccount: 'zhengpu',
    adminContact: '13985162273',
  },
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

const professionalPlanOption = {
  planId: 'plan-professional',
  planCode: 'professional',
  planName: 'Professional 专业版',
  planVersionId: 'plan-version-professional-published',
  versionCode: '2026-06-v1',
  displayName: 'Professional 专业版 2026-06',
  displayPrice: '¥2999/月',
  priceNote: '展示价格，人工确认口径',
  agentLimit: 3,
  seatLimit: 40,
  monthlyAiCallLimit: 300000,
  knowledgeStorageGb: 100,
  connectorEntitlements: ['企微', 'HIS'],
  serviceEntitlements: ['上线培训'],
};

const trialPlanOption = {
  planId: 'plan-trial',
  planCode: 'trial-care',
  planName: '试用版',
  planVersionId: 'plan-version-trial-published',
  versionCode: '2026-06-v1',
  displayName: '试用版',
  displayPrice: '试用版展示价（未定价）',
  priceNote: '10 天商业试用体验周期',
  agentLimit: 1,
  seatLimit: 1,
  monthlyAiCallLimit: 5000,
  knowledgeStorageGb: 1,
  connectorEntitlements: ['企微'],
  serviceEntitlements: ['新手引导'],
};

const enterprisePlanOption = {
  planId: 'plan-enterprise',
  planCode: 'enterprise',
  planName: 'Enterprise 集团版',
  planVersionId: 'plan-version-enterprise-published',
  versionCode: '2026-06-v1',
  displayName: 'Enterprise 集团版 2026-06',
  displayPrice: '¥9999/月',
  priceNote: '展示价格，人工确认口径',
  agentLimit: 20,
  seatLimit: 200,
  monthlyAiCallLimit: 2000000,
  knowledgeStorageGb: 1024,
  connectorEntitlements: ['企微', 'HIS', 'CRM', '新氧', '美团', '抖音'],
  serviceEntitlements: ['专属实施', '年度复盘'],
};

const tenantPlanChangePreview = {
  tenantId: 'demo-tenant-001',
  fromPlanVersionId: 'plan-version-growth-202606',
  toPlanVersionId: 'plan-version-enterprise-published',
  changedItemCount: 9,
  unchangedItemCount: 0,
  items: [
    {
      key: 'displayName',
      label: '套餐版本',
      before: 'Growth Care 2026-06',
      after: 'Enterprise 集团版 2026-06',
      changed: true,
    },
    {
      key: 'displayPrice',
      label: '展示价格',
      before: '¥2999/月',
      after: '¥9999/月',
      changed: true,
    },
    {
      key: 'agentLimit',
      label: 'Agent 数量',
      before: '3',
      after: '20',
      changed: true,
    },
    {
      key: 'seatLimit',
      label: '员工席位',
      before: '40',
      after: '200',
      changed: true,
    },
    {
      key: 'monthlyAiCallLimit',
      label: 'AI 调用 / 月',
      before: '300,000',
      after: '2,000,000',
      changed: true,
    },
    {
      key: 'knowledgeStorageGb',
      label: '知识库存储',
      before: '100 GB',
      after: '1,024 GB',
      changed: true,
    },
    {
      key: 'connectorEntitlements',
      label: '连接器权益',
      before: '企微 / HIS',
      after: '企微 / HIS / CRM / 新氧 / 美团 / 抖音',
      changed: true,
    },
    {
      key: 'serviceEntitlements',
      label: '服务权益',
      before: '上线培训 / 季度复盘',
      after: '专属实施 / 年度复盘',
      changed: true,
    },
    {
      key: 'versionCode',
      label: '版本号',
      before: '2026-06-v1',
      after: '2026-06-v1',
      changed: false,
    },
  ],
};

const tenantAfterPlanChange = {
  ...tenantRecord,
  updatedAt: '2026-06-23T04:00:00.000Z',
  planName: 'Enterprise 集团版',
  planCode: 'enterprise',
  planVersionId: 'plan-version-enterprise-published',
  planVersionCode: '2026-06-v1',
  planDisplayName: 'Enterprise 集团版 2026-06',
  planDisplayPrice: '¥9999/月',
  agentLimit: 20,
  seatLimit: 200,
  monthlyAiCallLimit: 2000000,
  knowledgeStorageGb: 1024,
  connectorEntitlements: ['企微', 'HIS', 'CRM', '新氧', '美团', '抖音'],
  serviceEntitlements: ['专属实施', '年度复盘'],
  authorizationSnapshotId: 'auth-snapshot-enterprise-active',
  authorizationGeneratedAt: '2026-06-23T04:00:00.000Z',
};

const trialTenantRecord = {
  ...tenantRecord,
  tenantId: 'tenant-11317ff5-ae9',
  tenantName: '上海正璞医疗美容门诊部有限公司',
  planName: '试用版',
  planCode: 'trial-care',
  planVersionId: 'plan-version-trial-published',
  planVersionCode: '2026-06-v1',
  planDisplayName: '试用版',
  planDisplayPrice: '试用版展示价（未定价）',
  startedAt: '2026-06-25T08:35:39.190Z',
  expiresAt: '2026-07-05T08:35:39.190Z',
};

const tenantCommercialRecords = [
  {
    recordId: 'commercial-record-order-001',
    tenantId: 'demo-tenant-001',
    recordType: 'order',
    recordTypeLabel: '订单',
    status: 'pending',
    statusLabel: '待人工确认',
    displayCode: 'ORD-2026-0001',
    displayAmount: '¥2999/月',
    periodLabel: '2026-06',
    relatedPlanChangeId: 'tenant-plan-change-demo-001',
    occurredAt: '2026-06-23T06:00:00.000Z',
    createdAt: '2026-06-23T06:00:00.000Z',
    updatedAt: '2026-06-23T06:10:00.000Z',
  },
  {
    recordId: 'commercial-record-contract-001',
    tenantId: 'demo-tenant-001',
    recordType: 'contract',
    recordTypeLabel: '合同',
    status: 'manual_review',
    statusLabel: '人工复核',
    displayCode: 'CON-2026-0001',
    displayAmount: null,
    periodLabel: '2026-06',
    relatedPlanChangeId: null,
    occurredAt: null,
    createdAt: '2026-06-23T06:00:00.000Z',
    updatedAt: '2026-06-23T06:10:00.000Z',
  },
  {
    recordId: 'commercial-record-invoice-001',
    tenantId: 'demo-tenant-001',
    recordType: 'invoice',
    recordTypeLabel: '发票',
    status: 'draft',
    statusLabel: '预留草稿',
    displayCode: 'INV-2026-0001',
    displayAmount: null,
    periodLabel: null,
    relatedPlanChangeId: null,
    occurredAt: null,
    createdAt: '2026-06-23T06:00:00.000Z',
    updatedAt: '2026-06-23T06:10:00.000Z',
  },
  {
    recordId: 'commercial-record-payment-001',
    tenantId: 'demo-tenant-001',
    recordType: 'payment',
    recordTypeLabel: '支付',
    status: 'completed',
    statusLabel: '已人工确认',
    displayCode: 'PAY-2026-0001',
    displayAmount: '¥2999/月',
    periodLabel: '2026-06',
    relatedPlanChangeId: null,
    occurredAt: '2026-06-23T06:00:00.000Z',
    createdAt: '2026-06-23T06:00:00.000Z',
    updatedAt: '2026-06-23T06:10:00.000Z',
  },
];

const mockEntitlementUsageView = {
  tenantId: 'demo-tenant-001',
  institutionId: 'inst-001',
  planCode: 'growth-care',
  planName: '成长版',
  items: [
    { resource: 'customers', label: '客户数', used: 80, limit: 100, remaining: 20, status: 'normal' },
    { resource: 'staff_seats', label: '员工席位', used: 15, limit: 20, remaining: 5, status: 'normal' },
    { resource: 'knowledge_files', label: '知识库文件', used: 90, limit: 100, remaining: 10, status: 'near_limit' },
    { resource: 'ai_calls', label: 'AI 调用（本月）', used: 200, limit: 500, remaining: 300, status: 'normal' },
  ],
  readable: true,
  source: 'mixed',
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
      planOptionsResponse?: Response;
      createTenantResponse?: Response;
      planChangePreviewResponse?: Response;
      planChangeResponse?: Response;
      commercialRecordsResponse?: Response;
      auditEventsResponse?: Response;
      entitlementUsageResponse?: Response;
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
  const planOptionsResponse = Array.isArray(options)
    ? jsonResponse({ options: [professionalPlanOption] })
    : options.planOptionsResponse ?? jsonResponse({ options: [professionalPlanOption] });
  const createTenantResponse = Array.isArray(options)
    ? jsonResponse({ ok: true, status: 'tenant_created', tenant: tenantRecord })
    : options.createTenantResponse ??
      jsonResponse({
        ok: true,
        status: 'tenant_created',
        tenant: {
          ...tenantRecord,
          tenantId: 'tenant-created',
          tenantName: '星澜医美中心',
          planName: 'Professional 专业版',
          planCode: 'professional',
          planVersionId: 'plan-version-professional-published',
          planVersionCode: '2026-06-v1',
          planDisplayName: 'Professional 专业版 2026-06',
          planDisplayPrice: '¥2999/月',
          authorizationSnapshotId: 'tenant-authorization-snapshot-created',
          authorizationSnapshotStatus: 'active',
          authorizationGeneratedAt: '2026-06-23T03:00:00.000Z',
        },
      });
  const planChangePreviewResponse = Array.isArray(options)
    ? jsonResponse({ ok: true, status: 'preview_ready', preview: tenantPlanChangePreview })
    : options.planChangePreviewResponse ??
      jsonResponse({ ok: true, status: 'preview_ready', preview: tenantPlanChangePreview });
  const planChangeResponse = Array.isArray(options)
    ? jsonResponse({
        ok: true,
        status: 'plan_changed',
        changeRecordId: 'tenant-plan-change-demo-001',
        auditEventId: 'audit-event-demo-001',
        tenant: tenantAfterPlanChange,
      })
    : options.planChangeResponse ??
      jsonResponse({
        ok: true,
        status: 'plan_changed',
        changeRecordId: 'tenant-plan-change-demo-001',
        auditEventId: 'audit-event-demo-001',
        tenant: tenantAfterPlanChange,
      });
  const commercialRecordsResponse = Array.isArray(options)
    ? jsonResponse({ ok: true, records: tenantCommercialRecords })
    : options.commercialRecordsResponse ??
      jsonResponse({ ok: true, records: tenantCommercialRecords });
  const auditEventsResponse = Array.isArray(options)
    ? defaultAuditEventsResponse()
    : options.auditEventsResponse ?? defaultAuditEventsResponse();

  const entitlementUsageResponse = Array.isArray(options)
    ? jsonResponse(mockEntitlementUsageView)
    : options.entitlementUsageResponse ?? jsonResponse(mockEntitlementUsageView);

  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
    const path = fetchPath(input);
    const method = String(_init?.method ?? 'GET').toUpperCase();
    if (path === '/api/open-platform/tenants') {
      const response = tenantResponses.length > 1 ? tenantResponses.shift() : tenantResponses[0];
      if (!response) {
        throw new Error('没有配置更多平台租户 fetch 响应');
      }

      return response.clone();
    }

    if (path === '/api/v1/open-platform/tenant-plan-options' && method === 'GET') {
      return planOptionsResponse.clone();
    }

    if (path === '/api/v1/open-platform/tenants' && method === 'POST') {
      return createTenantResponse.clone();
    }

    if (
      path === '/api/v1/open-platform/tenants/demo-tenant-001/plan-change-preview' &&
      method === 'POST'
    ) {
      return planChangePreviewResponse.clone();
    }

    if (path === '/api/v1/open-platform/tenants/demo-tenant-001/plan-change' && method === 'POST') {
      return planChangeResponse.clone();
    }

    if (
      path === '/api/v1/open-platform/tenants/demo-tenant-001/commercial-records' &&
      method === 'GET'
    ) {
      return commercialRecordsResponse.clone();
    }

    if (path.startsWith('/api/open-platform/audit-events')) {
      return auditEventsResponse.clone();
    }

    if (path.match(/\/api\/v1\/open-platform\/tenants\/[\w-]+\/entitlement-usage/)) {
      return entitlementUsageResponse.clone();
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

describe('平台端租户管理面板', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('请求平台租户 API 并展示租户、状态、套餐、配额和当前用量', async () => {
    const fetchMock = mockTenantFetch([jsonResponse({ records: [tenantRecord] })]);
    const { container } = render(<OpenPlatformTenantManagementPanel />);

    expect(screen.getByRole('heading', { name: '租户管理' })).toBeInTheDocument();
    expect(screen.getByText(/平台侧查看机构、套餐和配额边界/)).toBeInTheDocument();
    expect(screen.getByText(/支持受控开通测试租户并生成授权快照/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('受控演示租户');
    expect(screen.getByText('正在加载租户管理数据...')).toBeInTheDocument();
    expect((await screen.findAllByText('智美天工演示机构')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('运行中')).toBeInTheDocument();
    expect(screen.getByText('租户 ID：demo-tenant-001')).toBeInTheDocument();
    expect(screen.getAllByText('成长版').length).toBeGreaterThan(0);
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

  it('不再展示旧商业化健康卡片或请求 quota denied 审计信号', async () => {
    const fetchMock = mockTenantFetch({
      tenantResponses: [jsonResponse({ records: [tenantRecord] })],
    });
    const { container } = render(<OpenPlatformTenantManagementPanel />);

    expect((await screen.findAllByText('智美天工演示机构')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: '商业化健康' })).not.toBeInTheDocument();
    expect(screen.queryByText('只读运营辅助')).not.toBeInTheDocument();
    expect(screen.queryByText('套餐覆盖率')).not.toBeInTheDocument();
    expect(screen.queryByText(/quota denied/)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([input]) => fetchPath(input))).not.toContain(
      '/api/open-platform/audit-events?result=denied&limit=100',
    );
    expectNoSensitiveTenantContent(container);
    expectNoPlatformDemoMisleadingClaims(container);
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

    expect(await screen.findByText('暂无租户记录')).toBeInTheDocument();
    expect(screen.getByText('当前没有可展示的租户、套餐或配额快照。')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '商业化健康' })).not.toBeInTheDocument();
  });

  it.each([
    [403, '没有访问权限', '当前账号没有查看租户管理的权限'],
    [503, '数据服务暂时不可用', '租户治理视图暂时不可用，请稍后刷新或切换到开发空态'],
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

  it('支持搜索和前端筛选授权异常租户', async () => {
    const riskyTenant = {
      ...tenantRecord,
      tenantId: 'tenant-risk',
      tenantName: '授权异常机构',
      planName: null,
      planCode: null,
      planStatus: null,
      assignmentStatus: null,
      snapshotAt: null,
    };
    mockTenantFetch([
      jsonResponse({
        records: [
          tenantRecord,
          {
            ...tenantRecord,
            tenantId: 'tenant-expiring',
            tenantName: '即将到期机构',
            expiresAt: '2026-06-29T00:00:00.000Z',
            currentCustomers: 4500,
          },
          riskyTenant,
        ],
      }),
    ]);

    render(<OpenPlatformTenantManagementPanel />);

    expect(await screen.findByText('租户管理工作台')).toBeInTheDocument();
    expect(screen.getAllByText('授权异常').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText('搜索租户'), { target: { value: '授权异常' } });
    fireEvent.change(screen.getByLabelText('授权状态'), { target: { value: 'issue' } });

    const table = screen.getByRole('table');
    expect(within(table).getAllByText('授权异常机构').length).toBeGreaterThan(0);
    expect(within(table).queryByText('智美天工演示机构')).not.toBeInTheDocument();
    expect(screen.getByText('筛选结果 1 个租户')).toBeInTheDocument();
  });

  it('点击查看打开租户详情抽屉并展示授权快照、历史快照用量和审计入口', async () => {
    mockTenantFetch([jsonResponse({ records: [trialTenantRecord] })]);

    render(<OpenPlatformTenantManagementPanel />);

    expect((await screen.findAllByText('上海正璞医疗美容门诊部有限公司')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '查看 上海正璞医疗美容门诊部有限公司' }));

    const drawer = screen.getByRole('dialog', { name: '租户详情' });
    expect(within(drawer).getByText('联系人：陈磊')).toBeInTheDocument();
    expect(within(drawer).getByText('联系人手机：13985162773')).toBeInTheDocument();
    expect(within(drawer).getByText('联系人邮箱：contact@example.com')).toBeInTheDocument();
    expect(within(drawer).getByText('管理员账号：zhengpu')).toBeInTheDocument();
    expect(within(drawer).getByText('管理员联系方式：13985162273')).toBeInTheDocument();
    expect(within(drawer).queryByText(/张\*\*/)).not.toBeInTheDocument();
    expect(within(drawer).getByText('试用开始：2026年6月25日 16:35')).toBeInTheDocument();
    expect(within(drawer).getByText('试用截止：2026年7月5日 16:35')).toBeInTheDocument();
    expect(within(drawer).getAllByText('14 天后到期').length).toBeGreaterThan(0);
    expect(within(drawer).getByText('授权快照')).toBeInTheDocument();
    expect(within(drawer).getByText('历史快照用量（仅供参考）')).toBeInTheDocument();
    expect(await within(drawer).findByText('商业化预留')).toBeInTheDocument();
    expect(within(drawer).getByText('审计入口')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: '查看审计日志' })).toBeInTheDocument();
  });

  it('租户详情展示新旧用量口径明确区分', async () => {
    mockTenantFetch([jsonResponse({ records: [tenantRecord] })]);

    render(<OpenPlatformTenantManagementPanel />);

    expect((await screen.findAllByText('智美天工演示机构')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '查看 智美天工演示机构' }));

    const drawer = screen.getByRole('dialog', { name: '租户详情' });

    // 旧口径：历史快照用量
    expect(within(drawer).getByText('历史快照用量（仅供参考）')).toBeInTheDocument();
    expect(within(drawer).getByText('此数据来自授权快照，非实时统计。实际限制以下方"实时套餐权益用量"的实时统计为准。')).toBeInTheDocument();

    // 新口径：实时套餐权益用量
    expect(await within(drawer).findByText('实时套餐权益用量（当前限制判断依据）')).toBeInTheDocument();
    expect(within(drawer).getByText('当前套餐：成长版')).toBeInTheDocument();

    // 四个资源项（两个区域都有，新区域在每个 item 内用 label 展示）
    expect(within(drawer).getAllByText('客户数').length).toBeGreaterThanOrEqual(1);
    expect(within(drawer).getAllByText('员工席位').length).toBeGreaterThanOrEqual(1);
    expect(within(drawer).getAllByText('知识库文件').length).toBeGreaterThanOrEqual(1);
    expect(within(drawer).getAllByText('AI 调用（本月）').length).toBeGreaterThanOrEqual(1);

    // 状态显示
    // near_limit 状态
    expect(within(drawer).getByText('接近上限')).toBeInTheDocument();
    expect(within(drawer).getByText('即将达到当前套餐上限，请联系平台管理员')).toBeInTheDocument();
    // normal 状态
    expect(within(drawer).getAllByText('正常').length).toBeGreaterThanOrEqual(1);

    // planName 展示（成长版出现在新区域标题和旧区域租户信息中）
    expect(within(drawer).getAllByText(/成长版/).length).toBeGreaterThanOrEqual(1);
  });

  it('套餐权益用量展示 exceeded 状态警告', async () => {
    mockTenantFetch({
      tenantResponses: [jsonResponse({ records: [tenantRecord] })],
      entitlementUsageResponse: jsonResponse({
        ...mockEntitlementUsageView,
        items: mockEntitlementUsageView.items.map((item) =>
          item.resource === 'ai_calls'
            ? { ...item, used: 500, remaining: 0, status: 'exceeded' }
            : item,
        ),
      }),
    });

    render(<OpenPlatformTenantManagementPanel />);

    expect((await screen.findAllByText('智美天工演示机构')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '查看 智美天工演示机构' }));

    const drawer = screen.getByRole('dialog', { name: '租户详情' });
    expect(await within(drawer).findByText('已超限')).toBeInTheDocument();
    expect(within(drawer).getByText('已达到上限，后续操作将受限')).toBeInTheDocument();
  });

  it('套餐权益用量无套餐时不展示', async () => {
    mockTenantFetch({
      tenantResponses: [jsonResponse({ records: [tenantRecord] })],
      entitlementUsageResponse: jsonResponse({
        ...mockEntitlementUsageView,
        planCode: null,
        planName: null,
        items: mockEntitlementUsageView.items.map((item) => ({
          ...item,
          status: 'no_active_plan',
          used: null,
          limit: null,
          remaining: null,
        })),
      }),
    });

    render(<OpenPlatformTenantManagementPanel />);

    expect((await screen.findAllByText('智美天工演示机构')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '查看 智美天工演示机构' }));

    const drawer = screen.getByRole('dialog', { name: '租户详情' });
    expect(await within(drawer).findByText('实时套餐权益用量（当前限制判断依据）')).toBeInTheDocument();
    expect(within(drawer).getByText('当前套餐：-')).toBeInTheDocument();
    expect(within(drawer).getAllByText('无套餐').length).toBeGreaterThanOrEqual(1);
  });

  it('租户详情展示订单、合同、发票、支付的只读商业化预留状态', async () => {
    const fetchMock = mockTenantFetch({
      tenantResponses: [jsonResponse({ records: [tenantRecord] })],
      commercialRecordsResponse: jsonResponse({
        ok: true,
        records: [
          ...tenantCommercialRecords,
          {
            recordId: 'commercial-record-sensitive',
            tenantId: 'demo-tenant-001',
            recordType: 'order',
            recordTypeLabel: '订单',
            status: 'cancelled',
            statusLabel: '已取消',
            displayCode: 'ORD-SAFE',
            displayAmount: null,
            periodLabel: null,
            relatedPlanChangeId: null,
            occurredAt: null,
            createdAt: '2026-06-23T06:00:00.000Z',
            updatedAt: '2026-06-23T06:10:00.000Z',
            note: 'payment_token=payment_token_should_not_render',
            webhook_secret: 'webhook_secret_should_not_render',
            contract_body: '完整合同正文',
          },
        ],
      }),
    });
    const { container } = render(<OpenPlatformTenantManagementPanel />);

    expect((await screen.findAllByText('智美天工演示机构')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '查看 智美天工演示机构' }));

    const drawer = screen.getByRole('dialog', { name: '租户详情' });
    expect(await within(drawer).findByText('商业化预留')).toBeInTheDocument();
    expect(within(drawer).getByText('ORD-2026-0001')).toBeInTheDocument();
    expect(within(drawer).getByText('待人工确认')).toBeInTheDocument();
    expect(within(drawer).getByText('CON-2026-0001')).toBeInTheDocument();
    expect(within(drawer).getByText('人工复核')).toBeInTheDocument();
    expect(within(drawer).getByText('INV-2026-0001')).toBeInTheDocument();
    expect(within(drawer).getByText('预留草稿')).toBeInTheDocument();
    expect(within(drawer).getByText('PAY-2026-0001')).toBeInTheDocument();
    expect(within(drawer).getByText('已人工确认')).toBeInTheDocument();
    expect(within(drawer).getByText(/只读人工记录/)).toBeInTheDocument();

    expect(fetchMock.mock.calls.some(([input, init]) => (
      fetchPath(input) === '/api/v1/open-platform/tenants/demo-tenant-001/commercial-records' &&
      String(init?.method ?? 'GET').toUpperCase() === 'GET'
    ))).toBe(true);
    expect(container.textContent ?? '').not.toMatch(
      /payment_token|webhook_secret|contract_body|完整合同正文|立即支付|自动扣费|在线开票|第三方商业化 API/i,
    );
    expectNoSensitiveTenantContent(container);
    expectNoPlatformDemoMisleadingClaims(container);
  });

  it('在租户详情中预览套餐变更差异并应用生成新授权快照', async () => {
    const fetchMock = mockTenantFetch({
      tenantResponses: [jsonResponse({ records: [tenantRecord] })],
      planOptionsResponse: jsonResponse({ options: [professionalPlanOption, enterprisePlanOption] }),
    });
    const { container } = render(<OpenPlatformTenantManagementPanel />);

    expect((await screen.findAllByText('智美天工演示机构')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '查看 智美天工演示机构' }));

    const drawer = screen.getByRole('dialog', { name: '租户详情' });
    fireEvent.click(within(drawer).getByRole('button', { name: '变更套餐' }));
    fireEvent.change(within(drawer).getByLabelText('目标套餐版本'), {
      target: { value: 'plan-version-enterprise-published' },
    });
    fireEvent.change(within(drawer).getByLabelText('变更原因'), {
      target: { value: '机构升级到集团版并刷新授权快照' },
    });
    fireEvent.click(within(drawer).getByRole('button', { name: '预览变更' }));

    expect(await within(drawer).findByText('套餐变更差异对照')).toBeInTheDocument();
    expect(within(drawer).getByText('展示价格')).toBeInTheDocument();
    expect(within(drawer).getAllByText('¥2999/月').length).toBeGreaterThan(0);
    expect(within(drawer).getByText('¥9999/月')).toBeInTheDocument();
    expect(within(drawer).getByText('Agent 数量')).toBeInTheDocument();
    expect(within(drawer).getByText('20')).toBeInTheDocument();
    expect(within(drawer).getByText('连接器权益')).toBeInTheDocument();
    expect(within(drawer).getByText('企微 / HIS / CRM / 新氧 / 美团 / 抖音')).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: '确认应用变更' }));

    expect(await within(drawer).findByText('套餐变更已应用并生成新授权快照')).toBeInTheDocument();
    expect(within(drawer).getByText('变更记录：tenant-plan-change-demo-001')).toBeInTheDocument();
    expect(within(drawer).getByText('审计事件：audit-event-demo-001')).toBeInTheDocument();
    expect(screen.getAllByText('Enterprise 集团版').length).toBeGreaterThan(0);
    expect(screen.getAllByText('套餐编号：enterprise').length).toBeGreaterThan(0);

    const previewCall = fetchMock.mock.calls.find(([input, init]) => (
      fetchPath(input) === '/api/v1/open-platform/tenants/demo-tenant-001/plan-change-preview' &&
      String(init?.method).toUpperCase() === 'POST'
    ));
    const applyCall = fetchMock.mock.calls.find(([input, init]) => (
      fetchPath(input) === '/api/v1/open-platform/tenants/demo-tenant-001/plan-change' &&
      String(init?.method).toUpperCase() === 'POST'
    ));
    expect(previewCall).toBeDefined();
    expect(applyCall).toBeDefined();
    expect(JSON.parse(String(previewCall?.[1]?.body))).toEqual({
      toPlanVersionId: 'plan-version-enterprise-published',
      reason: '机构升级到集团版并刷新授权快照',
    });
    expect(JSON.parse(String(applyCall?.[1]?.body))).toEqual({
      toPlanVersionId: 'plan-version-enterprise-published',
      reason: '机构升级到集团版并刷新授权快照',
    });
    expect(`${previewCall?.[1]?.body ?? ''}${applyCall?.[1]?.body ?? ''}`).not.toMatch(
      /13800000000|admin@example.com|payment_token|webhook_secret|client_secret|api_key/i,
    );
    expectNoSensitiveTenantContent(container);
    expectNoPlatformDemoMisleadingClaims(container);
  });

  it('新建试用租户时展示 10 天游标并提交真实业务联系人字段', async () => {
    const fetchMock = mockTenantFetch({
      tenantResponses: [jsonResponse({ records: [tenantRecord] })],
      planOptionsResponse: jsonResponse({ options: [trialPlanOption, professionalPlanOption] }),
    });
    const { container } = render(<OpenPlatformTenantManagementPanel />);

    expect((await screen.findAllByText('智美天工演示机构')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '打开新建租户' }));

    expect(screen.getByRole('dialog', { name: '新建租户' })).toBeInTheDocument();
    expect(screen.getByText('机构与管理员')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('机构名称'), { target: { value: '星澜医美中心' } });
    fireEvent.change(screen.getByLabelText('联系人姓名'), { target: { value: '张明' } });
    fireEvent.change(screen.getByLabelText('联系人手机号'), { target: { value: '13800000000' } });
    fireEvent.change(screen.getByLabelText('联系人邮箱'), { target: { value: 'contact@example.com' } });
    fireEvent.change(screen.getByLabelText('管理员姓名'), { target: { value: '李静' } });
    fireEvent.change(screen.getByLabelText('管理员登录账号'), { target: { value: 'xinglan_admin' } });
    fireEvent.change(screen.getByLabelText('管理员手机号或邮箱'), { target: { value: 'admin@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    expect(screen.getByText('套餐与权益')).toBeInTheDocument();
    expect(screen.getByText('试用版 授权预览')).toBeInTheDocument();
    expect(screen.getAllByText('展示价格 试用版展示价（未定价）').length).toBeGreaterThan(0);
    expect(screen.getByText('套餐版本 2026-06-v1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    expect(screen.getAllByText('提交确认').length).toBeGreaterThan(0);
    expect(screen.getByText('试用周期：10 天')).toBeInTheDocument();
    expect(screen.getByText('开始时间：2026年6月22日 00:00')).toBeInTheDocument();
    expect(screen.getByText('截止时间：2026年7月2日 00:00')).toBeInTheDocument();
    expect(screen.getByText('审计摘要')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认开设租户' }));

    expect(await screen.findByText('租户已开通并生成授权快照')).toBeInTheDocument();
    expect(screen.getByText('租户主体')).toBeInTheDocument();
    expect(screen.getByText('套餐分配')).toBeInTheDocument();
    expect(screen.getAllByText('授权快照').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/星澜医美中心/).length).toBeGreaterThan(0);
    const createCall = fetchMock.mock.calls.find(([input, init]) => (
      fetchPath(input) === '/api/v1/open-platform/tenants' &&
      String(init?.method).toUpperCase() === 'POST'
    ));
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      organizationName: '星澜医美中心',
      contactName: '张明',
      contactPhone: '13800000000',
      contactEmail: 'contact@example.com',
      adminName: '李静',
      adminAccount: 'xinglan_admin',
      adminContact: 'admin@example.com',
      planVersionId: 'plan-version-trial-published',
      reason: '平台测试租户开设，用于授权快照验证。',
    });
    expect(String(createCall?.[1]?.body)).not.toMatch(
      /PlaintextPasswordShouldNotPass|requestBody|select \*|payment_token|webhook_secret|client_secret|api_key/i,
    );
    expect(fetchMock.mock.calls.map(([input]) => fetchPath(input))).toEqual(
      expect.arrayContaining([
        '/api/open-platform/tenants',
        '/api/v1/open-platform/tenant-plan-options',
        '/api/v1/open-platform/tenants',
      ]),
    );
    expectNoPlatformDemoMisleadingClaims(container);
  });

  it('暂无租户时展示空状态和低风险入口', async () => {
    mockTenantFetch([jsonResponse({ records: [] })]);

    render(<OpenPlatformTenantManagementPanel />);

    expect(await screen.findByText('暂无租户')).toBeInTheDocument();
    expect(screen.getByText('请通过平台管理端开设第一个测试租户。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建租户' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看产品与套餐' })).toBeInTheDocument();
  });
});
