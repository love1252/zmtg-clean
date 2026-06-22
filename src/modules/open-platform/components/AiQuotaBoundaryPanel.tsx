import { AlertTriangle, BarChart3 } from 'lucide-react';
import { PlatformSectionBanner } from '@/modules/open-platform/components/PlatformSectionBanner';
import { cn } from '@/shared/utils/cn';

const sectionShell = 'rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6';

const quotaMockBars = [
  { label: '客户', used: '—', limit: '—', pct: 0 },
  { label: '预约', used: '—', limit: '—', pct: 0 },
  { label: '随访', used: '—', limit: '—', pct: 0 },
  { label: 'AI 调用', used: '0', limit: '0', pct: 0 },
];

export function AiQuotaBoundaryPanel() {
  return (
    <section className="space-y-5" aria-labelledby="ai-quota-boundary-heading">
      <PlatformSectionBanner
        headingId="ai-quota-boundary-heading"
        title="AI 配额边界"
        description="AI 调用配额是平台收尾治理的关键边界。当前未启用真实配额管控，仅展示配额维度和 denied 事件词汇占位。"
      />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className={sectionShell}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-normal text-slate-950">配额维度概览</h3>
              <p className="mt-1 text-sm text-slate-500">配额利用率为静态占位数据，不反映真实租户用量。</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {quotaMockBars.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-950">{item.label}</span>
                  <span className="text-sm text-slate-500">{item.used} / {item.limit}</span>
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
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-normal text-slate-950">Quota Denied 占位</h3>
              <p className="mt-1 text-sm text-slate-500">展示 denied 事件词汇，不反映真实租户行为。</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-[#dbe6f3] bg-[#f8fafc] p-5 text-sm leading-6 text-slate-500">
            暂无真实 quota denied 记录。后续接入真实配额检查后，仅展示 API 返回的低敏事件摘要。
          </div>

          <div className="mt-4 rounded-xl border border-slate-400/15 bg-slate-400/[0.05] px-4 py-3 text-xs leading-5 text-slate-500">
            当前无真实 AI 调用流量，denied 事件记录为空。配额阈值（80% 预警、100% 拒绝）为词汇预留。
          </div>
        </article>
      </div>

      <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.07] px-4 py-3 text-xs leading-5 text-amber-700">
        AI 配额边界为长期路线只读词汇。配额配置、启用/禁用、容量调整、自动扩缩容均不在本视图范围内。当前不执行真实 quota check。
      </div>
    </section>
  );
}
