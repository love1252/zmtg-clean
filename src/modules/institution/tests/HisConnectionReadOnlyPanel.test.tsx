import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HisConnectionReadOnlyPanel } from '@/modules/institution/components/HisConnectionReadOnlyPanel';

const activeHisConnection = {
  connectionId: 'his_conn_active',
  connectionName: '星澜 HIS 只读连接',
  sourceSystem: 'his',
  vendorType: 'demo_vendor',
  systemType: 'his',
  status: 'active',
  credentialConfigured: true,
  healthStatus: 'healthy',
  lastCheckedAt: '2026-06-03T08:30:00.000Z',
  lastErrorCode: 'SAFE_TIMEOUT',
  createdAt: '2026-06-03T08:00:00.000Z',
  updatedAt: '2026-06-03T08:20:00.000Z',
  revokedAt: null,
  tenantId: 'tenant_should_not_render',
  deletedAt: '2026-06-03T09:00:00.000Z',
  credentialRef: 'cred_ref_internal_only',
  token: 'token_should_not_render',
  secret: 'secret_should_not_render',
  apiKey: 'sk_test_should_not_render',
  oauthToken: 'oauth_should_not_render',
  basicAuth: 'basic_auth_should_not_render',
  signingKey: 'signing_key_should_not_render',
  privateKey: 'private_key_should_not_render',
  connectionString: 'postgres://tenant:secret@localhost:5432/zmtg',
  rawHisPayload: 'raw HIS payload should not render',
  requestBody: '完整请求体不应展示',
  responseBody: '完整响应体不应展示',
  sql: 'select * from his_connections',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
};

const draftHisConnection = {
  ...activeHisConnection,
  connectionId: 'his_conn_draft',
  connectionName: '草稿连接',
  status: 'draft',
  credentialConfigured: false,
  healthStatus: 'unknown',
  lastCheckedAt: null,
  lastErrorCode: null,
  createdAt: '2026-06-03T08:05:00.000Z',
  updatedAt: '2026-06-03T08:05:00.000Z',
};

const failedHisConnection = {
  ...activeHisConnection,
  connectionId: 'his_conn_failed',
  connectionName: '异常连接',
  status: 'error',
  credentialConfigured: false,
  healthStatus: 'failed',
  lastErrorCode: 'SAFE_FAILED',
  revokedAt: '2026-06-03T10:00:00.000Z',
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

type MockHisConnectionFetchOptions = {
  listStatus?: number;
  listBody?: unknown;
  detailStatus?: number;
  detailBody?: unknown;
};

function mockHisConnectionFetch(options: MockHisConnectionFetchOptions = {}) {
  const {
    listStatus = 200,
    listBody = { records: [activeHisConnection, draftHisConnection, failedHisConnection] },
    detailStatus = 200,
    detailBody = { record: activeHisConnection },
  } = options;

  const fetchMock = vi.fn(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const path = fetchPath(input);
      const method = init?.method ?? 'GET';

      if (path === '/api/institution/his-connections' && method === 'GET') {
        return jsonResponse(listBody, { status: listStatus });
      }

      if (path.startsWith('/api/institution/his-connections/') && method === 'GET') {
        return jsonResponse(detailBody, { status: detailStatus });
      }

      throw new Error(`unexpected fetch ${method} ${path}`);
    },
  );

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function expectNoSensitiveHisConnectionContent(container: HTMLElement) {
  const content = container.textContent ?? '';

  expect(content).not.toContain('tenant_should_not_render');
  expect(content).not.toContain('deletedAt');
  expect(content).not.toContain('credentialRef');
  expect(content).not.toContain('cred_ref_internal_only');
  expect(content).not.toContain('token_should_not_render');
  expect(content).not.toContain('secret_should_not_render');
  expect(content).not.toContain('sk_test_should_not_render');
  expect(content).not.toContain('oauth_should_not_render');
  expect(content).not.toContain('basic_auth_should_not_render');
  expect(content).not.toContain('signing_key_should_not_render');
  expect(content).not.toContain('private_key_should_not_render');
  expect(content).not.toContain('postgres://');
  expect(content).not.toContain('raw HIS payload should not render');
  expect(content).not.toContain('完整请求体不应展示');
  expect(content).not.toContain('完整响应体不应展示');
  expect(content).not.toContain('select * from his_connections');
  expect(content).not.toContain('DATABASE_URL');
  expect(content).not.toContain('stack');
}

function expectNoHisConnectionWriteActions(container: HTMLElement) {
  for (const label of ['创建', '编辑', '删除', '暂停', '恢复', '撤销', '配置凭证', '测试连接']) {
    expect(screen.queryByRole('button', { name: new RegExp(label, 'u') })).not.toBeInTheDocument();
  }

  const content = container.textContent ?? '';
  expect(content).not.toContain('新增连接');
  expect(content).not.toContain('编辑连接');
  expect(content).not.toContain('删除连接');
}

function expectOnlyHisConnectionReadCalls(fetchMock: ReturnType<typeof mockHisConnectionFetch>) {
  expect(fetchMock).toHaveBeenCalled();

  for (const [input, init] of fetchMock.mock.calls) {
    const path = fetchPath(input);

    expect(path).toMatch(/^\/api\/institution\/his-connections(?:\/[^/?#]+)?$/u);
    expect(path).not.toContain('tenantId');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body).toBeUndefined();
    expect(JSON.stringify(init ?? {})).not.toContain('tenantId');
  }
}

describe('HIS 连接配置只读面板', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('展示连接列表和详情安全摘要，并使用中文状态文案', async () => {
    const fetchMock = mockHisConnectionFetch();
    const { container } = render(<HisConnectionReadOnlyPanel />);

    expect(screen.getByRole('heading', { name: 'HIS 连接配置' })).toBeInTheDocument();
    expect(screen.getByText('正在加载 HIS 连接配置...')).toBeInTheDocument();
    expect((await screen.findAllByText('星澜 HIS 只读连接')).length).toBeGreaterThan(0);
    expect(screen.getByText('草稿连接')).toBeInTheDocument();
    expect(screen.getByText('异常连接')).toBeInTheDocument();
    expect(screen.getAllByText('来源系统：his').length).toBeGreaterThan(0);
    expect(screen.getAllByText('厂商类型：demo_vendor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('系统类型：his').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已启用').length).toBeGreaterThan(0);
    expect(screen.getAllByText('草稿').length).toBeGreaterThan(0);
    expect(screen.getAllByText('异常').length).toBeGreaterThan(0);
    expect(screen.getAllByText('正常').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未检查').length).toBeGreaterThan(0);
    expect(screen.getAllByText('失败').length).toBeGreaterThan(0);
    expect(screen.getAllByText('凭证已配置').length).toBeGreaterThan(0);
    expect(screen.getAllByText('凭证未配置').length).toBeGreaterThan(0);
    expect(screen.getAllByText('最近检查：2026-06-03T08:30:00.000Z').length).toBeGreaterThan(0);
    expect(screen.getAllByText('最近错误码：SAFE_TIMEOUT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('创建时间：2026-06-03T08:00:00.000Z').length).toBeGreaterThan(0);
    expect(screen.getAllByText('更新时间：2026-06-03T08:20:00.000Z').length).toBeGreaterThan(0);
    expect(screen.getAllByText('撤销时间：未记录').length).toBeGreaterThan(0);
    expect(screen.getByText('配置凭证、测试连接、启停连接需后续单独实现。')).toBeInTheDocument();
    expect(
      screen.getByText('这些状态只是后端只读状态展示，不代表测试连接或真实 HIS 调用已实现。'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/institution/his-connections', {
        cache: 'no-store',
      });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/institution/his-connections/his_conn_active',
        { cache: 'no-store' },
      );
    });
    expectOnlyHisConnectionReadCalls(fetchMock);
    expectNoSensitiveHisConnectionContent(container);
    expectNoHisConnectionWriteActions(container);
  });

  it('切换连接详情时只调用详情只读 API，不拼接 tenantId', async () => {
    const fetchMock = mockHisConnectionFetch({
      detailBody: { record: failedHisConnection },
    });
    render(<HisConnectionReadOnlyPanel />);

    expect(await screen.findByText('异常连接')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看 HIS 连接安全详情：异常连接' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/institution/his-connections/his_conn_failed',
        { cache: 'no-store' },
      );
    });
    expect(screen.getByRole('heading', { name: '安全详情' })).toBeInTheDocument();
    expect(screen.getAllByText('撤销时间：2026-06-03T10:00:00.000Z').length).toBeGreaterThan(0);
    expectOnlyHisConnectionReadCalls(fetchMock);
  });

  it('无连接时显示稳定空态且不加载详情', async () => {
    const fetchMock = mockHisConnectionFetch({ listBody: { records: [] } });
    render(<HisConnectionReadOnlyPanel />);

    expect(await screen.findByText('暂无 HIS 连接配置')).toBeInTheDocument();
    expect(
      screen.getByText('当前机构尚未登记连接配置。配置凭证、测试连接和启停连接需后续单独实现。'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectOnlyHisConnectionReadCalls(fetchMock);
  });

  it.each([
    [401, 'token secret DATABASE_URL stack', '登录状态已失效，请重新登录'],
    [403, 'SQL stack secret', '当前账号没有查看 HIS 连接配置的权限'],
    [503, 'DATABASE_URL=postgres://secret', 'HIS 连接配置暂时不可用'],
    [500, 'select * from his_connections stack', 'HIS 连接配置请求失败'],
  ])('列表加载 %s 失败时显示稳定错误提示', async (status, message, visibleMessage) => {
    const fetchMock = mockHisConnectionFetch({
      listStatus: status,
      listBody: { error: message },
    });
    const { container } = render(<HisConnectionReadOnlyPanel />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expectNoSensitiveHisConnectionContent(container);
    expectOnlyHisConnectionReadCalls(fetchMock);
  });

  it('详情 not_found 时显示稳定提示且不泄露服务端错误详情', async () => {
    const fetchMock = mockHisConnectionFetch({
      detailStatus: 404,
      detailBody: { error: 'tenantId SQL stack token secret raw HIS payload' },
    });
    const { container } = render(<HisConnectionReadOnlyPanel />);

    expect((await screen.findAllByText('星澜 HIS 只读连接')).length).toBeGreaterThan(0);
    expect(await screen.findByText('连接不存在或不可见')).toBeInTheDocument();
    expectNoSensitiveHisConnectionContent(container);
    expectOnlyHisConnectionReadCalls(fetchMock);
  });
});
