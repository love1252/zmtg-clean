import type { TenantDatabase } from '@/server/db/client';
import {
  analyticsConsumptionFacts,
  analyticsFormalIngestionBatches,
  analyticsFormalSources,
} from '@/server/db/schema';

export type ImportedAnalyticsConsumptionFactV1 = Readonly<{
  sourceRecordRef: string;
  eventType:
    | 'payment_succeeded' | 'payment_pending' | 'payment_failed' | 'payment_cancelled'
    | 'refund_confirmed' | 'refund_pending' | 'refund_failed' | 'refund_cancelled';
  eventAt: Date;
  receivedAt: Date;
  amountMinor: number;
  currency: string;
  stableConsumptionRecordRef: string | null;
  customerId: string;
  projectCandidateReference: string;
}>;

export function createAnalyticsConsumptionFactWriterV1(database: TenantDatabase) {
  return Object.freeze({
    async createImport(input: Readonly<{
      tenantId: string;
      institutionId: string;
      sourceId: string;
      sourceLabel: string;
      batchReference: string;
      provenanceDigest: string;
      actorId: string;
      receivedAt: Date;
      facts: readonly ImportedAnalyticsConsumptionFactV1[];
    }>): Promise<void> {
      if (input.facts.length === 0) return;
      await database.insert(analyticsFormalSources).values({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        id: input.sourceId,
        sourceLabel: input.sourceLabel,
        sourceKind: 'approved_import_manifest',
        provenanceReferenceDigest: input.provenanceDigest,
        approvedBy: input.actorId,
        approvedAt: input.receivedAt,
      });
      await database.insert(analyticsFormalIngestionBatches).values({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        sourceId: input.sourceId,
        batchOrConnectionRef: input.batchReference,
        provenanceReferenceDigest: input.provenanceDigest,
        receivedAt: input.receivedAt,
        approvedBy: input.actorId,
        approvedAt: input.receivedAt,
      });
      const factRows: Array<typeof analyticsConsumptionFacts.$inferInsert> = input.facts.map((fact) => ({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        sourceId: input.sourceId,
        batchOrConnectionRef: input.batchReference,
        sourceRecordRef: fact.sourceRecordRef,
        eventFamily: fact.eventType.startsWith('payment_') ? 'payment' as const : 'refund' as const,
        sourceRevision: '1',
        supersedesSourceRevision: null,
        eventType: fact.eventType,
        eventAt: fact.eventAt,
        receivedAt: fact.receivedAt,
        amountMinor: fact.amountMinor,
        currency: fact.currency,
        stableConsumptionRecordRef: fact.stableConsumptionRecordRef,
        customerAttributionStatus: 'matched' as const,
        customerId: fact.customerId,
        customerCandidateReference: null,
        projectAttributionStatus: 'pending_review' as const,
        hisDirectoryVersion: null,
        canonicalProjectId: null,
        projectCandidateReference: fact.projectCandidateReference,
        refundLinkStatus: fact.eventType.startsWith('payment_') ? 'not_applicable' as const : 'orphan_verified' as const,
        recordedBy: input.actorId,
      }));
      await database.insert(analyticsConsumptionFacts).values(factRows);
    },
  });
}
