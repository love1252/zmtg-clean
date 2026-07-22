import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HospitalCapabilityOffRoute from '@/app/hospital/[...slug]/page';

describe('CONV-SAFE-02B 会话 canonical capability-off 路由', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('仅在通过既有认证门后渲染低敏不可用状态，不加载模拟会话或发送能力', async () => {
    let resolveSession: ((response: Response) => void) | undefined;
    const sessionResponse = new Promise<Response>((resolve) => {
      resolveSession = resolve;
    });
    const fetchMock = vi.fn(() => sessionResponse);
    vi.stubGlobal('fetch', fetchMock);

    const page = await HospitalCapabilityOffRoute({
      params: Promise.resolve({ slug: ['conversations'] }),
    });
    render(page);

    expect(screen.getByText('正在检查登录状态...')).toBeInTheDocument();
    expect(screen.queryByText('会话队列尚未开放')).not.toBeInTheDocument();
    if (!resolveSession) throw new Error('session resolver must be initialized');
    resolveSession(
      Response.json({
        authenticated: true,
        user: { role: 'tenant_admin' },
      }),
    );

    expect(await screen.findByText('会话队列尚未开放')).toBeInTheDocument();
    expect(screen.getByText(/当前机构尚未获得该能力的生产放行。/u)).toBeInTheDocument();
    const conversationBoundary = screen.getByLabelText('会话能力静态边界');
    expect(within(conversationBoundary).getByText('会话事实')).toBeInTheDocument();
    expect(within(conversationBoundary).getByText('未读取')).toBeInTheDocument();
    expect(within(conversationBoundary).getByText('渠道状态')).toBeInTheDocument();
    expect(within(conversationBoundary).getByText('未验证')).toBeInTheDocument();
    expect(within(conversationBoundary).getByText('发送与自动触达')).toBeInTheDocument();
    expect(within(conversationBoundary).getByText('未启用')).toBeInTheDocument();
    expect(
      screen.getByText(
        '当前未读取任何会话或渠道事实；未知状态不会被解释为零记录、空会话、历史消息或渠道已可用。',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回工作台' })).toHaveAttribute('href', '/hospital');
    expect(screen.getAllByRole('main')).toHaveLength(1);

    const desktopNavigation = screen.getByRole('navigation', { name: '机构端桌面导航' });
    expect(within(desktopNavigation).getAllByRole('link')).toHaveLength(1);
    expect(within(desktopNavigation).getByRole('link', { name: '工作台' })).toHaveAttribute(
      'href',
      '/hospital',
    );
    expect(within(desktopNavigation).queryByRole('link', { name: '会话工作台' })).not.toBeInTheDocument();

    expect(screen.queryByText(/fixture|mock_sent|dry-run|模拟发送|不真实发送/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/^0$/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/^暂无会话$/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/^渠道可用$/u)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '接管会话' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '结束会话' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '发送' })).not.toBeInTheDocument();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', { cache: 'no-store' });
  });
});
