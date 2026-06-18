import { AlertTriangle, BarChart3, Building2, Database, TrendingUp } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const sectionShell = 'rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6';

const quotaMockBars = [
  { label: '客户', used: '—', limit: '—', pct: 0 },
  { label: '预约', used: '—', limit: '—', pct: 0 },
  { label: '随访', used: '—', limit: '—', pct: 0 },
  { label: 'AI 调用', used: '0', limit: '0', pct: 0 },
];

const deniedEvents = [
  { tenant: '演示租户示例', quota: '客户数', reason: 'missing_active_plan', time: '—' },
  { tenant: '演示租户示例', quota: 'AI 调用', reason: 'quota_exceeded_appointments', time: '—' },
];

export function AiQuotaBoundaryPanel() {
  return (
    <section className="space-y-5" aria-labelledby="ai-quota-boundary-heading">
      <div className={cn(sectionShell, 'overflow-hidden')}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] px-3.5 py-1.5 text-xs font-semibold text-cyan-100">
              <Database className="h-4 w-4" />
              配额治理视图
            </div>
            <h2 id="ai-quota-boundary-heading" className="mt-4 text-2xl font-semibold tracking-normal text-white sm:text-3xl">
              AI 配额边界
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              AI 调用配额是平台收尾治理的关键边界。当前未启用真实配额管控，仅展示配额维度和 denied 事件词汇占位。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[560px]">
            {[
              { icon: Building2, label: '覆盖租户', value: '4' },
              { icon: TrendingUp, label: '配额利用率', value: '不适用' },
              { icon: AlertTriangle, label: 'Denied 事件', value: '0（演示）' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
                <item.icon className="h-5 w-5 text-cyan-200" />
                <div className="mt-3 text-sm font-semibold tracking-normal text-white">{item.value}</div>
                <div className="mt-1 text-xs text-slate-400">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className={sectionShell}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/[0.12] text-cyan-200">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-normal text-white">配额维度概览</h3>
              <p className="mt-1 text-sm text-slate-400">配额利用率为静态占位数据，不反映真实租户用量。</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {quotaMockBars.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-white">{item.label}</span>
                  <span className="text-sm text-slate-400">{item.used} / {item.limit}</span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-slate-500" style={{ width: `${item.pct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500">
                  <span>已用：{item.pct}%</span>
                  <span>未启用真实配额</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={sectionShell}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-300/[0.12] text-amber-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-normal text-white">Quota Denied 占位</h3>
              <p className="mt-1 text-sm text-slate-400">展示 denied 事件词汇，不反映真实租户行为。</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {deniedEvents.map((event, idx) => (
              <div key={idx} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold tracking-normal text-white">{event.tenant}</h4>
                    <p className="mt-1 text-sm text-slate-400">配额维度：{event.quota}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-rose-300/20 bg-rose-300/[0.10] px-2.5 py-0.5 text-xs font-semibold text-rose-100">
                    denied
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-slate-300">
                    reason: {event.reason}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-slate-500">
                    {event.time}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-slate-400/15 bg-slate-400/[0.05] px-4 py-3 text-xs leading-5 text-slate-400">
            演示环境中无真实 AI 调用流量，denied 事件记录为空。配额阈值（80% 预警、100% 拒绝）为词汇预留。
          </div>
        </article>
      </div>

      <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.07] px-4 py-3 text-xs leading-5 text-amber-100">
        AI 配额边界为长期路线只读词汇。配额配置、启用/禁用、容量调整、自动扩缩容均不在本视图范围内。当前不执行真实 quota check。
      </div>
    </section>
  );
}
