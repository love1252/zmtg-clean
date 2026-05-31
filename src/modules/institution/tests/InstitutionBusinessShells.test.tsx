import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppointmentCenterShell } from '@/modules/institution/components/AppointmentCenterShell';
import { InstitutionAuditEventsShell } from '@/modules/institution/components/InstitutionAuditEventsShell';
import { CustomerCenterShell } from '@/modules/institution/components/CustomerCenterShell';
import { SmartFollowUpShell } from '@/modules/institution/components/SmartFollowUpShell';

const customerRecord = {
  id: 'cust_wang_repurchase',
  tenantId: 'demo-tenant-001',
  displayName: '王女士',
  lifecycle: 'repurchase_window',
  priority: 'high',
  ownerUserId: 'consultant-lin',
  projectInterest: '热玛吉修复组合',
  maskedPhone: '138****1208',
  maskedMedicalRecordNo: 'MR****001',
  lastTouchSummary: '术后第 28 天',
  nextAction: '安排资深咨询师人工回访',
  tags: ['高价值', '近期咨询补水'],
};

const appointmentRecord = {
  id: 'appt_wang_pending',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_wang_repurchase',
  customerDisplayName: '王女士',
  project: '热玛吉复诊',
  scheduledAt: '2026-06-01T10:30:00+08:00',
  consultantUserId: 'consultant-lin',
  status: 'pending_confirmation',
  note: '待电话确认到院',
};

const followUpRecord = {
  id: 'fu_wang_d28',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_wang_repurchase',
  customerDisplayName: '王女士',
  journeyId: 'journey_repurchase',
  stage: 'D28 复购建议',
  status: 'due',
  dueAt: '2026-05-30T18:00:00+08:00',
  suggestedAction: '人工回访并推荐修复组合',
  riskLevel: 'urgent',
  updatedBy: null,
  updatedAt: null,
};

const auditEventRecord = {
  id: 'audit_evt_customer',
  tenantId: 'demo-tenant-001',
  resource: 'customer',
  resourceId: 'cust_wang_repurchase',
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
};

const customerTimelineResponse = {
  customer: {
    id: 'cust_wang_repurchase',
    displayName: '王女士',
    lifecycle: 'repurchase_window',
    priority: 'high',
    projectInterest: '热玛吉修复组合',
    maskedPhone: '138****1208',
    maskedMedicalRecordNo: 'MR****001',
    ownerUserId: 'consultant-lin',
    tags: ['高价值', '近期咨询补水'],
    lastTouchSummary: '术后第 28 天',
    nextAction: '安排资深咨询师人工回访',
    phoneNumber: '13800000000',
    idNumber: '110101199001010011',
  },
  appointments: [
    {
      id: 'appt_wang_pending',
      project: '热玛吉复诊',
      scheduledAt: '2026-06-01T10:30:00+08:00',
      consultantUserId: 'consultant-lin',
      status: 'pending_confirmation',
      note: '待电话确认到院',
      requestBody: { phoneNumber: '13800000000' },
    },
  ],
  followups: [
    {
      id: 'fu_wang_d28',
      journeyId: 'journey_repurchase',
      stage: 'D28 复购建议',
      status: 'due',
      dueAt: '2026-05-30T18:00:00+08:00',
      suggestedAction: '人工回访并推荐修复组合',
      riskLevel: 'urgent',
      updatedBy: null,
      updatedAt: null,
      sql: 'select * from customers',
    },
  ],
  auditEvents: [
    {
      id: 'audit_evt_001',
      action: 'update',
      result: 'allowed',
      reason: 'allowed_by_policy',
      actor: { id: 'demo-user-admin', role: 'tenant_admin' },
      occurredAt: '2026-06-03T09:00:00.000Z',
      resource: 'customer',
      resourceId: 'cust_wang_repurchase',
      stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_should_not_render',
    },
  ],
  timeline: [
    {
      id: 'audit:audit_evt_001',
      type: 'audit',
      occurredAt: '2026-06-03T09:00:00.000Z',
      title: '审计：update',
      summary: 'allowed / allowed_by_policy',
      status: 'allowed',
      source: 'customer',
      relatedRecordId: 'cust_wang_repurchase',
    },
    {
      id: 'appointment:appt_wang_pending',
      type: 'appointment',
      occurredAt: '2026-06-01T10:30:00+08:00',
      title: '热玛吉复诊预约',
      summary: '待电话确认到院',
      status: 'pending_confirmation',
      source: 'appointment',
      relatedRecordId: 'appt_wang_pending',
    },
    {
      id: 'follow_up:fu_wang_d28',
      type: 'follow_up',
      occurredAt: '2026-05-30T18:00:00+08:00',
      title: 'D28 复购建议',
      summary: '人工回访并推荐修复组合',
      status: 'due',
      source: 'follow_up',
      relatedRecordId: 'fu_wang_d28',
    },
  ],
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

function mockCustomerFetch(responses: Response[]) {
  const fetchMock = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
    const response = responses.shift();
    if (!response) {
      throw new Error('没有配置更多 fetch 响应');
    }

    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mockInstitutionFetch(responsesByPath: Record<string, Response[]>) {
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
    const path = fetchPath(input);
    const responses = responsesByPath[path];
    const response = responses?.shift();
    if (!response) {
      throw new Error(`没有为 ${path} 配置更多 fetch 响应`);
    }

    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mockAuditEventsFetch(responses: Response[]) {
  const fetchMock = vi.fn(async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]) => {
    const response = responses.shift();
    if (!response) {
      throw new Error('没有配置更多审计日志 fetch 响应');
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

function auditEventsResponse(records: unknown[], pageInfo = { hasMore: false, limit: 50, nextCursor: null }) {
  return jsonResponse({ records, pageInfo });
}

function expectNoSensitiveTimelineContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('13800000000');
  expect(text).not.toContain('110101199001010011');
  expect(text).not.toContain('requestBody');
  expect(text).not.toContain('select * from customers');
  expect(text).not.toContain('DATABASE_URL');
  expect(text).not.toContain('postgres://');
  expect(text).not.toContain('sk_test_should_not_render');
  expect(text).not.toContain('token');
  expect(text).not.toContain('stack');
  expect(text).not.toContain('secret');
}

function expectNoSensitiveAuditContent(container: HTMLElement) {
  const text = container.textContent ?? '';

  expect(text).not.toContain('tenantId');
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

function requestBody(fetchMock: ReturnType<typeof mockCustomerFetch>, callIndex: number) {
  const call = fetchMock.mock.calls[callIndex];
  if (!call) {
    throw new Error(`缺少第 ${callIndex + 1} 次 fetch 调用`);
  }

  const [, init] = call;
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

function mutationBody(
  fetchMock: ReturnType<typeof mockInstitutionFetch>,
  path: string,
  method: string,
) {
  const call = fetchMock.mock.calls.find(
    ([input, init]) => fetchPath(input) === path && init?.method === method,
  );
  if (!call) {
    throw new Error(`缺少 ${method} ${path} 调用`);
  }

  return JSON.parse(String(call[1]?.body)) as Record<string, unknown>;
}

describe('机构业务页面壳', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('审计日志页面从机构审计 API 加载并展示安全字段', async () => {
    const pending = deferredResponse();
    const fetchMock = vi.fn(async () => pending.promise);
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<InstitutionAuditEventsShell />);

    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(screen.getByText('正在加载审计事件...')).toBeInTheDocument();
    pending.resolve(auditEventsResponse([auditEventRecord]));

    expect(await screen.findByText('audit_evt_customer')).toBeInTheDocument();
    expect(screen.getByText('资源类型：customer')).toBeInTheDocument();
    expect(screen.getByText('资源 ID：cust_wang_repurchase')).toBeInTheDocument();
    expect(screen.getByText('操作：update')).toBeInTheDocument();
    expect(screen.getByText('结果：allowed')).toBeInTheDocument();
    expect(screen.getByText('原因：allowed_by_policy')).toBeInTheDocument();
    expect(screen.getByText('操作者：demo-user-admin')).toBeInTheDocument();
    expect(screen.getByText('角色：tenant_admin')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/audit-events', { cache: 'no-store' });
    expectNoSensitiveAuditContent(container);
  });

  it('审计日志页面提供白名单筛选控件并只发送筛选参数', async () => {
    const fetchMock = mockAuditEventsFetch([
      auditEventsResponse([]),
      auditEventsResponse([{ ...auditEventRecord, id: 'audit_evt_filtered' }]),
    ]);

    render(<InstitutionAuditEventsShell />);

    expect(await screen.findByText('暂无审计事件')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('资源类型'), { target: { value: 'customer' } });
    fireEvent.change(screen.getByLabelText('资源 ID'), { target: { value: 'cust_wang_repurchase' } });
    fireEvent.change(screen.getByLabelText('操作'), { target: { value: 'update' } });
    fireEvent.change(screen.getByLabelText('结果'), { target: { value: 'allowed' } });
    fireEvent.change(screen.getByLabelText('原因'), { target: { value: 'allowed_by_policy' } });
    fireEvent.change(screen.getByLabelText('操作者 ID'), { target: { value: 'demo-user-admin' } });
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }));

    expect(await screen.findByText('audit_evt_filtered')).toBeInTheDocument();
    const secondPath = fetchPath(fetchMock.mock.calls[1]?.[0] ?? '');
    expect(secondPath).toContain('/api/institution/audit-events?');
    expect(secondPath).toContain('resource=customer');
    expect(secondPath).toContain('resourceId=cust_wang_repurchase');
    expect(secondPath).toContain('action=update');
    expect(secondPath).toContain('result=allowed');
    expect(secondPath).toContain('reason=allowed_by_policy');
    expect(secondPath).toContain('actorId=demo-user-admin');
    expect(secondPath).not.toContain('tenantId');
    expect(fetchMock.mock.calls[1]?.[1]).toEqual({ cache: 'no-store' });
  });

  it('审计日志页面展示空状态', async () => {
    mockAuditEventsFetch([auditEventsResponse([])]);

    render(<InstitutionAuditEventsShell />);

    expect(await screen.findByText('暂无审计事件')).toBeInTheDocument();
    expect(screen.getByText('当前筛选条件下没有可展示的审计事件。')).toBeInTheDocument();
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有查看审计日志的权限'],
    [503, '数据服务暂时不可用', '审计日志数据暂时不可用'],
  ])('审计日志页面处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    mockAuditEventsFetch([jsonResponse({ error: apiMessage }, { status })]);

    render(<InstitutionAuditEventsShell />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
  });

  it('客户中心从真实 API 加载并展示客户 records', async () => {
    const fetchMock = mockCustomerFetch([
      jsonResponse({
        records: [
          customerRecord,
          {
            ...customerRecord,
            id: 'cust_zhao_post_care',
            displayName: '赵女士',
            lifecycle: 'post_care',
            priority: 'medium',
            ownerUserId: 'service-group-a',
            maskedPhone: '137****8842',
            maskedMedicalRecordNo: 'MR****003',
          },
        ],
      }),
    ]);

    render(<CustomerCenterShell />);

    expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
    expect(screen.getByText('正在加载客户数据...')).toBeInTheDocument();
    expect(await screen.findByText('王女士')).toBeInTheDocument();
    expect(screen.getAllByText('赵女士').length).toBeGreaterThan(0);
    expect(screen.getByText('高意向待承接')).toBeInTheDocument();
    expect(screen.getByText('术后关怀中')).toBeInTheDocument();
    expect(screen.getAllByText('高优先级').length).toBeGreaterThan(0);
    expect(screen.getAllByText('复购窗口期').length).toBeGreaterThan(0);
    expect(screen.getByText('负责人：consultant-lin')).toBeInTheDocument();
    expect(screen.getByText('脱敏手机号：138****1208')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/customers', { cache: 'no-store' });
  });

  it('客户中心展示空状态和创建入口', async () => {
    mockCustomerFetch([jsonResponse({ records: [] })]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户摘要')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建客户' })).toBeInTheDocument();
    expect(screen.getByLabelText('脱敏手机号展示值')).toBeInTheDocument();
    expect(screen.getByLabelText('脱敏病历号展示值')).toBeInTheDocument();
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有访问客户数据的权限'],
    [503, '数据服务暂时不可用', '数据服务暂时不可用'],
  ])('客户中心处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    mockCustomerFetch([jsonResponse({ error: apiMessage }, { status })]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
  });

  it('新建客户只提交白名单字段并在成功后更新界面', async () => {
    const fetchMock = mockCustomerFetch([
      jsonResponse({ records: [] }),
      jsonResponse({ record: { ...customerRecord, id: 'cust_created', displayName: '林女士' } }, { status: 201 }),
    ]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户摘要')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: '林女士' } });
    fireEvent.change(screen.getByLabelText('生命周期'), { target: { value: 'consulting' } });
    fireEvent.change(screen.getByLabelText('优先级'), { target: { value: 'high' } });
    fireEvent.change(screen.getByLabelText('负责人 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('项目兴趣'), { target: { value: '皮肤管理' } });
    fireEvent.change(screen.getByLabelText('脱敏手机号展示值'), { target: { value: '138****1208' } });
    fireEvent.change(screen.getByLabelText('脱敏病历号展示值'), { target: { value: 'MR****001' } });
    fireEvent.change(screen.getByLabelText('最近触达摘要'), { target: { value: '初次咨询' } });
    fireEvent.change(screen.getByLabelText('下一步动作'), { target: { value: '预约到店' } });
    fireEvent.change(screen.getByLabelText('客户标签'), { target: { value: '新客, 高意向' } });
    fireEvent.click(screen.getByRole('button', { name: '创建客户' }));

    expect(await screen.findByText('林女士')).toBeInTheDocument();
    const body = requestBody(fetchMock, 1);
    const serializedBody = JSON.stringify(body);

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/institution/customers', expect.objectContaining({
      method: 'POST',
    }));
    expect(body).toEqual({
      displayName: '林女士',
      lifecycle: 'consulting',
      priority: 'high',
      ownerUserId: 'consultant-lin',
      projectInterest: '皮肤管理',
      maskedPhone: '138****1208',
      maskedMedicalRecordNo: 'MR****001',
      lastTouchSummary: '初次咨询',
      nextAction: '预约到店',
      tags: ['新客', '高意向'],
    });
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('phoneNumber');
    expect(serializedBody).not.toContain('idNumber');
    expect(serializedBody).not.toContain('medicalRecordNo');
    expect(serializedBody).not.toContain('treatmentRecord');
    expect(serializedBody).not.toContain('consultationTranscript');
  });

  it('编辑客户只提交可更新字段并在成功后更新界面', async () => {
    const fetchMock = mockCustomerFetch([
      jsonResponse({ records: [customerRecord] }),
      jsonResponse({ record: { ...customerRecord, nextAction: '已安排明日人工回访', priority: 'medium' } }),
    ]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '编辑 王女士' }));
    fireEvent.change(screen.getByLabelText('下一步动作'), { target: { value: '已安排明日人工回访' } });
    fireEvent.change(screen.getByLabelText('优先级'), { target: { value: 'medium' } });
    fireEvent.click(screen.getByRole('button', { name: '保存客户' }));

    expect(await screen.findByText('已安排明日人工回访')).toBeInTheDocument();
    const body = requestBody(fetchMock, 1);
    const serializedBody = JSON.stringify(body);

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/institution/customers', expect.objectContaining({
      method: 'PATCH',
    }));
    expect(body.id).toBe('cust_wang_repurchase');
    expect(body.nextAction).toBe('已安排明日人工回访');
    expect(body.priority).toBe('medium');
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('phoneNumber');
    expect(serializedBody).not.toContain('idNumber');
    expect(serializedBody).not.toContain('medicalRecordNo');
    expect(serializedBody).not.toContain('treatmentRecord');
    expect(serializedBody).not.toContain('consultationTranscript');
  });

  it('客户表单拒绝提交未脱敏手机号', async () => {
    const fetchMock = mockCustomerFetch([
      jsonResponse({ records: [] }),
    ]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户摘要')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: '林女士' } });
    fireEvent.change(screen.getByLabelText('负责人 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('项目兴趣'), { target: { value: '皮肤管理' } });
    fireEvent.change(screen.getByLabelText('脱敏手机号展示值'), { target: { value: '13800000000' } });
    fireEvent.change(screen.getByLabelText('脱敏病历号展示值'), { target: { value: 'MR****001' } });
    fireEvent.change(screen.getByLabelText('最近触达摘要'), { target: { value: '初次咨询' } });
    fireEvent.change(screen.getByLabelText('下一步动作'), { target: { value: '预约到店' } });
    fireEvent.click(screen.getByRole('button', { name: '创建客户' }));

    expect(await screen.findByText('字段 maskedPhone 必须是脱敏展示值')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('客户提交失败时展示错误提示', async () => {
    mockCustomerFetch([
      jsonResponse({ records: [] }),
      jsonResponse({ error: '字段 nextAction 不允许包含原始个人信息' }, { status: 400 }),
    ]);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户摘要')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: '林女士' } });
    fireEvent.change(screen.getByLabelText('负责人 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('项目兴趣'), { target: { value: '皮肤管理' } });
    fireEvent.change(screen.getByLabelText('脱敏手机号展示值'), { target: { value: '138****1208' } });
    fireEvent.change(screen.getByLabelText('脱敏病历号展示值'), { target: { value: 'MR****001' } });
    fireEvent.change(screen.getByLabelText('最近触达摘要'), { target: { value: '初次咨询' } });
    fireEvent.change(screen.getByLabelText('下一步动作'), { target: { value: '预约到店' } });
    fireEvent.click(screen.getByRole('button', { name: '创建客户' }));

    expect(await screen.findByText('字段 nextAction 不允许包含原始个人信息')).toBeInTheDocument();
  });

  it.each([
    [
      'quota_exceeded_customers DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret',
      '当前套餐的客户数量已达上限，请联系平台管理员调整套餐或配额。',
    ],
    [
      'missing_active_plan',
      '当前机构暂无有效套餐，暂不能新增数据，请联系平台管理员。',
    ],
  ])('客户创建遇到配额限制时展示稳定中文提示并保留输入', async (apiMessage, visibleMessage) => {
    const fetchMock = mockCustomerFetch([
      jsonResponse({ records: [] }),
      jsonResponse({ error: apiMessage }, { status: 409 }),
    ]);

    const { container } = render(<CustomerCenterShell />);

    expect(await screen.findByText('暂无客户摘要')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('客户姓名'), { target: { value: '林女士' } });
    fireEvent.change(screen.getByLabelText('负责人 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('项目兴趣'), { target: { value: '皮肤管理' } });
    fireEvent.change(screen.getByLabelText('脱敏手机号展示值'), { target: { value: '138****1208' } });
    fireEvent.change(screen.getByLabelText('脱敏病历号展示值'), { target: { value: 'MR****001' } });
    fireEvent.change(screen.getByLabelText('最近触达摘要'), { target: { value: '初次咨询' } });
    fireEvent.change(screen.getByLabelText('下一步动作'), { target: { value: '预约到店' } });
    fireEvent.click(screen.getByRole('button', { name: '创建客户' }));

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expect(screen.getByLabelText('客户姓名')).toHaveValue('林女士');
    const body = requestBody(fetchMock, 1);
    const serializedBody = JSON.stringify(body);
    const text = container.textContent ?? '';

    expect(serializedBody).not.toContain('tenantId');
    expect(text).not.toContain('quota_exceeded_customers');
    expect(text).not.toContain('missing_active_plan');
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('stack');
    expect(text).not.toContain('token');
    expect(text).not.toContain('secret');
  });

  it('客户中心可打开详情时间线并只读取安全摘要', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
      '/api/institution/customers/cust_wang_repurchase/timeline': [
        jsonResponse(customerTimelineResponse),
      ],
    });

    const { container } = render(<CustomerCenterShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看详情 王女士' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 王女士' }));

    expect(await screen.findByRole('dialog', { name: '客户详情时间线' })).toBeInTheDocument();
    expect(screen.getAllByText('客户详情时间线').length).toBeGreaterThan(0);
    expect(screen.getAllByText('脱敏手机号：138****1208').length).toBeGreaterThan(0);
    expect(screen.getAllByText('脱敏病历号：MR****001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('热玛吉复诊').length).toBeGreaterThan(0);
    expect(screen.getAllByText('待电话确认到院').length).toBeGreaterThan(0);
    expect(screen.getAllByText('D28 复购建议').length).toBeGreaterThan(0);
    expect(screen.getAllByText('人工回访并推荐修复组合').length).toBeGreaterThan(0);
    expect(screen.getByText('审计：update')).toBeInTheDocument();
    expect(screen.getByText('audit_evt_001')).toBeInTheDocument();
    expect(screen.getAllByText('allowed / allowed_by_policy').length).toBeGreaterThan(0);

    const timelineCall = fetchMock.mock.calls.find(
      ([input]) =>
        fetchPath(input) === '/api/institution/customers/cust_wang_repurchase/timeline',
    );
    expect(timelineCall).toBeDefined();
    expect(timelineCall?.[1]).toEqual({ cache: 'no-store' });
    expect(fetchPath(timelineCall![0])).not.toContain('tenantId');
    expect(timelineCall?.[1]?.method).toBeUndefined();
    expect(timelineCall?.[1]?.body).toBeUndefined();
    expect(
      fetchMock.mock.calls.some(([, init]) =>
        ['POST', 'PATCH', 'DELETE'].includes(String(init?.method)),
      ),
    ).toBe(false);
    expectNoSensitiveTimelineContent(container);
  });

  it('客户详情时间线展示加载态和空态', async () => {
    const detailResponse = deferredResponse();
    const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const path = fetchPath(input);
      if (path === '/api/institution/customers') {
        return jsonResponse({ records: [customerRecord] });
      }

      if (path === '/api/institution/customers/cust_wang_repurchase/timeline') {
        return detailResponse.promise;
      }

      throw new Error(`没有为 ${path} 配置 fetch 响应`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CustomerCenterShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 王女士' }));

    expect(screen.getByText('正在加载客户详情...')).toBeInTheDocument();

    detailResponse.resolve(
      jsonResponse({
        ...customerTimelineResponse,
        appointments: [],
        followups: [],
        auditEvents: [],
        timeline: [],
      }),
    );

    expect(await screen.findByText('暂无预约摘要')).toBeInTheDocument();
    expect(screen.getByText('暂无随访任务')).toBeInTheDocument();
    expect(screen.getByText('暂无安全审计摘要')).toBeInTheDocument();
    expect(screen.getByText('暂无时间线事件')).toBeInTheDocument();
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有访问客户详情的权限'],
    [404, 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg', '客户不存在或不属于当前租户'],
    [503, 'Error: stack includes sk_test_should_not_render', '数据服务暂时不可用'],
  ])('客户详情时间线处理 %s 错误态且不泄露服务端细节', async (status, apiMessage, visibleMessage) => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
      '/api/institution/customers/cust_wang_repurchase/timeline': [
        jsonResponse({ error: apiMessage }, { status }),
      ],
    });

    const { container } = render(<CustomerCenterShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 王女士' }));

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) =>
        ['POST', 'PATCH', 'DELETE'].includes(String(init?.method)),
      ),
    ).toBe(false);
    expectNoSensitiveTimelineContent(container);
  });

  it('关闭客户详情后客户列表状态保持不变', async () => {
    mockInstitutionFetch({
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
      '/api/institution/customers/cust_wang_repurchase/timeline': [
        jsonResponse(customerTimelineResponse),
      ],
    });

    render(<CustomerCenterShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看详情 王女士' }));
    expect(await screen.findByRole('dialog', { name: '客户详情时间线' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭客户详情' }));

    expect(screen.queryByRole('dialog', { name: '客户详情时间线' })).not.toBeInTheDocument();
    expect(screen.getByText('王女士')).toBeInTheDocument();
    expect(screen.getByText('客户优先级队列')).toBeInTheDocument();
  });

  it('预约中心从真实 API 加载预约和客户 records', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/appointments': [
        jsonResponse({
          records: [
            appointmentRecord,
            {
              ...appointmentRecord,
              id: 'appt_zhao_confirmed',
              customerId: 'cust_zhao_post_care',
              customerDisplayName: '赵女士',
              project: '光电修复复诊',
              scheduledAt: '2026-06-01T14:30:00+08:00',
              consultantUserId: 'service-group-a',
              status: 'confirmed',
              note: '已确认到院',
            },
          ],
        }),
      ],
      '/api/institution/customers': [
        jsonResponse({
          records: [
            customerRecord,
            { ...customerRecord, id: 'cust_zhao_post_care', displayName: '赵女士' },
          ],
        }),
      ],
    });

    render(<AppointmentCenterShell />);

    expect(screen.getByRole('heading', { name: '预约中心' })).toBeInTheDocument();
    expect(screen.getByText('正在加载预约数据...')).toBeInTheDocument();
    expect((await screen.findAllByText('王女士')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('赵女士').length).toBeGreaterThan(0);
    expect(screen.getByText('热玛吉复诊')).toBeInTheDocument();
    expect(screen.getByText('2026-06-01 10:30')).toBeInTheDocument();
    expect(screen.getAllByText('待确认').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已确认').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已到院').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已完成').length).toBeGreaterThan(0);
    expect(screen.getAllByText('改约跟进').length).toBeGreaterThan(0);
    expect(screen.getAllByText('已取消').length).toBeGreaterThan(0);
    expect(screen.getByRole('option', { name: '王女士' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/appointments', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/customers', { cache: 'no-store' });
  });

  it('预约中心展示空状态和创建入口', async () => {
    mockInstitutionFetch({
      '/api/institution/appointments': [jsonResponse({ records: [] })],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    render(<AppointmentCenterShell />);

    expect(await screen.findByText('暂无预约记录')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建预约' })).toBeInTheDocument();
    expect(screen.getByLabelText('预约客户')).toBeInTheDocument();
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有访问预约数据的权限'],
    [503, '数据服务暂时不可用', '数据服务暂时不可用'],
  ])('预约中心处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    mockInstitutionFetch({
      '/api/institution/appointments': [jsonResponse({ error: apiMessage }, { status })],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    render(<AppointmentCenterShell />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
  });

  it('新建预约只使用当前客户列表并派生 customerDisplayName', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/appointments': [
        jsonResponse({ records: [] }),
        jsonResponse({ record: appointmentRecord }, { status: 201 }),
      ],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    render(<AppointmentCenterShell />);

    expect(await screen.findByText('暂无预约记录')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '不存在客户' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('预约客户'), { target: { value: 'cust_wang_repurchase' } });
    fireEvent.change(screen.getByLabelText('预约项目'), { target: { value: '热玛吉复诊' } });
    fireEvent.change(screen.getByLabelText('预约时间'), { target: { value: '2026-06-01T10:30:00+08:00' } });
    fireEvent.change(screen.getByLabelText('顾问 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('预约备注'), { target: { value: '待电话确认到院' } });
    fireEvent.click(screen.getByRole('button', { name: '新建预约' }));

    expect((await screen.findAllByText('王女士')).length).toBeGreaterThan(0);
    const body = mutationBody(fetchMock, '/api/institution/appointments', 'POST');
    const serializedBody = JSON.stringify(body);

    expect(body).toEqual({
      customerId: 'cust_wang_repurchase',
      customerDisplayName: '王女士',
      project: '热玛吉复诊',
      scheduledAt: '2026-06-01T10:30:00+08:00',
      consultantUserId: 'consultant-lin',
      status: 'pending_confirmation',
      note: '待电话确认到院',
    });
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('phoneNumber');
    expect(serializedBody).not.toContain('idNumber');
    expect(serializedBody).not.toContain('medicalRecordNo');
    expect(serializedBody).not.toContain('treatmentRecord');
    expect(serializedBody).not.toContain('consultationTranscript');
  });

  it('预约状态更新只提交 id、status、note 并更新界面', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/appointments': [
        jsonResponse({ records: [appointmentRecord] }),
        jsonResponse({ record: { ...appointmentRecord, status: 'confirmed', note: '客户已确认到院' } }),
      ],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    render(<AppointmentCenterShell />);

    expect((await screen.findAllByText('王女士')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('状态更新 王女士'), { target: { value: 'confirmed' } });
    fireEvent.change(screen.getByLabelText('备注更新 王女士'), { target: { value: '客户已确认到院' } });
    fireEvent.click(screen.getByRole('button', { name: '更新预约 王女士' }));

    expect((await screen.findAllByText('客户已确认到院')).length).toBeGreaterThan(0);
    const body = mutationBody(fetchMock, '/api/institution/appointments', 'PATCH');
    const serializedBody = JSON.stringify(body);

    expect(body).toEqual({
      id: 'appt_wang_pending',
      status: 'confirmed',
      note: '客户已确认到院',
    });
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('phoneNumber');
    expect(serializedBody).not.toContain('idNumber');
    expect(serializedBody).not.toContain('medicalRecordNo');
    expect(serializedBody).not.toContain('treatmentRecord');
    expect(serializedBody).not.toContain('consultationTranscript');
  });

  it('预约表单拒绝提交未脱敏个人信息', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/appointments': [jsonResponse({ records: [] })],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    render(<AppointmentCenterShell />);

    expect(await screen.findByText('暂无预约记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('预约客户'), { target: { value: 'cust_wang_repurchase' } });
    fireEvent.change(screen.getByLabelText('预约项目'), { target: { value: '热玛吉复诊' } });
    fireEvent.change(screen.getByLabelText('预约时间'), { target: { value: '2026-06-01T10:30:00+08:00' } });
    fireEvent.change(screen.getByLabelText('顾问 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('预约备注'), { target: { value: '请联系 13800000000' } });
    fireEvent.click(screen.getByRole('button', { name: '新建预约' }));

    expect(await screen.findByText('预约表单不允许提交原始个人信息')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('预约提交失败时展示错误提示', async () => {
    mockInstitutionFetch({
      '/api/institution/appointments': [
        jsonResponse({ records: [] }),
        jsonResponse({ error: '字段 scheduledAt 必须是有效时间字符串' }, { status: 400 }),
      ],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    render(<AppointmentCenterShell />);

    expect(await screen.findByText('暂无预约记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('预约客户'), { target: { value: 'cust_wang_repurchase' } });
    fireEvent.change(screen.getByLabelText('预约项目'), { target: { value: '热玛吉复诊' } });
    fireEvent.change(screen.getByLabelText('预约时间'), { target: { value: 'not-a-date' } });
    fireEvent.change(screen.getByLabelText('顾问 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('预约备注'), { target: { value: '待电话确认到院' } });
    fireEvent.click(screen.getByRole('button', { name: '新建预约' }));

    expect(await screen.findByText('字段 scheduledAt 必须是有效时间字符串')).toBeInTheDocument();
  });

  it.each([
    [
      'quota_exceeded_appointments DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack token secret',
      '当前套餐的预约数量已达上限，请联系平台管理员调整套餐或配额。',
    ],
    [
      'missing_quota_limit',
      '当前机构套餐配额未配置完整，暂不能新增数据，请联系平台管理员。',
    ],
  ])('预约创建遇到配额限制时展示稳定中文提示并保留输入', async (apiMessage, visibleMessage) => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/appointments': [
        jsonResponse({ records: [] }),
        jsonResponse({ error: apiMessage }, { status: 409 }),
      ],
      '/api/institution/customers': [jsonResponse({ records: [customerRecord] })],
    });

    const { container } = render(<AppointmentCenterShell />);

    expect(await screen.findByText('暂无预约记录')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('预约客户'), { target: { value: 'cust_wang_repurchase' } });
    fireEvent.change(screen.getByLabelText('预约项目'), { target: { value: '热玛吉复诊' } });
    fireEvent.change(screen.getByLabelText('预约时间'), { target: { value: '2026-06-01T10:30:00+08:00' } });
    fireEvent.change(screen.getByLabelText('顾问 ID'), { target: { value: 'consultant-lin' } });
    fireEvent.change(screen.getByLabelText('预约备注'), { target: { value: '待电话确认到院' } });
    fireEvent.click(screen.getByRole('button', { name: '新建预约' }));

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expect(screen.getByLabelText('预约项目')).toHaveValue('热玛吉复诊');
    const body = mutationBody(fetchMock, '/api/institution/appointments', 'POST');
    const serializedBody = JSON.stringify(body);
    const text = container.textContent ?? '';

    expect(serializedBody).not.toContain('tenantId');
    expect(text).not.toContain('quota_exceeded_appointments');
    expect(text).not.toContain('missing_quota_limit');
    expect(text).not.toContain('DATABASE_URL');
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('stack');
    expect(text).not.toContain('token');
    expect(text).not.toContain('secret');
  });

  it('智能随访从真实 API 加载并按风险和到期时间排序展示 records', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/followups': [
        jsonResponse({
          records: [
            {
              ...followUpRecord,
              id: 'fu_li_silent',
              customerDisplayName: '李女士',
              stage: '48h 沉默唤醒',
              status: 'scheduled',
              dueAt: '2026-05-31T10:00:00+08:00',
              suggestedAction: '发送轻量唤醒话术',
              riskLevel: 'normal',
            },
            followUpRecord,
            {
              ...followUpRecord,
              id: 'fu_zhao_d3',
              customerDisplayName: '赵女士',
              stage: 'D3 异常反馈',
              dueAt: '2026-05-30T09:30:00+08:00',
              suggestedAction: '客服回访并记录恢复情况',
              riskLevel: 'urgent',
            },
          ],
        }),
      ],
    });

    render(<SmartFollowUpShell />);

    expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
    expect(screen.getByText('正在加载随访任务...')).toBeInTheDocument();
    expect(await screen.findByText('王女士')).toBeInTheDocument();
    expect(screen.getAllByText('状态：待处理').length).toBeGreaterThan(0);
    expect(screen.getAllByText('风险：优先').length).toBeGreaterThan(0);
    expect(screen.getByText(/2026-05-30 18:00/)).toBeInTheDocument();
    expect(screen.getByText('D3 异常反馈')).toBeInTheDocument();
    expect(screen.getByText('48h 沉默唤醒')).toBeInTheDocument();

    const taskCards = screen.getAllByTestId('followup-task-card');
    expect(taskCards.map((card) => card.textContent)).toEqual([
      expect.stringContaining('赵女士'),
      expect.stringContaining('王女士'),
      expect.stringContaining('李女士'),
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/followups', { cache: 'no-store' });
  });

  it('智能随访展示空状态和静态话术安全说明', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/followups': [jsonResponse({ records: [] })],
    });

    render(<SmartFollowUpShell />);

    expect(await screen.findByText('暂无随访任务')).toBeInTheDocument();
    expect(screen.getByText('这是演示话术：请根据客户真实恢复情况由专业人员确认后再发送。')).toBeInTheDocument();
    expect(screen.getByText('不会调用 AI provider，也不会自动触达客户。')).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([input]) => fetchPath(input))).toEqual([
      '/api/institution/followups',
    ]);
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有访问随访任务的权限'],
    [503, '数据服务暂时不可用', '数据服务暂时不可用'],
  ])('智能随访处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    mockInstitutionFetch({
      '/api/institution/followups': [jsonResponse({ error: apiMessage }, { status })],
    });

    render(<SmartFollowUpShell />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
  });

  it('智能随访只展示当前状态允许的流转按钮', async () => {
    mockInstitutionFetch({
      '/api/institution/followups': [jsonResponse({ records: [followUpRecord] })],
    });

    render(<SmartFollowUpShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '流转 王女士 到 处理中' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '流转 王女士 到 已升级' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '流转 王女士 到 已取消' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '流转 王女士 到 已完成' })).not.toBeInTheDocument();
  });

  it('智能随访状态流转只提交 id 和 nextStatus 并更新界面', async () => {
    const fetchMock = mockInstitutionFetch({
      '/api/institution/followups': [
        jsonResponse({ records: [followUpRecord] }),
        jsonResponse({ record: { ...followUpRecord, status: 'in_progress' } }),
      ],
    });

    render(<SmartFollowUpShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '流转 王女士 到 处理中' }));

    expect(await screen.findByText('状态：处理中')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '流转 王女士 到 已完成' })).toBeInTheDocument();
    const body = mutationBody(fetchMock, '/api/institution/followups', 'PATCH');
    const serializedBody = JSON.stringify(body);

    expect(body).toEqual({
      id: 'fu_wang_d28',
      nextStatus: 'in_progress',
    });
    expect(serializedBody).not.toContain('tenantId');
    expect(serializedBody).not.toContain('phoneNumber');
    expect(serializedBody).not.toContain('idNumber');
    expect(serializedBody).not.toContain('medicalRecordNo');
    expect(serializedBody).not.toContain('treatmentRecord');
    expect(serializedBody).not.toContain('consultationTranscript');
  });

  it('智能随访 409 冲突时提示刷新', async () => {
    mockInstitutionFetch({
      '/api/institution/followups': [
        jsonResponse({ records: [followUpRecord] }),
        jsonResponse({ error: '随访状态已变化，请刷新后重试' }, { status: 409 }),
      ],
    });

    render(<SmartFollowUpShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '流转 王女士 到 处理中' }));

    expect(await screen.findByText('随访状态已变化，请刷新后重试')).toBeInTheDocument();
  });

  it('智能随访提交失败时展示错误提示', async () => {
    mockInstitutionFetch({
      '/api/institution/followups': [
        jsonResponse({ records: [followUpRecord] }),
        jsonResponse({ error: '数据服务暂时不可用' }, { status: 503 }),
      ],
    });

    render(<SmartFollowUpShell />);

    expect(await screen.findByText('王女士')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '流转 王女士 到 处理中' }));

    expect(await screen.findByText('数据服务暂时不可用')).toBeInTheDocument();
  });
});
