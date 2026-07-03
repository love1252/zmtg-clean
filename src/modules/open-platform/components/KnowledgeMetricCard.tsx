import type { ComponentType } from 'react';

import { cn } from '@/shared/utils/cn';

const sectionShell = 'rounded-xl border border-[#e6edf5] bg-white shadow-sm';

export type KnowledgeMetricCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
};

export function KnowledgeMetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: KnowledgeMetricCardProps) {
  return (
    <article className={cn(sectionShell, 'flex min-h-[112px] flex-col justify-between gap-4 p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">{value}</div>
        </div>
        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', tone)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="text-xs font-semibold leading-5 text-slate-500">{helper}</div>
    </article>
  );
}
