import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Boxes,
  Brain,
  Building2,
  CalendarClock,
  Clock,
  CreditCard,
  Database,
  FileText,
  Globe,
  KeyRound,
  LayoutDashboard,
  Plug,
  TrendingUp,
  Shield,
  Server,
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
  { label: '知识库文件', value: '—', change: '接入中，尚未统计', icon: BookOpen, tone: 'bg-rose-50 text-rose-600' },
  { label: '平台运行', value: '—', change: '受控 demo 环境', icon: Server, tone: 'bg-slate-50 text-slate-600' },
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

export type PlatformAlertItem = {
  id: number;
  level: 'error' | 'warning' | 'info';
  label: string;
  detail: string;
  timeAgo: string;
  icon: LucideIcon;
};

export type PlatformSystemHealthItem = {
  key: string;
  name: string;
  status: 'healthy' | 'warning' | 'offline';
  uptimePercent: number;
  latencyMs: number;
  capacityHint: string | null;
};

export type PlatformQuickAction = {
  label: string;
  icon: LucideIcon;
  hint: string;
};

export const platformAlertItems: PlatformAlertItem[] = [
  { id: 1, level: 'warning', label: '演示租户：北京美莱', detail: '套餐配额快照超过 7 天未更新', timeAgo: '模拟数据', icon: Clock },
  { id: 2, level: 'info', label: '演示租户：上海艺星', detail: '试用套餐即将到期（演示时间线）', timeAgo: '模拟数据', icon: Bell },
  { id: 3, level: 'warning', label: 'AI 调用配额', detail: '当前未启用 AI 调用配额，租户调用不受限', timeAgo: '模拟数据', icon: Activity },
  { id: 4, level: 'info', label: '商业化边界', detail: 'quota denied 事件记录为空（演示环境无真实请求）', timeAgo: '模拟数据', icon: TrendingUp },
  { id: 5, level: 'error', label: '开放连接路线', detail: '所有外部连接器均处于禁用状态（长期路线）', timeAgo: '模拟数据', icon: AlertTriangle },
];

export const platformSystemHealthItems: PlatformSystemHealthItem[] = [
  { key: 'api-gateway', name: 'API Gateway', status: 'healthy', uptimePercent: 99.9, latencyMs: 42, capacityHint: null },
  { key: 'database', name: '数据库 (PostgreSQL)', status: 'healthy', uptimePercent: 99.9, latencyMs: 12, capacityHint: null },
  { key: 'ai-runtime', name: 'AI 运行时', status: 'offline', uptimePercent: 0, latencyMs: 0, capacityHint: '未启用' },
  { key: 'storage', name: '文件存储', status: 'warning', uptimePercent: 99.9, latencyMs: 68, capacityHint: '演示环境无真实存储' },
  { key: 'agent-service', name: 'Agent 服务', status: 'offline', uptimePercent: 0, latencyMs: 0, capacityHint: '未部署' },
];

export const platformQuickActions: PlatformQuickAction[] = [
  { label: '查看租户列表', icon: Building2, hint: '租户管理' },
  { label: '审查商业化健康', icon: Activity, hint: '商业化边界' },
  { label: '浏览 AI 用量', icon: TrendingUp, hint: 'AI用量与费用' },
  { label: '检查模型配置', icon: Brain, hint: 'AI模型配置' },
  { label: '查看知识库', icon: BookOpen, hint: '知识库管理' },
];

export const platformTrendSummary = {
  tenantGrowthLabel: '演示租户增长趋势（占位）',
  callTrendLabel: 'AI 调用趋势（未启用）',
  revenueLabel: '商业化收入（不涉及）',
  note: '所有趋势数据均为占位 SVG，不代表真实运营数据',
  tenantGrowthChange: '+12.5%',
  callTrendChange: '+18.5%',
  revenueChange: '+6.8%',
};
