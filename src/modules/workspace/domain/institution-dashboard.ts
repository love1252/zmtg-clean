import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileSearch,
  LayoutDashboard,
  MessageCircle,
  Users,
  Workflow,
} from 'lucide-react';

export type InstitutionNavItem = {
  id: InstitutionViewId;
  label: string;
  icon: LucideIcon;
  active?: boolean;
};

export type InstitutionViewId =
  | 'dashboard'
  | 'customers'
  | 'followups'
  | 'treatmentSummaries'
  | 'audit'
  | 'conversations'
  | 'appointments'
  | 'knowledge'
  | 'analytics';

export const institutionNavItems: InstitutionNavItem[] = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard, active: true },
  { id: 'customers', label: '客户中心', icon: Users },
  { id: 'followups', label: '智能随访', icon: Workflow },
  { id: 'treatmentSummaries', label: '治疗摘要管理', icon: ClipboardList },
  { id: 'audit', label: '审计日志', icon: FileSearch },
  { id: 'conversations', label: '客服工作台', icon: MessageCircle },
  { id: 'appointments', label: '预约中心', icon: CalendarCheck },
  { id: 'knowledge', label: '知识库', icon: BookOpen },
  { id: 'analytics', label: '数据分析', icon: BarChart3 },
];

export const institutionSegmentItems = [
  { label: '高价值活跃', value: '1250', color: '#10b981' },
  { label: '高价值沉默', value: '680', color: '#f59e0b' },
  { label: '低价值活跃', value: '3200', color: '#3b82f6' },
  { label: '低价值沉默', value: '890', color: '#64748b' },
] as const;
