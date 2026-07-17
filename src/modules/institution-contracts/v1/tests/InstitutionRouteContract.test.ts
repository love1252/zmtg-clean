import { describe, expect, it } from 'vitest';

import {
  INSTITUTION_CANONICAL_ROUTES_V1,
  INSTITUTION_EXPLICITLY_UNSUPPORTED_PATHNAMES_V1,
  INSTITUTION_STATIC_ROUTE_PRECEDENCE_V1,
} from '@/modules/institution-contracts/v1/institution-routes';
import { INSTITUTION_NAVIGATION_SECTIONS_V1 } from '@/modules/institution-contracts/v1/institution-navigation';

function extractParameterNames(pathnamePattern: string): string[] {
  return pathnamePattern
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1));
}

describe('InstitutionRouteContractV1', () => {
  it('contains every frozen canonical pathname pattern', () => {
    expect(Object.isFrozen(INSTITUTION_CANONICAL_ROUTES_V1)).toBe(true);

    expect(INSTITUTION_CANONICAL_ROUTES_V1.map((route) => route.pathnamePattern)).toEqual([
      '/hospital',
      '/hospital/customers',
      '/hospital/customers/treatments',
      '/hospital/customers/treatments/:summaryId',
      '/hospital/customers/:customerId',
      '/hospital/conversations',
      '/hospital/conversations/automations',
      '/hospital/conversations/automations/:journeyId',
      '/hospital/conversations/:conversationId',
      '/hospital/care',
      '/hospital/care/appointments',
      '/hospital/care/appointments/:appointmentId',
      '/hospital/care/followups',
      '/hospital/care/followups/:taskId',
      '/hospital/care/paths',
      '/hospital/care/paths/:enrollmentId',
      '/hospital/knowledge',
      '/hospital/knowledge/search',
      '/hospital/knowledge/qa',
      '/hospital/knowledge/qa/audits/:auditId',
      '/hospital/knowledge/jobs',
      '/hospital/knowledge/items/:knowledgeId',
      '/hospital/analytics',
      '/hospital/analytics/consumption',
      '/hospital/analytics/consumption/:recordId',
      '/hospital/analytics/projects',
      '/hospital/analytics/projects/:projectId',
      '/hospital/analytics/opportunities',
      '/hospital/analytics/opportunities/:customerId',
      '/hospital/analytics/reports',
      '/hospital/analytics/reports/:reportId',
      '/hospital/system',
      '/hospital/system/organization',
      '/hospital/system/organization/members/:memberId',
      '/hospital/system/channels',
      '/hospital/system/channels/connections/:connectionId',
      '/hospital/system/channels/mappings',
      '/hospital/system/channels/mappings/:mappingId',
      '/hospital/system/data',
      '/hospital/system/data/sources/:sourceId',
      '/hospital/system/data/imports/:batchId',
      '/hospital/system/ai-usage',
      '/hospital/system/ai-usage/services/:serviceKey',
      '/hospital/system/privacy',
      '/hospital/system/audit',
      '/hospital/system/audit/:eventId',
    ]);
  });

  it('keeps route identifiers and pathname patterns unique', () => {
    const routeIds = INSTITUTION_CANONICAL_ROUTES_V1.map((route) => route.id);
    const pathnamePatterns = INSTITUTION_CANONICAL_ROUTES_V1.map(
      (route) => route.pathnamePattern,
    );

    expect(new Set(routeIds).size).toBe(routeIds.length);
    expect(new Set(pathnamePatterns).size).toBe(pathnamePatterns.length);
  });

  it('binds every navigation root to one canonical page route', () => {
    for (const section of INSTITUTION_NAVIGATION_SECTIONS_V1) {
      expect(
        INSTITUTION_CANONICAL_ROUTES_V1.filter(
          (route) =>
            route.sectionId === section.id &&
            route.pathnamePattern === section.rootPath &&
            route.routeKind === 'index',
        ),
      ).toHaveLength(1);
    }
  });

  it('freezes dynamic parameter names without wildcard or catch-all routes', () => {
    for (const route of INSTITUTION_CANONICAL_ROUTES_V1) {
      expect(Object.isFrozen(route)).toBe(true);
      expect(Object.isFrozen(route.parameterNames)).toBe(true);
      expect(route.pathnamePattern.startsWith('/hospital')).toBe(true);
      expect(route.pathnamePattern).not.toContain('*');
      expect(route.parameterNames).toEqual(extractParameterNames(route.pathnamePattern));
    }
  });

  it('declares static route precedence for the two dynamic sibling collisions', () => {
    expect(Object.isFrozen(INSTITUTION_STATIC_ROUTE_PRECEDENCE_V1)).toBe(true);

    expect(INSTITUTION_STATIC_ROUTE_PRECEDENCE_V1).toEqual([
      {
        staticRouteId: 'customer_treatments',
        dynamicRouteId: 'customer_detail',
      },
      {
        staticRouteId: 'conversation_automations',
        dynamicRouteId: 'conversation_detail',
      },
    ]);

    for (const rule of INSTITUTION_STATIC_ROUTE_PRECEDENCE_V1) {
      expect(Object.isFrozen(rule)).toBe(true);

      const staticRoute = INSTITUTION_CANONICAL_ROUTES_V1.find(
        (route) => route.id === rule.staticRouteId,
      );
      const dynamicRoute = INSTITUTION_CANONICAL_ROUTES_V1.find(
        (route) => route.id === rule.dynamicRouteId,
      );

      expect(staticRoute).toBeDefined();
      expect(dynamicRoute).toBeDefined();
      expect(staticRoute?.parameterNames).toHaveLength(0);
      expect(dynamicRoute?.parameterNames).toHaveLength(1);
      expect(staticRoute?.sectionId).toBe(dynamicRoute?.sectionId);
      expect(INSTITUTION_CANONICAL_ROUTES_V1.indexOf(staticRoute!)).toBeLessThan(
        INSTITUTION_CANONICAL_ROUTES_V1.indexOf(dynamicRoute!),
      );
    }
  });

  it('keeps dashboard unsupported and excludes compatibility inputs from canonical routes', () => {
    expect(Object.isFrozen(INSTITUTION_EXPLICITLY_UNSUPPORTED_PATHNAMES_V1)).toBe(true);
    expect(INSTITUTION_EXPLICITLY_UNSUPPORTED_PATHNAMES_V1).toEqual(['/hospital/dashboard']);

    const canonicalPathnames = INSTITUTION_CANONICAL_ROUTES_V1.map(
      (route) => route.pathnamePattern,
    );

    expect(canonicalPathnames).not.toContain('/hospital/dashboard');
    expect(canonicalPathnames).not.toContain('/hospital/service');
    expect(canonicalPathnames).not.toContain('/hospital/opportunities');
    expect(
      canonicalPathnames.some((pathname) => pathname.startsWith('/hospital/system/wecom')),
    ).toBe(false);
    expect(canonicalPathnames.some((pathname) => pathname.startsWith('/hospital/system/his'))).toBe(
      false,
    );
  });
});
