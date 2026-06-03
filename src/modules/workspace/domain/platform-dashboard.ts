import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Boxes,
  Building2,
  CalendarClock,
  Database,
  FileText,
  KeyRound,
  LayoutDashboard,
  Plug,
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
  { label: 'AI 配额边界', icon: Database },
  { label: '开放连接路线', icon: Plug },
  { label: '权限与审计', icon: Shield },
  { label: '商业化边界', icon: Activity },
];

export const platformMetrics: PlatformMetric[] = [
  { label: 'demo 租户', value: '4', change: '受控演示', icon: Building2, tone: 'bg-blue-50 text-blue-600' },
  { label: '演示套餐', value: '4', change: 'Starter / Growth / Trial / Enterprise', icon: Boxes, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'AI 配额', value: '0 / 0', change: '当前未启用', icon: Database, tone: 'bg-violet-50 text-violet-600' },
  { label: '配额快照', value: '4', change: '运营参考', icon: CalendarClock, tone: 'bg-cyan-50 text-cyan-600' },
  { label: '商业化信号', value: '3 类', change: '风险 / 缺失 / denied', icon: Activity, tone: 'bg-amber-50 text-amber-600' },
  { label: '平台审计', value: '可追踪', change: '关键操作留痕', icon: Shield, tone: 'bg-emerald-50 text-emerald-600' },
];

export const platformHealthItems = [
  { label: '租户管理视图', detail: '机构、套餐、配额只读展示', value: '已就绪', status: '受控 demo', warning: false },
  { label: '商业化健康', detail: '运营辅助，不做正式计费', value: '已就绪', status: '受控 demo', warning: false },
  { label: 'AI 调用配额', detail: '当前未启用 AI 调用配额', value: '0 / 0', status: '未启用', warning: false },
  { label: '开放连接路线', detail: '长期路线，当前不接外部系统', value: '未启用', status: '路线边界', warning: true },
] as const;

export const platformCapabilityCards = [
  { icon: KeyRound, title: '开放连接治理边界', detail: 'API Key、OAuth、Webhook 保留为长期路线治理词汇，当前不生成密钥、不授权、不投递。' },
  { icon: Activity, title: '商业化健康收尾', detail: '展示套餐覆盖、配额快照、配置缺失和 quota denied 信号，不做支付、合同或发票。' },
  { icon: Shield, title: '平台操作可审计', detail: '平台操作留痕，避免越权查看机构敏感数据。' },
] as const;
