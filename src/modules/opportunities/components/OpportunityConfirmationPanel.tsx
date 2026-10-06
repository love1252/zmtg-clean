'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { opportunityConfirmationReadSchema, opportunityConfirmationSchema, type OpportunityConfirmationReadDto } from '../application/opportunity-confirmation';

const control = 'rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50';
const states = { pending: '待处理', in_progress: '处理中', waiting_customer: '等待客户', escalated: '已升级', completed: '已完成', cancelled: '已取消' };
const results: Record<string, string> = { contact_completed: '已完成联系', no_response_closed: '未响应结案', his_appointment_linked: '已关联预约', customer_declined: '客户拒绝', invalid_or_duplicate: '无效或重复', created_in_error: '创建有误', duplicate_task: '重复任务', source_invalidated: '来源失效', superseded: '已被替代', customer_requested_stop: '客户要求停止' };
type Pending = { idempotencyKey: string; customerId: string; opportunityType: string; expectedSourceVersion: string; dueAt: string; assignment: { kind: 'role_pool'; role: string } };
export function OpportunityConfirmationPanel({ customerId }: { customerId: string }) { return <Panel key={customerId} customerId={customerId} />; }
function Panel({ customerId }: { customerId: string }) {
  const [data, setData] = useState<OpportunityConfirmationReadDto | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [due, setDue] = useState(''), [role, setRole] = useState('customer_service'), [checked, setChecked] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const sequence = useRef(0);
  const endpoint = '/api/v1/institution/opportunities/confirmations';
  const load = useCallback(async () => {
    const token = ++sequence.current; setBusy(true); setError(''); setData(null); setChecked(false);
    try {
      const response = await fetch(`${endpoint}?customerId=${encodeURIComponent(customerId)}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error('read_failed');
      const next = opportunityConfirmationReadSchema.parse(await response.json());
      if (next.customerId !== customerId) throw new Error('invalid_customer');
      if (token === sequence.current) { setData(next); setPending(current => current && !next.records.some(row => row.opportunityType === current.opportunityType) ? current : null); }
    } catch { if (token === sequence.current) setError('经营机会暂不可用，请重新加载。'); }
    finally { if (token === sequence.current) setBusy(false); }
  }, [customerId]);
  useEffect(() => { const requests = sequence; let cancelled = false; void Promise.resolve().then(() => { if (!cancelled) void load(); }); return () => { cancelled = true; requests.current++; }; }, [load]);
  async function confirm(body: Pending) {
    const token = ++sequence.current; setBusy(true); setError(''); setNotice(''); setPending(body);
    try {
      const response = await fetch(endpoint, { method: 'POST', cache: 'no-store', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (token !== sequence.current) return;
      if (!response.ok) {
        if ([400, 403, 404, 409].includes(response.status)) { setPending(null); setData(null); throw new Error('changed'); }
        throw new Error('unknown');
      }
      const result = await response.json(), record = opportunityConfirmationSchema.parse(result.record);
      if (token !== sequence.current) return;
      if (result.kind !== 'ready' || record.customerId !== customerId || record.opportunityType !== body.opportunityType) throw new Error('invalid_result');
      setPending(null); setNotice('已确认并创建正式随访，请进入任务处理。'); setChecked(false); await load();
    } catch (failure) { if (token === sequence.current) setError(failure instanceof Error && failure.message === 'changed' ? '权限、来源或确认记录已变化，请重新加载后核对。' : '提交结果尚未确认。可重新加载核对，或重试本次确认；重试不会重复建任务。'); }
    finally { if (token === sequence.current) setBusy(false); }
  }
  const dueValid = due !== '' && Number.isFinite(new Date(due).getTime());
  return <section aria-label="经营机会确认" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="font-semibold">经营机会与执行结果</h2>
    <p className="text-sm text-slate-600">依据客户生命周期提出待核对机会。人工确认后创建随访；完成随访不代表成交，也不会自动联系客户。</p>
    {busy && <p role="status">处理中…</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <button className={control} disabled={busy} onClick={() => void load()}>重新加载</button>
    {pending && <button className={`${control} ml-2`} disabled={busy} onClick={() => void confirm(pending)}>重试本次确认</button>}
    {data && <>
      {data.candidate ? <article className="space-y-3 rounded-lg border border-cyan-200 bg-cyan-50/40 p-4">
        <h3 className="font-semibold">{data.candidate.label} · 待人工核对</h3>
        <p>判断依据：{data.candidate.basis}</p><p className="text-sm text-slate-600">来源更新于 {data.candidate.sourceUpdatedAt}</p>
        {data.canConfirm ? <>
          <label className="block">随访截止时间（本地时间）<input aria-label="随访截止时间" className={`${control} ml-2 bg-white`} type="datetime-local" value={due} disabled={busy || !!pending} onChange={event => setDue(event.target.value)} /></label>
          <label className="block">分配到角色任务池<select aria-label="分配到角色任务池" className={`${control} ml-2 bg-white`} value={role} disabled={busy || !!pending} onChange={event => setRole(event.target.value)}>
            <option value="customer_service">客服</option><option value="consultant">咨询师</option><option value="tenant_operator">机构运营</option><option value="tenant_admin">机构管理员</option>
          </select></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={checked} disabled={busy || !!pending} onChange={event => setChecked(event.target.checked)} />我已核对来源，并确认需要人工随访</label>
          <button className={`${control} bg-cyan-700 text-white`} disabled={busy || !!pending || !checked || !dueValid} onClick={() => {
            if (data.candidate && dueValid) void confirm({ idempotencyKey: `opp-ui:${crypto.randomUUID()}`, customerId, opportunityType: data.candidate.opportunityType, expectedSourceVersion: data.candidate.sourceVersion, dueAt: new Date(due).toISOString(), assignment: { kind: 'role_pool', role } });
          }}>确认并创建人工随访</button>
        </> : <p>当前账号或机构能力未开放机会确认。</p>}
      </article> : <p>当前没有可新建的机会；同一客户的同类机会只确认一次。</p>}
      <h3 className="font-semibold">确认记录与随访结果</h3>
      {!data.records.length && <p>暂无当前账号可见的确认记录。</p>}
      {data.records.map(record => <article key={record.id} className="space-y-2 rounded-lg border p-4">
        <h4 className="font-semibold">{record.label} · {states[record.task.state]}</h4>
        <p className="text-sm">确认于 {record.confirmedAt} · 截止 {record.task.dueAt}</p>
        {(record.task.completionCode || record.task.cancellationReason) && <p>处理结果：{results[record.task.completionCode ?? record.task.cancellationReason ?? ''] ?? '请进入随访查看'}</p>}
        <p className="text-sm text-slate-600">任务更新于 {record.task.updatedAt}</p>
        <Link className="text-cyan-800 underline" href={`/hospital/care/followups/${encodeURIComponent(record.task.taskId)}`}>查看并处理随访</Link>
      </article>)}
    </>}
  </section>;
}
