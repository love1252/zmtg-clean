import type { AccessContext } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  Gauge,
  FileSearch,
  LayoutDashboard,
  Link2,
  MessageCircle,
  Server,
  Target,
  UserRoundSearch,
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
  | 'aiServiceUsage'
  | 'treatmentSummaries'
  | 'audit'
  | 'wecomExternalContacts'
  | 'wecomCustomerMappingCandidates'
  | 'hisConnections'
  | 'conversations'
  | 'appointments'
  | 'knowledge'
  | 'analytics'
  | 'opportunities';

export const institutionNavItems: InstitutionNavItem[] = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard, active: true },
  { id: 'customers', label: '客户中心', icon: Users },
  { id: 'followups', label: '智能随访', icon: Workflow },
  { id: 'aiServiceUsage', label: 'AI 服务使用', icon: Gauge },
  { id: 'treatmentSummaries', label: '治疗摘要管理', icon: ClipboardList },
  { id: 'opportunities', label: '机会池', icon: Target },
  { id: 'audit', label: '审计日志', icon: FileSearch },
  { id: 'wecomExternalContacts', label: '企微外部联系人', icon: UserRoundSearch },
  { id: 'wecomCustomerMappingCandidates', label: '企微匹配复核', icon: Link2 },
  { id: 'hisConnections', label: 'HIS 连接配置', icon: Server },
  { id: 'conversations', label: '客服工作台', icon: MessageCircle },
  { id: 'appointments', label: '预约中心', icon: CalendarCheck },
  { id: 'knowledge', label: '知识库', icon: BookOpen },
  { id: 'analytics', label: '数据分析', icon: BarChart3 },
];

export function canShowWeComCustomerMappingCandidatesNavigation(
  context: AccessContext | null,
) {
  if (
    !context ||
    context.scope !== 'tenant' ||
    !context.tenantId ||
    !context.institutionId
  ) {
    return false;
  }

  return canAccessResource({
    context,
    resource: 'customer',
    action: 'read',
    targetTenantId: context.tenantId,
  }).allowed;
}

export function visibleInstitutionNavItems(context: AccessContext | null) {
  return institutionNavItems.filter(
    (item) =>
      item.id !== 'wecomCustomerMappingCandidates' ||
      canShowWeComCustomerMappingCandidatesNavigation(context),
  );
}

export const institutionSegmentItems = [
  { label: '高价值活跃', value: '1250', color: '#10b981' },
  { label: '高价值沉默', value: '680', color: '#f59e0b' },
  { label: '低价值活跃', value: '3200', color: '#3b82f6' },
  { label: '低价值沉默', value: '890', color: '#64748b' },
] as const;
