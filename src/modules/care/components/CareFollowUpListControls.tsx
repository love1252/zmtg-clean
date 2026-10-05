'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { FORMAL_FOLLOW_UP_PAGE_SIZES } from '@/modules/care/application/formal-follow-up-list-query';
import {
  formalFollowUpListHrefV1,
  parseFormalFollowUpPageQueryV1,
  type FormalFollowUpListPageV1,
} from '@/modules/care/application/formal-follow-up-list-navigation';

const states = [
  ['pending', '待执行'], ['in_progress', '进行中'], ['waiting_customer', '等待客户'],
  ['escalated', '风险升级'], ['completed', '已完成'], ['cancelled', '已取消'],
] as const;
const buttonClass = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-40';
const inputClass = 'min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

export function CareFollowUpListControls({
  list, children,
}: { list: FormalFollowUpListPageV1; children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { query, pageInfo, summary } = list;
  const [keyword, setKeyword] = useState(query.keyword ?? '');
  const [dueBucket, setDueBucket] = useState(query.dueBucket ?? '');
  const go = (next: typeof query) => {
    setError(null);
    startTransition(() => router.push(formalFollowUpListHrefV1(next), { scroll: false }));
  };
  const submitFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = parseFormalFollowUpPageQueryV1({
      page: '1', pageSize: String(query.pageSize),
      ...(query.state ? { state: query.state } : {}),
      ...(dueBucket ? { dueBucket } : {}),
      ...(keyword.trim() ? { q: keyword.trim() } : {}),
    });
    if (!next) { setError('客户查询最多 80 个字符，不能包含控制字符。'); return; }
    go(next);
  };
  const lastPage = Math.max(1, pageInfo.pageCount);
  const pages = [...new Set([1, query.page - 1, query.page, query.page + 1, lastPage])]
    .filter((page) => page >= 1 && page <= lastPage).sort((a, b) => a - b);

  return (
    <section aria-label="随访查询结果" aria-busy={pending} className="space-y-4">
      <fieldset disabled={pending} className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
        <legend className="sr-only">随访筛选</legend>
        <div role="group" aria-label="任务状态" className="flex flex-wrap gap-2">
          {([['', '全部'], ...states] as const).map(([state, label]) => (
            <button key={state} type="button" aria-pressed={(query.state ?? '') === state}
              className={`${buttonClass} aria-pressed:border-blue-700 aria-pressed:bg-blue-50 aria-pressed:text-blue-700`}
              onClick={() => go({ ...query, page: 1, state: state || null })}>{label}</button>
          ))}
        </div>
        <form onSubmit={submitFilters} className="flex flex-wrap items-end gap-3">
          <label className="grid flex-1 gap-1 text-xs text-slate-600">
            客户
            <input className={inputClass} value={keyword} onChange={(event) => setKeyword(event.target.value)} maxLength={80} placeholder="客户名称或脱敏编号" />
          </label>
          <label className="grid gap-1 text-xs text-slate-600">
            到期范围
            <select className={inputClass} value={dueBucket} disabled={summary.dueBucketCounts === null}
              onChange={(event) => setDueBucket(event.target.value)}>
              <option value="">全部到期范围</option><option value="overdue">已逾期</option>
              <option value="due_today">今日到期</option><option value="not_due">尚未到期</option>
            </select>
          </label>
          <button className={buttonClass} type="submit">查询</button>
          <button className={buttonClass} type="button" onClick={() => {
            setKeyword(''); setDueBucket(''); go({ ...query, page: 1, state: null, dueBucket: null, keyword: null });
          }}>清除筛选</button>
        </form>
      </fieldset>
      {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
      {pending ? <p role="status" className="rounded-2xl border bg-white p-6 text-sm">正在加载随访任务…</p> : <>
        <section aria-label="当前筛选统计" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([
            ['当前筛选总数', summary.total], ['已逾期', summary.dueBucketCounts?.overdue ?? '—'],
            ['今日到期', summary.dueBucketCounts?.due_today ?? '—'], ['尚未到期', summary.dueBucketCounts?.not_due ?? '—'],
          ] as const).map(([label, count]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{count}</p>
          </div>)}
        </section>
        <p className="text-xs text-slate-500">统计涵盖全部符合当前筛选的任务；已完成、已取消不计入到期数量。{summary.dueBucketCounts === null ? '机构时区暂不可用，到期统计与筛选暂停。' : ''}</p>
        {children}
        {pageInfo.total === 0 ? <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">当前筛选下没有随访任务。</p>
          : query.page > pageInfo.pageCount ? <div role="status" className="space-y-3 rounded-2xl border p-6 text-sm">
            <p>当前页超出结果范围，符合筛选的任务共 {pageInfo.total} 条。</p>
            <button type="button" className={buttonClass} onClick={() => go({ ...query, page: lastPage })}>返回最后一页</button>
          </div> : null}
        <nav aria-label="随访分页" className="flex flex-wrap items-center gap-3 text-sm">
          <p>当前筛选 {pageInfo.total} 条 · 第 {pageInfo.total === 0 ? 0 : pageInfo.page} / {pageInfo.pageCount} 页</p>
          <label className="flex items-center gap-2">每页显示
            <select className={inputClass} value={query.pageSize} onChange={(event) => go({ ...query, page: 1, pageSize: Number(event.target.value) as typeof query.pageSize })}>
              {FORMAL_FOLLOW_UP_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} 条</option>)}
            </select>
          </label>
          <button type="button" className={buttonClass} disabled={query.page <= 1 || pageInfo.pageCount === 0} onClick={() => go({ ...query, page: Math.min(query.page - 1, lastPage) })}>上一页</button>
          {pages.map((page, index) => <span key={page} className="inline-flex items-center gap-3">
            {index > 0 && page - pages[index - 1] > 1 ? <span>…</span> : null}
            <button type="button" className={buttonClass} aria-label={`随访第 ${page} 页`} aria-current={query.page === page ? 'page' : undefined} disabled={query.page === page || pageInfo.pageCount === 0} onClick={() => go({ ...query, page })}>{page}</button>
          </span>)}
          <button type="button" className={buttonClass} disabled={!pageInfo.hasMore} onClick={() => go({ ...query, page: query.page + 1 })}>下一页</button>
        </nav>
      </>}
    </section>
  );
}
