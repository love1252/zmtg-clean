import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/shared/utils/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
};

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-[#0b1624] text-white shadow-[0_18px_38px_rgba(11,22,36,0.18)] hover:bg-[#13243a]',
  secondary: 'border border-slate-200 bg-white/76 text-slate-900 hover:border-slate-300 hover:bg-white',
  ghost: 'bg-transparent text-slate-700 hover:bg-white/50',
};

export function Button({
  asChild,
  variant = 'primary',
  className,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a9a91]/40 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
