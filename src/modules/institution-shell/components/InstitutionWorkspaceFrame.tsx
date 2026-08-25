'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Command,
  Grid2X2,
  MessagesSquare,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  INSTITUTION_NAVIGATION_SECTIONS_V1,
  type InstitutionNavigationSectionIdV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import { cn } from '@/shared/utils/cn';
import {
  INSTITUTION_WORKSPACE_STORAGE_KEY_V1,
  closeAllInstitutionWorkspaceTabsV1,
  closeInstitutionWorkspaceTabV1,
  closeOtherInstitutionWorkspaceTabsV1,
  closeRightInstitutionWorkspaceTabsV1,
  filterInstitutionWorkspaceTabsByPagePathsV1,
  mergeInstitutionWorkspaceTabsV1,
  parseInstitutionWorkspaceStoredPathsV1,
  resolveInstitutionWorkspaceStorageKeyV2,
  resolveInstitutionWorkspaceTabV1,
  type InstitutionWorkspaceTabV1,
} from './institution-workspace-state';

export type InstitutionNavigationTargetV1 = Readonly<{
  pathname: string;
  label: string;
  sectionId: InstitutionNavigationSectionIdV1;
}>;

type InstitutionWorkspaceFrameProps = Readonly<{
  activeSectionId: InstitutionNavigationSectionIdV1;
  availableSectionIds: readonly InstitutionNavigationSectionIdV1[];
  availableNavigationTargets: readonly InstitutionNavigationTargetV1[];
  workspaceScopeKey: string | null;
  children: ReactNode;
}>;

function captureNavigationTargets(
  candidates: readonly InstitutionNavigationTargetV1[],
): readonly InstitutionNavigationTargetV1[] {
  const targets: InstitutionNavigationTargetV1[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const tab = resolveInstitutionWorkspaceTabV1(candidate.pathname);
    if (
      !tab
      || tab.objectTab
      || tab.pathname !== candidate.pathname
      || tab.label !== candidate.label
      || tab.sectionId !== candidate.sectionId
      || seen.has(candidate.pathname)
    ) {
      continue;
    }
    seen.add(candidate.pathname);
    targets.push(Object.freeze({
      pathname: candidate.pathname,
      label: candidate.label,
      sectionId: candidate.sectionId,
    }));
  }

  return Object.freeze(targets);
}

function readStoredPaths(storageKey: string | null) {
  if (!storageKey) return Object.freeze([]) as readonly string[];
  try {
    const rawValue = window.sessionStorage.getItem(storageKey);
    return parseInstitutionWorkspaceStoredPathsV1(rawValue ? JSON.parse(rawValue) : []);
  } catch {
    return Object.freeze([]) as readonly string[];
  }
}

export function InstitutionWorkspaceFrame({
  activeSectionId,
  availableSectionIds,
  availableNavigationTargets,
  workspaceScopeKey,
  children,
}: InstitutionWorkspaceFrameProps) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [pendingRoutePathname, setPendingRoutePathname] = useState<string | null>(null);
  const [tabs, setTabs] = useState<readonly InstitutionWorkspaceTabV1[]>(() =>
    mergeInstitutionWorkspaceTabsV1([], '/hospital'),
  );
  const [hydratedStorageKey, setHydratedStorageKey] = useState<
    string | null | undefined
  >(undefined);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTabMenuOpen, setIsTabMenuOpen] = useState(false);
  const [activeUtility, setActiveUtility] = useState<
    'messages' | 'notifications' | 'help' | 'user' | null
  >(null);
  const [query, setQuery] = useState('');
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchDialogRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tabMenuButtonRef = useRef<HTMLButtonElement>(null);
  const tabMenuRef = useRef<HTMLDivElement>(null);
  const availableIds = useMemo(() => new Set(availableSectionIds), [availableSectionIds]);
  const navigationTargets = useMemo(
    () => captureNavigationTargets(availableNavigationTargets),
    [availableNavigationTargets],
  );
  const storageKey = resolveInstitutionWorkspaceStorageKeyV2(workspaceScopeKey);
  const isHydrated = hydratedStorageKey === storageKey;
  const availablePagePaths = useMemo(
    () => navigationTargets.map((target) => target.pathname),
    [navigationTargets],
  );
  const availablePagePathsKey = availablePagePaths.join('\u0000');
  const effectivePathname = pendingRoutePathname && pendingRoutePathname !== pathname
    ? pendingRoutePathname
    : pathname;
  const mergedTabs = useMemo(
    () => mergeInstitutionWorkspaceTabsV1(
      tabs.map((tab) => tab.pathname),
      effectivePathname,
    ),
    [effectivePathname, tabs],
  );
  const hydrationSafeTabs = useMemo(() => {
    if (isHydrated) return mergedTabs;

    const currentPathTab = resolveInstitutionWorkspaceTabV1(effectivePathname);
    return currentPathTab
      ? Object.freeze([currentPathTab])
      : Object.freeze([] as InstitutionWorkspaceTabV1[]);
  }, [effectivePathname, isHydrated, mergedTabs]);
  const visibleTabs = useMemo(
    () => filterInstitutionWorkspaceTabsByPagePathsV1(
      hydrationSafeTabs,
      availablePagePaths,
    ),
    [availablePagePaths, hydrationSafeTabs],
  );
  const activeSection = availableIds.has(activeSectionId)
    ? INSTITUTION_NAVIGATION_SECTIONS_V1.find((section) => section.id === activeSectionId)
    : null;
  const currentTab = visibleTabs.find((tab) => tab.pathname === effectivePathname) ?? null;
  const currentTabIndex = currentTab
    ? visibleTabs.findIndex((tab) => tab.pathname === currentTab.pathname)
    : -1;
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  const filteredTargets = navigationTargets.filter((target) => {
    const sectionLabel = INSTITUTION_NAVIGATION_SECTIONS_V1.find(
      (section) => section.id === target.sectionId,
    )?.label ?? '';
    return normalizedQuery.length === 0
      || `${target.label} ${sectionLabel}`.toLocaleLowerCase('zh-CN').includes(normalizedQuery);
  });

  useEffect(() => {
    if (isHydrated) return;

    const frame = window.requestAnimationFrame(() => {
      try {
        window.sessionStorage.removeItem(INSTITUTION_WORKSPACE_STORAGE_KEY_V1);
      } catch {
        // Legacy cleanup is best effort; no legacy value is ever restored.
      }
      const nextTabs = filterInstitutionWorkspaceTabsByPagePathsV1(
        mergeInstitutionWorkspaceTabsV1(
          readStoredPaths(storageKey),
          effectivePathname,
        ),
        availablePagePaths,
      );
      if (storageKey) {
        try {
          window.sessionStorage.setItem(
            storageKey,
            JSON.stringify(
              nextTabs.filter((tab) => !tab.fixed).map((tab) => tab.pathname),
            ),
          );
        } catch {
          // Session storage is optional UI state; hydration remains in memory.
        }
      }
      setTabs(nextTabs);
      setHydratedStorageKey(storageKey);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    availablePagePaths,
    availablePagePathsKey,
    effectivePathname,
    isHydrated,
    storageKey,
  ]);

  useEffect(() => {
    if (!isHydrated) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setTabs((currentTabs) => {
        const nextTabs = filterInstitutionWorkspaceTabsByPagePathsV1(
          mergeInstitutionWorkspaceTabsV1(
            currentTabs.map((tab) => tab.pathname),
            effectivePathname,
          ),
          availablePagePaths,
        );
        return nextTabs.length === currentTabs.length
          && nextTabs.every((tab, tabPosition) => (
            tab.pathname === currentTabs[tabPosition]?.pathname
          ))
          ? currentTabs
          : nextTabs;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [availablePagePaths, availablePagePathsKey, effectivePathname, isHydrated]);

  useEffect(() => {
    if (!pendingRoutePathname || pendingRoutePathname !== pathname) return;

    const frame = window.requestAnimationFrame(() => setPendingRoutePathname(null));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, pendingRoutePathname]);

  useEffect(() => {
    if (!isHydrated || !storageKey) return;

    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify(
          visibleTabs.filter((tab) => !tab.fixed).map((tab) => tab.pathname),
        ),
      );
    } catch {
      // Session storage is optional UI state; navigation remains functional without it.
    }
  }, [isHydrated, storageKey, visibleTabs]);

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setIsTabMenuOpen(false);
        setActiveUtility(null);
        setIsSearchOpen(true);
      } else if (event.key === 'Escape') {
        setIsSearchOpen(false);
        setIsTabMenuOpen(false);
        setActiveUtility(null);
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return;

    const returnFocusTarget = searchButtonRef.current;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      setQuery('');
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
    };
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isTabMenuOpen) return;

    const returnFocusTarget = tabMenuButtonRef.current;
    const frame = window.requestAnimationFrame(() => {
      tabMenuRef.current?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
    };
  }, [isTabMenuOpen]);

  function openNavigationSearch() {
    setIsTabMenuOpen(false);
    setActiveUtility(null);
    setIsSearchOpen(true);
  }

  function navigateWithinWorkspace(nextPathname: string) {
    setPendingRoutePathname(nextPathname);
    router.push(nextPathname);
  }

  function closeTab(targetPathname: string) {
    const closingIndex = visibleTabs.findIndex((tab) => tab.pathname === targetPathname);
    const nextTabs = closeInstitutionWorkspaceTabV1(visibleTabs, targetPathname);
    setTabs(nextTabs);

    if (targetPathname !== effectivePathname) return;

    const fallback = visibleTabs[closingIndex - 1]
      ?? visibleTabs[closingIndex + 1]
      ?? nextTabs[0];
    if (fallback) navigateWithinWorkspace(fallback.pathname);
  }

  function closeCurrentTab() {
    if (!currentTab || currentTab.fixed) return;
    closeTab(currentTab.pathname);
    setIsTabMenuOpen(false);
  }

  function closeOtherTabs() {
    setTabs(closeOtherInstitutionWorkspaceTabsV1(visibleTabs, effectivePathname));
    setIsTabMenuOpen(false);
  }

  function closeRightTabs() {
    setTabs(closeRightInstitutionWorkspaceTabsV1(visibleTabs, effectivePathname));
    setIsTabMenuOpen(false);
  }

  function closeAllTabs() {
    const nextTabs = closeAllInstitutionWorkspaceTabsV1(visibleTabs);
    setTabs(nextTabs);
    setIsTabMenuOpen(false);
    if (currentTab && !currentTab.fixed && nextTabs[0]) {
      navigateWithinWorkspace(nextTabs[0].pathname);
    }
  }

  function handleSearchDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;

    const dialog = searchDialogRef.current;
    if (!dialog) return;

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('hidden'));
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <header className="hidden h-[var(--institution-topbar)] items-center justify-between gap-4 border-b border-[var(--institution-line)] bg-white px-6 md:flex">
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          <button type="button" aria-label="折叠侧栏快捷入口" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
            <Menu aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
          <div className="truncate text-[18px] font-bold text-[var(--institution-text)]">机构工作台</div>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-700">
            <span aria-hidden="true" className="grid h-3.5 w-3.5 place-items-center rounded-full border border-blue-500 text-[8px]">✓</span>
            V1.1 APPROVED
          </span>
          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
            当前机构
            <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-500" />
          </button>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" className="hidden h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 xl:inline-flex">
            <Grid2X2 aria-hidden="true" className="h-4 w-4" />
            全产品入口
          </button>
          <button
            ref={searchButtonRef}
            type="button"
            aria-label="打开机构端导航搜索"
            aria-haspopup="dialog"
            aria-expanded={isSearchOpen}
            aria-controls="institution-navigation-search-dialog"
            onClick={openNavigationSearch}
            className="hidden h-9 min-w-[260px] max-w-[390px] flex-1 items-center gap-2 rounded-xl border border-[var(--institution-line)] bg-[var(--institution-bg)] px-3 text-left text-sm text-[var(--institution-muted)] transition hover:border-slate-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35 lg:flex xl:min-w-[320px]"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1">搜索客户、会话、预约、知识、功能...</span>
            <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold">⌘K</span>
          </button>
          <button
            type="button"
            aria-label="打开机构端导航搜索（紧凑）"
            aria-haspopup="dialog"
            aria-expanded={isSearchOpen}
            aria-controls="institution-navigation-search-dialog"
            onClick={openNavigationSearch}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35 lg:hidden"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
          </button>
          <div className="relative flex items-center gap-0.5">
            {([
              ['messages', '消息入口', MessagesSquare],
              ['notifications', '通知入口', Bell],
              ['help', '帮助入口', CircleHelp],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-haspopup="dialog"
                aria-expanded={activeUtility === id}
                onClick={() => setActiveUtility((current) => current === id ? null : id)}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35',
                  activeUtility === id ? 'bg-slate-100 text-blue-700' : '',
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
              </button>
            ))}
            <button
              type="button"
              aria-label="用户菜单"
              aria-haspopup="dialog"
              aria-expanded={activeUtility === 'user'}
              onClick={() => setActiveUtility((current) => current === 'user' ? null : 'user')}
              className={cn(
                'ml-2 flex h-10 items-center gap-2 border-l border-slate-200 pl-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35',
                activeUtility === 'user' ? 'text-blue-700' : 'text-slate-700',
              )}
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-blue-300 to-blue-600 text-sm font-semibold text-white">机</span>
              <span className="hidden min-w-0 2xl:block">
                <span className="block text-sm font-semibold leading-4">机构成员</span>
                <span className="mt-0.5 block text-[10px] text-slate-400">机构管理员</span>
              </span>
              <ChevronRight aria-hidden="true" className="hidden h-4 w-4 2xl:block" />
            </button>
            {activeUtility ? (
              <section
                role="dialog"
                aria-label={
                  activeUtility === 'messages'
                    ? '消息入口状态'
                    : activeUtility === 'notifications'
                      ? '通知入口状态'
                      : activeUtility === 'help'
                        ? '帮助入口'
                        : '用户菜单'
                }
                className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-950/15"
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {activeUtility === 'messages'
                      ? '消息'
                      : activeUtility === 'notifications'
                        ? '通知'
                        : activeUtility === 'help'
                          ? '帮助与支持'
                          : '当前访问身份'}
                  </h2>
                  <button type="button" aria-label="关闭顶部浮层" onClick={() => setActiveUtility(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-4 text-xs leading-5 text-slate-600">
                  {activeUtility === 'messages' ? (
                    <p>统一消息中心 Reader 未开放；这里不会把会话消息解释为系统消息。</p>
                  ) : activeUtility === 'notifications' ? (
                    <p>通知聚合 Reader 未开放；当前不显示模拟未读数。</p>
                  ) : activeUtility === 'help' ? (
                    <div className="space-y-2"><p>快捷键：⌘ / Ctrl + K 打开页面搜索。</p><p>页面异常时请保留当前路由与机构作用域，交由管理员核查 Capability。</p></div>
                  ) : (
                    <div className="space-y-2"><p className="font-semibold text-slate-800">当前机构授权身份</p><p>姓名、手机号和成员标识不会写入 Workspace Storage。</p><p className="text-slate-400">账户与退出登录继续由现有 Auth 边界负责。</p></div>
                  )}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </header>

      <nav
        aria-label="机构端工作区标签"
        className="relative hidden h-[var(--institution-workspace)] items-stretch border-b border-[var(--institution-line)] bg-white pl-3 md:flex"
      >
        <div className="min-w-0 flex-1 overflow-x-auto" data-testid="institution-workspace-scroll-area">
          <div className="flex h-full min-w-max items-stretch gap-1">
            {visibleTabs.map((tab) => {
              const isCurrent = activeSection !== null && tab.pathname === effectivePathname;

              return (
                <div
                  key={tab.pathname}
                  data-object-tab={tab.objectTab ? 'true' : 'false'}
                  className={cn(
                    'group relative flex min-w-[96px] items-center border-x border-t text-sm font-medium',
                    isCurrent
                      ? 'border-[var(--institution-line)] bg-blue-50/60 text-blue-700 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600'
                      : 'border-transparent text-[var(--institution-muted)] hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  <Link
                    href={tab.pathname}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={cn('flex h-full items-center justify-center gap-1.5 pl-4', tab.fixed ? 'pr-4' : 'pr-1')}
                  >
                    <span>{tab.label}</span>
                  </Link>
                  {!tab.fixed ? (
                    <button
                      type="button"
                      aria-label={`关闭${tab.label}标签`}
                      onClick={() => closeTab(tab.pathname)}
                      className="mr-1 grid h-6 w-6 place-items-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative flex h-full shrink-0 items-center gap-1 bg-white px-3">
          <button
            type="button"
            aria-label="快速打开页面"
            title="快速打开 +"
            onClick={openNavigationSearch}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            ref={tabMenuButtonRef}
            type="button"
            aria-label="打开标签管理"
            aria-haspopup="menu"
            aria-expanded={isTabMenuOpen}
            aria-controls="institution-workspace-tab-menu"
            onClick={() => setIsTabMenuOpen((open) => !open)}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {isTabMenuOpen ? (
            <div
              id="institution-workspace-tab-menu"
              ref={tabMenuRef}
              role="menu"
              aria-label="标签管理"
              className="absolute right-2 top-[42px] z-40 w-64 overflow-hidden rounded-xl border border-[var(--institution-line)] bg-white p-2 shadow-xl shadow-slate-950/15"
            >
              <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold text-slate-500">
                完整标签列表
              </div>
              <div className="max-h-48 overflow-y-auto border-b border-[var(--institution-line)] pb-1">
                {visibleTabs.map((tab) => (
                  <Link
                    key={tab.pathname}
                    role="menuitem"
                    href={tab.pathname}
                    aria-current={tab.pathname === effectivePathname ? 'page' : undefined}
                    onClick={() => setIsTabMenuOpen(false)}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <span className="truncate">{tab.label}</span>
                    {tab.fixed ? <span className="text-[10px] text-slate-400">固定</span> : null}
                  </Link>
                ))}
              </div>
              <div className="grid gap-0.5 pt-1">
                <button
                  type="button"
                  role="menuitem"
                  disabled={!currentTab || currentTab.fixed}
                  onClick={closeCurrentTab}
                  className="rounded-lg px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  关闭当前
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!currentTab || visibleTabs.filter((tab) => !tab.fixed && tab.pathname !== currentTab.pathname).length === 0}
                  onClick={closeOtherTabs}
                  className="rounded-lg px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  关闭其他
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={currentTabIndex < 0 || !visibleTabs.slice(currentTabIndex + 1).some((tab) => !tab.fixed)}
                  onClick={closeRightTabs}
                  className="rounded-lg px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  关闭右侧
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!visibleTabs.some((tab) => !tab.fixed)}
                  onClick={closeAllTabs}
                  className="rounded-lg px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  关闭全部
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </nav>

      <main className="mx-auto min-h-[calc(100vh-var(--institution-topbar)-var(--institution-workspace))] w-full max-w-[1800px] px-4 py-5 pb-28 sm:px-5 md:pb-8 lg:px-[26px] lg:py-[22px]">
        {children}
      </main>

      {isSearchOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/35 p-4 pt-[12vh] backdrop-blur-[2px]"
          onClick={() => setIsSearchOpen(false)}
        >
          <section
            id="institution-navigation-search-dialog"
            ref={searchDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="institution-navigation-search-title"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl shadow-slate-950/25"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleSearchDialogKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-[var(--institution-line)] px-4">
              <Command className="h-5 w-5 text-blue-600" />
              <label id="institution-navigation-search-title" className="sr-only" htmlFor="institution-navigation-search-input">
                搜索栏目与页面
              </label>
              <input
                id="institution-navigation-search-input"
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索当前可访问的正式页面"
                className="h-14 min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                aria-label="关闭导航搜索"
                onClick={() => setIsSearchOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              {filteredTargets.length > 0 ? (
                filteredTargets.map((target) => (
                  <Link
                    key={target.pathname}
                    href={target.pathname}
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/35"
                  >
                    <span>{target.label}</span>
                    <span className="text-xs font-normal text-slate-400">
                      {INSTITUTION_NAVIGATION_SECTIONS_V1.find((section) => section.id === target.sectionId)?.label}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="px-3 py-10 text-center text-sm text-slate-500">
                  没有匹配或当前可访问的页面
                </div>
              )}
            </div>
            <div className="border-t border-[var(--institution-line)] bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
              页面目标来自服务端 Capability；点击后仍会重新校验页面与对象权限。
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
