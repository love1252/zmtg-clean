import type { InstitutionNavigationSectionIdV1 } from './institution-navigation';
import type { InstitutionCanonicalRouteIdV1 } from './institution-routes';

function freezeContractValueV1<const T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    freezeContractValueV1(nestedValue);
  }

  Object.freeze(value);
  return value;
}

export const INSTITUTION_CAPABILITY_KINDS_V1 = Object.freeze([
  'section',
  'page',
  'action',
] as const);

export type InstitutionCapabilityKindV1 =
  (typeof INSTITUTION_CAPABILITY_KINDS_V1)[number];

type InstitutionCapabilityDefinitionShapeV1 = Readonly<{
  key: string;
  kind: InstitutionCapabilityKindV1;
  label: string;
  sectionId: InstitutionNavigationSectionIdV1;
  targetRouteId: InstitutionCanonicalRouteIdV1;
  href: string;
}>;

/**
 * Frozen public display order for institution section, index-page, and controlled-create
 * capabilities. It is a declaration registry only: it does not release, authorize, parse,
 * diagnose, or prove that any capability is operational. Section, page, and action entries are
 * independent keys; this registry does not derive parent/child decisions, choose a released
 * landing page, redirect the Care root, or prove that a target is reachable for the current
 * AccessContext.
 */
export const INSTITUTION_CAPABILITY_REGISTRY_V1 = freezeContractValueV1([
  {
    key: 'section_workbench',
    kind: 'section',
    label: '工作台',
    sectionId: 'workbench',
    targetRouteId: 'workbench',
    href: '/hospital',
  },
  {
    key: 'page_workbench',
    kind: 'page',
    label: '工作台',
    sectionId: 'workbench',
    targetRouteId: 'workbench',
    href: '/hospital',
  },
  {
    key: 'section_customers',
    kind: 'section',
    label: '客户中心',
    sectionId: 'customers',
    targetRouteId: 'customer_list',
    href: '/hospital/customers',
  },
  {
    key: 'page_customer_list',
    kind: 'page',
    label: '客户列表',
    sectionId: 'customers',
    targetRouteId: 'customer_list',
    href: '/hospital/customers',
  },
  {
    key: 'action_customer_create',
    kind: 'action',
    label: '新建客户',
    sectionId: 'customers',
    targetRouteId: 'customer_list',
    href: '/hospital/customers?create=1',
  },
  {
    key: 'page_customer_treatments',
    kind: 'page',
    label: '治疗记录',
    sectionId: 'customers',
    targetRouteId: 'customer_treatments',
    href: '/hospital/customers/treatments',
  },
  {
    key: 'section_conversations',
    kind: 'section',
    label: '会话工作台',
    sectionId: 'conversations',
    targetRouteId: 'conversation_queue',
    href: '/hospital/conversations',
  },
  {
    key: 'page_conversation_queue',
    kind: 'page',
    label: '会话队列',
    sectionId: 'conversations',
    targetRouteId: 'conversation_queue',
    href: '/hospital/conversations',
  },
  {
    key: 'page_conversation_automations',
    kind: 'page',
    label: '自动触达',
    sectionId: 'conversations',
    targetRouteId: 'conversation_automations',
    href: '/hospital/conversations/automations',
  },
  {
    key: 'section_care',
    kind: 'section',
    label: '预约与随访',
    sectionId: 'care',
    targetRouteId: 'care_today_queue',
    href: '/hospital/care',
  },
  {
    key: 'page_care_today_queue',
    kind: 'page',
    label: '今日队列',
    sectionId: 'care',
    targetRouteId: 'care_today_queue',
    href: '/hospital/care',
  },
  {
    key: 'page_care_appointments',
    kind: 'page',
    label: '预约管理',
    sectionId: 'care',
    targetRouteId: 'care_appointments',
    href: '/hospital/care/appointments',
  },
  {
    key: 'action_care_appointment_create',
    kind: 'action',
    label: '新建预约',
    sectionId: 'care',
    targetRouteId: 'care_appointments',
    href: '/hospital/care/appointments?create=1',
  },
  {
    key: 'page_care_followups',
    kind: 'page',
    label: '随访任务',
    sectionId: 'care',
    targetRouteId: 'care_followups',
    href: '/hospital/care/followups',
  },
  {
    key: 'action_care_followup_create',
    kind: 'action',
    label: '新建随访',
    sectionId: 'care',
    targetRouteId: 'care_followups',
    href: '/hospital/care/followups?create=1',
  },
  {
    key: 'page_care_paths',
    kind: 'page',
    label: '路径管理',
    sectionId: 'care',
    targetRouteId: 'care_paths',
    href: '/hospital/care/paths',
  },
  {
    key: 'section_knowledge',
    kind: 'section',
    label: '知识库',
    sectionId: 'knowledge',
    targetRouteId: 'knowledge_library',
    href: '/hospital/knowledge',
  },
  {
    key: 'page_knowledge_library',
    kind: 'page',
    label: '资料库',
    sectionId: 'knowledge',
    targetRouteId: 'knowledge_library',
    href: '/hospital/knowledge',
  },
  {
    key: 'page_knowledge_search',
    kind: 'page',
    label: '检索测试',
    sectionId: 'knowledge',
    targetRouteId: 'knowledge_search',
    href: '/hospital/knowledge/search',
  },
  {
    key: 'page_knowledge_qa',
    kind: 'page',
    label: '问答与引用',
    sectionId: 'knowledge',
    targetRouteId: 'knowledge_qa',
    href: '/hospital/knowledge/qa',
  },
  {
    key: 'page_knowledge_jobs',
    kind: 'page',
    label: '任务记录',
    sectionId: 'knowledge',
    targetRouteId: 'knowledge_jobs',
    href: '/hospital/knowledge/jobs',
  },
  {
    key: 'section_analytics',
    kind: 'section',
    label: '经营分析',
    sectionId: 'analytics',
    targetRouteId: 'analytics_overview',
    href: '/hospital/analytics',
  },
  {
    key: 'page_analytics_overview',
    kind: 'page',
    label: '经营总览',
    sectionId: 'analytics',
    targetRouteId: 'analytics_overview',
    href: '/hospital/analytics',
  },
  {
    key: 'page_analytics_consumption',
    kind: 'page',
    label: '消费分析',
    sectionId: 'analytics',
    targetRouteId: 'analytics_consumption',
    href: '/hospital/analytics/consumption',
  },
  {
    key: 'page_analytics_projects',
    kind: 'page',
    label: '项目分析',
    sectionId: 'analytics',
    targetRouteId: 'analytics_projects',
    href: '/hospital/analytics/projects',
  },
  {
    key: 'page_analytics_opportunities',
    kind: 'page',
    label: '客户与机会',
    sectionId: 'analytics',
    targetRouteId: 'analytics_opportunities',
    href: '/hospital/analytics/opportunities',
  },
  {
    key: 'page_analytics_reports',
    kind: 'page',
    label: 'AI 经营报告',
    sectionId: 'analytics',
    targetRouteId: 'analytics_reports',
    href: '/hospital/analytics/reports',
  },
  {
    key: 'section_system',
    kind: 'section',
    label: '管理中心',
    sectionId: 'system',
    targetRouteId: 'system_overview',
    href: '/hospital/system',
  },
  {
    key: 'page_system_overview',
    kind: 'page',
    label: '系统概览',
    sectionId: 'system',
    targetRouteId: 'system_overview',
    href: '/hospital/system',
  },
  {
    key: 'page_system_organization',
    kind: 'page',
    label: '机构与成员',
    sectionId: 'system',
    targetRouteId: 'system_organization',
    href: '/hospital/system/organization',
  },
  {
    key: 'page_system_channels',
    kind: 'page',
    label: '渠道接入',
    sectionId: 'system',
    targetRouteId: 'system_channels',
    href: '/hospital/system/channels',
  },
  {
    key: 'page_system_channel_mappings',
    kind: 'page',
    label: '身份匹配',
    sectionId: 'system',
    targetRouteId: 'system_channel_mappings',
    href: '/hospital/system/channels/mappings',
  },
  {
    key: 'page_system_data',
    kind: 'page',
    label: '数据接入与治理',
    sectionId: 'system',
    targetRouteId: 'system_data',
    href: '/hospital/system/data',
  },
  {
    key: 'page_system_ai_usage',
    kind: 'page',
    label: 'AI 与额度',
    sectionId: 'system',
    targetRouteId: 'system_ai_usage',
    href: '/hospital/system/ai-usage',
  },
  {
    key: 'page_system_privacy',
    kind: 'page',
    label: '数据与隐私',
    sectionId: 'system',
    targetRouteId: 'system_privacy',
    href: '/hospital/system/privacy',
  },
  {
    key: 'page_system_audit',
    kind: 'page',
    label: '审计与安全',
    sectionId: 'system',
    targetRouteId: 'system_audit',
    href: '/hospital/system/audit',
  },
] as const satisfies readonly InstitutionCapabilityDefinitionShapeV1[]);

export type InstitutionCapabilityDefinitionV1 =
  (typeof INSTITUTION_CAPABILITY_REGISTRY_V1)[number];

export type InstitutionCapabilityKeyV1 = InstitutionCapabilityDefinitionV1['key'];

export const INSTITUTION_DIAGNOSTIC_TARGET_CAPABILITY_KEYS_V1 = Object.freeze([
  'page_system_overview',
  'page_system_channels',
  'page_system_data',
  'page_system_ai_usage',
  'page_system_privacy',
  'page_system_audit',
] as const satisfies readonly InstitutionCapabilityKeyV1[]);

export type InstitutionDiagnosticTargetCapabilityKeyV1 =
  (typeof INSTITUTION_DIAGNOSTIC_TARGET_CAPABILITY_KEYS_V1)[number];

/** Scalar vocabulary guard only; not a registry-definition or authorization validator. */
export function isInstitutionCapabilityKindV1(
  value: unknown,
): value is InstitutionCapabilityKindV1 {
  return INSTITUTION_CAPABILITY_KINDS_V1.some((candidate) => candidate === value);
}

/** Scalar vocabulary guard only; not a capability status parser or release decision. */
export function isInstitutionCapabilityKeyV1(
  value: unknown,
): value is InstitutionCapabilityKeyV1 {
  return INSTITUTION_CAPABILITY_REGISTRY_V1.some((definition) => definition.key === value);
}

/**
 * Scalar allowlist guard only; it never accepts or resolves an arbitrary URL and does not prove
 * that the diagnostic page is visible or reachable for the current AccessContext.
 */
export function isInstitutionDiagnosticTargetCapabilityKeyV1(
  value: unknown,
): value is InstitutionDiagnosticTargetCapabilityKeyV1 {
  return INSTITUTION_DIAGNOSTIC_TARGET_CAPABILITY_KEYS_V1.some(
    (candidate) => candidate === value,
  );
}
