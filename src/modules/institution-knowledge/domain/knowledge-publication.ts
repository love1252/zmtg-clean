import {
  knowledgeAssetApprovalStatuses,
  knowledgeItemLifecycles,
  knowledgeSafetyStatuses,
  knowledgeUseScopes,
  knowledgeVersionLifecycles,
  isValidKnowledgeVersion,
  transitionKnowledgeVersionLifecycle,
  type KnowledgeAssetApprovalStatus,
  type KnowledgeItemLifecycle,
  type KnowledgeSafetyStatus,
  type KnowledgeUseScope,
  type KnowledgeVersion,
  type KnowledgeVersionLifecycle,
} from './knowledge-versioning';

export const knowledgePublicationLifecycles = Object.freeze([
  'current',
  'superseded',
  'withdrawn',
] as const);

export type KnowledgePublicationLifecycle =
  (typeof knowledgePublicationLifecycles)[number];

export type KnowledgePublication = Readonly<{
  publicationId: string;
  knowledgeId: string;
  versionId: string;
  versionNumber: number;
  manifestHash: string;
  lifecycle: KnowledgePublicationLifecycle;
  complete: boolean;
  safetyStatus: KnowledgeSafetyStatus;
  useScope: KnowledgeUseScope;
  publishedAt: string;
  withdrawnAt: string | null;
}>;

export type KnowledgePublicationState = Readonly<{
  item: Readonly<{
    knowledgeId: string;
    lifecycle: KnowledgeItemLifecycle;
    revision: number;
  }>;
  currentPublicationId: string | null;
  publications: readonly KnowledgePublication[];
}>;

export type KnowledgePublicationGateEvidence = Readonly<{
  observedManifestHash: string;
  parseReady: boolean;
  indexReady: boolean;
  safetyStatus: KnowledgeSafetyStatus;
  useScopeEligible: boolean;
}>;

type KnowledgePublicationCommandBase = Readonly<{
  idempotencyKey: string;
  expectedRevision: number;
  decidedAt: string;
}>;

export type KnowledgePublicationCommand =
  | (KnowledgePublicationCommandBase &
      Readonly<{
        kind: 'publish';
        publicationId: string;
        candidateVersion: KnowledgeVersion;
        gateEvidence: KnowledgePublicationGateEvidence;
      }>)
  | (KnowledgePublicationCommandBase &
      Readonly<{
        kind: 'rollback';
        targetPublicationId: string;
      }>)
  | (KnowledgePublicationCommandBase &
      Readonly<{
        kind: 'withdraw';
        targetPublicationId: string;
      }>)
  | (KnowledgePublicationCommandBase & Readonly<{ kind: 'retire' }>);

export type KnowledgePublicationTransition = Readonly<{
  publicationId: string;
  path: readonly KnowledgePublicationLifecycle[];
}>;

export type KnowledgePublicationFailureCode =
  | 'candidate_knowledge_mismatch'
  | 'candidate_not_draft'
  | 'candidate_version_not_monotonic'
  | 'candidate_version_reused'
  | 'command_invalid'
  | 'expected_revision_conflict'
  | 'idempotency_conflict'
  | 'idempotency_key_invalid'
  | 'index_not_ready'
  | 'item_already_retired'
  | 'item_retired'
  | 'manifest_mismatch'
  | 'parse_not_ready'
  | 'publication_id_reused'
  | 'revision_overflow'
  | 'rollback_target_incomplete'
  | 'rollback_target_not_found'
  | 'rollback_target_not_historical'
  | 'rollback_target_unsafe'
  | 'rollback_target_withdrawn'
  | 'safety_not_allowed'
  | 'state_invalid'
  | 'use_scope_ineligible'
  | 'withdraw_target_already_withdrawn'
  | 'withdraw_target_not_found';

type KnowledgePublicationDecisionSnapshotBase = Readonly<{
  nextState: KnowledgePublicationState;
  candidateVersion: KnowledgeVersion | null;
  candidateLifecyclePath: readonly KnowledgeVersionLifecycle[];
  publicationTransitions: readonly KnowledgePublicationTransition[];
}>;

type KnowledgePublicationSuccessSnapshot =
  KnowledgePublicationDecisionSnapshotBase & Readonly<{ ok: true }>;

type KnowledgePublicationFailureSnapshot =
  KnowledgePublicationDecisionSnapshotBase &
    Readonly<{
      ok: false;
      reasonCodes: readonly KnowledgePublicationFailureCode[];
    }>;

type KnowledgePublicationDecisionSnapshot =
  | KnowledgePublicationSuccessSnapshot
  | KnowledgePublicationFailureSnapshot;

type KnowledgeCandidateVersionReference = Readonly<{
  knowledgeId: string;
  versionId: string;
  versionNumber: number;
  submittedLifecycle: KnowledgeVersionLifecycle;
  manifestHash: string;
  comparisonVersion: 1;
}>;

export type KnowledgePublicationIdempotencyRecord = Readonly<{
  knowledgeId: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  submittedCandidateReference: KnowledgeCandidateVersionReference | null;
  previousState: KnowledgePublicationState;
}>;

type KnowledgePublicationDecisionResultBase = Readonly<{
  idempotentReplay: boolean;
  shouldApplyNextState: boolean;
  idempotencyRecord: KnowledgePublicationIdempotencyRecord | null;
}>;

export type KnowledgePublicationDecision =
  | (KnowledgePublicationSuccessSnapshot & KnowledgePublicationDecisionResultBase)
  | (KnowledgePublicationFailureSnapshot & KnowledgePublicationDecisionResultBase);

export type KnowledgeUseAvailability = Readonly<{
  canRetrieve: boolean;
  canAnswer: boolean;
  canSendAttachment: boolean;
  reasonCodes: readonly KnowledgeUseAvailabilityReasonCode[];
}>;

export type KnowledgeUseAvailabilityReasonCode =
  | 'asset_approval_blocked'
  | 'asset_approval_invalid'
  | 'asset_approval_withdrawn'
  | 'asset_not_approved'
  | 'current_publication_unavailable'
  | 'item_retired'
  | 'publication_incomplete'
  | 'publication_safety_not_allowed'
  | 'state_invalid'
  | 'use_scope_internal_only';

function freezePublication(
  publication: KnowledgePublication,
): KnowledgePublication {
  return Object.freeze({
    publicationId: publication.publicationId,
    knowledgeId: publication.knowledgeId,
    versionId: publication.versionId,
    versionNumber: publication.versionNumber,
    manifestHash: publication.manifestHash,
    lifecycle: publication.lifecycle,
    complete: publication.complete,
    safetyStatus: publication.safetyStatus,
    useScope: publication.useScope,
    publishedAt: publication.publishedAt,
    withdrawnAt: publication.withdrawnAt,
  });
}

function freezeState(state: KnowledgePublicationState): KnowledgePublicationState {
  const item = Object.freeze({
    knowledgeId: state.item.knowledgeId,
    lifecycle: state.item.lifecycle,
    revision: state.item.revision,
  });
  const publications = Object.freeze(
    state.publications.map((publication) => freezePublication(publication)),
  );

  return Object.freeze({
    item,
    currentPublicationId: state.currentPublicationId,
    publications,
  });
}

function freezeCandidateVersion(version: KnowledgeVersion): KnowledgeVersion {
  const metadataSnapshot = Object.freeze({
    title: version.metadataSnapshot.title,
    category: version.metadataSnapshot.category,
    tags: Object.freeze([...version.metadataSnapshot.tags]),
    lowSensitiveSummary: version.metadataSnapshot.lowSensitiveSummary,
    source: version.metadataSnapshot.source,
    riskLevel: version.metadataSnapshot.riskLevel,
    effectiveAt: version.metadataSnapshot.effectiveAt,
    reviewAt: version.metadataSnapshot.reviewAt,
    useScope: version.metadataSnapshot.useScope,
  });

  return Object.freeze({
    knowledgeId: version.knowledgeId,
    versionId: version.versionId,
    versionNumber: version.versionNumber,
    lifecycle: version.lifecycle,
    metadataSnapshot,
    bodyRevisionId: version.bodyRevisionId,
    fileRevisionIds: Object.freeze([...version.fileRevisionIds]),
    manifestHash: version.manifestHash,
    createdAt: version.createdAt,
  });
}

function freezeCandidateLifecyclePath(
  path: readonly KnowledgeVersionLifecycle[],
): readonly KnowledgeVersionLifecycle[] {
  return Object.freeze([...path]);
}

function freezePublicationTransitions(
  transitions: readonly KnowledgePublicationTransition[],
): readonly KnowledgePublicationTransition[] {
  return Object.freeze(
    transitions.map((transition) =>
      Object.freeze({
        publicationId: transition.publicationId,
        path: Object.freeze([...transition.path]),
      }),
    ),
  );
}

function freezeSnapshot(
  snapshot: KnowledgePublicationDecisionSnapshot,
): KnowledgePublicationDecisionSnapshot {
  const shared = {
    nextState: freezeState(snapshot.nextState),
    candidateVersion:
      snapshot.candidateVersion === null
        ? null
        : freezeCandidateVersion(snapshot.candidateVersion),
    candidateLifecyclePath: freezeCandidateLifecyclePath(
      snapshot.candidateLifecyclePath,
    ),
    publicationTransitions: freezePublicationTransitions(
      snapshot.publicationTransitions,
    ),
  };

  if (snapshot.ok) {
    return Object.freeze({ ok: true, ...shared });
  }

  return Object.freeze({
    ok: false,
    ...shared,
    reasonCodes: Object.freeze([...snapshot.reasonCodes]),
  });
}

function freezeCandidateReference(
  reference: KnowledgeCandidateVersionReference,
): KnowledgeCandidateVersionReference {
  return Object.freeze({
    knowledgeId: reference.knowledgeId,
    versionId: reference.versionId,
    versionNumber: reference.versionNumber,
    submittedLifecycle: reference.submittedLifecycle,
    manifestHash: reference.manifestHash,
    comparisonVersion: reference.comparisonVersion,
  });
}

function resultFromSnapshot(
  snapshot: KnowledgePublicationDecisionSnapshot,
  idempotentReplay: boolean,
  idempotencyRecord: KnowledgePublicationIdempotencyRecord | null,
): KnowledgePublicationDecision {
  if (snapshot.ok) {
    return Object.freeze({
      ...snapshot,
      idempotentReplay,
      shouldApplyNextState: !idempotentReplay,
      idempotencyRecord,
    });
  }

  return Object.freeze({
    ...snapshot,
    idempotentReplay,
    shouldApplyNextState: false,
    idempotencyRecord,
  });
}

function finalizeNewDecision(
  snapshotInput: KnowledgePublicationDecisionSnapshot,
  previousState: KnowledgePublicationState,
  command: KnowledgePublicationCommand,
  payloadFingerprint: string,
): KnowledgePublicationDecision {
  const snapshot = freezeSnapshot(snapshotInput);
  const idempotencyRecord = Object.freeze({
    knowledgeId: previousState.item.knowledgeId,
    idempotencyKey: command.idempotencyKey,
    payloadFingerprint,
    submittedCandidateReference:
      command.kind === 'publish'
        ? freezeCandidateReference({
            knowledgeId: command.candidateVersion.knowledgeId,
            versionId: command.candidateVersion.versionId,
            versionNumber: command.candidateVersion.versionNumber,
            submittedLifecycle: command.candidateVersion.lifecycle,
            manifestHash: command.candidateVersion.manifestHash,
            comparisonVersion: 1,
          })
        : null,
    previousState: freezeState(previousState),
  });

  return resultFromSnapshot(snapshot, false, idempotencyRecord);
}

function failureSnapshot(
  state: KnowledgePublicationState,
  reasonCodes: readonly KnowledgePublicationFailureCode[],
  candidateVersion: KnowledgeVersion | null = null,
  candidateLifecyclePath: readonly KnowledgeVersionLifecycle[] = [],
  publicationTransitions: readonly KnowledgePublicationTransition[] = [],
): KnowledgePublicationFailureSnapshot {
  return {
    ok: false,
    nextState: state,
    candidateVersion,
    candidateLifecyclePath,
    publicationTransitions,
    reasonCodes,
  };
}

function commandPayloadFingerprint(
  command: KnowledgePublicationCommand,
  knowledgeId: string,
  previousState: KnowledgePublicationState,
): string {
  const previousStateFields = [
    [
      previousState.item.knowledgeId,
      previousState.item.lifecycle,
      previousState.item.revision,
    ],
    previousState.currentPublicationId,
    previousState.publications.map((publication) => [
      publication.publicationId,
      publication.knowledgeId,
      publication.versionId,
      publication.versionNumber,
      publication.manifestHash,
      publication.lifecycle,
      publication.complete,
      publication.safetyStatus,
      publication.useScope,
      publication.publishedAt,
      publication.withdrawnAt,
    ]),
  ];
  const commonFields = [
    knowledgeId,
    command.kind,
    command.expectedRevision,
    command.decidedAt,
    previousStateFields,
  ];

  if (command.kind === 'publish') {
    const { candidateVersion, gateEvidence } = command;

    return JSON.stringify([
      ...commonFields,
      command.publicationId,
      candidateVersion.knowledgeId,
      candidateVersion.versionId,
      candidateVersion.versionNumber,
      candidateVersion.lifecycle,
      candidateVersion.bodyRevisionId,
      [...candidateVersion.fileRevisionIds],
      candidateVersion.manifestHash,
      candidateVersion.createdAt,
      gateEvidence.observedManifestHash,
      gateEvidence.parseReady,
      gateEvidence.indexReady,
      gateEvidence.safetyStatus,
      gateEvidence.useScopeEligible,
    ]);
  }

  if (command.kind === 'rollback' || command.kind === 'withdraw') {
    return JSON.stringify([...commonFields, command.targetPublicationId]);
  }

  return JSON.stringify(commonFields);
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

// Candidate normalization is exact and order-preserving. No text rewriting or
// content hashing occurs in this domain kernel.
function normalizedCandidatesEqual(
  left: KnowledgeVersion,
  right: KnowledgeVersion,
): boolean {
  return (
    left.knowledgeId === right.knowledgeId &&
    left.versionId === right.versionId &&
    left.versionNumber === right.versionNumber &&
    left.lifecycle === right.lifecycle &&
    left.metadataSnapshot.title === right.metadataSnapshot.title &&
    left.metadataSnapshot.category === right.metadataSnapshot.category &&
    arraysEqual(left.metadataSnapshot.tags, right.metadataSnapshot.tags) &&
    left.metadataSnapshot.lowSensitiveSummary ===
      right.metadataSnapshot.lowSensitiveSummary &&
    left.metadataSnapshot.source === right.metadataSnapshot.source &&
    left.metadataSnapshot.riskLevel === right.metadataSnapshot.riskLevel &&
    left.metadataSnapshot.effectiveAt === right.metadataSnapshot.effectiveAt &&
    left.metadataSnapshot.reviewAt === right.metadataSnapshot.reviewAt &&
    left.metadataSnapshot.useScope === right.metadataSnapshot.useScope &&
    left.bodyRevisionId === right.bodyRevisionId &&
    arraysEqual(left.fileRevisionIds, right.fileRevisionIds) &&
    left.manifestHash === right.manifestHash &&
    left.createdAt === right.createdAt
  );
}

function restoreRecordedCandidate(input: Readonly<{
  command: KnowledgePublicationCommand;
  reference: KnowledgeCandidateVersionReference | null;
  recordedSubmittedCandidateVersion: KnowledgeVersion | null;
}>): Readonly<{ ok: true; candidateVersion: KnowledgeVersion | null }> | Readonly<{
  ok: false;
}> {
  if (input.reference === null) {
    return input.command.kind !== 'publish' &&
      input.recordedSubmittedCandidateVersion === null
      ? Object.freeze({ ok: true, candidateVersion: null })
      : Object.freeze({ ok: false });
  }
  if (
    input.command.kind !== 'publish' ||
    !isValidKnowledgeVersion(input.recordedSubmittedCandidateVersion)
  ) {
    return Object.freeze({ ok: false });
  }

  const recordedCandidate = input.recordedSubmittedCandidateVersion;
  if (
    input.reference.comparisonVersion !== 1 ||
    recordedCandidate.knowledgeId !== input.reference.knowledgeId ||
    recordedCandidate.versionId !== input.reference.versionId ||
    recordedCandidate.versionNumber !== input.reference.versionNumber ||
    recordedCandidate.lifecycle !== input.reference.submittedLifecycle ||
    recordedCandidate.manifestHash !== input.reference.manifestHash ||
    !normalizedCandidatesEqual(
      recordedCandidate,
      input.command.candidateVersion,
    )
  ) {
    return Object.freeze({ ok: false });
  }

  return Object.freeze({
    ok: true,
    candidateVersion: freezeCandidateVersion(recordedCandidate),
  });
}

const manifestHashPattern = /^sha256:[a-f0-9]{64}$/;
const referenceIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const isoTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Reflect.ownKeys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      (key) => typeof key === 'string' && expectedKeys.includes(key),
    )
  );
}

function isOneOf<T extends string>(
  value: unknown,
  values: readonly T[],
): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isReferenceId(value: unknown): value is string {
  return typeof value === 'string' && referenceIdPattern.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && isoTimestampPattern.test(value);
}

function isValidPublication(value: unknown): value is KnowledgePublication {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'publicationId',
      'knowledgeId',
      'versionId',
      'versionNumber',
      'manifestHash',
      'lifecycle',
      'complete',
      'safetyStatus',
      'useScope',
      'publishedAt',
      'withdrawnAt',
    ])
  ) {
    return false;
  }

  const hasValidWithdrawnAt =
    value.lifecycle === 'withdrawn'
      ? isIsoTimestamp(value.withdrawnAt)
      : value.withdrawnAt === null;

  return (
    isReferenceId(value.publicationId) &&
    isReferenceId(value.knowledgeId) &&
    isReferenceId(value.versionId) &&
    Number.isSafeInteger(value.versionNumber) &&
    (value.versionNumber as number) > 0 &&
    typeof value.manifestHash === 'string' &&
    manifestHashPattern.test(value.manifestHash) &&
    isOneOf(value.lifecycle, knowledgePublicationLifecycles) &&
    typeof value.complete === 'boolean' &&
    isOneOf(value.safetyStatus, knowledgeSafetyStatuses) &&
    isOneOf(value.useScope, knowledgeUseScopes) &&
    isIsoTimestamp(value.publishedAt) &&
    hasValidWithdrawnAt
  );
}

function isValidState(state: unknown): state is KnowledgePublicationState {
  if (
    !isRecord(state) ||
    !hasExactKeys(state, [
      'item',
      'currentPublicationId',
      'publications',
    ]) ||
    !isRecord(state.item) ||
    !hasExactKeys(state.item, ['knowledgeId', 'lifecycle', 'revision']) ||
    !Array.isArray(state.publications) ||
    !(state.currentPublicationId === null ||
      isReferenceId(state.currentPublicationId)) ||
    !isReferenceId(state.item.knowledgeId) ||
    !isOneOf(state.item.lifecycle, knowledgeItemLifecycles) ||
    !Number.isSafeInteger(state.item.revision) ||
    (state.item.revision as number) < 0 ||
    !state.publications.every(isValidPublication)
  ) {
    return false;
  }

  const item = state.item as KnowledgePublicationState['item'];
  const publications = state.publications;
  const publicationIds = publications.map(
    (publication) => publication.publicationId,
  );
  const versionIds = publications.map((publication) => publication.versionId);
  const versionNumbers = publications.map(
    (publication) => publication.versionNumber,
  );
  if (
    new Set(publicationIds).size !== publicationIds.length ||
    new Set(versionIds).size !== versionIds.length ||
    new Set(versionNumbers).size !== versionNumbers.length ||
    publications.some(
      (publication) => publication.knowledgeId !== item.knowledgeId,
    )
  ) {
    return false;
  }

  const currentPublications = publications.filter(
    (publication) => publication.lifecycle === 'current',
  );
  if (item.lifecycle === 'retired') {
    return (
      state.currentPublicationId === null && currentPublications.length === 0
    );
  }
  if (state.currentPublicationId === null) {
    return currentPublications.length === 0;
  }

  return (
    currentPublications.length === 1 &&
    currentPublications[0]?.publicationId === state.currentPublicationId
  );
}

function findCurrentPublication(
  state: KnowledgePublicationState,
): KnowledgePublication | null {
  if (state.currentPublicationId === null) return null;

  return (
    state.publications.find(
      (publication) =>
        publication.publicationId === state.currentPublicationId &&
        publication.lifecycle === 'current',
    ) ?? null
  );
}

function returnCandidateToDraft(
  candidateVersion: KnowledgeVersion,
): Readonly<{
  version: KnowledgeVersion;
  path: readonly KnowledgeVersionLifecycle[];
}> | null {
  const publishing = transitionKnowledgeVersionLifecycle({
    version: candidateVersion,
    to: 'publishing',
  });
  if (!publishing.ok) return null;

  const draft = transitionKnowledgeVersionLifecycle({
    version: publishing.version,
    to: 'draft',
  });
  if (!draft.ok) return null;

  return Object.freeze({
    version: draft.version,
    path: Object.freeze(['draft', 'publishing', 'draft'] as const),
  });
}

function publishCandidate(
  candidateVersion: KnowledgeVersion,
): Readonly<{
  version: KnowledgeVersion;
  path: readonly KnowledgeVersionLifecycle[];
}> | null {
  const publishing = transitionKnowledgeVersionLifecycle({
    version: candidateVersion,
    to: 'publishing',
  });
  if (!publishing.ok) return null;

  const published = transitionKnowledgeVersionLifecycle({
    version: publishing.version,
    to: 'published',
  });
  if (!published.ok) return null;

  return Object.freeze({
    version: published.version,
    path: Object.freeze(['draft', 'publishing', 'published'] as const),
  });
}

function decidePublish(
  state: KnowledgePublicationState,
  command: Extract<KnowledgePublicationCommand, { kind: 'publish' }>,
): KnowledgePublicationDecisionSnapshot {
  if (state.item.lifecycle === 'retired') {
    return failureSnapshot(state, ['item_retired']);
  }

  const candidate = command.candidateVersion;
  if (candidate.lifecycle !== 'draft') {
    return failureSnapshot(state, ['candidate_not_draft'], candidate);
  }
  if (candidate.knowledgeId !== state.item.knowledgeId) {
    return failureSnapshot(state, ['candidate_knowledge_mismatch'], candidate);
  }
  if (
    state.publications.some(
      (publication) => publication.publicationId === command.publicationId,
    )
  ) {
    return failureSnapshot(state, ['publication_id_reused'], candidate);
  }
  if (
    state.publications.some(
      (publication) => publication.versionId === candidate.versionId,
    )
  ) {
    return failureSnapshot(state, ['candidate_version_reused'], candidate);
  }

  const highestPublishedVersion = state.publications.reduce(
    (highest, publication) => Math.max(highest, publication.versionNumber),
    0,
  );
  if (candidate.versionNumber !== highestPublishedVersion + 1) {
    return failureSnapshot(
      state,
      ['candidate_version_not_monotonic'],
      candidate,
    );
  }

  const gateFailureCodes: KnowledgePublicationFailureCode[] = [];
  if (command.gateEvidence.observedManifestHash !== candidate.manifestHash) {
    gateFailureCodes.push('manifest_mismatch');
  }
  if (!command.gateEvidence.parseReady) {
    gateFailureCodes.push('parse_not_ready');
  }
  if (!command.gateEvidence.indexReady) {
    gateFailureCodes.push('index_not_ready');
  }
  if (command.gateEvidence.safetyStatus !== 'allowed') {
    gateFailureCodes.push('safety_not_allowed');
  }
  if (!command.gateEvidence.useScopeEligible) {
    gateFailureCodes.push('use_scope_ineligible');
  }

  if (gateFailureCodes.length > 0) {
    const repaired = returnCandidateToDraft(candidate);
    if (repaired === null) {
      return failureSnapshot(state, ['candidate_not_draft'], candidate);
    }

    return failureSnapshot(
      state,
      gateFailureCodes,
      repaired.version,
      repaired.path,
    );
  }

  const publishedCandidate = publishCandidate(candidate);
  if (publishedCandidate === null) {
    return failureSnapshot(state, ['candidate_not_draft'], candidate);
  }

  const oldCurrent = findCurrentPublication(state);
  const publications = state.publications.map((publication) => {
    if (publication.publicationId !== oldCurrent?.publicationId) {
      return publication;
    }

    return {
      ...publication,
      lifecycle: 'superseded' as const,
    };
  });
  publications.push({
    publicationId: command.publicationId,
    knowledgeId: candidate.knowledgeId,
    versionId: candidate.versionId,
    versionNumber: candidate.versionNumber,
    manifestHash: candidate.manifestHash,
    lifecycle: 'current',
    complete: true,
    safetyStatus: command.gateEvidence.safetyStatus,
    useScope: candidate.metadataSnapshot.useScope,
    publishedAt: command.decidedAt,
    withdrawnAt: null,
  });

  const publicationTransitions: KnowledgePublicationTransition[] = [];
  if (oldCurrent !== null) {
    publicationTransitions.push({
      publicationId: oldCurrent.publicationId,
      path: ['current', 'superseded'],
    });
  }

  return {
    ok: true,
    nextState: {
      item: { ...state.item, revision: state.item.revision + 1 },
      currentPublicationId: command.publicationId,
      publications,
    },
    candidateVersion: publishedCandidate.version,
    candidateLifecyclePath: publishedCandidate.path,
    publicationTransitions,
  };
}

function decideRollback(
  state: KnowledgePublicationState,
  command: Extract<KnowledgePublicationCommand, { kind: 'rollback' }>,
): KnowledgePublicationDecisionSnapshot {
  if (state.item.lifecycle === 'retired') {
    return failureSnapshot(state, ['item_retired']);
  }

  const target = state.publications.find(
    (publication) => publication.publicationId === command.targetPublicationId,
  );
  if (target === undefined) {
    return failureSnapshot(state, ['rollback_target_not_found']);
  }

  const reasonCodes: KnowledgePublicationFailureCode[] = [];
  if (target.lifecycle === 'withdrawn') {
    reasonCodes.push('rollback_target_withdrawn');
  } else if (target.lifecycle !== 'superseded') {
    reasonCodes.push('rollback_target_not_historical');
  }
  if (!target.complete) {
    reasonCodes.push('rollback_target_incomplete');
  }
  if (target.safetyStatus !== 'allowed') {
    reasonCodes.push('rollback_target_unsafe');
  }
  if (reasonCodes.length > 0) {
    return failureSnapshot(state, reasonCodes);
  }

  const oldCurrent = findCurrentPublication(state);
  const publications = state.publications.map((publication) => {
    if (publication.publicationId === target.publicationId) {
      return {
        ...publication,
        lifecycle: 'current' as const,
        withdrawnAt: null,
      };
    }
    if (publication.publicationId === oldCurrent?.publicationId) {
      return {
        ...publication,
        lifecycle: 'superseded' as const,
      };
    }
    return publication;
  });

  const publicationTransitions: KnowledgePublicationTransition[] = [
    {
      publicationId: target.publicationId,
      path: ['superseded', 'current'],
    },
  ];
  if (oldCurrent !== null) {
    publicationTransitions.push({
      publicationId: oldCurrent.publicationId,
      path: ['current', 'superseded'],
    });
  }

  return {
    ok: true,
    nextState: {
      item: { ...state.item, revision: state.item.revision + 1 },
      currentPublicationId: target.publicationId,
      publications,
    },
    candidateVersion: null,
    candidateLifecyclePath: [],
    publicationTransitions,
  };
}

function decideWithdraw(
  state: KnowledgePublicationState,
  command: Extract<KnowledgePublicationCommand, { kind: 'withdraw' }>,
): KnowledgePublicationDecisionSnapshot {
  if (state.item.lifecycle === 'retired') {
    return failureSnapshot(state, ['item_retired']);
  }

  const target = state.publications.find(
    (publication) => publication.publicationId === command.targetPublicationId,
  );
  if (target === undefined) {
    return failureSnapshot(state, ['withdraw_target_not_found']);
  }
  if (target.lifecycle === 'withdrawn') {
    return failureSnapshot(state, ['withdraw_target_already_withdrawn']);
  }

  const publications = state.publications.map((publication) => {
    if (publication.publicationId !== target.publicationId) return publication;

    return {
      ...publication,
      lifecycle: 'withdrawn' as const,
      withdrawnAt: command.decidedAt,
    };
  });
  const withdrewCurrent = state.currentPublicationId === target.publicationId;

  return {
    ok: true,
    nextState: {
      item: { ...state.item, revision: state.item.revision + 1 },
      currentPublicationId: withdrewCurrent
        ? null
        : state.currentPublicationId,
      publications,
    },
    candidateVersion: null,
    candidateLifecyclePath: [],
    publicationTransitions: [
      {
        publicationId: target.publicationId,
        path:
          target.lifecycle === 'current'
            ? ['current', 'withdrawn']
            : ['superseded', 'withdrawn'],
      },
    ],
  };
}

function decideRetire(
  state: KnowledgePublicationState,
): KnowledgePublicationDecisionSnapshot {
  if (state.item.lifecycle === 'retired') {
    return failureSnapshot(state, ['item_already_retired']);
  }

  const oldCurrent = findCurrentPublication(state);
  const publications = state.publications.map((publication) => {
    if (publication.publicationId !== oldCurrent?.publicationId) {
      return publication;
    }

    return {
      ...publication,
      lifecycle: 'superseded' as const,
    };
  });

  return {
    ok: true,
    nextState: {
      item: {
        ...state.item,
        lifecycle: 'retired',
        revision: state.item.revision + 1,
      },
      currentPublicationId: null,
      publications,
    },
    candidateVersion: null,
    candidateLifecyclePath: [],
    publicationTransitions:
      oldCurrent === null
        ? []
        : [
            {
              publicationId: oldCurrent.publicationId,
              path: ['current', 'superseded'],
            },
          ],
  };
}

const idempotencyKeyPattern = /^[A-Za-z][A-Za-z0-9_-]{7,127}$/;

function hasValidCommandBase(command: Record<string, unknown>): boolean {
  return (
    typeof command.idempotencyKey === 'string' &&
    Number.isSafeInteger(command.expectedRevision) &&
    (command.expectedRevision as number) >= 0 &&
    isIsoTimestamp(command.decidedAt)
  );
}

function isValidCommandShape(
  command: unknown,
): command is KnowledgePublicationCommand {
  if (!isRecord(command) || !hasValidCommandBase(command)) return false;

  if (command.kind === 'publish') {
    if (
      !hasExactKeys(command, [
        'kind',
        'idempotencyKey',
        'expectedRevision',
        'decidedAt',
        'publicationId',
        'candidateVersion',
        'gateEvidence',
      ]) ||
      !isReferenceId(command.publicationId) ||
      !isValidKnowledgeVersion(command.candidateVersion) ||
      !isRecord(command.gateEvidence) ||
      !hasExactKeys(command.gateEvidence, [
        'observedManifestHash',
        'parseReady',
        'indexReady',
        'safetyStatus',
        'useScopeEligible',
      ])
    ) {
      return false;
    }

    return (
      typeof command.gateEvidence.observedManifestHash === 'string' &&
      manifestHashPattern.test(command.gateEvidence.observedManifestHash) &&
      typeof command.gateEvidence.parseReady === 'boolean' &&
      typeof command.gateEvidence.indexReady === 'boolean' &&
      isOneOf(command.gateEvidence.safetyStatus, knowledgeSafetyStatuses) &&
      typeof command.gateEvidence.useScopeEligible === 'boolean'
    );
  }

  if (command.kind === 'rollback' || command.kind === 'withdraw') {
    return (
      hasExactKeys(command, [
        'kind',
        'idempotencyKey',
        'expectedRevision',
        'decidedAt',
        'targetPublicationId',
      ]) && isReferenceId(command.targetPublicationId)
    );
  }

  return (
    command.kind === 'retire' &&
    hasExactKeys(command, [
      'kind',
      'idempotencyKey',
      'expectedRevision',
      'decidedAt',
    ])
  );
}

function isValidCandidateReference(
  value: unknown,
): value is KnowledgeCandidateVersionReference {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'knowledgeId',
      'versionId',
      'versionNumber',
      'submittedLifecycle',
      'manifestHash',
      'comparisonVersion',
    ]) &&
    isReferenceId(value.knowledgeId) &&
    isReferenceId(value.versionId) &&
    Number.isSafeInteger(value.versionNumber) &&
    (value.versionNumber as number) > 0 &&
    isOneOf(value.submittedLifecycle, knowledgeVersionLifecycles) &&
    typeof value.manifestHash === 'string' &&
    manifestHashPattern.test(value.manifestHash) &&
    value.comparisonVersion === 1
  );
}

function isValidIdempotencyRecord(
  value: unknown,
): value is KnowledgePublicationIdempotencyRecord {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'knowledgeId',
      'idempotencyKey',
      'payloadFingerprint',
      'submittedCandidateReference',
      'previousState',
    ]) &&
    isReferenceId(value.knowledgeId) &&
    typeof value.idempotencyKey === 'string' &&
    idempotencyKeyPattern.test(value.idempotencyKey) &&
    typeof value.payloadFingerprint === 'string' &&
    (value.submittedCandidateReference === null ||
      isValidCandidateReference(value.submittedCandidateReference)) &&
    isValidState(value.previousState) &&
    value.previousState.item.knowledgeId === value.knowledgeId
  );
}

function blockedDecision(
  state: KnowledgePublicationState,
  reasonCode: KnowledgePublicationFailureCode,
): KnowledgePublicationDecision {
  return Object.freeze({
    ok: false,
    nextState: state,
    candidateVersion: null,
    candidateLifecyclePath: Object.freeze([]),
    publicationTransitions: Object.freeze([]),
    reasonCodes: Object.freeze([reasonCode]),
    idempotentReplay: false,
    shouldApplyNextState: false,
    idempotencyRecord: null,
  });
}

function decideCommandSnapshot(
  state: KnowledgePublicationState,
  command: KnowledgePublicationCommand,
): KnowledgePublicationDecisionSnapshot {
  if (command.expectedRevision !== state.item.revision) {
    return failureSnapshot(state, ['expected_revision_conflict']);
  }
  if (state.item.revision === Number.MAX_SAFE_INTEGER) {
    return failureSnapshot(state, ['revision_overflow']);
  }

  switch (command.kind) {
    case 'publish':
      return decidePublish(state, command);
    case 'rollback':
      return decideRollback(state, command);
    case 'withdraw':
      return decideWithdraw(state, command);
    case 'retire':
      return decideRetire(state);
  }
}

export function decideKnowledgePublication(input: Readonly<{
  state: KnowledgePublicationState;
  command: KnowledgePublicationCommand;
  existingIdempotencyRecord: KnowledgePublicationIdempotencyRecord | null;
  /** Server-authoritative immutable snapshot resolved from the record reference. */
  recordedSubmittedCandidateVersion?: KnowledgeVersion | null;
}>): KnowledgePublicationDecision {
  if (!isValidCommandShape(input.command)) {
    return blockedDecision(input.state, 'command_invalid');
  }

  if (!idempotencyKeyPattern.test(input.command.idempotencyKey)) {
    return blockedDecision(input.state, 'idempotency_key_invalid');
  }

  if (!isValidState(input.state)) {
    return blockedDecision(input.state, 'state_invalid');
  }

  const existingRecord = input.existingIdempotencyRecord;

  if (existingRecord !== null) {
    if (
      isValidIdempotencyRecord(existingRecord) &&
      existingRecord.knowledgeId === input.state.item.knowledgeId &&
      existingRecord.idempotencyKey === input.command.idempotencyKey &&
      existingRecord.previousState.item.knowledgeId ===
        input.state.item.knowledgeId &&
      existingRecord.payloadFingerprint ===
        commandPayloadFingerprint(
          input.command,
          input.state.item.knowledgeId,
          existingRecord.previousState,
        )
    ) {
      const restoredCandidate = restoreRecordedCandidate({
        command: input.command,
        reference: existingRecord.submittedCandidateReference,
        recordedSubmittedCandidateVersion:
          input.recordedSubmittedCandidateVersion ?? null,
      });
      const recordedCandidateVersion = restoredCandidate.ok
        ? restoredCandidate.candidateVersion
        : null;
      if (!restoredCandidate.ok) {
        const conflict = freezeSnapshot(
          failureSnapshot(input.state, ['idempotency_conflict']),
        );
        return resultFromSnapshot(conflict, false, null);
      }

      let recordedCommand: KnowledgePublicationCommand;
      if (input.command.kind === 'publish') {
        if (recordedCandidateVersion === null) {
          const conflict = freezeSnapshot(
            failureSnapshot(input.state, ['idempotency_conflict']),
          );
          return resultFromSnapshot(conflict, false, null);
        }
        recordedCommand = {
          ...input.command,
          candidateVersion: recordedCandidateVersion,
        };
      } else {
        recordedCommand = input.command;
      }
      const recomputedSnapshot = freezeSnapshot(
        decideCommandSnapshot(existingRecord.previousState, recordedCommand),
      );
      if (
        !recomputedSnapshot.ok &&
        recomputedSnapshot.reasonCodes.includes('revision_overflow')
      ) {
        const conflict = freezeSnapshot(
          failureSnapshot(input.state, ['idempotency_conflict']),
        );
        return resultFromSnapshot(conflict, false, null);
      }

      const replaySnapshot = recomputedSnapshot.ok
        ? recomputedSnapshot
        : freezeSnapshot({
            ...recomputedSnapshot,
            nextState: input.state,
            publicationTransitions: [],
          });
      const replayRecord = Object.freeze({
        knowledgeId: existingRecord.knowledgeId,
        idempotencyKey: existingRecord.idempotencyKey,
        payloadFingerprint: existingRecord.payloadFingerprint,
        submittedCandidateReference:
          existingRecord.submittedCandidateReference === null
            ? null
            : freezeCandidateReference(
                existingRecord.submittedCandidateReference,
              ),
        previousState: freezeState(existingRecord.previousState),
      });
      return resultFromSnapshot(replaySnapshot, true, replayRecord);
    }

    const conflict = freezeSnapshot(
      failureSnapshot(input.state, ['idempotency_conflict']),
    );
    return resultFromSnapshot(conflict, false, null);
  }

  const payloadFingerprint = commandPayloadFingerprint(
    input.command,
    input.state.item.knowledgeId,
    input.state,
  );
  const snapshot = decideCommandSnapshot(input.state, input.command);
  if (!snapshot.ok && snapshot.reasonCodes.includes('revision_overflow')) {
    return blockedDecision(input.state, 'revision_overflow');
  }

  return finalizeNewDecision(
    snapshot,
    input.state,
    input.command,
    payloadFingerprint,
  );
}

function unavailable(
  reasonCode: KnowledgeUseAvailabilityReasonCode,
): KnowledgeUseAvailability {
  return Object.freeze({
    canRetrieve: false,
    canAnswer: false,
    canSendAttachment: false,
    reasonCodes: Object.freeze([reasonCode]),
  });
}

export function evaluateKnowledgeUseAvailability(input: Readonly<{
  state: KnowledgePublicationState;
  assetApprovalStatus: KnowledgeAssetApprovalStatus;
}>): KnowledgeUseAvailability {
  if (!isValidState(input.state)) {
    return unavailable('state_invalid');
  }
  if (
    !isOneOf(input.assetApprovalStatus, knowledgeAssetApprovalStatuses)
  ) {
    return unavailable('asset_approval_invalid');
  }
  if (input.state.item.lifecycle === 'retired') {
    return unavailable('item_retired');
  }

  const currentPublication = findCurrentPublication(input.state);
  if (currentPublication === null) {
    return unavailable('current_publication_unavailable');
  }
  if (!currentPublication.complete) {
    return unavailable('publication_incomplete');
  }
  if (currentPublication.safetyStatus !== 'allowed') {
    return unavailable('publication_safety_not_allowed');
  }

  const reasonCodes: KnowledgeUseAvailabilityReasonCode[] = [];
  if (currentPublication.useScope === 'internal_only') {
    reasonCodes.push('use_scope_internal_only');
  }
  if (input.assetApprovalStatus === 'not_approved') {
    reasonCodes.push('asset_not_approved');
  } else if (input.assetApprovalStatus === 'withdrawn') {
    reasonCodes.push('asset_approval_withdrawn');
  } else if (input.assetApprovalStatus === 'blocked') {
    reasonCodes.push('asset_approval_blocked');
  }

  return Object.freeze({
    canRetrieve: true,
    canAnswer: currentPublication.useScope === 'ai_customer_reply',
    canSendAttachment:
      currentPublication.useScope === 'ai_customer_reply' &&
      input.assetApprovalStatus === 'approved',
    reasonCodes: Object.freeze(reasonCodes),
  });
}
