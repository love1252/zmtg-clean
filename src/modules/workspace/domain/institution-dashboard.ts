import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Bot,
  BriefcaseBusiness,
  CalendarCheck,
  Clock3,
  Database,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Trophy,
  Users,
  Workflow,
} from 'lucide-react';

export type InstitutionNavItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
};

export type InstitutionStatItem = {
  label: string;
  value: string;
  change: string;
  tone: 'blue' | 'violet' | 'emerald' | 'amber';
  icon: LucideIcon;
};

export const institutionNavItems: InstitutionNavItem[] = [
  { label: '工作台', icon: LayoutDashboard, active: true },
  { label: '智能体中心', icon: Bot },
  { label: '客户接入中心', icon: Database },
  { label: '客户中心', icon: Users },
  { label: '智能随访', icon: Workflow },
  { label: '客服工作台', icon: MessageCircle },
  { label: '预约中心', icon: CalendarCheck },
  { label: '知识库', icon: BookOpen },
  { label: '数据分析', icon: BarChart3 },
  { label: '员工绩效', icon: Trophy },
  { label: '系统设置', icon: Settings },
];

export const institutionStats: InstitutionStatItem[] = [
  { label: '累计客户数', value: '13', change: '↗ 100%', tone: 'blue', icon: Users },
  { label: '活跃旅程数', value: '6', change: '↘ 25%', tone: 'violet', icon: BriefcaseBusiness },
  { label: '预约转化率', value: '25%', change: '↗ 8%', tone: 'emerald', icon: CalendarCheck },
  { label: '待处理随访', value: '10', change: '↘ 5%', tone: 'amber', icon: Clock3 },
];

export const institutionSuggestions = [
  { type: '复购', title: '今日复购提醒', description: '打开率提升18%，建议跟进12位高意向用户' },
  { type: '转化', title: '沉默用户激活', description: '检测到32位30天未互动用户，建议发送激活旅程' },
  { type: '服务', title: '术后随访优化', description: '水光项目D7随访响应率偏低，建议调整话术' },
  { type: '营销', title: '活动预热提醒', description: '端午节活动将于3天后开始，建议提前启动预热流程' },
] as const;

export const institutionSegmentItems = [
  { label: '高价值活跃', value: '1250', color: '#10b981' },
  { label: '高价值沉默', value: '680', color: '#f59e0b' },
  { label: '低价值活跃', value: '3200', color: '#3b82f6' },
  { label: '低价值沉默', value: '890', color: '#64748b' },
] as const;
