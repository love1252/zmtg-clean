import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenPlatformAuditEventsPanel } from '@/modules/open-platform/components/OpenPlatformAuditEventsPanel';

const auditEventRecord = {
  id: 'audit_evt_platform_001',
  tenantId: 'demo-tenant-001',
  resource: 'customer',
  resourceId: 'cust_001',
  action: 'update',
  result: 'allowed',
  reason: 'allowed_by_policy',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  occurredAt: '2026-05-31T09:00:00.000Z',
  requestBody: { phoneNumber: '13800000000' },
  metadata: { sql: 'select * from audit_events' },
  stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_should_not_render',
  secret: 'raw-secret',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR-RAW-001',
  treatmentRecord: '完整治疗记录正文',
  consultationTranscript: '咨询对话全文',
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

function auditEventsResponse(records: unknown[], pageInfo = { hasMore: false, limit: 10, nextCursor: null }) {
  return jsonResponse({ records, pageInfo });
}

function mockAuditEventsFetch(responses: Response[]) {
  const fetchMock = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
    const response = responses.shift();
    if (!response) {
      throw new Error('没有配置更多平台审计日志 fetch 响应');
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

function expectNoSensitiveAuditContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('13800000000');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('MR-RAW-001');
  expect(text).not.toContain('完整治疗记录正文');
  expect(text).not.toContain('咨询对话全文');
  expect(text).not.toContain('requestBody');
  expect(text).not.toContain('metadata');
  expect(text).not.toContain('select * from audit_events');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('sk_test_should_not_render');
  expect(text).not.toContain('token');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('secret');
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
}

describe('平台端审计日志面板', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('从平台审计 API 加载并展示安全字段', async () => {
    const pending = deferredResponse();
    const fetchMock = vi.fn(async () => pending.promise);
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<OpenPlatformAuditEventsPanel />);

    expect(screen.getByRole('heading', { name: '平台审计日志' })).toBeInTheDocument();
    expect(screen.getByText(/只展示白名单字段/)).toBeInTheDocument();
    expect(screen.getByText('正在加载平台审计事件...')).toBeInTheDocument();
    expect(screen.getByText('加载期间筛选暂不可用')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '应用筛选' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '重置筛选' })).toBeDisabled();
    pending.resolve(auditEventsResponse([auditEventRecord]));

    expect(await screen.findByText('audit_evt_platform_001')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '应用筛选' })).toBeEnabled();
    expect(screen.queryByText('allowed', { selector: 'article > div' })).not.toBeInTheDocument();
    expect(screen.queryByText('denied', { selector: 'article > div' })).not.toBeInTheDocument();
    expect(screen.queryByText('transitioned', { selector: 'article > div' })).not.toBeInTheDocument();
    expect(screen.getByText('租户 ID：demo-tenant-001')).toBeInTheDocument();
    expect(screen.getByText('资源类型：客户')).toBeInTheDocument();
    expect(screen.getByText('资源 ID：cust_001')).toBeInTheDocument();
    expect(screen.getByText('操作：更新')).toBeInTheDocument();
    expect(screen.getByText('结果：通过')).toBeInTheDocument();
    expect(screen.getByText('原因：符合平台策略')).toBeInTheDocument();
    expect(screen.getByText('操作者：demo-user-admin')).toBeInTheDocument();
    expect(screen.getByText('角色：机构管理员')).toBeInTheDocument();
    expect(screen.getByText('第 1 页 · 每页 10 条')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/open-platform/audit-events?limit=10', { cache: 'no-store' });
    expectNoSensitiveAuditContent(container);
    expectNoPlatformDemoMisleadingClaims(container);
  });

  it('提供平台端白名单筛选控件并把 tenantId 作为筛选条件发送', async () => {
    const fetchMock = mockAuditEventsFetch([
      auditEventsResponse([]),
      auditEventsResponse([{ ...auditEventRecord, id: 'audit_evt_filtered' }]),
    ]);

    render(<OpenPlatformAuditEventsPanel />);

    expect(await screen.findByText('暂无平台关键操作记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('租户 ID'), { target: { value: 'demo-tenant-001' } });
    fireEvent.change(screen.getByLabelText('资源类型'), { target: { value: 'customer' } });
    fireEvent.change(screen.getByLabelText('资源 ID'), { target: { value: 'cust_001' } });
    fireEvent.change(screen.getByLabelText('操作'), { target: { value: 'update' } });
    fireEvent.change(screen.getByLabelText('结果'), { target: { value: 'allowed' } });
    fireEvent.change(screen.getByLabelText('原因'), { target: { value: 'allowed_by_policy' } });
    fireEvent.change(screen.getByLabelText('操作者 ID'), { target: { value: 'demo-user-admin' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    expect(await screen.findByText('audit_evt_filtered')).toBeInTheDocument();
    const secondPath = fetchPath(fetchMock.mock.calls[1]?.[0] ?? '');
    expect(secondPath).toContain('/api/open-platform/audit-events?');
    expect(secondPath).toContain('tenantId=demo-tenant-001');
    expect(secondPath).toContain('resource=customer');
    expect(secondPath).toContain('resourceId=cust_001');
    expect(secondPath).toContain('action=update');
    expect(secondPath).toContain('result=allowed');
    expect(secondPath).toContain('reason=allowed_by_policy');
    expect(secondPath).toContain('actorId=demo-user-admin');
    expect(fetchMock.mock.calls[1]?.[1]).toEqual({ cache: 'no-store' });
  });

  it('按页替换展示平台关键操作记录，避免列表无限加长', async () => {
    const fetchMock = mockAuditEventsFetch([
      auditEventsResponse(
        [{ ...auditEventRecord, id: 'audit_evt_page_1' }],
        { hasMore: true, limit: 10, nextCursor: 'cursor-page-2' },
      ),
      auditEventsResponse(
        [{ ...auditEventRecord, id: 'audit_evt_page_2', resource: 'ai_model_config', action: 'read_detail' }],
        { hasMore: false, limit: 10, nextCursor: null },
      ),
      auditEventsResponse(
        [{ ...auditEventRecord, id: 'audit_evt_page_1' }],
        { hasMore: true, limit: 10, nextCursor: 'cursor-page-2' },
      ),
    ]);

    render(<OpenPlatformAuditEventsPanel />);

    expect(await screen.findByText('audit_evt_page_1')).toBeInTheDocument();
    expect(screen.getByText('第 1 页 · 每页 10 条')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));

    expect(await screen.findByText('audit_evt_page_2')).toBeInTheDocument();
    expect(screen.queryByText('audit_evt_page_1')).not.toBeInTheDocument();
    expect(screen.getByText('资源类型：AI 模型配置')).toBeInTheDocument();
    expect(screen.getByText('操作：查看详情')).toBeInTheDocument();
    expect(screen.getByText('第 2 页 · 每页 10 条')).toBeInTheDocument();

    const nextPath = fetchPath(fetchMock.mock.calls[1]?.[0] ?? '');
    expect(nextPath).toContain('limit=10');
    expect(nextPath).toContain('cursor=cursor-page-2');

    fireEvent.click(screen.getByRole('button', { name: '上一页' }));

    expect(await screen.findByText('audit_evt_page_1')).toBeInTheDocument();
    expect(screen.queryByText('audit_evt_page_2')).not.toBeInTheDocument();
    const previousPath = fetchPath(fetchMock.mock.calls[2]?.[0] ?? '');
    expect(previousPath).toBe('/api/open-platform/audit-events?limit=10');
  });

  it('展示空状态', async () => {
    mockAuditEventsFetch([auditEventsResponse([])]);

    render(<OpenPlatformAuditEventsPanel />);

    expect(await screen.findByText('暂无平台关键操作记录')).toBeInTheDocument();
    expect(screen.getByText('当前筛选条件下没有可展示的平台关键操作。')).toBeInTheDocument();
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有查看平台审计日志的权限'],
    [503, '数据服务暂时不可用', '平台关键操作记录暂时不可用'],
  ])('处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    mockAuditEventsFetch([jsonResponse({ error: apiMessage }, { status })]);

    render(<OpenPlatformAuditEventsPanel />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
  });
});
