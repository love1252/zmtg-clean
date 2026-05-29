import Image from 'next/image';
import {
  Activity,
  Bell,
  CheckCircle2,
  Command,
  LockKeyhole,
  PlugZap,
  RadioTower,
  ShieldCheck,
} from 'lucide-react';
import { LogoutButton } from '@/modules/auth/components/LogoutButton';
import {
  platformCapabilityCards,
  platformHealthItems,
  platformMetrics,
  platformNavItems,
} from '@/modules/workspace/domain/platform-dashboard';
import { cn } from '@/shared/utils/cn';

const trendBars = [48, 56, 63, 68, 74, 82, 88, 93, 98, 108];

export function PlatformConsole() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#06111f] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(37,99,235,0.28),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.18),transparent_30%),linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:auto,auto,44px_44px,44px_44px]" />
      <div className="relative flex min-h-screen">
        <aside className="hidden w-[286px] shrink-0 border-r border-white/10 bg-[#071322]/88 text-slate-200 shadow-2xl shadow-black/30 backdrop-blur-xl md:flex md:flex-col">
          <div className="flex h-[86px] items-center gap-3 border-b border-white/10 px-5">
            <Image src="/brand/logo-mark.png" alt="" width={50} height={50} className="h-[50px] w-[50px] rounded-xl bg-white object-contain p-1.5" />
            <div>
              <div className="text-base font-semibold tracking-normal text-white">智美天工管理后台</div>
              <div className="mt-0.5 text-xs text-cyan-200/70">Platform Console</div>
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.07] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-200">
                <Command className="h-4 w-4" />
                平台治理模式
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">租户、模型、接口与审计统一在平台侧观测。</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-4">
            {platformNavItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={cn(
                  'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium tracking-normal transition',
                  item.active ? 'bg-blue-500/20 text-cyan-200 ring-1 ring-cyan-300/20' : 'text-slate-300 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="space-y-3 border-t border-white/10 p-5">
            <div className="rounded-2xl border border-emerald-300/14 bg-emerald-300/[0.07] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">全部服务运行正常</div>
                  <div className="mt-1 text-xs text-slate-400">最近检查 1 分钟前</div>
                </div>
                <Activity className="h-5 w-5 text-emerald-300" />
              </div>
            </div>
            <LogoutButton
              redirectTo="/platform-login"
              className="flex h-10 w-full rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white"
            >
              退出
            </LogoutButton>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex min-h-[78px] items-center justify-between border-b border-white/10 bg-[#071322]/72 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Image src="/brand/logo-mark.png" alt="" width={42} height={42} className="h-10 w-10 rounded-xl bg-white object-contain p-1 md:hidden" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white md:text-base">智美天工平台运营中枢</div>
                <div className="mt-0.5 text-xs text-slate-400">租户增长、接口开放、模型成本与安全审计</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <button type="button" aria-label="通知" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-300">
                <Bell className="h-5 w-5" />
              </button>
              <LogoutButton
                redirectTo="/platform-login"
                className="h-10 shrink-0 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold text-slate-300 md:hidden"
              >
                退出平台
              </LogoutButton>
              <span className="hidden items-center gap-2 rounded-full border border-blue-300/20 bg-blue-300/[0.08] px-3 py-1.5 font-semibold text-cyan-100 sm:inline-flex">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-cyan-300/20 text-xs text-cyan-100">超</span>
                超级管理员
              </span>
            </div>
          </header>

          <nav aria-label="平台端移动导航" className="border-b border-white/10 bg-[#071322]/82 px-4 py-3 backdrop-blur-xl md:hidden">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-400">平台导航</span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-2.5 py-1 text-xs font-semibold text-emerald-200">服务正常</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {platformNavItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-label={`移动导航：${item.label}`}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tracking-normal',
                    item.active ? 'border-cyan-300/25 bg-cyan-300/[0.16] text-cyan-100' : 'border-white/10 bg-white/[0.06] text-slate-300',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="mx-auto w-full max-w-[1740px] space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.07] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:p-7">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-4xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] px-3.5 py-1.5 text-xs font-semibold text-cyan-100">
                    <RadioTower className="h-4 w-4" />
                    企业 AI 业务开放平台
                  </div>
                  <h1 className="mt-5 text-[2.15rem] font-semibold leading-[1.12] tracking-normal text-white sm:text-5xl lg:text-[62px]">
                    <span className="block">掌控租户、模型与接口</span>
                    <span className="block bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                      让平台运营可观测
                    </span>
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                    用一张平台总览串联租户增长、Agent 调用、开放连接、计费收入与系统健康状态，先服务运营决策，再承接后续开放平台能力。
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:w-[560px]">
                  {[
                    { icon: PlugZap, label: '开放连接', value: 'API / OAuth / Webhook' },
                    { icon: ShieldCheck, label: '权限审计', value: '可追踪' },
                    { icon: LockKeyhole, label: '安全边界', value: '租户隔离' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                      <item.icon className="h-5 w-5 text-cyan-200" />
                      <div className="mt-3 text-sm font-semibold tracking-normal text-white">{item.value}</div>
                      <div className="mt-1 text-xs text-slate-400">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {platformMetrics.map((metric) => (
                <article key={metric.label} className="rounded-[22px] border border-white/10 bg-white/[0.075] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium text-slate-400">{metric.label}</div>
                    <div className={cn('grid h-10 w-10 place-items-center rounded-2xl', metric.tone)}>
                      <metric.icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 text-3xl font-semibold tracking-normal text-white">{metric.value}</div>
                  <div className="mt-3 text-sm font-semibold text-emerald-300">{metric.change}</div>
                </article>
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
              <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-normal text-white">平台增长与调用趋势</h2>
                    <p className="mt-1 text-sm text-slate-400">同时观察租户数、调用量和收入增长节奏。</p>
                  </div>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1 text-xs font-semibold text-emerald-200">本月 +18.5%</span>
                </div>

                <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                  <div className="h-[300px] rounded-2xl border border-white/10 bg-[#071322]/75 p-4">
                    <svg viewBox="0 0 720 280" className="h-full w-full" role="img" aria-label="平台增长与调用趋势折线图">
                      <defs>
                        <linearGradient id="platformTrendFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[60, 120, 180, 240].map((y) => (
                        <line key={y} x1="24" x2="696" y1={y} y2={y} stroke="rgba(148,163,184,0.18)" strokeWidth="1" />
                      ))}
                      <polygon points="26,206 118,188 210,166 302,146 394,130 486,96 578,78 694,44 694,252 26,252" fill="url(#platformTrendFill)" />
                      <polyline points="26,206 118,188 210,166 302,146 394,130 486,96 578,78 694,44" fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="26,212 118,198 210,176 302,154 394,138 486,112 578,90 694,62" fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#071322]/75 p-4">
                    <div className="text-sm font-semibold text-white">收入趋势</div>
                    <div className="mt-5 flex h-[236px] items-end gap-2">
                      {trendBars.map((height, index) => (
                        <div key={height} className="flex flex-1 flex-col items-center gap-2">
                          <div className="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-cyan-300" style={{ height: `${height * 1.65}px` }} />
                          <span className="text-[11px] text-slate-500">{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>

              <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-normal text-white">系统健康状态</h2>
                    <p className="mt-1 text-sm text-slate-400">平台基础设施与核心服务监控。</p>
                  </div>
                  <span className="rounded-full bg-emerald-300/[0.10] px-3 py-1 text-xs font-semibold text-emerald-200">全部正常</span>
                </div>
                <div className="mt-5 space-y-3">
                  {platformHealthItems.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#071322]/75 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', item.warning ? 'bg-amber-300/[0.12] text-amber-200' : 'bg-emerald-300/[0.12] text-emerald-200')}>
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{item.label}</div>
                          <div className="text-xs text-slate-400">{item.detail}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">{item.value}</div>
                        <div className="text-xs text-slate-500">{item.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {platformCapabilityCards.map((item) => (
                <article key={item.title} className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300/[0.12] text-cyan-200">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold tracking-normal text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
                  <button type="button" className="mt-5 inline-flex h-9 items-center rounded-full border border-white/10 px-3 text-sm font-semibold text-cyan-100 transition hover:bg-white/[0.08]">
                    查看治理清单
                  </button>
                </article>
              ))}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
