'use client';

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Gauge,
  ShieldCheck,
} from 'lucide-react';

type MetricTone = 'cyan' | 'blue' | 'amber' | 'emerald' | 'rose' | 'violet' | 'slate';

type DashboardMetricItem = {
  id: string;
  label: string;
  value: string;
  helper: string;
  bucket: string;
  tone: MetricTone;
  demoFlag: 'mock' | 'seed' | 'demo';
};

type DashboardMetricGroup = {
  title: string;
  description: string;
  metrics: DashboardMetricItem[];
};

const metricToneClasses = {
  cyan: {
    iconClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    valueClass: 'text-cyan-700',
  },
  blue: {
    iconClass: 'border-blue-200 bg-blue-50 text-blue-700',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
    valueClass: 'text-blue-700',
  },
  amber: {
    iconClass: 'border-amber-200 bg-amber-50 text-amber-700',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    valueClass: 'text-amber-700',
  },
  emerald: {
    iconClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    valueClass: 'text-emerald-700',
  },
  rose: {
    iconClass: 'border-rose-200 bg-rose-50 text-rose-700',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    valueClass: 'text-rose-700',
  },
  violet: {
    iconClass: 'border-violet-200 bg-violet-50 text-violet-700',
    badgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
    valueClass: 'text-violet-700',
  },
  slate: {
    iconClass: 'border-slate-200 bg-slate-50 text-slate-700',
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
    valueClass: 'text-slate-700',
  },
} satisfies Record<
  MetricTone,
  {
    iconClass: string;
    badgeClass: string;
    valueClass: string;
  }
>;

const dashboardMetricGroups: DashboardMetricGroup[] = [
  {
    title: '机会待确认指标',
    description: '覆盖复诊提醒、复购机会和沉睡客户机会进入人工确认前的看板入口。',
    metrics: [
      {
        id: 'pending-total-opportunities',
        label: '待确认机会总数',
        value: '12',
        helper: '当前进入人工处理范围',
        bucket: 'pending_total_opportunities',
        tone: 'cyan',
        demoFlag: 'mock',
      },
      {
        id: 'pending-revisit-reminders',
        label: '待确认复诊提醒',
        value: '4',
        helper: '复诊 / 复查 / 状态确认',
        bucket: 'pending_revisit_reminders',
        tone: 'blue',
        demoFlag: 'mock',
      },
      {
        id: 'pending-repurchase-opportunities',
        label: '待确认复购机会',
        value: '5',
        helper: '复购 / 续疗内部判断',
        bucket: 'pending_repurchase_opportunities',
        tone: 'amber',
        demoFlag: 'seed',
      },
      {
        id: 'pending-dormant-opportunities',
        label: '待确认沉睡客户机会',
        value: '3',
        helper: '沉睡阈值试运行口径',
        bucket: 'pending_dormant_opportunities',
        tone: 'rose',
        demoFlag: 'demo',
      },
    ],
  },
  {
    title: '人工确认结果指标',
    description: '展示人工确认后的内部结果方向；这些结果不代表外部动作已经发生。',
    metrics: [
      {
        id: 'manual-pending',
        label: '待确认',
        value: '12',
        helper: '等待内部人员选择方向',
        bucket: 'pending_confirmation',
        tone: 'cyan',
        demoFlag: 'mock',
      },
      {
        id: 'confirmed-opportunities',
        label: '已确认',
        value: '8',
        helper: '已由人工确认继续处理',
        bucket: 'confirmed_opportunities',
        tone: 'emerald',
        demoFlag: 'seed',
      },
      {
        id: 'converted-to-followup',
        label: '已转内部随访',
        value: '2',
        helper: '内部工作项，不是外部消息',
        bucket: 'converted_to_followup_tasks',
        tone: 'blue',
        demoFlag: 'mock',
      },
      {
        id: 'converted-to-internal-follow',
        label: '已转内部跟进',
        value: '3',
        helper: '内部运营承接，不自动营销',
        bucket: 'converted_to_internal_follow',
        tone: 'violet',
        demoFlag: 'mock',
      },
      {
        id: 'appointment-intent',
        label: '已形成预约意向',
        value: '2',
        helper: '内部预约方向，不是真实预约',
        bucket: 'converted_to_appointment_intents',
        tone: 'emerald',
        demoFlag: 'demo',
      },
      {
        id: 'repurchase-intent',
        label: '已形成复购意向',
        value: '1',
        helper: '内部判断，不是真实成交',
        bucket: 'converted_to_repurchase_intents',
        tone: 'amber',
        demoFlag: 'seed',
      },
      {
        id: 'wake-observation',
        label: '已进入唤醒观察',
        value: '2',
        helper: '仅为内部观察，不自动唤醒',
        bucket: 'wake_observation',
        tone: 'rose',
        demoFlag: 'mock',
      },
    ],
  },
  {
    title: '关闭 / 异常指标',
    description: '展示忽略、过期和异常口径；异常只作内部参考，不进入真实统计。',
    metrics: [
      {
        id: 'dismissed-opportunities',
        label: '已忽略',
        value: '1',
        helper: '内部本次暂不处理',
        bucket: 'dismissed_opportunities',
        tone: 'slate',
        demoFlag: 'seed',
      },
      {
        id: 'expired-opportunities',
        label: '已过期',
        value: '0',
        helper: '试运行状态展示',
        bucket: 'expired_opportunities',
        tone: 'slate',
        demoFlag: 'mock',
      },
      {
        id: 'exception-metrics',
        label: '异常指标',
        value: '1',
        helper: '来源或状态不足，仅内部参考',
        bucket: 'exception_metrics',
        tone: 'rose',
        demoFlag: 'demo',
      },
    ],
  },
];

const exceptionStateItems = [
  '指标来源不完整，仅作内部参考',
  '人工确认状态缺失，暂不计入指标',
  '指标口径异常，暂不计入看板',
  '当前包含演示 / mock 数据，仅用于内部验证',
] as const;

const boundaryTags = [
  '不调用 API',
  '不写 SQL',
  '不做 dashboard aggregation',
  '不读取真实数据',
  '不写入状态',
  '不创建真实任务',
  '不创建真实预约',
  '不创建真实成交',
  '不自动营销',
  '不自动触达',
  '不发送外部消息',
  '不生成医疗诊断',
  '不连接 HIS',
  '不读取真实 HIS',
  '不读取真实 credential',
  '不处理真实客户数据',
  '不写入审计 runtime',
  '不新增 audit metadata',
  '不新增 audit enum',
  '不代表真实统计',
  '不代表真实经营结果',
] as const;

const relationCards = [
  {
    title: '人工确认关系',
    description:
      '看板指标来自人工确认结果的后续展示方向，当前不写入状态、不做真实统计。',
    icon: ClipboardList,
    toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  {
    title: '审计关系',
    description:
      '指标来源和人工确认动作后续可进入审计追踪，但当前不写入审计 runtime。',
    icon: FileSearch,
    toneClass: 'border-violet-200 bg-violet-50 text-violet-700',
  },
  {
    title: '指标解释',
    description:
      '每张指标卡只展示中文指标名、mock 数值、指标桶和低敏说明；mock / demo / seed 均不代表真实统计，也不接 API、SQL 或聚合。',
    icon: Gauge,
    toneClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  },
] as const;

export function DashboardMetricsMockSection() {
  return (
    <section className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-600 text-white shadow-lg shadow-cyan-600/20">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              基础运营看板指标
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              用于演示三类机会和人工确认结果的轻量指标口径，不代表真实统计。
            </p>
          </div>
        </div>
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
          UI mock-only
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 px-4 py-4 text-sm leading-6 text-cyan-800">
          当前为演示 / mock 数据，仅用于内部验证，不代表生产数据。指标数值和趋势均为试运行口径，不代表生产规则或真实经营结果。
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white/86 px-4 py-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm leading-6 text-slate-600">
              该区块只展示低敏 demo / mock / seed 指标数据；当前不调用 API、不写 SQL、不做 dashboard aggregation、不读取真实数据。
            </p>
          </div>
        </article>
      </div>

      <div className="mt-5 grid gap-4">
        {dashboardMetricGroups.map((group) => (
          <article
            key={group.title}
            className="rounded-2xl border border-slate-200/80 bg-white/86 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold tracking-normal text-slate-950">
                  {group.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">{group.description}</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                mock / demo / seed
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {group.metrics.map((metric) => (
                <MetricCard key={metric.id} metric={metric} />
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            <div>
              <h3 className="text-sm font-semibold tracking-normal text-slate-950">
                暂无可展示的机会指标
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                当前没有进入 mock 看板口径的复诊提醒、复购机会或沉睡客户机会。
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h3 className="text-sm font-semibold tracking-normal text-amber-900">
                异常态 mock
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {exceptionStateItems.map((item) => (
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
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {relationCards.map((item) => {
          const RelationIcon = item.icon;

          return (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-200/80 bg-white/86 p-4"
            >
              <div className="flex items-start gap-3">
                <div className={`grid h-9 w-9 place-items-center rounded-xl border ${item.toneClass}`}>
                  <RelationIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-normal text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <article className="mt-5 rounded-2xl border border-slate-200/80 bg-white/86 p-4">
        <h3 className="text-sm font-semibold tracking-normal text-slate-950">边界标签</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {boundaryTags.map((label) => (
            <span
              key={label}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {label}
            </span>
          ))}
        </div>
      </article>
    </section>
  );
}

function MetricCard({ metric }: { metric: DashboardMetricItem }) {
  const tone = metricToneClasses[metric.tone];

  return (
    <article className="min-h-[190px] rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className={`grid h-9 w-9 place-items-center rounded-xl border ${tone.iconClass}`}>
          <Gauge className="h-4 w-4" />
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
          {metric.demoFlag}
        </span>
      </div>
      <div className={`mt-4 text-3xl font-semibold tracking-normal ${tone.valueClass}`}>
        {metric.value}
      </div>
      <h4 className="mt-1 text-sm font-semibold leading-5 tracking-normal text-slate-950">
        {metric.label}
      </h4>
      <p className="mt-2 text-xs leading-5 text-slate-500">{metric.helper}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.badgeClass}`}>
          {metric.bucket}
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        mock / demo / seed；不代表真实统计；不接 API / SQL / aggregation。
      </p>
    </article>
  );
}
