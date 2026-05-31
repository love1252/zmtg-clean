import { render, screen } from '@testing-library/react';
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

function mockTenantFetch(responses: Response[]) {
  const fetchMock = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
    const response = responses.shift();
    if (!response) {
      throw new Error('没有配置更多平台租户 fetch 响应');
    }

    return response;
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

  expect(text).not.toContain('customers');
  expect(text).not.toContain('appointments');
  expect(text).not.toContain('followUpTasks');
  expect(text).not.toContain('phoneNumber');
  expect(text).not.toContain('13800000000');
  expect(text).not.toContain('idNumber');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('medicalRecordNo');
  expect(text).not.toContain('MR-RAW-001');
  expect(text).not.toContain('treatmentRecord');
  expect(text).not.toContain('完整治疗记录正文');
  expect(text).not.toContain('consultationTranscript');
  expect(text).not.toContain('咨询对话全文');
  expect(text).not.toContain('select * from customers');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('token');
  expect(text).not.toContain('secret');
  expect(text).not.toContain('sk_test_should_not_render');
}

describe('平台端租户管理面板', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('请求平台租户 API 并展示租户、状态、套餐、配额和当前用量', async () => {
    const fetchMock = mockTenantFetch([jsonResponse({ records: [tenantRecord] })]);
    const { container } = render(<OpenPlatformTenantManagementPanel />);

    expect(screen.getByRole('heading', { name: '租户管理' })).toBeInTheDocument();
    expect(screen.getByText('正在加载租户管理数据...')).toBeInTheDocument();
    expect(await screen.findByText('智美天工演示机构')).toBeInTheDocument();
    expect(screen.getByText('租户状态：active')).toBeInTheDocument();
    expect(screen.getByText('租户 ID：demo-tenant-001')).toBeInTheDocument();
    expect(screen.getByText('套餐名称：成长版')).toBeInTheDocument();
    expect(screen.getByText('套餐 code：growth-care')).toBeInTheDocument();
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

    expect(await screen.findByText('暂无租户运营元数据')).toBeInTheDocument();
    expect(screen.getByText('当前没有可展示的租户套餐和配额数据。')).toBeInTheDocument();
  });

  it.each([
    [403, '没有访问权限', '当前账号没有查看租户管理的权限'],
    [503, '数据服务暂时不可用', '租户管理数据暂时不可用'],
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

    expect(await screen.findByText('未分配套餐机构')).toBeInTheDocument();
    expect(screen.getByText('套餐名称：未分配')).toBeInTheDocument();
    expect(screen.getAllByText('- / -')).toHaveLength(4);
    expect(screen.getByText('快照时间：-')).toBeInTheDocument();
  });
});
