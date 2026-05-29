import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Boxes,
  Building2,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  Globe2,
  KeyRound,
  LayoutDashboard,
  Plug,
  RefreshCw,
  Shield,
  Users,
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
  { label: 'AI 模型', icon: Database },
  { label: '开放连接中心', icon: Plug },
  { label: '权限与审计', icon: Shield },
  { label: '计费与订单', icon: CreditCard },
];

export const platformMetrics: PlatformMetric[] = [
  { label: '入驻医院', value: '156', change: '↗ 8.2%', icon: Building2, tone: 'bg-blue-50 text-blue-600' },
  { label: '活跃机构', value: '142', change: '↗ 5.8%', icon: Users, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Agent 调用', value: '2.6M', change: '↗ 18.5%', icon: Boxes, tone: 'bg-violet-50 text-violet-600' },
  { label: '服务用户', value: '125K', change: '↗ 12.3%', icon: Globe2, tone: 'bg-cyan-50 text-cyan-600' },
  { label: 'MRR', value: '¥258K', change: '↗ 6.8%', icon: DollarSign, tone: 'bg-amber-50 text-amber-600' },
  { label: '续费率', value: '94.2%', change: '↗ 1.2%', icon: RefreshCw, tone: 'bg-emerald-50 text-emerald-600' },
];

export const platformHealthItems = [
  { label: 'API Gateway', detail: '延迟 45ms', value: '99.98%', status: '运行正常', warning: false },
  { label: '数据库', detail: '延迟 12ms', value: '99.99%', status: '运行正常', warning: false },
  { label: 'Agent服务', detail: '延迟 230ms', value: '99.95%', status: '运行正常', warning: false },
  { label: '存储服务', detail: '1.2TB / 1.5TB', value: '78%', status: '容量警告', warning: true },
] as const;

export const platformCapabilityCards = [
  { icon: KeyRound, title: '开放接口治理', detail: 'API Key、OAuth、Webhook 作为后续独立规划。' },
  { icon: Activity, title: '模型与智能体监控', detail: '按租户、模型、工具调用量观测成本与风险。' },
  { icon: Shield, title: '权限审计', detail: '平台操作留痕，避免越权查看机构敏感数据。' },
] as const;
