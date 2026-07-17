import type { InstitutionNavigationSectionIdV1 } from './institution-navigation';

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

type InstitutionRouteKindV1 = 'index' | 'object';

type InstitutionCanonicalRouteDefinitionV1 = Readonly<{
  id: string;
  sectionId: InstitutionNavigationSectionIdV1;
  pathnamePattern: string;
  routeKind: InstitutionRouteKindV1;
  parameterNames: readonly string[];
}>;

export const INSTITUTION_CANONICAL_ROUTES_V1 = freezeContractValueV1([
  {
    id: 'workbench',
    sectionId: 'workbench',
    pathnamePattern: '/hospital',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'customer_list',
    sectionId: 'customers',
    pathnamePattern: '/hospital/customers',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'customer_treatments',
    sectionId: 'customers',
    pathnamePattern: '/hospital/customers/treatments',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'customer_treatment_detail',
    sectionId: 'customers',
    pathnamePattern: '/hospital/customers/treatments/:summaryId',
    routeKind: 'object',
    parameterNames: ['summaryId'],
  },
  {
    id: 'customer_detail',
    sectionId: 'customers',
    pathnamePattern: '/hospital/customers/:customerId',
    routeKind: 'object',
    parameterNames: ['customerId'],
  },
  {
    id: 'conversation_queue',
    sectionId: 'conversations',
    pathnamePattern: '/hospital/conversations',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'conversation_automations',
    sectionId: 'conversations',
    pathnamePattern: '/hospital/conversations/automations',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'conversation_automation_detail',
    sectionId: 'conversations',
    pathnamePattern: '/hospital/conversations/automations/:journeyId',
    routeKind: 'object',
    parameterNames: ['journeyId'],
  },
  {
    id: 'conversation_detail',
    sectionId: 'conversations',
    pathnamePattern: '/hospital/conversations/:conversationId',
    routeKind: 'object',
    parameterNames: ['conversationId'],
  },
  {
    id: 'care_today_queue',
    sectionId: 'care',
    pathnamePattern: '/hospital/care',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'care_appointments',
    sectionId: 'care',
    pathnamePattern: '/hospital/care/appointments',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'care_appointment_detail',
    sectionId: 'care',
    pathnamePattern: '/hospital/care/appointments/:appointmentId',
    routeKind: 'object',
    parameterNames: ['appointmentId'],
  },
  {
    id: 'care_followups',
    sectionId: 'care',
    pathnamePattern: '/hospital/care/followups',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'care_followup_detail',
    sectionId: 'care',
    pathnamePattern: '/hospital/care/followups/:taskId',
    routeKind: 'object',
    parameterNames: ['taskId'],
  },
  {
    id: 'care_paths',
    sectionId: 'care',
    pathnamePattern: '/hospital/care/paths',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'care_path_detail',
    sectionId: 'care',
    pathnamePattern: '/hospital/care/paths/:enrollmentId',
    routeKind: 'object',
    parameterNames: ['enrollmentId'],
  },
  {
    id: 'knowledge_library',
    sectionId: 'knowledge',
    pathnamePattern: '/hospital/knowledge',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'knowledge_search',
    sectionId: 'knowledge',
    pathnamePattern: '/hospital/knowledge/search',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'knowledge_qa',
    sectionId: 'knowledge',
    pathnamePattern: '/hospital/knowledge/qa',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'knowledge_qa_audit_detail',
    sectionId: 'knowledge',
    pathnamePattern: '/hospital/knowledge/qa/audits/:auditId',
    routeKind: 'object',
    parameterNames: ['auditId'],
  },
  {
    id: 'knowledge_jobs',
    sectionId: 'knowledge',
    pathnamePattern: '/hospital/knowledge/jobs',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'knowledge_item_detail',
    sectionId: 'knowledge',
    pathnamePattern: '/hospital/knowledge/items/:knowledgeId',
    routeKind: 'object',
    parameterNames: ['knowledgeId'],
  },
  {
    id: 'analytics_overview',
    sectionId: 'analytics',
    pathnamePattern: '/hospital/analytics',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'analytics_consumption',
    sectionId: 'analytics',
    pathnamePattern: '/hospital/analytics/consumption',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'analytics_consumption_detail',
    sectionId: 'analytics',
    pathnamePattern: '/hospital/analytics/consumption/:recordId',
    routeKind: 'object',
    parameterNames: ['recordId'],
  },
  {
    id: 'analytics_projects',
    sectionId: 'analytics',
    pathnamePattern: '/hospital/analytics/projects',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'analytics_project_detail',
    sectionId: 'analytics',
    pathnamePattern: '/hospital/analytics/projects/:projectId',
    routeKind: 'object',
    parameterNames: ['projectId'],
  },
  {
    id: 'analytics_opportunities',
    sectionId: 'analytics',
    pathnamePattern: '/hospital/analytics/opportunities',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'analytics_opportunity_detail',
    sectionId: 'analytics',
    pathnamePattern: '/hospital/analytics/opportunities/:customerId',
    routeKind: 'object',
    parameterNames: ['customerId'],
  },
  {
    id: 'analytics_reports',
    sectionId: 'analytics',
    pathnamePattern: '/hospital/analytics/reports',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'analytics_report_detail',
    sectionId: 'analytics',
    pathnamePattern: '/hospital/analytics/reports/:reportId',
    routeKind: 'object',
    parameterNames: ['reportId'],
  },
  {
    id: 'system_overview',
    sectionId: 'system',
    pathnamePattern: '/hospital/system',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'system_organization',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/organization',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'system_member_detail',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/organization/members/:memberId',
    routeKind: 'object',
    parameterNames: ['memberId'],
  },
  {
    id: 'system_channels',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/channels',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'system_channel_connection_detail',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/channels/connections/:connectionId',
    routeKind: 'object',
    parameterNames: ['connectionId'],
  },
  {
    id: 'system_channel_mappings',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/channels/mappings',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'system_channel_mapping_detail',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/channels/mappings/:mappingId',
    routeKind: 'object',
    parameterNames: ['mappingId'],
  },
  {
    id: 'system_data',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/data',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'system_data_source_detail',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/data/sources/:sourceId',
    routeKind: 'object',
    parameterNames: ['sourceId'],
  },
  {
    id: 'system_data_import_detail',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/data/imports/:batchId',
    routeKind: 'object',
    parameterNames: ['batchId'],
  },
  {
    id: 'system_ai_usage',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/ai-usage',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'system_ai_usage_service_detail',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/ai-usage/services/:serviceKey',
    routeKind: 'object',
    parameterNames: ['serviceKey'],
  },
  {
    id: 'system_privacy',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/privacy',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'system_audit',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/audit',
    routeKind: 'index',
    parameterNames: [],
  },
  {
    id: 'system_audit_detail',
    sectionId: 'system',
    pathnamePattern: '/hospital/system/audit/:eventId',
    routeKind: 'object',
    parameterNames: ['eventId'],
  },
] as const satisfies readonly InstitutionCanonicalRouteDefinitionV1[]);

export type InstitutionCanonicalRouteIdV1 =
  (typeof INSTITUTION_CANONICAL_ROUTES_V1)[number]['id'];

export type InstitutionCanonicalRouteV1 =
  (typeof INSTITUTION_CANONICAL_ROUTES_V1)[number];

export const INSTITUTION_STATIC_ROUTE_PRECEDENCE_V1 = freezeContractValueV1([
  {
    staticRouteId: 'customer_treatments',
    dynamicRouteId: 'customer_detail',
  },
  {
    staticRouteId: 'conversation_automations',
    dynamicRouteId: 'conversation_detail',
  },
] as const satisfies readonly Readonly<{
  staticRouteId: InstitutionCanonicalRouteIdV1;
  dynamicRouteId: InstitutionCanonicalRouteIdV1;
}>[]);

export const INSTITUTION_EXPLICITLY_UNSUPPORTED_PATHNAMES_V1 = freezeContractValueV1([
  '/hospital/dashboard',
] as const);
