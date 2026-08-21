import { createHash } from 'node:crypto';

import { and, asc, eq } from 'drizzle-orm';

import type { CustomerReferenceV1 } from '@/modules/institution-contracts/v1/customer';
import {
  conversationActionProjectionRoles,
  type ConversationActionProjectionCandidate,
  type ConversationActionProjectionRole,
} from '@/modules/institution-conversations/domain/conversation-action-projection';
import {
  conversationMessageSafeSummaryTexts,
  type ConversationMessage,
} from '@/modules/institution-conversations/domain/conversation-messages';
import {
  projectConversationRisk,
  type ConversationRiskEvent,
  type ConversationRiskProjection,
} from '@/modules/institution-conversations/domain/conversation-risks';
import { readScopedConversationCommandRecordV1 } from '@/modules/institution-conversations/server/conversation-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  conversationFormalSources,
  conversationMessages,
  conversationRisks,
  conversationSegments,
  conversations,
  customers,
} from '@/server/db/schema';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const MAX_RISK_ROWS = 4096;

type RiskRow = typeof conversationRisks.$inferSelect;

export type ConversationActionAssigneeResolverV1 = (
  input: Readonly<{
    tenantId: string;
    institutionId: string;
    userId: string;
    role: ConversationActionProjectionRole;
  }>,
) => Promise<
  | Readonly<{
      userId: string;
      displayName: string;
    }>
  | null
>;

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

function toRiskEvent(
  row: RiskRow,
  tenantId: string,
  institutionId: string,
): ConversationRiskEvent {
  const occurredAt = row.occurredAt.toISOString();

  if (row.eventKind === 'risk_unconfirmed') {
    return {
      kind: 'risk_unconfirmed',
      eventId: row.eventId,
      riskId: row.riskId,
      tenantId,
      institutionId,
      conversationId: row.conversationId,
      segmentId: row.segmentId,
      sourceMessageId: row.sourceMessageId,
      riskDomain: row.riskDomain,
      riskCode: row.riskCode,
      occurredAt,
    };
  }

  if (row.eventKind === 'risk_confirmed') {
    if (!row.actorId) {
      throw new Error('conversation_action_risk_confirmation_actor_missing');
    }

    return {
      kind: 'risk_confirmed',
      eventId: row.eventId,
      riskId: row.riskId,
      confirmedByActorId: row.actorId,
      occurredAt,
    };
  }

  if (!row.actorId) {
    throw new Error('conversation_action_risk_resolution_actor_missing');
  }

  const clinicalClosureReference =
    row.riskDomain === 'clinical'
      ? row.clinicalClosureReferenceId && row.clinicalClosureVerifiedAt
        ? {
            referenceId: row.clinicalClosureReferenceId,
            scope: {
              tenantId,
              institutionId,
            },
            verificationState: 'valid' as const,
            revocationState: 'not_revoked' as const,
            verifiedAt: row.clinicalClosureVerifiedAt.toISOString(),
          }
        : null
      : null;

  if (row.riskDomain === 'clinical' && clinicalClosureReference === null) {
    throw new Error('conversation_action_clinical_closure_missing');
  }

  if (
    row.riskDomain === 'non_clinical'
    && (
      row.clinicalClosureReferenceId !== null
      || row.clinicalClosureVerifiedAt !== null
    )
  ) {
    throw new Error('conversation_action_nonclinical_closure_invalid');
  }

  return {
    kind: 'risk_resolved',
    eventId: row.eventId,
    riskId: row.riskId,
    resolvedByActorId: row.actorId,
    occurredAt,
    clinicalClosureReference,
  };
}

function chooseRiskProjection(
  rows: readonly RiskRow[],
  tenantId: string,
  institutionId: string,
): ConversationRiskProjection {
  if (rows.length === 0) {
    return { state: 'none' };
  }

  const grouped = new Map<string, RiskRow[]>();

  for (const row of rows) {
    const group = grouped.get(row.riskId) ?? [];
    group.push(row);
    grouped.set(row.riskId, group);
  }

  const projections: ConversationRiskProjection[] = [];

  for (const group of grouped.values()) {
    const events = group.map((row) =>
      toRiskEvent(row, tenantId, institutionId),
    );
    const projected = projectConversationRisk(events);

    if (projected.kind !== 'projected') {
      throw new Error('conversation_action_risk_projection_invalid');
    }

    projections.push(projected.projection);
  }

  const active = projections
    .filter(
      (
        item,
      ): item is Exclude<
        ConversationRiskProjection,
        { state: 'none' }
      > => item.state !== 'none',
    )
    .sort(
      (left, right) =>
        right.detectedAt.localeCompare(left.detectedAt)
        || left.riskId.localeCompare(right.riskId),
    );

  const unresolved = active.find(
    (item) =>
      item.state === 'unconfirmed'
      || item.state === 'confirmed',
  );

  if (unresolved) {
    return unresolved;
  }

  return active.find((item) => item.state === 'resolved')
    ?? { state: 'none' };
}

function buildSourceVersion(input: Readonly<{
  conversationId: string;
  conversationRevision: number;
  segmentId: string;
  segmentRevision: number;
  assignmentRevision: number;
  messageId: string;
  riskRows: readonly RiskRow[];
}>): string {
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        conversationId: input.conversationId,
        conversationRevision: input.conversationRevision,
        segmentId: input.segmentId,
        segmentRevision: input.segmentRevision,
        assignmentRevision: input.assignmentRevision,
        messageId: input.messageId,
        risks: input.riskRows.map((row) => [
          row.eventId,
          row.riskId,
          row.eventKind,
          row.occurredAt.toISOString(),
        ]),
      }),
      'utf8',
    )
    .digest('hex');

  return `srcv_${digest.slice(0, 40)}`;
}

export function createConversationActionSourceRepositoryV1(
  database: TenantDatabase,
  dependencies: Readonly<{
    resolveAssignee: ConversationActionAssigneeResolverV1;
  }>,
) {
  return Object.freeze({
    async read(
      input: Readonly<{
        tenantId: string;
        institutionId: string;
        conversationId: string;
      }>,
    ): Promise<ConversationActionProjectionCandidate | null> {
      if (
        !isValidId(input.tenantId)
        || !isValidId(input.institutionId)
        || !isValidId(input.conversationId)
      ) {
        throw new Error('conversation_action_repository_invalid_query');
      }

      const rows = await database
        .select({
          tenantId: conversations.tenantId,
          institutionId: conversations.institutionId,
          conversationId: conversations.id,
          sourceId: conversations.sourceId,
          sourceKind: conversationFormalSources.sourceKind,
          channelType: conversationFormalSources.channelType,
          serviceProviderType: conversationFormalSources.serviceProviderType,
          connectionInstanceId: conversationFormalSources.connectionInstanceId,
          channelConversationRef: conversations.channelConversationRef,
          rootCustomerId: conversations.customerId,
          identityState: conversations.identityState,
          activeSegmentId: conversations.activeSegmentId,
          latestCustomerInboundMessageId:
            conversations.latestCustomerInboundMessageId,
          latestCustomerInboundAt: conversations.latestCustomerInboundAt,
          latestCustomerInboundRevision:
            conversations.latestCustomerInboundRevision,
          lastClosedSegmentId: conversations.lastClosedSegmentId,
          lastSegmentClosedAt: conversations.lastSegmentClosedAt,
          lastClosedSegmentInboundMessageId:
            conversations.lastClosedSegmentInboundMessageId,
          lastClosedSegmentInboundAt:
            conversations.lastClosedSegmentInboundAt,
          lastClosedSegmentInboundRevision:
            conversations.lastClosedSegmentInboundRevision,
          identityUpdatedAt: conversations.identityUpdatedAt,
          segmentUpdatedAt: conversations.segmentUpdatedAt,
          conversationRevision: conversations.revision,
          conversationCreatedAt: conversations.createdAt,
          conversationUpdatedAt: conversations.updatedAt,
          segmentId: conversationSegments.id,
          messageId: conversationMessages.id,
          messageDirection: conversationMessages.direction,
          messageSenderKind: conversationMessages.senderKind,
          messageOccurredAt: conversationMessages.occurredAt,
          messageReceivedAt: conversationMessages.receivedAt,
          messageAuthorizedContentReference:
            conversationMessages.authorizedContentReference,
          messageSafeSummaryCode: conversationMessages.safeSummaryCode,
          messageSourceMessageRef: conversationMessages.sourceMessageRef,
          messageIdempotencyKey: conversationMessages.idempotencyKey,
          customerId: customers.id,
          customerDisplayName: customers.displayName,
        })
        .from(conversations)
        .innerJoin(
          conversationFormalSources,
          and(
            eq(conversationFormalSources.tenantId, conversations.tenantId),
            eq(
              conversationFormalSources.institutionId,
              conversations.institutionId,
            ),
            eq(conversationFormalSources.id, conversations.sourceId),
          ),
        )
        .innerJoin(
          conversationSegments,
          and(
            eq(conversationSegments.tenantId, conversations.tenantId),
            eq(
              conversationSegments.institutionId,
              conversations.institutionId,
            ),
            eq(conversationSegments.conversationId, conversations.id),
            eq(conversationSegments.id, conversations.activeSegmentId),
          ),
        )
        .innerJoin(
          conversationMessages,
          and(
            eq(conversationMessages.tenantId, conversations.tenantId),
            eq(
              conversationMessages.institutionId,
              conversations.institutionId,
            ),
            eq(conversationMessages.conversationId, conversations.id),
            eq(
              conversationMessages.segmentId,
              conversationSegments.id,
            ),
            eq(
              conversationMessages.id,
              conversationSegments.lastCustomerMessageId,
            ),
          ),
        )
        .leftJoin(
          customers,
          and(
            eq(customers.tenantId, conversations.tenantId),
            eq(customers.institutionId, conversations.institutionId),
            eq(customers.id, conversations.customerId),
          ),
        )
        .where(
          and(
            eq(conversations.tenantId, input.tenantId),
            eq(conversations.institutionId, input.institutionId),
            eq(conversations.id, input.conversationId),
          ),
        )
        .limit(2);

      if (rows.length !== 1 || !rows[0]) {
        throw new Error('conversation_action_current_snapshot_unavailable');
      }

      const row = rows[0];

      if (
        row.tenantId !== input.tenantId
        || row.institutionId !== input.institutionId
        || row.conversationId !== input.conversationId
        || row.activeSegmentId === null
        || row.activeSegmentId !== row.segmentId
        || (
          row.sourceKind !== 'approved_channel_connection'
          && row.sourceKind !== 'approved_internal_operation'
        )
      ) {
        throw new Error('conversation_action_current_snapshot_mismatch');
      }

      const commandRecord = await readScopedConversationCommandRecordV1(
        database,
        input,
      );

      if (
        !commandRecord
        || !commandRecord.segment
        || commandRecord.tenantId !== input.tenantId
        || commandRecord.institutionId !== input.institutionId
        || commandRecord.conversationId !== input.conversationId
        || commandRecord.segment.value.segmentId !== row.segmentId
      ) {
        throw new Error('conversation_action_command_snapshot_unavailable');
      }

      const segment = commandRecord.segment.value;

      const riskRows = await database
        .select()
        .from(conversationRisks)
        .where(
          and(
            eq(conversationRisks.tenantId, input.tenantId),
            eq(conversationRisks.institutionId, input.institutionId),
            eq(conversationRisks.conversationId, input.conversationId),
            eq(conversationRisks.segmentId, segment.segmentId),
          ),
        )
        .orderBy(
          asc(conversationRisks.riskId),
          asc(conversationRisks.occurredAt),
          asc(conversationRisks.eventId),
        )
        .limit(MAX_RISK_ROWS + 1);

      if (riskRows.length > MAX_RISK_ROWS) {
        throw new Error('conversation_action_risk_rows_overflow');
      }

      const risk = chooseRiskProjection(
        riskRows,
        input.tenantId,
        input.institutionId,
      );

      const isActionable =
        segment.state === 'awaiting_human'
        || risk.state === 'unconfirmed'
        || risk.state === 'confirmed';

      if (!isActionable) {
        return null;
      }

      let customerReference: CustomerReferenceV1 | null = null;

      if (row.identityState === 'matched') {
        if (
          row.rootCustomerId === null
          || row.customerId === null
          || row.customerDisplayName === null
          || row.rootCustomerId !== row.customerId
        ) {
          throw new Error('conversation_action_customer_reference_unavailable');
        }

        customerReference = Object.freeze({
          contractVersion: 'v1' as const,
          customerId: row.customerId,
          displayName: row.customerDisplayName,
          maskedReference: null,
        });
      } else if (row.rootCustomerId !== null) {
        throw new Error('conversation_action_customer_identity_mismatch');
      }

      if (
        row.messageDirection !== 'inbound'
        || row.messageSenderKind !== 'customer'
        || row.messageSourceMessageRef === null
        || row.messageIdempotencyKey === null
        || row.messageSafeSummaryCode !== 'customer_message_received'
      ) {
        throw new Error('conversation_action_last_customer_message_invalid');
      }

      const safeSummary = Object.freeze({
        code: 'customer_message_received' as const,
        text: conversationMessageSafeSummaryTexts.customer_message_received,
      });

      const lastCustomerMessage: ConversationMessage = Object.freeze({
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        messageId: row.messageId,
        conversationId: input.conversationId,
        segmentId: segment.segmentId,
        direction: 'inbound' as const,
        senderKind: 'customer' as const,
        occurredAt: row.messageOccurredAt.toISOString(),
        receivedAt: row.messageReceivedAt.toISOString(),
        authorizedContentReference:
          row.messageAuthorizedContentReference,
        safeSummary,
        sourceMessageRef: row.messageSourceMessageRef,
        idempotencyKey: row.messageIdempotencyKey,
      });

      const assignment = commandRecord.segment.assignment;

      let approvedAssignee:
        | Readonly<{ userId: string; displayName: string }>
        | null = null;

      if (assignment) {
        if (
          !conversationActionProjectionRoles.some(
            (role) => role === assignment.assigneeRole,
          )
        ) {
          throw new Error('conversation_action_assignee_role_invalid');
        }

        approvedAssignee = await dependencies.resolveAssignee({
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          userId: assignment.assigneeUserId,
          role: assignment.assigneeRole as ConversationActionProjectionRole,
        });

        if (
          !approvedAssignee
          || approvedAssignee.userId !== assignment.assigneeUserId
        ) {
          throw new Error('conversation_action_assignee_unavailable');
        }
      }

      const sourceVersion = buildSourceVersion({
        conversationId: input.conversationId,
        conversationRevision: row.conversationRevision,
        segmentId: segment.segmentId,
        segmentRevision: commandRecord.segment.revision,
        assignmentRevision:
          commandRecord.segment.assignmentRevision,
        messageId: row.messageId,
        riskRows,
      });

      return Object.freeze({
        productionEvidence: Object.freeze({
          kind: 'server_persisted_current' as const,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          conversationId: input.conversationId,
          segmentId: segment.segmentId,
          sourceVersion,
        }),
        conversation: Object.freeze({
          conversationId: input.conversationId,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          channelType: row.channelType,
          serviceProviderType: row.serviceProviderType,
          connectionInstanceId: row.connectionInstanceId,
          channelConversationRef: row.channelConversationRef,
          customerReference,
          identityState: row.identityState,
          activeSegmentId: row.activeSegmentId,
          latestCustomerInboundMessageId:
            row.latestCustomerInboundMessageId,
          latestCustomerInboundAt:
            toIso(row.latestCustomerInboundAt),
          latestCustomerInboundRevision:
            row.latestCustomerInboundRevision,
          lastClosedSegmentId: row.lastClosedSegmentId,
          lastSegmentClosedAt:
            toIso(row.lastSegmentClosedAt),
          lastClosedSegmentInboundMessageId:
            row.lastClosedSegmentInboundMessageId,
          lastClosedSegmentInboundAt:
            toIso(row.lastClosedSegmentInboundAt),
          lastClosedSegmentInboundRevision:
            row.lastClosedSegmentInboundRevision,
          identityUpdatedAt: row.identityUpdatedAt.toISOString(),
          segmentUpdatedAt: row.segmentUpdatedAt.toISOString(),
          createdAt: row.conversationCreatedAt.toISOString(),
          updatedAt: row.conversationUpdatedAt.toISOString(),
        }),
        segment,
        assignment: Object.freeze({
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          conversationId: input.conversationId,
          segmentId: segment.segmentId,
          revision: commandRecord.segment.assignmentRevision,
          assignmentId: assignment?.assignmentId ?? null,
          assigneeRole: assignment?.assigneeRole ?? null,
          assignmentStatus: assignment?.status ?? null,
          activeAssignmentCount: assignment ? 1 as const : 0 as const,
          assigneeId: assignment?.assigneeUserId ?? null,
        }),
        risk,
        lastCustomerMessage,
        approved: Object.freeze({
          sourceVersion,
          sortSignals: Object.freeze([]),
          slaAt: null,
          priority: 'normal' as const,
          assignee: approvedAssignee,
        }),
      });
    },
  });
}
