import type { ReactNode } from 'react';

import { cn } from '@/shared/utils/cn';

const sectionShell = 'rounded-xl border border-[#e6edf5] bg-white shadow-sm';

export function KnowledgeSignalCard({
  title,
  helper,
  riskLabel,
  children,
}: {
  title: string;
  helper?: string;
  riskLabel?: string;
  children: ReactNode;
}) {
  return (
    <article className={cn(sectionShell, 'p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-normal text-slate-950">{title}</h3>
          {helper ? <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{helper}</p> : null}
        </div>
        {riskLabel ? (
          <span className="inline-flex shrink-0 items-center rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            风险等级 {riskLabel}
          </span>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </article>
  );
}
