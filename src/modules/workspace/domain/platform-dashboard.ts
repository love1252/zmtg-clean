import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  BookOpen,
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
  Settings,
  Shield,
  Users,
  WalletCards,
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
  { label: '首页编辑', icon: FileText },
  { label: '租户管理', icon: Building2 },
  { label: '产品与套餐', icon: Boxes },
  { label: 'AI模型', icon: Database },
  { label: 'AI用量与费用', icon: WalletCards },
  { label: '知识库管理', icon: BookOpen },
  { label: '开放连接中心', icon: Plug },
  { label: '智能体运行监控', icon: Activity },
  { label: '平台数据分析', icon: BarChart3 },
  { label: '计费与订单', icon: CreditCard },
  { label: '权限与组织', icon: Shield },
  { label: '系统设置', icon: Settings },
];

export const platformMetrics: PlatformMetric[] = [
  { label: '累计入驻医院', value: '156', change: '↗ 8.2%', icon: Building2, tone: 'bg-blue-50 text-blue-600' },
  { label: '活跃机构', value: '142', change: '↗ 5.8%', icon: Users, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Agent调用总量', value: '2.6M', change: '↗ 18.5%', icon: Boxes, tone: 'bg-violet-50 text-violet-600' },
  { label: '服务用户数', value: '125.0K', change: '↗ 12.3%', icon: Globe2, tone: 'bg-cyan-50 text-cyan-600' },
  { label: 'MRR', value: '¥258,000', change: '↗ 6.8%', icon: DollarSign, tone: 'bg-amber-50 text-amber-600' },
  { label: '续费率', value: '94.2%', change: '↗ 1.2%', icon: RefreshCw, tone: 'bg-emerald-50 text-emerald-600' },
];

export const platformHealthItems = [
  { label: 'API Gateway', detail: '延迟 45ms', value: '99.98%', status: '运行正常', warning: false },
  { label: '数据库', detail: '延迟 12ms', value: '99.99%', status: '运行正常', warning: false },
  { label: 'Agent服务', detail: '延迟 230ms', value: '99.95%', status: '运行正常', warning: false },
  { label: '存储服务', detail: '1.2TB / 1.5TB', value: '78%', status: '容量警告', warning: true },
] as const;

export const platformCapabilityCards = [
  { icon: KeyRound, title: '开放接口', detail: 'API Key、OAuth、Webhook 后续接入' },
  { icon: Plug, title: '连接器治理', detail: '企微、HIS、CRM、投放平台统一管理' },
  { icon: Shield, title: '权限审计', detail: '平台操作留痕与租户边界核查' },
] as const;
