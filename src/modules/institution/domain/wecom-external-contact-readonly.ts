export const weComAuthorizationStatuses = [
  'not_configured',
  'authorized',
  'revoked',
  'expired',
  'disabled',
  'external_disabled',
  'manual_review_required',
] as const;

export const weComSyncStatuses = [
  'not_started',
  'mock_ready',
  'preflight_ready',
  'syncing_disabled',
  'sync_failed',
  'manual_review_required',
] as const;

export const weComMappingStatuses = [
  'unmatched',
  'candidate',
  'matched',
  'conflict',
  'rejected',
  'manual_review_required',
] as const;

export const weComManualReviewStatuses = [
  'not_required',
  'pending',
  'approved',
  'rejected',
  'needs_more_info',
] as const;

export const weComAuditEventTypes = [
  'authorization_status_changed',
  'sync_preflight_checked',
  'mock_snapshot_generated',
  'mapping_candidate_generated',
  'mapping_manual_review_updated',
  'forbidden_field_blocked',
  'external_provider_disabled',
] as const;

export type WeComAuthorizationStatus =
  (typeof weComAuthorizationStatuses)[number];
export type WeComSyncStatus = (typeof weComSyncStatuses)[number];
export type WeComMappingStatus = (typeof weComMappingStatuses)[number];
export type WeComManualReviewStatus =
  (typeof weComManualReviewStatuses)[number];
export type WeComAuditEventType = (typeof weComAuditEventTypes)[number];
export type WeComReadonlyDataMode = 'mock' | 'demo';

export type WeComTenantAuthorization = {
  tenantId: string;
  authorizationReference: string;
  corpIdDigest: string;
  authorizationStatus: WeComAuthorizationStatus;
  providerState: 'mock_only' | 'disabled' | 'external_disabled';
  authorizedAtDate: string | null;
  expiresAtDate: string | null;
  manualReviewState: WeComManualReviewStatus;
  lastPreflightAt: string | null;
  dataMode: WeComReadonlyDataMode;
  containsRealCustomerData: false;
};

export type WeComFollowUserReadonly = {
  tenantId: string;
  followUserReference: string;
  displayName: string;
  followUserIdDigest: string;
  ownershipStatus: 'active' | 'inactive';
  institutionSummary: string;
  dataMode: WeComReadonlyDataMode;
  containsRealCustomerData: false;
};

export type WeComCustomerTagReadonly = {
  tenantId: string;
  tagReference: string;
  tagIdDigest: string;
  tagName: string;
  sourceType: 'mock_enterprise' | 'demo_enterprise';
  tagStatus: 'active' | 'inactive';
  dataMode: WeComReadonlyDataMode;
  containsRealCustomerData: false;
};

export type WeComExternalContactReadonly = {
  tenantId: string;
  externalContactReference: string;
  displayName: string;
  externalUserIdDigest: string;
  followUsers: WeComFollowUserReadonly[];
  tags: WeComCustomerTagReadonly[];
  sourceType: 'qr_code' | 'employee_share' | 'group_chat' | 'other_mock';
  addedAtDate: string;
  remarkSummary: string;
  mappingStatus: WeComMappingStatus;
  lastSyncedAt: string | null;
  syncStatus: WeComSyncStatus;
  manualReviewState: WeComManualReviewStatus;
  dataMode: WeComReadonlyDataMode;
  containsRealCustomerData: false;
  fieldWhitelistApplied: true;
};

export type WeComCustomerMappingCandidate = {
  tenantId: string;
  mappingReference: string;
  externalContactDigest: string;
  systemCustomerReference: string;
  mappingStatus: WeComMappingStatus;
  confidenceLevel: 'low' | 'medium' | 'high';
  matchReasonCode: 'mock_digest_candidate' | 'demo_reference_match';
  manualReviewState: WeComManualReviewStatus;
  createdAt: string;
  updatedAt: string;
  dataMode: WeComReadonlyDataMode;
  containsRealCustomerData: false;
};

export type WeComSyncSnapshot = {
  tenantId: string;
  snapshotId: string;
  tenantReference: string;
  batchReference: string;
  syncStatus: WeComSyncStatus;
  scopeSummary: 'controlled_mock_external_contacts';
  startedAt: string;
  finishedAt: string;
  countSummary: {
    externalContacts: number;
    mappingCandidates: number;
    blockedRecords: number;
  };
  manualReviewState: WeComManualReviewStatus;
  dataMode: WeComReadonlyDataMode;
  containsRealCustomerData: false;
};

export type WeComManualReviewState = {
  tenantId: string;
  reviewReference: string;
  objectDigest: string;
  reviewStatus: WeComManualReviewStatus;
  reasonCode:
    | 'mapping_conflict'
    | 'mapping_candidate_review'
    | 'mapping_approved'
    | 'mapping_rejected'
    | 'mapping_more_info_required';
  reviewedAt: string | null;
  nextAction: 'none' | 'review_mapping' | 'keep_rejected' | 'provide_more_info';
  reviewerRole: 'institution_operator' | 'platform_governance';
  dataMode: WeComReadonlyDataMode;
  containsRealCustomerData: false;
};

export type WeComAuditEvent = {
  tenantId: string;
  tenantReference: string;
  operationReference: string;
  objectDigest?: string;
  eventType: WeComAuditEventType;
  occurredAt: string;
  actorRole: 'domain_system' | 'institution_operator' | 'platform_governance';
  resultStatus: 'allowed' | 'blocked' | 'recorded';
  reasonCode:
    | 'authorization_state_recorded'
    | 'preflight_state_recorded'
    | 'controlled_mock_snapshot_created'
    | 'controlled_mock_mapping_created'
    | 'manual_review_state_recorded'
    | 'readonly_field_not_whitelisted'
    | 'provider_fail_closed';
  dataMode: WeComReadonlyDataMode;
  containsSensitivePayload: false;
};

export type WeComExternalContactMockFixture = {
  tenantId: string;
  dataMode: WeComReadonlyDataMode;
  sourceKind: 'controlled_mock_fixture';
  containsRealCustomerData: false;
  authorization: WeComTenantAuthorization;
  externalContacts: WeComExternalContactReadonly[];
  mappingCandidates: WeComCustomerMappingCandidate[];
  syncSnapshot: WeComSyncSnapshot;
  manualReviews: WeComManualReviewState[];
};

export type WeComExternalContactReadonlyView = {
  tenantId: string;
  dataMode: WeComReadonlyDataMode;
  authorizationStatus: WeComAuthorizationStatus;
  syncStatus: WeComSyncStatus;
  manualReviewState: WeComManualReviewStatus;
  failClosed: boolean;
  reason:
    | 'mock_readonly_ready'
    | 'authorization_not_available'
    | 'provider_disabled'
    | 'external_provider_disabled'
    | 'forbidden_field_blocked';
  contacts: WeComExternalContactReadonly[];
  auditEvents: WeComAuditEvent[];
};

const fixtureDigests = [
  '1111111111111111111111111111111111111111111111111111111111111111',
  '2222222222222222222222222222222222222222222222222222222222222222',
  '3333333333333333333333333333333333333333333333333333333333333333',
  '4444444444444444444444444444444444444444444444444444444444444444',
] as const;

const mappingStates = [
  ['candidate', 'pending'],
  ['matched', 'approved'],
  ['conflict', 'needs_more_info'],
  ['manual_review_required', 'rejected'],
] as const satisfies readonly (readonly [WeComMappingStatus, WeComManualReviewStatus])[];

const contactKeys = new Set([
  'tenantId',
  'externalContactReference',
  'displayName',
  'externalUserIdDigest',
  'followUsers',
  'tags',
  'sourceType',
  'addedAtDate',
  'remarkSummary',
  'mappingStatus',
  'lastSyncedAt',
  'syncStatus',
  'manualReviewState',
  'dataMode',
  'containsRealCustomerData',
  'fieldWhitelistApplied',
]);

const followUserKeys = new Set([
  'tenantId',
  'followUserReference',
  'displayName',
  'followUserIdDigest',
  'ownershipStatus',
  'institutionSummary',
  'dataMode',
  'containsRealCustomerData',
]);

const tagKeys = new Set([
  'tenantId',
  'tagReference',
  'tagIdDigest',
  'tagName',
  'sourceType',
  'tagStatus',
  'dataMode',
  'containsRealCustomerData',
]);

function assertTenantId(tenantId: string) {
  if (!tenantId.trim()) {
    throw new TypeError('tenantId is required');
  }
}

function assertReadonlyDataMode(dataMode: unknown): asserts dataMode is WeComReadonlyDataMode {
  if (dataMode !== 'mock' && dataMode !== 'demo') {
    throw new TypeError('dataMode must be mock or demo');
  }
}

function cloneContact(contact: WeComExternalContactReadonly): WeComExternalContactReadonly {
  return {
    tenantId: contact.tenantId,
    externalContactReference: contact.externalContactReference,
    displayName: contact.displayName,
    externalUserIdDigest: contact.externalUserIdDigest,
    followUsers: contact.followUsers.map((followUser) => ({ ...followUser })),
    tags: contact.tags.map((tag) => ({ ...tag })),
    sourceType: contact.sourceType,
    addedAtDate: contact.addedAtDate,
    remarkSummary: contact.remarkSummary,
    mappingStatus: contact.mappingStatus,
    lastSyncedAt: contact.lastSyncedAt,
    syncStatus: contact.syncStatus,
    manualReviewState: contact.manualReviewState,
    dataMode: contact.dataMode,
    containsRealCustomerData: false,
    fieldWhitelistApplied: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, allowedKeys: Set<string>) {
  const keys = Object.keys(value);
  return keys.length === allowedKeys.size && keys.every((key) => allowedKeys.has(key));
}

function isControlledDigest(value: unknown) {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
}

function isControlledLabel(value: unknown, dataMode: WeComReadonlyDataMode) {
  return typeof value === 'string' && value.startsWith(`[${dataMode.toUpperCase()}]`);
}

function containsSensitiveIdentity(value: unknown) {
  return typeof value === 'string' && (
    /(?:^|\D)1[3-9]\d{9}(?:\D|$)/.test(value) ||
    /(?:^|\D)\d{17}[\dXx](?:\D|$)/.test(value)
  );
}

function valuesContainSensitiveIdentity(value: Record<string, unknown>) {
  return Object.values(value).some(containsSensitiveIdentity);
}

function isControlledFollowUser(
  value: unknown,
  tenantId: string,
  dataMode: WeComReadonlyDataMode,
): value is WeComFollowUserReadonly {
  if (!isRecord(value) || !hasExactKeys(value, followUserKeys)) return false;
  return !valuesContainSensitiveIdentity(value) &&
    value.tenantId === tenantId &&
    value.dataMode === dataMode &&
    value.containsRealCustomerData === false &&
    isControlledLabel(value.displayName, dataMode) &&
    isControlledDigest(value.followUserIdDigest);
}

function isControlledTag(
  value: unknown,
  tenantId: string,
  dataMode: WeComReadonlyDataMode,
): value is WeComCustomerTagReadonly {
  if (!isRecord(value) || !hasExactKeys(value, tagKeys)) return false;
  return !valuesContainSensitiveIdentity(value) &&
    value.tenantId === tenantId &&
    value.dataMode === dataMode &&
    value.containsRealCustomerData === false &&
    isControlledDigest(value.tagIdDigest) &&
    isControlledLabel(value.tagName, dataMode);
}

function isControlledContact(
  value: unknown,
  tenantId: string,
  dataMode: WeComReadonlyDataMode,
): value is WeComExternalContactReadonly {
  if (!isRecord(value) || !hasExactKeys(value, contactKeys)) return false;
  if (
    valuesContainSensitiveIdentity(value) ||
    value.tenantId !== tenantId ||
    value.dataMode !== dataMode ||
    value.containsRealCustomerData !== false ||
    value.fieldWhitelistApplied !== true ||
    !isControlledLabel(value.displayName, dataMode) ||
    !isControlledDigest(value.externalUserIdDigest)
  ) return false;
  if (!Array.isArray(value.followUsers) || !Array.isArray(value.tags)) return false;
  return value.followUsers.every((item) => isControlledFollowUser(item, tenantId, dataMode)) &&
    value.tags.every((item) => isControlledTag(item, tenantId, dataMode));
}

export function createWeComAuditEvent(input: {
  tenantId: string;
  tenantReference: string;
  operationReference: string;
  objectDigest?: string;
  eventType: WeComAuditEventType;
  occurredAt: string;
  actorRole: WeComAuditEvent['actorRole'];
  resultStatus: WeComAuditEvent['resultStatus'];
  reasonCode: WeComAuditEvent['reasonCode'];
  dataMode: WeComReadonlyDataMode;
}): WeComAuditEvent {
  const event: WeComAuditEvent = {
    tenantId: input.tenantId,
    tenantReference: input.tenantReference,
    operationReference: input.operationReference,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    actorRole: input.actorRole,
    resultStatus: input.resultStatus,
    reasonCode: input.reasonCode,
    dataMode: input.dataMode,
    containsSensitivePayload: false,
  };
  if (input.objectDigest !== undefined) {
    event.objectDigest = input.objectDigest;
  }
  return event;
}

export function createWeComExternalContactMockFixture(input: {
  tenantId: string;
  dataMode?: WeComReadonlyDataMode;
}): WeComExternalContactMockFixture {
  assertTenantId(input.tenantId);
  const dataMode = input.dataMode ?? 'mock';
  assertReadonlyDataMode(dataMode);
  const tenantReference = `${dataMode}-tenant-ref`;
  const occurredAt = '2026-07-12T00:00:00.000Z';
  const addedAtDate = '2026-07-10';

  const followUser: WeComFollowUserReadonly = {
    tenantId: input.tenantId,
    followUserReference: `${dataMode}-follow-user-ref-01`,
    displayName: `[${dataMode.toUpperCase()}] 归属员工 01`,
    followUserIdDigest: `sha256:${fixtureDigests[0]}`,
    ownershipStatus: 'active',
    institutionSummary: `${dataMode}_institution`,
    dataMode,
    containsRealCustomerData: false,
  };
  const tag: WeComCustomerTagReadonly = {
    tenantId: input.tenantId,
    tagReference: `${dataMode}-tag-ref-01`,
    tagIdDigest: `sha256:${fixtureDigests[1]}`,
    tagName: `[${dataMode.toUpperCase()}] 低敏标签`,
    sourceType: dataMode === 'mock' ? 'mock_enterprise' : 'demo_enterprise',
    tagStatus: 'active',
    dataMode,
    containsRealCustomerData: false,
  };

  const externalContacts = mappingStates.map(([mappingStatus, manualReviewState], index) => ({
    tenantId: input.tenantId,
    externalContactReference: `${dataMode}-external-contact-ref-0${index + 1}`,
    displayName: `[${dataMode.toUpperCase()}] 外部联系人 0${index + 1}`,
    externalUserIdDigest: `sha256:${fixtureDigests[index]}`,
    followUsers: [{ ...followUser }],
    tags: [{ ...tag }],
    sourceType: 'other_mock' as const,
    addedAtDate,
    remarkSummary: `${dataMode}_readonly_summary_0${index + 1}`,
    mappingStatus,
    lastSyncedAt: occurredAt,
    syncStatus: 'mock_ready' as const,
    manualReviewState,
    dataMode,
    containsRealCustomerData: false as const,
    fieldWhitelistApplied: true as const,
  }));

  const mappingCandidates = externalContacts.map((contact, index) => ({
    tenantId: input.tenantId,
    mappingReference: `${dataMode}-mapping-ref-0${index + 1}`,
    externalContactDigest: contact.externalUserIdDigest,
    systemCustomerReference: `${dataMode}-system-customer-ref-0${index + 1}`,
    mappingStatus: contact.mappingStatus,
    confidenceLevel: index === 1 ? 'high' as const : 'low' as const,
    matchReasonCode: dataMode === 'mock'
      ? 'mock_digest_candidate' as const
      : 'demo_reference_match' as const,
    manualReviewState: contact.manualReviewState,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    dataMode,
    containsRealCustomerData: false as const,
  }));

  const manualReviews: WeComManualReviewState[] = [
    ['pending', 'mapping_candidate_review', null, 'review_mapping'],
    ['approved', 'mapping_approved', occurredAt, 'none'],
    ['rejected', 'mapping_rejected', occurredAt, 'keep_rejected'],
    ['needs_more_info', 'mapping_more_info_required', null, 'provide_more_info'],
  ].map(([reviewStatus, reasonCode, reviewedAt, nextAction], index) => ({
    tenantId: input.tenantId,
    reviewReference: `${dataMode}-review-ref-0${index + 1}`,
    objectDigest: externalContacts[index].externalUserIdDigest,
    reviewStatus: reviewStatus as WeComManualReviewStatus,
    reasonCode: reasonCode as WeComManualReviewState['reasonCode'],
    reviewedAt,
    nextAction: nextAction as WeComManualReviewState['nextAction'],
    reviewerRole: 'institution_operator',
    dataMode,
    containsRealCustomerData: false,
  }));

  return {
    tenantId: input.tenantId,
    dataMode,
    sourceKind: 'controlled_mock_fixture',
    containsRealCustomerData: false,
    authorization: {
      tenantId: input.tenantId,
      authorizationReference: `${dataMode}-authorization-ref`,
      corpIdDigest: `sha256:${fixtureDigests[3]}`,
      authorizationStatus: 'authorized',
      providerState: 'mock_only',
      authorizedAtDate: '2026-07-01',
      expiresAtDate: null,
      manualReviewState: 'not_required',
      lastPreflightAt: occurredAt,
      dataMode,
      containsRealCustomerData: false,
    },
    externalContacts,
    mappingCandidates,
    syncSnapshot: {
      tenantId: input.tenantId,
      snapshotId: `${dataMode}-snapshot-ref`,
      tenantReference,
      batchReference: `${dataMode}-batch-ref`,
      syncStatus: 'mock_ready',
      scopeSummary: 'controlled_mock_external_contacts',
      startedAt: occurredAt,
      finishedAt: occurredAt,
      countSummary: {
        externalContacts: externalContacts.length,
        mappingCandidates: mappingCandidates.length,
        blockedRecords: 0,
      },
      manualReviewState: 'not_required',
      dataMode,
      containsRealCustomerData: false,
    },
    manualReviews,
  };
}

function blockedView(input: {
  tenantId: string;
  dataMode: WeComReadonlyDataMode;
  authorizationStatus: WeComAuthorizationStatus;
  syncStatus: WeComSyncStatus;
  manualReviewState: WeComManualReviewStatus;
  reason: Exclude<WeComExternalContactReadonlyView['reason'], 'mock_readonly_ready'>;
  auditEvents?: WeComAuditEvent[];
}): WeComExternalContactReadonlyView {
  return {
    ...input,
    failClosed: true,
    contacts: [],
    auditEvents: input.auditEvents ?? [],
  };
}

export function createWeComExternalContactReadonlyView(input: {
  tenantId: string;
  authorization: WeComTenantAuthorization | null;
  contacts: readonly unknown[];
  dataMode: WeComReadonlyDataMode;
  occurredAt: string;
}): WeComExternalContactReadonlyView {
  assertTenantId(input.tenantId);
  assertReadonlyDataMode(input.dataMode);
  const authorization = input.authorization?.tenantId === input.tenantId
    ? input.authorization
    : null;

  if (!authorization || authorization.authorizationStatus !== 'authorized') {
    return blockedView({
      tenantId: input.tenantId,
      dataMode: input.dataMode,
      authorizationStatus: authorization?.authorizationStatus ?? 'not_configured',
      syncStatus: 'syncing_disabled',
      manualReviewState: authorization?.manualReviewState ?? 'not_required',
      reason: 'authorization_not_available',
    });
  }

  if (authorization.providerState === 'external_disabled') {
    return blockedView({
      tenantId: input.tenantId,
      dataMode: input.dataMode,
      authorizationStatus: 'external_disabled',
      syncStatus: 'syncing_disabled',
      manualReviewState: authorization.manualReviewState,
      reason: 'external_provider_disabled',
      auditEvents: [createWeComAuditEvent({
        tenantId: input.tenantId,
        tenantReference: `${input.dataMode}-tenant-ref`,
        operationReference: `${input.dataMode}-provider-check`,
        eventType: 'external_provider_disabled',
        occurredAt: input.occurredAt,
        actorRole: 'domain_system',
        resultStatus: 'blocked',
        reasonCode: 'provider_fail_closed',
        dataMode: input.dataMode,
      })],
    });
  }

  if (authorization.providerState !== 'mock_only') {
    return blockedView({
      tenantId: input.tenantId,
      dataMode: input.dataMode,
      authorizationStatus: 'disabled',
      syncStatus: 'syncing_disabled',
      manualReviewState: authorization.manualReviewState,
      reason: 'provider_disabled',
    });
  }

  const tenantContacts = input.contacts.filter(
    (contact) => isRecord(contact) && contact.tenantId === input.tenantId,
  );
  if (tenantContacts.some(
    (contact) => !isControlledContact(contact, input.tenantId, input.dataMode),
  )) {
    return blockedView({
      tenantId: input.tenantId,
      dataMode: input.dataMode,
      authorizationStatus: 'authorized',
      syncStatus: 'manual_review_required',
      manualReviewState: 'pending',
      reason: 'forbidden_field_blocked',
      auditEvents: [createWeComAuditEvent({
        tenantId: input.tenantId,
        tenantReference: `${input.dataMode}-tenant-ref`,
        operationReference: `${input.dataMode}-field-guard`,
        eventType: 'forbidden_field_blocked',
        occurredAt: input.occurredAt,
        actorRole: 'domain_system',
        resultStatus: 'blocked',
        reasonCode: 'readonly_field_not_whitelisted',
        dataMode: input.dataMode,
      })],
    });
  }

  return {
    tenantId: input.tenantId,
    dataMode: input.dataMode,
    authorizationStatus: 'authorized',
    syncStatus: 'mock_ready',
    manualReviewState: authorization.manualReviewState,
    failClosed: false,
    reason: 'mock_readonly_ready',
    contacts: tenantContacts.map((contact) => cloneContact(contact as WeComExternalContactReadonly)),
    auditEvents: [],
  };
}
