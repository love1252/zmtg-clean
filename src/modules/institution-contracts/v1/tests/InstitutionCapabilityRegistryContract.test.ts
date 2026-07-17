import { describe, expect, it } from 'vitest';

import {
  INSTITUTION_CAPABILITY_KINDS_V1,
  INSTITUTION_CAPABILITY_REGISTRY_V1,
  INSTITUTION_DIAGNOSTIC_TARGET_CAPABILITY_KEYS_V1,
  isInstitutionCapabilityKeyV1,
  isInstitutionCapabilityKindV1,
  isInstitutionDiagnosticTargetCapabilityKeyV1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import { INSTITUTION_NAVIGATION_SECTIONS_V1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { INSTITUTION_CANONICAL_ROUTES_V1 } from '@/modules/institution-contracts/v1/institution-routes';

describe('InstitutionCapabilityRegistryContractV1', () => {
  it('freezes the exact grouped public display order', () => {
    expect(INSTITUTION_CAPABILITY_REGISTRY_V1.map((definition) => definition.key)).toEqual([
      'section_workbench',
      'page_workbench',
      'section_customers',
      'page_customer_list',
      'action_customer_create',
      'page_customer_treatments',
      'section_conversations',
      'page_conversation_queue',
      'page_conversation_automations',
      'section_care',
      'page_care_today_queue',
      'page_care_appointments',
      'action_care_appointment_create',
      'page_care_followups',
      'action_care_followup_create',
      'page_care_paths',
      'section_knowledge',
      'page_knowledge_library',
      'page_knowledge_search',
      'page_knowledge_qa',
      'page_knowledge_jobs',
      'section_analytics',
      'page_analytics_overview',
      'page_analytics_consumption',
      'page_analytics_projects',
      'page_analytics_opportunities',
      'page_analytics_reports',
      'section_system',
      'page_system_overview',
      'page_system_organization',
      'page_system_channels',
      'page_system_channel_mappings',
      'page_system_data',
      'page_system_ai_usage',
      'page_system_privacy',
      'page_system_audit',
    ]);

    expect(Object.isFrozen(INSTITUTION_CAPABILITY_REGISTRY_V1)).toBe(true);
    expect(Object.isFrozen(INSTITUTION_CAPABILITY_KINDS_V1)).toBe(true);
    expect(Object.isFrozen(INSTITUTION_DIAGNOSTIC_TARGET_CAPABILITY_KEYS_V1)).toBe(true);

    for (const definition of INSTITUTION_CAPABILITY_REGISTRY_V1) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.keys(definition).sort()).toEqual(
        ['key', 'kind', 'label', 'sectionId', 'targetRouteId', 'href'].sort(),
      );
      expect([...definition.label].length).toBeGreaterThan(0);
      expect([...definition.label].length).toBeLessThanOrEqual(40);
    }
  });

  it('contains the exact unique section, page, and action key sets', () => {
    const sectionDefinitions = INSTITUTION_CAPABILITY_REGISTRY_V1.filter(
      (definition) => definition.kind === 'section',
    );
    const pageDefinitions = INSTITUTION_CAPABILITY_REGISTRY_V1.filter(
      (definition) => definition.kind === 'page',
    );
    const actionDefinitions = INSTITUTION_CAPABILITY_REGISTRY_V1.filter(
      (definition) => definition.kind === 'action',
    );

    expect(sectionDefinitions.map((definition) => definition.key)).toEqual(
      INSTITUTION_NAVIGATION_SECTIONS_V1.map((section) => `section_${section.id}`),
    );
    expect(pageDefinitions.map((definition) => definition.key)).toEqual(
      INSTITUTION_CANONICAL_ROUTES_V1.filter((route) => route.routeKind === 'index').map(
        (route) => `page_${route.id}`,
      ),
    );
    expect(actionDefinitions.map((definition) => definition.key)).toEqual([
      'action_customer_create',
      'action_care_appointment_create',
      'action_care_followup_create',
    ]);

    const keys = INSTITUTION_CAPABILITY_REGISTRY_V1.map((definition) => definition.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('covers every and only canonical index page while excluding object routes', () => {
    const pageDefinitions = INSTITUTION_CAPABILITY_REGISTRY_V1.filter(
      (definition) => definition.kind === 'page',
    );
    const indexRoutes = INSTITUTION_CANONICAL_ROUTES_V1.filter(
      (route) => route.routeKind === 'index',
    );
    const objectRoutes = INSTITUTION_CANONICAL_ROUTES_V1.filter(
      (route) => route.routeKind === 'object',
    );
    const registeredTargetRouteIds = new Set<string>(
      INSTITUTION_CAPABILITY_REGISTRY_V1.map((definition) => definition.targetRouteId),
    );

    expect(pageDefinitions).toHaveLength(indexRoutes.length);

    for (const route of indexRoutes) {
      expect(pageDefinitions).toContainEqual(
        expect.objectContaining({
          key: `page_${route.id}`,
          kind: 'page',
          sectionId: route.sectionId,
          targetRouteId: route.id,
          href: route.pathnamePattern,
        }),
      );
    }

    for (const route of objectRoutes) {
      expect(pageDefinitions.some((definition) => definition.key === `page_${route.id}`)).toBe(
        false,
      );
      expect(registeredTargetRouteIds.has(route.id)).toBe(false);
    }
  });

  it('binds section targets and the three controlled-create actions to fixed canonical URLs', () => {
    for (const section of INSTITUTION_NAVIGATION_SECTIONS_V1) {
      const sectionDefinition = INSTITUTION_CAPABILITY_REGISTRY_V1.find(
        (definition) => definition.key === `section_${section.id}`,
      );
      const targetRoute = INSTITUTION_CANONICAL_ROUTES_V1.find(
        (route) => route.id === sectionDefinition?.targetRouteId,
      );

      expect(sectionDefinition).toEqual(
        expect.objectContaining({
          kind: 'section',
          sectionId: section.id,
          href: section.rootPath,
        }),
      );
      expect(targetRoute).toEqual(
        expect.objectContaining({
          sectionId: section.id,
          pathnamePattern: section.rootPath,
          routeKind: 'index',
        }),
      );
    }

    expect(
      INSTITUTION_CAPABILITY_REGISTRY_V1.filter(
        (definition) => definition.kind === 'action',
      ).map(({ key, targetRouteId, href }) => ({ key, targetRouteId, href })),
    ).toEqual([
      {
        key: 'action_customer_create',
        targetRouteId: 'customer_list',
        href: '/hospital/customers?create=1',
      },
      {
        key: 'action_care_appointment_create',
        targetRouteId: 'care_appointments',
        href: '/hospital/care/appointments?create=1',
      },
      {
        key: 'action_care_followup_create',
        targetRouteId: 'care_followups',
        href: '/hospital/care/followups?create=1',
      },
    ]);
  });

  it('allows only the six registered management diagnostic page targets', () => {
    expect(INSTITUTION_DIAGNOSTIC_TARGET_CAPABILITY_KEYS_V1).toEqual([
      'page_system_overview',
      'page_system_channels',
      'page_system_data',
      'page_system_ai_usage',
      'page_system_privacy',
      'page_system_audit',
    ]);

    for (const key of INSTITUTION_DIAGNOSTIC_TARGET_CAPABILITY_KEYS_V1) {
      const definition = INSTITUTION_CAPABILITY_REGISTRY_V1.find(
        (candidate) => candidate.key === key,
      );

      expect(definition).toEqual(
        expect.objectContaining({ kind: 'page', sectionId: 'system' }),
      );
      expect(isInstitutionDiagnosticTargetCapabilityKeyV1(key)).toBe(true);
    }

    expect(isInstitutionDiagnosticTargetCapabilityKeyV1('page_system_organization')).toBe(false);
    expect(isInstitutionDiagnosticTargetCapabilityKeyV1('page_system_channel_mappings')).toBe(
      false,
    );
    expect(isInstitutionDiagnosticTargetCapabilityKeyV1('/hospital/system')).toBe(false);
  });

  it('keeps all guards shallow and rejects unknown or structured values', () => {
    expect(INSTITUTION_CAPABILITY_KINDS_V1).toEqual(['section', 'page', 'action']);

    for (const kind of INSTITUTION_CAPABILITY_KINDS_V1) {
      expect(isInstitutionCapabilityKindV1(kind)).toBe(true);
    }

    for (const definition of INSTITUTION_CAPABILITY_REGISTRY_V1) {
      expect(isInstitutionCapabilityKeyV1(definition.key)).toBe(true);
    }

    expect(isInstitutionCapabilityKindV1('object')).toBe(false);
    expect(isInstitutionCapabilityKindV1({ kind: 'page' })).toBe(false);
    expect(isInstitutionCapabilityKeyV1('page_customer_detail')).toBe(false);
    expect(isInstitutionCapabilityKeyV1('unknown')).toBe(false);
    expect(isInstitutionCapabilityKeyV1({ key: 'page_workbench' })).toBe(false);
    expect(isInstitutionDiagnosticTargetCapabilityKeyV1(null)).toBe(false);
  });
});
