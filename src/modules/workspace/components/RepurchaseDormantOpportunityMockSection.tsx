'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

type OpportunityGroupKey = 'repurchase' | 'dormant';

type OpportunityMockItem = {
  id: string;
  group: OpportunityGroupKey;
  customerDisplayName: string;
  opportunityType: '复购机会' | '沉睡客户机会';
  sourceSummary: string;
  triggerReason: string;
  suggestedAction: string;
  priority: '低' | '中' | '高';
  status: '待人工确认' | '已标记继续观察' | '已人工忽略';
  trialRunNote: string;
  demoFlag: 'mock' | 'seed' | 'demo';
  lowSensitiveNotes: string;
  allowedActions: readonly string[];
};

const opportunityGroupCopy = {
  repurchase: {
    title: '复购机会',
    description: '围绕项目周期、生命周期和治疗后摘要形成轻量内部运营提示。',
    helper: '不代表成交预测',
    icon: RefreshCw,
    iconClass: 'bg-amber-500 text-white shadow-amber-500/20',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  dormant: {
    title: '沉睡客户机会',
    description: '围绕长期未预约、未到院或未随访客户形成内部判断对象。',
    helper: '阈值为试运行口径',
    icon: Clock3,
    iconClass: 'bg-rose-500 text-white shadow-rose-500/20',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
  },
} satisfies Record<
  OpportunityGroupKey,
  {
    title: string;
    description: string;
    helper: string;
    icon: typeof RefreshCw;
    iconClass: string;
    badgeClass: string;
  }
>;

const opportunityMockItems: OpportunityMockItem[] = [
  {
    id: 'repurchase-demo-skin-d28',
    group: 'repurchase',
    customerDisplayName: '客户丙',
    opportunityType: '复购机会',
    sourceSummary: '治疗后摘要 · D28 稳定期 · 皮肤管理项目周期',
    triggerReason: '复购窗口为试运行口径，仅供内部判断。',
    suggestedAction: '由咨询师人工判断是否转内部跟进或形成复购意向。',
    priority: '高',
    status: '待人工确认',
    trialRunNote: '复购窗口待产品确认，不代表生产规则。',
    demoFlag: 'mock',
    lowSensitiveNotes: '高优先级来自项目周期摘要，不使用黑箱 AI 排名。',
    allowedActions: ['可转内部跟进', '可形成复购意向', '可继续观察', '可人工忽略'],
  },
  {
    id: 'repurchase-seed-light-d21',
    group: 'repurchase',
    customerDisplayName: 'CUST-DEMO-021',
    opportunityType: '复购机会',
    sourceSummary: '客户生命周期 · 复购窗口期 · 随访满意度摘要',
    triggerReason: '轻量分层提示客户可能进入续疗判断窗口。',
    suggestedAction: '先由运营负责人确认来源，再决定是否进入内部跟进。',
    priority: '中',
    status: '已标记继续观察',
    trialRunNote: '仅用于演示指标和机会卡片，不代表真实客户意向。',
    demoFlag: 'seed',
    lowSensitiveNotes: '只展示低敏来源摘要，不展示支付、金额或促销话术。',
    allowedActions: ['可转内部跟进', '可形成复购意向', '可继续观察'],
  },
  {
    id: 'dormant-demo-60d',
    group: 'dormant',
    customerDisplayName: '客户丁',
    opportunityType: '沉睡客户机会',
    sourceSummary: '最后随访 · 60 天未互动 · 生命周期沉睡观察',
    triggerReason: '沉睡阈值为试运行口径，待产品确认。',
    suggestedAction: '由客服人工判断继续观察、内部跟进或暂不处理。',
    priority: '中',
    status: '待人工确认',
    trialRunNote: '不锁定具体沉睡天数，不代表生产唤醒规则。',
    demoFlag: 'demo',
    lowSensitiveNotes: '只展示最后互动类型和阈值层级，不展示完整联系方式。',
    allowedActions: ['可进入客户唤醒观察', '可转内部跟进', '可人工忽略'],
  },
  {
    id: 'dormant-mock-90d',
    group: 'dormant',
    customerDisplayName: 'CUST-DEMO-090',
    opportunityType: '沉睡客户机会',
    sourceSummary: '最后预约 · 90 天未到院 · 试运行观察分层',
    triggerReason: '长期未到院仅作为内部判断提示。',
    suggestedAction: '先进入客户唤醒观察，必要时人工转内部随访。',
    priority: '低',
    status: '已人工忽略',
    trialRunNote: '忽略仅代表内部本次暂不处理，建议保留低敏原因。',
    demoFlag: 'mock',
    lowSensitiveNotes: '不会自动外呼，不会发送微信、企微、短信或其他外部消息。',
    allowedActions: ['可进入客户唤醒观察', '可转内部跟进', '可人工忽略'],
  },
];

const opportunityExceptionStates = [
  '复购机会来源不完整，仅作内部参考',
  '缺少处理日期，未计入时间窗口指标',
  '缺少优先级，未计入高优先级指标',
  '沉睡阈值为试运行口径，待产品确认',
  '当前包含演示 / seed / mock 数据，仅用于内部验证',
] as const;

const automationBoundaryTags = [
  '不调用 API',
  '不自动营销',
  '不自动触达',
  '不发送外部消息',
  '不创建真实成交',
  '不生成医疗诊断',
  '不连接 HIS',
  '不读取真实 HIS',
  '沉睡客户观察不等于自动唤醒',
  '不处理真实客户数据',
] as const;

const emptyStateItems = [
  {
    title: '暂无待确认复购机会',
    description: '当前没有进入人工判断的复购 / 续疗提示，不代表没有商业价值客户。',
  },
  {
    title: '暂无待处理沉睡客户机会',
    description: '当前没有进入沉睡客户试运行口径的待处理对象，不代表全部客户都很活跃。',
  },
] as const;

export function RepurchaseDormantOpportunityMockSection() {
  return (
    <section className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              复购机会与沉睡客户机会
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              仅展示前端 mock / seed / demo 机会，用于内部人工确认入口验证。
            </p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
          UI mock-only
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 px-4 py-4 text-sm leading-6 text-cyan-800">
          当前数据为受控演示 / seed / mock 数据，仅用于内部验证。复购窗口、沉睡阈值和机会状态均为试运行口径，后续需产品确认。
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white/86 px-4 py-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm leading-6 text-slate-600">
              人工确认入口只说明内部人员可选择处理方向，不代表客户已被触达；内部跟进不是外部消息发送，复购意向不是真实成交。
            </p>
          </div>
        </article>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {(['repurchase', 'dormant'] as const).map((groupKey) => (
          <OpportunityGroupPanel
            key={groupKey}
            groupKey={groupKey}
            items={opportunityMockItems.filter((item) => item.group === groupKey)}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {emptyStateItems.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5"
          >
            <h3 className="text-sm font-semibold tracking-normal text-slate-950">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h3 className="text-sm font-semibold tracking-normal text-amber-900">
                异常态 mock
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {opportunityExceptionStates.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-amber-200 bg-white/70 px-2.5 py-1 text-xs font-semibold text-amber-800"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
          <h3 className="text-sm font-semibold tracking-normal text-slate-950">
            自动化边界
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {automationBoundaryTags.map((label) => (
              <span
                key={label}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {label}
              </span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function OpportunityGroupPanel({
  groupKey,
  items,
}: {
  groupKey: OpportunityGroupKey;
  items: OpportunityMockItem[];
}) {
  const copy = opportunityGroupCopy[groupKey];
  const GroupIcon = copy.icon;

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-2xl shadow-lg ${copy.iconClass}`}>
            <GroupIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-normal text-slate-950">
              {copy.title}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{copy.description}</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${copy.badgeClass}`}>
          {copy.helper}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${copy.badgeClass}`}>
                {item.opportunityType}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                {item.demoFlag}
              </span>
            </div>
            <h4 className="mt-4 text-base font-semibold tracking-normal text-slate-950">
              {item.customerDisplayName}
            </h4>
            <dl className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <div>
                <dt className="text-xs font-semibold text-slate-400">来源摘要</dt>
                <dd>{item.sourceSummary}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-400">触发原因</dt>
                <dd>{item.triggerReason}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-400">建议内部动作</dt>
                <dd>{item.suggestedAction}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <dt className="text-xs font-semibold text-slate-400">优先级</dt>
                  <dd>{item.priority}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-400">状态</dt>
                  <dd>{item.status}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-400">口径</dt>
                  <dd>{item.trialRunNote}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-400">低敏备注</dt>
                <dd>{item.lowSensitiveNotes}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              {item.allowedActions.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  {label}
                </span>
              ))}
            </div>

            <button
              type="button"
              disabled
              className="mt-4 h-10 w-full rounded-xl border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-500"
            >
              进入人工确认（演示）
            </button>
          </article>
        ))}
      </div>
    </article>
  );
}
