import { and, asc, eq } from 'drizzle-orm';

import type {
  InstitutionAnalyticsOverviewSourceV1,
} from '@/modules/institution-analytics/ports/institution-analytics-overview-source';
import {
  INSTITUTION_ANALYTICS_OVERVIEW_SOURCE_LIMIT_WITH_SENTINEL_V1,
} from '@/modules/institution-analytics/ports/institution-analytics-overview-source';
import type { TenantDatabase } from '@/server/db/client';
import { analyticsConsumptionFacts } from '@/server/db/schema';

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;

function isExactScope(input: unknown): input is Readonly<{
  tenantId: string;
  institutionId: string;
}> {
  if (
    input === null
    || typeof input !== 'object'
    || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype
  ) return false;

  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (
    Reflect.ownKeys(descriptors).length !== 2
    || !Object.hasOwn(descriptors, 'tenantId')
    || !Object.hasOwn(descriptors, 'institutionId')
  ) return false;

  const tenantId = Reflect.get(input, 'tenantId');
  const institutionId = Reflect.get(input, 'institutionId');
  return (
    typeof tenantId === 'string'
    && typeof institutionId === 'string'
    && idPattern.test(tenantId)
    && idPattern.test(institutionId)
  );
}

export function createInstitutionAnalyticsOverviewRepository(
  database: TenantDatabase,
): InstitutionAnalyticsOverviewSourceV1 {
  return Object.freeze({
    async listFacts(input) {
      if (!isExactScope(input)) {
        throw new Error('invalid_institution_analytics_overview_scope');
      }

      const rows = await database
        .select({
          tenantId: analyticsConsumptionFacts.tenantId,
          institutionId: analyticsConsumptionFacts.institutionId,
          sourceId: analyticsConsumptionFacts.sourceId,
          batchOrConnectionRef: analyticsConsumptionFacts.batchOrConnectionRef,
          sourceRecordRef: analyticsConsumptionFacts.sourceRecordRef,
          eventFamily: analyticsConsumptionFacts.eventFamily,
          sourceRevision: analyticsConsumptionFacts.sourceRevision,
          supersedesSourceRevision: analyticsConsumptionFacts.supersedesSourceRevision,
          eventType: analyticsConsumptionFacts.eventType,
          eventAt: analyticsConsumptionFacts.eventAt,
          receivedAt: analyticsConsumptionFacts.receivedAt,
          amountMinor: analyticsConsumptionFacts.amountMinor,
          currency: analyticsConsumptionFacts.currency,
          stableConsumptionRecordRef: analyticsConsumptionFacts.stableConsumptionRecordRef,
          customerAttributionStatus: analyticsConsumptionFacts.customerAttributionStatus,
          customerId: analyticsConsumptionFacts.customerId,
          customerCandidateReference: analyticsConsumptionFacts.customerCandidateReference,
          projectAttributionStatus: analyticsConsumptionFacts.projectAttributionStatus,
          hisDirectoryVersion: analyticsConsumptionFacts.hisDirectoryVersion,
          canonicalProjectId: analyticsConsumptionFacts.canonicalProjectId,
          projectCandidateReference: analyticsConsumptionFacts.projectCandidateReference,
          refundLinkStatus: analyticsConsumptionFacts.refundLinkStatus,
        })
        .from(analyticsConsumptionFacts)
        .where(
          and(
            eq(analyticsConsumptionFacts.tenantId, input.tenantId),
            eq(analyticsConsumptionFacts.institutionId, input.institutionId),
          ),
        )
        .orderBy(
          asc(analyticsConsumptionFacts.sourceId),
          asc(analyticsConsumptionFacts.sourceRecordRef),
          asc(analyticsConsumptionFacts.eventFamily),
          asc(analyticsConsumptionFacts.sourceRevision),
          asc(analyticsConsumptionFacts.eventType),
          asc(analyticsConsumptionFacts.recordedAt),
        )
        .limit(INSTITUTION_ANALYTICS_OVERVIEW_SOURCE_LIMIT_WITH_SENTINEL_V1);

      return Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    },
  });
}
