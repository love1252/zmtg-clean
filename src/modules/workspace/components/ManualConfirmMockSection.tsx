'use client';

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileSearch,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';

type ManualConfirmSubjectType = '复诊提醒' | '复购机会' | '沉睡客户机会';

type ManualConfirmMockItem = {
  id: string;
  customerDisplayName: string;
  subjectType: ManualConfirmSubjectType;
  sourceSummary: string;
  confirmationReason: string;
  recommendedAction: string;
  processingWindow: string;
  priority: '低' | '中' | '高';
  currentStatus: '待人工确认';
  demoFlag: 'mock' | 'seed' | 'demo';
  lowSensitiveNotes: string;
  allowedActions: readonly string[];
};

const subjectToneClasses = {
  复诊提醒: 'border-blue-200 bg-blue-50 text-blue-700',
  复购机会: 'border-amber-200 bg-amber-50 text-amber-700',
  沉睡客户机会: 'border-rose-200 bg-rose-50 text-rose-700',
} satisfies Record<ManualConfirmSubjectType, string>;

const manualConfirmMockItems: ManualConfirmMockItem[] = [
  {
    id: 'manual-confirm-revisit-demo-d7',
    customerDisplayName: '客户甲',
    subjectType: '复诊提醒',
    sourceSummary: '治疗后摘要 · D7 状态确认 · 路径模板',
    confirmationReason: '复诊提醒进入待确认窗口，需要内部人员判断处理方向。',
    recommendedAction: '先转内部随访任务，再由人工确认是否形成预约意向。',
    processingWindow: 'D7 复查窗口',
    priority: '高',
    currentStatus: '待人工确认',
    demoFlag: 'mock',
    lowSensitiveNotes: '仅展示治疗后阶段和提醒窗口，不展示病历正文或联系方式。',
    allowedActions: ['转内部随访任务', '形成预约意向', '继续观察', '忽略'],
  },
  {
    id: 'manual-confirm-repurchase-seed-d28',
    customerDisplayName: 'CUST-DEMO-021',
    subjectType: '复购机会',
    sourceSummary: '项目周期 · 复购窗口 · 生命周期摘要',
    confirmationReason: '复购机会仅为内部提示，需人工确认是否继续跟进。',
    recommendedAction: '由运营负责人确认来源，再选择内部跟进或复购意向。',
    processingWindow: 'D28 复购观察窗口',
    priority: '中',
    currentStatus: '待人工确认',
    demoFlag: 'seed',
    lowSensitiveNotes: '不展示支付、金额、促销话术或真实成交信息。',
    allowedActions: ['转内部跟进', '形成复购意向', '继续观察', '忽略'],
  },
  {
    id: 'manual-confirm-dormant-demo-60d',
    customerDisplayName: '客户丁',
    subjectType: '沉睡客户机会',
    sourceSummary: '最后随访 · 60 天未互动 · 试运行观察',
    confirmationReason: '沉睡客户观察不等于自动唤醒，只用于内部人员判断。',
    recommendedAction: '先进入唤醒观察，必要时人工转内部跟进。',
    processingWindow: '60 天沉睡观察窗口',
    priority: '中',
    currentStatus: '待人工确认',
    demoFlag: 'demo',
    lowSensitiveNotes: '只展示最后互动类型和观察窗口，不展示完整联系方式。',
    allowedActions: ['进入唤醒观察', '转内部跟进', '继续观察', '忽略'],
  },
];

const manualConfirmResultStatuses = [
  {
    label: '待人工确认',
    note: '仅表示对象进入内部确认队列。',
  },
  {
    label: '已确认',
    note: '仅表示人工已选择处理方向。',
  },
  {
    label: '已转内部随访',
    note: '不等于外部消息发送。',
  },
  {
    label: '已转内部跟进',
    note: '不等于自动营销。',
  },
  {
    label: '已形成预约意向',
    note: '不是真实预约。',
  },
  {
    label: '已形成复购意向',
    note: '不是真实成交。',
  },
  {
    label: '已进入唤醒观察',
    note: '沉睡客户观察不等于自动唤醒。',
  },
  {
    label: '已忽略',
    note: '仅表示本次内部暂不处理。',
  },
  {
    label: '已过期',
    note: '仅为试运行状态展示。',
  },
] as const;

const manualConfirmExceptionStates = [
  '来源信息不完整，仅作内部参考',
  '确认动作缺失，暂不进入结果状态',
  '状态异常，暂不计入看板指标',
  '当前包含演示 / mock 数据，仅用于内部验证',
] as const;

const manualConfirmBoundaryTags = [
  '不调用 API',
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
] as const;

const relationNotes = [
  {
    title: '看板关系',
    description:
      '人工确认结果后续可用于待确认数量、已确认数量和内部转化状态展示；当前不做真实 dashboard 聚合。',
    icon: BarChart3,
    toneClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  },
  {
    title: '审计关系',
    description:
      '人工确认动作后续可进入审计追踪；当前仅展示未来方向，不写入审计 runtime。',
    icon: FileSearch,
    toneClass: 'border-violet-200 bg-violet-50 text-violet-700',
  },
] as const;

export function ManualConfirmMockSection() {
  return (
    <section className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              统一人工确认
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              复诊提醒、复购机会和沉睡客户机会统一进入内部人工确认，不代表客户已被触达。
            </p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
          UI mock-only
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-2xl border border-cyan-200 bg-cyan-50/80 px-4 py-4 text-sm leading-6 text-cyan-800">
          当前为受控演示 / seed / mock 数据，仅用于内部验证。确认动作和结果状态均为试运行口径，不代表生产规则。
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white/86 px-4 py-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm leading-6 text-slate-600">
              人工确认只表示内部人员选择处理方向；不会自动约诊、不会自动营销、不会发送外部消息，预约意向不是真实预约，复购意向不是真实成交。
            </p>
          </div>
        </article>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {manualConfirmMockItems.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${subjectToneClasses[item.subjectType]}`}
              >
                {item.subjectType}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                {item.demoFlag}
              </span>
            </div>

            <h3 className="mt-4 text-base font-semibold tracking-normal text-slate-950">
              {item.customerDisplayName}
            </h3>
            <dl className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <div>
                <dt className="text-xs font-semibold text-slate-400">来源摘要</dt>
                <dd>{item.sourceSummary}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-400">确认原因</dt>
                <dd>{item.confirmationReason}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-400">建议处理方向</dt>
                <dd>{item.recommendedAction}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <dt className="text-xs font-semibold text-slate-400">窗口</dt>
                  <dd>{item.processingWindow}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-400">优先级</dt>
                  <dd>{item.priority}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-400">状态</dt>
                  <dd>{item.currentStatus}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-400">低敏备注</dt>
                <dd>{item.lowSensitiveNotes}</dd>
              </div>
            </dl>

            <div className="mt-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <ListChecks className="h-3.5 w-3.5" />
                可见确认动作
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
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
            </div>

            <button
              type="button"
              disabled
              className="mt-4 h-10 w-full rounded-xl border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-500"
            >
              确认动作仅演示
            </button>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            <div>
              <h3 className="text-sm font-semibold tracking-normal text-slate-950">
                空状态 mock
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                暂无待确认事项；当前没有进入统一人工确认入口的复诊提醒、复购机会或沉睡客户机会。
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
                {manualConfirmExceptionStates.map((item) => (
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

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
          <h3 className="text-sm font-semibold tracking-normal text-slate-950">
            确认结果状态
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {manualConfirmResultStatuses.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="text-xs font-semibold text-slate-950">{item.label}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{item.note}</div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
          <h3 className="text-sm font-semibold tracking-normal text-slate-950">
            人工确认边界
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {manualConfirmBoundaryTags.map((label) => (
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

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {relationNotes.map((item) => {
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
    </section>
  );
}
