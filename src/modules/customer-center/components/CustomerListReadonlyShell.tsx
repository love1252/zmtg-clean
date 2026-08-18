import Link from 'next/link';

import {
  CUSTOMER_LIST_MAX_PAGE_V1,
  type CustomerListReaderResultV1,
} from '@/modules/customer-center/application/customer-list-reader';
import type {
  CustomerListLifecycleV1,
  CustomerListPriorityV1,
} from '@/modules/customer-center/ports/customer-list-source';

type CustomerListReadyResultV1 = Extract<
  CustomerListReaderResultV1,
  { kind: 'ready' }
>;

const lifecycleLabels = Object.freeze({
  consulting: '咨询中',
  scheduled: '已预约',
  post_care: '术后关怀',
  repurchase_window: '复购窗口',
  silent_reactivation: '沉默唤醒',
} as const);

const priorityLabels = Object.freeze({
  high: '高优先级',
  medium: '中优先级',
  observe: '持续观察',
} as const);

function pageHref(
  page: number,
  lifecycle: CustomerListLifecycleV1 | null,
  priority: CustomerListPriorityV1 | null,
) {
  const params = new URLSearchParams({ page: String(page) });
  if (lifecycle) params.set('lifecycle', lifecycle);
  if (priority) params.set('priority', priority);
  return `/hospital/customers?${params.toString()}`;
}

export function CustomerListReadonlyShell({
  lifecycle,
  priority,
  result,
  operational,
}: Readonly<{
  lifecycle: CustomerListLifecycleV1 | null;
  priority: CustomerListPriorityV1 | null;
  result: CustomerListReadyResultV1;
  operational: boolean;
}>) {
  return (
    <section className="space-y-5" aria-labelledby="customer-list-title">
      <header className="rounded-[28px] border border-white/80 bg-white/90 px-6 py-6 shadow-xl shadow-slate-200/50">
        <p className="text-xs font-semibold tracking-[0.16em] text-cyan-700">
          {operational ? 'CONTROLLED WRITE' : 'READ ONLY'}
        </p>
        <h1 id="customer-list-title" className="mt-2 text-2xl font-bold text-slate-950">
          客户列表
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {operational
            ? `当前共展示 ${result.records.length} 条低敏客户记录；具备权限的账号可进入详情执行受控操作。`
            : `当前共展示 ${result.records.length} 条低敏客户记录，仅供查看。`}
        </p>
      </header>

      {result.records.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center text-sm text-slate-600">
          当前页暂无客户记录
        </div>
      ) : (
        <ul
          className="grid gap-3"
          aria-label={operational ? '客户记录' : '客户只读记录'}
        >
          {result.records.map((record) => (
            <li
              key={record.customerId}
              className="rounded-[24px] border border-white/90 bg-white/90 px-5 py-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">{record.displayName}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {lifecycleLabels[record.lifecycle]} · {priorityLabels[record.priority]}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <time className="text-xs text-slate-500" dateTime={record.updatedAt}>
                    更新于 {record.updatedAt}
                  </time>
                  {operational ? (
                    <Link
                      href={`/hospital/customers/${encodeURIComponent(
                        record.customerId,
                      )}`}
                      className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800"
                    >
                      查看 / 操作
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="客户列表分页" className="flex items-center justify-between gap-3">
        {result.pageInfo.page > 1 ? (
          <Link
            href={pageHref(
              result.pageInfo.page - 1,
              lifecycle,
              priority,
            )}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            上一页
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm text-slate-500">第 {result.pageInfo.page} 页</span>
        {result.pageInfo.hasMore &&
        result.pageInfo.page < CUSTOMER_LIST_MAX_PAGE_V1 ? (
          <Link
            href={pageHref(
              result.pageInfo.page + 1,
              lifecycle,
              priority,
            )}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            下一页
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </section>
  );
}
