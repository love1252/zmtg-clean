import { Activity, ArrowUpRight, CreditCard, FileSignature, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const sectionShell = 'rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6';

const commercialLifecycle = [
  {
    phase: '计费模式',
    icon: WalletCards,
    status: '词汇预留',
    statusTone: 'border-slate-300/20 bg-slate-300/[0.06] text-slate-600',
    items: [
      { label: '按量计费', detail: 'Agent 调用 / 知识库存储 / 文件上传 作为计费维度词汇' },
      { label: '套餐订阅', detail: 'Starter / Professional / Enterprise 周期性订阅' },
      { label: '混合计费', detail: '套餐基础费 + 超量按量计费' },
    ],
  },
  {
    phase: '订单管理',
    icon: ReceiptText,
    status: '词汇预留',
    statusTone: 'border-slate-300/20 bg-slate-300/[0.06] text-slate-600',
    items: [
      { label: '开通订单', detail: '租户首次订阅产生的开通记录' },
      { label: '续费订单', detail: '周期结束时续费产生的订单' },
      { label: '套餐变更', detail: '升级 / 降级套餐产生变更记录' },
      { label: '用量计费', detail: '超量部分结算产生的费用记录' },
    ],
  },
  {
    phase: '合同管理',
    icon: FileSignature,
    status: '词汇预留',
    statusTone: 'border-slate-300/20 bg-slate-300/[0.06] text-slate-600',
    items: [
      { label: '草稿', detail: '未发送签章的合同草稿' },
      { label: '签署中', detail: '已发送待对方签署' },
      { label: '已签署', detail: '双方签署完成生效中' },
      { label: '已过期', detail: '超过有效期自动失效' },
    ],
  },
  {
    phase: '发票管理',
    icon: CreditCard,
    status: '词汇预留',
    statusTone: 'border-slate-300/20 bg-slate-300/[0.06] text-slate-600',
    items: [
      { label: '待开票', detail: '已支付待开具发票' },
      { label: '已开票', detail: '发票已开具' },
      { label: '特票', detail: '增值税专用发票' },
      { label: '普票', detail: '增值税普通发票' },
    ],
  },
];

const auditSignals = [
  { key: 'missing_active_plan', label: '缺少有效套餐', desc: '租户无在有效期内的套餐分配' },
  { key: 'missing_quota_limit', label: '缺少配额上限', desc: '套餐未定义配额上限' },
  { key: 'quota_denied_events', label: 'Quota denied 事件', desc: '租户调用超过配额被拒绝' },
  { key: 'stale_quota_snapshot', label: '配额快照过期', desc: '配额使用快照超过 7 天未更新' },
];

export function CommercialBoundaryPanel() {
  return (
    <section className="space-y-5" aria-labelledby="commercial-boundary-heading">
      <div className={cn(sectionShell, 'overflow-hidden')}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700">
              <Activity className="h-4 w-4" />
              商业化边界视图
            </div>
            <h2 id="commercial-boundary-heading" className="mt-4 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              商业化边界
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              商业化是平台长期路线中最后收尾的关键环节。当前展示计费、订单、合同、发票的词汇预留，不接真实支付、不含定价、不处理税务合规。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[560px]">
            {[
              { icon: WalletCards, label: '计费模式', value: '词汇预留' },
              { icon: ReceiptText, label: '订单', value: '0 条' },
              { icon: ArrowUpRight, label: 'MRR', value: '不适用' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                <item.icon className="h-5 w-5 text-blue-600" />
                <div className="mt-3 text-sm font-semibold tracking-normal text-slate-950">{item.value}</div>
                <div className="mt-1 text-xs text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {commercialLifecycle.map((phase) => {
          const Icon = phase.icon;
          return (
            <article key={phase.phase} className={sectionShell}>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-normal text-slate-950">{phase.phase}</h3>
                    <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', phase.statusTone)}>
                      {phase.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">当前仅为治理词汇预留，不启用真实操作。</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {phase.items.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                    <h4 className="text-sm font-semibold tracking-normal text-slate-950">{item.label}</h4>
                    <p className="mt-2 text-sm leading-5 text-slate-500">{item.detail}</p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <article className={sectionShell}>
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-slate-950">商业化健康信号</h3>
            <p className="mt-1 text-sm text-slate-500">商业化健康审计维度为运营参考，不关联真实计费系统。</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {auditSignals.map((signal) => (
            <div key={signal.key} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
              <h4 className="text-sm font-semibold tracking-normal text-slate-950">{signal.label}</h4>
              <p className="mt-2 text-sm leading-5 text-slate-500">{signal.desc}</p>
              <div className="mt-3 rounded-full border border-slate-400/20 bg-slate-400/[0.06] px-2.5 py-0.5 text-xs font-semibold text-slate-500 inline-block">
                {signal.key}
              </div>
            </div>
          ))}
        </div>
      </article>

      <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.07] px-4 py-3 text-xs leading-5 text-amber-700">
        商业化为长期路线只读词汇。计费、支付（含 Stripe/微信支付）、合同签署、发票开具、税务合规、财务报表均不在此视图范围，需后续单独授权并完成法务合规评估后方可启动。
      </div>
    </section>
  );
}
