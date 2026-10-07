'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { completionLabel } from '@/modules/care/components/CareFollowUpCompletionForm';
import { FOLLOW_UP_COMPLETION_CODES, parseFollowUpManualFeedback } from '@/modules/care/domain/follow-up-completion-result';
import { FOLLOW_UP_TASK_STATES } from '@/modules/care/domain/follow-up-task';

const count = z.number().int().nonnegative().safe();
const labels = { pending: '待执行', in_progress: '进行中', waiting_customer: '等待客户', escalated: '风险升级', completed: '已完成', cancelled: '已取消' };
const schema = z.object({
  kind: z.literal('ready'), customerId: z.string(),
  records: z.array(z.object({
    taskId: z.string(), customer: z.object({ customerId: z.string() }),
    state: z.enum(FOLLOW_UP_TASK_STATES), dueAt: z.string().datetime(),
    completionCode: z.enum(FOLLOW_UP_COMPLETION_CODES).nullable(),
    completionFeedback: z.unknown().transform(value => value == null ? null : parseFollowUpManualFeedback(value)),
    updatedAt: z.string().datetime(),
  })),
  pageInfo: z.object({ page: count.positive(), pageSize: count.positive(), total: count, pageCount: count, hasMore: z.boolean() }),
  summary: z.object({ total: count, stateCounts: z.object({ pending: count, in_progress: count, waiting_customer: count, escalated: count, completed: count, cancelled: count }),
    dueBucketCounts: z.object({ overdue: count, due_today: count, not_due: count }).nullable() }),
});
type Data = z.infer<typeof schema>;
const control = 'rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50';
const dateLabel = (value: string) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
export function CustomerFollowUpPanel({ customerId }: { customerId: string }) {
  return <Panel key={customerId} customerId={customerId} />;
}
function Panel({ customerId }: { customerId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState('');
  const [state, setState] = useState(''), [page, setPage] = useState(1);
  const sequence = useRef(0);
  const load = useCallback(async (nextPage: number, nextState: string) => {
    const token = ++sequence.current;
    setBusy(true); setError(''); setData(null);
    setPage(nextPage); setState(nextState);
    try {
      const query = new URLSearchParams({ page: String(nextPage), pageSize: '20' });
      if (nextState) query.set('state', nextState);
      const response = await fetch(`/api/v1/institution/customers/${encodeURIComponent(customerId)}/followups?${query}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error('load_failed');
      const result = schema.parse(await response.json());
      if (result.customerId !== customerId || result.records.some(record => record.customer.customerId !== customerId)
        || result.pageInfo.page !== nextPage || result.pageInfo.pageSize !== 20
        || result.pageInfo.total !== result.summary.total || result.records.length > 20) throw new Error('invalid_response');
      if (token === sequence.current) setData(result);
    } catch { if (token === sequence.current) setError('客户随访记录暂不可用，请重新加载；未展示旧结果。'); }
    finally { if (token === sequence.current) setBusy(false); }
  }, [customerId]);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void load(1, ''); });
    const requests = sequence;
    return () => { cancelled = true; requests.current++; };
  }, [load]);
  return <section aria-label="客户随访记录" aria-busy={busy} className="space-y-4 rounded-xl border bg-white p-5">
    <h2 className="font-semibold">客户随访记录</h2>
    <p className="text-sm text-slate-600">只读取当前客户且在当前账号权限范围内的随访任务；统计涵盖全部匹配记录。</p>
    <div className="flex flex-wrap gap-3">
      <label>随访状态 <select className={control} disabled={busy || !!error} value={state} onChange={event => void load(1, event.target.value)}>
        <option value="">全部状态</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button className={control} disabled={busy} onClick={() => void load(page, state)}>重新加载随访</button>
    </div>
    {busy && <p role="status">正在加载客户随访…</p>}
    {error && <p role="alert">{error}</p>}
    {data && <>
      <p>当前筛选共 {data.summary.total} 条 · 已完成 {data.summary.stateCounts.completed} 条 · 今日到期 {data.summary.dueBucketCounts?.due_today ?? '暂不可用'} · 逾期 {data.summary.dueBucketCounts?.overdue ?? '暂不可用'}</p>
      {data.records.map(record => <article className="space-y-2 rounded-lg border p-4 text-sm" key={record.taskId}>
        <p>{labels[record.state]} · 计划时间 {dateLabel(record.dueAt)}（上海时间）</p>
        {record.completionCode && <p>完成结果：{completionLabel(record.completionCode)}</p>}
        {record.completionCode && <p>低敏摘要：{record.completionFeedback?.summary ?? '未填写'}</p>}
        <Link className="text-blue-700 underline" href={`/hospital/care/followups/${encodeURIComponent(record.taskId)}?returnTo=${encodeURIComponent(`/hospital/customers/${encodeURIComponent(customerId)}?tab=followups`)}`}>查看任务详情</Link>
      </article>)}
      {data.records.length === 0 && <p>{data.summary.total === 0 ? '当前筛选下暂无随访记录。' : '当前页没有记录，请返回上一页。'}</p>}
      <nav aria-label="客户随访分页" className="flex items-center gap-3">
        <button className={control} disabled={busy || page <= 1} onClick={() => void load(Math.min(page - 1, Math.max(1, data.pageInfo.pageCount)), state)}>上一页随访</button>
        <span>第 {data.pageInfo.total === 0 ? 0 : page} / {data.pageInfo.pageCount} 页</span>
        <button className={control} disabled={busy || !data.pageInfo.hasMore} onClick={() => void load(page + 1, state)}>下一页随访</button>
      </nav>
    </>}
  </section>;
}
