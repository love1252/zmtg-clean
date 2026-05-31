'use client';

import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

type InstitutionSectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  tone?: 'blue' | 'emerald' | 'violet';
  action?: ReactNode;
  className?: string;
};

const eyebrowToneClasses = {
  blue: 'text-blue-600',
  emerald: 'text-emerald-600',
  violet: 'text-violet-600',
};

export function InstitutionSectionHeader({
  action,
  className,
  description,
  eyebrow,
  tone = 'blue',
  title,
}: InstitutionSectionHeaderProps) {
  return (
    <header
      className={cn(
        'rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl lg:p-6',
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className={cn('text-sm font-semibold', eyebrowToneClasses[tone])}>{eyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {action ? <div className="w-full lg:w-auto">{action}</div> : null}
      </div>
    </header>
  );
}
