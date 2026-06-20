import { Boxes, Check, CreditCard, Layers3, Users, Zap } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const sectionShell = 'rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6';

const plans = [
  {
    id: 'starter',
    name: 'Starter 基础版',
    price: '—',
    color: 'border-blue-100 bg-blue-50 text-blue-700',
    entitlements: [
      { label: 'Agent 数量', value: '1 个' },
      { label: '员工席位', value: '12 席' },
      { label: 'AI 调用 / 月', value: '50,000 次' },
      { label: '知识库存储', value: '20 GB' },
      { label: '连接器', value: '企微' },
    ],
  },
  {
    id: 'professional',
    name: 'Professional 专业版',
    price: '—',
    color: 'border-violet-100 bg-violet-50 text-violet-700',
    entitlements: [
      { label: 'Agent 数量', value: '3 个' },
      { label: '员工席位', value: '40 席' },
      { label: 'AI 调用 / 月', value: '300,000 次' },
      { label: '知识库存储', value: '100 GB' },
      { label: '连接器', value: '企微 / HIS / CRM' },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise 集团版',
    price: '—',
    color: 'border-amber-100 bg-amber-300/[0.08] text-amber-700',
    entitlements: [
      { label: 'Agent 数量', value: '20 个' },
      { label: '员工席位', value: '200 席' },
      { label: 'AI 调用 / 月', value: '2,000,000 次' },
      { label: '知识库存储', value: '1,024 GB' },
      { label: '连接器', value: '企微 / HIS / CRM / 新氧 / 美团 / 抖音' },
    ],
  },
];

export function ProductPlanPanel() {
  return (
    <section className="space-y-5" aria-labelledby="product-plan-heading">
      <div className={cn(sectionShell, 'overflow-hidden')}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700">
              <Boxes className="h-4 w-4" />
              产品路线视图
            </div>
            <h2 id="product-plan-heading" className="mt-4 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              产品与套餐
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              套餐权益对照表作为长期路线词汇预留。当前示范平台端如何观测套餐覆盖度和权益对比，不涉及真实定价、订阅、支付或合同。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[560px]">
            {[
              { icon: Layers3, label: '套餐层级', value: '3 档' },
              { icon: Users, label: '租户覆盖', value: '受控 demo' },
              { icon: CreditCard, label: '定价', value: '未上线' },
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

      <div className="grid gap-5 xl:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.id} className={sectionShell}>
            <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold', plan.color)}>
              <Zap className="h-3.5 w-3.5" />
              {plan.name}
            </div>
            <div className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">{plan.price}</div>
            <div className="mt-1 text-sm text-slate-500">参考价（未定价）</div>

            <div className="mt-5 space-y-3">
              {plan.entitlements.map((ent) => (
                <div key={ent.label} className="flex items-center justify-between gap-3 rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3">
                  <span className="text-sm text-slate-500">{ent.label}</span>
                  <span className="text-sm font-semibold text-slate-950">{ent.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3 text-sm text-slate-500">
              <Check className="h-4 w-4 text-emerald-300" />
              演示环境权益词汇，非真实套餐
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.07] px-4 py-3 text-xs leading-5 text-amber-700">
        套餐权益对比为长期路线只读词汇。定价、下单、续费、套餐变更、订阅管理均不在本视图范围内，需后续单独授权。
      </div>
    </section>
  );
}
