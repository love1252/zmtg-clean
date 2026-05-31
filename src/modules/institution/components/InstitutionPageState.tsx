'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Ban,
  FileText,
  Loader2,
  ServerCrash,
  ShieldAlert,
} from 'lucide-react';
import type { TenantBusinessClientError } from '@/modules/institution/client/tenant-business-client';
import { cn } from '@/shared/utils/cn';

export type InstitutionPageStateKind =
  | 'loading'
  | 'empty'
  | 'error'
  | 'forbidden'
  | 'unavailable'
  | 'placeholder';

export type InstitutionPageStateProps = {
  kind: InstitutionPageStateKind;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

type ClientErrorStateOptions = {
  forbiddenMessage: string;
  fallbackMessage: string;
  unauthorizedMessage?: string;
  unavailableMessage?: string;
};

const stateStyles = {
  loading: {
    container: 'border-blue-100 bg-blue-50 text-blue-700',
    icon: 'text-blue-600',
    iconNode: Loader2,
  },
  empty: {
    container: 'border-dashed border-slate-300 bg-white/78 text-slate-700 text-center',
    icon: 'text-slate-400',
    iconNode: FileText,
  },
  error: {
    container: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: 'text-rose-600',
    iconNode: AlertTriangle,
  },
  forbidden: {
    container: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: 'text-amber-600',
    iconNode: ShieldAlert,
  },
  unavailable: {
    container: 'border-slate-200 bg-slate-50 text-slate-700',
    icon: 'text-slate-500',
    iconNode: ServerCrash,
  },
  placeholder: {
    container: 'border-white/80 bg-white/78 text-slate-700',
    icon: 'text-slate-400',
    iconNode: Ban,
  },
} as const satisfies Record<
  InstitutionPageStateKind,
  {
    container: string;
    icon: string;
    iconNode: LucideIcon;
  }
>;

export function getInstitutionPageStateFromClientError(
  error: TenantBusinessClientError,
  options: ClientErrorStateOptions,
): InstitutionPageStateProps {
  if (error.kind === 'unauthorized') {
    return {
      kind: 'error',
      title: options.unauthorizedMessage ?? '登录状态已失效，请重新登录',
    };
  }

  if (error.kind === 'forbidden') {
    return {
      kind: 'forbidden',
      title: options.forbiddenMessage,
    };
  }

  if (error.kind === 'service_unavailable') {
    return {
      kind: 'unavailable',
      title: options.unavailableMessage ?? '数据服务暂时不可用',
    };
  }

  return {
    kind: 'error',
    title: options.fallbackMessage,
  };
}

export function InstitutionPageState({
  action,
  className,
  description,
  kind,
  title,
}: InstitutionPageStateProps) {
  const styles = stateStyles[kind];
  const Icon = styles.iconNode;
  const role =
    kind === 'loading'
      ? 'status'
      : kind === 'empty' || kind === 'placeholder'
        ? undefined
        : 'alert';

  return (
    <section
      role={role}
      className={cn(
        'rounded-[24px] border px-5 py-5 text-sm font-semibold shadow-sm backdrop-blur-xl',
        kind === 'empty' || kind === 'placeholder'
          ? 'flex flex-col items-center justify-center py-8'
          : 'flex items-start gap-3',
        styles.container,
        className,
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          kind === 'loading' ? 'animate-spin' : '',
          kind === 'empty' || kind === 'placeholder' ? 'mb-3 h-5 w-5' : 'mt-0.5',
          styles.icon,
        )}
      />
      <div>
        <div className="text-base font-semibold leading-6">{title}</div>
        {description ? (
          <p
            className={cn(
              'mt-2 text-sm font-normal leading-6',
              kind === 'empty' || kind === 'placeholder' ? 'text-slate-500' : 'opacity-80',
            )}
          >
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </section>
  );
}
