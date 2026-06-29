'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Activity,
  Bell,
  CheckCircle2,
  Command,
  ExternalLink,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { LogoutButton } from '@/modules/auth/components/LogoutButton';
import { CommercialBoundaryPanel } from '@/modules/open-platform/components/CommercialBoundaryPanel';
import { HomepageBrandPanel } from '@/modules/open-platform/components/HomepageBrandPanel';
import { OpenConnectionRoadmapPanel } from '@/modules/open-platform/components/OpenConnectionRoadmapPanel';
import { OpenPlatformAiCreditMeteringRulesPanel } from '@/modules/open-platform/components/OpenPlatformAiCreditMeteringRulesPanel';
import { OpenPlatformAiModelConfigPanel } from '@/modules/open-platform/components/OpenPlatformAiModelConfigPanel';
import { OpenPlatformAiReadonlyPanel } from '@/modules/open-platform/components/OpenPlatformAiReadonlyPanel';
import { OpenPlatformAuditEventsPanel } from '@/modules/open-platform/components/OpenPlatformAuditEventsPanel';
import { OpenPlatformKnowledgeManagementPanel } from '@/modules/open-platform/components/OpenPlatformKnowledgeManagementPanel';
import { OpenPlatformTenantManagementPanel } from '@/modules/open-platform/components/OpenPlatformTenantManagementPanel';
import { listOpenPlatformTenants } from '@/modules/open-platform/client/platform-tenant-management-client';
import { PlatformSectionBanner } from '@/modules/open-platform/components/PlatformSectionBanner';
import { TrialV01ExperienceHandoffPanel } from '@/modules/open-platform/components/TrialV01ExperienceHandoffPanel';
import { TrialDataResetPanel } from '@/modules/open-platform/components/TrialDataResetPanel';
import { ProductPlanPanel } from '@/modules/open-platform/components/ProductPlanPanel';
import {
  buildPlatformOverviewViewModel,
  platformCapabilityCards,
  platformNavItems,
  platformQuickActions,
} from '@/modules/workspace/domain/platform-dashboard';
import { cn } from '@/shared/utils/cn';

export function PlatformConsole() {
  const [activeNavLabel, setActiveNavLabel] = useState('平台总览');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isLightPlatformView = true;
  const SidebarToggleIcon = isSidebarCollapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <main className={cn('min-h-screen overflow-x-hidden', isLightPlatformView ? 'bg-[#f7f9fc] text-slate-950' : 'bg-[#f7f9fc] text-slate-950')}>
      {!isLightPlatformView ? (
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(37,99,235,0.28),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(20,184,166,0.18),transparent_30%),linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:auto,auto,44px_44px,44px_44px]" />
      ) : null}
      <div className="relative min-h-screen">
        <aside
          aria-label="平台端侧边栏"
          data-sidebar-state={isSidebarCollapsed ? 'collapsed' : 'expanded'}
          className={cn(
            'fixed left-0 top-0 z-30 hidden h-screen shrink-0 border-r transition-[width] duration-200 md:flex md:flex-col',
            isSidebarCollapsed ? 'md:w-16' : isLightPlatformView ? 'md:w-[228px]' : 'md:w-[286px]',
            isLightPlatformView
              ? 'border-[#e6edf5] bg-white text-[#1f2937]'
              : 'border-[#e6edf5] bg-white text-[#64748b] shadow-sm',
          )}
        >
          <div
            aria-label="平台端品牌区"
            className={cn(
              'flex items-center gap-3 border-b bg-white px-5',
              isLightPlatformView ? 'w-[228px]' : 'w-[286px]',
              isLightPlatformView ? 'h-[70px] border-[#e6edf5]' : 'h-[86px] border-[#e6edf5]',
            )}
          >
            <Image src="/brand/logo-mark.png" alt="" width={56} height={56} className={cn('rounded-xl bg-white object-contain', isLightPlatformView ? 'h-12 w-12 p-1' : 'h-14 w-14 p-1.5')} />
            <div className="min-w-0">
              <div className={cn('truncate text-base font-semibold tracking-normal', isLightPlatformView ? 'text-[#1f2937]' : 'text-[#1f2937]')}>智美天工管理后台</div>
              <div className={cn('mt-0.5 truncate text-xs', isLightPlatformView ? 'text-[#64748b]' : 'text-blue-600/70')}>平台控制台</div>
            </div>
          </div>

          {isLightPlatformView ? (
            <div
              className={cn(
                'flex h-[58px] items-center border-b border-[#e6edf5] text-sm text-[#64748b]',
                isSidebarCollapsed ? 'justify-center px-2' : 'justify-between px-6',
              )}
            >
              {!isSidebarCollapsed ? <span>平台菜单</span> : null}
              <button
                type="button"
                aria-label={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                aria-expanded={!isSidebarCollapsed}
                title={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
                className="grid h-8 w-8 place-items-center rounded-lg text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#2563eb] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#bfdbfe]"
              >
                <SidebarToggleIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="px-5 py-5">
              <div className="rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.07] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                  <Command className="h-4 w-4" />
                  平台治理模式
                </div>
                <p className="mt-2 text-sm leading-6 text-[#64748b]">租户、套餐、配额、商业化健康与审计统一在平台侧观测。</p>
              </div>
            </div>
          )}

          <nav
            aria-label="平台端桌面导航"
            className={cn(
              'flex-1 space-y-1 overflow-y-auto',
              isSidebarCollapsed ? 'px-2 py-4' : isLightPlatformView ? 'px-4 py-4' : 'px-4',
            )}
          >
            {platformNavItems.map((item) => (
              <button
                key={item.label}
                type="button"
                aria-label={item.label}
                title={isSidebarCollapsed ? item.label : undefined}
                onClick={() => setActiveNavLabel(item.label)}
                className={cn(
                  'flex h-11 w-full items-center rounded-xl text-sm font-medium tracking-normal transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#bfdbfe]',
                  isSidebarCollapsed ? 'justify-center px-0' : 'gap-3 px-3 text-left',
                  isLightPlatformView
                    ? activeNavLabel === item.label
                      ? 'bg-[#eaf3ff] text-[#2563eb]'
                      : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1f2937]'
                    : activeNavLabel === item.label
                      ? 'bg-blue-500/20 text-blue-600 ring-1 ring-cyan-300/20'
                      : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1f2937]',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isSidebarCollapsed ? item.label : null}
              </button>
            ))}
          </nav>

          <div className={cn('space-y-3 border-t', isSidebarCollapsed ? 'p-3' : 'p-5', isLightPlatformView ? 'border-[#e6edf5]' : 'border-[#e6edf5]')}>
            {!isLightPlatformView ? (
            <div className="rounded-2xl border border-emerald-300/14 bg-emerald-300/[0.07] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[#1f2937]">全部服务运行正常</div>
                  <div className="mt-1 text-xs text-[#64748b]">最近检查 1 分钟前</div>
                </div>
                <Activity className="h-5 w-5 text-emerald-300" />
              </div>
            </div>
            ) : null}
            <LogoutButton
              redirectTo="/platform-login"
              ariaLabel={isSidebarCollapsed ? '退出平台' : undefined}
              className={cn(
                'flex h-10 rounded-xl text-sm font-semibold',
                isSidebarCollapsed ? 'w-10 px-0' : 'w-full',
                isLightPlatformView ? 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1f2937]' : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1f2937]',
              )}
            >
              {isSidebarCollapsed ? '' : '退出'}
            </LogoutButton>
          </div>
        </aside>

        <section
          aria-label="平台端主内容"
          className={cn(
            'min-w-0 flex-1 pt-[70px] transition-[padding] duration-200',
            isSidebarCollapsed ? 'md:pl-16' : isLightPlatformView ? 'md:pl-[228px]' : 'md:pl-[286px]',
          )}
        >
          <header
            aria-label="平台端顶栏"
            className={cn(
              'fixed left-0 right-0 top-0 z-20 flex items-center justify-between border-b px-4 transition-[left] duration-200 sm:px-6 lg:px-8',
              isSidebarCollapsed ? 'md:left-16' : isLightPlatformView ? 'md:left-[228px]' : 'md:left-[286px]',
              isLightPlatformView
                ? 'min-h-[70px] border-[#e6edf5] bg-white'
                : 'min-h-[78px] border-[#e6edf5] bg-white ',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Image src="/brand/logo-mark.png" alt="" width={42} height={42} className={cn('h-10 w-10 rounded-xl bg-white object-contain p-1 md:hidden', isLightPlatformView ? 'border border-[#e6edf5]' : '')} />
              <div className="min-w-0">
                <div className={cn('truncate text-sm font-semibold md:text-base', isLightPlatformView ? 'text-[#1f2937] md:hidden' : 'text-[#1f2937]')}>平台运营中枢</div>
                <div className={cn('mt-0.5 truncate text-xs', isLightPlatformView ? 'text-[#64748b] md:hidden' : 'text-[#64748b]')}>只读预览 · V1 范围</div>
              </div>
            </div>
            <div className={cn('flex items-center gap-3 text-sm', isLightPlatformView ? 'text-[#64748b]' : 'text-[#64748b]')}>
              <button
                type="button"
                aria-label="通知"
                className={cn(
                  'relative grid h-10 w-10 place-items-center rounded-xl border',
                  isLightPlatformView ? 'border-transparent bg-white text-[#64748b]' : 'border-[#e6edf5] bg-white text-[#64748b]',
                )}
              >
                <Bell className="h-5 w-5" />
                {isLightPlatformView ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" /> : null}
              </button>
              <LogoutButton
                redirectTo="/platform-login"
                className={cn(
                  'h-10 shrink-0 rounded-xl border px-3 text-xs font-semibold md:hidden',
                  isLightPlatformView ? 'border-[#e6edf5] bg-white text-[#64748b]' : 'border-[#e6edf5] bg-white text-[#64748b]',
                )}
              >
                退出平台
              </LogoutButton>
              <span className={cn(
                'hidden items-center gap-2 rounded-full border px-3 py-1.5 font-semibold sm:inline-flex',
                isLightPlatformView ? 'border-transparent bg-white text-[#1f2937]' : 'border-blue-100 bg-blue-50 text-blue-700',
              )}>
                <span className={cn('grid h-6 w-6 place-items-center rounded-full text-xs', isLightPlatformView ? 'bg-[#eaf3ff] text-[#2563eb]' : 'bg-cyan-300/20 text-blue-700')}>超</span>
                超级管理员
              </span>
            </div>
          </header>

          <nav aria-label="平台端移动导航" className={cn('border-b px-4 py-3 md:hidden', isLightPlatformView ? 'border-[#e6edf5] bg-white' : 'border-[#e6edf5] bg-white ')}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className={cn('text-xs font-semibold', isLightPlatformView ? 'text-[#64748b]' : 'text-[#64748b]')}>平台导航</span>
              <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', isLightPlatformView ? 'border-[#e6edf5] bg-[#f8fafc] text-[#64748b]' : 'border-emerald-100 bg-emerald-50 text-emerald-700')}>服务正常</span>
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
                        ? 'border-blue-100 bg-blue-50 text-blue-700'
                        : 'border-[#e6edf5] bg-white text-[#64748b]',
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
            ) : activeNavLabel === 'AI 积分规则' ? (
              <OpenPlatformAiCreditMeteringRulesPanel />
            ) : activeNavLabel === 'AI用量与费用' ? (
              <OpenPlatformAiReadonlyPanel />
            ) : activeNavLabel === '知识库管理' ? (
              <OpenPlatformKnowledgeManagementPanel />
            ) : activeNavLabel === '开放连接路线' ? (
              <OpenConnectionRoadmapPanel />
            ) : activeNavLabel === '商业化边界' ? (
              <CommercialBoundaryPanel />
            ) : activeNavLabel === '平台审计日志' ? (
              <OpenPlatformAuditEventsPanel />
            ) : activeNavLabel === '体验版操作说明' ? (
              <TrialV01ExperienceHandoffPanel />
            ) : activeNavLabel === '体验数据重置' ? (
              <TrialDataResetPanel />
            ) : activeNavLabel === '平台总览' ? (
              <PlatformOverview onNavigate={setActiveNavLabel} />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

type PlatformOverviewProps = {
  onNavigate: (label: string) => void;
};

function PlatformOverview({ onNavigate }: PlatformOverviewProps) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [overview, setOverview] = useState(() =>
    buildPlatformOverviewViewModel({
      tenants: [],
      now: new Date(),
    }),
  );
  const hasHealthWarnings = overview.healthItems.some((item) => item.warning);

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      setLoadState('loading');
      const result = await listOpenPlatformTenants();
      if (!isMounted) return;

      if (!result.ok) {
        setOverview(buildPlatformOverviewViewModel({ tenants: [], now: new Date() }));
        setLoadState('error');
        return;
      }

      setOverview(buildPlatformOverviewViewModel({ tenants: result.records, now: new Date() }));
      setLoadState('ready');
    }

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <PlatformSectionBanner
        headingId="platform-overview-heading"
        headingLevel="h1"
        title="平台总览"
        description="只保留能支撑运营判断的核心信号：租户是否可运营、套餐和配额是否完整、快照是否可信、拒绝审计是否需要复核。知识库与人工智能只作为低权重能力参考，不替代商业化健康判断。"
      />
      {loadState === 'error' ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          租户聚合暂不可用，当前展示零值安全空态。请稍后刷新或进入租户管理查看接口状态。
        </div>
      ) : null}

      <section aria-label="核心运营指标" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {overview.metrics.map((metric) => (
          <article key={metric.label} className="rounded-[20px] border border-[#e6edf5] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#64748b]">{metric.label}</h2>
                <div className="mt-3 text-3xl font-semibold tracking-normal text-[#1f2937]">{metric.value}</div>
              </div>
              <div className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', metric.tone)}>
                <metric.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#64748b]">{metric.change}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <DistributionPanel title="租户状态分布" items={overview.tenantStatusItems} note="判断活跃租户基数，避免把暂停或注销租户计入运营盘面。" />
        <DistributionPanel title="套餐分布摘要" items={overview.planStatusItems} note="判断活跃租户是否具备可解释的商业化配置。" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.95fr_0.95fr]">
        <article className="rounded-[24px] border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-[#1f2937]">商业化健康</h2>
              <p className="mt-1 text-sm text-[#64748b]">优先处理会影响租户运营判断的配置缺口。</p>
            </div>
            <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', hasHealthWarnings ? 'border-amber-100 bg-amber-50 text-amber-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700')}>
              {hasHealthWarnings ? '需要复核' : '暂无风险'}
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {overview.healthItems.map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-4 rounded-2xl border border-[#e6edf5] bg-white px-4 py-3">
                <div className="flex min-w-0 gap-3">
                  <div className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', item.warning ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700')}>
                    {item.warning ? <Info className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1f2937]">{item.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-[#64748b]">{item.detail}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-base font-semibold text-[#1f2937]">{item.value}</div>
                  <div className="mt-1 text-xs text-[#64748b]">{item.status}</div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <ReferencePanel title="知识库能力质量参考" items={overview.knowledgeQualityItems} />
        <ReferencePanel title="AI用量与费用与模型配置参考" items={overview.aiReferenceItems} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-[24px] border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-[#1f2937]">治理工作队列</h2>
              <p className="mt-1 text-sm text-[#64748b]">从高风险到配置补齐，直接进入对应平台栏目处理。</p>
            </div>
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-5 space-y-2">
            {platformQuickActions.map((action, index) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onNavigate(action.hint)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#e6edf5] bg-white px-4 py-3 text-left transition hover:bg-[#f8fafc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#bfdbfe]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-xs font-semibold text-blue-700">{index + 1}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <action.icon className="h-4 w-4 shrink-0 text-blue-600" />
                    <span className="text-sm font-semibold text-[#1f2937]">{action.label}</span>
                  </span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-[24px] border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-normal text-[#1f2937]">能力边界</h2>
              <p className="mt-1 text-sm text-[#64748b]">防止把未上线能力误读为当前运营能力。</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-[#64748b]">只读</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {platformCapabilityCards.map((item) => (
              <div key={item.title} className="rounded-2xl border border-[#e6edf5] bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#1f2937]">{item.title}</h3>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#64748b]">{item.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

    </>
  );
}

type DistributionItem = {
  label: string;
  value: string;
  tone: string;
};

function DistributionPanel({ title, items, note }: { title: string; items: readonly DistributionItem[]; note: string }) {
  const total = items.reduce((sum, item) => sum + Number(item.value), 0);

  return (
    <article className="rounded-[24px] border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal text-[#1f2937]">{title}</h2>
          <p className="mt-1 text-sm text-[#64748b]">{note}</p>
        </div>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">分布数据</span>
      </div>
      <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100">
        {items.map((item) => (
          <span
            key={item.label}
            className={item.tone}
            style={{ width: total > 0 ? `${(Number(item.value) / total) * 100}%` : '0%' }}
          />
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#e6edf5] bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-[#64748b]">
              <span className={cn('h-2.5 w-2.5 rounded-full', item.tone)} />
              {item.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#1f2937]">{item.value}</div>
          </div>
        ))}
      </div>
    </article>
  );
}

type ReferenceItem = {
  label: string;
  value: string;
  detail: string;
};

function ReferencePanel({ title, items }: { title: string; items: readonly ReferenceItem[] }) {
  return (
    <article className="rounded-[24px] border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-normal text-[#1f2937]">{title}</h2>
          <p className="mt-1 text-sm text-[#64748b]">低权重参考，不参与核心商业化排序。</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-[#64748b]">只读参考</span>
      </div>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#e6edf5] bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#1f2937]">{item.label}</h3>
              <span className="shrink-0 text-base font-semibold text-[#1f2937]">{item.value}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[#64748b]">{item.detail}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
