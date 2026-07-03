import type { ReactNode } from 'react';

import { cn } from '@/shared/utils/cn';

const sectionShell = 'rounded-xl border border-[#e6edf5] bg-white shadow-sm';

export function KnowledgeSignalCard({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <article className={cn(sectionShell, 'p-4')}>
      <div>
        <h3 className="text-sm font-semibold tracking-normal text-slate-950">{title}</h3>
        {helper ? <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{helper}</p> : null}
      </div>
      <div className="mt-3">{children}</div>
    </article>
  );
}
