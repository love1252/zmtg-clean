import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck,
  Clock3,
  LayoutDashboard,
  MessageCircle,
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
  { label: '客户中心', icon: Users },
  { label: '智能随访', icon: Workflow },
  { label: '客服工作台', icon: MessageCircle },
  { label: '预约中心', icon: CalendarCheck },
  { label: '知识库', icon: BookOpen },
  { label: '数据分析', icon: BarChart3 },
];

export const institutionStats: InstitutionStatItem[] = [
  { label: '累计客户资产', value: '5,143', change: '↗ 本周 +12%', tone: 'blue', icon: Users },
  { label: '今日待承接', value: '18', change: 'AI 已排序', tone: 'violet', icon: BriefcaseBusiness },
  { label: '预约转化率', value: '32%', change: '↗ +7.6%', tone: 'emerald', icon: CalendarCheck },
  { label: '复购窗口客户', value: '42', change: '建议人工跟进', tone: 'amber', icon: Clock3 },
];

export const institutionSuggestions = [
  { type: '复购', title: '优先跟进术后 D21-D30 客户', description: '18 位客户近期咨询修复补水，建议由资深咨询师承接。', action: '查看客户' },
  { type: '转化', title: '沉默高意向客户激活', description: '7 位客户超过 48 小时未回复，AI 已生成提醒话术。', action: '生成话术' },
  { type: '服务', title: '异常反馈转人工', description: '3 位术后客户出现敏感词，建议客服优先回访。', action: '分配客服' },
] as const;

export const institutionJourneyLanes = [
  { title: '新客咨询', items: [{ title: '玻尿酸咨询', detail: '高预算 · 需人工', hot: true }, { title: '水光项目禁忌', detail: 'AI 已提示注意事项' }] },
  { title: '预约到院', items: [{ title: '明日到院提醒', detail: '12 位待确认' }, { title: '高意向客户改约', detail: '需协调专家档期', hot: true }] },
  { title: '术后关怀', items: [{ title: 'D3 红肿反馈', detail: 'AI 已记录恢复情况' }, { title: '异常症状转人工', detail: '3 位客户需回访', hot: true }] },
  { title: '复购召回', items: [{ title: '补水修复窗口', detail: '18 位客户进入窗口', hot: true }, { title: '会员生日关怀', detail: '本周 9 位' }] },
] as const;

export const institutionActionQueue = [
  { name: '王女士', title: '热玛吉复购窗口', detail: '术后第 28 天 · 最近咨询补水', score: 98 },
  { name: '陈女士', title: '价格异议待承接', detail: '高预算 · 已浏览案例页 3 次', score: 91 },
  { name: '刘女士', title: '明日到院确认', detail: '需同步术前注意事项', score: 87 },
  { name: '赵女士', title: '术后异常反馈', detail: 'D3 红肿描述 · 建议人工回访', score: 86 },
  { name: '李女士', title: '沉默客户激活', detail: '48 小时未回复 · AI 已生成话术', score: 78 },
] as const;

export const institutionSegmentItems = [
  { label: '高价值活跃', value: '1250', color: '#10b981' },
  { label: '高价值沉默', value: '680', color: '#f59e0b' },
  { label: '低价值活跃', value: '3200', color: '#3b82f6' },
  { label: '低价值沉默', value: '890', color: '#64748b' },
] as const;
