import type { ReactNode } from 'react';

import { cn } from '@/shared/utils/cn';

type PlatformSectionBannerProps = {
  headingId: string;
  title: string;
  description: ReactNode;
  headingLevel?: 'h1' | 'h2';
  children?: ReactNode;
  className?: string;
};

export function PlatformSectionBanner({
  headingId,
  title,
  description,
  headingLevel = 'h2',
  children,
  className,
}: PlatformSectionBannerProps) {
  const Heading = headingLevel;

  return (
    <section
      aria-labelledby={headingId}
      data-platform-banner="true"
      className={cn(
        'rounded-xl border border-[#e6edf5] bg-white px-5 py-4 shadow-sm lg:px-6 lg:py-5',
        className,
      )}
    >
      <div className="max-w-3xl">
        <Heading
          id={headingId}
          className="text-2xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-[28px]"
        >
          {title}
        </Heading>
        <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-[15px]">
          {description}
        </div>
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    </section>
  );
}
