import { Globe, Layout, Palette, FileText } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const sectionShell = 'rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6';

export function HomepageBrandPanel() {
  return (
    <section className="space-y-5" aria-labelledby="homepage-brand-heading">
      <div className={cn(sectionShell, 'overflow-hidden')}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] px-3.5 py-1.5 text-xs font-semibold text-cyan-100">
              <Layout className="h-4 w-4" />
              品牌治理视图
            </div>
            <h2 id="homepage-brand-heading" className="mt-4 text-2xl font-semibold tracking-normal text-white sm:text-3xl">
              首页与品牌
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              平台端品牌展示和机构首页编辑器为长期路线模块。当前仅展示品牌占位视图，不提供写入、上传或发布能力。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[560px]">
            {[
              { icon: Globe, label: '平台 Logo', value: '智美天工' },
              { icon: Palette, label: '品牌色', value: '蓝 / 青 / 紫' },
              { icon: FileText, label: '首页模块', value: 'Hero / Features / Plans' },
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

      <div className="grid gap-5 xl:grid-cols-2">
        <article className={sectionShell}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/[0.12] text-cyan-200">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-normal text-white">平台品牌标识</h3>
              <p className="mt-1 text-sm text-slate-400">当前演示环境的品牌信息占位展示。</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {[
              { field: '平台名称', value: '智美天工管理后台' },
              { field: 'Logo Mark', value: '/brand/logo-mark.png（静态）' },
              { field: '标语/副标题', value: 'Platform Console' },
              { field: '品牌色主题', value: '深色科技风（蓝 / 青渐变）' },
            ].map((row) => (
              <div key={row.field} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#071322]/72 px-4 py-3">
                <span className="text-sm text-slate-400">{row.field}</span>
                <span className="text-sm font-semibold text-white">{row.value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={sectionShell}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-300/[0.12] text-violet-200">
              <Layout className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-normal text-white">首页模块布局</h3>
              <p className="mt-1 text-sm text-slate-400">机构首页的模块布局为长期路线，当前仅做词汇预留。</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { module: 'Hero 横幅', status: '占位词汇', desc: '首页主视觉区域，标题 + CTA' },
              { module: 'Features 特色', status: '占位词汇', desc: '机构能力亮点网格展示' },
              { module: 'Stats 数据', status: '占位词汇', desc: '机构运营数据看板模块' },
              { module: 'Clients 案例', status: '占位词汇', desc: '合作客户 / 案例展示' },
              { module: 'Plans 套餐', status: '占位词汇', desc: '套餐展示与对比模块' },
              { module: 'Footer 页脚', status: '占位词汇', desc: '联系方式与合规信息' },
            ].map((item) => (
              <div key={item.module} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
                <h4 className="text-sm font-semibold tracking-normal text-white">{item.module}</h4>
                <p className="mt-2 text-sm leading-5 text-slate-400">{item.desc}</p>
                <div className="mt-3 rounded-full border border-violet-300/20 bg-violet-300/[0.08] px-2.5 py-0.5 text-xs font-semibold text-violet-100 inline-block">
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.07] px-4 py-3 text-xs leading-5 text-amber-100">
        当前为品牌治理只读视图。上传 Logo、编辑名称、更换品牌色、发布首页模块等操作需后续单独授权。
      </div>
    </section>
  );
}
