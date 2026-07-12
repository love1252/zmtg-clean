import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';

import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import {
  isEligibleControlledReachOutMockDelivery,
  readWeComControlledReachOutMetadata,
} from '@/modules/institution/domain/wecom-controlled-reachout';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import type {
  WeComRealSendProofControl,
  WeComRealSendProofOperation,
  WeComRealSendProductionAttestation,
  WeComRealSendReadySource,
} from '@/modules/institution/domain/wecom-real-send-proof';
import type { TenantDatabase } from '@/server/db/client';
import {
  auditEvents,
  customerChannelContactConsents,
  customerChannelFrequencyStates,
  followUpMessageDrafts,
  institutionChannelDryRunSnapshots,
  weComCustomerMappingStates,
  weComRealSendProductionAttestations,
  weComRealSendProofControls,
  weComRealSendProofOperations,
} from '@/server/db/schema';

function mapOperation(row: typeof weComRealSendProofOperations.$inferSelect): WeComRealSendProofOperation {
  return {
    ...row,
    sessionProvenance: row.sessionProvenance,
    confirmationIssuedAt: row.confirmationIssuedAt.toISOString(),
    confirmationExpiresAt: row.confirmationExpiresAt.toISOString(),
    confirmationConsumedAt: row.confirmationConsumedAt?.toISOString() ?? null,
    requestedAt: row.requestedAt.toISOString(),
    attemptedAt: row.attemptedAt?.toISOString() ?? null,
    terminalAt: row.terminalAt?.toISOString() ?? null,
    attemptCount: row.attemptCount as 0 | 1,
  };
}

function mapControl(row: typeof weComRealSendProofControls.$inferSelect): WeComRealSendProofControl {
  return {
    ...row,
    effectiveAt: row.effectiveAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

function mapAttestation(
  row: typeof weComRealSendProductionAttestations.$inferSelect,
): WeComRealSendProductionAttestation {
  return {
    ...row,
    attestedAt: row.attestedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

function mapAuditEventToInsert(event: TenantAuditEvent): typeof auditEvents.$inferInsert {
  return {
    eventId: event.eventId,
    actorId: event.actorId,
    actorRole: event.actorRole,
    tenantId: event.tenantId,
    scope: event.scope,
    resource: event.resource,
    resourceId: event.resourceId ?? null,
    action: event.action,
    result: event.result,
    reason: event.reason,
    occurredAt: new Date(event.occurredAt),
    source: event.source,
  };
}

function createTransactionRepository(database: TenantDatabase) {
  return {
    async loadReadySource(input: {
      tenantId: string;
      institutionId: string;
      draftId: string;
    }): Promise<WeComRealSendReadySource | null> {
      const [initialDraft] = await database
        .select()
        .from(followUpMessageDrafts)
        .where(and(
          eq(followUpMessageDrafts.tenantId, input.tenantId),
          eq(followUpMessageDrafts.institutionId, input.institutionId),
          eq(followUpMessageDrafts.id, input.draftId),
        ));
      if (!initialDraft || initialDraft.status !== 'approved') return null;
      const initialReadyMetadata = readWeComControlledReachOutMetadata(initialDraft.metadataJson);
      if (!initialReadyMetadata) return null;

      const [mapping] = await database
        .select()
        .from(weComCustomerMappingStates)
        .where(and(
          eq(weComCustomerMappingStates.tenantId, input.tenantId),
          eq(weComCustomerMappingStates.institutionId, input.institutionId),
          eq(weComCustomerMappingStates.proofContactId, initialReadyMetadata.proofContactId),
        ))
        .for('update');
      const [consent] = await database
        .select()
        .from(customerChannelContactConsents)
        .where(and(
          eq(customerChannelContactConsents.tenantId, input.tenantId),
          eq(customerChannelContactConsents.institutionId, input.institutionId),
          eq(customerChannelContactConsents.customerId, initialDraft.customerId),
          eq(customerChannelContactConsents.channelType, 'wechat_work'),
        ))
        .for('update');
      const [frequency] = await database
        .select()
        .from(customerChannelFrequencyStates)
        .where(and(
          eq(customerChannelFrequencyStates.tenantId, input.tenantId),
          eq(customerChannelFrequencyStates.institutionId, input.institutionId),
          eq(customerChannelFrequencyStates.customerId, initialDraft.customerId),
          eq(customerChannelFrequencyStates.channelType, 'wechat_work'),
        ))
        .for('update');
      const [snapshot] = await database
        .select()
        .from(institutionChannelDryRunSnapshots)
        .where(and(
          eq(institutionChannelDryRunSnapshots.tenantId, input.tenantId),
          eq(institutionChannelDryRunSnapshots.institutionId, input.institutionId),
          eq(institutionChannelDryRunSnapshots.channelType, 'wechat_work'),
        ))
        .for('update');
      if (!mapping || !consent || !frequency || !snapshot) return null;

      const [draft] = await database
        .select()
        .from(followUpMessageDrafts)
        .where(and(
          eq(followUpMessageDrafts.tenantId, input.tenantId),
          eq(followUpMessageDrafts.institutionId, input.institutionId),
          eq(followUpMessageDrafts.id, input.draftId),
        ))
        .for('update');
      if (
        !draft ||
        draft.status !== 'approved' ||
        draft.customerId !== initialDraft.customerId
      ) return null;
      const readyMetadata = readWeComControlledReachOutMetadata(draft.metadataJson);
      if (
        !readyMetadata ||
        readyMetadata.controlledReachOutId !== initialReadyMetadata.controlledReachOutId ||
        readyMetadata.proofContactId !== initialReadyMetadata.proofContactId
      ) return null;

      const deliveries = await createTenantBusinessRepository(database).listMessageDeliveriesForDraft({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        draftId: input.draftId,
      });
      if (deliveries.length !== 1) return null;
      const [delivery] = deliveries;
      if (
        !delivery ||
        delivery.tenantId !== input.tenantId ||
        delivery.institutionId !== input.institutionId ||
        delivery.customerId !== draft.customerId ||
        delivery.followUpTaskId !== draft.followUpTaskId ||
        delivery.messageDraftId !== draft.id ||
        delivery.id !== `msg-delivery:${draft.id}`.slice(0, 96) ||
        !isEligibleControlledReachOutMockDelivery(delivery)
      ) return null;

      const snapshotReady =
        snapshot.configStatus === 'dry_run_ready' &&
        snapshot.officialRoute === 'official_wecom_self_built' &&
        snapshot.preflightStatus === 'mock_ready' &&
        snapshot.proofEligibleMock === true &&
        snapshot.allowRealSend === false &&
        snapshot.externalChannelEnabled === false &&
        snapshot.realSendAllowed === false &&
        snapshot.dryRunOnly === true;

      return {
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        customerId: draft.customerId,
        draftId: draft.id,
        deliveryId: delivery.id,
        approvedContent: draft.editedContent ?? draft.draftContent,
        deliveryContentSnapshot: delivery.contentSnapshot,
        operationRef: frequency.lastPreparedRef ?? '',
        readyNoSendMetadata: readyMetadata,
        mapping: {
          id: mapping.id,
          version: mapping.updatedAt.toISOString(),
          status: mapping.status,
          customerId: mapping.customerId,
        },
        consent: {
          id: consent.id,
          version: consent.version,
          status: consent.status,
          customerId: consent.customerId,
        },
        frequency: {
          id: frequency.id,
          version: frequency.version,
          customerId: frequency.customerId,
          lastPreparedRef: frequency.lastPreparedRef,
          preparedCount: frequency.preparedCount,
          completedCount: frequency.completedCount,
        },
        dryRunSnapshot: {
          id: snapshot.id,
          version: snapshot.version,
          status: snapshotReady ? 'dry_run_ready' : 'blocked',
        },
        recipientBinding: {
          mappingId: mapping.id,
          mappingVersion: mapping.updatedAt.toISOString(),
          proofContactRef: mapping.proofContactId,
          proofEmployeeRef: mapping.proofEmployeeId,
        },
      };
    },

    async listControls(input: {
      tenantId: string;
      institutionId: string;
      customerId: string;
      operatorId: string;
      role: NonNullable<WeComRealSendProofControl['role']>;
    }) {
      const rows = await database
        .select()
        .from(weComRealSendProofControls)
        .where(or(
          eq(weComRealSendProofControls.scopeKind, 'global'),
          and(eq(weComRealSendProofControls.scopeKind, 'tenant'), eq(weComRealSendProofControls.tenantId, input.tenantId)),
          and(eq(weComRealSendProofControls.scopeKind, 'institution'), eq(weComRealSendProofControls.tenantId, input.tenantId), eq(weComRealSendProofControls.institutionId, input.institutionId)),
          and(eq(weComRealSendProofControls.scopeKind, 'channel'), eq(weComRealSendProofControls.channelType, 'wechat_work')),
          and(eq(weComRealSendProofControls.scopeKind, 'customer'), eq(weComRealSendProofControls.tenantId, input.tenantId), eq(weComRealSendProofControls.institutionId, input.institutionId), eq(weComRealSendProofControls.customerId, input.customerId)),
          and(eq(weComRealSendProofControls.scopeKind, 'operator_role'), eq(weComRealSendProofControls.tenantId, input.tenantId), eq(weComRealSendProofControls.institutionId, input.institutionId), eq(weComRealSendProofControls.operatorId, input.operatorId), eq(weComRealSendProofControls.role, input.role)),
        ))
        .for('update');
      return rows.map(mapControl);
    },

    async findProductionAttestation(input: {
      environmentRef: string;
      databaseIdentityRef: string;
      migrationTarget: string;
    }) {
      const [row] = await database
        .select()
        .from(weComRealSendProductionAttestations)
        .where(and(
          eq(weComRealSendProductionAttestations.environmentRef, input.environmentRef),
          eq(weComRealSendProductionAttestations.databaseIdentityRef, input.databaseIdentityRef),
          eq(weComRealSendProductionAttestations.migrationTarget, input.migrationTarget),
        ))
        .orderBy(desc(weComRealSendProductionAttestations.attestedAt))
        .limit(1)
        .for('update');
      return row ? mapAttestation(row) : null;
    },

    async findOperationBySource(input: {
      tenantId: string;
      institutionId: string;
      draftId: string;
      sourceReadyNoSendRef: string;
    }) {
      const [row] = await database
        .select()
        .from(weComRealSendProofOperations)
        .where(and(
          eq(weComRealSendProofOperations.tenantId, input.tenantId),
          eq(weComRealSendProofOperations.institutionId, input.institutionId),
          eq(weComRealSendProofOperations.draftId, input.draftId),
          eq(weComRealSendProofOperations.sourceReadyNoSendRef, input.sourceReadyNoSendRef),
        ));
      return row ? mapOperation(row) : null;
    },

    async findOperationByRef(input: {
      tenantId: string;
      institutionId: string;
      operationRef: string;
    }) {
      const [row] = await database
        .select()
        .from(weComRealSendProofOperations)
        .where(and(
          eq(weComRealSendProofOperations.tenantId, input.tenantId),
          eq(weComRealSendProofOperations.institutionId, input.institutionId),
          eq(weComRealSendProofOperations.operationRef, input.operationRef),
        ));
      return row ? mapOperation(row) : null;
    },

    async createOperation(input: typeof weComRealSendProofOperations.$inferInsert) {
      const [row] = await database
        .insert(weComRealSendProofOperations)
        .values(input)
        .onConflictDoNothing()
        .returning();
      return row ? mapOperation(row) : null;
    },

    async consumeConfirmation(input: {
      operationRef: string;
      tenantId: string;
      institutionId: string;
      tokenDigest: string;
      operatorId: string;
      now: Date;
    }) {
      const [row] = await database
        .update(weComRealSendProofOperations)
        .set({
          confirmationConsumedAt: input.now,
          attemptedAt: input.now,
          attemptCount: 1,
          status: 'attempted',
          version: sql`${weComRealSendProofOperations.version} + 1`,
          updatedAt: input.now,
        })
        .where(and(
          eq(weComRealSendProofOperations.operationRef, input.operationRef),
          eq(weComRealSendProofOperations.tenantId, input.tenantId),
          eq(weComRealSendProofOperations.institutionId, input.institutionId),
          eq(weComRealSendProofOperations.confirmationTokenDigest, input.tokenDigest),
          eq(weComRealSendProofOperations.operatorId, input.operatorId),
          eq(weComRealSendProofOperations.status, 'requested'),
          isNull(weComRealSendProofOperations.confirmationConsumedAt),
          lt(weComRealSendProofOperations.confirmationIssuedAt, input.now),
          gt(weComRealSendProofOperations.confirmationExpiresAt, input.now),
        ))
        .returning();
      return row ? mapOperation(row) : null;
    },

    async abortOperation(input: {
      operationRef: string;
      tenantId: string;
      institutionId: string;
      operatorId: string;
      now: Date;
    }) {
      const [row] = await database
        .update(weComRealSendProofOperations)
        .set({
          status: 'aborted',
          terminalAt: input.now,
          version: sql`${weComRealSendProofOperations.version} + 1`,
          updatedAt: input.now,
        })
        .where(and(
          eq(weComRealSendProofOperations.operationRef, input.operationRef),
          eq(weComRealSendProofOperations.tenantId, input.tenantId),
          eq(weComRealSendProofOperations.institutionId, input.institutionId),
          eq(weComRealSendProofOperations.operatorId, input.operatorId),
          eq(weComRealSendProofOperations.status, 'requested'),
        ))
        .returning();
      return row ? mapOperation(row) : null;
    },

    async finalizeNonSuccess(input: {
      operationRef: string;
      tenantId: string;
      institutionId: string;
      operatorId: string;
      status: 'failed' | 'unknown_outcome';
      providerResultCategory: 'rejected' | 'transport_error' | 'timeout' | 'indeterminate';
      now: Date;
    }) {
      const categoryMatchesStatus = input.status === 'failed'
        ? input.providerResultCategory === 'rejected'
        : ['transport_error', 'timeout', 'indeterminate'].includes(input.providerResultCategory);
      if (!categoryMatchesStatus) return null;
      const [row] = await database
        .update(weComRealSendProofOperations)
        .set({
          status: input.status,
          providerResultCategory: input.providerResultCategory,
          terminalAt: input.now,
          version: sql`${weComRealSendProofOperations.version} + 1`,
          updatedAt: input.now,
        })
        .where(and(
          eq(weComRealSendProofOperations.operationRef, input.operationRef),
          eq(weComRealSendProofOperations.tenantId, input.tenantId),
          eq(weComRealSendProofOperations.institutionId, input.institutionId),
          eq(weComRealSendProofOperations.operatorId, input.operatorId),
          eq(weComRealSendProofOperations.status, 'attempted'),
        ))
        .returning();
      return row ? mapOperation(row) : null;
    },

    async lockOperation(input: {
      tenantId: string;
      institutionId: string;
      operationRef: string;
    }) {
      const [row] = await database
        .select()
        .from(weComRealSendProofOperations)
        .where(and(
          eq(weComRealSendProofOperations.tenantId, input.tenantId),
          eq(weComRealSendProofOperations.institutionId, input.institutionId),
          eq(weComRealSendProofOperations.operationRef, input.operationRef),
        ))
        .for('update');
      return row ? mapOperation(row) : null;
    },

    async recordCompletedFrequency(input: {
      operation: WeComRealSendProofOperation;
      now: Date;
    }) {
      if (
        input.operation.status !== 'attempted' ||
        input.operation.attemptCount !== 1 ||
        !input.operation.confirmationConsumedAt
      ) return null;
      const [frequency] = await database
        .select()
        .from(customerChannelFrequencyStates)
        .where(and(
          eq(customerChannelFrequencyStates.id, input.operation.frequencyStateId),
          eq(customerChannelFrequencyStates.tenantId, input.operation.tenantId),
          eq(customerChannelFrequencyStates.institutionId, input.operation.institutionId),
          eq(customerChannelFrequencyStates.customerId, input.operation.customerId),
          eq(customerChannelFrequencyStates.channelType, input.operation.channelType),
        ))
        .for('update');
      if (
        !frequency ||
        frequency.lastPreparedRef !== input.operation.operationRef ||
        frequency.completedCount >= frequency.maxCompletedCount ||
        frequency.completedCount >= frequency.preparedCount
      ) return null;

      const [updated] = await database
        .update(customerChannelFrequencyStates)
        .set({
          completedCount: frequency.completedCount + 1,
          lastCompletedRef: input.operation.operationRef,
          version: frequency.version + 1,
          updatedAt: input.now,
        })
        .where(and(
          eq(customerChannelFrequencyStates.id, frequency.id),
          eq(customerChannelFrequencyStates.tenantId, input.operation.tenantId),
          eq(customerChannelFrequencyStates.institutionId, input.operation.institutionId),
          eq(customerChannelFrequencyStates.customerId, input.operation.customerId),
          eq(customerChannelFrequencyStates.channelType, input.operation.channelType),
          eq(customerChannelFrequencyStates.lastPreparedRef, input.operation.operationRef),
          eq(customerChannelFrequencyStates.version, frequency.version),
        ))
        .returning();
      return updated ?? null;
    },

    async markSucceeded(input: {
      operationRef: string;
      tenantId: string;
      institutionId: string;
      operatorId: string;
      completedFrequencyRef: string;
      now: Date;
    }) {
      if (input.completedFrequencyRef !== input.operationRef) return null;
      const [row] = await database
        .update(weComRealSendProofOperations)
        .set({
          status: 'succeeded',
          providerResultCategory: 'accepted',
          completedFrequencyRef: input.completedFrequencyRef,
          terminalAt: input.now,
          version: sql`${weComRealSendProofOperations.version} + 1`,
          updatedAt: input.now,
        })
        .where(and(
          eq(weComRealSendProofOperations.operationRef, input.operationRef),
          eq(weComRealSendProofOperations.tenantId, input.tenantId),
          eq(weComRealSendProofOperations.institutionId, input.institutionId),
          eq(weComRealSendProofOperations.operatorId, input.operatorId),
          eq(weComRealSendProofOperations.status, 'attempted'),
        ))
        .returning();
      return row ? mapOperation(row) : null;
    },

    async recordAudit(event: TenantAuditEvent) {
      await database.insert(auditEvents).values(mapAuditEventToInsert(event));
    },
  };
}

export type WeComRealSendProofTransactionRepository = ReturnType<typeof createTransactionRepository>;

export type WeComRealSendProofRepository = {
  runInTransaction<T>(
    operation: (repository: WeComRealSendProofTransactionRepository) => Promise<T>,
  ): Promise<T>;
};

export function createWeComRealSendProofRepository(
  database: TenantDatabase,
): WeComRealSendProofRepository {
  return {
    async runInTransaction(operation) {
      return database.transaction((transactionDatabase) =>
        operation(createTransactionRepository(transactionDatabase as unknown as TenantDatabase)));
    },
  };
}
