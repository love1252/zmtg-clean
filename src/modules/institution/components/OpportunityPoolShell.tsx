'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import {
  InstitutionPageState,
  type InstitutionPageStateProps,
} from '@/modules/institution/components/InstitutionPageState';
import { InstitutionSectionHeader } from '@/modules/institution/components/InstitutionSectionHeader';
import { cn } from '@/shared/utils/cn';
import type { OpportunityPoolResponse, OpportunityType } from '@/modules/institution/domain/opportunity-pool';
import { opportunityTypeLabels } from '@/modules/institution/domain/opportunity-pool';

type OpportunityPoolLoadStatus = 'loading' | 'success' | 'error';

const poolToneClasses: Record<OpportunityType, string> = {
  revisit: 'border-blue-200 bg-blue-50 text-blue-700',
  repurchase: 'border-amber-200 bg-amber-50 text-amber-700',
  dormant_reactivation: 'border-rose-200 bg-rose-50 text-rose-700',
};

const poolIconMap: Record<OpportunityType, typeof Sparkles> = {
  revisit: Sparkles,
  repurchase: TrendingUp,
  dormant_reactivation: UserCheck,
};

const priorityTone = {
  high: 'border-rose-200 bg-rose-50 text-rose-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  observe: 'border-slate-200 bg-slate-50 text-slate-600',
} as const;

export function OpportunityPoolShell() {
  const [data, setData] = useState<OpportunityPoolResponse | null>(null);
  const [status, setStatus] = useState<OpportunityPoolLoadStatus>('loading');
  const [errorState, setErrorState] = useState<InstitutionPageStateProps | null>(null);

  useEffect(() => {
    let isActive = true;

    async function load() {
      setStatus('loading');
      setErrorState(null);

      try {
        const response = await fetch('/api/institution/opportunities', {
          cache: 'no-store',
        });

        if (!response.ok) {
          if (response.status === 401) {
            setErrorState({ kind: 'error', title: '请先登录' });
          } else if (response.status === 403) {
            setErrorState({ kind: 'forbidden', title: '当前账号没有访问机会池的权限' });
          } else {
            setErrorState({ kind: 'unavailable', title: '数据服务暂时不可用' });
          }
          setStatus('error');
          return;
        }

        const payload: unknown = await response.json();
        if (isActive) {
          setData(payload as OpportunityPoolResponse);
          setStatus('success');
        }
      } catch {
        if (isActive) {
          setErrorState({ kind: 'unavailable', title: '数据服务暂时不可用' });
          setStatus('error');
        }
      }
    }

    void load();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section className="space-y-5">
      <InstitutionSectionHeader
        eyebrow="机会运营"
        title="机会池"
        description="基于客户旅程自动识别复诊、复购和沉睡唤醒机会。机会池仅用于运营参考，不自动触达客户。"
        tone="violet"
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">
            <ShieldCheck className="h-4 w-4" />
            基于客户旅程派生
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {(['revisit', 'repurchase', 'dormant_reactivation'] as const).map((type) => {
          const pool = data?.pools.find((p) => p.type === type);
          const Icon = poolIconMap[type];
          const label = opportunityTypeLabels[type];

          return (
            <article
              key={type}
              className={cn(
                'rounded-[22px] border border-white/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl',
              )}
            >
              <div className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', poolToneClasses[type])}>
                {pool?.count ?? 0} 位客户
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className={cn('grid h-10 w-10 place-items-center rounded-2xl border', poolToneClasses[type])}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{label}</h3>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {status === 'loading' ? (
        <InstitutionPageState kind="loading" title="正在加载机会池..." />
      ) : null}

      {status === 'error' && errorState ? (
        <InstitutionPageState {...errorState} />
      ) : null}

      {status === 'success' && (!data || data.totalCount === 0) ? (
        <InstitutionPageState
          kind="empty"
          title="暂无机会池数据"
          description="当前没有可展示的运营机会，可先创建客户记录，系统将根据客户旅程自动分类机会。"
        />
      ) : null}

      {status === 'success' && data && data.totalCount > 0 ? (
        <div className="space-y-5">
          {data.pools.map((pool) => {
            const Icon = poolIconMap[pool.type];
            return (
              <article
                key={pool.type}
                className="rounded-[24px] border border-white/80 bg-white/78 p-5 shadow-[0_20px_70px_rgba(32,61,104,0.10)] backdrop-blur-xl"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className={cn('grid h-10 w-10 place-items-center rounded-2xl border', poolToneClasses[pool.type])}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{pool.label}</h3>
                    <p className="mt-1 text-sm text-slate-500">{pool.description}</p>
                  </div>
                  <span className="ml-auto rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                    {pool.count} 位客户
                  </span>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {pool.opportunities.map((opp) => (
                    <div
                      key={opp.id}
                      className="rounded-2xl border border-slate-200/80 bg-white/86 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-slate-950">
                          {opp.customerDisplayName}
                        </span>
                        <span className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-semibold',
                          priorityTone[opp.priority],
                        )}>
                          {opp.priority === 'high' ? '高优先级' : opp.priority === 'medium' ? '中优先级' : '观察'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{opp.projectInterest}</p>
                      <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                        <div className="text-xs font-semibold text-slate-400">建议动作</div>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">
                          {opp.suggestedAction}
                        </p>
                        <div className="mt-2 text-xs text-slate-500">
                          负责人：{opp.ownerUserId}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}

          <div className="rounded-[24px] border border-slate-900/90 bg-[#071322] p-5 text-white shadow-[0_24px_80px_rgba(3,15,33,0.22)]">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400/16 text-cyan-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">机会池数据边界</h3>
                <p className="mt-1 text-sm text-slate-400">基于客户旅程数据派生，不会自动触达客户。</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                { title: '机会来自客户旅程', description: '机会池基于客户生命周期阶段自动分类，不包含外部数据源。' },
                { title: '不自动触达', description: '机会池仅供运营参考，不会主动向客户发送消息或创建营销任务。' },
                { title: '按租户隔离', description: '不同机构之间机会池数据完全隔离，不会看到其他机构的客户。' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ArrowRight className="h-4 w-4 text-cyan-300" />
                    {item.title}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
