'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Database,
  Loader2,
  ShieldCheck,
  Users,
  CalendarClock,
} from 'lucide-react';
import {
  getOpenPlatformCommercialHealth,
  listOpenPlatformTenants,
  type OpenPlatformCommercialHealthClientError,
  type OpenPlatformTenantClientError,
  type OpenPlatformTenantRecord,
} from '@/modules/open-platform/client/platform-tenant-management-client';
import type {
  CommercialQuotaKey,
  PlatformCommercialHealthViewModel,
  PlatformCommercialMissingConfigurationReason,
  PlatformCommercialQuotaRiskTenant,
} from '@/modules/open-platform/domain/platform-commercial-health';

type TenantManagementStateProps = {
  title: string;
  description?: string;
  kind: 'loading' | 'empty' | 'error' | 'forbidden' | 'unavailable';
};

const quotaItems = [
  { key: 'customers', label: '客户数', currentKey: 'currentCustomers', maxKey: 'maxCustomers' },
  { key: 'appointments', label: '预约数', currentKey: 'currentAppointments', maxKey: 'maxAppointments' },
  { key: 'followUps', label: '随访任务', currentKey: 'currentFollowUps', maxKey: 'maxFollowUps' },
  { key: 'aiCalls', label: 'AI 调用', currentKey: 'currentAiCalls', maxKey: 'maxAiCalls' },
] as const;

function visibleTenantErrorState(
  error: OpenPlatformTenantClientError | OpenPlatformCommercialHealthClientError,
): TenantManagementStateProps {
  if (error.kind === 'unauthorized') {
    return {
      kind: 'error',
      title: '登录状态已失效，请重新登录',
    };
  }

  if (error.kind === 'forbidden') {
    return {
      kind: 'forbidden',
      title: '当前账号没有查看租户管理的权限',
    };
  }

  if (error.kind === 'service_unavailable') {
    return {
      kind: 'unavailable',
      title: '租户治理视图暂时不可用，请稍后刷新或切换演示备份',
    };
  }

  return {
    kind: 'error',
    title: error.message || '租户治理视图请求失败',
  };
}

const quotaLabels: Record<CommercialQuotaKey, string> = {
  customers: '客户',
  appointments: '预约',
  followUps: '随访',
  aiCalls: 'AI 调用',
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  }).format(new Date(timestamp));
}

function quotaValue(value: number | null) {
  return typeof value === 'number' ? String(value) : '-';
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatUsagePercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function quotaRiskStatusLabel(status: PlatformCommercialQuotaRiskTenant['status']) {
  return status === 'limit_reached' ? '已达上限' : '接近上限';
}

function missingReasonLabel(reason: PlatformCommercialMissingConfigurationReason) {
  if (!reason.quotaKeys || reason.quotaKeys.length === 0) {
    return reason.label;
  }

  return `${reason.label}：${reason.quotaKeys.map((key) => quotaLabels[key]).join('、')}`;
}

function tenantField(label: string, value: string | null) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-slate-300">
      {label}：{value ?? '-'}
    </span>
  );
}

function TenantManagementState({ title, description, kind }: TenantManagementStateProps) {
  const isLoading = kind === 'loading';

  return (
    <div className="rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-8 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.10] text-cyan-100">
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
      </div>
      <div className="mt-3 text-sm font-semibold text-white">{title}</div>
      {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
    </div>
  );
}

function TenantQuotaGrid({ tenant }: { tenant: OpenPlatformTenantRecord }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {quotaItems.map((item) => {
        const current = tenant[item.currentKey];
        const max = tenant[item.maxKey];
        const isAiQuotaDisabled = item.key === 'aiCalls' && current === 0 && max === 0;

        return (
          <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <div className="text-xs font-semibold text-slate-400">{item.label}</div>
            <div className="mt-2 text-xl font-semibold tracking-normal text-white">
              {quotaValue(current)} / {quotaValue(max)}
            </div>
            {isAiQuotaDisabled ? (
              <div className="mt-2 text-xs leading-5 text-slate-500">当前未启用 AI 调用配额</div>
            ) : (
              <div className="mt-2 text-xs leading-5 text-slate-500">配额快照用于运营参考</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CommercialHealthMetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
      <div className="text-xs font-semibold text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-normal text-white">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div>
    </div>
  );
}

function EmptyCommercialHealthSignal() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-5 text-sm text-slate-400">
      暂无需要收尾关注的商业化健康信号
    </div>
  );
}

function CommercialHealthPanel({ health }: { health: PlatformCommercialHealthViewModel | null }) {
  if (!health) {
    return (
      <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6">
        <TenantManagementState kind="loading" title="正在加载平台商业化健康摘要..." />
      </article>
    );
  }

  const hasSignals =
    health.riskTenants.length > 0 ||
    health.missingConfigurationTenants.length > 0 ||
    health.quotaDeniedSignals.totalCount > 0;

  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.10] px-3 py-1 text-xs font-semibold text-emerald-100">
            <Activity className="h-4 w-4" />
            只读运营辅助
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-normal text-white">商业化健康</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            商业化健康是运营辅助，不是完整计费系统。
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            配额快照仅作运营参考，用于识别套餐覆盖、配置缺失和 Trial 租户转化跟进机会。
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
            quota denied 是演示审计信号，不会自行变更套餐或发起触达动作。
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#071322]/72 px-3 py-2 text-xs font-semibold leading-5 text-slate-300">
          最近更新：{formatDateTime(health.lastUpdatedAt)}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <CommercialHealthMetricCard
          label="套餐覆盖率"
          value={formatPercent(health.planCoverage.coverageRate)}
          helper={`${health.planCoverage.activePlanTenantCount} / ${health.planCoverage.tenantTotal} 个租户有 active plan`}
        />
        <CommercialHealthMetricCard
          label="无 active plan"
          value={health.planCoverage.missingActivePlanTenantCount}
          helper="需人工补齐套餐分配"
        />
        <CommercialHealthMetricCard
          label="配额风险项"
          value={health.riskTenants.length}
          helper="基于配额快照的运营参考"
        />
        <CommercialHealthMetricCard
          label="配置缺失租户"
          value={health.missingConfigurationTenants.length}
          helper="active plan、quota limit、snapshot"
        />
        <CommercialHealthMetricCard
          label="近期 quota denied"
          value={health.quotaDeniedSignals.totalCount}
          helper={`最近：${formatDateTime(health.quotaDeniedSignals.latestOccurredAt)}`}
        />
      </div>

      {!hasSignals ? (
        <div className="mt-5">
          <EmptyCommercialHealthSignal />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <section className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <AlertTriangle className="h-4 w-4 text-amber-200" />
              配额风险租户
            </div>
            <div className="mt-3 space-y-2">
              {health.riskTenants.length > 0 ? (
                health.riskTenants.slice(0, 5).map((risk) => (
                  <div
                    key={`${risk.tenantId}-${risk.quotaKey}`}
                    className="rounded-xl border border-white/10 bg-white/[0.05] p-3"
                  >
                    <div className="text-sm font-semibold text-white">{risk.tenantName}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">
                      {risk.quotaLabel}：{risk.currentSnapshotUsage} / {risk.quotaLimit}，
                      {formatUsagePercent(risk.usageRatio)}，{quotaRiskStatusLabel(risk.status)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      配额快照时间：{formatDateTime(risk.snapshotAt)} · 运营参考
                    </div>
                  </div>
                ))
              ) : (
                <EmptyCommercialHealthSignal />
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Database className="h-4 w-4 text-cyan-100" />
              配置缺失租户
            </div>
            <div className="mt-3 space-y-2">
              {health.missingConfigurationTenants.length > 0 ? (
                health.missingConfigurationTenants.slice(0, 5).map((tenant) => (
                  <div key={tenant.tenantId} className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                    <div className="text-sm font-semibold text-white">{tenant.tenantName}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tenant.reasons.map((reason) => (
                        <span
                          key={`${tenant.tenantId}-${reason.key}`}
                          className="rounded-full border border-amber-300/20 bg-amber-300/[0.10] px-2.5 py-1 text-xs font-semibold text-amber-100"
                        >
                          {missingReasonLabel(reason)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyCommercialHealthSignal />
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BarChart3 className="h-4 w-4 text-emerald-100" />
              quota denied 信号
            </div>
            {health.quotaDeniedSignals.totalCount > 0 ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                  <div className="text-xs font-semibold text-slate-400">reason 聚合</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {health.quotaDeniedSignals.byReason.map((item) => (
                      <span
                        key={item.reason}
                        className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-slate-200"
                      >
                        {item.reason} · {item.count}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
                  <div className="text-xs font-semibold text-slate-400">resource 聚合</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {health.quotaDeniedSignals.byResource.map((item) => (
                      <span
                        key={item.resource}
                        className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-slate-200"
                      >
                        {item.resource} · {item.count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <EmptyCommercialHealthSignal />
              </div>
            )}
          </section>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs leading-5 text-slate-500">
        <CalendarClock className="h-4 w-4" />
        配额使用率来自受控 demo 快照，仅作运营参考，不作为正式计费或自行变更套餐依据。
      </div>
    </article>
  );
}

export function OpenPlatformTenantManagementPanel() {
  const [records, setRecords] = useState<OpenPlatformTenantRecord[]>([]);
  const [commercialHealth, setCommercialHealth] = useState<PlatformCommercialHealthViewModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState<TenantManagementStateProps | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadTenants() {
      setIsLoading(true);
      setErrorState(null);
      setCommercialHealth(null);
      const [tenantResult, commercialHealthResult] = await Promise.all([
        listOpenPlatformTenants(),
        getOpenPlatformCommercialHealth(),
      ]);

      if (!isActive) return;

      if (tenantResult.ok && commercialHealthResult.ok) {
        setRecords(tenantResult.records);
        setCommercialHealth(commercialHealthResult.health);
      } else if (!tenantResult.ok) {
        setRecords([]);
        setCommercialHealth(null);
        setErrorState(visibleTenantErrorState(tenantResult.error));
      } else if (!commercialHealthResult.ok) {
        setRecords([]);
        setCommercialHealth(null);
        setErrorState(visibleTenantErrorState(commercialHealthResult.error));
      }

      setIsLoading(false);
    }

    void loadTenants();

    return () => {
      isActive = false;
    };
  }, []);

  const totals = useMemo(
    () => ({
      tenants: records.length,
      activeTenants: records.filter((record) => record.tenantStatus === 'active').length,
      assignedPlans: records.filter((record) => record.planCode).length,
      snapshots: records.filter((record) => record.snapshotAt).length,
    }),
    [records],
  );

  return (
    <section className="space-y-5">
      <section className="rounded-[24px] border border-cyan-300/16 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-1 text-xs font-semibold text-cyan-100">
              <Building2 className="h-4 w-4" />
              平台只读治理视图
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-normal text-white">租户管理</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              平台侧查看机构、套餐和配额边界
            </p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              当前展示为受控 demo 租户，不代表正式计费后台。
            </p>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              仅展示运营元数据、套餐分配和配额快照，不提供租户创建、冻结、恢复或删除流程。
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-3 text-sm font-semibold text-cyan-100">
            受控 demo 租户
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'demo 租户', value: totals.tenants, icon: Building2 },
          { label: '运行中租户', value: totals.activeTenants, icon: ShieldCheck },
          { label: '已分配套餐', value: totals.assignedPlans, icon: Database },
          { label: '配额快照', value: totals.snapshots, icon: CalendarClock },
        ].map((item) => (
          <article key={item.label} className="rounded-[22px] border border-white/10 bg-white/[0.075] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.14)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-medium text-slate-400">{item.label}</div>
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300/[0.12] text-cyan-100">
                <item.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 text-3xl font-semibold tracking-normal text-white">{isLoading ? '--' : item.value}</div>
          </article>
        ))}
      </section>

      {!errorState ? <CommercialHealthPanel health={commercialHealth} /> : null}

      <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-white">租户列表</h3>
            <p className="mt-1 text-sm text-slate-400">展示受控 demo 租户的基础状态、套餐信息和配额快照。</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-300">
            只读
          </span>
        </div>

        {isLoading ? (
          <div className="mt-4">
            <TenantManagementState kind="loading" title="正在加载租户管理数据..." />
          </div>
        ) : null}

        {!isLoading && errorState ? (
          <div className="mt-4">
            <TenantManagementState {...errorState} />
          </div>
        ) : null}

        {!isLoading && !errorState && records.length === 0 ? (
          <div className="mt-4">
            <TenantManagementState
              kind="empty"
              title="暂无受控 demo 租户"
              description="当前没有可展示的 demo 租户、套餐或配额快照。"
            />
          </div>
        ) : null}

        {!isLoading && !errorState && records.length > 0 ? (
          <div className="mt-4 space-y-4">
            {records.map((tenant) => (
              <section
                key={tenant.tenantId}
                className="rounded-2xl border border-white/10 bg-[#071322]/72 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Users className="h-5 w-5 text-cyan-100" />
                      <span className="text-base font-semibold text-white">{tenant.tenantName}</span>
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.10] px-2.5 py-1 text-xs font-semibold text-emerald-100">
                        租户状态：{tenant.tenantStatus}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tenantField('租户 ID', tenant.tenantId)}
                      {tenantField('套餐名称', tenant.planName ?? '未分配')}
                      {tenantField('套餐编号', tenant.planCode)}
                      {tenantField('套餐状态', tenant.planStatus)}
                      {tenantField('分配状态', tenant.assignmentStatus)}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-slate-300">
                    快照时间：{formatDateTime(tenant.snapshotAt)}
                  </div>
                </div>

                <div className="mt-4">
                  <TenantQuotaGrid tenant={tenant} />
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}
