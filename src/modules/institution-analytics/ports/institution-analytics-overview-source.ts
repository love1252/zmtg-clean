export const INSTITUTION_ANALYTICS_OVERVIEW_MAX_FACTS_V1 = 10_000;
export const INSTITUTION_ANALYTICS_OVERVIEW_SOURCE_LIMIT_WITH_SENTINEL_V1 = 10_001;

export type InstitutionAnalyticsOverviewSourceRowV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  sourceId: string;
  batchOrConnectionRef: string;
  sourceRecordRef: string;
  eventFamily: string;
  sourceRevision: string;
  supersedesSourceRevision: string | null;
  eventType: string;
  eventAt: Date;
  receivedAt: Date;
  amountMinor: number;
  currency: string;
  stableConsumptionRecordRef: string | null;
  customerAttributionStatus: string;
  customerId: string | null;
  customerCandidateReference: string | null;
  projectAttributionStatus: string;
  hisDirectoryVersion: string | null;
  canonicalProjectId: string | null;
  projectCandidateReference: string | null;
  refundLinkStatus: string;
}>;

export type InstitutionAnalyticsOverviewSourceV1 = Readonly<{
  listFacts(input: Readonly<{
    tenantId: string;
    institutionId: string;
  }>): Promise<readonly InstitutionAnalyticsOverviewSourceRowV1[]>;
}>;
