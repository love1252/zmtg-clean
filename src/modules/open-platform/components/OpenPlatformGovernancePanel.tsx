import { FileCheck2, Fingerprint, GitBranch, KeyRound, Layers3, ShieldCheck } from 'lucide-react';
import {
  auditEventCatalog,
  capabilityLifecycleGroups,
  openPlatformPermissions,
  platformRoleCatalog,
  tenantIsolationPrinciples,
} from '@/modules/open-platform/domain/governance';
import { cn } from '@/shared/utils/cn';

const sectionShell = 'rounded-xl border border-[#e6edf5] bg-white p-5 shadow-sm lg:p-6';

const actionLabels: Record<string, string> = {
  read_aggregate: '聚合读取',
  read_detail: '明细读取',
  read_own_tenant: '本租户读取',
  manage_status: '状态管理',
  manage_policy: '策略管理',
  review: '审查',
  export_report: '报告导出',
};

const resourceLabels: Record<string, string> = {
  tenant: '租户',
  open_connection: '开放连接',
  permission_policy: '权限策略',
  audit_log: '审计日志',
  platform_health: '平台健康',
};

const auditActionLabels: Record<string, string> = {
  'tenant.aggregate.read': '读取租户聚合态势',
  'permission.policy.review': '审查权限策略',
  'connection.lifecycle.transition': '变更开放连接状态',
  'security.review.complete': '完成安全审查',
};

const auditFieldLabels: Record<string, string> = {
  eventId: '事件编号',
  actorId: '操作者编号',
  actorRole: '操作者角色',
  tenantScope: '租户范围',
  resourceType: '资源类型',
  resourceId: '资源编号',
  action: '动作',
  result: '结果',
  occurredAt: '发生时间',
};

export function OpenPlatformGovernancePanel() {
  return (
    <section className="space-y-5" aria-labelledby="open-platform-governance-heading">
      <div className={cn(sectionShell, 'overflow-hidden')}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700">
              <ShieldCheck className="h-4 w-4" />
              长期路线治理词汇
            </div>
            <h2 id="open-platform-governance-heading" className="mt-4 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              开放平台基础治理
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              先把租户隔离、权限边界、连接生命周期和审计词汇固定为可视化基准，不代表真实生产能力已完成。第一阶段不生成真实密钥、不执行授权回调、不投递外部事件。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[620px]">
            {[
              { icon: Layers3, label: '租户边界', value: `${tenantIsolationPrinciples.length} 条原则` },
              { icon: Fingerprint, label: '角色权限', value: `${platformRoleCatalog.length} 类角色` },
              { icon: FileCheck2, label: '审计词汇', value: `${auditEventCatalog.length} 类事件` },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                <item.icon className="h-5 w-5 text-blue-600" />
                <div className="mt-3 text-lg font-semibold tracking-normal text-slate-950">{item.value}</div>
                <div className="mt-1 text-xs text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <article className={sectionShell}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600">
              <Layers3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-normal text-slate-950">租户隔离原则</h3>
              <p className="mt-1 text-sm text-slate-500">平台端看聚合态势，机构端看本租户资源。</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {tenantIsolationPrinciples.map((item) => (
              <div key={item.title} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                <h4 className="text-sm font-semibold tracking-normal text-slate-950">{item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p>
                <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.07] px-3 py-2 text-xs leading-5 text-amber-700">{item.risk}</div>
              </div>
            ))}
          </div>
        </article>

        <article className={sectionShell}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-300/[0.12] text-blue-700">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-normal text-slate-950">权限样例矩阵</h3>
              <p className="mt-1 text-sm text-slate-500">只定义边界语义，不接入真实 RBAC 存储。</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {openPlatformPermissions.map((permission) => {
              const role = platformRoleCatalog.find((item) => item.id === permission.roleId);

              return (
                <div key={`${permission.roleId}-${permission.resource}`} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold tracking-normal text-slate-950">{role?.name ?? permission.roleId}</h4>
                      <p className="mt-1 text-xs text-slate-500">{resourceLabels[permission.resource]}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {permission.actions.map((action) => (
                        <span key={action} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          {actionLabels[action]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">{permission.boundary}</p>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <article className={sectionShell}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-normal text-slate-950">连接生命周期</h3>
              <p className="mt-1 text-sm text-slate-500">API Key、OAuth、Webhook 仅作为长期路线治理词汇，不启用外部能力。</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {capabilityLifecycleGroups.map((group) => (
              <div key={group.id} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/[0.08] text-blue-700">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold tracking-normal text-slate-950">{group.title}</h4>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {group.states.map((state) => (
                    <span key={state.id} className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {state.label}
                    </span>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {group.transitions.slice(0, 3).map((transition) => (
                    <div key={`${transition.from}-${transition.to}`} className="text-xs leading-5 text-slate-500">
                      <span className="text-slate-600">{transition.trigger}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={sectionShell}>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-700">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-normal text-slate-950">审计事件词汇</h3>
              <p className="mt-1 text-sm text-slate-500">先统一事件分类和必填字段。</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {auditEventCatalog.map((event) => (
              <div key={event.category} className="rounded-2xl border border-[#e6edf5] bg-[#f8fafc] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold tracking-normal text-slate-950">{event.title}</h4>
                  <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                    {auditActionLabels[event.exampleAction] ?? event.title}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {event.requiredFields.slice(0, 6).map((field) => (
                    <span key={field} className="rounded-full border border-[#e6edf5] bg-white px-2.5 py-1 text-xs text-slate-600">
                      {auditFieldLabels[field] ?? field}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
