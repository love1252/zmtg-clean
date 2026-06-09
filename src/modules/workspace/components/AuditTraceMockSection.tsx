'use client';

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileSearch,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';

type AuditTraceGroupKey = 'opportunity' | 'manual' | 'dashboard';
type AuditTraceTone = 'blue' | 'amber' | 'rose' | 'emerald' | 'violet' | 'cyan' | 'slate';

type AuditTraceMockItem = {
  id: string;
  group: AuditTraceGroupKey;
  eventName: string;
  eventTypeLabel: string;
  opportunityType?: '复诊提醒' | '复购机会' | '沉睡客户机会';
  auditObjectId: string;
  customerDisplayName: string;
  operatorDisplayName: '操作员甲' | 'OPERATOR-DEMO-001' | 'SYSTEM-MOCK';
  mockTime: string;
  source: string;
  result: string;
  reasonSummary: string;
  statusBefore?: string;
  statusAfter?: string;
  demoFlag: 'mock' | 'seed' | 'demo';
  tone: AuditTraceTone;
};

const auditTraceToneClasses = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
} satisfies Record<AuditTraceTone, string>;

const auditTraceGroups = {
  opportunity: {
    title: '机会进入待确认',
    description: '覆盖复诊提醒、复购机会和沉睡客户机会进入统一人工确认前的审计样例。',
    helper: '三类机会',
    icon: ClipboardList,
    toneClass: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  manual: {
    title: '人工确认动作',
    description: '展示已确认、转内部处理、形成意向、进入观察、忽略和过期等动作样例。',
    helper: '人工确认',
    icon: ListChecks,
    toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  dashboard: {
    title: '看板指标来源',
    description: '展示基础运营看板指标来源如何后续进入审计追踪的低敏样例。',
    helper: '指标来源',
    icon: BarChart3,
    toneClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  },
} satisfies Record<
  AuditTraceGroupKey,
  {
    title: string;
    description: string;
    helper: string;
    icon: typeof ClipboardList;
    toneClass: string;
  }
>;

const auditTraceMockItems: AuditTraceMockItem[] = [
  {
    id: 'audit-revisit-pending-demo',
    group: 'opportunity',
    eventName: '复诊提醒进入待人工确认',
    eventTypeLabel: '机会进入待确认',
    opportunityType: '复诊提醒',
    auditObjectId: 'OPP-DEMO-001',
    customerDisplayName: '客户甲',
    operatorDisplayName: '操作员甲',
    mockTime: '2026-06-09 10:00 mock / 试运行时间',
    source: '三类机会 UI mock',
    result: '已进入待确认',
    reasonSummary: '治疗后 D7 状态确认进入内部判断窗口，仅展示低敏提醒摘要。',
    statusBefore: 'suggested mock',
    statusAfter: 'pending_confirmation mock',
    demoFlag: 'mock',
    tone: 'blue',
  },
  {
    id: 'audit-repurchase-pending-seed',
    group: 'opportunity',
    eventName: '复购机会进入待人工确认',
    eventTypeLabel: '机会进入待确认',
    opportunityType: '复购机会',
    auditObjectId: 'OPP-DEMO-002',
    customerDisplayName: 'CUST-DEMO-021',
    operatorDisplayName: 'OPERATOR-DEMO-001',
    mockTime: '2026-06-09 10:08 mock / 试运行时间',
    source: '三类机会 UI mock',
    result: '已进入待确认',
    reasonSummary: '项目周期进入复购观察窗口，不展示支付、金额或促销话术。',
    statusBefore: 'suggested seed',
    statusAfter: 'pending_confirmation seed',
    demoFlag: 'seed',
    tone: 'amber',
  },
  {
    id: 'audit-dormant-pending-demo',
    group: 'opportunity',
    eventName: '沉睡客户机会进入待人工确认',
    eventTypeLabel: '机会进入待确认',
    opportunityType: '沉睡客户机会',
    auditObjectId: 'OPP-DEMO-003',
    customerDisplayName: '客户丁',
    operatorDisplayName: 'SYSTEM-MOCK',
    mockTime: '2026-06-09 10:16 mock / 试运行时间',
    source: '三类机会 UI mock',
    result: '已进入待确认',
    reasonSummary: '60 天沉睡观察为试运行口径，不代表自动唤醒或外部触达。',
    statusBefore: 'suggested demo',
    statusAfter: 'pending_confirmation demo',
    demoFlag: 'demo',
    tone: 'rose',
  },
  {
    id: 'audit-manual-confirmed-demo',
    group: 'manual',
    eventName: '人工确认',
    eventTypeLabel: '人工确认动作',
    opportunityType: '复诊提醒',
    auditObjectId: 'CONFIRM-DEMO-001',
    customerDisplayName: '客户甲',
    operatorDisplayName: '操作员甲',
    mockTime: '2026-06-09 10:20 mock / 试运行时间',
    source: '统一人工确认 UI mock',
    result: '已确认',
    reasonSummary: '内部人员确认继续处理方向，不代表已联系客户。',
    statusBefore: '待人工确认',
    statusAfter: '已确认',
    demoFlag: 'mock',
    tone: 'emerald',
  },
  {
    id: 'audit-manual-followup-demo',
    group: 'manual',
    eventName: '人工确认后转内部随访',
    eventTypeLabel: '人工确认动作',
    opportunityType: '复诊提醒',
    auditObjectId: 'CONFIRM-DEMO-002',
    customerDisplayName: '客户甲',
    operatorDisplayName: '操作员甲',
    mockTime: '2026-06-09 10:24 mock / 试运行时间',
    source: '统一人工确认 UI mock',
    result: '已转内部随访',
    reasonSummary: '形成内部随访方向，不等于外部消息发送。',
    statusBefore: '已确认',
    statusAfter: '已转内部随访',
    demoFlag: 'mock',
    tone: 'blue',
  },
  {
    id: 'audit-manual-internal-follow-seed',
    group: 'manual',
    eventName: '人工确认后转内部跟进',
    eventTypeLabel: '人工确认动作',
    opportunityType: '复购机会',
    auditObjectId: 'CONFIRM-DEMO-003',
    customerDisplayName: 'CUST-DEMO-021',
    operatorDisplayName: 'OPERATOR-DEMO-001',
    mockTime: '2026-06-09 10:28 mock / 试运行时间',
    source: '统一人工确认 UI mock',
    result: '已转内部跟进',
    reasonSummary: '仅形成内部运营承接，不自动营销、不发送外部消息。',
    statusBefore: '已确认',
    statusAfter: '已转内部跟进',
    demoFlag: 'seed',
    tone: 'violet',
  },
  {
    id: 'audit-manual-appointment-intent-demo',
    group: 'manual',
    eventName: '人工确认后形成预约意向',
    eventTypeLabel: '人工确认动作',
    opportunityType: '复诊提醒',
    auditObjectId: 'CONFIRM-DEMO-004',
    customerDisplayName: '客户甲',
    operatorDisplayName: '操作员甲',
    mockTime: '2026-06-09 10:32 mock / 试运行时间',
    source: '统一人工确认 UI mock',
    result: '已形成预约意向',
    reasonSummary: '预约意向只代表内部方向，不创建真实预约、不同步 HIS。',
    statusBefore: '已确认',
    statusAfter: '已形成预约意向',
    demoFlag: 'demo',
    tone: 'emerald',
  },
  {
    id: 'audit-manual-repurchase-intent-seed',
    group: 'manual',
    eventName: '人工确认后形成复购意向',
    eventTypeLabel: '人工确认动作',
    opportunityType: '复购机会',
    auditObjectId: 'CONFIRM-DEMO-005',
    customerDisplayName: '客户丙',
    operatorDisplayName: 'OPERATOR-DEMO-001',
    mockTime: '2026-06-09 10:36 mock / 试运行时间',
    source: '统一人工确认 UI mock',
    result: '已形成复购意向',
    reasonSummary: '复购意向只代表内部判断，不代表真实成交或真实营收。',
    statusBefore: '已确认',
    statusAfter: '已形成复购意向',
    demoFlag: 'seed',
    tone: 'amber',
  },
  {
    id: 'audit-manual-wake-observation-demo',
    group: 'manual',
    eventName: '沉睡客户进入唤醒观察',
    eventTypeLabel: '人工确认动作',
    opportunityType: '沉睡客户机会',
    auditObjectId: 'CONFIRM-DEMO-006',
    customerDisplayName: 'CUST-DEMO-090',
    operatorDisplayName: 'SYSTEM-MOCK',
    mockTime: '2026-06-09 10:40 mock / 试运行时间',
    source: '统一人工确认 UI mock',
    result: '已进入唤醒观察',
    reasonSummary: '仅进入内部观察，不自动唤醒、不自动外呼。',
    statusBefore: '待人工确认',
    statusAfter: '已进入唤醒观察',
    demoFlag: 'demo',
    tone: 'rose',
  },
  {
    id: 'audit-manual-dismissed-mock',
    group: 'manual',
    eventName: '人工确认后忽略',
    eventTypeLabel: '人工确认动作',
    opportunityType: '沉睡客户机会',
    auditObjectId: 'CONFIRM-DEMO-007',
    customerDisplayName: '客户丁',
    operatorDisplayName: '操作员甲',
    mockTime: '2026-06-09 10:44 mock / 试运行时间',
    source: '统一人工确认 UI mock',
    result: '已忽略',
    reasonSummary: '本次内部暂不处理，保留低敏原因摘要避免无痕丢弃。',
    statusBefore: '待人工确认',
    statusAfter: '已忽略',
    demoFlag: 'mock',
    tone: 'slate',
  },
  {
    id: 'audit-manual-expired-mock',
    group: 'manual',
    eventName: '人工确认对象过期',
    eventTypeLabel: '人工确认动作',
    opportunityType: '复购机会',
    auditObjectId: 'CONFIRM-DEMO-008',
    customerDisplayName: 'CUST-DEMO-021',
    operatorDisplayName: 'SYSTEM-MOCK',
    mockTime: '2026-06-09 10:48 mock / 试运行时间',
    source: '统一人工确认 UI mock',
    result: '已过期',
    reasonSummary: '处理窗口已过的试运行展示，不实现自动过期任务。',
    statusBefore: '待人工确认',
    statusAfter: '已过期',
    demoFlag: 'mock',
    tone: 'slate',
  },
  {
    id: 'audit-dashboard-pending-total-demo',
    group: 'dashboard',
    eventName: '待确认机会总数来源记录',
    eventTypeLabel: '指标来源记录',
    auditObjectId: 'METRIC-DEMO-001',
    customerDisplayName: 'mock 聚合对象',
    operatorDisplayName: 'SYSTEM-MOCK',
    mockTime: '2026-06-09 10:52 mock / 试运行时间',
    source: '基础运营看板指标 UI mock',
    result: '待确认机会总数来源',
    reasonSummary: '仅说明 mock 指标来源，不读取真实数据、不做 dashboard aggregation。',
    demoFlag: 'mock',
    tone: 'cyan',
  },
  {
    id: 'audit-dashboard-confirmed-seed',
    group: 'dashboard',
    eventName: '已确认机会来源记录',
    eventTypeLabel: '指标来源记录',
    auditObjectId: 'METRIC-DEMO-002',
    customerDisplayName: 'mock 聚合对象',
    operatorDisplayName: 'SYSTEM-MOCK',
    mockTime: '2026-06-09 10:56 mock / 试运行时间',
    source: '基础运营看板指标 UI mock',
    result: '已确认机会来源',
    reasonSummary: '展示已确认口径后续可追踪，不代表真实统计。',
    demoFlag: 'seed',
    tone: 'emerald',
  },
  {
    id: 'audit-dashboard-appointment-demo',
    group: 'dashboard',
    eventName: '预约意向指标来源记录',
    eventTypeLabel: '指标来源记录',
    auditObjectId: 'METRIC-DEMO-003',
    customerDisplayName: 'mock 聚合对象',
    operatorDisplayName: 'SYSTEM-MOCK',
    mockTime: '2026-06-09 11:00 mock / 试运行时间',
    source: '基础运营看板指标 UI mock',
    result: '已形成预约意向来源',
    reasonSummary: '仅展示内部意向来源，不创建真实预约。',
    demoFlag: 'demo',
    tone: 'blue',
  },
  {
    id: 'audit-dashboard-repurchase-seed',
    group: 'dashboard',
    eventName: '复购意向指标来源记录',
    eventTypeLabel: '指标来源记录',
    auditObjectId: 'METRIC-DEMO-004',
    customerDisplayName: 'mock 聚合对象',
    operatorDisplayName: 'SYSTEM-MOCK',
    mockTime: '2026-06-09 11:04 mock / 试运行时间',
    source: '基础运营看板指标 UI mock',
    result: '已形成复购意向来源',
    reasonSummary: '仅展示内部复购方向来源，不代表真实成交。',
    demoFlag: 'seed',
    tone: 'amber',
  },
  {
    id: 'audit-dashboard-exception-demo',
    group: 'dashboard',
    eventName: '异常指标来源记录',
    eventTypeLabel: '指标来源记录',
    auditObjectId: 'METRIC-DEMO-005',
    customerDisplayName: 'mock 聚合对象',
    operatorDisplayName: 'SYSTEM-MOCK',
    mockTime: '2026-06-09 11:08 mock / 试运行时间',
    source: '基础运营看板指标 UI mock',
    result: '异常指标来源',
    reasonSummary: '来源信息不完整时仅作内部参考，暂不计入审计样例。',
    demoFlag: 'demo',
    tone: 'rose',
  },
];

const auditTraceExceptionStates = [
  '审计来源不完整，仅作内部参考',
  '审计对象缺失，暂不进入审计追踪',
  '审计结果异常，暂不计入审计样例',
  '当前包含演示 / mock 数据，仅用于内部验证',
] as const;

const auditTraceBoundaryTags = [
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
  '不代表真实审计记录',
  '不展示真实操作人',
  '不展示真实审计日志 ID',
] as const;

const auditTraceRelationCards = [
  {
    title: '人工确认关系',
    description:
      '人工确认动作后续可进入审计追踪，但当前不写入审计 runtime。',
    icon: ListChecks,
    toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  {
    title: '看板关系',
    description:
      '看板指标来源后续可用于审计追踪，但当前不读取真实数据、不做真实统计。',
    icon: BarChart3,
    toneClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  },
  {
    title: '审计字段说明',
    description:
      '审计记录后续可包含操作人、动作、对象、时间、来源、结果，但当前仅展示低敏 mock 字段。',
    icon: FileSearch,
    toneClass: 'border-violet-200 bg-violet-50 text-violet-700',
  },
] as const;

export function AuditTraceMockSection() {
  return (
    <section className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-600/20">
            <FileSearch className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-slate-950">
              审计追踪
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              用于演示三类机会、人工确认动作和看板指标来源的低敏审计追踪样例，不代表真实审计记录。
            </p>
          </div>
        </div>
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
          UI mock-only
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <article className="rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-4 text-sm leading-6 text-violet-800">
          当前为演示 / mock 数据，仅用于内部验证，不代表生产数据。审计事件、对象、操作人和时间均为试运行口径，不代表生产审计记录。
        </article>
        <article className="rounded-2xl border border-slate-200/80 bg-white/86 px-4 py-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm leading-6 text-slate-600">
              当前只展示低敏 demo / mock / seed 审计样例；不调用 API、不写 SQL、不做 dashboard aggregation、不读取真实数据、不写入审计 runtime。
            </p>
          </div>
        </article>
      </div>

      <div className="mt-5 grid gap-4">
        {(['opportunity', 'manual', 'dashboard'] as const).map((groupKey) => (
          <AuditTraceGroupPanel
            key={groupKey}
            groupKey={groupKey}
            items={auditTraceMockItems.filter((item) => item.group === groupKey)}
          />
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            <div>
              <h3 className="text-sm font-semibold tracking-normal text-slate-950">
                暂无审计追踪样例
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                当前没有进入 mock 审计口径的机会、人工确认动作或看板指标来源。
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
                {auditTraceExceptionStates.map((item) => (
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
        {auditTraceRelationCards.map((item) => {
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
        <h3 className="text-sm font-semibold tracking-normal text-slate-950">审计边界</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {auditTraceBoundaryTags.map((label) => (
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

function AuditTraceGroupPanel({
  groupKey,
  items,
}: {
  groupKey: AuditTraceGroupKey;
  items: AuditTraceMockItem[];
}) {
  const copy = auditTraceGroups[groupKey];
  const GroupIcon = copy.icon;

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white/86 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-2xl border ${copy.toneClass}`}>
            <GroupIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-normal text-slate-950">
              {copy.title}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{copy.description}</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${copy.toneClass}`}>
          {copy.helper}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <AuditTraceCard key={item.id} item={item} />
        ))}
      </div>
    </article>
  );
}

function AuditTraceCard({ item }: { item: AuditTraceMockItem }) {
  const toneClass = auditTraceToneClasses[item.tone];

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
          {item.eventTypeLabel}
        </span>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
          {item.demoFlag}
        </span>
      </div>

      <h4 className="mt-4 text-base font-semibold tracking-normal text-slate-950">
        {item.eventName}
      </h4>

      <dl className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        <div>
          <dt className="text-xs font-semibold text-slate-400">mock 对象</dt>
          <dd>{item.auditObjectId}</dd>
        </div>
        {item.opportunityType ? (
          <div>
            <dt className="text-xs font-semibold text-slate-400">机会类型</dt>
            <dd>{item.opportunityType}</dd>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-slate-400">客户展示</dt>
            <dd>{item.customerDisplayName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-400">mock 操作人</dt>
            <dd>{item.operatorDisplayName}</dd>
          </div>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">mock 时间</dt>
          <dd>{item.mockTime}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">来源</dt>
          <dd>{item.source}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-400">结果</dt>
          <dd>{item.result}</dd>
        </div>
        {item.statusBefore || item.statusAfter ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-slate-400">前置状态</dt>
              <dd>{item.statusBefore ?? 'mock 未展示'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-400">后置状态</dt>
              <dd>{item.statusAfter ?? 'mock 未展示'}</dd>
            </div>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-semibold text-slate-400">低敏备注摘要</dt>
          <dd>{item.reasonSummary}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
          <FileSearch className="h-3.5 w-3.5" />
          事件类型为 UI 文案
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          不代表真实审计记录
        </span>
      </div>
    </article>
  );
}
