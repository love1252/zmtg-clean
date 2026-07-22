'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  BarChart3,
  BookOpenText,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  LayoutDashboard,
  MessagesSquare,
  Settings2,
  UsersRound,
  X,
} from 'lucide-react';
import {
  INSTITUTION_MOBILE_MORE_SECTION_IDS_V1,
  INSTITUTION_MOBILE_NAVIGATION_V1,
  INSTITUTION_NAVIGATION_SECTIONS_V1,
  type InstitutionNavigationSectionIdV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import { cn } from '@/shared/utils/cn';

type InstitutionNavigationShellProps = {
  activeSectionId: InstitutionNavigationSectionIdV1;
  availableSectionIds: readonly InstitutionNavigationSectionIdV1[];
  children: ReactNode;
};

const sectionIcons = {
  workbench: LayoutDashboard,
  customers: UsersRound,
  conversations: MessagesSquare,
  care: CalendarClock,
  knowledge: BookOpenText,
  analytics: BarChart3,
  system: Settings2,
} satisfies Record<InstitutionNavigationSectionIdV1, typeof LayoutDashboard>;

const navigationVisibilityBoundary = '当前仅展示导航入口，不代表已授权或能力已开放';

export function InstitutionNavigationShell({
  activeSectionId,
  availableSectionIds,
  children,
}: InstitutionNavigationShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreDialogRef = useRef<HTMLElement>(null);
  const availableIds = new Set(availableSectionIds);
  const desktopSections = INSTITUTION_NAVIGATION_SECTIONS_V1.filter((section) =>
    availableIds.has(section.id),
  );
  const primaryMobileEntries = INSTITUTION_MOBILE_NAVIGATION_V1.flatMap((entry) => {
    if (entry.id === 'more' || !entry.sectionId || !entry.href) return [];
    if (!availableIds.has(entry.sectionId)) return [];

    return [entry];
  });
  const moreSections = INSTITUTION_MOBILE_MORE_SECTION_IDS_V1.flatMap((sectionId) => {
    if (!availableIds.has(sectionId)) return [];

    const section = INSTITUTION_NAVIGATION_SECTIONS_V1.find((item) => item.id === sectionId);
    return section ? [section] : [];
  });
  const activeSection = INSTITUTION_NAVIGATION_SECTIONS_V1.find(
    (section) => section.id === activeSectionId,
  );

  useEffect(() => {
    if (!isMoreOpen) return;

    const returnFocusTarget = moreButtonRef.current;
    const frame = window.requestAnimationFrame(() => {
      moreDialogRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus();
    });

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setIsMoreOpen(false);
    }

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleEscape);
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus();
    };
  }, [isMoreOpen]);

  function handleMoreDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;

    const dialog = moreDialogRef.current;
    if (!dialog) return;

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
    ).filter((element) => !element.hasAttribute('hidden'));
    const first = focusable.at(0);
    const last = focusable.at(-1);

    if (!first || !last) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="min-h-screen bg-[#eef4fb] text-slate-950">
      <aside
        aria-label="机构端公共侧边栏"
        data-collapsed={isCollapsed ? 'true' : 'false'}
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r border-white/10 bg-[#071522] text-slate-200 shadow-2xl shadow-slate-950/20 transition-[width] duration-200 md:flex',
          isCollapsed ? 'w-[72px]' : 'w-[256px]',
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(39,211,193,0.16),transparent_38%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:auto,32px_32px,32px_32px]" />

        <div
          className={cn(
            'relative flex h-[78px] shrink-0 items-center border-b border-white/10',
            isCollapsed ? 'justify-center px-2' : 'gap-3 px-5',
          )}
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-emerald-400 text-lg font-black text-slate-950 shadow-lg shadow-cyan-500/15">
            智
          </div>
          {!isCollapsed ? (
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-wide text-white">智美天工</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-400">机构运营工作空间</div>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            'relative flex h-12 shrink-0 items-center border-b border-white/10',
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4',
          )}
        >
          {!isCollapsed ? <span className="text-[11px] font-semibold tracking-[0.14em] text-slate-500">机构导航</span> : null}
          <button
            type="button"
            aria-label={isCollapsed ? '展开机构端侧边栏' : '收起机构端侧边栏'}
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((value) => !value)}
            className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav
          aria-label="机构端桌面导航"
          className={cn('relative flex-1 space-y-1 overflow-y-auto py-3', isCollapsed ? 'px-2' : 'px-3')}
        >
          {desktopSections.map((section) => {
            const Icon = sectionIcons[section.id];
            const isActive = section.id === activeSectionId;

            return (
              <Link
                key={section.id}
                href={section.rootPath}
                aria-current={isActive ? 'page' : undefined}
                aria-label={section.label}
                title={isCollapsed ? section.label : undefined}
                className={cn(
                  'flex h-11 items-center rounded-2xl text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50',
                  isCollapsed ? 'justify-center px-0' : 'gap-3 px-3',
                  isActive
                    ? 'bg-cyan-300/14 text-cyan-100 ring-1 ring-cyan-300/20'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white',
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!isCollapsed ? <span className="truncate">{section.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className={cn('relative border-t border-white/10', isCollapsed ? 'p-3' : 'p-4')}>
          <div
            aria-label={navigationVisibilityBoundary}
            className={cn(
              'rounded-2xl bg-white/[0.06] text-slate-400',
              isCollapsed ? 'grid h-10 place-items-center text-xs font-bold' : 'px-3 py-2.5 text-xs leading-5',
            )}
            title={navigationVisibilityBoundary}
          >
            {isCollapsed ? '界' : navigationVisibilityBoundary}
          </div>
        </div>
      </aside>

      <section
        aria-label="机构端公共内容区"
        className={cn(
          'min-h-screen transition-[padding] duration-200',
          isCollapsed ? 'md:pl-[72px]' : 'md:pl-[256px]',
        )}
      >
        <header className="sticky top-0 z-20 border-b border-white/70 bg-white/85 px-4 py-3 shadow-sm shadow-slate-200/50 backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-emerald-400 text-sm font-black text-slate-950">智</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">智美天工</div>
                <div className="truncate text-[11px] text-slate-500">{activeSection?.label ?? '机构端'}</div>
              </div>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">安全边界</span>
          </div>
        </header>

        <main className="mx-auto min-h-screen w-full max-w-[1680px] px-4 py-5 pb-28 sm:px-6 md:pb-8 lg:px-8 lg:py-8">
          {children}
        </main>

        <nav
          aria-label="机构端移动导航"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/94 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden"
        >
          <div className="mx-auto flex max-w-xl items-center justify-around gap-1">
            {primaryMobileEntries.map((entry) => {
              const Icon = sectionIcons[entry.sectionId];
              const isActive = entry.sectionId === activeSectionId;

              return (
                <Link
                  key={entry.id}
                  href={entry.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex min-w-[58px] flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition',
                    isActive ? 'bg-cyan-50 text-cyan-800' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span>{entry.label}</span>
                </Link>
              );
            })}

            {moreSections.length > 0 ? (
              <button
                ref={moreButtonRef}
                type="button"
                aria-label="更多"
                aria-expanded={isMoreOpen}
                aria-controls="institution-mobile-more-dialog"
                aria-haspopup="dialog"
                onClick={() => setIsMoreOpen((value) => !value)}
                className={cn(
                  'flex min-w-[58px] flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition',
                  moreSections.some((section) => section.id === activeSectionId)
                    ? 'bg-cyan-50 text-cyan-800'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <Ellipsis className="h-[18px] w-[18px]" />
                <span>更多</span>
              </button>
            ) : null}
          </div>
        </nav>

        {isMoreOpen && moreSections.length > 0 ? (
          <div
            className="fixed inset-0 z-40 flex items-end bg-slate-950/24 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-[2px] md:hidden"
            onClick={() => setIsMoreOpen(false)}
          >
            <nav
              id="institution-mobile-more-dialog"
              ref={moreDialogRef}
              role="dialog"
              tabIndex={-1}
              aria-modal="true"
              aria-labelledby="institution-mobile-more-title"
              className="mx-auto w-full max-w-xl rounded-[28px] border border-white/80 bg-white p-3 shadow-2xl shadow-slate-950/20"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={handleMoreDialogKeyDown}
            >
              <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-1">
                <div
                  id="institution-mobile-more-title"
                  className="text-xs font-semibold text-slate-500"
                >
                  更多栏目
                </div>
                <button
                  type="button"
                  aria-label="关闭更多栏目"
                  onClick={() => setIsMoreOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-1">
                {moreSections.map((section) => {
                  const Icon = sectionIcons[section.id];

                  return (
                    <Link
                      key={section.id}
                      href={section.rootPath}
                      aria-current={section.id === activeSectionId ? 'page' : undefined}
                      onClick={() => setIsMoreOpen(false)}
                      className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      {section.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>
        ) : null}
      </section>
    </div>
  );
}
