'use client';

import { useEffect, useState } from 'react';

export function WorkbenchRefreshControl() {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const refresh = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener('pageshow', refresh);
    return () => { window.removeEventListener('pageshow', refresh); };
  }, []);
  return <button type="button" disabled={pending} onClick={() => { setPending(true); window.location.reload(); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">{pending ? '刷新中…' : '刷新工作台'}</button>;
}
