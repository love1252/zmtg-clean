import { createHash } from 'node:crypto';
import { types as nodeTypes } from 'node:util';
export const weComCustomerMappingStatuses = [
    'unmatched',
    'candidate',
    'manual_review_required',
    'conflict',
    'matched',
    'rejected',
    'needs_more_info',
    'stale',
    'disabled',
    'cleared_locked',
] as const;
export const weComCustomerMappingActions = [
    'generate_candidate',
    'approve',
    'reject',
    'request_more_info',
    'mark_conflict',
    'clear_candidate',
    'reopen',
    'expire_candidate',
    'disable_mapping',
] as const;
export type WeComCustomerMappingStatus = (typeof weComCustomerMappingStatuses)[number];
export type WeComCustomerMappingAction = (typeof weComCustomerMappingActions)[number];
export type WeComCustomerMappingReviewerRole = 'domain_system' | 'institution_operator' | 'platform_governance';
export type WeComCustomerMappingSourceKind = 'controlled_mock_fixture' | 'controlled_demo_fixture';
export type WeComCustomerMappingDataMode = 'mock' | 'demo';
export type WeComCustomerMappingReasonCode = 'candidate_evidence_available' | 'low_confidence' | 'mapping_conflict' | 'approved_by_manual_review' | 'rejected_by_manual_review' | 'more_info_requested' | 'candidate_cleared_locked' | 'review_reopened' | 'candidate_expired' | 'mapping_disabled';
export type WeComCustomerMappingEvidence = Readonly<{
    displayNameSimilarity: number;
    remarkSummaryMatched: boolean;
    tagNames: readonly string[];
    sourceTypeMatched: boolean;
    addedAtDateMatched: boolean;
    ownerSummaryMatched: boolean;
    digestMatched: boolean;
    mockCustomerNumberMatched: boolean;
    systemCustomerSummaryMatched: boolean;
}>;
export type WeComCustomerMappingCandidate = Readonly<{
    tenantId: string;
    mappingReference: string;
    candidateVersion: number;
    candidateDigest: string;
    candidatePairDigest: string;
    evidenceFingerprint: string;
    externalContactDigest: string;
    systemCustomerDigest: string;
    mockCustomerNumber: string;
    systemCustomerSummary: string;
    candidateSourceStatus: 'active' | 'inactive' | 'stale' | 'cleared' | 'rejected' | 'conflict_locked';
    evidence: WeComCustomerMappingEvidence;
    confidenceScore: number;
    confidenceLevel: 'low' | 'medium' | 'high';
    candidateActive: boolean;
    candidateCleared: boolean;
    candidateRejected: boolean;
    candidateStale: boolean;
    lineageLocked: boolean;
    unresolvedConflictCount: number;
    createdAt: string;
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
    containsRealCustomerData: false;
    autoMergePerformed: false;
    realCustomerRelationshipWritten: false;
}>;
export type MappingAggregateContext = Readonly<{
    tenantId: string;
    sourceScopeReference: string;
    mappingReference: string;
    aggregateVersion: number;
    mappingStatus: Exclude<WeComCustomerMappingStatus, 'unmatched'>;
    reasonCode: WeComCustomerMappingReasonCode;
    candidateDigest: string | null;
    candidatePairDigest: string;
    evidenceFingerprint: string;
    sourceSnapshotDigest: string;
    fixtureRegistryDigest: string;
    historyDigest: string;
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
    containsRealCustomerData: false;
    autoMergePerformed: false;
    realCustomerRelationshipWritten: false;
    updatedAt: string;
}>;
export type WeComCustomerMappingReview = Readonly<{
    tenantId: string;
    mappingReference: string;
    candidateDigest: string;
    action: Exclude<WeComCustomerMappingAction, 'generate_candidate' | 'disable_mapping'>;
    reviewerRole: Exclude<WeComCustomerMappingReviewerRole, 'domain_system'>;
    mappingStatusBefore: Exclude<WeComCustomerMappingStatus, 'unmatched'>;
    occurredAt: string;
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
}>;
export type WeComCustomerMappingDecision = Readonly<{
    tenantId: string;
    mappingReference: string;
    candidateDigest: string;
    action: Exclude<WeComCustomerMappingAction, 'generate_candidate' | 'disable_mapping'>;
    reviewerRole: Exclude<WeComCustomerMappingReviewerRole, 'domain_system'>;
    mappingStatusBefore: Exclude<WeComCustomerMappingStatus, 'unmatched'>;
    mappingStatusAfter: Exclude<WeComCustomerMappingStatus, 'unmatched'>;
    reasonCode: WeComCustomerMappingReasonCode;
    occurredAt: string;
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
}>;
export type WeComCustomerMappingConflict = Readonly<{
    tenantId: string;
    mappingReference: string;
    candidateDigest: string;
    candidatePairDigest: string;
    evidenceFingerprint: string;
    conflictType: 'multiple_system_customers_for_external_contact' | 'multiple_external_contacts_for_system_customer' | 'manual_marked';
    conflictStatus: 'unresolved_locked' | 'cleared_locked';
    unresolvedConflictCount: number;
    manualReviewRequired: boolean;
    createdAt: string;
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
}>;
export type WeComCustomerMappingAuditEvent = Readonly<{
    tenantId: string;
    eventType: string;
    reviewerRole: WeComCustomerMappingReviewerRole;
    action: WeComCustomerMappingAction | 'input_blocked';
    reasonCode: string;
    mappingStatusBefore: WeComCustomerMappingStatus | 'not_evaluated';
    mappingStatusAfter: WeComCustomerMappingStatus | 'not_evaluated';
    candidateDigest: string;
    timestamp: string;
    sourceKind: WeComCustomerMappingSourceKind | 'input_blocked';
    dataMode: WeComCustomerMappingDataMode | 'input_blocked';
}>;
export type MappingHistoryEntry = Readonly<{
    tenantId: string;
    sourceScopeReference: string;
    mappingReference: string;
    historySequence: number;
    aggregateVersionBefore: number;
    aggregateVersionAfter: number;
    action: WeComCustomerMappingAction;
    reviewerRole: WeComCustomerMappingReviewerRole;
    mappingStatusBefore: WeComCustomerMappingStatus;
    mappingStatusAfter: Exclude<WeComCustomerMappingStatus, 'unmatched'>;
    reasonCode: WeComCustomerMappingReasonCode;
    targetSnapshotPhase: 'after' | 'none';
    targetSnapshot: WeComCustomerMappingCandidate | null;
    occurredAt: string;
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
}>;
export type MappingHistory = Readonly<{
    tenantId: string;
    sourceScopeReference: string;
    mappingReference: string;
    historyVersion: number;
    historyDigest: string;
    complete: true;
    entries: readonly MappingHistoryEntry[];
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
}>;
export type LineageLockRecord = Readonly<{
    tenantId: string;
    sourceScopeReference: string;
    mappingReference: string;
    candidateDigest: string;
    externalContactDigest: string;
    systemCustomerDigest: string;
    candidatePairDigest: string;
    evidenceFingerprint: string;
    sourceSnapshotDigest: string;
    lockType: 'conflict' | 'clearance';
    conflictOrigin?: 'generation_multiple_system_customers' | 'generation_multiple_external_contacts' | 'manual_review_mark_conflict';
    conflictType?: WeComCustomerMappingConflict['conflictType'];
    unresolvedConflictCount: number;
    createdAt: string;
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
}>;
export type LineageLockIndex = Readonly<{
    tenantId: string;
    sourceScopeReference: string;
    indexVersion: number;
    indexDigest: string;
    complete: true;
    records: readonly LineageLockRecord[];
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
}>;
export type SourceScopeAggregateRecord = Readonly<{
    manifestEntryReference: string;
    candidatePairDigest: string;
    evidenceFingerprint: string;
    mappingReference: string;
    mappingStatus: Exclude<WeComCustomerMappingStatus, 'unmatched'>;
    aggregateVersion: number;
    candidateDigest: string | null;
    historyDigest: string;
}>;
export type SourceScopeRuntimeIndex = Readonly<{
    tenantId: string;
    sourceScopeReference: string;
    fixtureRegistryDigest: string;
    candidateManifestDigest: string;
    indexVersion: number;
    indexDigest: string;
    indexSnapshotComplete: true;
    generationCursor: number;
    generationComplete: boolean;
    records: readonly SourceScopeAggregateRecord[];
    lineageLockIndex: LineageLockIndex;
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
}>;
export type SourceScopeMappingState = Readonly<{
    aggregate: MappingAggregateContext;
    target: WeComCustomerMappingCandidate | null;
    history: MappingHistory;
}>;
export type SourceScopeRuntimeState = Readonly<{
    stateKind: 'source_scope_runtime';
    sourceScopeRuntimeIndex: SourceScopeRuntimeIndex;
    mappings: readonly SourceScopeMappingState[];
}>;
export type MappingCommittedResult = Readonly<{
    ok: true;
    action: WeComCustomerMappingAction;
    resultKind: 'candidate_generated' | 'manual_review_requested' | 'conflict_detected' | 'no_candidate' | 'review_committed' | 'mapping_disabled';
    nextState: SourceScopeRuntimeState;
    mappingReview: WeComCustomerMappingReview | null;
    mappingDecision: WeComCustomerMappingDecision | null;
    mappingConflict: WeComCustomerMappingConflict | null;
    auditEvent: WeComCustomerMappingAuditEvent;
}>;
export type MappingBlockedResult = Readonly<{
    ok: false;
    auditEvent: WeComCustomerMappingAuditEvent;
}>;
export type MappingCommandResult = MappingCommittedResult | MappingBlockedResult;
export type MappingDomainInitializationBlocked = Readonly<{
    ok: false;
    reasonCode: 'fixture_registry_initialization_blocked';
}>;
export type WeComCustomerMappingDomain = Readonly<{
    generateCandidate(rawCommand: unknown, state: unknown): MappingCommandResult;
    reviewCandidate(rawCommand: unknown, state: unknown): MappingCommandResult;
    disableMapping(rawCommand: unknown, state: unknown): MappingCommandResult;
}>;
type SafeRecord = Record<string, unknown>;
type ParseFailure = Readonly<{
    eventType: string;
    reasonCode: string;
}>;
type CaptureResult = {
    ok: true;
    value: unknown;
} | {
    ok: false;
};
type SensitiveSemantic = 'ordinary' | 'raw_digest' | 'trusted_digest' | 'raw_mapping_reference' | 'trusted_mapping_reference';
type ExternalContact = {
    tenantId: string;
    externalContactReference: string;
    displayName: string;
    externalUserIdDigest: string;
    followUsers: Array<{
        tenantId: string;
        followUserReference: string;
        displayName: string;
        followUserIdDigest: string;
        ownershipStatus: 'active' | 'inactive';
        institutionSummary: string;
        dataMode: WeComCustomerMappingDataMode;
        containsRealCustomerData: false;
    }>;
    tags: Array<{
        tenantId: string;
        tagReference: string;
        tagIdDigest: string;
        tagName: string;
        sourceType: 'mock_enterprise' | 'demo_enterprise';
        tagStatus: 'active' | 'inactive';
        dataMode: WeComCustomerMappingDataMode;
        containsRealCustomerData: false;
    }>;
    sourceType: 'qr_code' | 'employee_share' | 'group_chat' | 'other_mock';
    addedAtDate: string;
    remarkSummary: string;
    sourceMappingStatus: 'unmatched' | 'candidate' | 'matched' | 'conflict' | 'rejected' | 'manual_review_required';
    lastSyncedAt: string | null;
    syncStatus: 'not_started' | 'mock_ready' | 'preflight_ready' | 'syncing_disabled' | 'sync_failed' | 'manual_review_required';
    manualReviewState: 'not_required' | 'pending' | 'approved' | 'rejected' | 'needs_more_info';
    dataMode: WeComCustomerMappingDataMode;
    containsRealCustomerData: false;
    fieldWhitelistApplied: true;
};
type SystemCustomer = {
    tenantId: string;
    customerReference: string;
    mockCustomerNumber: string;
    displayNameSummary: string;
    remarkSummary: string;
    tagNames: string[];
    sourceType: ExternalContact['sourceType'];
    addedAtDate: string;
    ownerSummary: string;
    customerDigest: string;
    statusSummary: 'active' | 'inactive' | 'manual_review_required';
    dataMode: WeComCustomerMappingDataMode;
    containsRealCustomerData: false;
    fieldWhitelistApplied: true;
};
type FixtureReadiness = {
    tenantId: string;
    authorizationReference: string;
    corpIdDigest: string;
    authorizationStatus: 'not_configured' | 'authorized' | 'revoked' | 'expired' | 'disabled' | 'external_disabled' | 'manual_review_required';
    providerState: 'mock_only' | 'disabled' | 'external_disabled';
    authorizedAtDate: string | null;
    expiresAtDate: string | null;
    manualReviewState: 'not_required' | 'pending' | 'approved' | 'rejected' | 'needs_more_info';
    lastPreflightAt: string | null;
    syncStatus: ExternalContact['syncStatus'];
    auditReady: boolean;
    dataMode: WeComCustomerMappingDataMode;
    containsRealCustomerData: false;
};
type CandidateManifestEntry = {
    manifestEntryReference: string;
    externalContactDigest: string;
    systemCustomerDigest: string;
    mockCustomerNumberLinked: boolean;
    expectedEvidenceFingerprint: string;
};
type CandidateManifest = {
    tenantId: string;
    sourceScopeReference: string;
    sourceSnapshotDigest: string;
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
    entries: CandidateManifestEntry[];
    containsRealCustomerData: false;
    fieldWhitelistApplied: true;
    candidateManifestDigest: string;
};
type FixtureRegistryEntry = {
    tenantId: string;
    fixtureRegistryDigest: string;
    sourceScopeReference: string;
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
    externalContactsDigest: string;
    systemCustomersDigest: string;
    sourceSnapshotDigest: string;
    candidateManifestDigest: string;
};
type FixtureBundle = {
    tenantId: string;
    sourceScopeReference: string;
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
    externalContacts: ExternalContact[];
    systemCustomers: SystemCustomer[];
    manifestEntries: CandidateManifestEntry[];
    candidateManifest: CandidateManifest;
    registryEntry: FixtureRegistryEntry;
    externalContactsDigest: string;
    systemCustomersDigest: string;
    sourceSnapshotDigest: string;
    candidateManifestDigest: string;
    fixtureRegistryDigest: string;
    readiness: FixtureReadiness;
};
type ParsedGenerationCommand = {
    tenantId: string;
    action: 'generate_candidate';
    manifestEntryReference: string | null;
    externalContacts: ExternalContact[];
    systemCustomers: SystemCustomer[];
    occurredAt: string;
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
    containsRealCustomerData: false;
};
type ParsedReviewCommand = {
    tenantId: string;
    mappingReference: string;
    candidateDigest: string;
    action: Exclude<WeComCustomerMappingAction, 'generate_candidate' | 'disable_mapping'>;
    reviewerRole: Exclude<WeComCustomerMappingReviewerRole, 'domain_system'>;
    occurredAt: string;
};
type ParsedDisableCommand = {
    tenantId: string;
    mappingReference: string;
    action: 'disable_mapping';
    reviewerRole: Exclude<WeComCustomerMappingReviewerRole, 'domain_system'>;
    occurredAt: string;
};
const BLOCKED_TENANT = 'tenant_blocked';
const BLOCKED_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const ZERO_DIGEST = `sha256:${'0'.repeat(64)}`;
const MAX_VERSION = 2147483647;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MAPPING_REFERENCE_PATTERN = /^ref-(mock|demo)-[0-9a-f]{48}$/u;
const GENERAL_REFERENCE_PATTERN = /^ref-(mock|demo)-[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){1,46}[a-z0-9]$/u;
const mapGetIntrinsic = Map.prototype.get;
const mapSetIntrinsic = Map.prototype.set;
const mapForEachIntrinsic = Map.prototype.forEach;
const MapIntrinsic = Map;
const reflectApplyIntrinsic = Reflect.apply;
const reflectDefinePropertyIntrinsic = Reflect.defineProperty;
const objectPreventExtensionsIntrinsic = Object.preventExtensions;
const normalizeIntrinsic = String.prototype.normalize;
const objectFreezeIntrinsic = Object.freeze;
const objectIsFrozenIntrinsic = Object.isFrozen;
const arrayMapIntrinsic = Array.prototype.map;
const arrayFlatMapIntrinsic = Array.prototype.flatMap;
const arrayReduceIntrinsic = Array.prototype.reduce;
const arrayFilterIntrinsic = Array.prototype.filter;
const arrayFindIntrinsic = Array.prototype.find;
const arrayFindIndexIntrinsic = Array.prototype.findIndex;
const arraySomeIntrinsic = Array.prototype.some;
const arrayEveryIntrinsic = Array.prototype.every;
const arraySortIntrinsic = Array.prototype.sort;
const arrayReverseIntrinsic = Array.prototype.reverse;
const arrayAtIntrinsic = Array.prototype.at;
const isProxyIntrinsic = nodeTypes.isProxy;
const EXPECTED_REGISTRY_DIGESTS = new MapIntrinsic<string, readonly [
    string,
    string
]>([
    ['tenant-demo-001', [
            'sha256:514efd01382a3fc86ebf5c656bbbc768fcfb8cb675024eed70c30528f96b1932',
            'sha256:5fa5ce0b6760b5a12708f51b1d258a403810752e3a9fcfdf029b5796d914b3f8',
        ]],
    ['tenant-mock-001', [
            'sha256:b8fea9b5925d84a32f82c25c2aa03b552a1bca0e58312de3fea6e810183df617',
            'sha256:d8f0b88660fdcce23e6f8547b16a7dfbfca18945800810541d5e78ccc1273d75',
        ]],
    ['tenant-mock-002', [
            'sha256:6d04c3172c4c1e74cafa8de1114a8286e31bafa910bff4a3d4de097020f2040f',
            'sha256:a7300eae94e713ea1d4af593f87755771684d9c1b03185256f73e3d85820afae',
        ]],
    ['tenant-mock-003', [
            'sha256:87c99c6fbfbc70769a41e2c6208e4efdb665b7acb66f951cb72a1022405208bc',
            'sha256:0f87c5aad527abc7e68c3a6b162c8127337ca3c38ebc4b2eee5df9bcf4ace2c1',
        ]],
    ['tenant-mock-004', [
            'sha256:948466e225397619299882d351feb3ddeef6a546ae81bf3ecb7c19b1b3a6a0f8',
            'sha256:7630acae9cd5a179179de1038af145dd31182b320f39375731d4bfa02d89975e',
        ]],
    ['tenant-mock-005', [
            'sha256:c3e57914a9e30a7f0606ad841e1567e7b1b8e559c7a0d79f573a44d686837b2b',
            'sha256:c4b1a5180c2d766e9d9bf9d1c8357f3d8391340760b24000cb5aae987c3a27d9',
        ]],
    ['tenant-mock-006', [
            'sha256:927354845043164fdef139a3e34a14d1f60ea8c3a9de4c4a3cc7a7f4d3e507d0',
            'sha256:25b1492b7345ea6025d2dc023872a1a129024202b410c48fc382c03f208b2065',
        ]],
]);
const MANIFEST_KEYS = [
    'tenantId',
    'sourceScopeReference',
    'sourceSnapshotDigest',
    'sourceKind',
    'dataMode',
    'entries',
    'containsRealCustomerData',
    'fieldWhitelistApplied',
    'candidateManifestDigest',
] as const;
const REGISTRY_ENTRY_KEYS = [
    'tenantId',
    'fixtureRegistryDigest',
    'sourceScopeReference',
    'sourceKind',
    'dataMode',
    'externalContactsDigest',
    'systemCustomersDigest',
    'sourceSnapshotDigest',
    'candidateManifestDigest',
] as const;
const MANIFEST_ENTRY_KEYS = [
    'manifestEntryReference',
    'externalContactDigest',
    'systemCustomerDigest',
    'mockCustomerNumberLinked',
    'expectedEvidenceFingerprint',
] as const;
const GENERATION_KEYS = [
    'tenantId',
    'action',
    'manifestEntryReference',
    'externalContacts',
    'systemCustomers',
    'occurredAt',
    'sourceKind',
    'dataMode',
    'containsRealCustomerData',
] as const;
const REVIEW_KEYS = [
    'tenantId',
    'mappingReference',
    'candidateDigest',
    'action',
    'reviewerRole',
    'occurredAt',
] as const;
const DISABLE_KEYS = [
    'tenantId',
    'mappingReference',
    'action',
    'reviewerRole',
    'occurredAt',
] as const;
const CONTACT_KEYS = [
    'tenantId',
    'externalContactReference',
    'displayName',
    'externalUserIdDigest',
    'followUsers',
    'tags',
    'sourceType',
    'addedAtDate',
    'remarkSummary',
    'sourceMappingStatus',
    'lastSyncedAt',
    'syncStatus',
    'manualReviewState',
    'dataMode',
    'containsRealCustomerData',
    'fieldWhitelistApplied',
] as const;
const FOLLOW_USER_KEYS = [
    'tenantId',
    'followUserReference',
    'displayName',
    'followUserIdDigest',
    'ownershipStatus',
    'institutionSummary',
    'dataMode',
    'containsRealCustomerData',
] as const;
const TAG_KEYS = [
    'tenantId',
    'tagReference',
    'tagIdDigest',
    'tagName',
    'sourceType',
    'tagStatus',
    'dataMode',
    'containsRealCustomerData',
] as const;
const CUSTOMER_KEYS = [
    'tenantId',
    'customerReference',
    'mockCustomerNumber',
    'displayNameSummary',
    'remarkSummary',
    'tagNames',
    'sourceType',
    'addedAtDate',
    'ownerSummary',
    'customerDigest',
    'statusSummary',
    'dataMode',
    'containsRealCustomerData',
    'fieldWhitelistApplied',
] as const;
const EVIDENCE_KEYS = [
    'displayNameSimilarity',
    'remarkSummaryMatched',
    'tagNames',
    'sourceTypeMatched',
    'addedAtDateMatched',
    'ownerSummaryMatched',
    'digestMatched',
    'mockCustomerNumberMatched',
    'systemCustomerSummaryMatched',
] as const;
const TARGET_KEYS = [
    'tenantId',
    'mappingReference',
    'candidateVersion',
    'candidateDigest',
    'candidatePairDigest',
    'evidenceFingerprint',
    'externalContactDigest',
    'systemCustomerDigest',
    'mockCustomerNumber',
    'systemCustomerSummary',
    'candidateSourceStatus',
    'evidence',
    'confidenceScore',
    'confidenceLevel',
    'candidateActive',
    'candidateCleared',
    'candidateRejected',
    'candidateStale',
    'lineageLocked',
    'unresolvedConflictCount',
    'createdAt',
    'sourceKind',
    'dataMode',
    'containsRealCustomerData',
    'autoMergePerformed',
    'realCustomerRelationshipWritten',
] as const;
const AGGREGATE_KEYS = [
    'tenantId',
    'sourceScopeReference',
    'mappingReference',
    'aggregateVersion',
    'mappingStatus',
    'reasonCode',
    'candidateDigest',
    'candidatePairDigest',
    'evidenceFingerprint',
    'sourceSnapshotDigest',
    'fixtureRegistryDigest',
    'historyDigest',
    'sourceKind',
    'dataMode',
    'containsRealCustomerData',
    'autoMergePerformed',
    'realCustomerRelationshipWritten',
    'updatedAt',
] as const;
const HISTORY_KEYS = [
    'tenantId',
    'sourceScopeReference',
    'mappingReference',
    'historyVersion',
    'historyDigest',
    'complete',
    'entries',
    'sourceKind',
    'dataMode',
] as const;
const HISTORY_ENTRY_KEYS = [
    'tenantId',
    'sourceScopeReference',
    'mappingReference',
    'historySequence',
    'aggregateVersionBefore',
    'aggregateVersionAfter',
    'action',
    'reviewerRole',
    'mappingStatusBefore',
    'mappingStatusAfter',
    'reasonCode',
    'targetSnapshotPhase',
    'targetSnapshot',
    'occurredAt',
    'sourceKind',
    'dataMode',
] as const;
const RUNTIME_STATE_KEYS = ['stateKind', 'sourceScopeRuntimeIndex', 'mappings'] as const;
const RUNTIME_INDEX_KEYS = [
    'tenantId',
    'sourceScopeReference',
    'fixtureRegistryDigest',
    'candidateManifestDigest',
    'indexVersion',
    'indexDigest',
    'indexSnapshotComplete',
    'generationCursor',
    'generationComplete',
    'records',
    'lineageLockIndex',
    'sourceKind',
    'dataMode',
] as const;
const SCOPE_RECORD_KEYS = [
    'manifestEntryReference',
    'candidatePairDigest',
    'evidenceFingerprint',
    'mappingReference',
    'mappingStatus',
    'aggregateVersion',
    'candidateDigest',
    'historyDigest',
] as const;
const MAPPING_STATE_KEYS = ['aggregate', 'target', 'history'] as const;
const READINESS_KEYS = [
    'tenantId',
    'authorizationReference',
    'corpIdDigest',
    'authorizationStatus',
    'providerState',
    'authorizedAtDate',
    'expiresAtDate',
    'manualReviewState',
    'lastPreflightAt',
    'syncStatus',
    'auditReady',
    'dataMode',
    'containsRealCustomerData',
] as const;
const LINEAGE_INDEX_KEYS = [
    'tenantId',
    'sourceScopeReference',
    'indexVersion',
    'indexDigest',
    'complete',
    'records',
    'sourceKind',
    'dataMode',
] as const;
const CLEARANCE_LOCK_KEYS = [
    'tenantId',
    'sourceScopeReference',
    'mappingReference',
    'candidateDigest',
    'externalContactDigest',
    'systemCustomerDigest',
    'candidatePairDigest',
    'evidenceFingerprint',
    'sourceSnapshotDigest',
    'lockType',
    'unresolvedConflictCount',
    'createdAt',
    'sourceKind',
    'dataMode',
] as const;
const CONFLICT_LOCK_KEYS = [
    'tenantId',
    'sourceScopeReference',
    'mappingReference',
    'candidateDigest',
    'externalContactDigest',
    'systemCustomerDigest',
    'candidatePairDigest',
    'evidenceFingerprint',
    'sourceSnapshotDigest',
    'lockType',
    'conflictOrigin',
    'conflictType',
    'unresolvedConflictCount',
    'createdAt',
    'sourceKind',
    'dataMode',
] as const;
const REVIEW_OUTPUT_KEYS = [
    'tenantId',
    'mappingReference',
    'candidateDigest',
    'action',
    'reviewerRole',
    'mappingStatusBefore',
    'occurredAt',
    'sourceKind',
    'dataMode',
] as const;
const DECISION_OUTPUT_KEYS = [
    'tenantId',
    'mappingReference',
    'candidateDigest',
    'action',
    'reviewerRole',
    'mappingStatusBefore',
    'mappingStatusAfter',
    'reasonCode',
    'occurredAt',
    'sourceKind',
    'dataMode',
] as const;
const CONFLICT_OUTPUT_KEYS = [
    'tenantId',
    'mappingReference',
    'candidateDigest',
    'candidatePairDigest',
    'evidenceFingerprint',
    'conflictType',
    'conflictStatus',
    'unresolvedConflictCount',
    'manualReviewRequired',
    'createdAt',
    'sourceKind',
    'dataMode',
] as const;
const AUDIT_KEYS = [
    'tenantId',
    'eventType',
    'reviewerRole',
    'action',
    'reasonCode',
    'mappingStatusBefore',
    'mappingStatusAfter',
    'candidateDigest',
    'timestamp',
    'sourceKind',
    'dataMode',
] as const;
const forbiddenKeyTokens = new Set([
    'accesstoken',
    'accesskey',
    'refreshtoken',
    'token',
    'secret',
    'corpsecret',
    'credential',
    'password',
    'cookie',
    'authorizationheader',
    'sessionkey',
    'sessionsecret',
    'webhookkey',
    'webhooksecret',
    'encodingaeskey',
    'archivekey',
    'archivesecret',
    'apikey',
    'privatekey',
    'externaluserid',
    'userid',
    'followuserid',
    'corpuserid',
    'mobile',
    'mobilenumber',
    'phone',
    'phonenumber',
    'tel',
    'idcard',
    'identitynumber',
    'email',
    'rawresponse',
    'rawpayload',
    'webhookpayload',
    'apiresponse',
    'providerresponse',
    'originalresponse',
    'payload',
    'chatcontent',
    'conversationcontent',
    'messagecontent',
    'sessionarchive',
    'chatdata',
    'messagedata',
    'msgdata',
    'archivecontent',
    'conversationarchive',
]);
const initializationBlocked = objectFreezeIntrinsic({
    ok: false as const,
    reasonCode: 'fixture_registry_initialization_blocked' as const,
});
const fallbackAuditEvent = objectFreezeIntrinsic(Object.assign(Object.create(null), {
    tenantId: BLOCKED_TENANT,
    eventType: 'mapping_audit_not_ready_blocked',
    reviewerRole: 'domain_system',
    action: 'input_blocked',
    reasonCode: 'audit_not_ready',
    mappingStatusBefore: 'not_evaluated',
    mappingStatusAfter: 'not_evaluated',
    candidateDigest: ZERO_DIGEST,
    timestamp: BLOCKED_TIMESTAMP,
    sourceKind: 'input_blocked',
    dataMode: 'input_blocked',
})) as WeComCustomerMappingAuditEvent;
function makeRecord<T extends object>(entries: readonly (readonly [
    string,
    unknown
])[]): T {
    const result = Object.create(null) as SafeRecord;
    for (const [key, value] of entries) {
        Object.defineProperty(result, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true,
        });
    }
    return result as T;
}
function recordFrom<T extends object>(value: T, keys: readonly (keyof T & string)[]): T {
    return makeRecord<T>(intrinsicMap(keys, (key) => [key, value[key]]));
}
function isSafeRecord(value: unknown): value is SafeRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isWellFormedUnicode(value: string) {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (next < 0xdc00 || next > 0xdfff)
                return false;
            index += 1;
        }
        else if (code >= 0xdc00 && code <= 0xdfff) {
            return false;
        }
    }
    return true;
}
function normalizeNfkc(value: string) {
    return reflectApplyIntrinsic(normalizeIntrinsic, value, ['NFKC']) as string;
}
function normalizationIntrinsicValid() {
    const vectors = [
        ['ＡＰＩ．ＫＥＹ', 'API.KEY'],
        ['①', '1'],
        ['Å', 'Å'],
        ['ﬁ', 'fi'],
        ['ｐｈｏｎｅ＝１３８００１３８０００', 'phone=13800138000'],
    ] as const;
    try {
        return intrinsicEvery(vectors, ([input, expected]) => normalizeNfkc(input) === expected);
    }
    catch {
        return false;
    }
}
function canonicalKey(value: string) {
    if (!isWellFormedUnicode(value))
        return null;
    const normalized = normalizeNfkc(value).toLowerCase();
    if (!/^[a-z][a-z0-9._-]{0,63}$/u.test(normalized))
        return null;
    return normalized.replace(/[._-]/gu, '');
}
function isForbiddenKey(value: string) {
    const canonical = canonicalKey(value);
    return canonical !== null && forbiddenKeyTokens.has(canonical);
}
function containsLineSeparator(value: string) {
    return value.includes('\n') || value.includes('\r') || value.includes(' ') || value.includes(' ');
}
function containsControl(value: string) {
    for (const character of value) {
        const code = character.codePointAt(0) ?? 0;
        if (code === 0 || code < 0x20 || (code >= 0x7f && code <= 0x9f))
            return true;
    }
    return false;
}
function sensitiveValue(value: string, semantic: SensitiveSemantic = 'ordinary') {
    if (!isWellFormedUnicode(value))
        return false;
    const normalized = normalizeNfkc(value);
    const decoded = normalized.replace(/%([0-7][0-9a-f])/giu, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
    const views = intrinsicMap([normalized, decoded], (item) => item.toLowerCase());
    const rawMarker = /(?:^|[^a-z0-9_])(?:raw[._-]?(?:response|payload)|webhook[._-]?payload|api[._-]?response|provider[._-]?response|original[._-]?response)(?:$|[^a-z0-9_])/u;
    const conversation = /(?:聊天内容|会话内容(?:存档)?|会话存档|(?:^|[^a-z0-9_])(?:chat[._-]?content|conversation[._-]?content|message[._-]?content|session[._-]?archive|chat[._-]?data|msg[._-]?data)(?:$|[^a-z0-9_]))/u;
    const credential = /(?:^|[^a-z0-9_])(?:access[._-]?token|corp[._-]?secret|encoding[._-]?aes[._-]?key|secret|credential|password|cookie|authorization)(?:$|[^a-z0-9_])/u;
    const rawIdentifier = /(?:^|[^a-z0-9_])(?:external[._-]?user[._-]?id|follow[._-]?user[._-]?id|corp[._-]?user[._-]?id|user[._-]?id)(?:$|[^a-z0-9_])|(?:wm_|wo_)[a-z0-9._:@-]{3,128}/u;
    const assignment = /(?:^|[?&#;, \t\r\n\f{[(])['"]?([a-z][a-z0-9._-]{0,63})['"]?[ \t]*[:=]/gu;
    for (const view of views) {
        const trimmed = view.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']')))
            return true;
        if (rawMarker.test(view) || conversation.test(view) || credential.test(view) || rawIdentifier.test(view)) {
            return true;
        }
        assignment.lastIndex = 0;
        let assignmentMatch = assignment.exec(view);
        while (assignmentMatch) {
            const key = canonicalKey(assignmentMatch[1]);
            if (key !== null && forbiddenKeyTokens.has(key))
                return true;
            assignmentMatch = assignment.exec(view);
        }
        if (/(?:^|[^a-z0-9_-])(?:sk|pk)-[a-z0-9_-]{8,}(?:$|[^a-z0-9_-])/u.test(view) ||
            /(?:^|[^a-z0-9_])bearer[ \t]+[a-z0-9._~+/-]{8,}/u.test(view) ||
            /(?:^|[^a-z0-9_])(?:wm_|wo_)[a-z0-9._:@-]{3,128}/u.test(view))
            return true;
        const dottedAtoms = view.match(/[a-z0-9_-]+(?:\.[a-z0-9_-]*)+/gu) ?? [];
        if (intrinsicSome(dottedAtoms, (atom) => atom.split('.').length === 3 || atom.split('.').length === 5))
            return true;
        if (/[\p{L}\p{M}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\p{M}\p{N}.!#$%&'*+/=?^_`{|}~@-]+/u.test(view)) {
            return true;
        }
    }
    const digestMayMask = semantic !== 'ordinary' && DIGEST_PATTERN.test(value);
    const referenceMayMask = (semantic === 'raw_mapping_reference' || semantic === 'trusted_mapping_reference') &&
        MAPPING_REFERENCE_PATTERN.test(value);
    if (!digestMayMask && !referenceMayMask) {
        if (/(?:^|\D)(?:\+?86[ -]?)?1[3-9](?:[ -]?\d){9}(?:\D|$)/u.test(normalized) ||
            /(?:^|\D)(?:\d{15}|\d{17}[0-9xX])(?:\D|$)/u.test(normalized))
            return true;
    }
    return false;
}
function capturePublic(value: unknown, registered: WeakSet<object>): CaptureResult {
    const seen = new WeakSet<object>();
    let nodes = 0;
    let stringUnits = 0;
    const visit = (current: unknown, depth: number): CaptureResult => {
        nodes += 1;
        if (nodes > 500000 || depth > 64)
            return { ok: false };
        if (typeof current === 'string') {
            stringUnits += current.length;
            if (current.length > 4096 || stringUnits > 2000000)
                return { ok: false };
            return { ok: true, value: current };
        }
        if (current === null || typeof current === 'boolean' || typeof current === 'number') {
            return { ok: true, value: current };
        }
        if (typeof current !== 'object')
            return { ok: false };
        if (isProxyIntrinsic(current))
            return { ok: false };
        if (seen.has(current))
            return { ok: false };
        seen.add(current);
        const array = Array.isArray(current);
        const prototype = Object.getPrototypeOf(current);
        if (array ? prototype !== Array.prototype : prototype !== Object.prototype &&
            !(prototype === null && registered.has(current)))
            return { ok: false };
        const ownKeys = Reflect.ownKeys(current);
        if (intrinsicSome(ownKeys, (key) => typeof key === 'symbol'))
            return { ok: false };
        if (array) {
            if (current.length > 2000)
                return { ok: false };
            const expected = Array.from({ length: current.length }, (_, index) => String(index));
            const actual = intrinsicFilter(ownKeys, (key): key is string => key !== 'length' && typeof key === 'string');
            if (actual.length !== expected.length || intrinsicSome(actual, (key, index) => key !== expected[index])) {
                return { ok: false };
            }
            const output: unknown[] = [];
            for (let index = 0; index < current.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
                if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
                    return { ok: false };
                const captured = visit(descriptor.value, depth + 1);
                if (!captured.ok)
                    return captured;
                output.push(captured.value);
            }
            return { ok: true, value: output };
        }
        if (ownKeys.length > 64)
            return { ok: false };
        const output = Object.create(null) as SafeRecord;
        for (const key of ownKeys as string[]) {
            stringUnits += key.length;
            if (stringUnits > 2000000)
                return { ok: false };
            const descriptor = Object.getOwnPropertyDescriptor(current, key);
            if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
                return { ok: false };
            const captured = visit(descriptor.value, depth + 1);
            if (!captured.ok)
                return captured;
            Object.defineProperty(output, key, {
                value: captured.value,
                enumerable: true,
                configurable: true,
                writable: true,
            });
        }
        return { ok: true, value: output };
    };
    return visit(value, 1);
}
function captureGenerationIndex(value: unknown, registered: WeakSet<object>): {
    ok: true;
    index: SourceScopeRuntimeIndex;
} | {
    ok: false;
} {
    const dataValue = (current: object, key: string) => {
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        return descriptor && descriptor.enumerable && 'value' in descriptor
            ? { ok: true as const, value: descriptor.value }
            : { ok: false as const };
    };
    if (typeof value !== 'object' || value === null || isProxyIntrinsic(value) || Array.isArray(value) ||
        !(Object.getPrototypeOf(value) === Object.prototype ||
            (Object.getPrototypeOf(value) === null && registered.has(value))) ||
        !hasExactKeysInOrder(value as SafeRecord, RUNTIME_STATE_KEYS))
        return { ok: false };
    const stateKind = dataValue(value, 'stateKind');
    const rawIndex = dataValue(value, 'sourceScopeRuntimeIndex');
    const rawMappings = dataValue(value, 'mappings');
    if (!stateKind.ok || stateKind.value !== 'source_scope_runtime' || !rawIndex.ok || !rawMappings.ok ||
        !Array.isArray(rawMappings.value) || isProxyIntrinsic(rawMappings.value) ||
        Object.getPrototypeOf(rawMappings.value) !== Array.prototype || rawMappings.value.length > 100) {
        return { ok: false };
    }
    const mappingKeys = Reflect.ownKeys(rawMappings.value);
    const expectedMappingKeys = [
        ...Array.from({ length: rawMappings.value.length }, (_, index) => String(index)),
        'length',
    ];
    if (mappingKeys.length !== expectedMappingKeys.length || intrinsicSome(mappingKeys, (key, index) => key !== expectedMappingKeys[index]))
        return { ok: false };
    const captured = capturePublic(rawIndex.value, registered);
    if (!captured.ok || !isSafeRecord(captured.value) ||
        !hasExactKeysInOrder(captured.value, RUNTIME_INDEX_KEYS))
        return { ok: false };
    for (const key of RUNTIME_INDEX_KEYS) {
        const field = captured.value[key];
        if (typeof field === 'string') {
            const semantic = key.endsWith('Digest') ? 'trusted_digest' as const : 'ordinary' as const;
            if (sensitiveValue(field, semantic))
                return { ok: false };
        }
    }
    const raw = captured.value;
    if (!isTenantId(raw.tenantId) || !isGeneralReference(raw.sourceScopeReference) ||
        !isDigest(raw.fixtureRegistryDigest) || !isDigest(raw.candidateManifestDigest) ||
        !isInteger(raw.indexVersion, 1, MAX_VERSION) || !isDigest(raw.indexDigest) ||
        raw.indexSnapshotComplete !== true || !isInteger(raw.generationCursor, 0, 100) ||
        typeof raw.generationComplete !== 'boolean' || !Array.isArray(raw.records) ||
        !intrinsicEvery(raw.records, parseScopeRecord) || !parseLineageIndex(raw.lineageLockIndex) ||
        !['controlled_mock_fixture', 'controlled_demo_fixture'].includes(String(raw.sourceKind)) ||
        !['mock', 'demo'].includes(String(raw.dataMode)))
        return { ok: false };
    const index = raw as unknown as SourceScopeRuntimeIndex;
    if (index.records.length !== index.generationCursor ||
        rawMappings.value.length !== index.records.length || !runtimeRecordSetsUnique(index.records) ||
        index.lineageLockIndex.tenantId !== index.tenantId ||
        index.lineageLockIndex.sourceScopeReference !== index.sourceScopeReference ||
        index.lineageLockIndex.sourceKind !== index.sourceKind ||
        index.lineageLockIndex.dataMode !== index.dataMode)
        return { ok: false };
    const base = makeRecord<Omit<SourceScopeRuntimeIndex, 'indexDigest'>>([
        ['tenantId', index.tenantId],
        ['sourceScopeReference', index.sourceScopeReference],
        ['fixtureRegistryDigest', index.fixtureRegistryDigest],
        ['candidateManifestDigest', index.candidateManifestDigest],
        ['indexVersion', index.indexVersion],
        ['indexSnapshotComplete', true],
        ['generationCursor', index.generationCursor],
        ['generationComplete', index.generationComplete],
        ['records', index.records],
        ['lineageLockIndex', index.lineageLockIndex],
        ['sourceKind', index.sourceKind],
        ['dataMode', index.dataMode],
    ]);
    return runtimeIndexDigest(base) === index.indexDigest ? { ok: true, index } : { ok: false };
}
function captureDisableState(value: unknown, mappingReference: string, registered: WeakSet<object>): {
    ok: true;
    value: unknown;
    position: number;
} | {
    ok: false;
    failure: ParseFailure;
} {
    const failure = { eventType: 'mapping_input_blocked', reasonCode: 'source_scope_state_invalid' };
    const hasExactOwnKeys = (current: object, keys: readonly string[]) => {
        const ownKeys = Reflect.ownKeys(current);
        return ownKeys.length === keys.length && intrinsicEvery(ownKeys, (key) => typeof key === 'string' && keys.includes(key));
    };
    const dataValue = (current: object, key: string) => {
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        return descriptor && descriptor.enumerable && 'value' in descriptor
            ? { ok: true as const, value: descriptor.value }
            : { ok: false as const };
    };
    if (typeof value !== 'object' || value === null || isProxyIntrinsic(value) || Array.isArray(value) ||
        !(Object.getPrototypeOf(value) === Object.prototype ||
            (Object.getPrototypeOf(value) === null && registered.has(value))) ||
        !hasExactOwnKeys(value, RUNTIME_STATE_KEYS))
        return { ok: false, failure };
    const stateKind = dataValue(value, 'stateKind');
    const rawIndex = dataValue(value, 'sourceScopeRuntimeIndex');
    const rawMappings = dataValue(value, 'mappings');
    if (!stateKind.ok || !rawIndex.ok || !rawMappings.ok || !Array.isArray(rawMappings.value) ||
        isProxyIntrinsic(rawMappings.value) || rawMappings.value.length > 100 ||
        Object.getPrototypeOf(rawMappings.value) !== Array.prototype) {
        return { ok: false, failure };
    }
    const mappingKeys = Reflect.ownKeys(rawMappings.value);
    const expectedMappingKeys = [
        ...Array.from({ length: rawMappings.value.length }, (_, index) => String(index)),
        'length',
    ];
    if (mappingKeys.length !== expectedMappingKeys.length || intrinsicSome(mappingKeys, (key, index) => key !== expectedMappingKeys[index]))
        return { ok: false, failure };
    const capturedIndex = capturePublic(rawIndex.value, registered);
    if (!capturedIndex.ok || !isSafeRecord(capturedIndex.value) ||
        !hasExactKeysInOrder(capturedIndex.value, RUNTIME_INDEX_KEYS) ||
        !isTenantId(capturedIndex.value.tenantId) ||
        !isGeneralReference(capturedIndex.value.sourceScopeReference) ||
        !isDigest(capturedIndex.value.fixtureRegistryDigest) ||
        !isDigest(capturedIndex.value.candidateManifestDigest) ||
        !isInteger(capturedIndex.value.indexVersion, 1, MAX_VERSION) ||
        !isDigest(capturedIndex.value.indexDigest) ||
        capturedIndex.value.indexSnapshotComplete !== true ||
        !isInteger(capturedIndex.value.generationCursor, 0, 100) ||
        typeof capturedIndex.value.generationComplete !== 'boolean' ||
        !Array.isArray(capturedIndex.value.records) ||
        !intrinsicEvery(capturedIndex.value.records, parseScopeRecord) ||
        !parseLineageIndex(capturedIndex.value.lineageLockIndex) ||
        !['controlled_mock_fixture', 'controlled_demo_fixture'].includes(String(capturedIndex.value.sourceKind)) ||
        !['mock', 'demo'].includes(String(capturedIndex.value.dataMode)))
        return { ok: false, failure };
    const index = capturedIndex.value as unknown as SourceScopeRuntimeIndex;
    const indexBase = makeRecord<Omit<SourceScopeRuntimeIndex, 'indexDigest'>>([
        ['tenantId', index.tenantId],
        ['sourceScopeReference', index.sourceScopeReference],
        ['fixtureRegistryDigest', index.fixtureRegistryDigest],
        ['candidateManifestDigest', index.candidateManifestDigest],
        ['indexVersion', index.indexVersion],
        ['indexSnapshotComplete', true],
        ['generationCursor', index.generationCursor],
        ['generationComplete', index.generationComplete],
        ['records', index.records],
        ['lineageLockIndex', index.lineageLockIndex],
        ['sourceKind', index.sourceKind],
        ['dataMode', index.dataMode],
    ]);
    if (runtimeIndexDigest(indexBase) !== index.indexDigest ||
        index.records.length !== index.generationCursor || rawMappings.value.length !== index.records.length ||
        !runtimeRecordSetsUnique(index.records) ||
        index.lineageLockIndex.tenantId !== index.tenantId ||
        index.lineageLockIndex.sourceScopeReference !== index.sourceScopeReference ||
        index.lineageLockIndex.sourceKind !== index.sourceKind ||
        index.lineageLockIndex.dataMode !== index.dataMode)
        return { ok: false, failure };
    const positions = intrinsicFilter(intrinsicMap(index.records, (record, position) => isSafeRecord(record) && record.mappingReference === mappingReference ? position : -1), (position) => position >= 0);
    if (positions.length !== 1) {
        return {
            ok: false,
            failure: { eventType: 'mapping_input_blocked', reasonCode: 'aggregate_lineage_mismatch' },
        };
    }
    const selectedPosition = positions[0];
    const mappings: unknown[] = [];
    for (let position = 0; position < rawMappings.value.length; position += 1) {
        const rawMapping = dataValue(rawMappings.value, String(position));
        if (!rawMapping.ok || !isSafeRecord(rawMapping.value) || isProxyIntrinsic(rawMapping.value) ||
            !(Object.getPrototypeOf(rawMapping.value) === Object.prototype ||
                (Object.getPrototypeOf(rawMapping.value) === null && registered.has(rawMapping.value)))) {
            return { ok: false, failure };
        }
        if (position !== selectedPosition) {
            const captured = capturePublic(rawMapping.value, registered);
            if (!captured.ok)
                return { ok: false, failure };
            mappings.push(captured.value);
            continue;
        }
        const ownKeys = Reflect.ownKeys(rawMapping.value);
        if (intrinsicSome(ownKeys, (key) => typeof key !== 'string' || !MAPPING_STATE_KEYS.includes(key as never)) ||
            !ownKeys.includes('aggregate') || !ownKeys.includes('history'))
            return { ok: false, failure };
        const aggregate = dataValue(rawMapping.value, 'aggregate');
        const history = dataValue(rawMapping.value, 'history');
        if (!aggregate.ok || !history.ok)
            return { ok: false, failure };
        Object.getOwnPropertyDescriptor(rawMapping.value, 'target');
        const capturedAggregate = capturePublic(aggregate.value, registered);
        const capturedHistory = capturePublic(history.value, registered);
        if (!capturedAggregate.ok || !capturedHistory.ok)
            return { ok: false, failure };
        mappings.push(makeRecord<object>([
            ['aggregate', capturedAggregate.value],
            ['history', capturedHistory.value],
        ]));
    }
    return {
        ok: true,
        position: selectedPosition,
        value: makeRecord<object>([
            ['stateKind', stateKind.value],
            ['sourceScopeRuntimeIndex', capturedIndex.value],
            ['mappings', mappings],
        ]),
    };
}
function checkExactKeys(value: SafeRecord, keys: readonly string[], raw: boolean): ParseFailure | null {
    const actual = Object.keys(value);
    const extra = intrinsicFilter(actual, (key) => !keys.includes(key));
    const forbidden = intrinsicSort(intrinsicFilter(extra, isForbiddenKey), compareUtf8)[0];
    if (forbidden !== undefined) {
        return { eventType: 'forbidden_field_blocked', reasonCode: 'forbidden_field_blocked' };
    }
    const missing = intrinsicFind(keys, (key) => !Object.prototype.hasOwnProperty.call(value, key));
    if (missing !== undefined) {
        return { eventType: 'mapping_input_blocked', reasonCode: 'invalid_payload_shape' };
    }
    if (extra.length > 0) {
        return raw
            ? { eventType: 'forbidden_field_blocked', reasonCode: 'unknown_field_blocked' }
            : { eventType: 'mapping_input_blocked', reasonCode: 'invalid_payload_shape' };
    }
    return null;
}
function hasExactKeysInOrder(value: SafeRecord, keys: readonly string[]) {
    const actual = Object.keys(value);
    return actual.length === keys.length && intrinsicEvery(actual, (key, index) => key === keys[index]);
}
function compareUtf8(left: string, right: string) {
    return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}
function matchEntire(value: string, pattern: RegExp) {
    if (containsLineSeparator(value))
        return false;
    const match = value.match(pattern);
    return match !== null && match[0] === value && match[0].length === value.length;
}
function isTenantId(value: unknown): value is string {
    return typeof value === 'string' && value.length >= 15 && value.length <= 44 &&
        !containsLineSeparator(value) &&
        /^tenant-(?:mock|demo)-[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){1,30}[a-z0-9]$/u.test(value);
}
function daysInMonth(year: number, month: number) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}
function isDate(value: unknown): value is string {
    if (typeof value !== 'string' || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/u.test(value))
        return false;
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}
function isTimestamp(value: unknown): value is string {
    if (typeof value !== 'string' || value.length !== 24 || containsLineSeparator(value))
        return false;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))
        return false;
    if (!isDate(value.slice(0, 10)))
        return false;
    const hour = Number(value.slice(11, 13));
    const minute = Number(value.slice(14, 16));
    const second = Number(value.slice(17, 19));
    return hour <= 23 && minute <= 59 && second <= 59;
}
function isDigest(value: unknown, allowZero = false): value is string {
    return typeof value === 'string' && matchEntire(value, DIGEST_PATTERN) && (allowZero || value !== ZERO_DIGEST);
}
function isGeneralReference(value: unknown): value is string {
    return typeof value === 'string' && value.length >= 15 && value.length <= 60 &&
        matchEntire(value, GENERAL_REFERENCE_PATTERN) && !value.includes('--');
}
function isMappingReference(value: unknown): value is string {
    return typeof value === 'string' && matchEntire(value, MAPPING_REFERENCE_PATTERN);
}
function isInteger(value: unknown, minimum: number, maximum: number): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}
function isHumanText(value: unknown) {
    return typeof value === 'string' && Array.from(value).length >= 1 && Array.from(value).length <= 160 &&
        value.trim().length > 0 && !containsLineSeparator(value) && !containsControl(value);
}
function isMockCustomerNumber(value: unknown) {
    return typeof value === 'string' && value.length >= 3 && value.length <= 32 &&
        /^[A-Za-z0-9-]+$/u.test(value) && !containsLineSeparator(value);
}
function scanString(value: unknown, semantic: SensitiveSemantic = 'ordinary'): ParseFailure | null {
    if (typeof value !== 'string')
        return null;
    return sensitiveValue(value, semantic)
        ? { eventType: 'forbidden_field_blocked', reasonCode: 'sensitive_value_blocked' }
        : null;
}
function scanFields(value: SafeRecord, fields: readonly {
    key: string;
    semantic?: SensitiveSemantic;
}[]): ParseFailure | null {
    for (const { key, semantic } of fields) {
        const field = value[key];
        if (typeof field === 'string') {
            const failure = scanString(field, semantic);
            if (failure)
                return failure;
        }
    }
    return null;
}
function nestedScalarFailure(value: unknown) {
    return typeof value === 'object' && value !== null
        ? { eventType: 'forbidden_field_blocked', reasonCode: 'nested_raw_payload_blocked' }
        : null;
}
function scalarFailure(reasonCode = 'invalid_scalar_value'): ParseFailure {
    return { eventType: 'mapping_input_blocked', reasonCode };
}
function parseFollowUser(value: unknown): {
    ok: true;
    value: ExternalContact['followUsers'][number];
} | {
    ok: false;
    failure: ParseFailure;
} {
    if (!isSafeRecord(value))
        return { ok: false, failure: scalarFailure('invalid_payload_shape') };
    const keysFailure = checkExactKeys(value, FOLLOW_USER_KEYS, true);
    if (keysFailure)
        return { ok: false, failure: keysFailure };
    const scanFailure = scanFields(value, intrinsicMap(FOLLOW_USER_KEYS, (key) => ({
        key,
        semantic: key.endsWith('Digest') ? 'raw_digest' as const : 'ordinary' as const,
    })));
    if (scanFailure)
        return { ok: false, failure: scanFailure };
    if (!isTenantId(value.tenantId) || !isGeneralReference(value.followUserReference) ||
        !isHumanText(value.displayName) || !isDigest(value.followUserIdDigest) ||
        (value.ownershipStatus !== 'active' && value.ownershipStatus !== 'inactive') ||
        !isHumanText(value.institutionSummary) ||
        (value.dataMode !== 'mock' && value.dataMode !== 'demo') ||
        value.containsRealCustomerData !== false) {
        return { ok: false, failure: scalarFailure() };
    }
    return { ok: true, value: value as ExternalContact['followUsers'][number] };
}
function parseTag(value: unknown): {
    ok: true;
    value: ExternalContact['tags'][number];
} | {
    ok: false;
    failure: ParseFailure;
} {
    if (!isSafeRecord(value))
        return { ok: false, failure: scalarFailure('invalid_payload_shape') };
    const keysFailure = checkExactKeys(value, TAG_KEYS, true);
    if (keysFailure)
        return { ok: false, failure: keysFailure };
    const scanFailure = scanFields(value, intrinsicMap(TAG_KEYS, (key) => ({
        key,
        semantic: key.endsWith('Digest') ? 'raw_digest' as const : 'ordinary' as const,
    })));
    if (scanFailure)
        return { ok: false, failure: scanFailure };
    if (!isTenantId(value.tenantId) || !isGeneralReference(value.tagReference) ||
        !isDigest(value.tagIdDigest) || !isHumanText(value.tagName) ||
        (value.sourceType !== 'mock_enterprise' && value.sourceType !== 'demo_enterprise') ||
        (value.tagStatus !== 'active' && value.tagStatus !== 'inactive') ||
        (value.dataMode !== 'mock' && value.dataMode !== 'demo') ||
        value.containsRealCustomerData !== false) {
        return { ok: false, failure: scalarFailure() };
    }
    return { ok: true, value: value as ExternalContact['tags'][number] };
}
function parseContact(value: unknown): {
    ok: true;
    value: ExternalContact;
} | {
    ok: false;
    failure: ParseFailure;
} {
    if (!isSafeRecord(value))
        return { ok: false, failure: scalarFailure('invalid_payload_shape') };
    const keysFailure = checkExactKeys(value, CONTACT_KEYS, true);
    if (keysFailure)
        return { ok: false, failure: keysFailure };
    const scanFailure = scanFields(value, intrinsicMap(CONTACT_KEYS, (key) => ({
        key,
        semantic: key.endsWith('Digest') ? 'raw_digest' as const : 'ordinary' as const,
    })));
    if (scanFailure)
        return { ok: false, failure: scanFailure };
    if (!isTenantId(value.tenantId) || !isGeneralReference(value.externalContactReference) ||
        !isHumanText(value.displayName) || !isDigest(value.externalUserIdDigest) ||
        !Array.isArray(value.followUsers) || value.followUsers.length > 20 ||
        !Array.isArray(value.tags) || value.tags.length > 50 ||
        !['qr_code', 'employee_share', 'group_chat', 'other_mock'].includes(String(value.sourceType)) ||
        !isDate(value.addedAtDate) || !isHumanText(value.remarkSummary) ||
        !['unmatched', 'candidate', 'matched', 'conflict', 'rejected', 'manual_review_required'].includes(String(value.sourceMappingStatus)) ||
        !(value.lastSyncedAt === null || isTimestamp(value.lastSyncedAt)) ||
        !['not_started', 'mock_ready', 'preflight_ready', 'syncing_disabled', 'sync_failed', 'manual_review_required']
            .includes(String(value.syncStatus)) ||
        !['not_required', 'pending', 'approved', 'rejected', 'needs_more_info'].includes(String(value.manualReviewState)) ||
        (value.dataMode !== 'mock' && value.dataMode !== 'demo') ||
        value.containsRealCustomerData !== false || value.fieldWhitelistApplied !== true) {
        return { ok: false, failure: scalarFailure() };
    }
    const followUsers: ExternalContact['followUsers'] = [];
    const followReferences = new Set<string>();
    const followDigests = new Set<string>();
    for (const followUser of value.followUsers) {
        const parsed = parseFollowUser(followUser);
        if (!parsed.ok)
            return parsed;
        if (followReferences.has(parsed.value.followUserReference) ||
            followDigests.has(parsed.value.followUserIdDigest)) {
            return { ok: false, failure: scalarFailure('invalid_payload_shape') };
        }
        const followRecord = recordFrom(parsed.value, [...FOLLOW_USER_KEYS]);
        followReferences.add(followRecord.followUserReference);
        followDigests.add(followRecord.followUserIdDigest);
        followUsers.push(followRecord);
    }
    intrinsicSort(followUsers, (left, right) => compareUtf8(left.followUserIdDigest, right.followUserIdDigest));
    const tags: ExternalContact['tags'] = [];
    const tagReferences = new Set<string>();
    const tagDigests = new Set<string>();
    for (const tag of value.tags) {
        const parsed = parseTag(tag);
        if (!parsed.ok)
            return parsed;
        if (tagReferences.has(parsed.value.tagReference) || tagDigests.has(parsed.value.tagIdDigest)) {
            return { ok: false, failure: scalarFailure('invalid_payload_shape') };
        }
        const tagRecord = recordFrom(parsed.value, [...TAG_KEYS]);
        tagReferences.add(tagRecord.tagReference);
        tagDigests.add(tagRecord.tagIdDigest);
        tags.push(tagRecord);
    }
    intrinsicSort(tags, (left, right) => compareUtf8(left.tagIdDigest, right.tagIdDigest));
    return {
        ok: true,
        value: makeRecord<ExternalContact>(intrinsicMap(CONTACT_KEYS, (key) => [
            key,
            key === 'followUsers' ? followUsers : key === 'tags' ? tags : value[key],
        ])),
    };
}
function parseCustomer(value: unknown): {
    ok: true;
    value: SystemCustomer;
} | {
    ok: false;
    failure: ParseFailure;
} {
    if (!isSafeRecord(value))
        return { ok: false, failure: scalarFailure('invalid_payload_shape') };
    const keysFailure = checkExactKeys(value, CUSTOMER_KEYS, true);
    if (keysFailure)
        return { ok: false, failure: keysFailure };
    const scanFailure = scanFields(value, intrinsicMap(CUSTOMER_KEYS, (key) => ({
        key,
        semantic: key.endsWith('Digest') ? 'raw_digest' as const : 'ordinary' as const,
    })));
    if (scanFailure)
        return { ok: false, failure: scanFailure };
    if (!Array.isArray(value.tagNames) || value.tagNames.length > 50) {
        return { ok: false, failure: scalarFailure() };
    }
    const tagNames: string[] = [];
    const seenTagNames = new Set<string>();
    for (const tagName of value.tagNames) {
        const tagFailure = scanString(tagName);
        if (tagFailure)
            return { ok: false, failure: tagFailure };
        if (!isHumanText(tagName) || seenTagNames.has(tagName)) {
            return { ok: false, failure: scalarFailure() };
        }
        seenTagNames.add(tagName);
        tagNames.push(tagName);
    }
    intrinsicSort(tagNames, compareUtf8);
    if (!isTenantId(value.tenantId) || !isGeneralReference(value.customerReference) ||
        !isMockCustomerNumber(value.mockCustomerNumber) || !isHumanText(value.displayNameSummary) ||
        !isHumanText(value.remarkSummary) ||
        !['qr_code', 'employee_share', 'group_chat', 'other_mock'].includes(String(value.sourceType)) ||
        !isDate(value.addedAtDate) || !isHumanText(value.ownerSummary) || !isDigest(value.customerDigest) ||
        !['active', 'inactive', 'manual_review_required'].includes(String(value.statusSummary)) ||
        (value.dataMode !== 'mock' && value.dataMode !== 'demo') ||
        value.containsRealCustomerData !== false || value.fieldWhitelistApplied !== true) {
        return { ok: false, failure: scalarFailure() };
    }
    return { ok: true, value: { ...(value as SystemCustomer), tagNames } };
}
function parseGeneration(value: unknown): {
    ok: true;
    value: ParsedGenerationCommand;
} | {
    ok: false;
    failure: ParseFailure;
} {
    if (!isSafeRecord(value))
        return { ok: false, failure: scalarFailure('invalid_payload_shape') };
    const keysFailure = checkExactKeys(value, GENERATION_KEYS, true);
    if (keysFailure)
        return { ok: false, failure: keysFailure };
    for (const key of ['tenantId', 'action', 'manifestEntryReference', 'occurredAt', 'sourceKind', 'dataMode']) {
        const nested = nestedScalarFailure(value[key]);
        if (nested)
            return { ok: false, failure: nested };
    }
    const scanFailure = scanFields(value, [
        { key: 'tenantId' },
        { key: 'action' },
        { key: 'manifestEntryReference' },
        { key: 'occurredAt' },
        { key: 'sourceKind' },
        { key: 'dataMode' },
    ]);
    if (scanFailure)
        return { ok: false, failure: scanFailure };
    if (typeof value.tenantId !== 'string' || !isTenantId(value.tenantId)) {
        return { ok: false, failure: { eventType: 'unsafe_tenant_id_blocked', reasonCode: 'unsafe_tenant_id_blocked' } };
    }
    if (typeof value.occurredAt !== 'string' || !isTimestamp(value.occurredAt)) {
        return { ok: false, failure: { eventType: 'unsafe_occurred_at_blocked', reasonCode: 'unsafe_occurred_at_blocked' } };
    }
    if (value.action !== 'generate_candidate') {
        return { ok: false, failure: scalarFailure('invalid_action') };
    }
    if (!(value.manifestEntryReference === null || isGeneralReference(value.manifestEntryReference)) ||
        !Array.isArray(value.externalContacts) || value.externalContacts.length < 1 || value.externalContacts.length > 100 ||
        !Array.isArray(value.systemCustomers) || value.systemCustomers.length < 1 || value.systemCustomers.length > 100 ||
        (value.sourceKind !== 'controlled_mock_fixture' && value.sourceKind !== 'controlled_demo_fixture') ||
        (value.dataMode !== 'mock' && value.dataMode !== 'demo') ||
        value.containsRealCustomerData !== false) {
        return { ok: false, failure: scalarFailure() };
    }
    const contacts: ExternalContact[] = [];
    const contactReferences = new Set<string>();
    const contactDigests = new Set<string>();
    for (const contact of value.externalContacts) {
        const parsed = parseContact(contact);
        if (!parsed.ok)
            return parsed;
        if (contactReferences.has(parsed.value.externalContactReference) ||
            contactDigests.has(parsed.value.externalUserIdDigest)) {
            return { ok: false, failure: scalarFailure('invalid_payload_shape') };
        }
        contactReferences.add(parsed.value.externalContactReference);
        contactDigests.add(parsed.value.externalUserIdDigest);
        contacts.push(parsed.value);
    }
    intrinsicSort(contacts, (left, right) => compareUtf8(left.externalUserIdDigest, right.externalUserIdDigest));
    const customers: SystemCustomer[] = [];
    const customerReferences = new Set<string>();
    const customerDigests = new Set<string>();
    for (const customer of value.systemCustomers) {
        const parsed = parseCustomer(customer);
        if (!parsed.ok)
            return parsed;
        if (customerReferences.has(parsed.value.customerReference) ||
            customerDigests.has(parsed.value.customerDigest)) {
            return { ok: false, failure: scalarFailure('invalid_payload_shape') };
        }
        customerReferences.add(parsed.value.customerReference);
        customerDigests.add(parsed.value.customerDigest);
        customers.push(parsed.value);
    }
    intrinsicSort(customers, (left, right) => compareUtf8(left.customerDigest, right.customerDigest));
    return {
        ok: true,
        value: {
            tenantId: value.tenantId,
            action: 'generate_candidate',
            manifestEntryReference: value.manifestEntryReference,
            externalContacts: contacts,
            systemCustomers: customers,
            occurredAt: value.occurredAt,
            sourceKind: value.sourceKind,
            dataMode: value.dataMode,
            containsRealCustomerData: false,
        },
    };
}
function parseReview(value: unknown): {
    ok: true;
    value: ParsedReviewCommand;
} | {
    ok: false;
    failure: ParseFailure;
} {
    if (!isSafeRecord(value))
        return { ok: false, failure: scalarFailure('invalid_payload_shape') };
    const keysFailure = checkExactKeys(value, REVIEW_KEYS, true);
    if (keysFailure)
        return { ok: false, failure: keysFailure };
    for (const key of REVIEW_KEYS) {
        const nested = nestedScalarFailure(value[key]);
        if (nested)
            return { ok: false, failure: nested };
    }
    const scanFailure = scanFields(value, [
        { key: 'tenantId' },
        { key: 'mappingReference', semantic: 'raw_mapping_reference' },
        { key: 'candidateDigest', semantic: 'raw_digest' },
        { key: 'action' },
        { key: 'reviewerRole' },
        { key: 'occurredAt' },
    ]);
    if (scanFailure)
        return { ok: false, failure: scanFailure };
    if (typeof value.tenantId !== 'string' || !isTenantId(value.tenantId)) {
        return { ok: false, failure: { eventType: 'unsafe_tenant_id_blocked', reasonCode: 'unsafe_tenant_id_blocked' } };
    }
    if (typeof value.occurredAt !== 'string' || !isTimestamp(value.occurredAt)) {
        return { ok: false, failure: { eventType: 'unsafe_occurred_at_blocked', reasonCode: 'unsafe_occurred_at_blocked' } };
    }
    const reviewActions = ['approve', 'reject', 'request_more_info', 'mark_conflict', 'clear_candidate', 'reopen', 'expire_candidate'];
    if (!reviewActions.includes(String(value.action))) {
        return { ok: false, failure: scalarFailure('invalid_action') };
    }
    if (!isMappingReference(value.mappingReference) || !isDigest(value.candidateDigest) ||
        (value.reviewerRole !== 'institution_operator' && value.reviewerRole !== 'platform_governance')) {
        return { ok: false, failure: scalarFailure() };
    }
    return { ok: true, value: value as ParsedReviewCommand };
}
function parseDisable(value: unknown): {
    ok: true;
    value: ParsedDisableCommand;
} | {
    ok: false;
    failure: ParseFailure;
} {
    if (!isSafeRecord(value))
        return { ok: false, failure: scalarFailure('invalid_payload_shape') };
    const keysFailure = checkExactKeys(value, DISABLE_KEYS, true);
    if (keysFailure)
        return { ok: false, failure: keysFailure };
    for (const key of DISABLE_KEYS) {
        const nested = nestedScalarFailure(value[key]);
        if (nested)
            return { ok: false, failure: nested };
    }
    const scanFailure = scanFields(value, [
        { key: 'tenantId' },
        { key: 'mappingReference', semantic: 'raw_mapping_reference' },
        { key: 'action' },
        { key: 'reviewerRole' },
        { key: 'occurredAt' },
    ]);
    if (scanFailure)
        return { ok: false, failure: scanFailure };
    if (typeof value.tenantId !== 'string' || !isTenantId(value.tenantId)) {
        return { ok: false, failure: { eventType: 'unsafe_tenant_id_blocked', reasonCode: 'unsafe_tenant_id_blocked' } };
    }
    if (typeof value.occurredAt !== 'string' || !isTimestamp(value.occurredAt)) {
        return { ok: false, failure: { eventType: 'unsafe_occurred_at_blocked', reasonCode: 'unsafe_occurred_at_blocked' } };
    }
    if (value.action !== 'disable_mapping')
        return { ok: false, failure: scalarFailure('invalid_action') };
    if (!isMappingReference(value.mappingReference) ||
        (value.reviewerRole !== 'institution_operator' && value.reviewerRole !== 'platform_governance')) {
        return { ok: false, failure: scalarFailure() };
    }
    return { ok: true, value: value as ParsedDisableCommand };
}
function intrinsicMap<Input, Output>(values: readonly Input[], callback: (value: Input, index: number, array: readonly Input[]) => Output) {
    return reflectApplyIntrinsic(arrayMapIntrinsic, values, [callback]) as Output[];
}
function intrinsicFlatMap<Input, Output>(values: readonly Input[], callback: (value: Input, index: number, array: readonly Input[]) => Output[]) {
    return reflectApplyIntrinsic(arrayFlatMapIntrinsic, values, [callback]) as Output[];
}
function intrinsicReduce<Input, Output>(values: readonly Input[], callback: (previous: Output, value: Input, index: number, array: readonly Input[]) => Output, initial: Output) {
    return reflectApplyIntrinsic(arrayReduceIntrinsic, values, [callback, initial]) as Output;
}
function intrinsicFilter<Input, Narrowed extends Input>(values: readonly Input[], callback: (value: Input, index: number, array: readonly Input[]) => value is Narrowed): Narrowed[];
function intrinsicFilter<Input>(values: readonly Input[], callback: (value: Input, index: number, array: readonly Input[]) => unknown): Input[];
function intrinsicFilter<Input>(values: readonly Input[], callback: (value: Input, index: number, array: readonly Input[]) => unknown) {
    return reflectApplyIntrinsic(arrayFilterIntrinsic, values, [callback]) as Input[];
}
function intrinsicFind<Input>(values: readonly Input[], callback: (value: Input, index: number, array: readonly Input[]) => unknown) {
    return reflectApplyIntrinsic(arrayFindIntrinsic, values, [callback]) as Input | undefined;
}
function intrinsicFindIndex<Input>(values: readonly Input[], callback: (value: Input, index: number, array: readonly Input[]) => unknown) {
    return reflectApplyIntrinsic(arrayFindIndexIntrinsic, values, [callback]) as number;
}
function intrinsicSome<Input>(values: readonly Input[], callback: (value: Input, index: number, array: readonly Input[]) => unknown) {
    return reflectApplyIntrinsic(arraySomeIntrinsic, values, [callback]) as boolean;
}
function intrinsicEvery<Input>(values: readonly Input[], callback: (value: Input, index: number, array: readonly Input[]) => unknown) {
    return reflectApplyIntrinsic(arrayEveryIntrinsic, values, [callback]) as boolean;
}
function intrinsicSort<Input>(values: Input[], compare?: (left: Input, right: Input) => number) {
    return reflectApplyIntrinsic(arraySortIntrinsic, values, compare ? [compare] : []) as Input[];
}
function intrinsicReverse<Input>(values: Input[]) {
    return reflectApplyIntrinsic(arrayReverseIntrinsic, values, []) as Input[];
}
function intrinsicAt<Input>(values: readonly Input[], index: number) {
    return reflectApplyIntrinsic(arrayAtIntrinsic, values, [index]) as Input | undefined;
}
function lengthPrefix(value: string | Buffer) {
    const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
    const length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    return Buffer.concat([length, bytes]);
}
function canonicalEncode(value: unknown): Buffer {
    if (typeof value === 'string')
        return Buffer.concat([lengthPrefix('s'), lengthPrefix(value)]);
    if (typeof value === 'number' && Number.isSafeInteger(value)) {
        return Buffer.concat([lengthPrefix('i'), lengthPrefix(String(value))]);
    }
    if (typeof value === 'boolean') {
        return Buffer.concat([lengthPrefix('b'), lengthPrefix(value ? 'true' : 'false')]);
    }
    if (value === null)
        return lengthPrefix('null');
    if (Array.isArray(value)) {
        return Buffer.concat([
            lengthPrefix('a'),
            lengthPrefix(String(value.length)),
            ...intrinsicMap(value, canonicalEncode),
        ]);
    }
    if (isSafeRecord(value)) {
        const entries = Object.entries(value);
        return Buffer.concat([
            lengthPrefix('o'),
            lengthPrefix(String(entries.length)),
            ...intrinsicFlatMap(entries, ([key, nested]) => [lengthPrefix(key), canonicalEncode(nested)]),
        ]);
    }
    throw new TypeError('unsupported canonical value');
}
function digestValues(domain: string, values: readonly unknown[]) {
    const hash = createHash('sha256');
    hash.update(lengthPrefix(domain));
    for (const value of values)
        hash.update(canonicalEncode(value));
    return `sha256:${hash.digest('hex')}`;
}
function sourceContactProjection(contact: ExternalContact) {
    const canonical = {
        ...contact,
        followUsers: intrinsicSort([...contact.followUsers], (left, right) => {
            const digestOrder = compareUtf8(left.followUserIdDigest, right.followUserIdDigest);
            return digestOrder || compareUtf8(left.followUserReference, right.followUserReference);
        }),
        tags: intrinsicSort([...contact.tags], (left, right) => {
            const digestOrder = compareUtf8(left.tagIdDigest, right.tagIdDigest);
            return digestOrder || compareUtf8(left.tagReference, right.tagReference);
        }),
    };
    return recordFrom(canonical, [...CONTACT_KEYS]);
}
function sourceCustomerProjection(customer: SystemCustomer) {
    return recordFrom({ ...customer, tagNames: intrinsicSort([...customer.tagNames], compareUtf8) }, [...CUSTOMER_KEYS]);
}
function calculateSourceDigests(tenantId: string, sourceKind: WeComCustomerMappingSourceKind, dataMode: WeComCustomerMappingDataMode, externalContacts: ExternalContact[], systemCustomers: SystemCustomer[]) {
    const sortedContacts = intrinsicMap(intrinsicSort([...externalContacts], (left, right) => {
        const digestOrder = compareUtf8(left.externalUserIdDigest, right.externalUserIdDigest);
        return digestOrder || compareUtf8(left.externalContactReference, right.externalContactReference);
    }), sourceContactProjection);
    const sortedCustomers = intrinsicMap(intrinsicSort([...systemCustomers], (left, right) => {
        const digestOrder = compareUtf8(left.customerDigest, right.customerDigest);
        return digestOrder || compareUtf8(left.customerReference, right.customerReference);
    }), sourceCustomerProjection);
    const externalContactsDigest = digestValues('zmtg:05c-e1:external-contacts:v1', [sortedContacts]);
    const systemCustomersDigest = digestValues('zmtg:05c-e1:system-customers:v1', [sortedCustomers]);
    const sourceSnapshotDigest = digestValues('zmtg:05c-e1:source-snapshot:v1', [
        tenantId,
        sourceKind,
        dataMode,
        externalContactsDigest,
        systemCustomersDigest,
    ]);
    return { externalContactsDigest, systemCustomersDigest, sourceSnapshotDigest };
}
function levenshteinScore(left: string, right: string) {
    const a = Array.from(left);
    const b = Array.from(right);
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let row = 1; row <= a.length; row += 1) {
        let diagonal = previous[0];
        previous[0] = row;
        for (let column = 1; column <= b.length; column += 1) {
            const above = previous[column];
            previous[column] = Math.min(previous[column] + 1, previous[column - 1] + 1, diagonal + (a[row - 1] === b[column - 1] ? 0 : 1));
            diagonal = above;
        }
    }
    const maximum = Math.max(a.length, b.length);
    return Math.floor(100 * (maximum - previous[b.length]) / maximum);
}
function deriveEvidence(contact: ExternalContact, customer: SystemCustomer, mockCustomerNumberMatched: boolean): WeComCustomerMappingEvidence {
    const contactTags = new Set(intrinsicMap(intrinsicFilter(contact.tags, ({ tagStatus }) => tagStatus === 'active'), ({ tagName }) => tagName));
    const tagNames = intrinsicSort([...new Set(intrinsicFilter(customer.tagNames, (tagName) => contactTags.has(tagName)))], compareUtf8);
    return makeRecord<WeComCustomerMappingEvidence>([
        ['displayNameSimilarity', levenshteinScore(contact.displayName, customer.displayNameSummary)],
        ['remarkSummaryMatched', contact.remarkSummary === customer.remarkSummary],
        ['tagNames', tagNames],
        ['sourceTypeMatched', contact.sourceType === customer.sourceType],
        ['addedAtDateMatched', contact.addedAtDate === customer.addedAtDate],
        ['ownerSummaryMatched', intrinsicSome(contact.followUsers, ({ displayName, institutionSummary, ownershipStatus }) => ownershipStatus === 'active' && (displayName === customer.ownerSummary || institutionSummary === customer.ownerSummary))],
        ['digestMatched', contact.externalUserIdDigest === customer.customerDigest],
        ['mockCustomerNumberMatched', mockCustomerNumberMatched],
        ['systemCustomerSummaryMatched', contact.displayName === customer.displayNameSummary],
    ]);
}
function evidenceFingerprint(evidence: WeComCustomerMappingEvidence) {
    return digestValues('zmtg:05c-e1:evidence:v1', intrinsicMap(EVIDENCE_KEYS, (key) => evidence[key]));
}
function confidence(evidence: WeComCustomerMappingEvidence) {
    const score = Math.floor(evidence.displayNameSimilarity * 25 / 100) +
        (evidence.remarkSummaryMatched ? 10 : 0) +
        (evidence.tagNames.length > 0 ? 10 : 0) +
        (evidence.sourceTypeMatched ? 5 : 0) +
        (evidence.addedAtDateMatched ? 5 : 0) +
        (evidence.ownerSummaryMatched ? 10 : 0) +
        (evidence.digestMatched ? 20 : 0) +
        (evidence.mockCustomerNumberMatched ? 10 : 0) +
        (evidence.systemCustomerSummaryMatched ? 5 : 0);
    const level = score >= 80 ? 'high' as const : score >= 50 ? 'medium' as const : 'low' as const;
    return { score, level };
}
function candidatePairDigest(tenantId: string, sourceScopeReference: string, externalContactDigest: string, systemCustomerDigest: string) {
    return digestValues('zmtg:05c-e1:candidate-pair:v1', [
        tenantId,
        sourceScopeReference,
        externalContactDigest,
        systemCustomerDigest,
    ]);
}
function mappingReference(tenantId: string, sourceScopeReference: string, pairDigest: string, fingerprint: string, dataMode: WeComCustomerMappingDataMode) {
    const full = digestValues('zmtg:05c-e1:mapping-reference:v2', [
        tenantId,
        sourceScopeReference,
        pairDigest,
        fingerprint,
    ]).slice('sha256:'.length);
    return `ref-${dataMode}-${full.slice(0, 48)}`;
}
function calculateCandidateDigest(input: {
    candidateVersion: number;
    tenantId: string;
    mappingReference: string;
    candidatePairDigest: string;
    evidenceFingerprint: string;
    confidenceScore: number;
    confidenceLevel: 'low' | 'medium' | 'high';
    originStatus: 'candidate' | 'manual_review_required' | 'conflict';
    originReason: 'candidate_evidence_available' | 'low_confidence' | 'mapping_conflict';
    sourceKind: WeComCustomerMappingSourceKind;
    dataMode: WeComCustomerMappingDataMode;
}) {
    return digestValues('zmtg:05c-e1:candidate:v2', [
        input.candidateVersion,
        input.tenantId,
        input.mappingReference,
        input.candidatePairDigest,
        input.evidenceFingerprint,
        input.confidenceScore,
        input.confidenceLevel,
        input.originStatus,
        input.originReason,
        input.sourceKind,
        input.dataMode,
    ]);
}
function historyDigest(history: Omit<MappingHistory, 'historyDigest'>) {
    return digestValues('zmtg:05c-e1:mapping-history:v1', [
        history.tenantId,
        history.sourceScopeReference,
        history.mappingReference,
        history.historyVersion,
        history.complete,
        history.entries,
        history.sourceKind,
        history.dataMode,
    ]);
}
function lineageIndexDigest(index: Omit<LineageLockIndex, 'indexDigest'>) {
    return digestValues('zmtg:05c-e1:lineage-index:v1', [
        index.tenantId,
        index.sourceScopeReference,
        index.indexVersion,
        index.records,
        index.sourceKind,
        index.dataMode,
    ]);
}
function runtimeIndexDigest(index: Omit<SourceScopeRuntimeIndex, 'indexDigest'>) {
    return digestValues('zmtg:05c-e1:source-scope-runtime-index:v2', [
        index.tenantId,
        index.sourceScopeReference,
        index.fixtureRegistryDigest,
        index.candidateManifestDigest,
        index.indexVersion,
        index.indexSnapshotComplete,
        index.generationCursor,
        index.generationComplete,
        index.records,
        index.lineageLockIndex,
        index.sourceKind,
        index.dataMode,
    ]);
}
function buildFixtureSource(tenantId: string) {
    const dataMode = tenantId.includes('-demo-') ? 'demo' as const : 'mock' as const;
    const label = dataMode === 'mock' ? 'MOCK' : 'DEMO';
    const sourceKind = dataMode === 'mock'
        ? 'controlled_mock_fixture' as const
        : 'controlled_demo_fixture' as const;
    const externalContacts: ExternalContact[] = [{
            tenantId,
            externalContactReference: `ref-${dataMode}-contact-001`,
            displayName: `[${label}] 客户甲`,
            externalUserIdDigest: `sha256:${'a'.repeat(64)}`,
            followUsers: [{
                    tenantId,
                    followUserReference: `ref-${dataMode}-follow-001`,
                    displayName: `[${label}] 顾问甲`,
                    followUserIdDigest: `sha256:${'b'.repeat(64)}`,
                    ownershipStatus: 'active',
                    institutionSummary: `[${label}] 机构甲`,
                    dataMode,
                    containsRealCustomerData: false,
                }],
            tags: [{
                    tenantId,
                    tagReference: `ref-${dataMode}-tag-001`,
                    tagIdDigest: `sha256:${'c'.repeat(64)}`,
                    tagName: `[${label}] 重点客户`,
                    sourceType: dataMode === 'mock' ? 'mock_enterprise' : 'demo_enterprise',
                    tagStatus: 'active',
                    dataMode,
                    containsRealCustomerData: false,
                }],
            sourceType: 'other_mock',
            addedAtDate: '2026-07-10',
            remarkSummary: `[${label}] 已确认摘要`,
            sourceMappingStatus: 'unmatched',
            lastSyncedAt: '2026-07-12T00:00:00.000Z',
            syncStatus: 'mock_ready',
            manualReviewState: 'not_required',
            dataMode,
            containsRealCustomerData: false,
            fieldWhitelistApplied: true,
        }];
    const systemCustomers: SystemCustomer[] = [{
            tenantId,
            customerReference: `ref-${dataMode}-customer-001`,
            mockCustomerNumber: `${label}-001`,
            displayNameSummary: `[${label}] 客户甲`,
            remarkSummary: `[${label}] 已确认摘要`,
            tagNames: [`[${label}] 重点客户`],
            sourceType: 'other_mock',
            addedAtDate: '2026-07-10',
            ownerSummary: `[${label}] 顾问甲`,
            customerDigest: `sha256:${'d'.repeat(64)}`,
            statusSummary: 'active',
            dataMode,
            containsRealCustomerData: false,
            fieldWhitelistApplied: true,
        }];
    return { dataMode, sourceKind, externalContacts, systemCustomers };
}
type FixtureBundleOptions = {
    emptyManifest?: boolean;
    entries?: Array<{
        contactIndex: number;
        customerIndex: number;
        manifestEntryReference: string;
        mockCustomerNumberLinked: boolean;
    }>;
    source?: ReturnType<typeof buildFixtureSource>;
};
function compareManifestEntries(left: CandidateManifestEntry, right: CandidateManifestEntry) {
    for (const key of ['externalContactDigest', 'systemCustomerDigest', 'manifestEntryReference'] as const) {
        const compared = compareUtf8(left[key], right[key]);
        if (compared !== 0)
            return compared;
    }
    return 0;
}
function buildMultiFixtureSource(tenantId: string) {
    const source = buildFixtureSource(tenantId);
    const { dataMode, sourceKind } = source;
    const label = dataMode === 'mock' ? 'MOCK' : 'DEMO';
    source.externalContacts[0].followUsers.push({
        tenantId,
        followUserReference: `ref-${dataMode}-follow-002`,
        displayName: `[${label}] 顾问乙`,
        followUserIdDigest: `sha256:${'e'.repeat(64)}`,
        ownershipStatus: 'active',
        institutionSummary: `[${label}] 机构乙`,
        dataMode,
        containsRealCustomerData: false,
    });
    source.externalContacts[0].tags.push({
        tenantId,
        tagReference: `ref-${dataMode}-tag-002`,
        tagIdDigest: `sha256:${'f'.repeat(64)}`,
        tagName: `[${label}] 稳健客户`,
        sourceType: dataMode === 'mock' ? 'mock_enterprise' : 'demo_enterprise',
        tagStatus: 'active',
        dataMode,
        containsRealCustomerData: false,
    });
    source.systemCustomers[0].tagNames.push(`[${label}] 稳健客户`);
    source.externalContacts.push({
        ...deepClone(source.externalContacts[0]),
        externalContactReference: `ref-${dataMode}-contact-002`,
        displayName: `[${label}] 客户乙`,
        externalUserIdDigest: `sha256:${'e'.repeat(64)}`,
        followUsers: [{
                ...deepClone(source.externalContacts[0].followUsers[0]),
                followUserReference: `ref-${dataMode}-follow-003`,
                displayName: `[${label}] 顾问丙`,
                followUserIdDigest: `sha256:${'1'.repeat(64)}`,
                institutionSummary: `[${label}] 机构丙`,
            }],
        tags: [{
                ...deepClone(source.externalContacts[0].tags[0]),
                tagReference: `ref-${dataMode}-tag-003`,
                tagIdDigest: `sha256:${'2'.repeat(64)}`,
                tagName: `[${label}] 新客户`,
            }],
        remarkSummary: `[${label}] 乙摘要`,
    });
    source.systemCustomers.push({
        ...deepClone(source.systemCustomers[0]),
        customerReference: `ref-${dataMode}-customer-002`,
        mockCustomerNumber: `${label}-002`,
        displayNameSummary: `[${label}] 客户乙`,
        remarkSummary: `[${label}] 乙摘要`,
        tagNames: [`[${label}] 新客户`],
        ownerSummary: `[${label}] 顾问丙`,
        customerDigest: `sha256:${'f'.repeat(64)}`,
    });
    return { dataMode, sourceKind, externalContacts: source.externalContacts, systemCustomers: source.systemCustomers };
}
function createFixtureBundle(tenantId: string, readiness: FixtureReadiness, options: FixtureBundleOptions = {}): FixtureBundle {
    const source = options.source ?? buildFixtureSource(tenantId);
    source.externalContacts = intrinsicSort(intrinsicMap(source.externalContacts, (contact) => ({
        ...contact,
        followUsers: intrinsicSort([...contact.followUsers], (left, right) => {
            const digestOrder = compareUtf8(left.followUserIdDigest, right.followUserIdDigest);
            return digestOrder || compareUtf8(left.followUserReference, right.followUserReference);
        }),
        tags: intrinsicSort([...contact.tags], (left, right) => {
            const digestOrder = compareUtf8(left.tagIdDigest, right.tagIdDigest);
            return digestOrder || compareUtf8(left.tagReference, right.tagReference);
        }),
    })), (left, right) => {
        const digestOrder = compareUtf8(left.externalUserIdDigest, right.externalUserIdDigest);
        return digestOrder || compareUtf8(left.externalContactReference, right.externalContactReference);
    });
    source.systemCustomers = intrinsicSort(intrinsicMap(source.systemCustomers, (customer) => ({ ...customer, tagNames: intrinsicSort([...customer.tagNames], compareUtf8) })), (left, right) => {
        const digestOrder = compareUtf8(left.customerDigest, right.customerDigest);
        return digestOrder || compareUtf8(left.customerReference, right.customerReference);
    });
    const tenantSuffix = tenantId.slice(tenantId.lastIndexOf('-') + 1);
    const sourceScopeReference = `ref-${source.dataMode}-scope-${tenantSuffix}`;
    const sourceDigests = calculateSourceDigests(tenantId, source.sourceKind, source.dataMode, source.externalContacts, source.systemCustomers);
    const manifestInputs = options.emptyManifest ? [] : options.entries ?? [{
            contactIndex: 0,
            customerIndex: 0,
            manifestEntryReference: `ref-${source.dataMode}-entry-001`,
            mockCustomerNumberLinked: true,
        }];
    const manifestEntries: CandidateManifestEntry[] = intrinsicSort(intrinsicMap(manifestInputs, (input) => {
        const contact = source.externalContacts[input.contactIndex];
        const customer = source.systemCustomers[input.customerIndex];
        const evidence = deriveEvidence(contact, customer, input.mockCustomerNumberLinked);
        return {
            manifestEntryReference: input.manifestEntryReference,
            externalContactDigest: contact.externalUserIdDigest,
            systemCustomerDigest: customer.customerDigest,
            mockCustomerNumberLinked: input.mockCustomerNumberLinked,
            expectedEvidenceFingerprint: evidenceFingerprint(evidence),
        };
    }), compareManifestEntries);
    const candidateManifestDigest = digestValues('zmtg:05c-e1:candidate-manifest:v1', [
        tenantId,
        sourceScopeReference,
        sourceDigests.sourceSnapshotDigest,
        source.sourceKind,
        source.dataMode,
        manifestEntries,
        false,
        true,
    ]);
    const candidateManifest = makeRecord<CandidateManifest>([
        ['tenantId', tenantId],
        ['sourceScopeReference', sourceScopeReference],
        ['sourceSnapshotDigest', sourceDigests.sourceSnapshotDigest],
        ['sourceKind', source.sourceKind],
        ['dataMode', source.dataMode],
        ['entries', manifestEntries],
        ['containsRealCustomerData', false],
        ['fieldWhitelistApplied', true],
        ['candidateManifestDigest', candidateManifestDigest],
    ]);
    const fixtureRegistryDigest = digestValues('zmtg:05c-e1:fixture-registry:v2', [
        tenantId,
        sourceScopeReference,
        source.sourceKind,
        source.dataMode,
        sourceDigests.externalContactsDigest,
        sourceDigests.systemCustomersDigest,
        sourceDigests.sourceSnapshotDigest,
        candidateManifestDigest,
    ]);
    const registryEntry = makeRecord<FixtureRegistryEntry>([
        ['tenantId', tenantId],
        ['fixtureRegistryDigest', fixtureRegistryDigest],
        ['sourceScopeReference', sourceScopeReference],
        ['sourceKind', source.sourceKind],
        ['dataMode', source.dataMode],
        ['externalContactsDigest', sourceDigests.externalContactsDigest],
        ['systemCustomersDigest', sourceDigests.systemCustomersDigest],
        ['sourceSnapshotDigest', sourceDigests.sourceSnapshotDigest],
        ['candidateManifestDigest', candidateManifestDigest],
    ]);
    return {
        tenantId,
        sourceScopeReference,
        sourceKind: source.sourceKind,
        dataMode: source.dataMode,
        externalContacts: source.externalContacts,
        systemCustomers: source.systemCustomers,
        manifestEntries,
        candidateManifest,
        registryEntry,
        ...sourceDigests,
        candidateManifestDigest,
        fixtureRegistryDigest,
        readiness,
    };
}
function createReadyReadiness(tenantId: string, dataMode: WeComCustomerMappingDataMode): FixtureReadiness {
    return {
        tenantId,
        authorizationReference: `ref-${dataMode}-authorization-${tenantId.slice(-3)}`,
        corpIdDigest: digestValues('zmtg:05c-e1:fixture-corp:v1', [tenantId, dataMode]),
        authorizationStatus: 'authorized',
        providerState: 'mock_only',
        authorizedAtDate: '2026-07-01',
        expiresAtDate: null,
        manualReviewState: 'not_required',
        lastPreflightAt: '2026-07-12T00:00:00.000Z',
        syncStatus: 'mock_ready',
        auditReady: true,
        dataMode,
        containsRealCustomerData: false,
    };
}
function buildRegistry() {
    const bundles = [
        createFixtureBundle('tenant-mock-001', createReadyReadiness('tenant-mock-001', 'mock')),
        createFixtureBundle('tenant-mock-002', {
            ...createReadyReadiness('tenant-mock-002', 'mock'),
            providerState: 'disabled',
        }),
        createFixtureBundle('tenant-mock-003', {
            ...createReadyReadiness('tenant-mock-003', 'mock'),
            providerState: 'external_disabled',
        }),
        createFixtureBundle('tenant-demo-001', {
            ...createReadyReadiness('tenant-demo-001', 'demo'),
            authorizationStatus: 'revoked',
        }),
        createFixtureBundle('tenant-mock-004', {
            ...createReadyReadiness('tenant-mock-004', 'mock'),
            auditReady: false,
        }),
        createFixtureBundle('tenant-mock-005', createReadyReadiness('tenant-mock-005', 'mock'), { emptyManifest: true }),
        createFixtureBundle('tenant-mock-006', createReadyReadiness('tenant-mock-006', 'mock'), {
            source: buildMultiFixtureSource('tenant-mock-006'),
            entries: [
                {
                    contactIndex: 0,
                    customerIndex: 0,
                    manifestEntryReference: 'ref-mock-entry-001',
                    mockCustomerNumberLinked: true,
                },
                {
                    contactIndex: 1,
                    customerIndex: 1,
                    manifestEntryReference: 'ref-mock-entry-002',
                    mockCustomerNumberLinked: true,
                },
            ],
        }),
    ];
    const registry = new MapIntrinsic<string, FixtureBundle>();
    for (const bundle of bundles) {
        reflectApplyIntrinsic(mapSetIntrinsic, registry, [bundle.tenantId, bundle]);
    }
    return registry;
}
function validateBundleSource(bundle: FixtureBundle) {
    if (bundle.externalContacts.length < 1 || bundle.externalContacts.length > 100 ||
        bundle.systemCustomers.length < 1 || bundle.systemCustomers.length > 100 ||
        (bundle.dataMode === 'mock' &&
            (bundle.sourceKind !== 'controlled_mock_fixture' || !bundle.tenantId.startsWith('tenant-mock-'))) ||
        (bundle.dataMode === 'demo' &&
            (bundle.sourceKind !== 'controlled_demo_fixture' || !bundle.tenantId.startsWith('tenant-demo-'))))
        return false;
    const contactReferences = new Set<string>();
    const contactDigests = new Set<string>();
    for (let position = 0; position < bundle.externalContacts.length; position += 1) {
        const contact = bundle.externalContacts[position];
        const parsed = parseContact(contact);
        if (!parsed.ok || !canonicalEncode(parsed.value).equals(canonicalEncode(contact)) ||
            contact.tenantId !== bundle.tenantId || contact.dataMode !== bundle.dataMode || intrinsicSome(contact.followUsers, ({ tenantId, dataMode }) => tenantId !== bundle.tenantId || dataMode !== bundle.dataMode) || intrinsicSome(contact.tags, ({ tenantId, dataMode }) => tenantId !== bundle.tenantId || dataMode !== bundle.dataMode) ||
            contactReferences.has(contact.externalContactReference) ||
            contactDigests.has(contact.externalUserIdDigest))
            return false;
        contactReferences.add(contact.externalContactReference);
        contactDigests.add(contact.externalUserIdDigest);
        const previous = bundle.externalContacts[position - 1];
        if (previous) {
            const digestOrder = compareUtf8(previous.externalUserIdDigest, contact.externalUserIdDigest);
            if (digestOrder > 0 || (digestOrder === 0 &&
                compareUtf8(previous.externalContactReference, contact.externalContactReference) >= 0))
                return false;
        }
    }
    const customerReferences = new Set<string>();
    const customerDigests = new Set<string>();
    for (let position = 0; position < bundle.systemCustomers.length; position += 1) {
        const customer = bundle.systemCustomers[position];
        const parsed = parseCustomer(customer);
        if (!parsed.ok || !canonicalEncode(parsed.value).equals(canonicalEncode(customer)) ||
            customer.tenantId !== bundle.tenantId || customer.dataMode !== bundle.dataMode ||
            customerReferences.has(customer.customerReference) ||
            customerDigests.has(customer.customerDigest))
            return false;
        customerReferences.add(customer.customerReference);
        customerDigests.add(customer.customerDigest);
        const previous = bundle.systemCustomers[position - 1];
        if (previous) {
            const digestOrder = compareUtf8(previous.customerDigest, customer.customerDigest);
            if (digestOrder > 0 || (digestOrder === 0 &&
                compareUtf8(previous.customerReference, customer.customerReference) >= 0))
                return false;
        }
    }
    return true;
}
function validateManifestEntryAdmissibility(bundle: FixtureBundle, entry: CandidateManifestEntry) {
    const contacts = intrinsicFilter(bundle.externalContacts, ({ externalUserIdDigest }) => externalUserIdDigest === entry.externalContactDigest);
    const customers = intrinsicFilter(bundle.systemCustomers, ({ customerDigest }) => customerDigest === entry.systemCustomerDigest);
    if (contacts.length !== 1 || customers.length !== 1)
        return false;
    const contact = contacts[0];
    const customer = customers[0];
    return contact.syncStatus === 'mock_ready' &&
        (contact.sourceMappingStatus === 'unmatched' || contact.sourceMappingStatus === 'manual_review_required') &&
        ['not_required', 'pending', 'needs_more_info'].includes(contact.manualReviewState) &&
        customer.statusSummary === 'active' &&
        evidenceFingerprint(deriveEvidence(contact, customer, entry.mockCustomerNumberLinked)) ===
            entry.expectedEvidenceFingerprint;
}
function validateRegistry(registry: Map<string, FixtureBundle>) {
    const entries: Array<readonly [
        string,
        FixtureBundle
    ]> = [];
    reflectApplyIntrinsic(mapForEachIntrinsic, registry, [
        (bundle: FixtureBundle, tenantId: string) => entries.push([tenantId, bundle] as const),
    ]);
    const scopes = new Set<string>();
    const registryDigests = new Set<string>();
    for (let registryPosition = 0; registryPosition < entries.length; registryPosition += 1) {
        const [tenantId, bundle] = entries[registryPosition];
        if (!isSafeRecord(bundle.candidateManifest) ||
            !hasExactKeysInOrder(bundle.candidateManifest as unknown as SafeRecord, MANIFEST_KEYS) ||
            !isSafeRecord(bundle.registryEntry) ||
            !hasExactKeysInOrder(bundle.registryEntry as unknown as SafeRecord, REGISTRY_ENTRY_KEYS) ||
            !isSafeRecord(bundle.readiness) ||
            !hasExactKeysInOrder(bundle.readiness as unknown as SafeRecord, READINESS_KEYS) ||
            tenantId !== bundle.tenantId || scopes.has(bundle.sourceScopeReference) ||
            registryDigests.has(bundle.fixtureRegistryDigest) ||
            bundle.readiness.tenantId !== tenantId || bundle.readiness.dataMode !== bundle.dataMode ||
            validateReadiness(bundle.readiness, '2026-07-13T00:00:00.000Z') ||
            !validateBundleSource(bundle))
            return false;
        scopes.add(bundle.sourceScopeReference);
        registryDigests.add(bundle.fixtureRegistryDigest);
        if (bundle.candidateManifest.tenantId !== bundle.tenantId ||
            bundle.candidateManifest.sourceScopeReference !== bundle.sourceScopeReference ||
            bundle.candidateManifest.sourceSnapshotDigest !== bundle.sourceSnapshotDigest ||
            bundle.candidateManifest.sourceKind !== bundle.sourceKind ||
            bundle.candidateManifest.dataMode !== bundle.dataMode ||
            !canonicalEncode(bundle.candidateManifest.entries).equals(canonicalEncode(bundle.manifestEntries)) ||
            bundle.candidateManifest.containsRealCustomerData !== false ||
            bundle.candidateManifest.fieldWhitelistApplied !== true ||
            bundle.candidateManifest.candidateManifestDigest !== bundle.candidateManifestDigest ||
            bundle.registryEntry.tenantId !== bundle.tenantId ||
            bundle.registryEntry.fixtureRegistryDigest !== bundle.fixtureRegistryDigest ||
            bundle.registryEntry.sourceScopeReference !== bundle.sourceScopeReference ||
            bundle.registryEntry.sourceKind !== bundle.sourceKind ||
            bundle.registryEntry.dataMode !== bundle.dataMode ||
            bundle.registryEntry.externalContactsDigest !== bundle.externalContactsDigest ||
            bundle.registryEntry.systemCustomersDigest !== bundle.systemCustomersDigest ||
            bundle.registryEntry.sourceSnapshotDigest !== bundle.sourceSnapshotDigest ||
            bundle.registryEntry.candidateManifestDigest !== bundle.candidateManifestDigest)
            return false;
        const sourceDigests = calculateSourceDigests(bundle.tenantId, bundle.sourceKind, bundle.dataMode, bundle.externalContacts, bundle.systemCustomers);
        if (bundle.manifestEntries.length > 100 || intrinsicSome(bundle.manifestEntries, (entry) => !isSafeRecord(entry) ||
            !hasExactKeysInOrder(entry as unknown as SafeRecord, MANIFEST_ENTRY_KEYS)) || intrinsicSome(bundle.manifestEntries, (entry, index) => index > 0 && compareManifestEntries(bundle.manifestEntries[index - 1], entry) >= 0) ||
            new Set(intrinsicMap(bundle.manifestEntries, ({ manifestEntryReference }) => manifestEntryReference)).size !==
                bundle.manifestEntries.length ||
            new Set(intrinsicMap(bundle.manifestEntries, ({ externalContactDigest, systemCustomerDigest }) => `${externalContactDigest} ${systemCustomerDigest}`)).size !== bundle.manifestEntries.length)
            return false;
        if (sourceDigests.externalContactsDigest !== bundle.externalContactsDigest ||
            sourceDigests.systemCustomersDigest !== bundle.systemCustomersDigest ||
            sourceDigests.sourceSnapshotDigest !== bundle.sourceSnapshotDigest)
            return false;
        const expectedManifestDigest = digestValues('zmtg:05c-e1:candidate-manifest:v1', [
            bundle.tenantId,
            bundle.sourceScopeReference,
            bundle.sourceSnapshotDigest,
            bundle.sourceKind,
            bundle.dataMode,
            bundle.manifestEntries,
            false,
            true,
        ]);
        if (expectedManifestDigest !== bundle.candidateManifestDigest)
            return false;
        const expectedRegistryDigest = digestValues('zmtg:05c-e1:fixture-registry:v2', [
            bundle.tenantId,
            bundle.sourceScopeReference,
            bundle.sourceKind,
            bundle.dataMode,
            bundle.externalContactsDigest,
            bundle.systemCustomersDigest,
            bundle.sourceSnapshotDigest,
            bundle.candidateManifestDigest,
        ]);
        if (expectedRegistryDigest !== bundle.fixtureRegistryDigest)
            return false;
        for (const entry of bundle.manifestEntries) {
            if (!isGeneralReference(entry.manifestEntryReference) ||
                !isDigest(entry.externalContactDigest) || !isDigest(entry.systemCustomerDigest) ||
                typeof entry.mockCustomerNumberLinked !== 'boolean' ||
                !isDigest(entry.expectedEvidenceFingerprint) ||
                !validateManifestEntryAdmissibility(bundle, entry))
                return false;
        }
    }
    return true;
}
function cloneRegistry(registry: Map<string, FixtureBundle>) {
    const clone = new MapIntrinsic<string, FixtureBundle>();
    reflectApplyIntrinsic(mapForEachIntrinsic, registry, [
        (bundle: FixtureBundle, tenantId: string) => {
            reflectApplyIntrinsic(mapSetIntrinsic, clone, [tenantId, deepClone(bundle)]);
        },
    ]);
    return clone;
}
function validateRegistrySelfTests(registry: Map<string, FixtureBundle>) {
    const digestFlip = cloneRegistry(registry);
    const digestBundle = reflectApplyIntrinsic(mapGetIntrinsic, digestFlip, ['tenant-mock-001']) as FixtureBundle;
    digestBundle.candidateManifestDigest = `sha256:${'f'.repeat(64)}`;
    if (validateRegistry(digestFlip))
        return false;
    const reordered = cloneRegistry(registry);
    const reorderedBundle = reflectApplyIntrinsic(mapGetIntrinsic, reordered, ['tenant-mock-006']) as FixtureBundle;
    intrinsicReverse(reorderedBundle.manifestEntries);
    intrinsicReverse(reorderedBundle.candidateManifest.entries);
    if (validateRegistry(reordered))
        return false;
    const duplicateReference = cloneRegistry(registry);
    const referenceBundle = reflectApplyIntrinsic(mapGetIntrinsic, duplicateReference, ['tenant-mock-006']) as FixtureBundle;
    referenceBundle.manifestEntries[1].manifestEntryReference =
        referenceBundle.manifestEntries[0].manifestEntryReference;
    referenceBundle.candidateManifest.entries[1].manifestEntryReference =
        referenceBundle.candidateManifest.entries[0].manifestEntryReference;
    if (validateRegistry(duplicateReference))
        return false;
    const duplicatePair = cloneRegistry(registry);
    const pairBundle = reflectApplyIntrinsic(mapGetIntrinsic, duplicatePair, ['tenant-mock-006']) as FixtureBundle;
    pairBundle.manifestEntries[1].externalContactDigest = pairBundle.manifestEntries[0].externalContactDigest;
    pairBundle.manifestEntries[1].systemCustomerDigest = pairBundle.manifestEntries[0].systemCustomerDigest;
    pairBundle.candidateManifest.entries[1].externalContactDigest =
        pairBundle.candidateManifest.entries[0].externalContactDigest;
    pairBundle.candidateManifest.entries[1].systemCustomerDigest =
        pairBundle.candidateManifest.entries[0].systemCustomerDigest;
    if (validateRegistry(duplicatePair))
        return false;
    const sharedScope = cloneRegistry(registry);
    const first = reflectApplyIntrinsic(mapGetIntrinsic, sharedScope, ['tenant-mock-001']) as FixtureBundle;
    const second = reflectApplyIntrinsic(mapGetIntrinsic, sharedScope, ['tenant-mock-002']) as FixtureBundle;
    second.sourceScopeReference = first.sourceScopeReference;
    if (validateRegistry(sharedScope))
        return false;
    const missingReadiness = cloneRegistry(registry);
    const readinessBundle = reflectApplyIntrinsic(mapGetIntrinsic, missingReadiness, ['tenant-mock-001']) as FixtureBundle;
    delete (readinessBundle.readiness as unknown as SafeRecord).auditReady;
    return !validateRegistry(missingReadiness);
}
function canonicalAuditString(event: WeComCustomerMappingAuditEvent) {
    const escape = (value: string) => {
        let output = '"';
        for (const character of value) {
            const code = character.codePointAt(0) ?? 0;
            if (character === '"')
                output += '\\"';
            else if (character === '\\')
                output += '\\\\';
            else if (code <= 0x1f)
                output += `\\u${code.toString(16).padStart(4, '0')}`;
            else if (code === 0x2028 || code === 0x2029)
                output += `\\u${code.toString(16)}`;
            else
                output += character;
        }
        return `${output}"`;
    };
    return `{${intrinsicMap(AUDIT_KEYS, (key) => `${escape(key)}:${escape(String(event[key]))}`).join(',')}}`;
}
function createAudit(input: Partial<WeComCustomerMappingAuditEvent> & Pick<WeComCustomerMappingAuditEvent, 'eventType' | 'reasonCode'>) {
    const event = makeRecord<WeComCustomerMappingAuditEvent>([
        ['tenantId', input.tenantId ?? BLOCKED_TENANT],
        ['eventType', input.eventType],
        ['reviewerRole', input.reviewerRole ?? 'domain_system'],
        ['action', input.action ?? 'input_blocked'],
        ['reasonCode', input.reasonCode],
        ['mappingStatusBefore', input.mappingStatusBefore ?? 'not_evaluated'],
        ['mappingStatusAfter', input.mappingStatusAfter ?? 'not_evaluated'],
        ['candidateDigest', input.candidateDigest ?? ZERO_DIGEST],
        ['timestamp', input.timestamp ?? BLOCKED_TIMESTAMP],
        ['sourceKind', input.sourceKind ?? 'input_blocked'],
        ['dataMode', input.dataMode ?? 'input_blocked'],
    ]);
    for (const key of AUDIT_KEYS) {
        const semantic = key === 'candidateDigest' ? 'trusted_digest' as const : 'ordinary' as const;
        if (sensitiveValue(String(event[key]), semantic)) {
            throw new TypeError('audit precondition failed');
        }
    }
    const envelope = canonicalAuditString(event);
    if (/(?:wm_|wo_|token|secret|credential|rawresponse|webhookpayload|apiresponse|聊天内容|会话存档)/iu
        .test(envelope))
        throw new TypeError('audit envelope blocked');
    return event;
}
type AuditResult = {
    ok: true;
    event: WeComCustomerMappingAuditEvent;
} | {
    ok: false;
    event: WeComCustomerMappingAuditEvent;
};
function safeAudit(input: Partial<WeComCustomerMappingAuditEvent> & Pick<WeComCustomerMappingAuditEvent, 'eventType' | 'reasonCode'>): AuditResult {
    try {
        return { ok: true, event: createAudit(input) };
    }
    catch {
        return { ok: false, event: fallbackAuditEvent };
    }
}
function block(registered: WeakSet<object>, failure: ParseFailure, audit: Partial<WeComCustomerMappingAuditEvent> = {}): MappingBlockedResult {
    const auditResult = safeAudit({ ...audit, ...failure });
    return freezeOwned(makeRecord<MappingBlockedResult>([
        ['ok', false],
        ['auditEvent', auditResult.event],
    ]), registered);
}
function freezeOwned<T>(value: T, registered: WeakSet<object>): T {
    const seen = new WeakSet<object>();
    const visit = (current: unknown) => {
        if (typeof current !== 'object' || current === null || seen.has(current))
            return;
        seen.add(current);
        registered.add(current);
        if (Array.isArray(current)) {
            for (const item of current)
                visit(item);
        }
        else {
            for (const key of Object.keys(current))
                visit((current as SafeRecord)[key]);
        }
        objectFreezeIntrinsic(current);
    };
    visit(value);
    return value;
}
function deepClone<T>(value: T): T {
    if (Array.isArray(value))
        return intrinsicMap(value, deepClone) as T;
    if (isSafeRecord(value)) {
        return makeRecord<T & object>(intrinsicMap(Object.keys(value), (key) => [key, deepClone(value[key])])) as T;
    }
    return value;
}
function validateReadiness(readiness: FixtureReadiness, occurredAt: string) {
    if (!isTenantId(readiness.tenantId) || !isGeneralReference(readiness.authorizationReference) ||
        !isDigest(readiness.corpIdDigest) ||
        !['not_configured', 'authorized', 'revoked', 'expired', 'disabled', 'external_disabled',
            'manual_review_required'].includes(readiness.authorizationStatus) ||
        !['mock_only', 'disabled', 'external_disabled'].includes(readiness.providerState) ||
        !(readiness.authorizedAtDate === null || isDate(readiness.authorizedAtDate)) ||
        !(readiness.expiresAtDate === null || isDate(readiness.expiresAtDate)) ||
        !(readiness.lastPreflightAt === null || isTimestamp(readiness.lastPreflightAt)) ||
        !['not_required', 'pending', 'approved', 'rejected', 'needs_more_info'].includes(readiness.manualReviewState) ||
        !['not_started', 'mock_ready', 'preflight_ready', 'syncing_disabled', 'sync_failed',
            'manual_review_required'].includes(readiness.syncStatus) ||
        typeof readiness.auditReady !== 'boolean' ||
        (readiness.dataMode !== 'mock' && readiness.dataMode !== 'demo') ||
        readiness.containsRealCustomerData !== false) {
        return { eventType: 'mapping_input_blocked', reasonCode: 'trusted_readiness_contract_invalid' };
    }
    if (readiness.authorizationStatus === 'authorized') {
        const occurredDate = occurredAt.slice(0, 10);
        if ((readiness.manualReviewState !== 'not_required' && readiness.manualReviewState !== 'approved') ||
            readiness.authorizedAtDate === null || readiness.authorizedAtDate > occurredDate ||
            (readiness.expiresAtDate !== null && readiness.expiresAtDate < occurredDate) ||
            (readiness.lastPreflightAt !== null && readiness.lastPreflightAt > occurredAt)) {
            return { eventType: 'mapping_input_blocked', reasonCode: 'authorization_state_inconsistent' };
        }
    }
    return null;
}
function providerFailure(readiness: FixtureReadiness): ParseFailure | null {
    const authorizationReasons: Record<FixtureReadiness['authorizationStatus'], string | null> = {
        not_configured: 'authorization_not_configured',
        authorized: null,
        revoked: 'authorization_revoked',
        expired: 'authorization_expired',
        disabled: 'authorization_disabled',
        external_disabled: 'external_provider_disabled',
        manual_review_required: 'authorization_manual_review_required',
    };
    const authorizationReason = authorizationReasons[readiness.authorizationStatus];
    if (authorizationReason)
        return { eventType: 'mapping_provider_disabled', reasonCode: authorizationReason };
    if (readiness.providerState === 'disabled') {
        return { eventType: 'mapping_provider_disabled', reasonCode: 'provider_disabled' };
    }
    if (readiness.providerState === 'external_disabled') {
        return { eventType: 'mapping_provider_disabled', reasonCode: 'external_provider_disabled' };
    }
    const syncReasons: Record<FixtureReadiness['syncStatus'], string | null> = {
        mock_ready: null,
        not_started: 'provider_not_started',
        preflight_ready: 'provider_preflight_only',
        syncing_disabled: 'provider_syncing_disabled',
        sync_failed: 'provider_sync_failed',
        manual_review_required: 'provider_manual_review_required',
    };
    const syncReason = syncReasons[readiness.syncStatus];
    return syncReason ? { eventType: 'mapping_provider_disabled', reasonCode: syncReason } : null;
}
function validateTenantAndMode(command: ParsedGenerationCommand, bundle: FixtureBundle): ParseFailure | null {
    const expectedKind = command.dataMode === 'mock'
        ? 'controlled_mock_fixture'
        : 'controlled_demo_fixture';
    if (command.sourceKind !== expectedKind || bundle.sourceKind !== command.sourceKind ||
        bundle.dataMode !== command.dataMode ||
        (command.dataMode === 'mock' && !command.tenantId.startsWith('tenant-mock-')) ||
        (command.dataMode === 'demo' && !command.tenantId.startsWith('tenant-demo-'))) {
        return { eventType: 'mapping_input_blocked', reasonCode: 'source_mode_mismatch' };
    }
    const tenantValues = [
        ...intrinsicFlatMap(command.externalContacts, (contact) => [
            contact.tenantId,
            ...intrinsicMap(contact.followUsers, ({ tenantId }) => tenantId),
            ...intrinsicMap(contact.tags, ({ tenantId }) => tenantId),
        ]),
        ...intrinsicMap(command.systemCustomers, ({ tenantId }) => tenantId),
    ];
    if (intrinsicSome(tenantValues, (tenantId) => tenantId !== command.tenantId)) {
        return { eventType: 'mapping_tenant_mismatch_blocked', reasonCode: 'tenant_mismatch' };
    }
    const modes = [
        ...intrinsicFlatMap(command.externalContacts, (contact) => [
            contact.dataMode,
            ...intrinsicMap(contact.followUsers, ({ dataMode }) => dataMode),
            ...intrinsicMap(contact.tags, ({ dataMode }) => dataMode),
        ]),
        ...intrinsicMap(command.systemCustomers, ({ dataMode }) => dataMode),
    ];
    return intrinsicSome(modes, (mode) => mode !== command.dataMode) ? { eventType: 'mapping_input_blocked', reasonCode: 'source_mode_mismatch' }
        : null;
}
function sourceMatchesBundle(command: ParsedGenerationCommand, bundle: FixtureBundle) {
    const digests = calculateSourceDigests(command.tenantId, command.sourceKind, command.dataMode, command.externalContacts, command.systemCustomers);
    return digests.externalContactsDigest === bundle.externalContactsDigest &&
        digests.systemCustomersDigest === bundle.systemCustomersDigest &&
        digests.sourceSnapshotDigest === bundle.sourceSnapshotDigest;
}
function emptyLineageIndex(bundle: FixtureBundle): LineageLockIndex {
    const base = makeRecord<Omit<LineageLockIndex, 'indexDigest'>>([
        ['tenantId', bundle.tenantId],
        ['sourceScopeReference', bundle.sourceScopeReference],
        ['indexVersion', 1],
        ['complete', true],
        ['records', []],
        ['sourceKind', bundle.sourceKind],
        ['dataMode', bundle.dataMode],
    ]);
    return makeRecord<LineageLockIndex>([
        ['tenantId', base.tenantId],
        ['sourceScopeReference', base.sourceScopeReference],
        ['indexVersion', base.indexVersion],
        ['indexDigest', lineageIndexDigest(base)],
        ['complete', true],
        ['records', []],
        ['sourceKind', base.sourceKind],
        ['dataMode', base.dataMode],
    ]);
}
function buildInitialCandidate(bundle: FixtureBundle, command: ParsedGenerationCommand, manifestIndex: number) {
    const entry = bundle.manifestEntries[manifestIndex];
    const contact = intrinsicFind(command.externalContacts, ({ externalUserIdDigest }) => externalUserIdDigest === entry.externalContactDigest);
    const customer = intrinsicFind(command.systemCustomers, ({ customerDigest }) => customerDigest === entry.systemCustomerDigest);
    if (!contact || !customer)
        return null;
    const evidence = deriveEvidence(contact, customer, entry.mockCustomerNumberLinked);
    const fingerprint = evidenceFingerprint(evidence);
    if (fingerprint !== entry.expectedEvidenceFingerprint)
        return null;
    const { score, level } = confidence(evidence);
    const sameContact = intrinsicFilter(bundle.manifestEntries, ({ externalContactDigest }) => externalContactDigest === entry.externalContactDigest);
    const sameCustomer = intrinsicFilter(bundle.manifestEntries, ({ systemCustomerDigest }) => systemCustomerDigest === entry.systemCustomerDigest);
    const conflictCount = new Set([...sameContact, ...sameCustomer]).size - 1;
    const conflict = conflictCount > 0;
    const originStatus = conflict ? 'conflict' as const : level === 'low'
        ? 'manual_review_required' as const
        : 'candidate' as const;
    const originReason = conflict ? 'mapping_conflict' as const : level === 'low'
        ? 'low_confidence' as const
        : 'candidate_evidence_available' as const;
    const pairDigest = candidatePairDigest(bundle.tenantId, bundle.sourceScopeReference, entry.externalContactDigest, entry.systemCustomerDigest);
    const reference = mappingReference(bundle.tenantId, bundle.sourceScopeReference, pairDigest, fingerprint, bundle.dataMode);
    const candidateDigest = calculateCandidateDigest({
        candidateVersion: 1,
        tenantId: bundle.tenantId,
        mappingReference: reference,
        candidatePairDigest: pairDigest,
        evidenceFingerprint: fingerprint,
        confidenceScore: score,
        confidenceLevel: level,
        originStatus,
        originReason,
        sourceKind: bundle.sourceKind,
        dataMode: bundle.dataMode,
    });
    const target = makeRecord<WeComCustomerMappingCandidate>([
        ['tenantId', bundle.tenantId],
        ['mappingReference', reference],
        ['candidateVersion', 1],
        ['candidateDigest', candidateDigest],
        ['candidatePairDigest', pairDigest],
        ['evidenceFingerprint', fingerprint],
        ['externalContactDigest', entry.externalContactDigest],
        ['systemCustomerDigest', entry.systemCustomerDigest],
        ['mockCustomerNumber', customer.mockCustomerNumber],
        ['systemCustomerSummary', customer.displayNameSummary],
        ['candidateSourceStatus', conflict ? 'conflict_locked' : 'active'],
        ['evidence', evidence],
        ['confidenceScore', score],
        ['confidenceLevel', level],
        ['candidateActive', true],
        ['candidateCleared', false],
        ['candidateRejected', false],
        ['candidateStale', false],
        ['lineageLocked', conflict],
        ['unresolvedConflictCount', conflictCount],
        ['createdAt', command.occurredAt],
        ['sourceKind', bundle.sourceKind],
        ['dataMode', bundle.dataMode],
        ['containsRealCustomerData', false],
        ['autoMergePerformed', false],
        ['realCustomerRelationshipWritten', false],
    ]);
    return { entry, contact, customer, target, originStatus, originReason, conflictCount };
}
function conflictLockForGeneration(bundle: FixtureBundle, target: WeComCustomerMappingCandidate, conflictCount: number) {
    const sameExternal = intrinsicFilter(bundle.manifestEntries, ({ externalContactDigest }) => externalContactDigest === target.externalContactDigest).length > 1;
    const conflictOrigin = sameExternal
        ? 'generation_multiple_system_customers' as const
        : 'generation_multiple_external_contacts' as const;
    const conflictType = sameExternal
        ? 'multiple_system_customers_for_external_contact' as const
        : 'multiple_external_contacts_for_system_customer' as const;
    return makeRecord<LineageLockRecord>([
        ['tenantId', target.tenantId],
        ['sourceScopeReference', bundle.sourceScopeReference],
        ['mappingReference', target.mappingReference],
        ['candidateDigest', target.candidateDigest],
        ['externalContactDigest', target.externalContactDigest],
        ['systemCustomerDigest', target.systemCustomerDigest],
        ['candidatePairDigest', target.candidatePairDigest],
        ['evidenceFingerprint', target.evidenceFingerprint],
        ['sourceSnapshotDigest', bundle.sourceSnapshotDigest],
        ['lockType', 'conflict'],
        ['conflictOrigin', conflictOrigin],
        ['conflictType', conflictType],
        ['unresolvedConflictCount', conflictCount],
        ['createdAt', target.createdAt],
        ['sourceKind', target.sourceKind],
        ['dataMode', target.dataMode],
    ]);
}
function buildMappingConflict(target: WeComCustomerMappingCandidate, record: LineageLockRecord, status: 'unresolved_locked' | 'cleared_locked'): WeComCustomerMappingConflict {
    return makeRecord<WeComCustomerMappingConflict>([
        ['tenantId', target.tenantId],
        ['mappingReference', target.mappingReference],
        ['candidateDigest', target.candidateDigest],
        ['candidatePairDigest', target.candidatePairDigest],
        ['evidenceFingerprint', target.evidenceFingerprint],
        ['conflictType', record.conflictType],
        ['conflictStatus', status],
        ['unresolvedConflictCount', record.unresolvedConflictCount],
        ['manualReviewRequired', status === 'unresolved_locked'],
        ['createdAt', record.createdAt],
        ['sourceKind', target.sourceKind],
        ['dataMode', target.dataMode],
    ]);
}
function appendLineage(index: LineageLockIndex, record: LineageLockRecord): LineageLockIndex | null {
    if (index.records.length >= 1000 || index.indexVersion >= MAX_VERSION)
        return null;
    const records = intrinsicSort([...intrinsicMap(index.records, deepClone), record], (left, right) => {
        for (const key of ['candidatePairDigest', 'evidenceFingerprint', 'mappingReference', 'candidateDigest'] as const) {
            const compared = compareUtf8(left[key], right[key]);
            if (compared !== 0)
                return compared;
        }
        return 0;
    });
    const base = makeRecord<Omit<LineageLockIndex, 'indexDigest'>>([
        ['tenantId', index.tenantId],
        ['sourceScopeReference', index.sourceScopeReference],
        ['indexVersion', index.indexVersion + 1],
        ['complete', true],
        ['records', records],
        ['sourceKind', index.sourceKind],
        ['dataMode', index.dataMode],
    ]);
    return makeRecord<LineageLockIndex>([
        ['tenantId', base.tenantId],
        ['sourceScopeReference', base.sourceScopeReference],
        ['indexVersion', base.indexVersion],
        ['indexDigest', lineageIndexDigest(base)],
        ['complete', true],
        ['records', records],
        ['sourceKind', base.sourceKind],
        ['dataMode', base.dataMode],
    ]);
}
function createEmptyRuntimeState(bundle: FixtureBundle) {
    const lineage = emptyLineageIndex(bundle);
    const base = makeRecord<Omit<SourceScopeRuntimeIndex, 'indexDigest'>>([
        ['tenantId', bundle.tenantId],
        ['sourceScopeReference', bundle.sourceScopeReference],
        ['fixtureRegistryDigest', bundle.fixtureRegistryDigest],
        ['candidateManifestDigest', bundle.candidateManifestDigest],
        ['indexVersion', 1],
        ['indexSnapshotComplete', true],
        ['generationCursor', 0],
        ['generationComplete', true],
        ['records', []],
        ['lineageLockIndex', lineage],
        ['sourceKind', bundle.sourceKind],
        ['dataMode', bundle.dataMode],
    ]);
    const index = makeRecord<SourceScopeRuntimeIndex>([
        ['tenantId', base.tenantId],
        ['sourceScopeReference', base.sourceScopeReference],
        ['fixtureRegistryDigest', base.fixtureRegistryDigest],
        ['candidateManifestDigest', base.candidateManifestDigest],
        ['indexVersion', base.indexVersion],
        ['indexDigest', runtimeIndexDigest(base)],
        ['indexSnapshotComplete', true],
        ['generationCursor', 0],
        ['generationComplete', true],
        ['records', []],
        ['lineageLockIndex', lineage],
        ['sourceKind', base.sourceKind],
        ['dataMode', base.dataMode],
    ]);
    return makeRecord<SourceScopeRuntimeState>([
        ['stateKind', 'source_scope_runtime'],
        ['sourceScopeRuntimeIndex', index],
        ['mappings', []],
    ]);
}
function lineageRecordsBindMappings(state: SourceScopeRuntimeState) {
    const index = state.sourceScopeRuntimeIndex;
    for (const lock of index.lineageLockIndex.records) {
        const positions = intrinsicFilter(intrinsicMap(state.mappings, (mapping, position) => mapping.aggregate.mappingReference === lock.mappingReference ? position : -1), (position) => position >= 0);
        if (positions.length !== 1)
            return false;
        const mapping = state.mappings[positions[0]];
        const historical = intrinsicFind(intrinsicFilter(intrinsicMap(mapping.history.entries, ({ targetSnapshot }) => targetSnapshot), (snapshot): snapshot is WeComCustomerMappingCandidate => snapshot !== null), ({ candidateDigest }) => candidateDigest === lock.candidateDigest);
        if (!historical || lock.tenantId !== mapping.aggregate.tenantId ||
            lock.sourceScopeReference !== mapping.aggregate.sourceScopeReference ||
            lock.externalContactDigest !== historical.externalContactDigest ||
            lock.systemCustomerDigest !== historical.systemCustomerDigest ||
            lock.candidatePairDigest !== historical.candidatePairDigest ||
            lock.evidenceFingerprint !== historical.evidenceFingerprint ||
            lock.sourceSnapshotDigest !== mapping.aggregate.sourceSnapshotDigest ||
            lock.sourceKind !== mapping.aggregate.sourceKind || lock.dataMode !== mapping.aggregate.dataMode)
            return false;
    }
    return true;
}
function committedStateIntegrity(state: SourceScopeRuntimeState, bundle: FixtureBundle | null) {
    const index = state.sourceScopeRuntimeIndex;
    if (!lineageRecordsBindMappings(state))
        return false;
    if (bundle && (index.tenantId !== bundle.tenantId ||
        index.sourceScopeReference !== bundle.sourceScopeReference ||
        index.sourceKind !== bundle.sourceKind || index.dataMode !== bundle.dataMode ||
        index.fixtureRegistryDigest !== bundle.fixtureRegistryDigest ||
        index.candidateManifestDigest !== bundle.candidateManifestDigest ||
        index.generationCursor > bundle.manifestEntries.length ||
        index.generationComplete !== (index.generationCursor === bundle.manifestEntries.length)))
        return false;
    for (let position = 0; position < state.mappings.length; position += 1) {
        const mapping = state.mappings[position];
        const record = index.records[position];
        if (!historySnapshotsSelfConsistent(mapping.history, bundle) ||
            !historicalTargetBinding(mapping.aggregate, mapping.history, record, index.lineageLockIndex))
            return false;
        const historical = currentAfterSnapshot(mapping.history);
        if (intrinsicSome(index.lineageLockIndex.records, (lock) => lock.mappingReference === mapping.aggregate.mappingReference &&
            (lock.tenantId !== mapping.aggregate.tenantId ||
                lock.sourceScopeReference !== mapping.aggregate.sourceScopeReference ||
                lock.sourceSnapshotDigest !== mapping.aggregate.sourceSnapshotDigest ||
                lock.candidatePairDigest !== mapping.aggregate.candidatePairDigest ||
                lock.evidenceFingerprint !== mapping.aggregate.evidenceFingerprint ||
                lock.sourceKind !== mapping.aggregate.sourceKind || lock.dataMode !== mapping.aggregate.dataMode ||
                (historical !== null &&
                    (lock.externalContactDigest !== historical.externalContactDigest ||
                        lock.systemCustomerDigest !== historical.systemCustomerDigest)))))
            return false;
        if (bundle) {
            const manifest = bundle.manifestEntries[position];
            const historical = currentAfterSnapshot(mapping.history);
            if (!manifest || record.manifestEntryReference !== manifest.manifestEntryReference ||
                record.candidatePairDigest !== candidatePairDigest(bundle.tenantId, bundle.sourceScopeReference, manifest.externalContactDigest, manifest.systemCustomerDigest) ||
                historical?.externalContactDigest !== manifest.externalContactDigest ||
                historical?.systemCustomerDigest !== manifest.systemCustomerDigest ||
                mapping.aggregate.sourceSnapshotDigest !== bundle.sourceSnapshotDigest ||
                mapping.aggregate.fixtureRegistryDigest !== bundle.fixtureRegistryDigest ||
                !historical || !targetIntegrity(historical, mapping.history, bundle))
                return false;
        }
        if (mapping.aggregate.mappingStatus === 'disabled') {
            if (mapping.target !== null)
                return false;
        }
        else if (!targetEqualsHistorySnapshot(mapping.aggregate, mapping.target, mapping.history))
            return false;
    }
    return true;
}
function containmentStateIntegrity(state: SourceScopeRuntimeState, quarantinedPosition: number) {
    const index = state.sourceScopeRuntimeIndex;
    if (!lineageRecordsBindMappings(state))
        return false;
    for (let position = 0; position < state.mappings.length; position += 1) {
        const mapping = state.mappings[position];
        const record = index.records[position];
        if (!historySnapshotsSelfConsistent(mapping.history) ||
            !historicalTargetBinding(mapping.aggregate, mapping.history, record, index.lineageLockIndex))
            return false;
        const historical = currentAfterSnapshot(mapping.history);
        if (intrinsicSome(index.lineageLockIndex.records, (lock) => lock.mappingReference === mapping.aggregate.mappingReference &&
            (lock.tenantId !== mapping.aggregate.tenantId ||
                lock.sourceScopeReference !== mapping.aggregate.sourceScopeReference ||
                lock.sourceSnapshotDigest !== mapping.aggregate.sourceSnapshotDigest ||
                lock.candidatePairDigest !== mapping.aggregate.candidatePairDigest ||
                lock.evidenceFingerprint !== mapping.aggregate.evidenceFingerprint ||
                lock.sourceKind !== mapping.aggregate.sourceKind || lock.dataMode !== mapping.aggregate.dataMode ||
                (historical !== null &&
                    (lock.externalContactDigest !== historical.externalContactDigest ||
                        lock.systemCustomerDigest !== historical.systemCustomerDigest)))))
            return false;
        if (position !== quarantinedPosition &&
            !targetEqualsHistorySnapshot(mapping.aggregate, mapping.target, mapping.history))
            return false;
    }
    return true;
}
function validateOutputStrings(value: SafeRecord, digestKeys: readonly string[]) {
    for (const [key, field] of Object.entries(value)) {
        if (typeof field === 'string' && sensitiveValue(field, digestKeys.includes(key) ? 'trusted_digest' :
            key === 'mappingReference' ? 'trusted_mapping_reference' : 'ordinary'))
            return false;
    }
    return true;
}
function validateAuditEvent(value: WeComCustomerMappingAuditEvent) {
    return isSafeRecord(value) && hasExactKeysInOrder(value as unknown as SafeRecord, AUDIT_KEYS) &&
        isTenantId(value.tenantId) &&
        ['domain_system', 'institution_operator', 'platform_governance'].includes(value.reviewerRole) &&
        (weComCustomerMappingActions.includes(value.action as WeComCustomerMappingAction) ||
            value.action === 'input_blocked') &&
        (weComCustomerMappingStatuses.includes(value.mappingStatusBefore as WeComCustomerMappingStatus) ||
            value.mappingStatusBefore === 'not_evaluated') &&
        (weComCustomerMappingStatuses.includes(value.mappingStatusAfter as WeComCustomerMappingStatus) ||
            value.mappingStatusAfter === 'not_evaluated') &&
        isDigest(value.candidateDigest, true) && isTimestamp(value.timestamp) &&
        (value.sourceKind === 'controlled_mock_fixture' ||
            value.sourceKind === 'controlled_demo_fixture' || value.sourceKind === 'input_blocked') &&
        (value.dataMode === 'mock' || value.dataMode === 'demo' || value.dataMode === 'input_blocked') &&
        validateOutputStrings(value as unknown as SafeRecord, ['candidateDigest']) &&
        !/(?:wm_|wo_|token|secret|credential|rawresponse|webhookpayload|apiresponse|聊天内容|会话存档)/iu
            .test(canonicalAuditString(value));
}
function validateReviewOutput(value: WeComCustomerMappingReview) {
    return isSafeRecord(value) &&
        hasExactKeysInOrder(value as unknown as SafeRecord, REVIEW_OUTPUT_KEYS) &&
        isTenantId(value.tenantId) && isMappingReference(value.mappingReference) &&
        isDigest(value.candidateDigest) &&
        !['generate_candidate', 'disable_mapping'].includes(value.action) &&
        (value.reviewerRole === 'institution_operator' || value.reviewerRole === 'platform_governance') &&
        weComCustomerMappingStatuses.includes(value.mappingStatusBefore) &&
        isTimestamp(value.occurredAt) &&
        ['controlled_mock_fixture', 'controlled_demo_fixture'].includes(value.sourceKind) &&
        ['mock', 'demo'].includes(value.dataMode) &&
        validateOutputStrings(value as unknown as SafeRecord, ['candidateDigest']);
}
function validateDecisionOutput(value: WeComCustomerMappingDecision) {
    return isSafeRecord(value) &&
        hasExactKeysInOrder(value as unknown as SafeRecord, DECISION_OUTPUT_KEYS) &&
        isTenantId(value.tenantId) && isMappingReference(value.mappingReference) &&
        isDigest(value.candidateDigest) &&
        !['generate_candidate', 'disable_mapping'].includes(value.action) &&
        (value.reviewerRole === 'institution_operator' || value.reviewerRole === 'platform_governance') &&
        weComCustomerMappingStatuses.includes(value.mappingStatusBefore) &&
        weComCustomerMappingStatuses.includes(value.mappingStatusAfter) &&
        statusReasonPairs.has(`${value.mappingStatusAfter}:${value.reasonCode}`) &&
        isTimestamp(value.occurredAt) &&
        ['controlled_mock_fixture', 'controlled_demo_fixture'].includes(value.sourceKind) &&
        ['mock', 'demo'].includes(value.dataMode) &&
        validateOutputStrings(value as unknown as SafeRecord, ['candidateDigest']);
}
function validateConflictOutput(value: WeComCustomerMappingConflict) {
    return isSafeRecord(value) &&
        hasExactKeysInOrder(value as unknown as SafeRecord, CONFLICT_OUTPUT_KEYS) &&
        isTenantId(value.tenantId) && isMappingReference(value.mappingReference) &&
        isDigest(value.candidateDigest) && isDigest(value.candidatePairDigest) &&
        isDigest(value.evidenceFingerprint) &&
        ['multiple_system_customers_for_external_contact',
            'multiple_external_contacts_for_system_customer', 'manual_marked'].includes(value.conflictType) &&
        (value.conflictStatus === 'unresolved_locked' || value.conflictStatus === 'cleared_locked') &&
        isInteger(value.unresolvedConflictCount, 0, 99) &&
        value.manualReviewRequired === (value.conflictStatus === 'unresolved_locked') &&
        isTimestamp(value.createdAt) &&
        ['controlled_mock_fixture', 'controlled_demo_fixture'].includes(value.sourceKind) &&
        ['mock', 'demo'].includes(value.dataMode) &&
        validateOutputStrings(value as unknown as SafeRecord, ['candidateDigest', 'candidatePairDigest', 'evidenceFingerprint']);
}
function validateDerivedOutput(result: Omit<MappingCommittedResult, 'ok'>, bundle: FixtureBundle | null) {
    if (!committedStateIntegrity(result.nextState, bundle) || !validateAuditEvent(result.auditEvent))
        return false;
    const selected = intrinsicFind(result.nextState.mappings, ({ aggregate }) => result.mappingDecision?.mappingReference === aggregate.mappingReference ||
        result.mappingReview?.mappingReference === aggregate.mappingReference ||
        result.mappingConflict?.mappingReference === aggregate.mappingReference);
    if ((result.mappingReview !== null && !validateReviewOutput(result.mappingReview)) ||
        (result.mappingDecision !== null && !validateDecisionOutput(result.mappingDecision)) ||
        (result.mappingConflict !== null && !validateConflictOutput(result.mappingConflict)))
        return false;
    if (result.action === 'generate_candidate') {
        if (result.mappingReview !== null || result.mappingDecision !== null ||
            (result.resultKind !== 'conflict_detected' && result.mappingConflict !== null) ||
            (result.resultKind === 'conflict_detected' && result.mappingConflict === null))
            return false;
    }
    else if (result.action === 'disable_mapping') {
        if (result.resultKind !== 'mapping_disabled' || result.mappingReview !== null ||
            result.mappingDecision !== null || result.mappingConflict !== null)
            return false;
    }
    else if (!selected || result.resultKind !== (result.action === 'mark_conflict'
        ? 'conflict_detected' : 'review_committed') ||
        result.mappingReview === null || result.mappingDecision === null ||
        result.mappingReview.tenantId !== selected.aggregate.tenantId ||
        result.mappingReview.mappingReference !== selected.aggregate.mappingReference ||
        result.mappingReview.candidateDigest !== result.mappingDecision.candidateDigest ||
        result.mappingReview.action !== result.action || result.mappingDecision.action !== result.action ||
        result.mappingReview.reviewerRole !== result.mappingDecision.reviewerRole ||
        result.mappingReview.mappingStatusBefore !== result.mappingDecision.mappingStatusBefore ||
        result.mappingReview.occurredAt !== result.mappingDecision.occurredAt ||
        result.mappingReview.sourceKind !== result.mappingDecision.sourceKind ||
        result.mappingReview.dataMode !== result.mappingDecision.dataMode ||
        result.mappingDecision.tenantId !== selected.aggregate.tenantId ||
        result.mappingDecision.mappingReference !== selected.aggregate.mappingReference ||
        result.mappingDecision.mappingStatusAfter !== selected.aggregate.mappingStatus ||
        result.mappingDecision.reasonCode !== selected.aggregate.reasonCode ||
        result.mappingDecision.occurredAt !== selected.aggregate.updatedAt ||
        result.mappingDecision.sourceKind !== selected.aggregate.sourceKind ||
        result.mappingDecision.dataMode !== selected.aggregate.dataMode ||
        (result.action !== 'mark_conflict' && result.action !== 'clear_candidate' &&
            result.mappingConflict !== null) ||
        (result.action === 'mark_conflict' && result.mappingConflict === null) ||
        (result.mappingConflict !== null &&
            (result.mappingConflict.tenantId !== selected.aggregate.tenantId ||
                result.mappingConflict.mappingReference !== selected.aggregate.mappingReference ||
                result.mappingConflict.candidateDigest !== result.mappingDecision.candidateDigest ||
                result.mappingConflict.candidatePairDigest !== selected.aggregate.candidatePairDigest ||
                result.mappingConflict.evidenceFingerprint !== selected.aggregate.evidenceFingerprint ||
                result.mappingConflict.sourceKind !== selected.aggregate.sourceKind ||
                result.mappingConflict.dataMode !== selected.aggregate.dataMode)))
        return false;
    return intrinsicEvery(result.nextState.mappings, ({ aggregate, target }) => aggregate.autoMergePerformed === false && aggregate.realCustomerRelationshipWritten === false &&
        (target === null || (target.autoMergePerformed === false &&
            target.realCustomerRelationshipWritten === false)));
}
function committedResult(registered: WeakSet<object>, input: Omit<MappingCommittedResult, 'ok'>, bundle: FixtureBundle | null): MappingCommittedResult | null {
    if (!validateDerivedOutput(input, bundle))
        return null;
    const result = makeRecord<MappingCommittedResult>([
        ['ok', true],
        ['action', input.action],
        ['resultKind', input.resultKind],
        ['nextState', input.nextState],
        ['mappingReview', input.mappingReview],
        ['mappingDecision', input.mappingDecision],
        ['mappingConflict', input.mappingConflict],
        ['auditEvent', input.auditEvent],
    ]);
    return freezeOwned(result, registered);
}
function createInitialState(bundle: FixtureBundle, command: ParsedGenerationCommand, initial: ReturnType<typeof buildInitialCandidate> & object) {
    return appendGeneratedMapping(bundle, command, null, initial);
}
function appendGeneratedMapping(bundle: FixtureBundle, command: ParsedGenerationCommand, previousState: SourceScopeRuntimeState | null, initial: ReturnType<typeof buildInitialCandidate> & object) {
    let lineage = previousState
        ? deepClone(previousState.sourceScopeRuntimeIndex.lineageLockIndex)
        : emptyLineageIndex(bundle);
    let conflictRecord: LineageLockRecord | null = null;
    if (initial.originStatus === 'conflict') {
        conflictRecord = conflictLockForGeneration(bundle, initial.target, initial.conflictCount);
        const appended = appendLineage(lineage, conflictRecord);
        if (!appended)
            return null;
        lineage = appended;
    }
    const historyEntry = makeRecord<MappingHistoryEntry>([
        ['tenantId', bundle.tenantId],
        ['sourceScopeReference', bundle.sourceScopeReference],
        ['mappingReference', initial.target.mappingReference],
        ['historySequence', 1],
        ['aggregateVersionBefore', 0],
        ['aggregateVersionAfter', 1],
        ['action', 'generate_candidate'],
        ['reviewerRole', 'domain_system'],
        ['mappingStatusBefore', 'unmatched'],
        ['mappingStatusAfter', initial.originStatus],
        ['reasonCode', initial.originReason],
        ['targetSnapshotPhase', 'after'],
        ['targetSnapshot', deepClone(initial.target)],
        ['occurredAt', command.occurredAt],
        ['sourceKind', bundle.sourceKind],
        ['dataMode', bundle.dataMode],
    ]);
    const historyBase = makeRecord<Omit<MappingHistory, 'historyDigest'>>([
        ['tenantId', bundle.tenantId],
        ['sourceScopeReference', bundle.sourceScopeReference],
        ['mappingReference', initial.target.mappingReference],
        ['historyVersion', 1],
        ['complete', true],
        ['entries', [historyEntry]],
        ['sourceKind', bundle.sourceKind],
        ['dataMode', bundle.dataMode],
    ]);
    const history = makeRecord<MappingHistory>([
        ['tenantId', historyBase.tenantId],
        ['sourceScopeReference', historyBase.sourceScopeReference],
        ['mappingReference', historyBase.mappingReference],
        ['historyVersion', historyBase.historyVersion],
        ['historyDigest', historyDigest(historyBase)],
        ['complete', true],
        ['entries', historyBase.entries],
        ['sourceKind', historyBase.sourceKind],
        ['dataMode', historyBase.dataMode],
    ]);
    const aggregate = makeRecord<MappingAggregateContext>([
        ['tenantId', bundle.tenantId],
        ['sourceScopeReference', bundle.sourceScopeReference],
        ['mappingReference', initial.target.mappingReference],
        ['aggregateVersion', 1],
        ['mappingStatus', initial.originStatus],
        ['reasonCode', initial.originReason],
        ['candidateDigest', initial.target.candidateDigest],
        ['candidatePairDigest', initial.target.candidatePairDigest],
        ['evidenceFingerprint', initial.target.evidenceFingerprint],
        ['sourceSnapshotDigest', bundle.sourceSnapshotDigest],
        ['fixtureRegistryDigest', bundle.fixtureRegistryDigest],
        ['historyDigest', history.historyDigest],
        ['sourceKind', bundle.sourceKind],
        ['dataMode', bundle.dataMode],
        ['containsRealCustomerData', false],
        ['autoMergePerformed', false],
        ['realCustomerRelationshipWritten', false],
        ['updatedAt', command.occurredAt],
    ]);
    const record = makeRecord<SourceScopeAggregateRecord>([
        ['manifestEntryReference', initial.entry.manifestEntryReference],
        ['candidatePairDigest', initial.target.candidatePairDigest],
        ['evidenceFingerprint', initial.target.evidenceFingerprint],
        ['mappingReference', initial.target.mappingReference],
        ['mappingStatus', initial.originStatus],
        ['aggregateVersion', 1],
        ['candidateDigest', initial.target.candidateDigest],
        ['historyDigest', history.historyDigest],
    ]);
    const previousIndex = previousState?.sourceScopeRuntimeIndex;
    const records = previousIndex
        ? [...intrinsicMap(previousIndex.records, deepClone), record]
        : [record];
    const mappings = previousState
        ? [...intrinsicMap(previousState.mappings, deepClone), makeRecord<SourceScopeMappingState>([
                ['aggregate', aggregate],
                ['target', initial.target],
                ['history', history],
            ])]
        : [makeRecord<SourceScopeMappingState>([
                ['aggregate', aggregate],
                ['target', initial.target],
                ['history', history],
            ])];
    const generationCursor = records.length;
    const indexBase = makeRecord<Omit<SourceScopeRuntimeIndex, 'indexDigest'>>([
        ['tenantId', bundle.tenantId],
        ['sourceScopeReference', bundle.sourceScopeReference],
        ['fixtureRegistryDigest', bundle.fixtureRegistryDigest],
        ['candidateManifestDigest', bundle.candidateManifestDigest],
        ['indexVersion', (previousIndex?.indexVersion ?? 0) + 1],
        ['indexSnapshotComplete', true],
        ['generationCursor', generationCursor],
        ['generationComplete', generationCursor === bundle.manifestEntries.length],
        ['records', records],
        ['lineageLockIndex', lineage],
        ['sourceKind', bundle.sourceKind],
        ['dataMode', bundle.dataMode],
    ]);
    const index = makeRecord<SourceScopeRuntimeIndex>([
        ['tenantId', indexBase.tenantId],
        ['sourceScopeReference', indexBase.sourceScopeReference],
        ['fixtureRegistryDigest', indexBase.fixtureRegistryDigest],
        ['candidateManifestDigest', indexBase.candidateManifestDigest],
        ['indexVersion', indexBase.indexVersion],
        ['indexDigest', runtimeIndexDigest(indexBase)],
        ['indexSnapshotComplete', true],
        ['generationCursor', indexBase.generationCursor],
        ['generationComplete', indexBase.generationComplete],
        ['records', indexBase.records],
        ['lineageLockIndex', indexBase.lineageLockIndex],
        ['sourceKind', indexBase.sourceKind],
        ['dataMode', indexBase.dataMode],
    ]);
    return {
        state: makeRecord<SourceScopeRuntimeState>([
            ['stateKind', 'source_scope_runtime'],
            ['sourceScopeRuntimeIndex', index],
            ['mappings', mappings],
        ]),
        conflictRecord,
    };
}
function parseEvidence(value: unknown): value is WeComCustomerMappingEvidence {
    if (!isSafeRecord(value) || checkExactKeys(value, EVIDENCE_KEYS, false))
        return false;
    for (const key of EVIDENCE_KEYS) {
        const field = value[key];
        if (typeof field === 'string' && sensitiveValue(field))
            return false;
    }
    return isInteger(value.displayNameSimilarity, 0, 100) &&
        typeof value.remarkSummaryMatched === 'boolean' &&
        Array.isArray(value.tagNames) && value.tagNames.length <= 50 && intrinsicEvery(value.tagNames, (tag) => typeof tag === 'string' && isHumanText(tag) && !sensitiveValue(tag)) &&
        typeof value.sourceTypeMatched === 'boolean' && typeof value.addedAtDateMatched === 'boolean' &&
        typeof value.ownerSummaryMatched === 'boolean' && typeof value.digestMatched === 'boolean' &&
        typeof value.mockCustomerNumberMatched === 'boolean' &&
        typeof value.systemCustomerSummaryMatched === 'boolean';
}
function parseTarget(value: unknown): value is WeComCustomerMappingCandidate {
    if (!isSafeRecord(value) || checkExactKeys(value, TARGET_KEYS, false))
        return false;
    for (const key of TARGET_KEYS) {
        const field = value[key];
        if (typeof field === 'string') {
            const semantic = key.endsWith('Digest') ? 'trusted_digest' as const
                : key === 'mappingReference' ? 'trusted_mapping_reference' as const
                    : 'ordinary' as const;
            if (sensitiveValue(field, semantic))
                return false;
        }
    }
    return isTenantId(value.tenantId) && isMappingReference(value.mappingReference) &&
        isInteger(value.candidateVersion, 1, MAX_VERSION) && isDigest(value.candidateDigest) &&
        isDigest(value.candidatePairDigest) && isDigest(value.evidenceFingerprint) &&
        isDigest(value.externalContactDigest) && isDigest(value.systemCustomerDigest) &&
        isMockCustomerNumber(value.mockCustomerNumber) && isHumanText(value.systemCustomerSummary) &&
        ['active', 'inactive', 'stale', 'cleared', 'rejected', 'conflict_locked'].includes(String(value.candidateSourceStatus)) && parseEvidence(value.evidence) && isInteger(value.confidenceScore, 0, 100) &&
        ['low', 'medium', 'high'].includes(String(value.confidenceLevel)) &&
        typeof value.candidateActive === 'boolean' && typeof value.candidateCleared === 'boolean' &&
        typeof value.candidateRejected === 'boolean' && typeof value.candidateStale === 'boolean' &&
        typeof value.lineageLocked === 'boolean' && isInteger(value.unresolvedConflictCount, 0, 99) &&
        isTimestamp(value.createdAt) &&
        ['controlled_mock_fixture', 'controlled_demo_fixture'].includes(String(value.sourceKind)) &&
        ['mock', 'demo'].includes(String(value.dataMode)) && value.containsRealCustomerData === false &&
        value.autoMergePerformed === false && value.realCustomerRelationshipWritten === false;
}
const statusReasonPairs = new Set([
    'candidate:candidate_evidence_available',
    'manual_review_required:low_confidence',
    'manual_review_required:review_reopened',
    'conflict:mapping_conflict',
    'matched:approved_by_manual_review',
    'rejected:rejected_by_manual_review',
    'needs_more_info:more_info_requested',
    'stale:candidate_expired',
    'cleared_locked:candidate_cleared_locked',
    'disabled:mapping_disabled',
]);
function parseAggregate(value: unknown): value is MappingAggregateContext {
    if (!isSafeRecord(value) || checkExactKeys(value, AGGREGATE_KEYS, false))
        return false;
    for (const key of AGGREGATE_KEYS) {
        const field = value[key];
        if (typeof field === 'string') {
            const semantic = key.endsWith('Digest') ? 'trusted_digest' as const
                : key === 'mappingReference' ? 'trusted_mapping_reference' as const
                    : 'ordinary' as const;
            if (sensitiveValue(field, semantic))
                return false;
        }
    }
    return isTenantId(value.tenantId) && isGeneralReference(value.sourceScopeReference) &&
        isMappingReference(value.mappingReference) && isInteger(value.aggregateVersion, 1, MAX_VERSION) &&
        statusReasonPairs.has(`${String(value.mappingStatus)}:${String(value.reasonCode)}`) &&
        (value.candidateDigest === null || isDigest(value.candidateDigest)) &&
        isDigest(value.candidatePairDigest) && isDigest(value.evidenceFingerprint) &&
        isDigest(value.sourceSnapshotDigest) && isDigest(value.fixtureRegistryDigest) &&
        isDigest(value.historyDigest) &&
        ['controlled_mock_fixture', 'controlled_demo_fixture'].includes(String(value.sourceKind)) &&
        ['mock', 'demo'].includes(String(value.dataMode)) && value.containsRealCustomerData === false &&
        value.autoMergePerformed === false && value.realCustomerRelationshipWritten === false &&
        isTimestamp(value.updatedAt);
}
function historyEntryMatchesTransition(entry: MappingHistoryEntry, previousReason: WeComCustomerMappingReasonCode | null) {
    const reviewRole = entry.reviewerRole === 'institution_operator' ||
        entry.reviewerRole === 'platform_governance';
    if (entry.action === 'generate_candidate') {
        const firstGeneration = entry.mappingStatusBefore === 'unmatched';
        const regeneration = entry.mappingStatusBefore === 'stale' ||
            (entry.mappingStatusBefore === 'manual_review_required' && previousReason === 'review_reopened');
        return entry.reviewerRole === 'domain_system' && entry.targetSnapshotPhase === 'after' &&
            entry.targetSnapshot !== null && (firstGeneration || regeneration) &&
            new Set([
                'candidate:candidate_evidence_available',
                'manual_review_required:low_confidence',
                'conflict:mapping_conflict',
            ]).has(`${entry.mappingStatusAfter}:${entry.reasonCode}`);
    }
    if (entry.action === 'disable_mapping') {
        return reviewRole && entry.mappingStatusBefore !== 'disabled' && entry.mappingStatusAfter === 'disabled' &&
            entry.reasonCode === 'mapping_disabled' && entry.targetSnapshotPhase === 'none' &&
            entry.targetSnapshot === null;
    }
    if (!reviewRole || entry.targetSnapshotPhase !== 'after' || entry.targetSnapshot === null ||
        previousReason === null || !reviewTransition(entry.mappingStatusBefore as MappingAggregateContext['mappingStatus'], previousReason, entry.action))
        return false;
    const projection = transitionProjection[entry.action];
    return projection.status === entry.mappingStatusAfter && projection.reason === entry.reasonCode;
}
function parseHistoryEntry(value: unknown): value is MappingHistoryEntry {
    if (!isSafeRecord(value) || !hasExactKeysInOrder(value, HISTORY_ENTRY_KEYS))
        return false;
    for (const key of HISTORY_ENTRY_KEYS) {
        const field = value[key];
        if (typeof field === 'string') {
            const semantic = key === 'mappingReference' ? 'trusted_mapping_reference' as const : 'ordinary' as const;
            if (sensitiveValue(field, semantic))
                return false;
        }
    }
    return isTenantId(value.tenantId) && isGeneralReference(value.sourceScopeReference) &&
        isMappingReference(value.mappingReference) && isInteger(value.historySequence, 1, 1000) &&
        isInteger(value.aggregateVersionBefore, 0, MAX_VERSION) &&
        isInteger(value.aggregateVersionAfter, 1, MAX_VERSION) &&
        weComCustomerMappingActions.includes(value.action as WeComCustomerMappingAction) &&
        ['domain_system', 'institution_operator', 'platform_governance'].includes(String(value.reviewerRole)) &&
        weComCustomerMappingStatuses.includes(value.mappingStatusBefore as WeComCustomerMappingStatus) &&
        weComCustomerMappingStatuses.includes(value.mappingStatusAfter as WeComCustomerMappingStatus) &&
        statusReasonPairs.has(`${String(value.mappingStatusAfter)}:${String(value.reasonCode)}`) &&
        (value.targetSnapshotPhase === 'after' || value.targetSnapshotPhase === 'none') &&
        (value.targetSnapshot === null || parseTarget(value.targetSnapshot)) && isTimestamp(value.occurredAt) &&
        ['controlled_mock_fixture', 'controlled_demo_fixture'].includes(String(value.sourceKind)) &&
        ['mock', 'demo'].includes(String(value.dataMode));
}
function parseHistory(value: unknown): value is MappingHistory {
    if (!isSafeRecord(value) || checkExactKeys(value, HISTORY_KEYS, false))
        return false;
    for (const key of HISTORY_KEYS) {
        const field = value[key];
        if (typeof field === 'string') {
            const semantic = key.endsWith('Digest') ? 'trusted_digest' as const
                : key === 'mappingReference' ? 'trusted_mapping_reference' as const
                    : 'ordinary' as const;
            if (sensitiveValue(field, semantic))
                return false;
        }
    }
    if (!isTenantId(value.tenantId) || !isGeneralReference(value.sourceScopeReference) ||
        !isMappingReference(value.mappingReference) || !isInteger(value.historyVersion, 1, 1000) ||
        !isDigest(value.historyDigest) || value.complete !== true || !Array.isArray(value.entries) ||
        value.entries.length < 1 || value.entries.length > 1000 ||
        !intrinsicEvery(value.entries, parseHistoryEntry) ||
        !['controlled_mock_fixture', 'controlled_demo_fixture'].includes(String(value.sourceKind)) ||
        !['mock', 'demo'].includes(String(value.dataMode)))
        return false;
    const history = value as MappingHistory;
    const withoutDigest = makeRecord<Omit<MappingHistory, 'historyDigest'>>([
        ['tenantId', history.tenantId],
        ['sourceScopeReference', history.sourceScopeReference],
        ['mappingReference', history.mappingReference],
        ['historyVersion', history.historyVersion],
        ['complete', true],
        ['entries', history.entries],
        ['sourceKind', history.sourceKind],
        ['dataMode', history.dataMode],
    ]);
    if (history.historyVersion !== history.entries.length || historyDigest(withoutDigest) !== history.historyDigest) {
        return false;
    }
    for (let index = 0; index < history.entries.length; index += 1) {
        const entry = history.entries[index];
        if (entry.tenantId !== history.tenantId ||
            entry.sourceScopeReference !== history.sourceScopeReference ||
            entry.mappingReference !== history.mappingReference ||
            entry.sourceKind !== history.sourceKind || entry.dataMode !== history.dataMode ||
            entry.historySequence !== index + 1 ||
            entry.aggregateVersionAfter !== entry.aggregateVersionBefore + 1) {
            return false;
        }
        const previous = index === 0 ? null : history.entries[index - 1];
        const previousTarget = previous?.targetSnapshot ?? null;
        if (entry.targetSnapshot !== null) {
            if (entry.action === 'generate_candidate') {
                const expectedVersion = previousTarget === null ? 1 : previousTarget.candidateVersion + 1;
                if (entry.targetSnapshot.candidateVersion !== expectedVersion)
                    return false;
            }
            else if (previousTarget === null ||
                entry.targetSnapshot.candidateVersion !== previousTarget.candidateVersion ||
                entry.targetSnapshot.candidateDigest !== previousTarget.candidateDigest)
                return false;
        }
        if (index === 0) {
            if (entry.aggregateVersionBefore !== 0 || entry.mappingStatusBefore !== 'unmatched' ||
                !historyEntryMatchesTransition(entry, null))
                return false;
        }
        else {
            if (entry.aggregateVersionBefore !== previous!.aggregateVersionAfter ||
                entry.mappingStatusBefore !== previous!.mappingStatusAfter ||
                entry.occurredAt <= previous!.occurredAt ||
                !historyEntryMatchesTransition(entry, previous!.reasonCode))
                return false;
        }
    }
    return true;
}
function parseLineageRecord(value: unknown): value is LineageLockRecord {
    if (!isSafeRecord(value))
        return false;
    const lockType = value.lockType;
    const keys = lockType === 'conflict' ? CONFLICT_LOCK_KEYS : lockType === 'clearance' ? CLEARANCE_LOCK_KEYS : null;
    if (!keys || checkExactKeys(value, keys, false))
        return false;
    for (const key of keys) {
        const field = value[key];
        if (typeof field === 'string') {
            const semantic = key.endsWith('Digest') ? 'trusted_digest' as const
                : key === 'mappingReference' ? 'trusted_mapping_reference' as const
                    : 'ordinary' as const;
            if (sensitiveValue(field, semantic))
                return false;
        }
    }
    if (!isTenantId(value.tenantId) || !isGeneralReference(value.sourceScopeReference) ||
        !isMappingReference(value.mappingReference) || !isDigest(value.candidateDigest) ||
        !isDigest(value.externalContactDigest) || !isDigest(value.systemCustomerDigest) ||
        !isDigest(value.candidatePairDigest) || !isDigest(value.evidenceFingerprint) ||
        !isDigest(value.sourceSnapshotDigest) || !isInteger(value.unresolvedConflictCount, 0, 99) ||
        !isTimestamp(value.createdAt) ||
        !['controlled_mock_fixture', 'controlled_demo_fixture'].includes(String(value.sourceKind)) ||
        !['mock', 'demo'].includes(String(value.dataMode)))
        return false;
    if (lockType === 'clearance')
        return value.unresolvedConflictCount === 0;
    const pair = `${String(value.conflictOrigin)}:${String(value.conflictType)}`;
    return value.unresolvedConflictCount >= 1 && new Set([
        'generation_multiple_system_customers:multiple_system_customers_for_external_contact',
        'generation_multiple_external_contacts:multiple_external_contacts_for_system_customer',
        'manual_review_mark_conflict:manual_marked',
    ]).has(pair);
}
function lineageEnvelopeConsistent(index: LineageLockIndex) {
    return intrinsicEvery(index.records, (record) => record.tenantId === index.tenantId &&
        record.sourceScopeReference === index.sourceScopeReference &&
        record.sourceKind === index.sourceKind && record.dataMode === index.dataMode);
}
function parseLineageIndex(value: unknown): value is LineageLockIndex {
    if (!isSafeRecord(value) || checkExactKeys(value, LINEAGE_INDEX_KEYS, false))
        return false;
    for (const key of LINEAGE_INDEX_KEYS) {
        const field = value[key];
        if (typeof field === 'string') {
            const semantic = key.endsWith('Digest') ? 'trusted_digest' as const : 'ordinary' as const;
            if (sensitiveValue(field, semantic))
                return false;
        }
    }
    if (!isTenantId(value.tenantId) || !isGeneralReference(value.sourceScopeReference) ||
        !isInteger(value.indexVersion, 1, MAX_VERSION) || !isDigest(value.indexDigest) ||
        value.complete !== true || !Array.isArray(value.records) || value.records.length > 1000 ||
        !intrinsicEvery(value.records, parseLineageRecord) ||
        !['controlled_mock_fixture', 'controlled_demo_fixture'].includes(String(value.sourceKind)) ||
        !['mock', 'demo'].includes(String(value.dataMode)))
        return false;
    const index = value as LineageLockIndex;
    const base = makeRecord<Omit<LineageLockIndex, 'indexDigest'>>([
        ['tenantId', index.tenantId],
        ['sourceScopeReference', index.sourceScopeReference],
        ['indexVersion', index.indexVersion],
        ['complete', true],
        ['records', index.records],
        ['sourceKind', index.sourceKind],
        ['dataMode', index.dataMode],
    ]);
    return lineageIndexDigest(base) === index.indexDigest && lineageEnvelopeConsistent(index);
}
function parseScopeRecord(value: unknown): value is SourceScopeAggregateRecord {
    if (!isSafeRecord(value) || checkExactKeys(value, SCOPE_RECORD_KEYS, false))
        return false;
    for (const key of SCOPE_RECORD_KEYS) {
        const field = value[key];
        if (typeof field === 'string') {
            const semantic = key.endsWith('Digest') ? 'trusted_digest' as const
                : key === 'mappingReference' ? 'trusted_mapping_reference' as const
                    : 'ordinary' as const;
            if (sensitiveValue(field, semantic))
                return false;
        }
    }
    return isGeneralReference(value.manifestEntryReference) && isDigest(value.candidatePairDigest) &&
        isDigest(value.evidenceFingerprint) && isMappingReference(value.mappingReference) &&
        weComCustomerMappingStatuses.includes(value.mappingStatus as WeComCustomerMappingStatus) &&
        value.mappingStatus !== 'unmatched' && isInteger(value.aggregateVersion, 1, MAX_VERSION) &&
        (value.candidateDigest === null || isDigest(value.candidateDigest)) && isDigest(value.historyDigest);
}
function runtimeRecordSetsUnique(records: readonly SourceScopeAggregateRecord[]) {
    const manifestReferences = new Set<string>();
    const pairDigests = new Set<string>();
    const mappingReferences = new Set<string>();
    const candidateDigests = new Set<string>();
    for (const record of records) {
        if (manifestReferences.has(record.manifestEntryReference) ||
            pairDigests.has(record.candidatePairDigest) ||
            mappingReferences.has(record.mappingReference) ||
            (record.candidateDigest !== null && candidateDigests.has(record.candidateDigest)))
            return false;
        manifestReferences.add(record.manifestEntryReference);
        pairDigests.add(record.candidatePairDigest);
        mappingReferences.add(record.mappingReference);
        if (record.candidateDigest !== null)
            candidateDigests.add(record.candidateDigest);
    }
    return true;
}
function parseRuntimeState(value: unknown, quarantinedPosition: number | null = null): {
    ok: true;
    value: SourceScopeRuntimeState;
} | {
    ok: false;
    failure: ParseFailure;
} {
    const invalid = (): {
        ok: false;
        failure: ParseFailure;
    } => ({
        ok: false,
        failure: { eventType: 'mapping_input_blocked', reasonCode: 'source_scope_state_invalid' },
    });
    if (!isSafeRecord(value) || checkExactKeys(value, RUNTIME_STATE_KEYS, false) ||
        value.stateKind !== 'source_scope_runtime' || !isSafeRecord(value.sourceScopeRuntimeIndex) ||
        checkExactKeys(value.sourceScopeRuntimeIndex, RUNTIME_INDEX_KEYS, false) || !Array.isArray(value.mappings)) {
        return invalid();
    }
    const rawIndex = value.sourceScopeRuntimeIndex;
    for (const key of RUNTIME_INDEX_KEYS) {
        const field = rawIndex[key];
        if (typeof field === 'string') {
            const semantic = key.endsWith('Digest') ? 'trusted_digest' as const : 'ordinary' as const;
            if (sensitiveValue(field, semantic))
                return invalid();
        }
    }
    if (!isTenantId(rawIndex.tenantId) || !isGeneralReference(rawIndex.sourceScopeReference) ||
        !isDigest(rawIndex.fixtureRegistryDigest) || !isDigest(rawIndex.candidateManifestDigest) ||
        !isInteger(rawIndex.indexVersion, 1, MAX_VERSION) || !isDigest(rawIndex.indexDigest) ||
        rawIndex.indexSnapshotComplete !== true || !isInteger(rawIndex.generationCursor, 0, 100) ||
        typeof rawIndex.generationComplete !== 'boolean' || !Array.isArray(rawIndex.records) ||
        !intrinsicEvery(rawIndex.records, parseScopeRecord) || !parseLineageIndex(rawIndex.lineageLockIndex) ||
        !['controlled_mock_fixture', 'controlled_demo_fixture'].includes(String(rawIndex.sourceKind)) ||
        !['mock', 'demo'].includes(String(rawIndex.dataMode)))
        return invalid();
    const index = rawIndex as SourceScopeRuntimeIndex;
    if (intrinsicReduce(value.mappings, (total, mapping) => total + (isSafeRecord(mapping) && isSafeRecord(mapping.history) && Array.isArray(mapping.history.entries)
        ? mapping.history.entries.length : 0), 0) > 2000 || !runtimeRecordSetsUnique(index.records))
        return invalid();
    if (index.records.length !== index.generationCursor || value.mappings.length !== index.records.length) {
        return invalid();
    }
    const indexBase = makeRecord<Omit<SourceScopeRuntimeIndex, 'indexDigest'>>([
        ['tenantId', index.tenantId],
        ['sourceScopeReference', index.sourceScopeReference],
        ['fixtureRegistryDigest', index.fixtureRegistryDigest],
        ['candidateManifestDigest', index.candidateManifestDigest],
        ['indexVersion', index.indexVersion],
        ['indexSnapshotComplete', true],
        ['generationCursor', index.generationCursor],
        ['generationComplete', index.generationComplete],
        ['records', index.records],
        ['lineageLockIndex', index.lineageLockIndex],
        ['sourceKind', index.sourceKind],
        ['dataMode', index.dataMode],
    ]);
    if (runtimeIndexDigest(indexBase) !== index.indexDigest)
        return invalid();
    const mappings: SourceScopeMappingState[] = [];
    for (let position = 0; position < value.mappings.length; position += 1) {
        const rawMapping = value.mappings[position];
        const quarantineTarget = quarantinedPosition === position;
        if (!isSafeRecord(rawMapping))
            return invalid();
        const mappingKeys = Object.keys(rawMapping);
        const expectedMappingKeys = quarantineTarget
            ? ['aggregate', 'history']
            : [...MAPPING_STATE_KEYS];
        if (intrinsicSome(mappingKeys, (key) => !MAPPING_STATE_KEYS.includes(key as never)) ||
            !intrinsicEvery(expectedMappingKeys, (key) => mappingKeys.includes(key)) ||
            !parseAggregate(rawMapping.aggregate) || !parseHistory(rawMapping.history) ||
            (!quarantineTarget && !(rawMapping.target === null || parseTarget(rawMapping.target))))
            return invalid();
        const mapping = makeRecord<SourceScopeMappingState>([
            ['aggregate', rawMapping.aggregate as MappingAggregateContext],
            ['target', quarantineTarget ? null : rawMapping.target as WeComCustomerMappingCandidate | null],
            ['history', rawMapping.history as MappingHistory],
        ]);
        const record = index.records[position];
        if (mapping.aggregate.tenantId !== index.tenantId ||
            mapping.aggregate.sourceScopeReference !== index.sourceScopeReference ||
            mapping.aggregate.sourceKind !== index.sourceKind || mapping.aggregate.dataMode !== index.dataMode ||
            mapping.aggregate.fixtureRegistryDigest !== index.fixtureRegistryDigest ||
            index.lineageLockIndex.tenantId !== index.tenantId ||
            index.lineageLockIndex.sourceScopeReference !== index.sourceScopeReference ||
            index.lineageLockIndex.sourceKind !== index.sourceKind ||
            index.lineageLockIndex.dataMode !== index.dataMode ||
            mapping.history.tenantId !== index.tenantId ||
            mapping.history.sourceScopeReference !== index.sourceScopeReference ||
            mapping.history.mappingReference !== mapping.aggregate.mappingReference ||
            mapping.history.sourceKind !== index.sourceKind || mapping.history.dataMode !== index.dataMode ||
            mapping.aggregate.mappingReference !== record.mappingReference ||
            mapping.aggregate.mappingStatus !== record.mappingStatus ||
            mapping.aggregate.aggregateVersion !== record.aggregateVersion ||
            mapping.aggregate.candidateDigest !== record.candidateDigest ||
            mapping.aggregate.candidatePairDigest !== record.candidatePairDigest ||
            mapping.aggregate.evidenceFingerprint !== record.evidenceFingerprint ||
            mapping.aggregate.historyDigest !== record.historyDigest ||
            mapping.history.historyDigest !== record.historyDigest ||
            mapping.history.historyVersion !== mapping.aggregate.aggregateVersion ||
            intrinsicAt(mapping.history.entries, -1)?.mappingStatusAfter !== mapping.aggregate.mappingStatus ||
            intrinsicAt(mapping.history.entries, -1)?.reasonCode !== mapping.aggregate.reasonCode ||
            intrinsicAt(mapping.history.entries, -1)?.occurredAt !== mapping.aggregate.updatedAt)
            return invalid();
        if (quarantineTarget) {
            mappings.push(mapping);
            continue;
        }
        if (mapping.aggregate.mappingStatus === 'disabled') {
            if (mapping.aggregate.candidateDigest !== null || mapping.target !== null)
                return invalid();
        }
        else if (!mapping.target || mapping.target.tenantId !== index.tenantId ||
            mapping.target.sourceKind !== index.sourceKind || mapping.target.dataMode !== index.dataMode ||
            mapping.aggregate.candidateDigest !== mapping.target.candidateDigest ||
            mapping.aggregate.mappingReference !== mapping.target.mappingReference ||
            mapping.aggregate.candidatePairDigest !== mapping.target.candidatePairDigest ||
            mapping.aggregate.evidenceFingerprint !== mapping.target.evidenceFingerprint)
            return invalid();
        mappings.push(mapping);
    }
    return { ok: true, value: value as SourceScopeRuntimeState };
}
function currentAfterSnapshot(history: MappingHistory) {
    return intrinsicFind(intrinsicReverse([...history.entries]), ({ targetSnapshotPhase, targetSnapshot }) => targetSnapshotPhase === 'after' && targetSnapshot !== null)?.targetSnapshot ?? null;
}
function candidateSnapshotIntegrity(target: WeComCustomerMappingCandidate, history: MappingHistory) {
    const generations = intrinsicFilter(history.entries, ({ action, targetSnapshot }) => action === 'generate_candidate' && targetSnapshot?.candidateVersion === target.candidateVersion);
    if (generations.length !== 1)
        return false;
    const generation = generations[0];
    if (!['candidate', 'manual_review_required', 'conflict'].includes(generation.mappingStatusAfter))
        return false;
    const origin = generation.targetSnapshot;
    if (!origin || !candidateSnapshotMaterialMatches(origin, target))
        return false;
    const fingerprint = evidenceFingerprint(target.evidence);
    const scored = confidence(target.evidence);
    const pair = candidatePairDigest(target.tenantId, history.sourceScopeReference, target.externalContactDigest, target.systemCustomerDigest);
    const reference = mappingReference(target.tenantId, history.sourceScopeReference, pair, fingerprint, target.dataMode);
    const expected = calculateCandidateDigest({
        candidateVersion: target.candidateVersion,
        tenantId: target.tenantId,
        mappingReference: reference,
        candidatePairDigest: pair,
        evidenceFingerprint: fingerprint,
        confidenceScore: scored.score,
        confidenceLevel: scored.level,
        originStatus: generation.mappingStatusAfter as 'candidate' | 'manual_review_required' | 'conflict',
        originReason: generation.reasonCode as 'candidate_evidence_available' | 'low_confidence' | 'mapping_conflict',
        sourceKind: target.sourceKind,
        dataMode: target.dataMode,
    });
    return fingerprint === target.evidenceFingerprint && scored.score === target.confidenceScore &&
        scored.level === target.confidenceLevel && pair === target.candidatePairDigest &&
        reference === target.mappingReference && generation.occurredAt === target.createdAt &&
        expected === target.candidateDigest;
}
function candidateSnapshotMaterialMatches(left: WeComCustomerMappingCandidate, right: WeComCustomerMappingCandidate) {
    const immutableKeys = [
        'tenantId',
        'mappingReference',
        'candidateVersion',
        'candidateDigest',
        'candidatePairDigest',
        'evidenceFingerprint',
        'externalContactDigest',
        'systemCustomerDigest',
        'mockCustomerNumber',
        'systemCustomerSummary',
        'evidence',
        'confidenceScore',
        'confidenceLevel',
        'createdAt',
        'sourceKind',
        'dataMode',
        'containsRealCustomerData',
        'autoMergePerformed',
        'realCustomerRelationshipWritten',
    ] as const;
    return intrinsicEvery(immutableKeys, (key) => canonicalEncode(left[key]).equals(canonicalEncode(right[key])));
}
function historyEntryTargetMatchesStatus(entry: MappingHistoryEntry) {
    if (entry.targetSnapshot === null)
        return entry.action === 'disable_mapping';
    const aggregate = makeRecord<MappingAggregateContext>([
        ['tenantId', entry.tenantId],
        ['sourceScopeReference', entry.sourceScopeReference],
        ['mappingReference', entry.mappingReference],
        ['aggregateVersion', entry.aggregateVersionAfter],
        ['mappingStatus', entry.mappingStatusAfter],
        ['reasonCode', entry.reasonCode],
        ['candidateDigest', entry.targetSnapshot.candidateDigest],
        ['candidatePairDigest', entry.targetSnapshot.candidatePairDigest],
        ['evidenceFingerprint', entry.targetSnapshot.evidenceFingerprint],
        ['sourceSnapshotDigest', ZERO_DIGEST],
        ['fixtureRegistryDigest', ZERO_DIGEST],
        ['historyDigest', ZERO_DIGEST],
        ['sourceKind', entry.sourceKind],
        ['dataMode', entry.dataMode],
        ['containsRealCustomerData', false],
        ['autoMergePerformed', false],
        ['realCustomerRelationshipWritten', false],
        ['updatedAt', entry.occurredAt],
    ]);
    return targetMatchesStatus(aggregate, entry.targetSnapshot);
}
function historySnapshotsSelfConsistent(history: MappingHistory, bundle: FixtureBundle | null = null) {
    const snapshots = intrinsicFlatMap(history.entries, ({ targetSnapshot }) => targetSnapshot === null ? [] : [targetSnapshot]);
    if (!intrinsicEvery(snapshots, (snapshot) => candidateSnapshotIntegrity(snapshot, history)) ||
        !intrinsicEvery(history.entries, historyEntryTargetMatchesStatus))
        return false;
    for (const snapshot of snapshots) {
        const origin = intrinsicFind(snapshots, ({ candidateVersion }) => candidateVersion === snapshot.candidateVersion);
        if (!origin || !candidateSnapshotMaterialMatches(origin, snapshot))
            return false;
        if (bundle && !targetIntegrity(snapshot, history, bundle))
            return false;
    }
    return true;
}
function historicalTargetBinding(aggregate: MappingAggregateContext, history: MappingHistory, record: SourceScopeAggregateRecord, lineage: LineageLockIndex) {
    const historical = currentAfterSnapshot(history);
    if (!historical)
        return false;
    const pair = candidatePairDigest(historical.tenantId, aggregate.sourceScopeReference, historical.externalContactDigest, historical.systemCustomerDigest);
    const reference = mappingReference(historical.tenantId, aggregate.sourceScopeReference, pair, historical.evidenceFingerprint, historical.dataMode);
    if (!historySnapshotsSelfConsistent(history) ||
        historical.tenantId !== aggregate.tenantId ||
        historical.mappingReference !== aggregate.mappingReference ||
        pair !== historical.candidatePairDigest || reference !== historical.mappingReference ||
        historical.candidatePairDigest !== aggregate.candidatePairDigest ||
        historical.evidenceFingerprint !== aggregate.evidenceFingerprint ||
        historical.sourceKind !== aggregate.sourceKind || historical.dataMode !== aggregate.dataMode)
        return false;
    if (aggregate.mappingStatus === 'disabled') {
        return aggregate.candidateDigest === null && record.candidateDigest === null;
    }
    return aggregate.candidateDigest === historical.candidateDigest &&
        record.candidateDigest === historical.candidateDigest &&
        targetMatchesStatus(aggregate, historical) && lineageMatchesTarget(aggregate, historical, lineage);
}
function targetEqualsHistorySnapshot(aggregate: MappingAggregateContext, target: WeComCustomerMappingCandidate | null, history: MappingHistory) {
    if (aggregate.mappingStatus === 'disabled')
        return target === null;
    const snapshot = currentAfterSnapshot(history);
    return target !== null && snapshot !== null && canonicalEncode(target).equals(canonicalEncode(snapshot));
}
function lineageMatchesTarget(aggregate: MappingAggregateContext, target: WeComCustomerMappingCandidate, lineage: LineageLockIndex) {
    const records = intrinsicFilter(lineage.records, ({ mappingReference, candidateDigest }) => mappingReference === aggregate.mappingReference && candidateDigest === target.candidateDigest);
    const candidateLocks = intrinsicFilter(lineage.records, ({ candidateDigest }) => candidateDigest === target.candidateDigest);
    if (candidateLocks.length !== records.length)
        return false;
    if (target.lineageLocked) {
        if (records.length !== 1)
            return false;
        const record = records[0];
        const expectedLockType = aggregate.mappingStatus === 'conflict' ? 'conflict' :
            aggregate.mappingStatus === 'cleared_locked' ? record.lockType : null;
        return expectedLockType !== null && record.lockType === expectedLockType &&
            record.tenantId === aggregate.tenantId &&
            record.sourceScopeReference === aggregate.sourceScopeReference &&
            record.mappingReference === target.mappingReference &&
            record.candidateDigest === target.candidateDigest &&
            record.externalContactDigest === target.externalContactDigest &&
            record.systemCustomerDigest === target.systemCustomerDigest &&
            record.candidatePairDigest === target.candidatePairDigest &&
            record.evidenceFingerprint === target.evidenceFingerprint &&
            record.sourceSnapshotDigest === aggregate.sourceSnapshotDigest &&
            record.unresolvedConflictCount === target.unresolvedConflictCount &&
            record.sourceKind === aggregate.sourceKind && record.dataMode === aggregate.dataMode;
    }
    return target.unresolvedConflictCount === 0 && records.length === 0;
}
function targetIntegrity(target: WeComCustomerMappingCandidate, history: MappingHistory, bundle: FixtureBundle) {
    const entry = intrinsicFind(bundle.manifestEntries, ({ externalContactDigest, systemCustomerDigest }) => externalContactDigest === target.externalContactDigest && systemCustomerDigest === target.systemCustomerDigest);
    if (!entry)
        return false;
    const contact = intrinsicFind(bundle.externalContacts, ({ externalUserIdDigest }) => externalUserIdDigest === target.externalContactDigest);
    const customer = intrinsicFind(bundle.systemCustomers, ({ customerDigest }) => customerDigest === target.systemCustomerDigest);
    if (!contact || !customer)
        return false;
    const evidence = deriveEvidence(contact, customer, entry.mockCustomerNumberLinked);
    const fingerprint = evidenceFingerprint(evidence);
    const scored = confidence(evidence);
    const generation = intrinsicFind(intrinsicReverse([...history.entries]), ({ action, targetSnapshot }) => action === 'generate_candidate' && targetSnapshot?.candidateVersion === target.candidateVersion);
    if (!generation || generation.targetSnapshot?.candidateVersion !== target.candidateVersion ||
        !['candidate', 'manual_review_required', 'conflict'].includes(generation.mappingStatusAfter)) {
        return false;
    }
    const originStatus = generation.mappingStatusAfter as 'candidate' | 'manual_review_required' | 'conflict';
    const originReason = generation.reasonCode as 'candidate_evidence_available' | 'low_confidence' | 'mapping_conflict';
    const pair = candidatePairDigest(target.tenantId, bundle.sourceScopeReference, target.externalContactDigest, target.systemCustomerDigest);
    const reference = mappingReference(target.tenantId, bundle.sourceScopeReference, pair, fingerprint, target.dataMode);
    const digest = calculateCandidateDigest({
        candidateVersion: target.candidateVersion,
        tenantId: target.tenantId,
        mappingReference: reference,
        candidatePairDigest: pair,
        evidenceFingerprint: fingerprint,
        confidenceScore: scored.score,
        confidenceLevel: scored.level,
        originStatus,
        originReason,
        sourceKind: target.sourceKind,
        dataMode: target.dataMode,
    });
    return canonicalEncode(evidence).equals(canonicalEncode(target.evidence)) &&
        fingerprint === target.evidenceFingerprint && scored.score === target.confidenceScore &&
        scored.level === target.confidenceLevel && pair === target.candidatePairDigest &&
        reference === target.mappingReference && digest === target.candidateDigest &&
        target.mockCustomerNumber === customer.mockCustomerNumber &&
        target.systemCustomerSummary === customer.displayNameSummary;
}
function targetMatchesStatus(aggregate: MappingAggregateContext, target: WeComCustomerMappingCandidate | null) {
    const status = aggregate.mappingStatus;
    if (status === 'disabled')
        return target === null;
    if (!target)
        return false;
    if (status === 'candidate' || (status === 'manual_review_required' && aggregate.reasonCode === 'low_confidence')) {
        return target.candidateSourceStatus === 'active' && target.candidateActive && !target.candidateCleared &&
            !target.candidateRejected && !target.candidateStale && !target.lineageLocked &&
            target.unresolvedConflictCount === 0;
    }
    if (status === 'manual_review_required') {
        return target.candidateSourceStatus === 'inactive' && !target.candidateActive &&
            !target.candidateCleared && !target.candidateRejected && !target.candidateStale &&
            !target.lineageLocked && target.unresolvedConflictCount === 0;
    }
    if (status === 'conflict') {
        return target.candidateSourceStatus === 'conflict_locked' && target.candidateActive &&
            !target.candidateCleared && !target.candidateRejected && !target.candidateStale &&
            target.lineageLocked && target.unresolvedConflictCount >= 1;
    }
    if (status === 'matched') {
        return target.candidateSourceStatus === 'inactive' && !target.candidateActive &&
            !target.candidateCleared && !target.candidateRejected && !target.candidateStale &&
            !target.lineageLocked && target.unresolvedConflictCount === 0;
    }
    if (status === 'rejected') {
        return target.candidateSourceStatus === 'rejected' && !target.candidateActive &&
            !target.candidateCleared && target.candidateRejected && !target.candidateStale &&
            !target.lineageLocked && target.unresolvedConflictCount === 0;
    }
    if (status === 'needs_more_info') {
        return target.candidateSourceStatus === 'active' && target.candidateActive &&
            !target.candidateCleared && !target.candidateRejected && !target.candidateStale &&
            !target.lineageLocked && target.unresolvedConflictCount === 0;
    }
    if (status === 'stale') {
        return target.candidateSourceStatus === 'stale' && !target.candidateActive &&
            !target.candidateCleared && !target.candidateRejected && target.candidateStale &&
            !target.lineageLocked && target.unresolvedConflictCount === 0;
    }
    return status === 'cleared_locked' && target.candidateSourceStatus === 'cleared' &&
        !target.candidateActive && target.candidateCleared && !target.candidateRejected &&
        !target.candidateStale && target.lineageLocked && target.unresolvedConflictCount >= 0;
}
function reviewTransition(status: MappingAggregateContext['mappingStatus'], reason: WeComCustomerMappingReasonCode, action: ParsedReviewCommand['action']) {
    const allowed: Record<string, ParsedReviewCommand['action'][]> = {
        candidate: ['approve', 'reject', 'request_more_info', 'mark_conflict', 'clear_candidate', 'expire_candidate'],
        manual_review_required_low_confidence: ['approve', 'reject', 'request_more_info', 'mark_conflict', 'clear_candidate', 'expire_candidate'],
        manual_review_required_review_reopened: [],
        matched: ['reopen'],
        rejected: ['reopen'],
        needs_more_info: ['reject', 'clear_candidate', 'reopen', 'expire_candidate'],
        conflict: ['clear_candidate'],
        cleared_locked: [],
        stale: [],
        disabled: [],
    };
    const key = status === 'manual_review_required' ? `${status}_${reason}` : status;
    return allowed[key]?.includes(action) ?? false;
}
const transitionProjection: Record<ParsedReviewCommand['action'], {
    status: MappingAggregateContext['mappingStatus'];
    reason: WeComCustomerMappingReasonCode;
    event: string;
}> = {
    approve: { status: 'matched', reason: 'approved_by_manual_review', event: 'mapping_approved' },
    reject: { status: 'rejected', reason: 'rejected_by_manual_review', event: 'mapping_rejected' },
    request_more_info: { status: 'needs_more_info', reason: 'more_info_requested', event: 'mapping_more_info_requested' },
    mark_conflict: { status: 'conflict', reason: 'mapping_conflict', event: 'mapping_conflict_detected' },
    clear_candidate: { status: 'cleared_locked', reason: 'candidate_cleared_locked', event: 'mapping_candidate_cleared' },
    reopen: { status: 'manual_review_required', reason: 'review_reopened', event: 'mapping_reopened' },
    expire_candidate: { status: 'stale', reason: 'candidate_expired', event: 'mapping_candidate_expired' },
};
function updatedTarget(target: WeComCustomerMappingCandidate, action: ParsedReviewCommand['action']): WeComCustomerMappingCandidate {
    const copy = deepClone(target) as unknown as SafeRecord;
    if (action === 'approve' || action === 'reopen') {
        copy.candidateSourceStatus = 'inactive';
        copy.candidateActive = false;
        copy.candidateCleared = false;
        copy.candidateRejected = false;
        copy.candidateStale = false;
        copy.lineageLocked = false;
        copy.unresolvedConflictCount = 0;
    }
    else if (action === 'reject') {
        copy.candidateSourceStatus = 'rejected';
        copy.candidateActive = false;
        copy.candidateRejected = true;
        copy.candidateCleared = false;
        copy.candidateStale = false;
        copy.lineageLocked = false;
        copy.unresolvedConflictCount = 0;
    }
    else if (action === 'request_more_info') {
        copy.candidateSourceStatus = 'active';
        copy.candidateActive = true;
        copy.candidateCleared = false;
        copy.candidateRejected = false;
        copy.candidateStale = false;
        copy.lineageLocked = false;
        copy.unresolvedConflictCount = 0;
    }
    else if (action === 'mark_conflict') {
        copy.candidateSourceStatus = 'conflict_locked';
        copy.candidateActive = true;
        copy.candidateCleared = false;
        copy.candidateRejected = false;
        copy.candidateStale = false;
        copy.lineageLocked = true;
        copy.unresolvedConflictCount = 1;
    }
    else if (action === 'clear_candidate') {
        copy.candidateSourceStatus = 'cleared';
        copy.candidateActive = false;
        copy.candidateCleared = true;
        copy.candidateRejected = false;
        copy.candidateStale = false;
        copy.lineageLocked = true;
    }
    else {
        copy.candidateSourceStatus = 'stale';
        copy.candidateActive = false;
        copy.candidateCleared = false;
        copy.candidateRejected = false;
        copy.candidateStale = true;
        copy.lineageLocked = false;
        copy.unresolvedConflictCount = 0;
    }
    return recordFrom(copy, [...TARGET_KEYS]) as unknown as WeComCustomerMappingCandidate;
}
function createManualConflictLock(bundle: FixtureBundle, target: WeComCustomerMappingCandidate, occurredAt: string) {
    return makeRecord<LineageLockRecord>([
        ['tenantId', target.tenantId],
        ['sourceScopeReference', bundle.sourceScopeReference],
        ['mappingReference', target.mappingReference],
        ['candidateDigest', target.candidateDigest],
        ['externalContactDigest', target.externalContactDigest],
        ['systemCustomerDigest', target.systemCustomerDigest],
        ['candidatePairDigest', target.candidatePairDigest],
        ['evidenceFingerprint', target.evidenceFingerprint],
        ['sourceSnapshotDigest', bundle.sourceSnapshotDigest],
        ['lockType', 'conflict'],
        ['conflictOrigin', 'manual_review_mark_conflict'],
        ['conflictType', 'manual_marked'],
        ['unresolvedConflictCount', 1],
        ['createdAt', occurredAt],
        ['sourceKind', target.sourceKind],
        ['dataMode', target.dataMode],
    ]);
}
function createClearanceLock(bundle: FixtureBundle, target: WeComCustomerMappingCandidate, occurredAt: string) {
    return makeRecord<LineageLockRecord>([
        ['tenantId', target.tenantId],
        ['sourceScopeReference', bundle.sourceScopeReference],
        ['mappingReference', target.mappingReference],
        ['candidateDigest', target.candidateDigest],
        ['externalContactDigest', target.externalContactDigest],
        ['systemCustomerDigest', target.systemCustomerDigest],
        ['candidatePairDigest', target.candidatePairDigest],
        ['evidenceFingerprint', target.evidenceFingerprint],
        ['sourceSnapshotDigest', bundle.sourceSnapshotDigest],
        ['lockType', 'clearance'],
        ['unresolvedConflictCount', 0],
        ['createdAt', occurredAt],
        ['sourceKind', target.sourceKind],
        ['dataMode', target.dataMode],
    ]);
}
function rebuildCandidate(bundle: FixtureBundle, command: ParsedGenerationCommand, state: SourceScopeRuntimeState, position: number, registered: WeakSet<object>): MappingCommandResult {
    const mapping = state.mappings[position];
    const aggregate = mapping.aggregate;
    const index = state.sourceScopeRuntimeIndex;
    if (index.sourceScopeReference !== bundle.sourceScopeReference ||
        index.sourceKind !== bundle.sourceKind || index.dataMode !== bundle.dataMode ||
        index.fixtureRegistryDigest !== bundle.fixtureRegistryDigest ||
        index.candidateManifestDigest !== bundle.candidateManifestDigest ||
        aggregate.sourceSnapshotDigest !== bundle.sourceSnapshotDigest ||
        aggregate.fixtureRegistryDigest !== bundle.fixtureRegistryDigest ||
        !targetEqualsHistorySnapshot(aggregate, mapping.target, mapping.history) ||
        !targetMatchesStatus(aggregate, mapping.target) || !mapping.target ||
        !targetIntegrity(mapping.target, mapping.history, bundle) ||
        !lineageMatchesTarget(aggregate, mapping.target, index.lineageLockIndex)) {
        return block(registered, {
            eventType: 'mapping_input_blocked',
            reasonCode: 'trusted_target_integrity_invalid',
        });
    }
    if (aggregate.mappingStatus !== 'stale' &&
        !(aggregate.mappingStatus === 'manual_review_required' && aggregate.reasonCode === 'review_reopened')) {
        return block(registered, { eventType: 'mapping_invalid_transition_blocked', reasonCode: 'invalid_state_transition' }, {
            tenantId: command.tenantId,
            action: 'generate_candidate',
            timestamp: command.occurredAt,
            sourceKind: bundle.sourceKind,
            dataMode: bundle.dataMode,
            mappingStatusBefore: aggregate.mappingStatus,
            mappingStatusAfter: aggregate.mappingStatus,
        });
    }
    if (command.occurredAt <= aggregate.updatedAt || mapping.history.historyVersion >= 1000 ||
        aggregate.aggregateVersion >= MAX_VERSION || index.indexVersion >= MAX_VERSION ||
        mapping.target.candidateVersion >= MAX_VERSION) {
        const reasonCode = mapping.target.candidateVersion >= MAX_VERSION
            ? 'history_capacity_exceeded'
            : command.occurredAt <= aggregate.updatedAt
                ? 'non_monotonic_occurred_at'
                : 'history_capacity_exceeded';
        return block(registered, { eventType: 'mapping_input_blocked', reasonCode }, {
            tenantId: command.tenantId,
            action: 'generate_candidate',
            timestamp: command.occurredAt,
            sourceKind: bundle.sourceKind,
            dataMode: bundle.dataMode,
            mappingStatusBefore: aggregate.mappingStatus,
            mappingStatusAfter: aggregate.mappingStatus,
        });
    }
    const initial = buildInitialCandidate(bundle, command, position);
    if (!initial || !mapping.target) {
        return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'untrusted_fixture_provenance' });
    }
    const nextVersion = mapping.target.candidateVersion + 1;
    const nextDigest = calculateCandidateDigest({
        candidateVersion: nextVersion,
        tenantId: initial.target.tenantId,
        mappingReference: initial.target.mappingReference,
        candidatePairDigest: initial.target.candidatePairDigest,
        evidenceFingerprint: initial.target.evidenceFingerprint,
        confidenceScore: initial.target.confidenceScore,
        confidenceLevel: initial.target.confidenceLevel,
        originStatus: initial.originStatus,
        originReason: initial.originReason,
        sourceKind: initial.target.sourceKind,
        dataMode: initial.target.dataMode,
    });
    const target = makeRecord<WeComCustomerMappingCandidate>(intrinsicMap(TARGET_KEYS, (key) => [
        key,
        key === 'candidateVersion' ? nextVersion
            : key === 'candidateDigest' ? nextDigest
                : key === 'createdAt' ? command.occurredAt
                    : initial.target[key],
    ]));
    const historyCommand = makeRecord<ParsedReviewCommand>([
        ['tenantId', command.tenantId],
        ['mappingReference', aggregate.mappingReference],
        ['candidateDigest', target.candidateDigest],
        ['action', 'expire_candidate'],
        ['reviewerRole', 'institution_operator'],
        ['occurredAt', command.occurredAt],
    ]);
    const historyEntry = makeRecord<MappingHistoryEntry>([
        ['tenantId', aggregate.tenantId],
        ['sourceScopeReference', aggregate.sourceScopeReference],
        ['mappingReference', aggregate.mappingReference],
        ['historySequence', mapping.history.historyVersion + 1],
        ['aggregateVersionBefore', aggregate.aggregateVersion],
        ['aggregateVersionAfter', aggregate.aggregateVersion + 1],
        ['action', 'generate_candidate'],
        ['reviewerRole', 'domain_system'],
        ['mappingStatusBefore', aggregate.mappingStatus],
        ['mappingStatusAfter', initial.originStatus],
        ['reasonCode', initial.originReason],
        ['targetSnapshotPhase', 'after'],
        ['targetSnapshot', deepClone(target)],
        ['occurredAt', command.occurredAt],
        ['sourceKind', aggregate.sourceKind],
        ['dataMode', aggregate.dataMode],
    ]);
    void historyCommand;
    const entries = [...intrinsicMap(mapping.history.entries, deepClone), historyEntry];
    const historyBase = makeRecord<Omit<MappingHistory, 'historyDigest'>>([
        ['tenantId', mapping.history.tenantId],
        ['sourceScopeReference', mapping.history.sourceScopeReference],
        ['mappingReference', mapping.history.mappingReference],
        ['historyVersion', mapping.history.historyVersion + 1],
        ['complete', true],
        ['entries', entries],
        ['sourceKind', mapping.history.sourceKind],
        ['dataMode', mapping.history.dataMode],
    ]);
    const history = makeRecord<MappingHistory>([
        ['tenantId', historyBase.tenantId],
        ['sourceScopeReference', historyBase.sourceScopeReference],
        ['mappingReference', historyBase.mappingReference],
        ['historyVersion', historyBase.historyVersion],
        ['historyDigest', historyDigest(historyBase)],
        ['complete', true],
        ['entries', historyBase.entries],
        ['sourceKind', historyBase.sourceKind],
        ['dataMode', historyBase.dataMode],
    ]);
    const nextAggregate = makeRecord<MappingAggregateContext>(intrinsicMap(AGGREGATE_KEYS, (key) => [
        key,
        key === 'aggregateVersion' ? aggregate.aggregateVersion + 1
            : key === 'mappingStatus' ? initial.originStatus
                : key === 'reasonCode' ? initial.originReason
                    : key === 'candidateDigest' ? target.candidateDigest
                        : key === 'historyDigest' ? history.historyDigest
                            : key === 'updatedAt' ? command.occurredAt
                                : aggregate[key],
    ]));
    const nextState = replaceMappingState(state, position, nextAggregate, target, history, deepClone(state.sourceScopeRuntimeIndex.lineageLockIndex));
    const audit = safeAudit({
        tenantId: command.tenantId,
        eventType: initial.originStatus === 'manual_review_required'
            ? 'mapping_manual_review_requested'
            : 'mapping_candidate_generated',
        reviewerRole: 'domain_system',
        action: 'generate_candidate',
        reasonCode: initial.originReason,
        mappingStatusBefore: aggregate.mappingStatus,
        mappingStatusAfter: initial.originStatus,
        candidateDigest: target.candidateDigest,
        timestamp: command.occurredAt,
        sourceKind: bundle.sourceKind,
        dataMode: bundle.dataMode,
    });
    if (!audit.ok)
        return freezeOwned(makeRecord<MappingBlockedResult>([
            ['ok', false],
            ['auditEvent', audit.event],
        ]), registered);
    const committed = committedResult(registered, {
        action: 'generate_candidate',
        resultKind: initial.originStatus === 'manual_review_required'
            ? 'manual_review_requested'
            : 'candidate_generated',
        nextState,
        mappingReview: null,
        mappingDecision: null,
        mappingConflict: null,
        auditEvent: audit.event,
    }, bundle);
    return committed ?? block(registered, {
        eventType: 'mapping_input_blocked',
        reasonCode: 'derived_output_contract_invalid',
    });
}
function appendHistory(history: MappingHistory, aggregate: MappingAggregateContext, command: ParsedReviewCommand | ParsedDisableCommand, status: MappingAggregateContext['mappingStatus'], reason: WeComCustomerMappingReasonCode, target: WeComCustomerMappingCandidate | null, disable: boolean) {
    const entry = makeRecord<MappingHistoryEntry>([
        ['tenantId', aggregate.tenantId],
        ['sourceScopeReference', aggregate.sourceScopeReference],
        ['mappingReference', aggregate.mappingReference],
        ['historySequence', history.historyVersion + 1],
        ['aggregateVersionBefore', aggregate.aggregateVersion],
        ['aggregateVersionAfter', aggregate.aggregateVersion + 1],
        ['action', command.action],
        ['reviewerRole', command.reviewerRole],
        ['mappingStatusBefore', aggregate.mappingStatus],
        ['mappingStatusAfter', status],
        ['reasonCode', reason],
        ['targetSnapshotPhase', disable ? 'none' : 'after'],
        ['targetSnapshot', disable ? null : deepClone(target)],
        ['occurredAt', command.occurredAt],
        ['sourceKind', aggregate.sourceKind],
        ['dataMode', aggregate.dataMode],
    ]);
    const entries = [...intrinsicMap(history.entries, deepClone), entry];
    const base = makeRecord<Omit<MappingHistory, 'historyDigest'>>([
        ['tenantId', history.tenantId],
        ['sourceScopeReference', history.sourceScopeReference],
        ['mappingReference', history.mappingReference],
        ['historyVersion', history.historyVersion + 1],
        ['complete', true],
        ['entries', entries],
        ['sourceKind', history.sourceKind],
        ['dataMode', history.dataMode],
    ]);
    return makeRecord<MappingHistory>([
        ['tenantId', base.tenantId],
        ['sourceScopeReference', base.sourceScopeReference],
        ['mappingReference', base.mappingReference],
        ['historyVersion', base.historyVersion],
        ['historyDigest', historyDigest(base)],
        ['complete', true],
        ['entries', base.entries],
        ['sourceKind', base.sourceKind],
        ['dataMode', base.dataMode],
    ]);
}
function replaceMappingState(state: SourceScopeRuntimeState, position: number, aggregate: MappingAggregateContext, target: WeComCustomerMappingCandidate | null, history: MappingHistory, lineage: LineageLockIndex) {
    const mappings = intrinsicMap(state.mappings, (mapping, index) => index === position
        ? makeRecord<SourceScopeMappingState>([
            ['aggregate', aggregate],
            ['target', target],
            ['history', history],
        ])
        : deepClone(mapping));
    const records = intrinsicMap(state.sourceScopeRuntimeIndex.records, (record, index) => index === position
        ? makeRecord<SourceScopeAggregateRecord>([
            ['manifestEntryReference', record.manifestEntryReference],
            ['candidatePairDigest', aggregate.candidatePairDigest],
            ['evidenceFingerprint', aggregate.evidenceFingerprint],
            ['mappingReference', aggregate.mappingReference],
            ['mappingStatus', aggregate.mappingStatus],
            ['aggregateVersion', aggregate.aggregateVersion],
            ['candidateDigest', aggregate.candidateDigest],
            ['historyDigest', history.historyDigest],
        ])
        : deepClone(record));
    const previous = state.sourceScopeRuntimeIndex;
    const base = makeRecord<Omit<SourceScopeRuntimeIndex, 'indexDigest'>>([
        ['tenantId', previous.tenantId],
        ['sourceScopeReference', previous.sourceScopeReference],
        ['fixtureRegistryDigest', previous.fixtureRegistryDigest],
        ['candidateManifestDigest', previous.candidateManifestDigest],
        ['indexVersion', previous.indexVersion + 1],
        ['indexSnapshotComplete', true],
        ['generationCursor', previous.generationCursor],
        ['generationComplete', previous.generationComplete],
        ['records', records],
        ['lineageLockIndex', lineage],
        ['sourceKind', previous.sourceKind],
        ['dataMode', previous.dataMode],
    ]);
    const index = makeRecord<SourceScopeRuntimeIndex>([
        ['tenantId', base.tenantId],
        ['sourceScopeReference', base.sourceScopeReference],
        ['fixtureRegistryDigest', base.fixtureRegistryDigest],
        ['candidateManifestDigest', base.candidateManifestDigest],
        ['indexVersion', base.indexVersion],
        ['indexDigest', runtimeIndexDigest(base)],
        ['indexSnapshotComplete', true],
        ['generationCursor', base.generationCursor],
        ['generationComplete', base.generationComplete],
        ['records', base.records],
        ['lineageLockIndex', base.lineageLockIndex],
        ['sourceKind', base.sourceKind],
        ['dataMode', base.dataMode],
    ]);
    return makeRecord<SourceScopeRuntimeState>([
        ['stateKind', 'source_scope_runtime'],
        ['sourceScopeRuntimeIndex', index],
        ['mappings', mappings],
    ]);
}
function createWeComCustomerMappingDomainInternal(registry: Map<string, FixtureBundle>): WeComCustomerMappingDomain {
    const registered = new WeakSet<object>();
    const getBundle = (tenantId: string) => reflectApplyIntrinsic(mapGetIntrinsic, registry, [tenantId]) as FixtureBundle | undefined;
    const capture = (value: unknown) => capturePublic(value, registered);
    function generateCandidate(rawCommand: unknown, rawState: unknown): MappingCommandResult {
        if (arguments.length !== 2)
            return block(registered, scalarFailure('invalid_payload_shape'));
        const captured = capture(rawCommand);
        if (!captured.ok)
            return block(registered, scalarFailure('invalid_payload_shape'));
        const parsed = parseGeneration(captured.value);
        if (!parsed.ok)
            return block(registered, parsed.failure);
        const command = parsed.value;
        const bundle = getBundle(command.tenantId);
        if (!bundle) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'untrusted_fixture_provenance' });
        }
        const bindingFailure = validateTenantAndMode(command, bundle);
        if (bindingFailure) {
            return block(registered, bindingFailure, {
                timestamp: command.occurredAt,
                sourceKind: command.sourceKind,
                dataMode: command.dataMode,
            });
        }
        if (!sourceMatchesBundle(command, bundle)) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'untrusted_fixture_provenance' }, {
                tenantId: command.tenantId,
                timestamp: command.occurredAt,
                sourceKind: command.sourceKind,
                dataMode: command.dataMode,
                action: 'generate_candidate',
                mappingStatusBefore: 'unmatched',
                mappingStatusAfter: 'unmatched',
            });
        }
        let existingState: SourceScopeRuntimeState | null = null;
        if (rawState !== null) {
            const capturedIndex = captureGenerationIndex(rawState, registered);
            if (!capturedIndex.ok) {
                return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'source_scope_state_invalid' });
            }
            if (capturedIndex.index.tenantId !== command.tenantId ||
                capturedIndex.index.fixtureRegistryDigest !== bundle.fixtureRegistryDigest ||
                capturedIndex.index.candidateManifestDigest !== bundle.candidateManifestDigest) {
                return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'untrusted_fixture_provenance' });
            }
            if (!capturedIndex.index.generationComplete) {
                const cursor = capturedIndex.index.generationCursor;
                const expectedReference = bundle.manifestEntries[cursor]?.manifestEntryReference;
                if (command.manifestEntryReference !== expectedReference) {
                    return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'generation_incomplete' }, {
                        tenantId: command.tenantId,
                        timestamp: command.occurredAt,
                        sourceKind: command.sourceKind,
                        dataMode: command.dataMode,
                        action: 'generate_candidate',
                    });
                }
            }
            const capturedState = capture(rawState);
            if (!capturedState.ok) {
                return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'source_scope_state_invalid' });
            }
            const parsedState = parseRuntimeState(capturedState.value);
            if (!parsedState.ok)
                return block(registered, parsedState.failure);
            existingState = parsedState.value;
        }
        const readinessContractFailure = validateReadiness(bundle.readiness, command.occurredAt);
        if (readinessContractFailure) {
            return block(registered, readinessContractFailure, {
                tenantId: command.tenantId,
                timestamp: command.occurredAt,
                sourceKind: command.sourceKind,
                dataMode: command.dataMode,
                action: 'generate_candidate',
            });
        }
        if (!bundle.readiness.auditReady) {
            return block(registered, { eventType: 'mapping_audit_not_ready_blocked', reasonCode: 'audit_not_ready' }, {
                tenantId: command.tenantId,
                timestamp: command.occurredAt,
                sourceKind: command.sourceKind,
                dataMode: command.dataMode,
                action: 'generate_candidate',
                mappingStatusBefore: 'unmatched',
                mappingStatusAfter: 'unmatched',
            });
        }
        const readinessFailure = providerFailure(bundle.readiness);
        if (readinessFailure) {
            return block(registered, readinessFailure, {
                tenantId: command.tenantId,
                timestamp: command.occurredAt,
                sourceKind: command.sourceKind,
                dataMode: command.dataMode,
                action: 'generate_candidate',
                mappingStatusBefore: 'unmatched',
                mappingStatusAfter: 'unmatched',
            });
        }
        const manifestIndex = intrinsicFindIndex(bundle.manifestEntries, ({ manifestEntryReference }) => manifestEntryReference === command.manifestEntryReference);
        const continuation = existingState !== null &&
            !existingState.sourceScopeRuntimeIndex.generationComplete;
        const expectedManifestIndex = continuation && existingState !== null
            ? existingState.sourceScopeRuntimeIndex.generationCursor
            : existingState === null ? 0 : manifestIndex;
        if (command.manifestEntryReference === null && existingState === null &&
            bundle.manifestEntries.length === 0) {
            const nextState = createEmptyRuntimeState(bundle);
            const audit = safeAudit({
                tenantId: command.tenantId,
                eventType: 'mapping_candidate_generation_empty',
                reviewerRole: 'domain_system',
                action: 'generate_candidate',
                reasonCode: 'no_eligible_candidate',
                mappingStatusBefore: 'unmatched',
                mappingStatusAfter: 'unmatched',
                candidateDigest: ZERO_DIGEST,
                timestamp: command.occurredAt,
                sourceKind: command.sourceKind,
                dataMode: command.dataMode,
            });
            if (!audit.ok)
                return freezeOwned(makeRecord<MappingBlockedResult>([
                    ['ok', false],
                    ['auditEvent', audit.event],
                ]), registered);
            const committed = committedResult(registered, {
                action: 'generate_candidate',
                resultKind: 'no_candidate',
                nextState,
                mappingReview: null,
                mappingDecision: null,
                mappingConflict: null,
                auditEvent: audit.event,
            }, bundle);
            return committed ?? block(registered, {
                eventType: 'mapping_input_blocked',
                reasonCode: 'derived_output_contract_invalid',
            });
        }
        if (manifestIndex !== expectedManifestIndex) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'generation_cursor_mismatch' }, {
                tenantId: command.tenantId,
                timestamp: command.occurredAt,
                sourceKind: command.sourceKind,
                dataMode: command.dataMode,
                action: 'generate_candidate',
                mappingStatusBefore: 'unmatched',
                mappingStatusAfter: 'unmatched',
            });
        }
        if (continuation && existingState !== null) {
            if (existingState.sourceScopeRuntimeIndex.indexVersion >= MAX_VERSION) {
                return block(registered, {
                    eventType: 'mapping_input_blocked',
                    reasonCode: 'source_scope_index_capacity_exceeded',
                });
            }
            const initial = buildInitialCandidate(bundle, command, manifestIndex);
            if (!initial) {
                return block(registered, {
                    eventType: 'mapping_input_blocked',
                    reasonCode: 'untrusted_fixture_provenance',
                });
            }
            const built = appendGeneratedMapping(bundle, command, existingState, initial);
            if (!built) {
                return block(registered, {
                    eventType: 'mapping_locked_candidate_reuse_blocked',
                    reasonCode: 'lineage_index_invalid',
                });
            }
            const audit = safeAudit({
                tenantId: command.tenantId,
                eventType: initial.originStatus === 'conflict'
                    ? 'mapping_conflict_detected'
                    : initial.originStatus === 'manual_review_required'
                        ? 'mapping_manual_review_requested'
                        : 'mapping_candidate_generated',
                reviewerRole: 'domain_system',
                action: 'generate_candidate',
                reasonCode: initial.originReason,
                mappingStatusBefore: 'unmatched',
                mappingStatusAfter: initial.originStatus,
                candidateDigest: initial.target.candidateDigest,
                timestamp: command.occurredAt,
                sourceKind: command.sourceKind,
                dataMode: command.dataMode,
            });
            if (!audit.ok)
                return freezeOwned(makeRecord<MappingBlockedResult>([
                    ['ok', false],
                    ['auditEvent', audit.event],
                ]), registered);
            const committed = committedResult(registered, {
                action: 'generate_candidate',
                resultKind: initial.originStatus === 'conflict'
                    ? 'conflict_detected'
                    : initial.originStatus === 'manual_review_required'
                        ? 'manual_review_requested'
                        : 'candidate_generated',
                nextState: built.state,
                mappingReview: null,
                mappingDecision: null,
                mappingConflict: built.conflictRecord
                    ? buildMappingConflict(initial.target, built.conflictRecord, 'unresolved_locked')
                    : null,
                auditEvent: audit.event,
            }, bundle);
            return committed ?? block(registered, {
                eventType: 'mapping_input_blocked',
                reasonCode: 'derived_output_contract_invalid',
            });
        }
        if (existingState !== null) {
            const position = intrinsicFindIndex(existingState.sourceScopeRuntimeIndex.records, ({ manifestEntryReference }) => manifestEntryReference === command.manifestEntryReference);
            if (position < 0) {
                return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'generation_cursor_mismatch' });
            }
            return rebuildCandidate(bundle, command, existingState, position, registered);
        }
        const initial = buildInitialCandidate(bundle, command, manifestIndex);
        if (!initial) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'untrusted_fixture_provenance' }, {
                tenantId: command.tenantId,
                timestamp: command.occurredAt,
                sourceKind: command.sourceKind,
                dataMode: command.dataMode,
                action: 'generate_candidate',
                mappingStatusBefore: 'unmatched',
                mappingStatusAfter: 'unmatched',
            });
        }
        const built = createInitialState(bundle, command, initial);
        if (!built) {
            return block(registered, { eventType: 'mapping_locked_candidate_reuse_blocked', reasonCode: 'lineage_index_invalid' }, {
                tenantId: command.tenantId,
                timestamp: command.occurredAt,
                sourceKind: command.sourceKind,
                dataMode: command.dataMode,
                action: 'generate_candidate',
                mappingStatusBefore: 'unmatched',
                mappingStatusAfter: 'unmatched',
            });
        }
        const eventType = initial.originStatus === 'conflict'
            ? 'mapping_conflict_detected'
            : initial.originStatus === 'manual_review_required'
                ? 'mapping_manual_review_requested'
                : 'mapping_candidate_generated';
        const resultKind = initial.originStatus === 'conflict'
            ? 'conflict_detected' as const
            : initial.originStatus === 'manual_review_required'
                ? 'manual_review_requested' as const
                : 'candidate_generated' as const;
        const generationAudit = safeAudit({
            tenantId: command.tenantId,
            eventType,
            reviewerRole: 'domain_system',
            action: 'generate_candidate',
            reasonCode: initial.originReason,
            mappingStatusBefore: 'unmatched',
            mappingStatusAfter: initial.originStatus,
            candidateDigest: initial.target.candidateDigest,
            timestamp: command.occurredAt,
            sourceKind: command.sourceKind,
            dataMode: command.dataMode,
        });
        if (!generationAudit.ok)
            return freezeOwned(makeRecord<MappingBlockedResult>([
                ['ok', false],
                ['auditEvent', generationAudit.event],
            ]), registered);
        const committed = committedResult(registered, {
            action: 'generate_candidate',
            resultKind,
            nextState: built.state,
            mappingReview: null,
            mappingDecision: null,
            mappingConflict: built.conflictRecord
                ? buildMappingConflict(initial.target, built.conflictRecord, 'unresolved_locked')
                : null,
            auditEvent: generationAudit.event,
        }, bundle);
        return committed ?? block(registered, {
            eventType: 'mapping_input_blocked',
            reasonCode: 'derived_output_contract_invalid',
        });
    }
    function reviewCandidate(rawCommand: unknown, rawState: unknown): MappingCommandResult {
        if (arguments.length !== 2)
            return block(registered, scalarFailure('invalid_payload_shape'));
        const capturedCommand = capture(rawCommand);
        if (!capturedCommand.ok)
            return block(registered, scalarFailure('invalid_payload_shape'));
        const parsed = parseReview(capturedCommand.value);
        if (!parsed.ok)
            return block(registered, parsed.failure);
        const command = parsed.value;
        const capturedIndex = captureGenerationIndex(rawState, registered);
        if (!capturedIndex.ok) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'source_scope_state_invalid' }, {
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
            });
        }
        const earlyIndex = capturedIndex.index;
        const earlyBundle = getBundle(earlyIndex.tenantId);
        if (!earlyBundle || earlyBundle.fixtureRegistryDigest !== earlyIndex.fixtureRegistryDigest ||
            earlyBundle.candidateManifestDigest !== earlyIndex.candidateManifestDigest) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'untrusted_fixture_provenance' }, {
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
            });
        }
        if (command.tenantId !== earlyIndex.tenantId) {
            return block(registered, { eventType: 'mapping_tenant_mismatch_blocked', reasonCode: 'tenant_mismatch' }, {
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
                sourceKind: earlyIndex.sourceKind,
                dataMode: earlyIndex.dataMode,
            });
        }
        if (!earlyIndex.generationComplete) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'generation_incomplete' }, {
                tenantId: command.tenantId,
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
                sourceKind: earlyIndex.sourceKind,
                dataMode: earlyIndex.dataMode,
            });
        }
        const capturedState = capture(rawState);
        if (!capturedState.ok)
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'source_scope_state_invalid' }, {
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
            });
        const parsedState = parseRuntimeState(capturedState.value);
        if (!parsedState.ok)
            return block(registered, parsedState.failure, {
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
            });
        const state = parsedState.value;
        const index = state.sourceScopeRuntimeIndex;
        if (!lineageRecordsBindMappings(state)) {
            return block(registered, {
                eventType: 'mapping_locked_candidate_reuse_blocked',
                reasonCode: 'lineage_index_invalid',
            }, {
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
                sourceKind: index.sourceKind,
                dataMode: index.dataMode,
            });
        }
        const bundle = getBundle(index.tenantId);
        if (!bundle || bundle.fixtureRegistryDigest !== index.fixtureRegistryDigest ||
            bundle.candidateManifestDigest !== index.candidateManifestDigest) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'untrusted_fixture_provenance' }, {
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
            });
        }
        if (index.sourceScopeReference !== bundle.sourceScopeReference ||
            index.sourceKind !== bundle.sourceKind || index.dataMode !== bundle.dataMode) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'source_mode_mismatch' }, {
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
            });
        }
        if (command.tenantId !== index.tenantId) {
            return block(registered, { eventType: 'mapping_tenant_mismatch_blocked', reasonCode: 'tenant_mismatch' }, {
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
                sourceKind: index.sourceKind,
                dataMode: index.dataMode,
            });
        }
        if (!index.generationComplete) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'generation_incomplete' }, {
                tenantId: command.tenantId,
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
                sourceKind: index.sourceKind,
                dataMode: index.dataMode,
            });
        }
        const positions = intrinsicFilter(intrinsicMap(index.records, (record, position) => record.mappingReference === command.mappingReference ? position : -1), (position) => position >= 0);
        if (positions.length !== 1) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'aggregate_lineage_mismatch' }, {
                tenantId: command.tenantId,
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
                sourceKind: index.sourceKind,
                dataMode: index.dataMode,
            });
        }
        const position = positions[0];
        const mapping = state.mappings[position];
        const aggregate = mapping.aggregate;
        const trustedAudit: Partial<{
            -readonly [Key in keyof WeComCustomerMappingAuditEvent]: WeComCustomerMappingAuditEvent[Key];
        }> = {
            tenantId: command.tenantId,
            timestamp: command.occurredAt,
            action: command.action,
            reviewerRole: command.reviewerRole,
            sourceKind: index.sourceKind,
            dataMode: index.dataMode,
            mappingStatusBefore: aggregate.mappingStatus,
            mappingStatusAfter: aggregate.mappingStatus,
        };
        if (aggregate.sourceSnapshotDigest !== bundle.sourceSnapshotDigest ||
            aggregate.fixtureRegistryDigest !== bundle.fixtureRegistryDigest) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'trusted_target_integrity_invalid' }, trustedAudit);
        }
        if (!targetEqualsHistorySnapshot(aggregate, mapping.target, mapping.history) ||
            !targetMatchesStatus(aggregate, mapping.target)) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'status_reason_mismatch' }, trustedAudit);
        }
        if (aggregate.mappingStatus === 'disabled') {
            if (!historicalTargetBinding(aggregate, mapping.history, index.records[position], index.lineageLockIndex)) {
                return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'aggregate_lineage_mismatch' }, trustedAudit);
            }
            return block(registered, { eventType: 'mapping_invalid_transition_blocked', reasonCode: 'invalid_state_transition' }, trustedAudit);
        }
        if (!mapping.target || !targetIntegrity(mapping.target, mapping.history, bundle)) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'trusted_target_integrity_invalid' }, trustedAudit);
        }
        if (!lineageMatchesTarget(aggregate, mapping.target, index.lineageLockIndex)) {
            return block(registered, { eventType: 'mapping_candidate_guard_blocked', reasonCode: 'unresolved_conflict' }, trustedAudit);
        }
        trustedAudit.candidateDigest = mapping.target.candidateDigest;
        if (command.candidateDigest !== mapping.target.candidateDigest) {
            return block(registered, { eventType: 'mapping_candidate_guard_blocked', reasonCode: 'candidate_target_not_found' }, trustedAudit);
        }
        if (command.occurredAt <= aggregate.updatedAt) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'non_monotonic_occurred_at' }, trustedAudit);
        }
        if (!bundle.readiness.auditReady) {
            return block(registered, { eventType: 'mapping_audit_not_ready_blocked', reasonCode: 'audit_not_ready' }, trustedAudit);
        }
        const readinessFailure = providerFailure(bundle.readiness);
        if (readinessFailure)
            return block(registered, readinessFailure, trustedAudit);
        if (!reviewTransition(aggregate.mappingStatus, aggregate.reasonCode, command.action)) {
            return block(registered, { eventType: 'mapping_invalid_transition_blocked', reasonCode: 'invalid_state_transition' }, trustedAudit);
        }
        if (mapping.history.historyVersion >= 1000) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'history_capacity_exceeded' }, trustedAudit);
        }
        if (intrinsicReduce(state.mappings, (total, current) => total + current.history.entries.length, 0) >= 2000) {
            return block(registered, {
                eventType: 'mapping_input_blocked',
                reasonCode: 'source_scope_history_capacity_exceeded',
            }, trustedAudit);
        }
        if (index.indexVersion >= MAX_VERSION) {
            return block(registered, {
                eventType: 'mapping_input_blocked',
                reasonCode: 'source_scope_index_capacity_exceeded',
            }, trustedAudit);
        }
        const projection = transitionProjection[command.action];
        const nextTarget = updatedTarget(mapping.target, command.action);
        let lineage = deepClone(index.lineageLockIndex);
        let conflictRecord: LineageLockRecord | null = null;
        if (command.action === 'mark_conflict') {
            conflictRecord = createManualConflictLock(bundle, nextTarget, command.occurredAt);
            const appended = appendLineage(lineage, conflictRecord);
            if (!appended) {
                return block(registered, { eventType: 'mapping_locked_candidate_reuse_blocked', reasonCode: 'lineage_index_invalid' }, trustedAudit);
            }
            lineage = appended;
        }
        else if (command.action === 'clear_candidate') {
            conflictRecord = intrinsicFind(lineage.records, (record) => record.lockType === 'conflict' &&
                record.mappingReference === nextTarget.mappingReference &&
                record.candidateDigest === nextTarget.candidateDigest &&
                record.candidatePairDigest === nextTarget.candidatePairDigest &&
                record.evidenceFingerprint === nextTarget.evidenceFingerprint) ?? null;
            if (!conflictRecord) {
                const clearance = createClearanceLock(bundle, nextTarget, command.occurredAt);
                const appended = appendLineage(lineage, clearance);
                if (!appended) {
                    return block(registered, { eventType: 'mapping_locked_candidate_reuse_blocked', reasonCode: 'lineage_index_invalid' }, trustedAudit);
                }
                lineage = appended;
            }
        }
        const history = appendHistory(mapping.history, aggregate, command, projection.status, projection.reason, nextTarget, false);
        const nextAggregate = makeRecord<MappingAggregateContext>([
            ['tenantId', aggregate.tenantId],
            ['sourceScopeReference', aggregate.sourceScopeReference],
            ['mappingReference', aggregate.mappingReference],
            ['aggregateVersion', aggregate.aggregateVersion + 1],
            ['mappingStatus', projection.status],
            ['reasonCode', projection.reason],
            ['candidateDigest', aggregate.candidateDigest],
            ['candidatePairDigest', aggregate.candidatePairDigest],
            ['evidenceFingerprint', aggregate.evidenceFingerprint],
            ['sourceSnapshotDigest', aggregate.sourceSnapshotDigest],
            ['fixtureRegistryDigest', aggregate.fixtureRegistryDigest],
            ['historyDigest', history.historyDigest],
            ['sourceKind', aggregate.sourceKind],
            ['dataMode', aggregate.dataMode],
            ['containsRealCustomerData', false],
            ['autoMergePerformed', false],
            ['realCustomerRelationshipWritten', false],
            ['updatedAt', command.occurredAt],
        ]);
        const nextState = replaceMappingState(state, position, nextAggregate, nextTarget, history, lineage);
        const mappingReview = makeRecord<WeComCustomerMappingReview>([
            ['tenantId', command.tenantId],
            ['mappingReference', aggregate.mappingReference],
            ['candidateDigest', mapping.target.candidateDigest],
            ['action', command.action],
            ['reviewerRole', command.reviewerRole],
            ['mappingStatusBefore', aggregate.mappingStatus],
            ['occurredAt', command.occurredAt],
            ['sourceKind', aggregate.sourceKind],
            ['dataMode', aggregate.dataMode],
        ]);
        const mappingDecision = makeRecord<WeComCustomerMappingDecision>([
            ['tenantId', command.tenantId],
            ['mappingReference', aggregate.mappingReference],
            ['candidateDigest', mapping.target.candidateDigest],
            ['action', command.action],
            ['reviewerRole', command.reviewerRole],
            ['mappingStatusBefore', aggregate.mappingStatus],
            ['mappingStatusAfter', projection.status],
            ['reasonCode', projection.reason],
            ['occurredAt', command.occurredAt],
            ['sourceKind', aggregate.sourceKind],
            ['dataMode', aggregate.dataMode],
        ]);
        const mappingConflict = command.action === 'mark_conflict' && conflictRecord
            ? buildMappingConflict(nextTarget, conflictRecord, 'unresolved_locked')
            : command.action === 'clear_candidate' && conflictRecord
                ? buildMappingConflict(nextTarget, conflictRecord, 'cleared_locked')
                : null;
        const audit = safeAudit({
            ...trustedAudit,
            eventType: projection.event,
            reasonCode: projection.reason,
            mappingStatusAfter: projection.status,
        });
        if (!audit.ok)
            return freezeOwned(makeRecord<MappingBlockedResult>([
                ['ok', false],
                ['auditEvent', audit.event],
            ]), registered);
        const committed = committedResult(registered, {
            action: command.action,
            resultKind: command.action === 'mark_conflict' ? 'conflict_detected' : 'review_committed',
            nextState,
            mappingReview,
            mappingDecision,
            mappingConflict,
            auditEvent: audit.event,
        }, bundle);
        return committed ?? block(registered, {
            eventType: 'mapping_input_blocked',
            reasonCode: 'derived_output_contract_invalid',
        });
    }
    function disableMapping(rawCommand: unknown, rawState: unknown): MappingCommandResult {
        if (arguments.length !== 2)
            return block(registered, scalarFailure('invalid_payload_shape'));
        const capturedCommand = capture(rawCommand);
        if (!capturedCommand.ok)
            return block(registered, scalarFailure('invalid_payload_shape'));
        const parsed = parseDisable(capturedCommand.value);
        if (!parsed.ok)
            return block(registered, parsed.failure);
        const command = parsed.value;
        const capturedState = captureDisableState(rawState, command.mappingReference, registered);
        if (!capturedState.ok)
            return block(registered, capturedState.failure, {
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
            });
        const parsedState = parseRuntimeState(capturedState.value, capturedState.position);
        if (!parsedState.ok)
            return block(registered, parsedState.failure, {
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
            });
        const state = parsedState.value;
        const index = state.sourceScopeRuntimeIndex;
        if (command.tenantId !== index.tenantId) {
            return block(registered, { eventType: 'mapping_tenant_mismatch_blocked', reasonCode: 'tenant_mismatch' }, {
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
                sourceKind: index.sourceKind,
                dataMode: index.dataMode,
            });
        }
        const positions = intrinsicFilter(intrinsicMap(index.records, (record, position) => record.mappingReference === command.mappingReference ? position : -1), (position) => position >= 0);
        if (positions.length !== 1) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'aggregate_lineage_mismatch' }, {
                tenantId: command.tenantId,
                timestamp: command.occurredAt,
                action: command.action,
                reviewerRole: command.reviewerRole,
                sourceKind: index.sourceKind,
                dataMode: index.dataMode,
            });
        }
        const position = positions[0];
        const mapping = state.mappings[position];
        const aggregate = mapping.aggregate;
        const trustedAudit: Partial<{
            -readonly [Key in keyof WeComCustomerMappingAuditEvent]: WeComCustomerMappingAuditEvent[Key];
        }> = {
            tenantId: command.tenantId,
            timestamp: command.occurredAt,
            action: command.action,
            reviewerRole: command.reviewerRole,
            sourceKind: index.sourceKind,
            dataMode: index.dataMode,
            mappingStatusBefore: aggregate.mappingStatus,
            mappingStatusAfter: aggregate.mappingStatus,
        };
        if (!containmentStateIntegrity(state, position)) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'aggregate_lineage_mismatch' }, trustedAudit);
        }
        if (aggregate.mappingStatus === 'disabled') {
            return block(registered, { eventType: 'mapping_invalid_transition_blocked', reasonCode: 'mapping_already_disabled' }, trustedAudit);
        }
        if (!historySnapshotsSelfConsistent(mapping.history) ||
            !historicalTargetBinding(aggregate, mapping.history, index.records[position], index.lineageLockIndex)) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'aggregate_lineage_mismatch' }, trustedAudit);
        }
        if (command.occurredAt <= aggregate.updatedAt) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'non_monotonic_occurred_at' }, trustedAudit);
        }
        if (mapping.history.historyVersion >= 1000) {
            return block(registered, { eventType: 'mapping_input_blocked', reasonCode: 'history_capacity_exceeded' }, trustedAudit);
        }
        if (intrinsicReduce(state.mappings, (total, current) => total + current.history.entries.length, 0) >= 2000) {
            return block(registered, {
                eventType: 'mapping_input_blocked',
                reasonCode: 'source_scope_history_capacity_exceeded',
            }, trustedAudit);
        }
        if (index.indexVersion >= MAX_VERSION) {
            return block(registered, {
                eventType: 'mapping_input_blocked',
                reasonCode: 'source_scope_index_capacity_exceeded',
            }, trustedAudit);
        }
        const history = appendHistory(mapping.history, aggregate, command, 'disabled', 'mapping_disabled', null, true);
        const nextAggregate = makeRecord<MappingAggregateContext>([
            ['tenantId', aggregate.tenantId],
            ['sourceScopeReference', aggregate.sourceScopeReference],
            ['mappingReference', aggregate.mappingReference],
            ['aggregateVersion', aggregate.aggregateVersion + 1],
            ['mappingStatus', 'disabled'],
            ['reasonCode', 'mapping_disabled'],
            ['candidateDigest', null],
            ['candidatePairDigest', aggregate.candidatePairDigest],
            ['evidenceFingerprint', aggregate.evidenceFingerprint],
            ['sourceSnapshotDigest', aggregate.sourceSnapshotDigest],
            ['fixtureRegistryDigest', aggregate.fixtureRegistryDigest],
            ['historyDigest', history.historyDigest],
            ['sourceKind', aggregate.sourceKind],
            ['dataMode', aggregate.dataMode],
            ['containsRealCustomerData', false],
            ['autoMergePerformed', false],
            ['realCustomerRelationshipWritten', false],
            ['updatedAt', command.occurredAt],
        ]);
        const nextState = replaceMappingState(state, position, nextAggregate, null, history, deepClone(index.lineageLockIndex));
        const audit = safeAudit({
            ...trustedAudit,
            eventType: 'mapping_disabled',
            reasonCode: 'mapping_disabled',
            mappingStatusAfter: 'disabled',
            candidateDigest: ZERO_DIGEST,
        });
        if (!audit.ok)
            return freezeOwned(makeRecord<MappingBlockedResult>([
                ['ok', false],
                ['auditEvent', audit.event],
            ]), registered);
        const committed = committedResult(registered, {
            action: 'disable_mapping',
            resultKind: 'mapping_disabled',
            nextState,
            mappingReview: null,
            mappingDecision: null,
            mappingConflict: null,
            auditEvent: audit.event,
        }, null);
        return committed ?? block(registered, {
            eventType: 'mapping_input_blocked',
            reasonCode: 'derived_output_contract_invalid',
        });
    }
    return freezeOwned(makeRecord<WeComCustomerMappingDomain>([
        ['generateCandidate', generateCandidate],
        ['reviewCandidate', reviewCandidate],
        ['disableMapping', disableMapping],
    ]), registered);
}
function deepFreezeOwnedRegistry(value: unknown, seen = new WeakSet<object>()) {
    if (typeof value !== 'object' || value === null || seen.has(value))
        return;
    seen.add(value);
    if (Array.isArray(value)) {
        for (const item of value)
            deepFreezeOwnedRegistry(item, seen);
    }
    else {
        for (const key of Object.keys(value))
            deepFreezeOwnedRegistry((value as SafeRecord)[key], seen);
    }
    objectFreezeIntrinsic(value);
}
function freezeIntrinsicValid() {
    try {
        const probe = { marker: false };
        objectPreventExtensionsIntrinsic(probe);
        objectFreezeIntrinsic(probe);
        if (!objectIsFrozenIntrinsic(probe))
            return false;
        try {
            probe.marker = true;
        }
        catch {
            // A trusted freeze makes the data property non-writable.
        }
        return probe.marker === false && !reflectDefinePropertyIntrinsic(probe, 'probe', {
            value: true,
            configurable: true,
            enumerable: true,
            writable: true,
        });
    }
    catch {
        return false;
    }
}
export function createWeComCustomerMappingDomain(): WeComCustomerMappingDomain | MappingDomainInitializationBlocked {
    if (arguments.length !== 0 || typeof isProxyIntrinsic !== 'function' ||
        !normalizationIntrinsicValid() || !freezeIntrinsicValid())
        return initializationBlocked;
    try {
        const registry = buildRegistry();
        let katValid = true;
        reflectApplyIntrinsic(mapForEachIntrinsic, registry, [(bundle: FixtureBundle, tenantId: string) => {
                const expected = reflectApplyIntrinsic(mapGetIntrinsic, EXPECTED_REGISTRY_DIGESTS, [tenantId]) as readonly [
                    string,
                    string
                ] | undefined;
                if (!expected || bundle.candidateManifestDigest !== expected[0] ||
                    bundle.fixtureRegistryDigest !== expected[1])
                    katValid = false;
            }]);
        if (!katValid || registry.size !== EXPECTED_REGISTRY_DIGESTS.size ||
            !validateRegistry(registry) || !validateRegistrySelfTests(registry))
            return initializationBlocked;
        reflectApplyIntrinsic(mapForEachIntrinsic, registry, [
            (bundle: FixtureBundle) => deepFreezeOwnedRegistry(bundle),
        ]);
        return createWeComCustomerMappingDomainInternal(registry);
    }
    catch {
        return initializationBlocked;
    }
}
