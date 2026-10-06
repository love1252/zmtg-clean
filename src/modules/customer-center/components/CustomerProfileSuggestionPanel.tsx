'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { customerProfileReadSchema, customerProfileSuggestionSchema, type CustomerProfileReadDto } from '@/modules/customers/application/customer-profile-suggestion';

const labels = { pending: '待人工核对', applied: '已接受并更新', rejected: '已拒绝', expired: '已失效' };
const control = 'rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50';
type Props = { customerId: string; onApplied: () => void };
export function CustomerProfileSuggestionPanel(props: Props) { return <ProfilePanel key={props.customerId} {...props} />; }
function ProfilePanel({ customerId, onApplied }: Props) {
  const [data, setData] = useState<CustomerProfileReadDto | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [selected, setSelected] = useState('');
  const sequence = useRef(0);
  const endpoint = `/api/v1/institution/customers/${encodeURIComponent(customerId)}/profile-suggestions`;
  const load = useCallback(async (suggestionPage = 1, sourcePage = 1) => {
    const token = ++sequence.current;
    setBusy(true); setError(''); setData(null); setSelected('');
    try {
      const response = await fetch(`${endpoint}?suggestionPage=${suggestionPage}&sourcePage=${sourcePage}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error('read_failed');
      const result = customerProfileReadSchema.parse(await response.json());
      if (result.customerId !== customerId || result.sourcePage !== sourcePage || result.suggestionPage !== suggestionPage) throw new Error('invalid_result');
      if (token === sequence.current) setData(result);
    } catch { if (token === sequence.current) setError('建议暂不可用，请重新加载。'); }
    finally { if (token === sequence.current) setBusy(false); }
  }, [customerId, endpoint]);
  useEffect(() => { const requests = sequence; let cancelled = false; void Promise.resolve().then(() => { if (!cancelled) void load(); }); return () => { cancelled = true; requests.current++; }; }, [load]);
  async function mutate(method: 'POST' | 'PATCH', body: unknown) {
    const token = ++sequence.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(endpoint, { method, cache: 'no-store', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(response.status === 409 ? 'conflict' : 'failed');
      const result = await response.json();
      if (token !== sequence.current) return;
      const record = customerProfileSuggestionSchema.parse(result.record);
      if (result.kind !== 'ready' || record.customerId !== customerId) throw new Error('invalid_result');
      setNotice(result.record.state === 'expired' ? '来源、客户资料或有效期已变化，请重新核对。' : method === 'POST' ? '建议已保存，请核对下方证据后决定。' : labels[result.record.state as keyof typeof labels]);
      if (result.record.state === 'applied') onApplied();
      else await load();
    } catch (failure) { if (token === sequence.current) { setData(null); setSelected(''); setError(failure instanceof Error && failure.message === 'conflict' ? '资料或建议已变化，请重新加载后核对。' : '操作未能确认，请重新加载核对结果；不要重复生成新的建议。'); } }
    finally { if (token === sequence.current) setBusy(false); }
  }
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" aria-label="画像更新建议">
    <h2 className="font-semibold">画像更新建议</h2>
    <p className="text-sm text-slate-600">根据已确认预约提出项目意向补充建议。预约项目不代表客户真实偏好，请核对证据后人工决定。已有意向不会被覆盖。</p>
    {busy && <p role="status">处理中…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <button className={control} disabled={busy} onClick={() => void load()}>重新加载</button>
    {data && <>
      <p>当前项目意向：{data.projectInterest || '未填写'}</p>
      {!data.projectInterest && <div className="space-y-2">
        <label className="block">选择已确认预约<select aria-label="选择已确认预约" className={`${control} ml-2`} disabled={busy} value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">请选择</option>{data.sources.map(source => <option key={source.appointmentId} value={source.appointmentId}>{source.project} · {source.scheduledAt}</option>)}
        </select></label>
        {!data.sources.length && <p>本页没有符合条件的预约来源。</p>}
        <button className={control} disabled={busy || !selected} onClick={() => {
          const source = data.sources.find(item => item.appointmentId === selected);
          if (source) void mutate('POST', { appointmentId: source.appointmentId, expectedSourceUpdatedAt: source.updatedAt, expectedCustomerUpdatedAt: data.customerUpdatedAt });
        }}>生成待核对建议</button>
        <div className="flex gap-2"><button className={control} disabled={busy || data.sourcePage <= 1} onClick={() => void load(data.suggestionPage, data.sourcePage - 1)}>上一页预约来源</button>
          <span>来源第 {data.sourcePage} 页</span><button className={control} disabled={busy || !data.hasMoreSources || data.sourcePage >= 100} onClick={() => void load(data.suggestionPage, data.sourcePage + 1)}>下一页预约来源</button></div>
      </div>}
      {!data.records.length && <p>本页暂无画像建议。</p>}
      {data.records.map(record => <article className="space-y-2 rounded-lg border p-4" key={record.id}>
        <h3 className="font-semibold">项目意向：{record.beforeValue || '未填写'} → {record.proposedValue}</h3>
        <p>{labels[record.state]} · 规则生成 · 有效期至 {record.expiresAt}</p>
        <p>证据：已确认预约「{record.source.project}」，预约时间 {record.source.scheduledAt}；来源更新于 {record.source.updatedAt}。</p>
        {record.decidedAt && <p>处理时间：{record.decidedAt}</p>}
        {record.state === 'pending' && <div className="flex gap-2">
          <button className={control} disabled={busy} onClick={() => void mutate('PATCH', { suggestionId: record.id, command: 'accept', expectedRevision: record.revision })}>接受并更新意向</button>
          <button className={control} disabled={busy} onClick={() => void mutate('PATCH', { suggestionId: record.id, command: 'reject', expectedRevision: record.revision })}>拒绝建议</button>
        </div>}
      </article>)}
      <div className="flex gap-2"><button className={control} disabled={busy || data.suggestionPage <= 1} onClick={() => void load(data.suggestionPage - 1, data.sourcePage)}>上一页建议</button>
        <span>建议第 {data.suggestionPage} 页</span><button className={control} disabled={busy || !data.hasMoreSuggestions || data.suggestionPage >= 100} onClick={() => void load(data.suggestionPage + 1, data.sourcePage)}>下一页建议</button></div>
      {(data.suggestionPage >= 100 && data.hasMoreSuggestions || data.sourcePage >= 100 && data.hasMoreSources) && <p>当前最多浏览前 100 页，请联系管理员核对更早记录。</p>}
    </>}
  </section>;
}
