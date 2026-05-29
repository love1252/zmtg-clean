import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HospitalPage from '@/app/hospital/page';
import OpenPlatformPage from '@/app/open-platform/page';

function mockSession(role: 'tenant_admin' | 'platform_admin') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({ authenticated: true, user: { role } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
}

describe('workspace entry pages', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the institution dashboard shell', async () => {
    mockSession('tenant_admin');
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

    fireEvent.click(screen.getByRole('button', { name: '预约中心' }));
    expect(screen.getByRole('heading', { name: '预约中心' })).toBeInTheDocument();
    expect(screen.getByText('运营提醒')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '智能随访' }));
    expect(screen.getByRole('heading', { name: '智能随访' })).toBeInTheDocument();
    expect(screen.getByText('今日随访任务')).toBeInTheDocument();
  });

  it('renders the platform console shell', async () => {
    mockSession('platform_admin');
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
  });
});
