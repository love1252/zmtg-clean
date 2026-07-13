import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeComCustomerDataGovernancePanel } from '@/modules/open-platform/components/WeComCustomerDataGovernancePanel';
import { createWeComPlatformGovernancePayload } from '@/modules/open-platform/domain/wecom-customer-data-governance';
import { PlatformConsole } from '@/modules/workspace/components/PlatformConsole';

const payload = createWeComPlatformGovernancePayload();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function mockFetch(body: unknown = payload, status = 200) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes('/api/open-platform/wecom/customer-data-governance')) {
      return jsonResponse(body, status);
    }
    return jsonResponse({ error: 'not mocked' }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function expectNoSensitiveContent(container: HTMLElement) {
  const content = container.textContent ?? '';
  for (const forbidden of [
    'external_userid',
    'externalUserId',
    'user_id',
    'userId',
    'userid',
    'phone_number',
    'phoneNumber',
    'mobile',
    'accessToken',
    'secret',
    '13800138000',
    '11010519491231002X',
    '客户姓名',
    '聊天原文',
    'archiveKey',
    'webhookPayload',
    'apiResponse',
    'sha256:',
  ]) {
    expect(content).not.toContain(forbidden);
  }
}

function expectNoOutboundActions() {
  for (const label of [
    '真实同步',
    '立即同步',
    '发送',
    '读取聊天记录',
    '会话内容存档',
  ]) {
    expect(screen.queryByRole('button', { name: new RegExp(label, 'u') })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: new RegExp(label, 'u') })).not.toBeInTheDocument();
  }
}

describe('平台端企业微信客户数据治理面板', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('展示 mock/demo、授权、同步健康、字段阻断和 audit summary', async () => {
    const fetchMock = mockFetch();
    const { container } = render(<WeComCustomerDataGovernancePanel />);

    expect(screen.getByRole('heading', { name: '企业微信授权与同步健康治理' })).toBeInTheDocument();
    expect(screen.getByText('MOCK / DEMO · 只读')).toBeInTheDocument();
    expect(screen.getByText('正在加载企业微信 mock / demo 治理摘要...')).toBeInTheDocument();

    expect(await screen.findByRole('heading', { name: '租户授权状态总览' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '同步健康状态' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '异常租户低敏摘要' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '字段阻断摘要' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Audit summary' })).toBeInTheDocument();
    expect(screen.getByText('受控 mock / demo 只读治理视图')).toBeInTheDocument();
    expect(screen.getByText('外部能力启用状态：关闭；provider 受控状态共 6 个租户。')).toBeInTheDocument();
    expect(screen.getByText('已阻断：凭证材料')).toBeInTheDocument();
    expect(screen.getByText('已阻断：直接身份标识')).toBeInTheDocument();
    expect(screen.getAllByText('同步已禁用').length).toBeGreaterThan(0);
    expect(screen.getByText('provider 默认关闭')).toBeInTheDocument();
    expect(screen.getAllByText('外部能力关闭').length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/open-platform/wecom/customer-data-governance',
      { cache: 'no-store' },
    );
    expectNoSensitiveContent(container);
    expectNoOutboundActions();
  });

  it('响应混入客户敏感字段时 fail-closed 且不渲染治理内容', async () => {
    mockFetch({
      ...payload,
      access_token: 'mock-sensitive-value',
      anomalousTenants: [{
        ...payload.anomalousTenants[0],
        external_userid: 'raw-external-id',
        phoneNumber: '13800138000',
        chatContent: 'raw chat content',
      }],
    });
    const { container } = render(<WeComCustomerDataGovernancePanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent('治理响应未通过字段白名单校验');
    expect(screen.queryByRole('heading', { name: '租户授权状态总览' })).not.toBeInTheDocument();
    expectNoSensitiveContent(container);
    expectNoOutboundActions();
  });

  it.each([
    ['top-level unknown', { ...payload, unknownField: 'raw-sensitive-value' }],
    ['camelCase sensitive', { ...payload, externalUserId: 'raw-external-id' }],
    ['nested rawResponse', {
      ...payload,
      anomalousTenants: [{
        ...payload.anomalousTenants[0],
        rawResponse: { phoneNumber: '13800138000' },
      }],
    }],
    ['nested webhookPayload', {
      ...payload,
      auditSummary: {
        ...payload.auditSummary,
        webhookPayload: { accessToken: 'raw-token' },
      },
    }],
    ['nested apiResponse', {
      ...payload,
      syncHealthSummary: {
        ...payload.syncHealthSummary,
        apiResponse: { userId: 'raw-user-id' },
      },
    }],
    ['unapproved tenant label', {
      ...payload,
      anomalousTenants: [{
        ...payload.anomalousTenants[0],
        tenantLabel: '任意普通字符串',
      }],
    }],
    ['phone tenant display name', {
      ...payload,
      anomalousTenants: [{
        ...payload.anomalousTenants[0],
        tenantDisplayName: '13800138000',
      }],
    }],
  ])('%s 响应 fail-closed 且不渲染敏感内容', async (_case, unsafePayload) => {
    mockFetch(unsafePayload);
    const { container } = render(<WeComCustomerDataGovernancePanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent('治理响应未通过字段白名单校验');
    expect(screen.queryByRole('heading', { name: '租户授权状态总览' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '异常租户低敏摘要' })).not.toBeInTheDocument();
    expect(screen.queryByText('任意普通字符串')).not.toBeInTheDocument();
    expectNoSensitiveContent(container);
    expectNoOutboundActions();
  });

  it.each([
    [401, '登录状态已失效，请重新登录'],
    [403, '当前账号没有查看企业微信治理摘要的权限'],
    [500, '企业微信治理摘要暂时不可用'],
  ])('API 返回 %s 时展示稳定低敏错误', async (status, message) => {
    mockFetch({ error: 'secret access_token external_userid raw chat content' }, status);
    const { container } = render(<WeComCustomerDataGovernancePanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    await waitFor(() => expect(screen.queryByText(/正在加载/u)).not.toBeInTheDocument());
    expectNoSensitiveContent(container);
    expectNoOutboundActions();
  });

  it('集成到平台控制台企业微信治理导航', async () => {
    mockFetch();
    render(<PlatformConsole />);

    fireEvent.click(screen.getByRole('button', { name: '企业微信治理' }));

    expect(await screen.findByRole('heading', { name: '企业微信授权与同步健康治理' })).toBeInTheDocument();
    expect(screen.getByText('MOCK / DEMO · 只读')).toBeInTheDocument();
    expectNoOutboundActions();
  });
});
