'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Home, Sparkles } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

type LoginMetric = {
  value: string;
  label: string;
  detail: string;
};

type LoginInsight = {
  title: string;
  description: string;
};

type LuxuryLoginShellProps = {
  variant: 'institution' | 'platform';
  eyebrow: string;
  title: string;
  accentTitle: string;
  description: string;
  metrics: LoginMetric[];
  insights: LoginInsight[];
  alternateHref: string;
  alternateLabel: string;
  logoUrl?: string;
  logoAlt?: string;
  backgroundImageUrl?: string;
  children: ReactNode;
};

export function LuxuryLoginShell({
  variant,
  eyebrow,
  title,
  accentTitle,
  description,
  metrics,
  insights,
  alternateHref,
  alternateLabel,
  logoUrl = '/brand/zmtg-logo-horizontal-luxury-clean.png',
  logoAlt = '智美天工',
  backgroundImageUrl = '/homepage/zmtg-luxury-clinic-bg.png',
  children,
}: LuxuryLoginShellProps) {
  const isPlatform = variant === 'platform';

  return (
    <main
      className={cn(
        'relative min-h-screen overflow-hidden bg-[#f6f2eb] text-slate-950',
        isPlatform && 'bg-[#eef4f7]',
      )}
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{ backgroundImage: `url("${backgroundImageUrl}")` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(248,246,240,0.96)_0%,rgba(248,246,240,0.9)_42%,rgba(237,246,248,0.78)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/70 to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center" aria-label="返回智美天工首页">
            <img
              src={logoUrl}
              alt={logoAlt}
              className="h-12 w-auto object-contain sm:h-14"
            />
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href={alternateHref}
              className="hidden h-10 items-center rounded-full border border-[#cfd9da] bg-white/70 px-4 text-sm font-medium text-slate-700 shadow-sm shadow-slate-200/40 transition hover:border-[#89a7ad] hover:text-[#0d5d68] sm:inline-flex"
            >
              {alternateLabel}
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#cfd9da] bg-white/70 text-slate-600 shadow-sm shadow-slate-200/40 transition hover:border-[#89a7ad] hover:text-[#0d5d68]"
              aria-label="返回首页"
            >
              <Home className="h-4 w-4" />
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.72fr)] lg:gap-10 lg:py-10">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#bdd3d4] bg-white/65 px-4 py-2 text-sm font-semibold text-[#0d5d68] shadow-sm shadow-slate-200/50">
              <Sparkles className="h-4 w-4" />
              {eyebrow}
            </div>

            <div className="max-w-[760px]">
              <h1 className="text-[clamp(2.55rem,6vw,5.9rem)] font-semibold leading-[1.06] tracking-normal text-slate-950">
                {title}
                <span className="block text-[#0d6a76]">{accentTitle}</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg sm:leading-9">
                {description}
              </p>
            </div>

            <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-[22px] border border-white/70 bg-white/62 p-5 shadow-[0_18px_50px_rgba(37,55,70,0.08)] backdrop-blur-xl">
                  <div className="text-3xl font-semibold leading-none text-slate-950">{metric.value}</div>
                  <div className="mt-3 text-sm font-semibold text-slate-800">{metric.label}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{metric.detail}</p>
                </div>
              ))}
            </div>

            <div className="grid max-w-3xl gap-3 md:grid-cols-2">
              {insights.map((insight) => (
                <div key={insight.title} className="flex gap-3 rounded-[24px] border border-[#dce5e4] bg-[#f9fbf9]/72 p-5 shadow-sm backdrop-blur-xl">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0d6a76]" />
                  <div>
                    <h2 className="text-base font-semibold leading-6 text-slate-900">{insight.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="mx-auto w-full max-w-[470px] lg:mx-0 lg:justify-self-end">
            {children}
            <Link
              href={alternateHref}
              className="mt-5 flex items-center justify-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#0d6a76] sm:hidden"
            >
              {alternateLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
