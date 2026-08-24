'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock3,
  Database,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { cn } from '@/shared/utils/cn';

export type InstitutionCapabilityVisualStateV11 =
  | 'LIVE'
  | 'READ_ONLY'
  | 'CAPABILITY_OFF'
  | 'EXTERNAL_CONTRACT_REQUIRED'
  | 'NOT_CONFIGURED';

const capabilityStateLabels: Readonly<Record<InstitutionCapabilityVisualStateV11, string>> = {
  LIVE: '正式能力已开放',
  READ_ONLY: '正式只读',
  CAPABILITY_OFF: '能力未开放',
  EXTERNAL_CONTRACT_REQUIRED: '等待外部契约',
  NOT_CONFIGURED: '机构尚未配置',
};

export function InstitutionV11PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
  state,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  breadcrumbs: readonly Readonly<{ label: string; href?: string }>[];
  actions?: ReactNode;
  state: InstitutionCapabilityVisualStateV11;
}>) {
  return (
    <header className="space-y-3">
      <nav aria-label="面包屑" className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        {breadcrumbs.map((item, index) => (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 ? <span aria-hidden="true" className="text-slate-300">/</span> : null}
            {item.href ? (
              <Link className="rounded hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40" href={item.href}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-blue-700">{eyebrow}</p>
            <InstitutionV11StatusPill state={state} />
          </div>
          <h1 className="mt-1.5 text-[24px] font-bold leading-8 tracking-tight text-slate-950">{title}</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function InstitutionV11StatusPill({
  state,
}: Readonly<{ state: InstitutionCapabilityVisualStateV11 }>) {
  const positive = state === 'LIVE' || state === 'READ_ONLY';
  return (
    <span
      data-capability-state={state}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        positive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : state === 'NOT_CONFIGURED'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-slate-200 bg-slate-100 text-slate-600',
      )}
    >
      {positive ? <ShieldCheck aria-hidden="true" className="h-3 w-3" /> : <LockKeyhole aria-hidden="true" className="h-3 w-3" />}
      {capabilityStateLabels[state]}
    </span>
  );
}

export function InstitutionV11Button({
  children,
  icon: Icon,
  tone = 'secondary',
  disabled = false,
  disabledReason,
  onClick,
  type = 'button',
}: Readonly<{
  children: ReactNode;
  icon?: LucideIcon;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
}>) {
  return (
    <button
      type={type}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-describedby={disabled && disabledReason ? undefined : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400',
        tone === 'primary'
          ? 'border-blue-700 bg-blue-700 text-white hover:border-blue-800 hover:bg-blue-800'
          : tone === 'danger'
            ? 'border-red-200 bg-white text-red-700 hover:bg-red-50'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function InstitutionV11CapabilityBanner({
  title,
  description,
  state,
  source,
}: Readonly<{
  title: string;
  description: string;
  state: InstitutionCapabilityVisualStateV11;
  source: string;
}>) {
  return (
    <section
      aria-label="能力状态"
      className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/75 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-200 bg-white text-amber-700">
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <InstitutionV11StatusPill state={state} />
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 md:justify-end">
        <Database aria-hidden="true" className="h-3.5 w-3.5" />
        <span>数据来源：{source}</span>
      </div>
    </section>
  );
}

export function InstitutionV11Tabs({
  label,
  items,
  activeId,
  onChange,
}: Readonly<{
  label: string;
  items: readonly Readonly<{ id: string; label: string; disabled?: boolean; reason?: string }>[];
  activeId: string;
  onChange: (id: string) => void;
}>) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const enabled = items.filter((item) => !item.disabled);
    const currentIndex = enabled.findIndex((item) => item.id === activeId);
    if (currentIndex < 0 || enabled.length === 0) return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = enabled[(currentIndex + delta + enabled.length) % enabled.length];
    if (next) onChange(next.id);
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className="flex min-w-max items-center gap-1 border-b border-slate-200 px-1"
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            title={item.disabled ? item.reason : undefined}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative h-10 px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500/35 disabled:cursor-not-allowed disabled:text-slate-300',
              active ? 'text-blue-700' : 'text-slate-600 hover:text-slate-950',
            )}
          >
            {item.label}
            {active ? <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-600" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function InstitutionV11Surface({
  title,
  description,
  action,
  children,
  className,
}: Readonly<{
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={cn('rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50', className)}>
      {title || description || action ? (
        <header className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] font-semibold text-slate-950">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function InstitutionV11UnavailableValue({
  label,
  source,
  icon: Icon = CircleHelp,
}: Readonly<{
  label: string;
  source: string;
  icon?: LucideIcon;
}>) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/40">
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">不可用</span>
      </div>
      <h3 className="mt-3 text-xs font-medium text-slate-600">{label}</h3>
      <p className="mt-1 text-lg font-bold tracking-tight text-slate-400">未开放</p>
      <p className="mt-1.5 truncate text-[11px] text-slate-400">来源：{source}</p>
    </article>
  );
}

export function InstitutionV11EmptyState({
  title,
  description,
  icon: Icon = Database,
}: Readonly<{ title: string; description: string; icon?: LucideIcon }>) {
  return (
    <div className="grid min-h-52 place-items-center px-6 py-10 text-center">
      <div>
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export function InstitutionV11Drawer({
  open,
  title,
  description,
  onClose,
  children,
  footer,
}: Readonly<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}>) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
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
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/35 backdrop-blur-[1px]" onMouseDown={onClose}>
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-[540px] flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/25"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
          </div>
          <button ref={closeRef} type="button" aria-label={`关闭${title}`} onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function InstitutionV11DateRangeControl({
  label = '近 30 天',
  disabled = false,
  disabledReason,
}: Readonly<{ label?: string; disabled?: boolean; disabledReason?: string }>) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? disabledReason : '选择日期范围'}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    >
      <CalendarDays aria-hidden="true" className="h-4 w-4" />
      {label}
      <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
    </button>
  );
}

export function InstitutionV11Freshness({
  observedAt,
  source,
}: Readonly<{ observedAt: string | null; source: string }>) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <Database aria-hidden="true" className="h-3.5 w-3.5" />
        数据来源：{source}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
        更新时间：{observedAt ?? '未获得可信时间'}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
        当前不执行后台刷新
      </span>
    </div>
  );
}
