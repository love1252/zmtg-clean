import Image from 'next/image';
import {
  Activity,
  Search,
  Sparkles,
} from 'lucide-react';
import { LogoutButton } from '@/modules/auth/components/LogoutButton';
import {
  institutionNavItems,
  institutionSegmentItems,
  institutionStats,
  institutionSuggestions,
} from '@/modules/workspace/domain/institution-dashboard';
import { cn } from '@/shared/utils/cn';

const toneClasses = {
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
};

export function InstitutionWorkspace() {
  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-[260px] shrink-0 flex-col bg-[#101827] text-slate-200 md:flex">
          <div className="flex h-[72px] items-center gap-3 border-b border-white/10 px-4">
            <Image src="/brand/logo-mark.png" alt="" width={48} height={48} className="h-12 w-12 rounded-xl object-contain" />
            <div>
              <div className="text-lg font-semibold leading-6 text-white">智美天工</div>
              <div className="text-xs text-slate-400">医美智能运营系统</div>
            </div>
          </div>

          <div className="px-4 py-4">
            <label className="relative block" aria-label="搜索功能">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="h-10 w-full rounded-xl border border-white/5 bg-white/7 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-blue-400/70"
                placeholder="搜索功能..."
              />
            </label>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3">
            {institutionNavItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={cn(
                  'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition',
                  item.active ? 'bg-blue-600/22 text-blue-300' : 'text-slate-300 hover:bg-white/8 hover:text-white',
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="space-y-3 border-t border-white/10 p-4">
            <div className="flex items-center gap-3 rounded-xl bg-white/7 px-3 py-3">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-sm font-semibold text-white">管</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">系统管理员</div>
                <div className="text-xs text-slate-400">机构账号</div>
              </div>
            </div>
            <LogoutButton
              redirectTo="/login"
              className="flex h-10 w-full rounded-xl text-sm font-semibold text-red-300 hover:bg-red-500/10"
            />
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-hidden">
          <div className="mx-auto w-full max-w-[1840px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
            <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <div className="flex items-center gap-3 md:hidden">
                  <Image src="/brand/logo-mark.png" alt="" width={42} height={42} className="h-10 w-10 rounded-xl object-contain" />
                  <div>
                    <div className="font-semibold text-slate-950">智美天工</div>
                    <div className="text-xs text-slate-500">机构工作台</div>
                  </div>
                </div>
                <h1 className="mt-4 text-2xl font-semibold tracking-normal text-slate-950 md:mt-0">欢迎回来</h1>
                <p className="mt-1 text-sm text-slate-500">让医美经营拥有智能体驱动的第二增长引擎</p>
              </div>
              <div className="inline-flex h-9 items-center gap-2 self-start rounded-xl bg-blue-50 px-4 text-sm font-semibold text-blue-600">
                <Activity className="h-4 w-4" />
                系统运行正常
              </div>
            </header>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {institutionStats.map((stat) => (
                <article key={stat.label} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className={cn('grid h-11 w-11 place-items-center rounded-2xl', toneClasses[stat.tone])}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', stat.change.includes('↘') ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500')}>
                      {stat.change}
                    </span>
                  </div>
                  <div className="mt-5 text-4xl font-semibold tracking-normal text-slate-950">{stat.value}</div>
                  <div className="mt-1 text-sm text-slate-500">{stat.label}</div>
                </article>
              ))}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">AI经营副驾驶建议</h2>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {institutionSuggestions.map((suggestion) => (
                  <article key={suggestion.title} className="rounded-xl border border-slate-200 bg-white p-4">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-500">{suggestion.type}</span>
                    <h3 className="mt-3 text-base font-semibold text-slate-950">{suggestion.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{suggestion.description}</p>
                    <button type="button" className="mt-3 text-sm font-semibold text-blue-600">查看详情 →</button>
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.7fr_0.85fr]">
              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold tracking-normal text-slate-950">触达趋势</h2>
                  <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">本周</span>
                </div>
                <div className="relative h-[300px] overflow-hidden rounded-xl bg-[linear-gradient(#eef3f8_1px,transparent_1px),linear-gradient(90deg,#eef3f8_1px,transparent_1px)] bg-[length:25%_25%]">
                  <svg viewBox="0 0 720 260" className="h-full w-full" role="img" aria-label="触达趋势折线图">
                    <polyline points="24,202 140,178 250,148 360,138 470,154 585,110 696,118" fill="none" stroke="#1f72ff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold tracking-normal text-slate-950">用户分层</h2>
                <div className="mx-auto mt-8 h-32 w-32 rounded-full" style={{ background: 'conic-gradient(#3b82f6 0 48%, #f59e0b 48% 60%, #10b981 60% 82%, #64748b 82% 100%)' }} />
                <div className="mt-8 space-y-3">
                  {institutionSegmentItems.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-500">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.label}
                      </span>
                      <span className="font-medium text-slate-700">{item.value}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
