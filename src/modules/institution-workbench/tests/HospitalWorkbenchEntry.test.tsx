import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HospitalPage from '@/app/hospital/page';

describe('WB-UI-01 工作台入口', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['tenant_admin', 'tenant_operator', 'consultant', 'customer_service'] as const)(
    '%s 可通过 DemoSessionGate 查看 capability-off 工作台，不读取旧工作台数据',
    async (role) => {
      const fetchMock = vi.fn(async () =>
        Response.json({
          authenticated: true,
          user: { role },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      render(<HospitalPage />);

      expect(await screen.findByRole('heading', { name: '工作台', level: 1 })).toBeInTheDocument();
      expect(screen.getAllByRole('main')).toHaveLength(1);

      const desktopNavigation = screen.getByRole('navigation', { name: '机构端桌面导航' });
      expect(within(desktopNavigation).getAllByRole('link')).toHaveLength(1);
      expect(within(desktopNavigation).getByRole('link', { name: '工作台' })).toHaveAttribute(
        'href',
        '/hospital',
      );
      expect(within(desktopNavigation).queryByText('客户中心')).not.toBeInTheDocument();
      expect(within(desktopNavigation).queryByText('预约与随访')).not.toBeInTheDocument();
      expect(within(desktopNavigation).queryByText('经营分析')).not.toBeInTheDocument();

      expect(
        screen.getByRole('heading', { name: '数据服务/能力尚未安全开放', level: 2 }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/当前工作台不会展示模拟数字、演示客户或未授权业务入口/u),
      ).toBeInTheDocument();
      expect(
        screen.getByText('当前仅展示安全阻断状态；业务数据和业务入口保持隐藏。'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('聚合已授权的预约、随访与会话信息，帮助团队优先处理需要关注的事项。'),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '工作台行动数据暂未开放', level: 3 })).toBeInTheDocument();
      expect(screen.getByText('待确认预约、改约申请、逾期随访、今日到期随访和行动队列当前保持隐藏。')).toBeInTheDocument();
      expect(screen.getByText('只有可验证来源、机构隔离、服务端成员与对象权限完成后，才会显示低敏投影。')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: '行动队列' })).not.toBeInTheDocument();
      expect(screen.queryByText('Care 行动概览')).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: '客户旅程' })).not.toBeInTheDocument();
      expect(screen.queryByText('机构能力')).not.toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
      expect(screen.queryByText(/nextAction/u)).not.toBeInTheDocument();
      expect(screen.queryAllByRole('link', { name: /查看|新建/u })).toHaveLength(0);

      const mobileNavigation = screen.getByRole('navigation', { name: '机构端移动导航' });
      expect(within(mobileNavigation).getAllByRole('link')).toHaveLength(1);
      expect(within(mobileNavigation).getByRole('link', { name: '工作台' })).toHaveAttribute(
        'href',
        '/hospital',
      );
      expect(within(mobileNavigation).queryByRole('button', { name: '更多' })).not.toBeInTheDocument();

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', { cache: 'no-store' });
    },
  );

  it.each([
    ['未登录', { authenticated: false, user: null }],
    ['无效角色', { authenticated: true, user: { role: 'invalid_role' } }],
    ['平台角色', { authenticated: true, user: { role: 'platform_admin' } }],
  ])('%s 不渲染 capability-off 工作台', async (_label, session) => {
    const fetchMock = vi.fn(async () => Response.json(session));
    vi.stubGlobal('fetch', fetchMock);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<HospitalPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('heading', { name: '工作台', level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '数据服务/能力尚未安全开放', level: 2 })).not.toBeInTheDocument();
    expect(screen.getByText('正在检查登录状态...')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
