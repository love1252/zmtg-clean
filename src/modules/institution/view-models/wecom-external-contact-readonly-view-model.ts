import {
  createWeComExternalContactMockFixture,
  createWeComExternalContactReadonlyView,
} from '@/modules/institution/domain/wecom-external-contact-readonly';
import type {
  WeComAuditEvent,
  WeComAuthorizationStatus,
  WeComExternalContactMockFixture,
  WeComManualReviewStatus,
  WeComMappingStatus,
  WeComReadonlyDataMode,
  WeComSyncStatus,
} from '@/modules/institution/domain/wecom-external-contact-readonly';

export type WeComExternalContactReadonlyScenario =
  | 'ready'
  | 'provider_disabled'
  | 'external_disabled'
  | 'not_configured'
  | 'revoked'
  | 'expired';

export type WeComExternalContactReadonlyApiPayload = {
  sourceKind: 'controlled_mock_fixture';
  dataMode: WeComReadonlyDataMode;
  readonly: true;
  mockDemo: true;
  containsRealCustomerData: false;
  authorizationStatus: WeComAuthorizationStatus;
  providerState: 'mock_only' | 'disabled' | 'external_disabled';
  syncStatus: WeComSyncStatus;
  lastSyncedAt: string | null;
  failClosed: boolean;
  reason:
    | 'mock_readonly_ready'
    | 'authorization_not_available'
    | 'provider_disabled'
    | 'external_provider_disabled'
    | 'forbidden_field_blocked';
  contacts: Array<{
    contactReference: string;
    displayName: string;
    owners: Array<{
      displayName: string;
      ownershipStatus: 'active' | 'inactive';
      institutionSummary: string;
    }>;
    tags: Array<{
      name: string;
      status: 'active' | 'inactive';
      sourceKind: 'mock_enterprise' | 'demo_enterprise';
    }>;
    sourceType: 'qr_code' | 'employee_share' | 'group_chat' | 'other_mock';
    addedAtDate: string;
    remarkSummary: string;
    mappingStatus: WeComMappingStatus;
    lastSyncedAt: string | null;
    syncStatus: WeComSyncStatus;
    manualReviewStatus: WeComManualReviewStatus;
  }>;
  mappingCandidates: Array<{
    mappingReference: string;
    contactReference: string;
    systemCustomerReference: string;
    mappingStatus: WeComMappingStatus;
    confidenceLevel: 'low' | 'medium' | 'high';
    matchReasonCode: 'mock_digest_candidate' | 'demo_reference_match';
    manualReviewStatus: WeComManualReviewStatus;
    updatedAt: string;
  }>;
  manualReview: Array<{
    reviewReference: string;
    contactReference: string;
    reviewStatus: WeComManualReviewStatus;
    reasonCode:
      | 'mapping_conflict'
      | 'mapping_candidate_review'
      | 'mapping_approved'
      | 'mapping_rejected'
      | 'mapping_more_info_required';
    reviewedAt: string | null;
    nextAction: 'none' | 'review_mapping' | 'keep_rejected' | 'provide_more_info';
  }>;
  auditSummary: {
    eventCount: number;
    blockedEventCount: number;
    events: Array<Pick<
      WeComAuditEvent,
      | 'eventType'
      | 'occurredAt'
      | 'actorRole'
      | 'resultStatus'
      | 'reasonCode'
      | 'dataMode'
      | 'containsSensitivePayload'
    >>;
  };
  forbiddenFieldsBlocked: boolean;
  fieldPolicy: {
    whitelistApplied: true;
    forbiddenFieldsReturned: false;
    notice: 'raw_identifiers_credentials_and_conversation_content_blocked';
  };
};

function emptyRestrictedCollections() {
  return {
    mappingCandidates: [],
    manualReview: [],
  } satisfies Pick<
    WeComExternalContactReadonlyApiPayload,
    'mappingCandidates' | 'manualReview'
  >;
}

function applyScenario(
  fixture: WeComExternalContactMockFixture,
  scenario: WeComExternalContactReadonlyScenario,
): WeComExternalContactMockFixture {
  if (scenario === 'ready') return fixture;

  if (scenario === 'provider_disabled' || scenario === 'external_disabled') {
    return {
      ...fixture,
      authorization: {
        ...fixture.authorization,
        providerState: scenario === 'provider_disabled' ? 'disabled' : 'external_disabled',
      },
    };
  }

  return {
    ...fixture,
    authorization: {
      ...fixture.authorization,
      authorizationStatus: scenario,
    },
  };
}

export function createWeComExternalContactReadonlyApiPayload(input: {
  tenantId: string;
  fixture?: WeComExternalContactMockFixture;
  scenario?: WeComExternalContactReadonlyScenario;
}): WeComExternalContactReadonlyApiPayload {
  const fixture = applyScenario(
    input.fixture ?? createWeComExternalContactMockFixture({
      tenantId: input.tenantId,
      dataMode: 'mock',
    }),
    input.scenario ?? 'ready',
  );
  const view = createWeComExternalContactReadonlyView({
    tenantId: input.tenantId,
    authorization: fixture.authorization,
    contacts: fixture.externalContacts,
    dataMode: fixture.dataMode,
    occurredAt: fixture.syncSnapshot.finishedAt,
  });
  const contactReferenceByDigest = new Map(
    view.contacts.map((contact) => [contact.externalUserIdDigest, contact.externalContactReference]),
  );
  const contacts = view.contacts.map((contact) => ({
    contactReference: contact.externalContactReference,
    displayName: contact.displayName,
    owners: contact.followUsers.map((owner) => ({
      displayName: owner.displayName,
      ownershipStatus: owner.ownershipStatus,
      institutionSummary: owner.institutionSummary,
    })),
    tags: contact.tags.map((tag) => ({
      name: tag.tagName,
      status: tag.tagStatus,
      sourceKind: tag.sourceType,
    })),
    sourceType: contact.sourceType,
    addedAtDate: contact.addedAtDate,
    remarkSummary: contact.remarkSummary,
    mappingStatus: contact.mappingStatus,
    lastSyncedAt: contact.lastSyncedAt,
    syncStatus: contact.syncStatus,
    manualReviewStatus: contact.manualReviewState,
  }));
  const restrictedCollections = view.failClosed
    ? emptyRestrictedCollections()
    : {
        mappingCandidates: fixture.mappingCandidates.flatMap((candidate) => {
          const contactReference = contactReferenceByDigest.get(candidate.externalContactDigest);
          if (!contactReference || candidate.tenantId !== input.tenantId) return [];

          return [{
            mappingReference: candidate.mappingReference,
            contactReference,
            systemCustomerReference: candidate.systemCustomerReference,
            mappingStatus: candidate.mappingStatus,
            confidenceLevel: candidate.confidenceLevel,
            matchReasonCode: candidate.matchReasonCode,
            manualReviewStatus: candidate.manualReviewState,
            updatedAt: candidate.updatedAt,
          }];
        }),
        manualReview: fixture.manualReviews.flatMap((review) => {
          const contactReference = contactReferenceByDigest.get(review.objectDigest);
          if (!contactReference || review.tenantId !== input.tenantId) return [];

          return [{
            reviewReference: review.reviewReference,
            contactReference,
            reviewStatus: review.reviewStatus,
            reasonCode: review.reasonCode,
            reviewedAt: review.reviewedAt,
            nextAction: review.nextAction,
          }];
        }),
      };
  const auditEvents = view.auditEvents.map((event) => ({
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    actorRole: event.actorRole,
    resultStatus: event.resultStatus,
    reasonCode: event.reasonCode,
    dataMode: event.dataMode,
    containsSensitivePayload: false as const,
  }));

  return {
    sourceKind: fixture.sourceKind,
    dataMode: fixture.dataMode,
    readonly: true,
    mockDemo: true,
    containsRealCustomerData: false,
    authorizationStatus: view.authorizationStatus,
    providerState:
      fixture.authorization.tenantId === input.tenantId
        ? fixture.authorization.providerState
        : 'disabled',
    syncStatus: view.syncStatus,
    lastSyncedAt: view.failClosed ? null : fixture.syncSnapshot.finishedAt,
    failClosed: view.failClosed,
    reason: view.reason,
    contacts,
    ...restrictedCollections,
    auditSummary: {
      eventCount: auditEvents.length,
      blockedEventCount: auditEvents.filter((event) => event.resultStatus === 'blocked').length,
      events: auditEvents,
    },
    forbiddenFieldsBlocked: view.reason === 'forbidden_field_blocked',
    fieldPolicy: {
      whitelistApplied: true,
      forbiddenFieldsReturned: false,
      notice: 'raw_identifiers_credentials_and_conversation_content_blocked',
    },
  };
}
