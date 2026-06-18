import { CheckCircle2, Clock, GitBranch, Globe, KeyRound, Plug, XCircle } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const sectionShell = 'rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6';

const connectorCards = [
  {
    id: 'wecom',
    name: '企业微信',
    status: '长期路线',
    statusIcon: Clock,
    statusTone: 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100',
    description: '企微会话存档、客户联系、消息推送为长期路线功能，当前不启用。',
  },
  {
    id: 'his',
    name: 'HIS 系统',
    status: '长期路线',
    statusIcon: Clock,
    statusTone: 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100',
    description: '医院信息系统对接为长期路线，涉及患者数据、预约、随访等敏感接口。',
  },
  {
    id: 'crm',
    name: 'CRM 系统',
    status: '长期路线',
    statusIcon: Clock,
    statusTone: 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100',
    description: '客户关系管理系统连接为长期路线，涉及客户数据同步和营销自动化。',
  },
  {
    id: 'third-party',
    name: '第三方平台',
    status: '长期路线',
    statusIcon: Clock,
    statusTone: 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100',
    description: '新氧、美团、抖音等医美平台集成均为长期路线规划。',
  },
  {
    id: 'wechat-pay',
    name: '微信支付',
    status: '长期路线',
    statusIcon: Clock,
    statusTone: 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100',
    description: '支付网关连接为商业化前置条件，当前不接入真实支付渠道。',
  },
  {
    id: 'sms',
    name: '短信通知',
    status: '长期路线',
    statusIcon: Clock,
    statusTone: 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100',
    description: '短信服务为长期路线，涉及合规通知和营销短信发送。',
  },
];

const capabilityTiers = [
  {
    tier: 'Phase 1 已就绪',
    color: 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100',
    items: ['租户管理只读视图', '商业化健康只读视图', '平台审计事件查询'],
  },
  {
    tier: 'Phase 2 词汇预留',
    color: 'border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100',
    items: ['API Key 生命周期', 'OAuth 应用注册', 'Webhook 配置'],
  },
  {
    tier: 'Phase 3 长期路线',
    color: 'border-violet-300/20 bg-violet-300/[0.08] text-violet-100',
    items: ['连接器一键开通', '调用量监控仪表板', '外部事件投递'],
  },
];

export function OpenConnectionRoadmapPanel() {
  return (
    <section className="space-y-5" aria-labelledby="open-connection-roadmap-heading">
      <div className={cn(sectionShell, 'overflow-hidden')}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] px-3.5 py-1.5 text-xs font-semibold text-cyan-100">
              <Plug className="h-4 w-4" />
              开放连接路线
            </div>
            <h2 id="open-connection-roadmap-heading" className="mt-4 text-2xl font-semibold tracking-normal text-white sm:text-3xl">
              开放连接路线
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              开放连接是平台长期路线核心能力模块，覆盖 API Key 管理、OAuth 应用、Webhook 和第三方集成。当前为治理词汇只读展示，不生成真实密钥、不执行回调、不投递事件。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[560px]">
            {[
              { icon: KeyRound, label: 'API Key', value: 'Not issued' },
              { icon: Globe, label: 'OAuth 应用', value: '0 个' },
              { icon: Plug, label: 'Webhook', value: '未配置' },
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

      <div className="grid gap-5 xl:grid-cols-3">
        {capabilityTiers.map((tier) => (
          <article key={tier.tier} className={sectionShell}>
            <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold', tier.color)}>
              <GitBranch className="h-3.5 w-3.5" />
              {tier.tier}
            </div>

            <ul className="mt-5 space-y-3">
              {tier.items.map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#071322]/72 px-4 py-3 text-sm text-slate-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <article className={sectionShell}>
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-300/[0.12] text-violet-200">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-white">连接器路线一览</h3>
            <p className="mt-1 text-sm text-slate-400">所有连接器处于长期路线状态，当前不提供真实接入。</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {connectorCards.map((conn) => {
            const Icon = conn.statusIcon;
            return (
              <div key={conn.id} className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-semibold tracking-normal text-white">{conn.name}</h4>
                  <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold', conn.statusTone)}>
                    <Icon className="h-3 w-3" />
                    {conn.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-5 text-slate-400">{conn.description}</p>
              </div>
            );
          })}
        </div>
      </article>

      <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.07] px-4 py-3 text-xs leading-5 text-amber-100">
        开放连接为长期路线只读词汇。API Key 生成、OAuth 授权回调、Webhook 投递、第三方集成的一键开通和调用量监控均为后续迭代内容，需单独授权后方可推进。
      </div>
    </section>
  );
}
