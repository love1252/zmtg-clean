import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HospitalPage from '@/app/hospital/page';
import OpenPlatformPage from '@/app/open-platform/page';

const customerRecord = {
  id: 'cust_phase5_closeout',
  tenantId: 'demo-tenant-001',
  displayName: 'Phase5 客户A',
  lifecycle: 'repurchase_window',
  priority: 'high',
  ownerUserId: 'consultant-phase5',
  projectInterest: 'Phase5 修复项目',
  maskedPhone: '138****1252',
  maskedMedicalRecordNo: 'MR****525',
  lastTouchSummary: 'Phase5 验收触达',
  nextAction: 'Phase5 收尾回访',
  tags: ['Phase5', '验收'],
};

const appointmentRecord = {
  id: 'appt_phase5_closeout',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_phase5_closeout',
  customerDisplayName: 'Phase5 客户A',
  project: 'Phase5 预约复诊',
  scheduledAt: '2026-06-01T10:30:00+08:00',
  consultantUserId: 'consultant-phase5',
  status: 'pending_confirmation',
  note: 'Phase5 验收预约',
};

const followUpRecord = {
  id: 'fu_phase5_closeout',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_phase5_closeout',
  customerDisplayName: 'Phase5 客户A',
  journeyId: 'journey_repurchase',
  stage: 'Phase5 D7 回访',
  status: 'due',
  dueAt: '2026-05-31T10:30:00+08:00',
  suggestedAction: 'Phase5 收尾人工回访',
  riskLevel: 'watch',
  updatedBy: null,
  updatedAt: null,
};

const postCareCustomerRecord = {
  ...customerRecord,
  id: 'cust_phase6_post_care',
  displayName: 'Phase6 客户B',
  lifecycle: 'post_care',
  priority: 'medium',
  projectInterest: 'Phase6 光电复诊',
  maskedPhone: '137****6606',
  maskedMedicalRecordNo: 'MR****606',
  lastTouchSummary: 'Phase6 术后反馈',
  nextAction: 'Phase6 客服回访',
  tags: ['Phase6', '术后'],
};

const rescheduleAppointmentRecord = {
  ...appointmentRecord,
  id: 'appt_phase6_reschedule',
  customerId: 'cust_phase6_post_care',
  customerDisplayName: 'Phase6 客户B',
  project: 'Phase6 改约复诊',
  scheduledAt: '2026-06-02T14:30:00+08:00',
  status: 'reschedule_requested',
  note: 'Phase6 需要协调档期',
};

const urgentFollowUpRecord = {
  ...followUpRecord,
  id: 'fu_phase6_urgent',
  customerId: 'cust_phase6_post_care',
  customerDisplayName: 'Phase6 客户B',
  stage: 'Phase6 D3 异常反馈',
  dueAt: '2026-05-31T09:30:00+08:00',
  suggestedAction: 'Phase6 客服优先回访',
  riskLevel: 'urgent',
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

type WorkspaceFetchOptions = {
  role?: 'tenant_admin' | 'platform_admin';
  customers?: unknown[];
  appointments?: unknown[];
  followups?: unknown[];
  institutionError?: {
    path: '/api/institution/customers' | '/api/institution/appointments' | '/api/institution/followups';
    status: number;
    message: string;
  };
};

function mockWorkspaceFetch(options: WorkspaceFetchOptions = {}) {
  const {
    role = 'tenant_admin',
    customers = [customerRecord, postCareCustomerRecord],
    appointments = [appointmentRecord, rescheduleAppointmentRecord],
    followups = [urgentFollowUpRecord, { ...followUpRecord, status: 'scheduled' }],
    institutionError,
  } = options;

  const fetchMock = vi.fn(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      void init;
      const path = fetchPath(input);

      if (path === '/api/auth/session') {
        return jsonResponse({ authenticated: true, user: { role } });
      }

      if (institutionError?.path === path) {
        return jsonResponse({ error: institutionError.message }, { status: institutionError.status });
      }

      if (path === '/api/institution/customers') {
        return jsonResponse({ records: customers });
      }

      if (path === '/api/institution/appointments') {
        return jsonResponse({ records: appointments });
      }

      if (path === '/api/institution/followups') {
        return jsonResponse({ records: followups });
      }

      throw new Error(`没有为 ${path} 配置 fetch mock`);
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function expectMetric(label: string, value: string) {
  const metricCard = screen.getByText(label).closest('article');
  expect(metricCard).not.toBeNull();
  expect(within(metricCard as HTMLElement).getByText(value)).toBeInTheDocument();
}

function expectNoInstitutionMutation(fetchMock: ReturnType<typeof mockWorkspaceFetch>) {
  const institutionCalls = fetchMock.mock.calls.filter(([input]) =>
    fetchPath(input).startsWith('/api/institution/'),
  );

  expect(institutionCalls).toHaveLength(3);
  for (const [input, init] of institutionCalls) {
    expect(fetchPath(input)).not.toContain('tenantId');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(init?.body ? String(init.body) : '').not.toContain('tenantId');
  }
}

describe('工作台入口页面', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('机构工作台首页从真实 API 派生指标和行动摘要', async () => {
    const fetchMock = mockWorkspaceFetch();
    render(<HospitalPage />);

    expect(await screen.findByRole('heading', { name: /让咨询团队/ })).toBeInTheDocument();
    expect(screen.getByText('先看到增长机会')).toBeInTheDocument();
    expect(screen.getByText('正在加载机构运营摘要...')).toBeInTheDocument();
    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
    expectMetric('当前客户摘要', '2');
    expectMetric('高优先级客户', '1');
    expectMetric('待确认预约', '1');
    expectMetric('待处理随访', '1');
    expect(screen.getByText('高风险随访')).toBeInTheDocument();
    expect(screen.getByText('Phase6 客户B：Phase6 D3 异常反馈')).toBeInTheDocument();
    expect(screen.getByText('Phase5 客户A：Phase5 预约复诊')).toBeInTheDocument();
    expect(screen.getByText('Phase5 客户A：Phase5 修复项目')).toBeInTheDocument();
    expect(screen.queryByText('今日高意向客户 18 位')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 已按承接优先级排序')).not.toBeInTheDocument();
    expect(screen.queryByText('实时同步')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 经营副驾驶建议')).not.toBeInTheDocument();
    expect(screen.getAllByText('智美天工').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '工作台' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客户中心' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '机构端移动导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：客户中心' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出工作台' })).toBeInTheDocument();
    expect(screen.getByText('近期需要人工处理')).toBeInTheDocument();
    expect(screen.getByText('客户旅程看板')).toBeInTheDocument();
    expect(screen.getByText('当前行动队列')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/customers', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/appointments', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/followups', { cache: 'no-store' });
    expectNoInstitutionMutation(fetchMock);

    fireEvent.click(screen.getByRole('button', { name: '客户中心' }));
    expect(screen.getByRole('heading', { name: '客户中心' })).toBeInTheDocument();
    expect(screen.getByText('客户优先级队列')).toBeInTheDocument();
    expect(await screen.findByText('Phase5 客户A')).toBeInTheDocument();
    expect(screen.getByText('脱敏手机号：138****1252')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '预约中心' }));
    expect(screen.getByRole('heading', { name: '预约中心' })).toBeInTheDocument();
    expect(await screen.findByText('Phase5 预约复诊')).toBeInTheDocument();
    expect(screen.getByText('数据边界')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Phase5 客户A' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '智能随访' }));
    expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
    expect(screen.getByText('今日随访任务')).toBeInTheDocument();
    expect(await screen.findByText('Phase5 D7 回访')).toBeInTheDocument();
    expect(screen.getByText('不会调用 AI provider，也不会自动触达客户。')).toBeInTheDocument();
  });

  it('机构工作台首页展示空状态', async () => {
    const fetchMock = mockWorkspaceFetch({
      customers: [],
      appointments: [],
      followups: [],
    });
    render(<HospitalPage />);

    expect(await screen.findByText('当前租户 API 摘要')).toBeInTheDocument();
    expect(await screen.findByText('暂无可计算运营摘要')).toBeInTheDocument();
    expectMetric('当前客户摘要', '0');
    expectMetric('高优先级客户', '0');
    expectMetric('待确认预约', '0');
    expectMetric('待处理随访', '0');
    expect(screen.getByText('当前客户、预约和随访 records 为空。')).toBeInTheDocument();
    expect(screen.getByText('当前没有可展示的待处理行动。')).toBeInTheDocument();
    expectNoInstitutionMutation(fetchMock);
  });

  it.each([
    [401, '请先登录', '登录状态已失效，请重新登录'],
    [403, '没有访问权限', '当前账号没有访问机构首页数据的权限'],
    [503, '数据服务暂时不可用', '数据服务暂时不可用'],
  ])('机构工作台首页处理 %s 错误态', async (status, apiMessage, visibleMessage) => {
    const fetchMock = mockWorkspaceFetch({
      institutionError: {
        path: '/api/institution/customers',
        status,
        message: apiMessage,
      },
    });
    render(<HospitalPage />);

    expect(await screen.findByText(visibleMessage)).toBeInTheDocument();
    expect(screen.queryByText('今日高意向客户 18 位')).not.toBeInTheDocument();
    expect(screen.queryByText('AI 已按承接优先级排序')).not.toBeInTheDocument();
    expect(screen.queryByText('实时同步')).not.toBeInTheDocument();
    expectNoInstitutionMutation(fetchMock);
  });

  it('渲染平台控制台页面壳', async () => {
    mockWorkspaceFetch({ role: 'platform_admin' });
    render(<OpenPlatformPage />);

    expect(await screen.findByRole('heading', { name: /掌控租户、模型与接口/ })).toBeInTheDocument();
    expect(screen.getByText('让平台运营可观测')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '平台总览' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '首页与品牌' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '权限与审计' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '平台端移动导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：开放连接中心' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出平台' })).toBeInTheDocument();
    expect(screen.getByText('平台增长与调用趋势')).toBeInTheDocument();
    expect(screen.getByText('开放接口治理')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '开放平台基础治理' })).toBeInTheDocument();
    expect(screen.getByText('服务端租户上下文')).toBeInTheDocument();
    expect(screen.getByText('权限样例矩阵')).toBeInTheDocument();
    expect(screen.getByText('审计事件词汇')).toBeInTheDocument();
  });
});
