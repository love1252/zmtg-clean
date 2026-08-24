import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const serverAuthorizationSeam = vi.hoisted(() => {
  const navigationDecision = Object.freeze({
    kind: 'institution_navigation_authorization' as const,
    targetSectionId: 'conversations' as const,
    targetAccess: 'allowed' as const,
    availableSectionIds: Object.freeze([
      'workbench',
      'customers',
      'conversations',
      'care',
      'knowledge',
      'analytics',
      'system',
    ] as const),
  });
  const authorization = Object.freeze({
    authorizeCurrentInstitutionNavigationV1: vi.fn(async () => navigationDecision),
  });

  return { authorization, navigationDecision };
});

vi.mock('@/modules/institution/server/institution-server-runtime', () => ({
  resolveInstitutionServerAuthorizationV1: vi.fn(async () =>
    serverAuthorizationSeam.authorization,
  ),
}));

vi.mock('@/modules/security/server/institution-request-authorization', () => ({
  isInstitutionRequestAuthorizationV1: vi.fn(
    (value: unknown) => value === serverAuthorizationSeam.authorization,
  ),
}));

vi.mock('@/modules/security/server/institution-section-guard', () => ({
  isInstitutionNavigationAuthorizationV1: vi.fn(
    (value: unknown) => value === serverAuthorizationSeam.navigationDecision,
  ),
  readInstitutionNavigationWorkspaceScopeKeyV1: vi.fn(
    (value: unknown) =>
      value === serverAuthorizationSeam.navigationDecision
        ? 'C'.repeat(43)
        : null,
  ),
  matchesInstitutionNavigationAuthorizationScopeV1: vi.fn(
    (value: unknown) => value === serverAuthorizationSeam.navigationDecision,
  ),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('404');
  },
  usePathname: () => '/hospital/conversations/conversation-001',
  useRouter: () => ({ push: vi.fn() }),
}));

import HospitalCapabilityOffRoute from '@/app/hospital/[...slug]/page';

const DESKTOP_NAVIGATION = [
  ['工作台', '/hospital'],
  ['客户中心', '/hospital/customers'],
  ['会话工作台', '/hospital/conversations'],
  ['预约与随访', '/hospital/care'],
  ['知识库', '/hospital/knowledge'],
  ['经营分析', '/hospital/analytics'],
  ['管理中心', '/hospital/system'],
] as const;
const MOBILE_NAVIGATION_LABELS = ['工作台', '客户', '会话', '待办', '更多'] as const;
const MOBILE_MORE_NAVIGATION = [
  ['知识库', '/hospital/knowledge'],
  ['经营分析', '/hospital/analytics'],
  ['管理中心', '/hospital/system'],
] as const;

describe('CONV-SAFE-02B 会话 canonical capability-off 路由', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('会话深链接零 fetch 渲染低敏 capability-off，并展示冻结七栏与移动五入口', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const page = await HospitalCapabilityOffRoute({
      params: Promise.resolve({ slug: ['conversations', 'conversation-001'] }),
    });
    render(page);

    expect(screen.getByText('会话详情尚未开放')).toBeInTheDocument();
    expect(screen.getByText(/当前机构尚未获得该能力的生产放行。/u)).toBeInTheDocument();
    expect(
      screen.getByText('当前仅展示导航入口，不代表已授权或能力已开放'),
    ).toBeInTheDocument();
    expect(screen.getByText('安全边界')).toBeInTheDocument();
    expect(
      screen.queryByText('栏目可见性由服务端权限与能力状态共同决定'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('安全访问')).not.toBeInTheDocument();
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
    const desktopLinks = within(desktopNavigation).getAllByRole('link');
    expect(desktopLinks.map((link) => link.getAttribute('aria-label'))).toEqual(
      DESKTOP_NAVIGATION.map(([label]) => label),
    );
    for (const [label, href] of DESKTOP_NAVIGATION) {
      expect(within(desktopNavigation).getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      );
    }

    const mobileNavigation = screen.getByRole('navigation', { name: '机构端移动导航' });
    expect(
      Array.from(mobileNavigation.querySelectorAll('a, button')).map((entry) =>
        entry.textContent?.trim(),
      ),
    ).toEqual(MOBILE_NAVIGATION_LABELS);
    fireEvent.click(within(mobileNavigation).getByRole('button', { name: '更多' }));
    const moreNavigation = screen.getByRole('dialog', { name: '更多栏目' });
    expect(within(moreNavigation).getAllByRole('link').map((link) => link.textContent?.trim())).toEqual(
      MOBILE_MORE_NAVIGATION.map(([label]) => label),
    );
    for (const [label, href] of MOBILE_MORE_NAVIGATION) {
      expect(within(moreNavigation).getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      );
    }

    expect(screen.queryByText(/fixture|mock_sent|dry-run|模拟发送|不真实发送/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/^0$/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/^暂无会话$/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/^渠道可用$/u)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '接管会话' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '结束会话' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '发送' })).not.toBeInTheDocument();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('正在检查登录状态...')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/^(已授权|授权成功|渠道已可用|生产能力已开放)$/u),
    ).not.toBeInTheDocument();
  });

  it('未知 slug 继续 notFound，且不读取 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      HospitalCapabilityOffRoute({
        params: Promise.resolve({ slug: ['unknown-section'] }),
      }),
    ).rejects.toThrow(/404/u);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
