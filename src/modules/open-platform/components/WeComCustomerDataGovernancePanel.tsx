'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  FileCheck2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { PlatformSectionBanner } from '@/modules/open-platform/components/PlatformSectionBanner';
import {
  parseWeComPlatformGovernancePayload,
  type WeComGovernanceReason,
  type WeComPlatformGovernancePayload,
} from '@/modules/open-platform/domain/wecom-customer-data-governance';

const authorizationLabels = {
  not_configured: '未配置',
  authorized: '已授权（mock）',
  revoked: '已撤销',
  expired: '已过期',
  disabled: '已禁用',
  external_disabled: '外部能力关闭',
  manual_review_required: '待人工复核',
} as const;

const providerLabels = {
  mock_only: '仅 mock',
  disabled: 'provider 已禁用',
  external_disabled: '外部能力关闭',
} as const;

const syncLabels = {
  not_started: '未开始',
  mock_ready: 'mock 快照就绪',
  preflight_ready: '预检就绪',
  syncing_disabled: '同步已禁用',
  sync_failed: '同步失败',
  manual_review_required: '待人工复核',
} as const;

const reasonLabels: Record<WeComGovernanceReason, string> = {
  mock_readonly_ready: 'mock 只读状态正常',
  authorization_not_available: '授权不可用',
  provider_disabled: 'provider 默认关闭',
  external_provider_disabled: '外部能力关闭',
  forbidden_field_blocked: '字段策略已阻断',
};

const blockedCategoryLabels = {
  credential_material: '凭证材料',
  direct_identity: '直接身份标识',
  contact_detail: '联系方式',
  communication_payload: '沟通载荷',
} as const;

const auditEventLabels = {
  authorization_status_changed: '授权状态记录',
  sync_preflight_checked: '同步预检记录',
  mock_snapshot_generated: 'mock 快照生成',
  mapping_candidate_generated: '候选匹配生成',
  mapping_manual_review_updated: '人工复核更新',
  forbidden_field_blocked: '禁止字段阻断',
  external_provider_disabled: '外部 provider 关闭',
} as const;

type PanelState =
  | { status: 'loading' }
  | { status: 'loaded'; payload: WeComPlatformGovernancePayload }
  | { status: 'error'; message: string };

function statusError(status: number) {
  if (status === 401) return '登录状态已失效，请重新登录';
  if (status === 403) return '当前账号没有查看企业微信治理摘要的权限';
  return '企业微信治理摘要暂时不可用';
}

function MetricCard({ label, value, detail }: {
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <article className="rounded-[20px] border border-[#e6edf5] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#64748b]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[#1f2937]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-[#64748b]">{detail}</p>
    </article>
  );
}

function GovernanceContent({ payload }: { payload: WeComPlatformGovernancePayload }) {
  return (
    <>
      <section aria-label="企业微信治理关键指标" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="治理租户"
          value={payload.authorizationStatusSummary.totalTenants}
          detail={`已授权 ${payload.authorizationStatusSummary.counts.authorized} 个`}
        />
        <MetricCard
          label="健康 mock 快照"
          value={payload.syncHealthSummary.healthyTenantCount}
          detail={`最近快照 ${payload.latestMockSnapshotAt}`}
        />
        <MetricCard
          label="fail-closed 租户"
          value={payload.syncHealthSummary.blockedTenantCount}
          detail="授权、provider 或字段策略异常时默认阻断"
        />
        <MetricCard
          label="低敏审计事件"
          value={payload.auditSummary.eventCount}
          detail={`其中阻断事件 ${payload.auditSummary.blockedEventCount} 条`}
        />
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold">受控 mock / demo 只读治理视图</p>
            <p className="mt-1">
              外部能力保持关闭，所有异常状态执行 fail-closed；仅展示租户级低敏摘要，不承载客户资料或沟通载荷。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-[24px] border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-[#1f2937]">租户授权状态总览</h2>
              <p className="mt-1 text-sm text-[#64748b]">各状态均来自受控 fixture，不读取运行时配置。</p>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.entries(authorizationLabels).map(([status, label]) => (
              <div key={status} className="flex items-center justify-between rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3">
                <dt className="text-sm text-[#64748b]">{label}</dt>
                <dd className="text-sm font-semibold text-[#1f2937]">
                  {payload.authorizationStatusSummary.counts[status as keyof typeof authorizationLabels]}
                </dd>
              </div>
            ))}
          </dl>
        </article>

        <article className="rounded-[24px] border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
          <div className="flex items-start gap-3">
            <RefreshCw className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-[#1f2937]">同步健康状态</h2>
              <p className="mt-1 text-sm text-[#64748b]">当前只记录 mock 快照健康，不执行外部动作。</p>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.entries(syncLabels).map(([status, label]) => (
              <div key={status} className="flex items-center justify-between rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3">
                <dt className="text-sm text-[#64748b]">{label}</dt>
                <dd className="text-sm font-semibold text-[#1f2937]">
                  {payload.syncHealthSummary.counts[status as keyof typeof syncLabels]}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            外部能力启用状态：关闭；provider 受控状态共 {payload.providerStatusSummary.counts.mock_only + payload.providerStatusSummary.counts.disabled + payload.providerStatusSummary.counts.external_disabled} 个租户。
          </div>
        </article>
      </section>

      <section className="rounded-[24px] border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <h2 className="text-lg font-semibold text-[#1f2937]">异常租户低敏摘要</h2>
            <p className="mt-1 text-sm text-[#64748b]">仅显示 mock 租户引用与治理状态，不显示客户明细。</p>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[#e6edf5] text-[#64748b]">
              <tr>
                <th className="px-3 py-3 font-semibold">租户摘要</th>
                <th className="px-3 py-3 font-semibold">授权</th>
                <th className="px-3 py-3 font-semibold">provider</th>
                <th className="px-3 py-3 font-semibold">同步健康</th>
                <th className="px-3 py-3 font-semibold">阻断原因</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6edf5] text-[#1f2937]">
              {payload.anomalousTenants.map((tenant) => (
                <tr key={tenant.tenantReference}>
                  <td className="px-3 py-4 font-semibold">{tenant.tenantDisplayName}</td>
                  <td className="px-3 py-4">{authorizationLabels[tenant.authorizationStatus]}</td>
                  <td className="px-3 py-4">{providerLabels[tenant.providerState]}</td>
                  <td className="px-3 py-4">{syncLabels[tenant.syncStatus]}</td>
                  <td className="px-3 py-4 text-amber-700">{reasonLabels[tenant.reason]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-[24px] border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="text-lg font-semibold text-[#1f2937]">字段阻断摘要</h2>
              <p className="mt-1 text-sm text-[#64748b]">白名单已应用；未列入字段默认拒绝。</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {payload.fieldBlockingSummary.blockedCategories.map((category) => (
              <div key={category} className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                已阻断：{blockedCategoryLabels[category]}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-[#64748b]">
            本快照阻断 {payload.fieldBlockingSummary.blockedAttemptCount} 次字段越界；响应禁止字段计数为 0。
          </p>
        </article>

        <article className="rounded-[24px] border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-0.5 h-5 w-5 text-violet-600" />
            <div>
              <h2 className="text-lg font-semibold text-[#1f2937]">Audit summary</h2>
              <p className="mt-1 text-sm text-[#64748b]">固定事件类型与计数，不包含自由文本敏感诊断。</p>
            </div>
          </div>
          <dl className="mt-5 space-y-3">
            {payload.auditSummary.eventsByType.map((event) => (
              <div key={event.eventType} className="flex items-center justify-between rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3">
                <dt className="text-sm text-[#64748b]">{auditEventLabels[event.eventType]}</dt>
                <dd className="text-sm font-semibold text-[#1f2937]">
                  {event.count} 条 · 阻断 {event.blockedCount} 条
                </dd>
              </div>
            ))}
          </dl>
        </article>
      </section>
    </>
  );
}

export function WeComCustomerDataGovernancePanel() {
  const [state, setState] = useState<PanelState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch('/api/open-platform/wecom/customer-data-governance', {
          cache: 'no-store',
        });
        if (!response.ok) {
          if (active) setState({ status: 'error', message: statusError(response.status) });
          return;
        }
        const payload = parseWeComPlatformGovernancePayload(await response.json());
        if (active) {
          setState(payload
            ? { status: 'loaded', payload }
            : { status: 'error', message: '治理响应未通过字段白名单校验' });
        }
      } catch {
        if (active) setState({ status: 'error', message: '企业微信治理摘要暂时不可用' });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-6" aria-labelledby="wecom-governance-heading">
      <PlatformSectionBanner
        headingId="wecom-governance-heading"
        title="企业微信授权与同步健康治理"
        description="平台端租户级只读治理摘要，仅使用受控 mock / demo 数据，展示授权、provider、同步健康、字段阻断与低敏审计状态。"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-blue-800">
          <ShieldCheck className="h-4 w-4" />
          MOCK / DEMO · 只读
        </span>
        <span className="text-sm text-blue-700">真实客户数据：0 · 外部调用：关闭</span>
      </div>

      {state.status === 'loading' ? (
        <div className="rounded-2xl border border-[#e6edf5] bg-white px-5 py-8 text-sm text-[#64748b]">
          正在加载企业微信 mock / demo 治理摘要...
        </div>
      ) : null}
      {state.status === 'error' ? (
        <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {state.message}
        </div>
      ) : null}
      {state.status === 'loaded' ? <GovernanceContent payload={state.payload} /> : null}
    </section>
  );
}
