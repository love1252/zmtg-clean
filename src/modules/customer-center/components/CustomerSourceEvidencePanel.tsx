'use client';

import { useEffect, useState } from 'react';

type Evidence = { status: 'not_recorded' } | { status: 'ambiguous' } | {
  status: 'recorded'; batchId: string; rowNumber: number; completedAt: string;
};
type State = { kind: 'loading'; customerId: string } | { kind: 'error'; customerId: string } | { kind: 'ready'; customerId: string; evidence: Evidence };

function parse(value: unknown, customerId: string): Evidence | null {
  if (!value || typeof value !== 'object') return null;
  const dto = value as Record<string, unknown>;
  if (dto.kind !== 'ready' || dto.contractVersion !== 'customer-source-evidence.v1' || dto.customerId !== customerId
    || typeof dto.customerUpdatedAt !== 'string' || !Number.isFinite(Date.parse(dto.customerUpdatedAt))
    || typeof dto.observedAt !== 'string' || !Number.isFinite(Date.parse(dto.observedAt))
    || !dto.evidence || typeof dto.evidence !== 'object') return null;
  const evidence = dto.evidence as Record<string, unknown>;
  if ((evidence.status === 'not_recorded' || evidence.status === 'ambiguous') && evidence.importRecord === null) return { status: evidence.status };
  if (evidence.status !== 'recorded' || !evidence.importRecord || typeof evidence.importRecord !== 'object') return null;
  const row = evidence.importRecord as Record<string, unknown>;
  if (typeof row.batchId !== 'string' || !/^imp-b-[a-f0-9]{48}$/.test(row.batchId)
    || row.sheetKind !== 'customer' || typeof row.rowNumber !== 'number' || !Number.isSafeInteger(row.rowNumber) || row.rowNumber < 5
    || typeof row.completedAt !== 'string' || !Number.isFinite(Date.parse(row.completedAt))) return null;
  return { status: 'recorded', batchId: row.batchId, rowNumber: row.rowNumber, completedAt: row.completedAt };
}

function SourceEvidenceRequest({ customerId }: Readonly<{ customerId: string }>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: 'loading', customerId });
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    void (async () => {
      try {
        const response = await fetch(`/api/v1/institution/customers/${encodeURIComponent(customerId)}/source-evidence`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('unavailable');
        const evidence = parse(await response.json(), customerId);
        if (!evidence) throw new Error('invalid_response');
        if (current) setState({ kind: 'ready', customerId, evidence });
      } catch {
        if (current) setState({ kind: 'error', customerId });
      }
    })();
    return () => { current = false; controller.abort(); };
  }, [customerId, attempt]);
  const visible = state.customerId === customerId ? state : { kind: 'loading' as const };
  return <section aria-label="资料来源" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h2 className="font-semibold text-slate-900">资料来源</h2>
    {visible.kind === 'loading' ? <p role="status" className="mt-2 text-sm text-slate-500">正在读取资料来源…</p> : visible.kind === 'error' ? <div className="mt-2 text-sm"><p role="alert">资料来源暂不可用，请重试。</p><button type="button" className="mt-2 text-blue-700" onClick={() => { setState({ kind: 'loading', customerId }); setAttempt(value => value + 1); }}>重新加载来源</button></div> : visible.evidence.status === 'not_recorded' ? <p className="mt-2 text-sm text-slate-600">暂无已记录来源，不能据此判断资料质量。</p> : visible.evidence.status === 'ambiguous' ? <p className="mt-2 text-sm text-amber-800">存在多条来源关联，需要人工核对。</p> : <dl className="mt-2 space-y-1 break-all text-sm text-slate-600">
      <div><dt className="inline font-medium">导入批次：</dt><dd className="inline">{visible.evidence.batchId}</dd></div>
      <div><dt className="inline font-medium">客户表行号：</dt><dd className="inline">{visible.evidence.rowNumber}</dd></div>
      <div><dt className="inline font-medium">来源时间：</dt><dd className="inline"><time dateTime={visible.evidence.completedAt}>{new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(visible.evidence.completedAt))}（上海时间）</time></dd></div>
    </dl>}
  </section>;
}

export function CustomerSourceEvidencePanel({ customerId }: Readonly<{ customerId: string }>) {
  return <SourceEvidenceRequest key={customerId} customerId={customerId} />;
}
