import Image from 'next/image';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  CheckCircle2,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  Globe2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  Plug,
  RefreshCw,
  Settings,
  Shield,
  Users,
  WalletCards,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';

type PlatformNavItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
};

type PlatformMetric = {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  tone: string;
};

const platformNav: PlatformNavItem[] = [
  { label: '平台总览', icon: LayoutDashboard, active: true },
  { label: '首页编辑', icon: FileText },
  { label: '租户管理', icon: Building2 },
  { label: '产品与套餐', icon: Boxes },
  { label: 'AI模型', icon: Database },
  { label: 'AI用量与费用', icon: WalletCards },
  { label: '知识库管理', icon: BookOpen },
  { label: '开放连接中心', icon: Plug },
  { label: '智能体运行监控', icon: Activity },
  { label: '平台数据分析', icon: BarChart3 },
  { label: '计费与订单', icon: CreditCard },
  { label: '权限与组织', icon: Shield },
  { label: '系统设置', icon: Settings },
];

const metrics: PlatformMetric[] = [
  { label: '累计入驻医院', value: '156', change: '↗ 8.2%', icon: Building2, tone: 'bg-blue-50 text-blue-600' },
  { label: '活跃机构', value: '142', change: '↗ 5.8%', icon: Users, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Agent调用总量', value: '2.6M', change: '↗ 18.5%', icon: Boxes, tone: 'bg-violet-50 text-violet-600' },
  { label: '服务用户数', value: '125.0K', change: '↗ 12.3%', icon: Globe2, tone: 'bg-cyan-50 text-cyan-600' },
  { label: 'MRR', value: '¥258,000', change: '↗ 6.8%', icon: DollarSign, tone: 'bg-amber-50 text-amber-600' },
  { label: '续费率', value: '94.2%', change: '↗ 1.2%', icon: RefreshCw, tone: 'bg-emerald-50 text-emerald-600' },
];

const healthItems = [
  { label: 'API Gateway', detail: '延迟 45ms', value: '99.98%', status: '运行正常', warning: false },
  { label: '数据库', detail: '延迟 12ms', value: '99.99%', status: '运行正常', warning: false },
  { label: 'Agent服务', detail: '延迟 230ms', value: '99.95%', status: '运行正常', warning: false },
  { label: '存储服务', detail: '1.2TB / 1.5TB', value: '78%', status: '容量警告', warning: true },
];

export function PlatformConsole() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-[260px] shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
          <div className="flex h-[76px] items-center justify-between border-b border-slate-200 px-5">
            <div className="flex items-center gap-3">
              <Image src="/brand/logo-mark.png" alt="" width={44} height={44} className="h-11 w-11 rounded-xl object-contain" />
              <div>
                <div className="text-base font-semibold leading-5 text-slate-950">智美天工管理后台</div>
                <div className="text-xs text-slate-500">Platform Console</div>
              </div>
            </div>
            <PanelLeftClose className="h-4 w-4 text-slate-500" />
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
            <div className="mb-4 text-sm font-medium text-slate-500">平台菜单</div>
            {platformNav.map((item) => (
              <button
                key={item.label}
                type="button"
                className={cn(
                  'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition',
                  item.active ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex min-h-[76px] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 md:hidden">
              <Image src="/brand/logo-mark.png" alt="" width={42} height={42} className="h-10 w-10 rounded-xl object-contain" />
              <div>
                <h1 className="text-base font-semibold tracking-normal text-slate-950">智美天工管理后台</h1>
                <p className="text-xs text-slate-500">Platform Console</p>
              </div>
            </div>
            <div className="hidden md:block" />
            <div className="flex items-center gap-4 text-sm text-slate-600">
              <Bell className="h-5 w-5" />
              <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-50 text-xs font-semibold text-blue-600">超</span>
              <span className="hidden font-semibold sm:inline">超级管理员</span>
              <Link href="/platform-login" className="inline-flex items-center gap-2 font-medium text-slate-500 hover:text-slate-950">
                <LogOut className="h-4 w-4" />
                退出
              </Link>
            </div>
          </header>

          <div className="mx-auto w-full max-w-[1840px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <div className="md:hidden">
              <h1 className="text-2xl font-semibold tracking-normal text-slate-950">智美天工管理后台</h1>
            </div>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {metrics.map((metric) => (
                <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm text-slate-500">{metric.label}</div>
                    <div className={cn('grid h-10 w-10 place-items-center rounded-xl', metric.tone)}>
                      <metric.icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 text-2xl font-semibold tracking-normal text-slate-950">{metric.value}</div>
                  <div className="mt-3 text-right text-sm font-semibold text-emerald-500">{metric.change}</div>
                </article>
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <ChartCard title="租户增长趋势" badge="+12.5%" fill />
              <ChartCard title="Agent调用趋势" badge="+18.5%" />
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-semibold tracking-normal text-slate-950">收入趋势</h2>
                  <span className="rounded-lg bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-500">+6.8%</span>
                </div>
                <div className="flex h-[260px] items-end gap-4 border-b border-l border-slate-300 px-6 pb-2">
                  {[58, 64, 70, 75, 78, 82, 86, 90, 95, 100].map((height, index) => (
                    <div key={height} className="flex flex-1 flex-col items-center gap-2">
                      <div className="w-full rounded-t-md bg-blue-600" style={{ height: `${height * 2}px` }} />
                      <span className="text-xs text-slate-500">{index + 1}月</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-semibold tracking-normal text-slate-950">系统健康状态</h2>
                  <span className="text-sm font-semibold text-emerald-500">• 全部正常</span>
                </div>
                <div className="space-y-4">
                  {healthItems.map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('grid h-9 w-9 place-items-center rounded-xl', item.warning ? 'bg-amber-100 text-amber-500' : 'bg-emerald-100 text-emerald-500')}>
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-700">{item.label}</div>
                          <div className="text-sm text-slate-500">{item.detail}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-700">{item.value}</div>
                        <div className="text-sm text-slate-500">{item.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {[
                { icon: KeyRound, title: '开放接口', detail: 'API Key、OAuth、Webhook 后续接入' },
                { icon: Plug, title: '连接器治理', detail: '企微、HIS、CRM、投放平台统一管理' },
                { icon: Shield, title: '权限审计', detail: '平台操作留痕与租户边界核查' },
              ].map((item) => (
                <article key={item.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <item.icon className="h-6 w-6 text-blue-600" />
                  <h2 className="mt-4 text-base font-semibold tracking-normal text-slate-950">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p>
                </article>
              ))}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function ChartCard({ title, badge, fill = false }: { title: string; badge: string; fill?: boolean }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">{title}</h2>
        <span className="rounded-lg bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-500">{badge}</span>
      </div>
      <div className="relative h-[260px] overflow-hidden rounded-xl bg-[linear-gradient(#eef2f7_1px,transparent_1px),linear-gradient(90deg,#eef2f7_1px,transparent_1px)] bg-[length:14.28%_25%]">
        <svg viewBox="0 0 640 250" className="h-full w-full" role="img" aria-label={`${title}折线图`}>
          {fill && <polygon points="24,170 90,156 154,140 220,122 286,106 352,92 418,82 484,72 550,64 616,56 616,230 24,230" fill="#dbeafe" opacity="0.9" />}
          <polyline points="24,170 90,156 154,140 220,122 286,106 352,92 418,82 484,72 550,64 616,56" fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {!fill && <polyline points="24,168 90,150 154,132 220,118 286,100 352,86 418,68 484,54 550,42 616,24" fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      </div>
    </article>
  );
}
