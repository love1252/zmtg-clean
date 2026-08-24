import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  AnchorHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  MouseEventHandler,
  ReactNode,
} from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INSTITUTION_NAVIGATION_SECTION_IDS_V1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import {
  INSTITUTION_WORKSPACE_STORAGE_KEY_V1,
  resolveInstitutionWorkspaceStorageKeyV2,
} from '@/modules/institution-shell/components/institution-workspace-state';
import type {
  InstitutionNavigationTargetV1,
} from '@/modules/institution-shell/components/InstitutionWorkspaceFrame';

const routeMocks = vi.hoisted(() => {
  let pathname = '/hospital';
  let entries = ['/hospital'];
  let index = 0;
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  function navigate(nextPathname: string) {
    entries = [...entries.slice(0, index + 1), nextPathname];
    index = entries.length - 1;
    pathname = nextPathname;
    notify();
  }

  const push = vi.fn((nextPathname: string) => navigate(nextPathname));

  return {
    back() {
      if (index === 0) return;
      index -= 1;
      pathname = entries[index] ?? '/hospital';
      notify();
    },
    forward() {
      if (index >= entries.length - 1) return;
      index += 1;
      pathname = entries[index] ?? '/hospital';
      notify();
    },
    getPathname: () => pathname,
    navigate,
    push,
    reset(initialPathname: string) {
      pathname = initialPathname;
      entries = [initialPathname];
      index = 0;
      push.mockClear();
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    usePathname: () => useSyncExternalStore(
      routeMocks.subscribe,
      routeMocks.getPathname,
      routeMocks.getPathname,
    ),
    useRouter: () => ({ push: routeMocks.push }),
  };
});

vi.mock('next/link', async () => {
  const { createElement } = await import('react');
  return {
    default: ({
      children,
      href,
      onClick,
      ...props
    }: Readonly<{
      children: ReactNode;
      href: string;
      onClick?: MouseEventHandler<HTMLAnchorElement>;
    }> & AnchorHTMLAttributes<HTMLAnchorElement>) => createElement(
      'a',
      {
        ...props,
        href,
        onClick: (event: ReactMouseEvent<HTMLAnchorElement>) => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          routeMocks.navigate(href);
        },
      },
      children,
    ),
  };
});

const allTargets = Object.freeze([
  { pathname: '/hospital', label: '工作台', sectionId: 'workbench' },
  { pathname: '/hospital/customers', label: '客户列表', sectionId: 'customers' },
  { pathname: '/hospital/conversations', label: '会话队列', sectionId: 'conversations' },
  { pathname: '/hospital/care/appointments', label: '预约管理', sectionId: 'care' },
  { pathname: '/hospital/care/followups', label: '随访任务', sectionId: 'care' },
  { pathname: '/hospital/knowledge', label: '资料库', sectionId: 'knowledge' },
  { pathname: '/hospital/analytics', label: '经营总览', sectionId: 'analytics' },
  { pathname: '/hospital/system/ai-usage', label: 'AI 与额度', sectionId: 'system' },
  { pathname: '/hospital/system/audit', label: '审计与安全', sectionId: 'system' },
] as const satisfies readonly InstitutionNavigationTargetV1[]);

const WORKSPACE_SCOPE_A = 'A'.repeat(43);
const WORKSPACE_SCOPE_B = 'B'.repeat(43);
const WORKSPACE_SCOPE_C = 'C'.repeat(43);
const WORKSPACE_SCOPE_D = 'D'.repeat(43);

function storageKey(workspaceScopeKey: string) {
  const key = resolveInstitutionWorkspaceStorageKeyV2(workspaceScopeKey);
  if (!key) throw new Error('workspace scope fixture is invalid');
  return key;
}

function renderShell(
  availableNavigationTargets: readonly InstitutionNavigationTargetV1[] = allTargets,
  workspaceScopeKey: string | null = WORKSPACE_SCOPE_A,
) {
  return render(
    <InstitutionNavigationShell
      activeSectionId="customers"
      availableSectionIds={INSTITUTION_NAVIGATION_SECTION_IDS_V1}
      availableNavigationTargets={availableNavigationTargets}
      workspaceScopeKey={workspaceScopeKey}
    >
      <div>机构页面内容</div>
    </InstitutionNavigationShell>,
  );
}

function workspace() {
  return screen.getByRole('navigation', { name: '机构端工作区标签' });
}

function openTabMenu() {
  fireEvent.click(within(workspace()).getByRole('button', { name: '打开标签管理' }));
  return screen.getByRole('menu', { name: '标签管理' });
}

describe('机构端 Multi-tab Workspace 与页面级导航搜索', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    act(() => routeMocks.reset('/hospital'));
  });

  afterEach(() => {
    window.sessionStorage.clear();
    act(() => routeMocks.reset('/hospital'));
  });

  it('Next Link 导航后立即更新当前标签，且前进后退由 usePathname 同步', async () => {
    routeMocks.reset('/hospital/customers');
    renderShell();

    await waitFor(() => expect(
      within(workspace()).getByRole('link', { name: '客户列表' }),
    ).toHaveAttribute('aria-current', 'page'));

    fireEvent.click(
      within(screen.getByRole('navigation', { name: '机构端桌面导航' }))
        .getByRole('link', { name: '会话工作台' }),
    );
    await waitFor(() => expect(
      within(workspace()).getByRole('link', { name: '会话队列' }),
    ).toHaveAttribute('aria-current', 'page'));

    act(() => routeMocks.back());
    await waitFor(() => expect(
      within(workspace()).getByRole('link', { name: '客户列表' }),
    ).toHaveAttribute('aria-current', 'page'));
    act(() => routeMocks.forward());
    await waitFor(() => expect(
      within(workspace()).getByRole('link', { name: '会话队列' }),
    ).toHaveAttribute('aria-current', 'page'));
  });

  it('同一可信 actor、tenant 与 institution 作用域恢复同一组标签', async () => {
    window.sessionStorage.setItem(
      storageKey(WORKSPACE_SCOPE_A),
      JSON.stringify(['/hospital/customers', '/hospital/conversations']),
    );
    routeMocks.reset('/hospital');
    renderShell(allTargets, WORKSPACE_SCOPE_A);

    await waitFor(() => {
      expect(within(workspace()).getByRole('link', { name: '客户列表' })).toBeInTheDocument();
      expect(within(workspace()).getByRole('link', { name: '会话队列' })).toBeInTheDocument();
    });
  });

  it('同一组件切换作用域时在 Hydration 前立即隐藏旧对象标签且不覆盖旧 Storage', async () => {
    window.sessionStorage.setItem(
      storageKey(WORKSPACE_SCOPE_A),
      JSON.stringify(['/hospital/customers/customer-00000123']),
    );
    routeMocks.reset('/hospital/customers');
    const rendered = renderShell(allTargets, WORKSPACE_SCOPE_A);

    await waitFor(() => expect(
      within(workspace()).getByRole('link', { name: '客户 · 0123' }),
    ).toBeInTheDocument());
    const scopeAStoredBeforeSwitch = window.sessionStorage.getItem(
      storageKey(WORKSPACE_SCOPE_A),
    );
    expect(scopeAStoredBeforeSwitch).not.toBeNull();

    const pendingFrames: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        pendingFrames.push(callback);
        return pendingFrames.length;
      });

    rendered.rerender(
      <InstitutionNavigationShell
        activeSectionId="customers"
        availableSectionIds={INSTITUTION_NAVIGATION_SECTION_IDS_V1}
        availableNavigationTargets={allTargets}
        workspaceScopeKey={WORKSPACE_SCOPE_B}
      >
        <div>机构页面内容</div>
      </InstitutionNavigationShell>,
    );

    const scopeBHydrationFrame = pendingFrames.shift();
    requestAnimationFrame.mockRestore();

    expect(within(workspace()).queryByRole('link', { name: '客户 · 0123' })).toBeNull();
    expect(within(workspace()).getAllByRole('link').map((link) => link.textContent)).toEqual([
      '客户列表',
    ]);
    expect(window.sessionStorage.getItem(storageKey(WORKSPACE_SCOPE_A))).toBe(
      scopeAStoredBeforeSwitch,
    );
    expect(window.sessionStorage.getItem(storageKey(WORKSPACE_SCOPE_B))).toBeNull();

    expect(scopeBHydrationFrame).toBeDefined();
    act(() => scopeBHydrationFrame?.(performance.now()));

    await waitFor(() => expect(JSON.parse(
      window.sessionStorage.getItem(storageKey(WORKSPACE_SCOPE_B)) ?? '[]',
    )).toEqual(['/hospital/customers']));
    expect(window.sessionStorage.getItem(storageKey(WORKSPACE_SCOPE_A))).toBe(
      scopeAStoredBeforeSwitch,
    );

    rendered.rerender(
      <InstitutionNavigationShell
        activeSectionId="customers"
        availableSectionIds={INSTITUTION_NAVIGATION_SECTION_IDS_V1}
        availableNavigationTargets={allTargets}
        workspaceScopeKey={WORKSPACE_SCOPE_A}
      >
        <div>机构页面内容</div>
      </InstitutionNavigationShell>,
    );

    await waitFor(() => expect(
      within(workspace()).getByRole('link', { name: '客户 · 0123' }),
    ).toBeInTheDocument());
  });

  it.each([
    ['actor', WORKSPACE_SCOPE_B],
    ['tenant', WORKSPACE_SCOPE_C],
    ['institution', WORKSPACE_SCOPE_D],
  ] as const)(
    '%s 变化后不恢复其他作用域的对象标签',
    async (_dimension, changedScopeKey) => {
      window.sessionStorage.setItem(
        storageKey(WORKSPACE_SCOPE_A),
        JSON.stringify(['/hospital/customers/customer-00000123']),
      );
      routeMocks.reset('/hospital');
      renderShell(allTargets, changedScopeKey);

      await waitFor(() => expect(
        within(workspace()).getByRole('link', { name: '工作台' }),
      ).toBeInTheDocument());
      expect(within(workspace()).queryByRole('link', { name: '客户 · 0123' })).toBeNull();
      expect(JSON.parse(
        window.sessionStorage.getItem(storageKey(WORKSPACE_SCOPE_A)) ?? '[]',
      )).toEqual(['/hospital/customers/customer-00000123']);
    },
  );

  it('忽略并清理旧全局 V1 Key，且缺少可信作用域 Key 时不持久化', async () => {
    window.sessionStorage.setItem(
      INSTITUTION_WORKSPACE_STORAGE_KEY_V1,
      JSON.stringify(['/hospital/customers/customer-00000123']),
    );
    routeMocks.reset('/hospital/customers');
    renderShell(allTargets, null);

    await waitFor(() => expect(
      window.sessionStorage.getItem(INSTITUTION_WORKSPACE_STORAGE_KEY_V1),
    ).toBeNull());
    expect(within(workspace()).queryByRole('link', { name: '客户 · 0123' })).toBeNull();
    expect(
      Object.keys(window.sessionStorage).filter((key) =>
        key.startsWith('zmtg:institution-workspace-paths:v2:'),
      ),
    ).toEqual([]);
  });

  it('Capability 暂时失败时不清空 Scoped Storage，恢复后可恢复原 Workspace', async () => {
    window.sessionStorage.setItem(
      storageKey(WORKSPACE_SCOPE_A),
      JSON.stringify(['/hospital/customers/customer-00000123']),
    );
    routeMocks.reset('/hospital');
    const rendered = renderShell(allTargets, WORKSPACE_SCOPE_A);

    await waitFor(() => expect(
      within(workspace()).getByRole('link', { name: '客户 · 0123' }),
    ).toBeInTheDocument());
    const scopeAStoredBeforeFailure = window.sessionStorage.getItem(
      storageKey(WORKSPACE_SCOPE_A),
    );

    rendered.rerender(
      <InstitutionNavigationShell
        activeSectionId="customers"
        availableSectionIds={INSTITUTION_NAVIGATION_SECTION_IDS_V1}
        availableNavigationTargets={[]}
        workspaceScopeKey={null}
      >
        <div>Capability 暂时不可用</div>
      </InstitutionNavigationShell>,
    );

    expect(within(workspace()).queryByRole('link', { name: '客户 · 0123' })).toBeNull();
    await act(async () => {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    });
    expect(window.sessionStorage.getItem(storageKey(WORKSPACE_SCOPE_A))).toBe(
      scopeAStoredBeforeFailure,
    );

    rendered.rerender(
      <InstitutionNavigationShell
        activeSectionId="customers"
        availableSectionIds={INSTITUTION_NAVIGATION_SECTION_IDS_V1}
        availableNavigationTargets={allTargets}
        workspaceScopeKey={WORKSPACE_SCOPE_A}
      >
        <div>Capability 已恢复</div>
      </InstitutionNavigationShell>,
    );

    await waitFor(() => expect(
      within(workspace()).getByRole('link', { name: '客户 · 0123' }),
    ).toBeInTheDocument());
  });

  it('动态对象标签按 canonical 路径去重，并用不透明 ID 尾号区分', async () => {
    window.sessionStorage.setItem(
      storageKey(WORKSPACE_SCOPE_A),
      JSON.stringify([
        '/hospital/customers/customer-00000123',
        '/hospital/customers/customer-00008842',
        '/hospital/customers/customer-00000123',
      ]),
    );
    routeMocks.reset('/hospital/customers/customer-00000123');
    renderShell();

    await waitFor(() => {
      expect(within(workspace()).getAllByRole('link', { name: '客户 · 0123' })).toHaveLength(1);
      expect(within(workspace()).getByRole('link', { name: '客户 · 8842' })).toBeInTheDocument();
    });
    expect(within(workspace()).queryByRole('button', { name: '关闭工作台标签' })).toBeNull();

    await waitFor(() => {
      const rawValue = window.sessionStorage.getItem(storageKey(WORKSPACE_SCOPE_A)) ?? '';
      expect(JSON.parse(rawValue)).toEqual([
        '/hospital/customers/customer-00000123',
        '/hospital/customers/customer-00008842',
      ]);
      expect(rawValue).not.toMatch(/姓名|手机号|聊天|知识|Secret|客户 ·/u);
    });
  });

  it('usePathname 将客户、会话、预约和随访动态详情路由加入对象标签', async () => {
    renderShell();
    const dynamicRoutes = [
      ['/hospital/customers/customer-00000123', '客户 · 0123'],
      ['/hospital/conversations/conversation-00008842', '会话 · 8842'],
      ['/hospital/care/appointments/appointment-00004567', '预约 · 4567'],
      ['/hospital/care/followups/followup-00009876', '随访 · 9876'],
    ] as const;

    for (const [pathname, label] of dynamicRoutes) {
      act(() => routeMocks.navigate(pathname));
      await waitFor(() => expect(
        within(workspace()).getByRole('link', { name: label }),
      ).toHaveAttribute('aria-current', 'page'));
    }
  });

  it('关闭当前标签时进入左侧相邻标签并使用 router.push，不触发整页刷新', async () => {
    window.sessionStorage.setItem(
      storageKey(WORKSPACE_SCOPE_A),
      JSON.stringify([
        '/hospital/customers',
        '/hospital/conversations',
        '/hospital/care/appointments',
      ]),
    );
    routeMocks.reset('/hospital/care/appointments');
    renderShell();
    await waitFor(() => {
      expect(within(workspace()).getByRole('link', { name: '预约管理' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(workspace()).getByRole('link', { name: '会话队列' })).toBeInTheDocument();
    });

    fireEvent.click(within(openTabMenu()).getByRole('menuitem', { name: '关闭当前' }));

    await waitFor(() => expect(routeMocks.push).toHaveBeenCalledWith('/hospital/conversations'));
    expect(within(workspace()).queryByRole('link', { name: '预约管理' })).toBeNull();
    expect(within(workspace()).getByRole('link', { name: '会话队列' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('关闭其他和关闭右侧按当前可见顺序执行', async () => {
    window.sessionStorage.setItem(
      storageKey(WORKSPACE_SCOPE_A),
      JSON.stringify([
        '/hospital/customers',
        '/hospital/conversations',
        '/hospital/care/appointments',
        '/hospital/care/followups',
      ]),
    );
    act(() => routeMocks.reset('/hospital/conversations'));
    const rendered = renderShell();
    await waitFor(() => expect(
      within(workspace()).getByRole('link', { name: '随访任务' }),
    ).toBeInTheDocument());

    fireEvent.click(within(openTabMenu()).getByRole('menuitem', { name: '关闭右侧' }));
    expect(within(workspace()).queryByRole('link', { name: '预约管理' })).toBeNull();
    expect(within(workspace()).queryByRole('link', { name: '随访任务' })).toBeNull();
    expect(within(workspace()).getByRole('link', { name: '客户列表' })).toBeInTheDocument();

    rendered.unmount();
    window.sessionStorage.setItem(
      storageKey(WORKSPACE_SCOPE_A),
      JSON.stringify(['/hospital/customers', '/hospital/conversations', '/hospital/knowledge']),
    );
    routeMocks.reset('/hospital/conversations');
    renderShell();
    await waitFor(() => expect(
      within(workspace()).getByRole('link', { name: '资料库' }),
    ).toBeInTheDocument());
    fireEvent.click(within(openTabMenu()).getByRole('menuitem', { name: '关闭其他' }));
    expect(within(workspace()).getAllByRole('link').map((link) => link.textContent)).toEqual([
      '工作台',
      '会话队列',
    ]);
  });

  it('关闭全部只保留固定工作台，并提供横向滚动与完整标签列表', async () => {
    window.sessionStorage.setItem(
      storageKey(WORKSPACE_SCOPE_A),
      JSON.stringify(['/hospital/customers', '/hospital/conversations', '/hospital/knowledge']),
    );
    routeMocks.reset('/hospital/knowledge');
    renderShell();
    await waitFor(() => {
      expect(within(workspace()).getByRole('link', { name: '资料库' })).toBeInTheDocument();
      expect(within(workspace()).getByRole('link', { name: '工作台' })).toBeInTheDocument();
    });
    expect(within(workspace()).getByTestId('institution-workspace-scroll-area')).toHaveClass(
      'overflow-x-auto',
    );

    const menu = openTabMenu();
    expect(within(menu).getByText('完整标签列表')).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('menuitem', { name: '关闭全部' }));

    await waitFor(() => expect(routeMocks.push).toHaveBeenCalledWith('/hospital'));
    expect(within(workspace()).getAllByRole('link').map((link) => link.textContent)).toEqual([
      '工作台',
    ]);
  });

  it('异常快照没有获准工作台时，关闭全部不会强制跳转 /hospital', async () => {
    routeMocks.reset('/hospital/customers');
    renderShell([allTargets[1]], WORKSPACE_SCOPE_A);
    await waitFor(() => expect(
      within(workspace()).getByRole('link', { name: '客户列表' }),
    ).toBeInTheDocument());

    fireEvent.click(within(openTabMenu()).getByRole('menuitem', { name: '关闭全部' }));

    expect(routeMocks.push).not.toHaveBeenCalled();
    expect(within(workspace()).getByRole('link', { name: '客户列表' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('快速打开复用导航搜索，搜索结果严格来自页面级 Capability', async () => {
    renderShell([
      allTargets[0],
      allTargets[3],
    ]);

    fireEvent.click(within(workspace()).getByRole('button', { name: '快速打开页面' }));
    const dialog = screen.getByRole('dialog', { name: '搜索栏目与页面' });
    const input = within(dialog).getByPlaceholderText('搜索当前可访问的正式页面');
    await waitFor(() => expect(input).toHaveFocus());
    expect(within(dialog).getByRole('link', { name: /预约管理/u })).toHaveAttribute(
      'href',
      '/hospital/care/appointments',
    );
    expect(within(dialog).queryByRole('link', { name: /随访任务/u })).toBeNull();
    expect(within(dialog).queryByRole('link', { name: /客户列表/u })).toBeNull();
    expect(
      within(dialog).getByText(/页面目标来自服务端 Capability/u),
    ).toBeInTheDocument();
  });

  it('页面权限变化后移除未授权恢复标签并清理 sessionStorage 路径', async () => {
    window.sessionStorage.setItem(
      storageKey(WORKSPACE_SCOPE_A),
      JSON.stringify(['/hospital/customers', '/hospital/conversations']),
    );
    routeMocks.reset('/hospital/customers');
    const rendered = renderShell();
    await waitFor(() => expect(
      within(workspace()).getByRole('link', { name: '客户列表' }),
    ).toBeInTheDocument());

    rendered.rerender(
      <InstitutionNavigationShell
        activeSectionId="customers"
        availableSectionIds={INSTITUTION_NAVIGATION_SECTION_IDS_V1}
        availableNavigationTargets={[allTargets[0], allTargets[2]]}
        workspaceScopeKey={WORKSPACE_SCOPE_A}
      >
        <div>权限变化后的机构页面</div>
      </InstitutionNavigationShell>,
    );

    await waitFor(() => {
      expect(within(workspace()).queryByRole('link', { name: '客户列表' })).toBeNull();
      expect(JSON.parse(
        window.sessionStorage.getItem(storageKey(WORKSPACE_SCOPE_A)) ?? '[]',
      )).toEqual(['/hospital/conversations']);
    });
  });
});
