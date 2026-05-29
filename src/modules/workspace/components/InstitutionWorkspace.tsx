'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  Search,
  Sparkles,
} from 'lucide-react';
import { LogoutButton } from '@/modules/auth/components/LogoutButton';
import { AppointmentCenterShell } from '@/modules/institution/components/AppointmentCenterShell';
import { CustomerCenterShell } from '@/modules/institution/components/CustomerCenterShell';
import { SmartFollowUpShell } from '@/modules/institution/components/SmartFollowUpShell';
import {
  institutionActionQueue,
  institutionJourneyLanes,
  institutionNavItems,
  institutionStats,
  institutionSuggestions,
} from '@/modules/workspace/domain/institution-dashboard';
import type { InstitutionViewId } from '@/modules/workspace/domain/institution-dashboard';
import { cn } from '@/shared/utils/cn';

const statToneClasses = {
  blue: 'border-blue-200/80 bg-blue-50/80 text-blue-700',
  violet: 'border-violet-200/80 bg-violet-50/80 text-violet-700',
  emerald: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-700',
  amber: 'border-amber-200/80 bg-amber-50/80 text-amber-700',
};

const suggestionToneClasses = {
  复购: 'border-rose-200/80 bg-rose-50 text-rose-600',
  转化: 'border-amber-200/80 bg-amber-50 text-amber-600',
  服务: 'border-sky-200/80 bg-sky-50 text-sky-600',
};

export function InstitutionWorkspace() {
  const [activeView, setActiveView] = useState<InstitutionViewId>('dashboard');
  const activeNavItem = institutionNavItems.find((item) => item.id === activeView) ?? institutionNavItems[0];

  return (
    <main
      className="min-h-screen bg-[#eef4fb] bg-cover bg-center text-slate-950"
      style={{
        backgroundImage:
          'linear-gradient(110deg, rgba(247,250,255,0.94) 0%, rgba(244,249,255,0.9) 46%, rgba(232,244,251,0.82) 100%), url("/homepage/zmtg-luxury-clinic-bg.png")',
      }}
    >
      <div className="flex min-h-screen">
        <aside className="hidden w-[276px] shrink-0 flex-col border-r border-white/12 bg-[#071322]/95 text-slate-200 shadow-2xl shadow-slate-950/20 md:flex">
          <div className="absolute inset-y-0 left-0 hidden w-[276px] bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:36px_36px] md:block" />
          <div className="relative flex h-[84px] items-center gap-3 border-b border-white/10 px-5">
            <Image src="/brand/logo-mark.png" alt="" width={50} height={50} className="h-[50px] w-[50px] rounded-xl bg-white object-contain p-1.5" />
            <div>
              <div className="text-lg font-semibold tracking-normal text-white">智美天工</div>
              <div className="mt-0.5 text-xs text-slate-400">医美智能运营系统</div>
            </div>
          </div>

          <div className="relative px-5 py-5">
            <label className="relative block" aria-label="搜索功能">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="h-10 w-full rounded-xl border border-white/10 bg-white/8 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-300/70"
                placeholder="搜索功能..."
              />
            </label>
          </div>

          <nav className="relative flex-1 space-y-1 overflow-y-auto px-4">
            {institutionNavItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setActiveView(item.id)}
                aria-current={activeView === item.id ? 'page' : undefined}
                className={cn(
                  'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium tracking-normal transition',
                  activeView === item.id ? 'bg-blue-500/20 text-cyan-200 ring-1 ring-cyan-300/20' : 'text-slate-300 hover:bg-white/8 hover:text-white',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="relative space-y-3 border-t border-white/10 p-5">
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">今日高意向客户 18 位</div>
                  <div className="mt-1 text-xs text-slate-400">AI 已按承接优先级排序</div>
                </div>
                <Bell className="h-5 w-5 text-cyan-300" />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-3 py-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-cyan-400/16 text-sm font-semibold text-cyan-200">管</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">系统管理员</div>
                <div className="text-xs text-slate-400">机构运营账号</div>
              </div>
            </div>
            <LogoutButton
              redirectTo="/login"
              className="flex h-10 w-full rounded-xl text-sm font-semibold text-rose-200 hover:bg-rose-500/10"
            />
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-hidden">
          <nav aria-label="机构端移动导航" className="sticky top-0 z-20 border-b border-white/70 bg-white/84 px-4 py-3 shadow-sm shadow-slate-200/50 backdrop-blur-xl md:hidden">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-500">机构导航</span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">今日高意向 18</span>
                <LogoutButton
                  redirectTo="/login"
                  className="h-8 shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-600"
                >
                  退出工作台
                </LogoutButton>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {institutionNavItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-label={`移动导航：${item.label}`}
                  onClick={() => setActiveView(item.id)}
                  aria-current={activeView === item.id ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tracking-normal',
                    activeView === item.id ? 'border-blue-200 bg-blue-600 text-white shadow-sm shadow-blue-500/20' : 'border-slate-200 bg-white/76 text-slate-600',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="mx-auto w-full max-w-[1740px] space-y-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-7">
            {activeView === 'dashboard' ? (
              <>
            <header className="overflow-hidden rounded-[28px] border border-white/80 bg-white/72 p-5 shadow-[0_24px_80px_rgba(32,61,104,0.12)] backdrop-blur-xl lg:p-7">
              <div className="flex flex-col gap-6 2xl:flex-row 2xl:items-start 2xl:justify-between">
                <div className="max-w-4xl">
                  <div className="flex items-center gap-3 md:hidden">
                    <Image src="/brand/logo-mark.png" alt="" width={46} height={46} className="h-11 w-11 rounded-xl bg-white object-contain p-1" />
                    <div>
                      <div className="font-semibold tracking-normal text-slate-950">智美天工</div>
                      <div className="text-xs text-slate-500">机构工作台</div>
                    </div>
                  </div>
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-cyan-50/80 px-3.5 py-1.5 text-xs font-semibold text-cyan-700 md:mt-0">
                    <Sparkles className="h-4 w-4" />
                    AI 驱动的医美增长中台
                  </div>
                  <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl lg:text-[60px] xl:text-[64px]">
                    <span className="block">让咨询团队</span>
                    <span className="block whitespace-nowrap bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
                      先看到增长机会
                    </span>
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                    把客户画像、预约转化、术后关怀和复购召回放到同一张经营地图里，让机构运营每天先处理最值得处理的客户。
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3 2xl:w-[520px]">
                  {[
                    { label: '数据安全保障', value: '租户隔离' },
                    { label: 'SLA 服务承诺', value: '99.9%' },
                    { label: 'AI 在线', value: '24/7' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/80 bg-white/70 p-3 shadow-sm sm:p-4">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 sm:h-5 sm:w-5" />
                      <div className="mt-2 text-sm font-semibold tracking-normal text-slate-950 sm:mt-3 sm:text-lg">{item.value}</div>
                      <div className="mt-1 text-[11px] leading-4 text-slate-500 sm:text-xs">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </header>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {institutionStats.map((stat) => (
                <article key={stat.label} className="rounded-[22px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div className={cn('grid h-12 w-12 place-items-center rounded-2xl border', statToneClasses[stat.tone])}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                      {stat.change}
                    </span>
                  </div>
                  <div className="mt-5 text-4xl font-semibold tracking-normal text-slate-950">{stat.value}</div>
                  <div className="mt-1 text-sm font-medium text-slate-500">{stat.label}</div>
                </article>
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold tracking-normal text-slate-950">AI 经营副驾驶建议</h2>
                      <p className="mt-1 text-sm text-slate-500">按转化概率、服务风险和复购窗口自动排序。</p>
                    </div>
                  </div>
                  <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                    查看全部
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  {institutionSuggestions.map((suggestion) => (
                    <article key={suggestion.title} className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
                      <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', suggestionToneClasses[suggestion.type])}>
                        {suggestion.type}
                      </span>
                      <h3 className="mt-3 text-base font-semibold tracking-normal text-slate-950">{suggestion.title}</h3>
                      <p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-500">{suggestion.description}</p>
                      <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
                        {suggestion.action}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </article>
                  ))}
                </div>
              </article>

              <article className="rounded-[24px] border border-slate-900/90 bg-[#071322] p-5 text-white shadow-[0_24px_80px_rgba(3,15,33,0.22)] lg:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-normal">今日行动队列</h2>
                    <p className="mt-1 text-sm text-slate-400">AI 评分越高，越建议优先人工承接。</p>
                  </div>
                  <Activity className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="mt-5 space-y-3">
                  {institutionActionQueue.map((item, index) => (
                    <div key={item.name} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-400/16 text-xs font-semibold text-cyan-200">
                              {index + 1}
                            </span>
                            <span className="truncate text-sm font-semibold text-white">{item.name}</span>
                          </div>
                          <div className="mt-2 text-sm font-medium text-slate-200">{item.title}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</div>
                        </div>
                        <div className="rounded-full bg-cyan-300/14 px-2.5 py-1 text-sm font-semibold text-cyan-200">{item.score}</div>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500" style={{ width: `${item.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
              <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-normal text-slate-950">客户旅程看板</h2>
                    <p className="mt-1 text-sm text-slate-500">从咨询到复购，把关键节点压到一屏可判断。</p>
                  </div>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">实时同步</span>
                </div>
                <div className="mt-5 grid gap-3 lg:grid-cols-4">
                  {institutionJourneyLanes.map((lane) => (
                    <section key={lane.title} className="rounded-2xl border border-slate-200/80 bg-white/84 p-4">
                      <h3 className="text-sm font-semibold tracking-normal text-slate-950">{lane.title}</h3>
                      <div className="mt-4 space-y-3">
                        {lane.items.map((item) => (
                          <div key={item.title} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                              {item.hot && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-500">高优</span>}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </article>

              <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold tracking-normal text-slate-950">触达趋势</h2>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">本周 +18%</span>
                </div>
                <div className="mt-5 h-[280px] rounded-2xl border border-slate-200/80 bg-[linear-gradient(#e7eef7_1px,transparent_1px),linear-gradient(90deg,#e7eef7_1px,transparent_1px)] bg-[length:25%_25%] p-3">
                  <svg viewBox="0 0 420 250" className="h-full w-full" role="img" aria-label="触达趋势折线图">
                    <defs>
                      <linearGradient id="institutionTrendFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon points="18,178 82,154 145,138 208,116 272,126 338,74 402,88 402,232 18,232" fill="url(#institutionTrendFill)" />
                    <polyline points="18,178 82,154 145,138 208,116 272,126 338,74 402,88" fill="none" stroke="#0ea5e9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </article>
            </section>
              </>
            ) : activeView === 'customers' ? (
              <CustomerCenterShell />
            ) : activeView === 'appointments' ? (
              <AppointmentCenterShell />
            ) : activeView === 'followups' ? (
              <SmartFollowUpShell />
            ) : (
              <PlaceholderInstitutionView label={activeNavItem.label} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function PlaceholderInstitutionView({ label }: { label: string }) {
  return (
    <section className="rounded-[24px] border border-white/80 bg-white/78 p-6 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
      <p className="text-sm font-semibold text-slate-500">Module placeholder</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">{label}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
        该模块会在后续阶段接入真实业务壳。本阶段优先完成客户中心、预约中心和智能随访。
      </p>
    </section>
  );
}
