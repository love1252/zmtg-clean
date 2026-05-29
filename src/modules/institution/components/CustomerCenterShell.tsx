import { ArrowRight, Search, ShieldCheck, Tags } from 'lucide-react';
import {
  customerInsightItems,
  customerSegments,
  demoCustomers,
} from '@/modules/institution/domain/customers';
import { cn } from '@/shared/utils/cn';

const segmentToneClasses = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function CustomerCenterShell() {
  return (
    <section className="space-y-5">
      <div className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">客户运营</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">客户中心</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              用演示客户资产展示分层、优先级、负责人和下一步动作，真实客户数据将在后续数据库与权限阶段接入。
            </p>
          </div>
          <label className="relative block w-full lg:w-[320px]" aria-label="客户搜索">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none placeholder:text-slate-400"
              placeholder="搜索客户、标签或负责人"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {customerSegments.map((segment) => (
          <article key={segment.label} className="rounded-[22px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
            <div className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', segmentToneClasses[segment.tone])}>
              {segment.trend}
            </div>
            <div className="mt-4 text-3xl font-semibold text-slate-950">{segment.value}</div>
            <div className="mt-1 text-sm font-medium text-slate-500">{segment.label}</div>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <article className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-950">客户优先级队列</h3>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">演示客户</span>
          </div>
          <div className="mt-4 space-y-3">
            {demoCustomers.map((customer) => (
              <div key={customer.id} className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-slate-950">{customer.name}</span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">{customer.priority}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{customer.lifecycle}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {customer.projectInterest} · {customer.lastTouch}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {customer.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-[220px] rounded-2xl bg-slate-50 p-3">
                    <div className="text-xs font-semibold text-slate-400">下一步动作</div>
                    <div className="mt-1 text-sm font-semibold leading-6 text-slate-800">{customer.nextAction}</div>
                    <div className="mt-2 text-xs text-slate-500">负责人：{customer.owner}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="rounded-[24px] border border-slate-900/90 bg-[#071322] p-5 text-white shadow-[0_24px_80px_rgba(3,15,33,0.22)]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400/16 text-cyan-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">客户数据边界</h3>
              <p className="mt-1 text-sm text-slate-400">本阶段只展示虚构演示信息。</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {customerInsightItems.map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Tags className="h-4 w-4 text-cyan-300" />
                  {item.title}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
          <button type="button" className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-950">
            查看客户分层规则
            <ArrowRight className="h-4 w-4" />
          </button>
        </aside>
      </div>
    </section>
  );
}
