import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Boxes,
  Brain,
  Building2,
  CalendarClock,
  Coins,
  FileText,
  KeyRound,
  LayoutDashboard,
  Plug,
  TrendingUp,
  Shield,
  Presentation,
  RefreshCw,
} from 'lucide-react';
import type { TenantManagementListItem } from '@/modules/open-platform/domain/tenant-management';
import { getTenantQuotaRiskState } from '@/modules/open-platform/domain/tenant-management-view';

export type PlatformNavItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
};

export type PlatformMetric = {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  tone: string;
};

export type PlatformHealthItem = {
  label: string;
  detail: string;
  value: string;
  status: string;
  warning: boolean;
};

export type PlatformDistributionItem = {
  label: string;
  value: string;
  tone: string;
};

export type PlatformReferenceItem = {
  label: string;
  value: string;
  detail: string;
};

export type PlatformOverviewViewModel = {
  metrics: PlatformMetric[];
  healthItems: PlatformHealthItem[];
  tenantStatusItems: PlatformDistributionItem[];
  planStatusItems: PlatformDistributionItem[];
  knowledgeQualityItems: PlatformReferenceItem[];
  aiReferenceItems: PlatformReferenceItem[];
};

export const platformNavItems: PlatformNavItem[] = [
  { label: '平台总览', icon: LayoutDashboard, active: true },
  { label: '首页与品牌', icon: FileText },
  { label: '租户管理', icon: Building2 },
  { label: '产品与套餐', icon: Boxes },
  { label: 'AI模型配置', icon: Brain },
  { label: 'AI Credits规则', icon: Coins },
  { label: 'AI用量与费用', icon: TrendingUp },
  { label: '知识库管理', icon: BookOpen },
  { label: '开放连接路线', icon: Plug },
  { label: '体验版操作说明', icon: Presentation },
  { label: '体验数据重置', icon: RefreshCw },
  { label: '平台审计日志', icon: Shield },
  { label: '商业化边界', icon: Activity },
];

export const platformCapabilityCards = [
  { icon: KeyRound, title: '真实计费未启用', detail: '只呈现套餐、配额和风险判断，不展示收入、合同、发票或支付数据。' },
  { icon: Plug, title: '外部连接未启用', detail: '开放连接属于长期路线，本页不生成密钥、不授权，也不投递外部系统。' },
  { icon: Shield, title: 'AI 模型处于受控试运行', detail: '已接入真实厂商 Key（加密存储），机构端可通过知识库 AI 试问发起真实模型调用。非生产环境。' },
  { icon: Brain, title: '模型配置已接入多个厂商', detail: '支持 DeepSeek、豆包、通义千问等厂商 Key 管理和连接测试，机构端低敏试问可用。' },
] as const;

export type PlatformQuickAction = {
  label: string;
  icon: LucideIcon;
  hint: string;
};

export const platformQuickActions: PlatformQuickAction[] = [
  { label: '查看配额风险影响租户', icon: Activity, hint: '商业化边界' },
  { label: '补齐有效套餐和配额上限', icon: Boxes, hint: '产品与套餐' },
  { label: '处理快照异常租户', icon: CalendarClock, hint: '租户管理' },
  { label: '审查最近配额拒绝或其他拒绝信号', icon: Shield, hint: '平台审计日志' },
];

const dayMs = 86_400_000;
const staleSnapshotDays = 7;

function hasActivePlan(record: TenantManagementListItem) {
  return Boolean(record.planCode) && record.planStatus === 'active' && record.assignmentStatus === 'active';
}

function hasMissingQuotaLimit(record: TenantManagementListItem) {
  return [record.maxCustomers, record.maxAppointments, record.maxFollowUps, record.maxAiCalls].some(
    (value) => typeof value !== 'number',
  );
}

function isSnapshotStale(record: TenantManagementListItem, now: Date | string) {
  if (!record.snapshotAt) return true;
  const snapshotTime = Date.parse(record.snapshotAt);
  const nowTime = typeof now === 'string' ? Date.parse(now) : now.getTime();
  if (!Number.isFinite(snapshotTime) || !Number.isFinite(nowTime)) return true;
  return nowTime - snapshotTime > staleSnapshotDays * dayMs;
}

function percent(part: number, total: number) {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function statusText(count: number, activeText: string) {
  return count > 0 ? activeText : '无需处理';
}

export function buildPlatformOverviewViewModel(options: {
  tenants: TenantManagementListItem[];
  now: Date | string;
}): PlatformOverviewViewModel {
  const { tenants, now } = options;
  const activeTenants = tenants.filter((tenant) => tenant.tenantStatus === 'active');
  const suspendedTenants = tenants.filter((tenant) => tenant.tenantStatus === 'suspended');
  const cancelledTenants = tenants.filter((tenant) => tenant.tenantStatus === 'cancelled');
  const trialingTenants = tenants.filter((tenant) => tenant.tenantStatus === 'trialing');
  const activePlanTenants = activeTenants.filter(hasActivePlan);
  const activeNoPlanTenants = activeTenants.filter((tenant) => !tenant.planCode);
  const pendingPlanTenants = activeTenants.filter(
    (tenant) => Boolean(tenant.planCode) && !hasActivePlan(tenant),
  );
  const activeMissingPlanTenants = activeTenants.filter((tenant) => !hasActivePlan(tenant));
  const quotaMissingTenants = activeTenants.filter(hasMissingQuotaLimit);
  const configurationMissingTenants = activeTenants.filter(
    (tenant) => !hasActivePlan(tenant) || hasMissingQuotaLimit(tenant),
  );
  const snapshotIssueTenants = activeTenants.filter((tenant) => isSnapshotStale(tenant, now));
  const quotaRiskTenants = activeTenants.filter((tenant) => {
    const quotaRisk = getTenantQuotaRiskState(tenant);
    return quotaRisk.status === 'near_limit' || quotaRisk.status === 'blocked';
  });
  const quotaBlockedTenants = activeTenants.filter(
    (tenant) => getTenantQuotaRiskState(tenant).status === 'blocked',
  );
  const quotaNearLimitTenants = activeTenants.filter(
    (tenant) => getTenantQuotaRiskState(tenant).status === 'near_limit',
  );

  return {
    metrics: [
      {
        label: '活跃租户数',
        value: String(activeTenants.length),
        change: `总记录 ${tenants.length}，暂停 ${suspendedTenants.length}，注销 ${cancelledTenants.length}`,
        icon: Building2,
        tone: 'bg-blue-50 text-blue-600',
      },
      {
        label: '有效套餐覆盖率',
        value: percent(activePlanTenants.length, activeTenants.length),
        change: `${activePlanTenants.length} / ${activeTenants.length} 个活跃租户`,
        icon: Boxes,
        tone: 'bg-emerald-50 text-emerald-600',
      },
      {
        label: '基础配置缺失租户',
        value: String(configurationMissingTenants.length),
        change:
          configurationMissingTenants.length > 0
            ? `缺有效套餐 ${activeMissingPlanTenants.length}，缺配额上限 ${quotaMissingTenants.length}`
            : '暂无配置缺失租户',
        icon: AlertTriangle,
        tone: 'bg-amber-50 text-amber-600',
      },
      {
        label: '快照异常租户',
        value: String(snapshotIssueTenants.length),
        change:
          snapshotIssueTenants.length > 0
            ? `缺失或超过 ${staleSnapshotDays} 天，需复核`
            : '暂无快照异常',
        icon: CalendarClock,
        tone: 'bg-cyan-50 text-cyan-600',
      },
      {
        label: '配额风险影响租户',
        value: String(quotaRiskTenants.length),
        change:
          quotaRiskTenants.length > 0
            ? `高风险 ${quotaBlockedTenants.length}，中风险 ${quotaNearLimitTenants.length}`
            : '暂无配额风险',
        icon: Activity,
        tone: 'bg-rose-50 text-rose-600',
      },
      {
        label: '拒绝审计信号',
        value: '0',
        change: '平台审计日志已清空或未接入本页聚合',
        icon: Shield,
        tone: 'bg-violet-50 text-violet-600',
      },
    ],
    healthItems: [
      {
        label: '缺少有效套餐',
        detail: '活跃租户没有有效套餐时，商业化口径无法判断',
        value: String(activeMissingPlanTenants.length),
        status: statusText(activeMissingPlanTenants.length, '需要补齐'),
        warning: activeMissingPlanTenants.length > 0,
      },
      {
        label: '缺少配额上限',
        detail: '套餐存在但配额上限缺失，容易误判租户风险',
        value: String(quotaMissingTenants.length),
        status: statusText(quotaMissingTenants.length, '需要补齐'),
        warning: quotaMissingTenants.length > 0,
      },
      {
        label: '快照异常租户',
        detail: `配额快照缺失或超过 ${staleSnapshotDays} 天，当前用量判断不可信`,
        value: String(snapshotIssueTenants.length),
        status: statusText(snapshotIssueTenants.length, '需要复核'),
        warning: snapshotIssueTenants.length > 0,
      },
      {
        label: '配额拒绝样本',
        detail: '拒绝审计信号请进入平台审计日志查看，本页不保留静态样本数',
        value: '0',
        status: '暂无样本',
        warning: false,
      },
    ],
    tenantStatusItems: [
      { label: '活跃', value: String(activeTenants.length), tone: 'bg-blue-500' },
      { label: '暂停', value: String(suspendedTenants.length), tone: 'bg-amber-400' },
      { label: '注销', value: String(cancelledTenants.length), tone: 'bg-slate-400' },
    ],
    planStatusItems: [
      { label: '有有效套餐', value: String(activePlanTenants.length), tone: 'bg-emerald-500' },
      { label: '无有效套餐', value: String(activeNoPlanTenants.length), tone: 'bg-rose-500' },
      { label: '套餐待确认', value: String(pendingPlanTenants.length), tone: 'bg-amber-400' },
    ],
    knowledgeQualityItems: [
      { label: '已接入知识库租户', value: '未接入', detail: '本页暂不读取知识库真实统计' },
      { label: '低质量文件样本', value: '0', detail: '暂无平台总览聚合样本' },
      { label: '待处理知识库任务', value: '0', detail: '低权重辅助信息' },
    ],
    aiReferenceItems: [
      { label: '试用租户参考', value: String(trialingTenants.length), detail: '仅来自租户状态参考，不代表真实调用' },
      { label: '模型配置待确认', value: '未接入', detail: '本页暂不读取模型配置快照' },
      { label: '真实调用成本', value: '未启用', detail: '本轮不统计成本或排行' },
    ],
  };
}
