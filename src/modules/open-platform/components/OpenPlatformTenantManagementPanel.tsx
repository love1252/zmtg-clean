'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Database,
  Loader2,
  ShieldCheck,
  Users,
  CalendarClock,
} from 'lucide-react';
import {
  listOpenPlatformTenants,
  type OpenPlatformTenantClientError,
  type OpenPlatformTenantRecord,
} from '@/modules/open-platform/client/platform-tenant-management-client';

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

function visibleTenantErrorState(error: OpenPlatformTenantClientError): TenantManagementStateProps {
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
      title: '租户管理数据暂时不可用',
    };
  }

  return {
    kind: 'error',
    title: error.message || '租户管理请求失败',
  };
}

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

        return (
          <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <div className="text-xs font-semibold text-slate-400">{item.label}</div>
            <div className="mt-2 text-xl font-semibold tracking-normal text-white">
              {quotaValue(current)} / {quotaValue(max)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OpenPlatformTenantManagementPanel() {
  const [records, setRecords] = useState<OpenPlatformTenantRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState<TenantManagementStateProps | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadTenants() {
      setIsLoading(true);
      setErrorState(null);
      const result = await listOpenPlatformTenants();

      if (!isActive) return;

      if (result.ok) {
        setRecords(result.records);
      } else {
        setRecords([]);
        setErrorState(visibleTenantErrorState(result.error));
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
              平台只读
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-normal text-white">租户管理</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              查看租户运营元数据、套餐分配和配额快照，不进入客户、预约或随访业务明细。
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#071322]/72 px-4 py-3 text-sm font-semibold text-cyan-100">
            GET /api/open-platform/tenants
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: '租户总数', value: totals.tenants, icon: Building2 },
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

      <article className="rounded-[24px] border border-white/10 bg-white/[0.075] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold tracking-normal text-white">租户列表</h3>
            <p className="mt-1 text-sm text-slate-400">展示租户基础状态、套餐信息和配额用量。</p>
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
              title="暂无租户运营元数据"
              description="当前没有可展示的租户套餐和配额数据。"
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
                      {tenantField('套餐 code', tenant.planCode)}
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
