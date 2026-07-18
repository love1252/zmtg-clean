import type { InstitutionAiUsageReadonlyViewModel } from '@/modules/institution-system/domain/ai-usage-readonly-view';

const statusMessages = {
  no_data: '权威来源明确无可展示数据。',
  partial: 'AI 使用数据不完整，暂不展示汇总数字。',
  too_many: '记录超过安全读取上限，暂不展示汇总数字。',
  unavailable: '当前无法核验 AI 使用来源。',
} as const;

type InstitutionAiUsageReadonlyPanelProps = Readonly<{
  view: InstitutionAiUsageReadonlyViewModel;
}>;

export function InstitutionAiUsageReadonlyPanel({
  view,
}: InstitutionAiUsageReadonlyPanelProps) {
  return (
    <section aria-labelledby="institution-ai-usage-title" className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm font-medium text-slate-600">只读展示</p>
        <h2 id="institution-ai-usage-title" className="text-xl font-semibold text-slate-950">
          AI 使用概览
        </h2>
      </header>

      {view.kind !== 'ready' ? (
        <p role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {statusMessages[view.kind]}
        </p>
      ) : (
        <>
          <dl aria-label="AI 使用汇总" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="真实调用次数" value={view.summary.totalCallCount} />
            <Metric label="成功率" value={view.summary.successRate} />
            <Metric label="失败" value={view.summary.failureCount} />
            <Metric label="拒绝" value={view.summary.rejectionCount} />
            <Metric label="未完成" value={view.summary.incompleteCount} />
          </dl>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table aria-label="按业务服务汇总" className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">业务服务</th>
                  <th scope="col" className="px-4 py-3 font-medium">调用次数</th>
                  <th scope="col" className="px-4 py-3 font-medium">成功率</th>
                  <th scope="col" className="px-4 py-3 font-medium">失败</th>
                  <th scope="col" className="px-4 py-3 font-medium">拒绝</th>
                  <th scope="col" className="px-4 py-3 font-medium">未完成</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {view.byServiceKey.map((summary) => (
                  <tr key={summary.serviceKey}>
                    <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium">
                      {summary.serviceKey}
                    </th>
                    <td className="px-4 py-3">{summary.totalCallCount}</td>
                    <td className="px-4 py-3">{summary.successRate}</td>
                    <td className="px-4 py-3">{summary.failureCount}</td>
                    <td className="px-4 py-3">{summary.rejectionCount}</td>
                    <td className="px-4 py-3">{summary.incompleteCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
