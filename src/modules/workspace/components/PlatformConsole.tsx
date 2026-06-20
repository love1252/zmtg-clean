'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Clock,
  Command,
  ExternalLink,
  LockKeyhole,
  PlugZap,
  RadioTower,
  TrendingUp,
} from 'lucide-react';
import { LogoutButton } from '@/modules/auth/components/LogoutButton';
import { CommercialBoundaryPanel } from '@/modules/open-platform/components/CommercialBoundaryPanel';
import { HomepageBrandPanel } from '@/modules/open-platform/components/HomepageBrandPanel';
import { OpenConnectionRoadmapPanel } from '@/modules/open-platform/components/OpenConnectionRoadmapPanel';
import { OpenPlatformAiModelConfigPanel } from '@/modules/open-platform/components/OpenPlatformAiModelConfigPanel';
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
  const isAiUsageView = activeNavLabel === 'AI用量与费用';
  const isLightPlatformView = isAiUsageView || activeNavLabel === 'AI模型配置';

  return (
    <main className={cn('min-h-screen overflow-x-hidden', isLightPlatformView ? 'bg-[#f7f9fc] text-slate-950' : 'bg-[#06111f] text-white')}>
      {!isLightPlatformView ? (
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(37,99,235,0.28),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.18),transparent_30%),linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:auto,auto,44px_44px,44px_44px]" />
      ) : null}
      <div className="relative flex min-h-screen">
        <aside className={cn(
          'hidden shrink-0 border-r md:flex md:flex-col',
          isLightPlatformView
            ? 'w-[228px] border-[#e6edf5] bg-white text-[#1f2937]'
            : 'w-[286px] border-white/10 bg-[#071322]/88 text-slate-200 shadow-2xl shadow-black/30 backdrop-blur-xl',
        )}>
          <div className={cn('flex items-center gap-3 border-b px-5', isLightPlatformView ? 'h-[70px] border-[#e6edf5]' : 'h-[86px] border-white/10')}>
            <Image src="/brand/logo-mark.png" alt="" width={50} height={50} className={cn('rounded-xl bg-white object-contain', isLightPlatformView ? 'h-10 w-10 p-1' : 'h-[50px] w-[50px] p-1.5')} />
            <div>
              <div className={cn('text-base font-semibold tracking-normal', isLightPlatformView ? 'text-[#1f2937]' : 'text-white')}>智美天工管理后台</div>
              <div className={cn('mt-0.5 text-xs', isLightPlatformView ? 'text-[#64748b]' : 'text-cyan-200/70')}>Platform Console</div>
            </div>
          </div>

          {isLightPlatformView ? (
            <div className="flex h-[58px] items-center justify-between border-b border-[#e6edf5] px-6 text-sm text-[#64748b]">
              <span>平台菜单</span>
              <Command className="h-4 w-4" />
            </div>
          ) : (
            <div className="px-5 py-5">
              <div className="rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.07] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-200">
                  <Command className="h-4 w-4" />
                  平台治理模式
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">租户、套餐、配额、商业化健康与审计统一在平台侧观测。</p>
              </div>
            </div>
          )}

          <nav className={cn('flex-1 space-y-1 overflow-y-auto', isLightPlatformView ? 'px-4 py-4' : 'px-4')}>
            {platformNavItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setActiveNavLabel(item.label)}
                className={cn(
                  'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium tracking-normal transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#bfdbfe]',
                  isLightPlatformView
                    ? activeNavLabel === item.label
                      ? 'bg-[#eaf3ff] text-[#2563eb]'
                      : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1f2937]'
                    : activeNavLabel === item.label
                      ? 'bg-blue-500/20 text-cyan-200 ring-1 ring-cyan-300/20'
                      : 'text-slate-300 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className={cn('space-y-3 border-t p-5', isLightPlatformView ? 'border-[#e6edf5]' : 'border-white/10')}>
            {!isLightPlatformView ? (
            <div className="rounded-2xl border border-emerald-300/14 bg-emerald-300/[0.07] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">全部服务运行正常</div>
                  <div className="mt-1 text-xs text-slate-400">最近检查 1 分钟前</div>
                </div>
                <Activity className="h-5 w-5 text-emerald-300" />
              </div>
            </div>
            ) : null}
            <LogoutButton
              redirectTo="/platform-login"
              className={cn(
                'flex h-10 w-full rounded-xl text-sm font-semibold',
                isLightPlatformView ? 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1f2937]' : 'text-slate-300 hover:bg-white/[0.08] hover:text-white',
              )}
            >
              退出
            </LogoutButton>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className={cn(
            'flex items-center justify-between border-b px-4 sm:px-6 lg:px-8',
            isLightPlatformView
              ? 'min-h-[70px] border-[#e6edf5] bg-white'
              : 'min-h-[78px] border-white/10 bg-[#071322]/72 backdrop-blur-xl',
          )}>
            <div className="flex min-w-0 items-center gap-3">
              <Image src="/brand/logo-mark.png" alt="" width={42} height={42} className={cn('h-10 w-10 rounded-xl bg-white object-contain p-1 md:hidden', isLightPlatformView ? 'border border-[#e6edf5]' : '')} />
              <div className="min-w-0">
                <div className={cn('truncate text-sm font-semibold md:text-base', isLightPlatformView ? 'text-transparent md:hidden' : 'text-white')}>智美天工平台运营中枢</div>
                <div className={cn('mt-0.5 text-xs', isLightPlatformView ? 'text-transparent md:hidden' : 'text-slate-400')}>租户、套餐、配额与安全审计</div>
              </div>
            </div>
            <div className={cn('flex items-center gap-3 text-sm', isLightPlatformView ? 'text-[#64748b]' : 'text-slate-300')}>
              <button
                type="button"
                aria-label="通知"
                className={cn(
                  'relative grid h-10 w-10 place-items-center rounded-xl border',
                  isLightPlatformView ? 'border-transparent bg-white text-[#64748b]' : 'border-white/10 bg-white/[0.06] text-slate-300',
                )}
              >
                <Bell className="h-5 w-5" />
                {isLightPlatformView ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" /> : null}
              </button>
              <LogoutButton
                redirectTo="/platform-login"
                className={cn(
                  'h-10 shrink-0 rounded-xl border px-3 text-xs font-semibold md:hidden',
                  isLightPlatformView ? 'border-[#e6edf5] bg-white text-[#64748b]' : 'border-white/10 bg-white/[0.06] text-slate-300',
                )}
              >
                退出平台
              </LogoutButton>
              <span className={cn(
                'hidden items-center gap-2 rounded-full border px-3 py-1.5 font-semibold sm:inline-flex',
                isLightPlatformView ? 'border-transparent bg-white text-[#1f2937]' : 'border-blue-300/20 bg-blue-300/[0.08] text-cyan-100',
              )}>
                <span className={cn('grid h-6 w-6 place-items-center rounded-full text-xs', isLightPlatformView ? 'bg-[#eaf3ff] text-[#2563eb]' : 'bg-cyan-300/20 text-cyan-100')}>超</span>
                超级管理员
              </span>
            </div>
          </header>

          <nav aria-label="平台端移动导航" className={cn('border-b px-4 py-3 md:hidden', isLightPlatformView ? 'border-[#e6edf5] bg-white' : 'border-white/10 bg-[#071322]/82 backdrop-blur-xl')}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className={cn('text-xs font-semibold', isLightPlatformView ? 'text-[#64748b]' : 'text-slate-400')}>平台导航</span>
              <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', isLightPlatformView ? 'border-[#e6edf5] bg-[#f8fafc] text-[#64748b]' : 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200')}>服务正常</span>
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
                    isLightPlatformView
                      ? activeNavLabel === item.label
                        ? 'border-[#bfdbfe] bg-[#eaf3ff] text-[#2563eb]'
                        : 'border-[#e6edf5] bg-white text-[#64748b]'
                      : activeNavLabel === item.label
                        ? 'border-cyan-300/25 bg-cyan-300/[0.16] text-cyan-100'
                        : 'border-white/10 bg-white/[0.06] text-slate-300',
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          <div className={cn(
            'mx-auto w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7',
            isLightPlatformView ? 'max-w-none bg-[#f7f9fc]' : 'max-w-[1740px]',
          )}>
            {activeNavLabel === '首页与品牌' ? (
              <HomepageBrandPanel />
            ) : activeNavLabel === '租户管理' ? (
              <OpenPlatformTenantManagementPanel />
            ) : activeNavLabel === '产品与套餐' ? (
              <ProductPlanPanel />
            ) : activeNavLabel === 'AI模型配置' ? (
              <OpenPlatformAiModelConfigPanel />
            ) : activeNavLabel === 'AI用量与费用' ? (
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
                        { icon: TrendingUp, label: '租户增长', value: platformTrendSummary.tenantGrowthChange },
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
                        <h2 className="text-lg font-semibold tracking-normal text-white">平台收尾趋势参考</h2>
                        <p className="mt-1 text-sm text-slate-400">演示租户增长与 AI 调用占位趋势，均为静态 SVG 不代表真实数据。</p>
                      </div>
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1 text-xs font-semibold text-emerald-200">受控 demo</span>
                    </div>

                    <div className="mt-6 grid gap-5 lg:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-[#071322]/75 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <span className="text-sm font-semibold text-white">租户增长趋势</span>
                          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.10] px-2 py-0.5 text-xs font-semibold text-emerald-200 flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            {platformTrendSummary.tenantGrowthChange}
                          </span>
                        </div>
                        <div className="h-[180px]">
                          <svg viewBox="0 0 720 160" className="h-full w-full" role="img" aria-label={platformTrendSummary.tenantGrowthLabel}>
                            <defs>
                              <linearGradient id="tenantGrowthFill" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
                                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            {[40, 80, 120].map((y) => (
                              <line key={y} x1="24" x2="696" y1={y} y2={y} stroke="rgba(148,163,184,0.15)" strokeWidth="1" />
                            ))}
                            <polygon points="26,116 118,106 210,92 302,78 394,64 486,50 578,40 694,22 694,148 26,148" fill="url(#tenantGrowthFill)" />
                            <polyline points="26,116 118,106 210,92 302,78 394,64 486,50 578,40 694,22" fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#071322]/75 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <span className="text-sm font-semibold text-white">AI 调用趋势</span>
                          <span className="rounded-full border border-violet-300/20 bg-violet-300/[0.10] px-2 py-0.5 text-xs font-semibold text-violet-200 flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            {platformTrendSummary.callTrendChange}
                          </span>
                        </div>
                        <div className="h-[180px]">
                          <svg viewBox="0 0 720 160" className="h-full w-full" role="img" aria-label={platformTrendSummary.callTrendLabel}>
                            <defs>
                              <linearGradient id="callTrendFill" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.22" />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            {[40, 80, 120].map((y) => (
                              <line key={y} x1="24" x2="696" y1={y} y2={y} stroke="rgba(148,163,184,0.15)" strokeWidth="1" />
                            ))}
                            <polygon points="26,120 118,104 210,94 302,82 394,70 486,56 578,46 694,28 694,148 26,148" fill="url(#callTrendFill)" />
                            <polyline points="26,120 118,104 210,94 302,82 394,70 486,56 578,46 694,28" fill="none" stroke="#8b5cf6" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                            <polyline points="26,126 118,114 210,104 302,90 394,78 486,68 578,56 694,42" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-400/15 bg-slate-400/[0.05] px-3 py-2 text-xs leading-5 text-slate-500 flex items-center gap-2">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> 租户
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-400" /> 调用
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> 成功
                      </span>
                      <span className="ml-auto">{platformTrendSummary.note}</span>
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
