import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppointmentCenterShell } from '@/modules/institution/components/AppointmentCenterShell';
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

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
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

function requestBody(fetchMock: ReturnType<typeof mockCustomerFetch>, callIndex: number) {
  const call = fetchMock.mock.calls[callIndex];
  if (!call) {
    throw new Error(`缺少第 ${callIndex + 1} 次 fetch 调用`);
  }

  const [, init] = call;
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe('机构业务页面壳', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
    expect(screen.getByText('赵女士')).toBeInTheDocument();
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

  it('渲染预约中心页面壳', () => {
    render(<AppointmentCenterShell />);

    expect(screen.getByRole('heading', { name: '预约中心' })).toBeInTheDocument();
    expect(screen.getByText('待确认')).toBeInTheDocument();
    expect(screen.getByText('明日 10:30')).toBeInTheDocument();
    expect(screen.getByText('3 位客户存在爽约风险')).toBeInTheDocument();
  });

  it('渲染智能随访页面壳', () => {
    render(<SmartFollowUpShell />);

    expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
    expect(screen.getByText('术后 D0-D30 关怀')).toBeInTheDocument();
    expect(screen.getByText('D3 异常反馈')).toBeInTheDocument();
    expect(screen.getByText('这是演示话术：请根据客户真实恢复情况由专业人员确认后再发送。')).toBeInTheDocument();
  });
});
