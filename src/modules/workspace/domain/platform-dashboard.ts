import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Boxes,
  Brain,
  Building2,
  CalendarClock,
  FileText,
  KeyRound,
  LayoutDashboard,
  Plug,
  TrendingUp,
  Shield,
} from 'lucide-react';

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

export const platformNavItems: PlatformNavItem[] = [
  { label: '平台总览', icon: LayoutDashboard, active: true },
  { label: '首页与品牌', icon: FileText },
  { label: '租户管理', icon: Building2 },
  { label: '产品与套餐', icon: Boxes },
  { label: 'AI模型配置', icon: Brain },
  { label: 'AI用量与费用', icon: TrendingUp },
  { label: '知识库管理', icon: BookOpen },
  { label: '开放连接路线', icon: Plug },
  { label: '平台审计日志', icon: Shield },
  { label: '商业化边界', icon: Activity },
];

export const platformMetrics: PlatformMetric[] = [
  { label: '活跃租户数', value: '18', change: '总记录 24，暂停 4，注销 2', icon: Building2, tone: 'bg-blue-50 text-blue-600' },
  { label: '有效套餐覆盖率', value: '83%', change: '15 / 18 个活跃租户', icon: Boxes, tone: 'bg-emerald-50 text-emerald-600' },
  { label: '基础配置缺失租户', value: '3', change: '缺有效套餐或配额上限', icon: AlertTriangle, tone: 'bg-amber-50 text-amber-600' },
  { label: '快照异常租户', value: '4', change: '缺失 1，过期 3，阈值 7 天', icon: CalendarClock, tone: 'bg-cyan-50 text-cyan-600' },
  { label: '配额风险影响租户', value: '5', change: '高风险 2，中风险 3，风险项 8', icon: Activity, tone: 'bg-rose-50 text-rose-600' },
  { label: '拒绝审计信号', value: '7', change: '配额拒绝 5，其他拒绝 2，最近 100 条', icon: Shield, tone: 'bg-violet-50 text-violet-600' },
];

export const platformHealthItems = [
  { label: '缺少有效套餐', detail: '活跃租户没有有效套餐时，商业化口径无法判断', value: '2', status: '需要补齐', warning: true },
  { label: '缺少配额上限', detail: '套餐存在但配额上限缺失，容易误判租户风险', value: '1', status: '需要补齐', warning: true },
  { label: '快照异常租户', detail: '配额快照缺失或超过 7 天，当前用量判断不可信', value: '4', status: '需要复核', warning: true },
  { label: '配额拒绝样本', detail: '最近审计事件中出现拒绝结果，需要区分正常拦截和配置问题', value: '5', status: '需要审查', warning: false },
] as const;

export const platformCapabilityCards = [
  { icon: KeyRound, title: '真实计费未启用', detail: '只呈现套餐、配额和风险判断，不展示收入、合同、发票或支付数据。' },
  { icon: Plug, title: '外部连接未启用', detail: '开放连接属于长期路线，本页不生成密钥、不授权，也不投递外部系统。' },
  { icon: Shield, title: '真实人工智能密钥未启用', detail: '示例用量只用于治理参考，不读取真实密钥，也不触发真实模型调用。' },
  { icon: Brain, title: '模型配置为受控示例', detail: '模型配置只展示受控样例，避免把未上线能力误判为可运营能力。' },
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

export const platformTenantStatusItems = [
  { label: '活跃', value: '18', tone: 'bg-blue-500' },
  { label: '暂停', value: '4', tone: 'bg-amber-400' },
  { label: '注销', value: '2', tone: 'bg-slate-400' },
] as const;

export const platformPlanStatusItems = [
  { label: '有有效套餐', value: '15', tone: 'bg-emerald-500' },
  { label: '无有效套餐', value: '2', tone: 'bg-rose-500' },
  { label: '套餐待确认', value: '1', tone: 'bg-amber-400' },
] as const;

export const platformKnowledgeQualityItems = [
  { label: '已接入知识库租户', value: '9', detail: '仅作为能力成熟度参考' },
  { label: '低质量文件样本', value: '6', detail: '用于提醒治理，不作为核心经营指标' },
  { label: '待处理知识库任务', value: '3', detail: '低权重辅助信息' },
] as const;

export const platformAiReferenceItems = [
  { label: '示例用量租户', value: '7', detail: '受控示例，不代表真实调用' },
  { label: '模型配置待确认', value: '2', detail: '只提示配置完整性' },
  { label: '真实调用成本', value: '未启用', detail: '本轮不统计成本或排行' },
] as const;
