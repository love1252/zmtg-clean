'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Command,
  ExternalLink,
  LockKeyhole,
  PlugZap,
  RadioTower,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { LogoutButton } from '@/modules/auth/components/LogoutButton';
import { AiQuotaBoundaryPanel } from '@/modules/open-platform/components/AiQuotaBoundaryPanel';
import { CommercialBoundaryPanel } from '@/modules/open-platform/components/CommercialBoundaryPanel';
import { HomepageBrandPanel } from '@/modules/open-platform/components/HomepageBrandPanel';
import { OpenConnectionRoadmapPanel } from '@/modules/open-platform/components/OpenConnectionRoadmapPanel';
import { OpenPlatformAiReadonlyPanel } from '@/modules/open-platform/components/OpenPlatformAiReadonlyPanel';
import { OpenPlatformAuditEventsPanel } from '@/modules/open-platform/components/OpenPlatformAuditEventsPanel';
import { OpenPlatformGovernancePanel } from '@/modules/open-platform/components/OpenPlatformGovernancePanel';
import { OpenPlatformKnowledgeManagementPanel } from '@/modules/open-platform/components/OpenPlatformKnowledgeManagementPanel';
import { OpenPlatformTenantManagementPanel } from '@/modules/open-platform/components/OpenPlatformTenantManagementPanel';
import { ProductPlanPanel } from '@/modules/open-platform/components/ProductPlanPanel';
import {
  platformAlertItems,
  platformCapabilityCards,
  platformHealthItems,
  platformMetrics,
  platformNavItems,
  platformQuickActions,
  platformSystemHealthItems,
  platformTrendSummary,
  type PlatformAlertItem,
  type PlatformSystemHealthItem,
} from '@/modules/workspace/domain/platform-dashboard';
import { cn } from '@/shared/utils/cn';

const trendBars = [48, 56, 63, 68, 74, 82, 88, 93, 98, 108];

const alertIconMap: Record<PlatformAlertItem['level'], typeof AlertTriangle> = {
  error: AlertTriangle,
  warning: Clock,
  info: Bell,
};

const alertToneMap: Record<PlatformAlertItem['level'], string> = {
  error: 'border-rose-300/20 bg-rose-300/[0.10] text-rose-100',
  warning: 'border-amber-300/20 bg-amber-300/[0.10] text-amber-100',
  info: 'border-cyan-300/20 bg-cyan-300/[0.10] text-cyan-100',
};

const systemHealthTone = {
  healthy: { badge: 'border-emerald-300/20 bg-emerald-300/[0.10] text-emerald-100', dot: 'bg-emerald-400', label: '正常' },
  warning: { badge: 'border-amber-300/20 bg-amber-300/[0.10] text-amber-100', dot: 'bg-amber-400', label: '警告' },
  offline: { badge: 'border-slate-300/20 bg-slate-300/[0.06] text-slate-400', dot: 'bg-slate-500', label: '未启用' },
} as const;

export function PlatformConsole() {
  const [activeNavLabel, setActiveNavLabel] = useState('平台总览');

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#06111f] text-white">
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
              <p className="mt-2 text-sm leading-6 text-slate-400">租户、套餐、配额、商业化健康与审计统一在平台侧观测。</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-4">
            {platformNavItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setActiveNavLabel(item.label)}
                className={cn(
                  'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium tracking-normal transition',
                  activeNavLabel === item.label ? 'bg-blue-500/20 text-cyan-200 ring-1 ring-cyan-300/20' : 'text-slate-300 hover:bg-white/[0.08] hover:text-white',
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
                <div className="mt-0.5 text-xs text-slate-400">租户、套餐、配额与安全审计</div>
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
                  onClick={() => setActiveNavLabel(item.label)}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tracking-normal',
                    activeNavLabel === item.label ? 'border-cyan-300/25 bg-cyan-300/[0.16] text-cyan-100' : 'border-white/10 bg-white/[0.06] text-slate-300',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          <div className="mx-auto w-full max-w-[1740px] space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {activeNavLabel === '首页与品牌' ? (
              <HomepageBrandPanel />
            ) : activeNavLabel === '租户管理' ? (
              <OpenPlatformTenantManagementPanel />
            ) : activeNavLabel === '产品与套餐' ? (
              <ProductPlanPanel />
            ) : activeNavLabel === 'AI 配额边界' ? (
              <AiQuotaBoundaryPanel />
            ) : activeNavLabel === 'AI 模型与用量' ? (
              <OpenPlatformAiReadonlyPanel />
            ) : activeNavLabel === '知识库管理' ? (
              <OpenPlatformKnowledgeManagementPanel />
            ) : activeNavLabel === '开放连接路线' ? (
              <OpenConnectionRoadmapPanel />
            ) : activeNavLabel === '商业化边界' ? (
              <CommercialBoundaryPanel />
            ) : activeNavLabel === '权限与审计' ? (
              <>
                <OpenPlatformAuditEventsPanel />
                <OpenPlatformGovernancePanel />
              </>
            ) : (
              <>
                <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.07] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:p-7">
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-4xl">
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] px-3.5 py-1.5 text-xs font-semibold text-cyan-100">
                        <RadioTower className="h-4 w-4" />
                        平台收尾治理视图
                      </div>
                      <h1 className="mt-5 text-[2.15rem] font-semibold leading-[1.12] tracking-normal text-white sm:text-5xl lg:text-[62px]">
                        <span className="block">掌控租户、套餐与配额</span>
                        <span className="block bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                          让平台治理可复盘
                        </span>
                      </h1>
                      <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                        当前收尾页只展示受控 demo 租户、套餐、配额快照、商业化健康和平台审计；开放连接、AI、计费属于后续路线，当前未启用。
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 xl:w-[560px]">
                      {[
                        { icon: PlugZap, label: '开放连接', value: '长期路线' },
                        { icon: ShieldCheck, label: '权限审计', value: '可追踪' },
                        { icon: LockKeyhole, label: 'AI 配额', value: '0 / 0' },
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

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

                <section className="grid gap-5 xl:grid-cols-[1.3fr_1.05fr_0.75fr]">
                  <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold tracking-normal text-white">平台收尾健康概览</h2>
                        <p className="mt-1 text-sm text-slate-400">围绕租户、套餐、配额和审计做演示收尾。</p>
                      </div>
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1 text-xs font-semibold text-emerald-200">受控 demo</span>
                    </div>

                    <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
                      <div className="h-[300px] rounded-2xl border border-white/10 bg-[#071322]/75 p-4">
                        <svg viewBox="0 0 720 280" className="h-full w-full" role="img" aria-label={platformTrendSummary.tenantGrowthLabel}>
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
                        <div className="text-sm font-semibold text-white">配额使用参考</div>
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
                        <h2 className="text-lg font-semibold tracking-normal text-white">演示视图状态</h2>
                        <p className="mt-1 text-sm text-slate-400">标注当前可演示能力和后续路线边界。</p>
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

                  <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold tracking-normal text-white">快捷操作</h2>
                        <p className="mt-1 text-sm text-slate-400">常用平台治理入口。</p>
                      </div>
                    </div>
                    <div className="mt-5 space-y-2">
                      {platformQuickActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => setActiveNavLabel(action.hint)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#071322]/75 px-4 py-3 text-left transition hover:bg-white/[0.06]"
                        >
                          <div className="flex items-center gap-3">
                            <action.icon className="h-4 w-4 text-cyan-200" />
                            <span className="text-sm font-semibold text-white">{action.label}</span>
                          </div>
                          <ExternalLink className="h-4 w-4 text-slate-500" />
                        </button>
                      ))}
                    </div>
                  </article>
                </section>

                <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
                  <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold tracking-normal text-white">系统健康状态</h2>
                        <p className="mt-1 text-sm text-slate-400">演示环境核心服务状态，仅供参考。</p>
                      </div>
                      <span className="rounded-full border border-blue-300/20 bg-blue-300/[0.08] px-3 py-1 text-xs font-semibold text-blue-200">只读监控</span>
                    </div>

                    <div className="mt-5 space-y-3">
                      {platformSystemHealthItems.map((item) => {
                        const tone = systemHealthTone[item.status];
                        return (
                          <div key={item.key} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#071322]/75 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className={cn('h-2.5 w-2.5 rounded-full', tone.dot)} />
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white">{item.name}</div>
                                <div className="text-xs text-slate-400">
                                  {item.status === 'offline'
                                    ? item.capacityHint
                                    : `延迟 ${item.latencyMs}ms · 可用率 ${item.uptimePercent}%`}
                                </div>
                              </div>
                            </div>
                            <span className={cn('shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold', tone.badge)}>
                              {tone.label}
                              {item.status === 'warning' && item.capacityHint ? ` · ${item.capacityHint}` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </article>

                  <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold tracking-normal text-white">预警与待办</h2>
                        <p className="mt-1 text-sm text-slate-400">平台治理信号摘要，均为占位模拟数据。</p>
                      </div>
                      <span className="rounded-full border border-slate-400/20 bg-slate-400/[0.08] px-3 py-1 text-xs font-semibold text-slate-300">
                        {platformAlertItems.length} 项
                      </span>
                    </div>

                    <div className="mt-5 space-y-2">
                      {platformAlertItems.map((alert) => {
                        const Icon = alertIconMap[alert.level];
                        return (
                          <div key={alert.id} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#071322]/75 px-4 py-3">
                            <div className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl', alertToneMap[alert.level])}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <h4 className="truncate text-sm font-semibold text-white">{alert.label}</h4>
                                <span className="shrink-0 text-xs text-slate-500">{alert.timeAgo}</span>
                              </div>
                              <p className="mt-1 text-sm leading-5 text-slate-400">{alert.detail}</p>
                            </div>
                          </div>
                        );
                      })}
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

                <OpenPlatformGovernancePanel />
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
