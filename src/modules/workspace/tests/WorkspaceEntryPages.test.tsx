import { fireEvent, render, screen } from '@testing-library/react';
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

function mockWorkspaceFetch(role: 'tenant_admin' | 'platform_admin') {
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const path = fetchPath(input);

    if (path === '/api/auth/session') {
      return jsonResponse({ authenticated: true, user: { role } });
    }

    if (path === '/api/institution/customers') {
      return jsonResponse({ records: [customerRecord] });
    }

    if (path === '/api/institution/appointments') {
      return jsonResponse({ records: [appointmentRecord] });
    }

    if (path === '/api/institution/followups') {
      return jsonResponse({ records: [followUpRecord] });
    }

    throw new Error(`没有为 ${path} 配置 fetch mock`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('工作台入口页面', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('渲染机构工作台页面壳', async () => {
    const fetchMock = mockWorkspaceFetch('tenant_admin');
    render(<HospitalPage />);

    expect(await screen.findByRole('heading', { name: /让咨询团队/ })).toBeInTheDocument();
    expect(screen.getByText('先看到增长机会')).toBeInTheDocument();
    expect(screen.getByText('今日高意向客户 18 位')).toBeInTheDocument();
    expect(screen.getAllByText('智美天工').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '工作台' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '客户中心' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '机构端移动导航' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '移动导航：客户中心' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出工作台' })).toBeInTheDocument();
    expect(screen.getByText('AI 经营副驾驶建议')).toBeInTheDocument();
    expect(screen.getByText('累计客户资产')).toBeInTheDocument();
    expect(screen.getByText('客户旅程看板')).toBeInTheDocument();
    expect(screen.getByText('今日行动队列')).toBeInTheDocument();

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
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/customers', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/appointments', { cache: 'no-store' });
    expect(fetchMock).toHaveBeenCalledWith('/api/institution/followups', { cache: 'no-store' });
  });

  it('渲染平台控制台页面壳', async () => {
    mockWorkspaceFetch('platform_admin');
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
