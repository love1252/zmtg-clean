import { describe, expect, it } from 'vitest';

import {
  decideKnowledgePublication,
  evaluateKnowledgeUseAvailability,
  knowledgePublicationLifecycles,
  type KnowledgePublication,
  type KnowledgePublicationCommand,
  type KnowledgePublicationState,
} from '../domain/knowledge-publication';
import {
  createKnowledgeDraftVersion,
  type KnowledgeMetadataSnapshot,
  type KnowledgeVersion,
} from '../domain/knowledge-versioning';

const manifestHashA = `sha256:${'a'.repeat(64)}`;
const manifestHashB = `sha256:${'b'.repeat(64)}`;
const manifestHashC = `sha256:${'c'.repeat(64)}`;

function metadata(
  overrides: Partial<KnowledgeMetadataSnapshot> = {},
): KnowledgeMetadataSnapshot {
  return {
    title: '术后护理 FAQ',
    category: 'faq',
    tags: ['术后'],
    lowSensitiveSummary: '术后护理的内部知识摘要。',
    source: 'institution_editorial',
    riskLevel: 'medium',
    effectiveAt: null,
    reviewAt: null,
    useScope: 'ai_customer_reply',
    ...overrides,
  };
}

function candidateVersion(
  overrides: Partial<Parameters<typeof createKnowledgeDraftVersion>[0]> = {},
): KnowledgeVersion {
  const result = createKnowledgeDraftVersion({
    knowledgeId: 'knowledge-1',
    versionId: 'version-2',
    versionNumber: 2,
    previousVersionNumber: 1,
    metadataSnapshot: metadata(),
    bodyRevisionId: 'body-revision-2',
    fileRevisionIds: ['file-revision-2'],
    manifestHash: manifestHashB,
    createdAt: '2026-07-17T02:00:00.000Z',
    ...overrides,
  });
  if (!result.ok) throw new Error(result.reasonCode);
  return result.version;
}

function oldPublication(
  overrides: Partial<KnowledgePublication> = {},
): KnowledgePublication {
  const lifecycle = overrides.lifecycle ?? 'current';
  return {
    publicationId: 'publication-1',
    knowledgeId: 'knowledge-1',
    versionId: 'version-1',
    versionNumber: 1,
    manifestHash: manifestHashA,
    lifecycle,
    complete: true,
    safetyStatus: 'allowed',
    useScope: 'ai_customer_reply',
    publishedAt: '2026-07-16T01:00:00.000Z',
    withdrawnAt:
      lifecycle === 'withdrawn' ? '2026-07-16T03:00:00.000Z' : null,
    ...overrides,
  };
}

function publicationState(
  overrides: Partial<KnowledgePublicationState> = {},
): KnowledgePublicationState {
  return {
    item: {
      knowledgeId: 'knowledge-1',
      lifecycle: 'active',
      revision: 7,
    },
    currentPublicationId: 'publication-1',
    publications: [oldPublication()],
    ...overrides,
  };
}

function publishCommand(
  overrides: Partial<Extract<KnowledgePublicationCommand, { kind: 'publish' }>> = {},
): Extract<KnowledgePublicationCommand, { kind: 'publish' }> {
  const candidate = overrides.candidateVersion ?? candidateVersion();
  return {
    kind: 'publish',
    idempotencyKey: 'publish-key-0001',
    expectedRevision: 7,
    decidedAt: '2026-07-17T04:00:00.000Z',
    publicationId: 'publication-2',
    candidateVersion: candidate,
    gateEvidence: {
      observedManifestHash: candidate.manifestHash,
      parseReady: true,
      indexReady: true,
      safetyStatus: 'allowed',
      useScopeEligible: true,
    },
    ...overrides,
  };
}

const metadataConflictCases: readonly Readonly<{
  name: string;
  patch: Partial<KnowledgeMetadataSnapshot>;
}>[] = [
  { name: 'title', patch: { title: '变更后的标题' } },
  { name: 'category', patch: { category: 'policy' } },
  { name: 'tags', patch: { tags: ['术后', '变更标签'] } },
  {
    name: 'lowSensitiveSummary',
    patch: { lowSensitiveSummary: '变更后的低敏摘要。' },
  },
  { name: 'source', patch: { source: 'controlled_import' } },
  { name: 'riskLevel', patch: { riskLevel: 'high' } },
  {
    name: 'effectiveAt',
    patch: { effectiveAt: '2026-08-01T00:00:00.000Z' },
  },
  {
    name: 'reviewAt',
    patch: { reviewAt: '2026-12-01T00:00:00.000Z' },
  },
  { name: 'useScope', patch: { useScope: 'internal_only' } },
];

describe('knowledge publication domain', () => {
  it('keeps publication disposition separate from version lifecycle', () => {
    expect(knowledgePublicationLifecycles).toEqual([
      'current',
      'superseded',
      'withdrawn',
    ]);
    expect(Object.isFrozen(knowledgePublicationLifecycles)).toBe(true);
  });

  it('publishes through draft -> publishing -> published and supersedes the old current only after all gates pass', () => {
    const state = publicationState();
    const command = publishCommand();
    const stateBefore = structuredClone(state);
    const commandBefore = structuredClone(command);
    const decision = decideKnowledgePublication({
      state,
      command,
      existingIdempotencyRecord: null,
    });

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;

    expect(decision.idempotentReplay).toBe(false);
    expect(decision.shouldApplyNextState).toBe(true);
    expect(decision.nextState.item.revision).toBe(8);
    expect(decision.nextState.currentPublicationId).toBe('publication-2');
    expect(decision.nextState.publications).toEqual([
      expect.objectContaining({
        publicationId: 'publication-1',
        lifecycle: 'superseded',
      }),
      expect.objectContaining({
        publicationId: 'publication-2',
        versionId: 'version-2',
        lifecycle: 'current',
        complete: true,
        safetyStatus: 'allowed',
      }),
    ]);
    expect(decision.candidateVersion?.lifecycle).toBe('published');
    expect(decision.candidateLifecyclePath).toEqual([
      'draft',
      'publishing',
      'published',
    ]);
    expect(decision.publicationTransitions).toEqual([
      {
        publicationId: 'publication-1',
        path: ['current', 'superseded'],
      },
    ]);
    expect(state).toEqual(stateBefore);
    expect(command).toEqual(commandBefore);
    expect(Object.isFrozen(decision.nextState)).toBe(true);
    expect(Object.isFrozen(decision.nextState.publications)).toBe(true);
    expect(Object.isFrozen(decision.nextState.publications[0])).toBe(true);
    expect(Object.isFrozen(decision.candidateVersion)).toBe(true);
    expect(Object.isFrozen(decision.candidateVersion?.metadataSnapshot.tags)).toBe(true);
    expect(Object.isFrozen(decision.candidateLifecyclePath)).toBe(true);
    expect(Object.isFrozen(decision.publicationTransitions[0]?.path)).toBe(true);
    expect(Object.isFrozen(decision.idempotencyRecord)).toBe(true);
    expect(Object.isFrozen(decision.idempotencyRecord?.previousState)).toBe(
      true,
    );
  });

  it.each([
    {
      name: 'manifest mismatch',
      gatePatch: { observedManifestHash: manifestHashC },
      reasonCode: 'manifest_mismatch',
    },
    {
      name: 'parse not ready',
      gatePatch: { parseReady: false },
      reasonCode: 'parse_not_ready',
    },
    {
      name: 'index not ready',
      gatePatch: { indexReady: false },
      reasonCode: 'index_not_ready',
    },
    {
      name: 'safety not allowed',
      gatePatch: { safetyStatus: 'blocked' as const },
      reasonCode: 'safety_not_allowed',
    },
    {
      name: 'use scope ineligible',
      gatePatch: { useScopeEligible: false },
      reasonCode: 'use_scope_ineligible',
    },
  ])('returns the candidate to repairable draft and preserves old current when $name', ({
    gatePatch,
    reasonCode,
  }) => {
    const state = publicationState();
    const command = publishCommand();
    const submittedCommand = {
      ...command,
      gateEvidence: {
        ...command.gateEvidence,
        ...gatePatch,
      },
    };
    const stateBefore = structuredClone(state);
    const commandBefore = structuredClone(submittedCommand);
    const decision = decideKnowledgePublication({
      state,
      command: submittedCommand,
      existingIdempotencyRecord: null,
    });

    expect(decision.ok).toBe(false);
    if (decision.ok) return;

    expect(decision.reasonCodes).toContain(reasonCode);
    expect(decision.nextState).toEqual(state);
    expect(decision.nextState.currentPublicationId).toBe('publication-1');
    expect(decision.nextState.item.revision).toBe(7);
    expect(decision.shouldApplyNextState).toBe(false);
    expect(decision.candidateVersion?.lifecycle).toBe('draft');
    expect(decision.candidateLifecyclePath).toEqual([
      'draft',
      'publishing',
      'draft',
    ]);
    expect(decision.publicationTransitions).toEqual([]);
    expect(decision.idempotencyRecord).not.toBeNull();
    expect(state).toEqual(stateBefore);
    expect(submittedCommand).toEqual(commandBefore);

    if (!decision.idempotencyRecord) return;
    const advanced = decideKnowledgePublication({
      state,
      command: { ...command, idempotencyKey: 'advance-key-0001' },
      existingIdempotencyRecord: null,
    });
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;

    const replay = decideKnowledgePublication({
      state: advanced.nextState,
      command: submittedCommand,
      existingIdempotencyRecord: decision.idempotencyRecord,
      recordedSubmittedCandidateVersion: submittedCommand.candidateVersion,
    });
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.shouldApplyNextState).toBe(false);
    expect(replay.reasonCodes).toContain(reasonCode);
    expect(replay.nextState).toEqual(advanced.nextState);
    expect(replay.publicationTransitions).toEqual([]);
  });

  it('rejects a publish candidate that reuses any historical versionId', () => {
    const state = publicationState();
    const reusedCandidate = candidateVersion({
      versionId: 'version-1',
    });
    const command = publishCommand({ candidateVersion: reusedCandidate });
    const stateBefore = structuredClone(state);
    const commandBefore = structuredClone(command);
    const decision = decideKnowledgePublication({
      state,
      command,
      existingIdempotencyRecord: null,
    });

    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reasonCodes).toEqual(['candidate_version_reused']);
    expect(decision.nextState).toEqual(state);
    expect(decision.shouldApplyNextState).toBe(false);
    expect(decision.candidateLifecyclePath).toEqual([]);
    expect(decision.publicationTransitions).toEqual([]);
    expect(state).toEqual(stateBefore);
    expect(command).toEqual(commandBefore);
  });

  it('reuses the exact idempotent result before checking the advanced revision and rejects another payload with the same key', () => {
    const state = publicationState();
    const command = publishCommand({
      candidateVersion: candidateVersion({
        metadataSnapshot: metadata({
          title: 'SENSITIVE_TITLE_SENTINEL',
          category: 'SENSITIVE_CATEGORY_SENTINEL',
          tags: ['SENSITIVE_TAG_SENTINEL'],
          lowSensitiveSummary: 'SENSITIVE_SUMMARY_SENTINEL',
          source: 'SENSITIVE_SOURCE_SENTINEL',
          riskLevel: 'high',
          effectiveAt: '2031-01-02T03:04:05.000Z',
          reviewAt: '2032-02-03T04:05:06.000Z',
        }),
      }),
    });
    const retryCommand = structuredClone(command);
    const retryBefore = structuredClone(retryCommand);
    const recordedCandidate = structuredClone(command.candidateVersion);
    const recordedCandidateBefore = structuredClone(recordedCandidate);
    const first = decideKnowledgePublication({
      state,
      command,
      existingIdempotencyRecord: null,
    });
    expect(first.ok).toBe(true);
    expect(first.idempotencyRecord).not.toBeNull();
    if (!first.ok || !first.idempotencyRecord) return;
    const firstStateBefore = structuredClone(first.nextState);
    const firstRecordBefore = structuredClone(first.idempotencyRecord);

    const replay = decideKnowledgePublication({
      state: first.nextState,
      command: retryCommand,
      existingIdempotencyRecord: first.idempotencyRecord,
      recordedSubmittedCandidateVersion: recordedCandidate,
    });
    expect(replay.ok).toBe(true);
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.shouldApplyNextState).toBe(false);
    expect(replay.nextState).toEqual(first.nextState);
    expect(replay.candidateVersion?.metadataSnapshot).toEqual(
      command.candidateVersion.metadataSnapshot,
    );
    expect(retryCommand).toEqual(retryBefore);
    expect(recordedCandidate).toEqual(recordedCandidateBefore);
    expect(first.nextState).toEqual(firstStateBefore);
    expect(first.idempotencyRecord).toEqual(firstRecordBefore);
    expect(first.idempotencyRecord.payloadFingerprint).not.toContain(
      command.candidateVersion.metadataSnapshot.title,
    );
    expect(first.idempotencyRecord.payloadFingerprint).not.toContain(
      command.candidateVersion.metadataSnapshot.lowSensitiveSummary,
    );
    expect(first.idempotencyRecord.payloadFingerprint).not.toMatch(
      /prompt|provider|completion|vector|payload/i,
    );
    const recordedJson = JSON.stringify(first.idempotencyRecord);
    expect(Object.keys(first.idempotencyRecord).sort()).toEqual([
      'idempotencyKey',
      'knowledgeId',
      'payloadFingerprint',
      'previousState',
      'submittedCandidateReference',
    ]);
    expect(recordedJson).not.toMatch(
      /prompt|provider|completion|vector|providerPayload|metadataSnapshot/i,
    );
    for (const sensitiveValue of [
      command.candidateVersion.metadataSnapshot.title,
      command.candidateVersion.metadataSnapshot.category,
      ...command.candidateVersion.metadataSnapshot.tags,
      command.candidateVersion.metadataSnapshot.lowSensitiveSummary,
      command.candidateVersion.metadataSnapshot.source,
      command.candidateVersion.metadataSnapshot.riskLevel,
      command.candidateVersion.metadataSnapshot.effectiveAt,
      command.candidateVersion.metadataSnapshot.reviewAt,
    ]) {
      if (sensitiveValue !== null) {
        expect(recordedJson).not.toContain(sensitiveValue);
      }
    }
    expect(recordedJson).not.toMatch(
      /metadataSnapshot|lowSensitiveSummary|effectiveAt|reviewAt/,
    );

    const missingRecordedCandidate = decideKnowledgePublication({
      state: first.nextState,
      command: retryCommand,
      existingIdempotencyRecord: first.idempotencyRecord,
    });
    expect(missingRecordedCandidate.ok).toBe(false);
    if (!missingRecordedCandidate.ok) {
      expect(missingRecordedCandidate.reasonCodes).toEqual([
        'idempotency_conflict',
      ]);
      expect(missingRecordedCandidate.idempotencyRecord).toBeNull();
    }

    let malformedCandidateDecision:
      | ReturnType<typeof decideKnowledgePublication>
      | undefined;
    const malformedCandidate = {
      knowledgeId: recordedCandidate.knowledgeId,
      versionId: recordedCandidate.versionId,
      versionNumber: recordedCandidate.versionNumber,
      lifecycle: recordedCandidate.lifecycle,
      bodyRevisionId: recordedCandidate.bodyRevisionId,
      fileRevisionIds: recordedCandidate.fileRevisionIds,
      manifestHash: recordedCandidate.manifestHash,
      createdAt: recordedCandidate.createdAt,
    };
    const malformedCandidateBefore = structuredClone(malformedCandidate);
    expect(() => {
      malformedCandidateDecision = decideKnowledgePublication({
        state: first.nextState,
        command: retryCommand,
        existingIdempotencyRecord: first.idempotencyRecord,
        recordedSubmittedCandidateVersion:
          malformedCandidate as unknown as KnowledgeVersion,
      });
    }).not.toThrow();
    expect(malformedCandidateDecision?.ok).toBe(false);
    if (malformedCandidateDecision?.ok === false) {
      expect(malformedCandidateDecision.reasonCodes).toEqual([
        'idempotency_conflict',
      ]);
      expect(malformedCandidateDecision.idempotencyRecord).toBeNull();
    }
    expect(malformedCandidate).toEqual(malformedCandidateBefore);

    let malformedRecordDecision:
      | ReturnType<typeof decideKnowledgePublication>
      | undefined;
    expect(() => {
      malformedRecordDecision = decideKnowledgePublication({
        state: first.nextState,
        command: retryCommand,
        existingIdempotencyRecord: {
          ...first.idempotencyRecord,
          previousState: {},
        } as unknown as NonNullable<
          Parameters<
            typeof decideKnowledgePublication
          >[0]['existingIdempotencyRecord']
        >,
        recordedSubmittedCandidateVersion: recordedCandidate,
      });
    }).not.toThrow();
    expect(malformedRecordDecision?.ok).toBe(false);
    if (malformedRecordDecision?.ok === false) {
      expect(malformedRecordDecision.reasonCodes).toEqual([
        'idempotency_conflict',
      ]);
    }

    const forgedPreviousState = {
      ...first.idempotencyRecord.previousState,
      currentPublicationId: 'publication-forged',
      publications: first.idempotencyRecord.previousState.publications.map(
        (publication) => ({
          ...publication,
          publicationId: 'publication-forged',
        }),
      ),
    };
    const forgedStateRecord = {
      ...first.idempotencyRecord,
      previousState: forgedPreviousState,
    };
    const forgedStateReplay = decideKnowledgePublication({
      state: first.nextState,
      command: retryCommand,
      existingIdempotencyRecord: forgedStateRecord,
      recordedSubmittedCandidateVersion: recordedCandidate,
    });
    expect(forgedStateReplay.ok).toBe(false);
    if (!forgedStateReplay.ok) {
      expect(forgedStateReplay.reasonCodes).toEqual([
        'idempotency_conflict',
      ]);
      expect(forgedStateReplay.idempotentReplay).toBe(false);
    }

    const replayFromDeserializedRecord = decideKnowledgePublication({
      state: first.nextState,
      command,
      existingIdempotencyRecord: structuredClone(first.idempotencyRecord),
      recordedSubmittedCandidateVersion: structuredClone(
        command.candidateVersion,
      ),
    });
    expect(replayFromDeserializedRecord.idempotentReplay).toBe(true);
    expect(Object.isFrozen(replayFromDeserializedRecord)).toBe(true);
    expect(Object.isFrozen(replayFromDeserializedRecord.nextState.item)).toBe(true);
    expect(Object.isFrozen(replayFromDeserializedRecord.candidateVersion)).toBe(true);
    expect(Object.isFrozen(
      replayFromDeserializedRecord.candidateVersion?.metadataSnapshot.tags,
    )).toBe(true);
    expect(Object.isFrozen(
      replayFromDeserializedRecord.candidateLifecyclePath,
    )).toBe(true);
    expect(Object.isFrozen(
      replayFromDeserializedRecord.idempotencyRecord?.previousState,
    )).toBe(true);

    const invalidReplay = decideKnowledgePublication({
      state: publicationState({ currentPublicationId: 'publication-missing' }),
      command,
      existingIdempotencyRecord: first.idempotencyRecord,
    });
    expect(invalidReplay.ok).toBe(false);
    if (!invalidReplay.ok) {
      expect(invalidReplay.reasonCodes).toEqual(['state_invalid']);
      expect(invalidReplay.idempotentReplay).toBe(false);
      expect(invalidReplay.shouldApplyNextState).toBe(false);
      expect(invalidReplay.idempotencyRecord).toBeNull();
    }

    const changedCandidate = candidateVersion({
      versionId: 'version-3',
      versionNumber: 3,
      previousVersionNumber: 2,
      manifestHash: manifestHashC,
    });
    const conflictCommand = publishCommand({
      candidateVersion: changedCandidate,
      publicationId: 'publication-3',
      gateEvidence: {
        observedManifestHash: manifestHashC,
        parseReady: true,
        indexReady: true,
        safetyStatus: 'allowed',
        useScopeEligible: true,
      },
    });
    const conflict = decideKnowledgePublication({
      state: first.nextState,
      command: conflictCommand,
      existingIdempotencyRecord: first.idempotencyRecord,
      recordedSubmittedCandidateVersion: command.candidateVersion,
    });

    expect(conflict.ok).toBe(false);
    if (conflict.ok) return;
    expect(conflict.reasonCodes).toEqual(['idempotency_conflict']);
    expect(conflict.shouldApplyNextState).toBe(false);
    expect(conflict.nextState).toEqual(first.nextState);
    expect(conflict.candidateLifecyclePath).toEqual([]);
    expect(conflict.publicationTransitions).toEqual([]);
    expect(conflict.idempotencyRecord).toBeNull();
  });

  it.each(metadataConflictCases)(
    'rejects the same idempotency key when candidate metadata field $name changes',
    ({ patch }) => {
      const state = publicationState();
      const originalCommand = publishCommand();
      const first = decideKnowledgePublication({
        state,
        command: originalCommand,
        existingIdempotencyRecord: null,
      });
      expect(first.ok).toBe(true);
      expect(first.idempotencyRecord).not.toBeNull();
      if (!first.idempotencyRecord) return;

      const retryCommand = publishCommand({
        candidateVersion: candidateVersion({
          metadataSnapshot: metadata(patch),
        }),
      });
      const retryBefore = structuredClone(retryCommand);
      const recordedCandidate = structuredClone(
        originalCommand.candidateVersion,
      );
      const recordedCandidateBefore = structuredClone(recordedCandidate);
      const stateBefore = structuredClone(first.nextState);
      const recordBefore = structuredClone(first.idempotencyRecord);
      const decision = decideKnowledgePublication({
        state: first.nextState,
        command: retryCommand,
        existingIdempotencyRecord: first.idempotencyRecord,
        recordedSubmittedCandidateVersion: recordedCandidate,
      });

      expect(decision.ok).toBe(false);
      if (decision.ok) return;
      expect(decision.reasonCodes).toEqual(['idempotency_conflict']);
      expect(decision.idempotentReplay).toBe(false);
      expect(decision.shouldApplyNextState).toBe(false);
      expect(decision.nextState).toEqual(first.nextState);
      expect(decision.candidateLifecyclePath).toEqual([]);
      expect(decision.publicationTransitions).toEqual([]);
      expect(decision.idempotencyRecord).toBeNull();
      expect(first.nextState).toEqual(stateBefore);
      expect(retryCommand).toEqual(retryBefore);
      expect(recordedCandidate).toEqual(recordedCandidateBefore);
      expect(first.idempotencyRecord).toEqual(recordBefore);
    },
  );

  it('rejects an idempotency record from another knowledge item', () => {
    const state = publicationState();
    const command = publishCommand();
    const first = decideKnowledgePublication({
      state,
      command,
      existingIdempotencyRecord: null,
    });
    expect(first.ok).toBe(true);
    expect(first.idempotencyRecord).not.toBeNull();
    if (!first.idempotencyRecord) return;

    const otherState = publicationState({
      item: {
        knowledgeId: 'knowledge-2',
        lifecycle: 'active',
        revision: 7,
      },
      publications: [oldPublication({ knowledgeId: 'knowledge-2' })],
    });
    const replay = decideKnowledgePublication({
      state: otherState,
      command,
      existingIdempotencyRecord: first.idempotencyRecord,
    });

    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.reasonCodes).toEqual(['idempotency_conflict']);
    expect(replay.nextState).toEqual(otherState);
    expect(replay.idempotencyRecord).toBeNull();
  });

  it('fails closed on an expected revision conflict without moving current publication', () => {
    const state = publicationState();
    const command = publishCommand({ expectedRevision: 6 });
    const decision = decideKnowledgePublication({
      state,
      command,
      existingIdempotencyRecord: null,
    });

    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reasonCodes).toEqual(['expected_revision_conflict']);
    expect(decision.shouldApplyNextState).toBe(false);
    expect(decision.nextState).toEqual(state);
    expect(decision.candidateLifecyclePath).toEqual([]);
    expect(decision.publicationTransitions).toEqual([]);
    expect(decision.idempotencyRecord).not.toBeNull();
    if (!decision.idempotencyRecord) return;

    const exactReplay = decideKnowledgePublication({
      state,
      command: structuredClone(command),
      existingIdempotencyRecord: structuredClone(decision.idempotencyRecord),
      recordedSubmittedCandidateVersion: structuredClone(
        command.candidateVersion,
      ),
    });
    expect(exactReplay.ok).toBe(false);
    if (!exactReplay.ok) {
      expect(exactReplay.reasonCodes).toEqual(['expected_revision_conflict']);
      expect(exactReplay.idempotentReplay).toBe(true);
      expect(exactReplay.candidateVersion).toBeNull();
    }

    const changedMetadataCommand = publishCommand({
      expectedRevision: 6,
      candidateVersion: candidateVersion({
        metadataSnapshot: metadata({ title: '冲突后的新标题' }),
      }),
    });
    const changedReplay = decideKnowledgePublication({
      state,
      command: changedMetadataCommand,
      existingIdempotencyRecord: decision.idempotencyRecord,
      recordedSubmittedCandidateVersion: command.candidateVersion,
    });
    expect(changedReplay.ok).toBe(false);
    if (!changedReplay.ok) {
      expect(changedReplay.reasonCodes).toEqual(['idempotency_conflict']);
      expect(changedReplay.idempotentReplay).toBe(false);
      expect(changedReplay.idempotencyRecord).toBeNull();
    }

    const tamperedRevisionRecord = {
      ...decision.idempotencyRecord,
      previousState: {
        ...decision.idempotencyRecord.previousState,
        item: {
          ...decision.idempotencyRecord.previousState.item,
          revision: 6,
        },
      },
    };
    const tamperedReplay = decideKnowledgePublication({
      state,
      command,
      existingIdempotencyRecord: tamperedRevisionRecord,
      recordedSubmittedCandidateVersion: command.candidateVersion,
    });
    expect(tamperedReplay.ok).toBe(false);
    if (!tamperedReplay.ok) {
      expect(tamperedReplay.reasonCodes).toEqual(['idempotency_conflict']);
      expect(tamperedReplay.idempotentReplay).toBe(false);
    }
  });

  it.each(['publish', 'rollback', 'withdraw', 'retire'] as const)(
    'fails closed before a $kind decision can overflow the item revision',
    (kind) => {
      const baseItem = {
        knowledgeId: 'knowledge-1',
        lifecycle: 'active' as const,
        revision: Number.MAX_SAFE_INTEGER,
      };
      const historical = oldPublication({ lifecycle: 'superseded' });
      const current = oldPublication({
        publicationId: 'publication-2',
        versionId: 'version-2',
        versionNumber: 2,
        manifestHash: manifestHashB,
      });
      const state =
        kind === 'rollback'
          ? publicationState({
              item: baseItem,
              currentPublicationId: current.publicationId,
              publications: [historical, current],
            })
          : publicationState({ item: baseItem });
      const command: KnowledgePublicationCommand =
        kind === 'publish'
          ? publishCommand({ expectedRevision: Number.MAX_SAFE_INTEGER })
          : kind === 'rollback'
            ? {
                kind,
                idempotencyKey: 'rollback-overflow',
                expectedRevision: Number.MAX_SAFE_INTEGER,
                decidedAt: '2026-07-17T04:45:00.000Z',
                targetPublicationId: historical.publicationId,
              }
            : kind === 'withdraw'
              ? {
                  kind,
                  idempotencyKey: 'withdraw-overflow',
                  expectedRevision: Number.MAX_SAFE_INTEGER,
                  decidedAt: '2026-07-17T04:45:00.000Z',
                  targetPublicationId: 'publication-1',
                }
              : {
                  kind,
                  idempotencyKey: 'retire-overflow',
                  expectedRevision: Number.MAX_SAFE_INTEGER,
                  decidedAt: '2026-07-17T04:45:00.000Z',
                };
      const stateBefore = structuredClone(state);
      const commandBefore = structuredClone(command);
      let decision: ReturnType<typeof decideKnowledgePublication> | undefined;

      expect(() => {
        decision = decideKnowledgePublication({
          state,
          command,
          existingIdempotencyRecord: null,
        });
      }).not.toThrow();

      expect(decision?.ok).toBe(false);
      if (decision?.ok !== false) return;
      expect(decision.reasonCodes).toEqual(['revision_overflow']);
      expect(decision.nextState).toEqual(state);
      expect(decision.shouldApplyNextState).toBe(false);
      expect(decision.publicationTransitions).toEqual([]);
      expect(decision.idempotencyRecord).toBeNull();
      expect(state).toEqual(stateBefore);
      expect(command).toEqual(commandBefore);
    },
  );

  it('allows the final safe revision increment and still replays it at MAX_SAFE_INTEGER', () => {
    const state = publicationState({
      item: {
        knowledgeId: 'knowledge-1',
        lifecycle: 'active',
        revision: Number.MAX_SAFE_INTEGER - 1,
      },
    });
    const command = publishCommand({
      expectedRevision: Number.MAX_SAFE_INTEGER - 1,
    });
    const first = decideKnowledgePublication({
      state,
      command,
      existingIdempotencyRecord: null,
    });
    expect(first.ok).toBe(true);
    expect(first.idempotencyRecord).not.toBeNull();
    if (!first.ok || !first.idempotencyRecord) return;
    expect(first.nextState.item.revision).toBe(Number.MAX_SAFE_INTEGER);

    const replay = decideKnowledgePublication({
      state: first.nextState,
      command: structuredClone(command),
      existingIdempotencyRecord: structuredClone(first.idempotencyRecord),
      recordedSubmittedCandidateVersion: structuredClone(
        command.candidateVersion,
      ),
    });
    expect(replay.ok).toBe(true);
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.shouldApplyNextState).toBe(false);
    expect(replay.nextState.item.revision).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([
    {
      name: 'publish candidate is missing',
      build: () => {
        const { candidateVersion: _candidateVersion, ...command } =
          publishCommand();
        return command;
      },
    },
    {
      name: 'publish gate evidence is missing',
      build: () => {
        const { gateEvidence: _gateEvidence, ...command } = publishCommand();
        return command;
      },
    },
    {
      name: 'publish gate boolean has the wrong type',
      build: () => ({
        ...publishCommand(),
        gateEvidence: {
          ...publishCommand().gateEvidence,
          parseReady: 'yes',
        },
      }),
    },
    {
      name: 'candidate metadata field is missing',
      build: () => {
        const { title: _title, ...incompleteMetadata } = metadata();
        return {
          ...publishCommand(),
          candidateVersion: {
            ...candidateVersion(),
            metadataSnapshot: incompleteMetadata,
          },
        };
      },
    },
    {
      name: 'candidate file revision list has the wrong type',
      build: () => ({
        ...publishCommand(),
        candidateVersion: {
          ...candidateVersion(),
          fileRevisionIds: 'file-revision-2',
        },
      }),
    },
    {
      name: 'rollback target is missing',
      build: () => ({
        kind: 'rollback',
        idempotencyKey: 'rollback-key-0001',
        expectedRevision: 7,
        decidedAt: '2026-07-17T04:30:00.000Z',
      }),
    },
    {
      name: 'withdraw target has the wrong type',
      build: () => ({
        kind: 'withdraw',
        idempotencyKey: 'withdraw-key-0001',
        expectedRevision: 7,
        decidedAt: '2026-07-17T04:30:00.000Z',
        targetPublicationId: 42,
      }),
    },
    {
      name: 'retire revision has the wrong type',
      build: () => ({
        kind: 'retire',
        idempotencyKey: 'retire-key-00001',
        expectedRevision: '7',
        decidedAt: '2026-07-17T04:30:00.000Z',
      }),
    },
    {
      name: 'idempotency key is a symbol',
      build: () => ({
        ...publishCommand(),
        idempotencyKey: Symbol('unsafe'),
      }),
    },
  ])('fails closed without throwing when $name', ({ build }) => {
    const state = publicationState();
    const stateBefore = structuredClone(state);
    const command = build();
    const commandBefore =
      typeof (command as { idempotencyKey?: unknown }).idempotencyKey ===
      'symbol'
        ? { ...command }
        : structuredClone(command);
    let decision: ReturnType<typeof decideKnowledgePublication> | undefined;

    expect(() => {
      decision = decideKnowledgePublication({
        state,
        command: command as unknown as KnowledgePublicationCommand,
        existingIdempotencyRecord: null,
      });
    }).not.toThrow();

    expect(decision?.ok).toBe(false);
    if (decision?.ok !== false) return;
    expect(decision.reasonCodes).toEqual(['command_invalid']);
    expect(decision.nextState).toEqual(state);
    expect(decision.shouldApplyNextState).toBe(false);
    expect(decision.publicationTransitions).toEqual([]);
    expect(decision.idempotencyRecord).toBeNull();
    expect(state).toEqual(stateBefore);
    expect(command).toEqual(commandBefore);
  });

  it('fails closed when an untyped caller supplies an unknown command kind', () => {
    const state = publicationState();
    const decision = decideKnowledgePublication({
      state,
      command: {
        kind: 'delete',
        idempotencyKey: 'unknown-key-0001',
        expectedRevision: 7,
        decidedAt: '2026-07-17T04:30:00.000Z',
      } as unknown as KnowledgePublicationCommand,
      existingIdempotencyRecord: null,
    });

    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reasonCodes).toEqual(['command_invalid']);
    expect(decision.nextState).toEqual(state);
    expect(decision.idempotencyRecord).toBeNull();

    const unsafeKey = 'prompt contains pii';
    const invalidKeyDecision = decideKnowledgePublication({
      state,
      command: publishCommand({ idempotencyKey: unsafeKey }),
      existingIdempotencyRecord: null,
    });
    expect(invalidKeyDecision.ok).toBe(false);
    if (!invalidKeyDecision.ok) {
      expect(invalidKeyDecision.reasonCodes).toEqual([
        'idempotency_key_invalid',
      ]);
      expect(invalidKeyDecision.idempotencyRecord).toBeNull();
      expect(JSON.stringify(invalidKeyDecision)).not.toContain(unsafeKey);
    }
  });

  it('rolls back only to an existing, complete, unwithdrawn, safety-allowed historical publication', () => {
    const historical = oldPublication({ lifecycle: 'superseded' });
    const current = oldPublication({
      publicationId: 'publication-2',
      versionId: 'version-2',
      versionNumber: 2,
      manifestHash: manifestHashB,
      lifecycle: 'current',
    });
    const state = publicationState({
      currentPublicationId: current.publicationId,
      publications: [historical, current],
    });
    const decision = decideKnowledgePublication({
      state,
      command: {
        kind: 'rollback',
        idempotencyKey: 'rollback-key-0001',
        expectedRevision: 7,
        decidedAt: '2026-07-17T05:00:00.000Z',
        targetPublicationId: historical.publicationId,
      },
      existingIdempotencyRecord: null,
    });

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.nextState.currentPublicationId).toBe('publication-1');
    expect(decision.nextState.publications).toEqual([
      expect.objectContaining({ publicationId: 'publication-1', lifecycle: 'current' }),
      expect.objectContaining({ publicationId: 'publication-2', lifecycle: 'superseded' }),
    ]);
    expect(decision.candidateLifecyclePath).toEqual([]);
    expect(decision.publicationTransitions).toEqual([
      { publicationId: 'publication-1', path: ['superseded', 'current'] },
      { publicationId: 'publication-2', path: ['current', 'superseded'] },
    ]);
  });

  it.each([
    { lifecycle: 'withdrawn' as const, complete: true, safetyStatus: 'allowed' as const, reason: 'rollback_target_withdrawn' },
    { lifecycle: 'superseded' as const, complete: false, safetyStatus: 'allowed' as const, reason: 'rollback_target_incomplete' },
    { lifecycle: 'superseded' as const, complete: true, safetyStatus: 'blocked' as const, reason: 'rollback_target_unsafe' },
  ])('rejects an ineligible rollback target and preserves current', ({ lifecycle, complete, safetyStatus, reason }) => {
    const target = oldPublication({ lifecycle, complete, safetyStatus });
    const current = oldPublication({
      publicationId: 'publication-2',
      versionId: 'version-2',
      versionNumber: 2,
      manifestHash: manifestHashB,
    });
    const state = publicationState({
      currentPublicationId: current.publicationId,
      publications: [target, current],
    });
    const decision = decideKnowledgePublication({
      state,
      command: {
        kind: 'rollback',
        idempotencyKey: `rollback-${reason}`,
        expectedRevision: 7,
        decidedAt: '2026-07-17T05:00:00.000Z',
        targetPublicationId: target.publicationId,
      },
      existingIdempotencyRecord: null,
    });

    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reasonCodes).toContain(reason);
    expect(decision.nextState).toEqual(state);
    expect(decision.nextState.currentPublicationId).toBe('publication-2');
  });

  it('withdraws current use while preserving publication identity and historical references', () => {
    const state = publicationState();
    const decision = decideKnowledgePublication({
      state,
      command: {
        kind: 'withdraw',
        idempotencyKey: 'withdraw-key-0001',
        expectedRevision: 7,
        decidedAt: '2026-07-17T06:00:00.000Z',
        targetPublicationId: 'publication-1',
      },
      existingIdempotencyRecord: null,
    });

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.nextState.currentPublicationId).toBeNull();
    expect(decision.nextState.publications).toEqual([
      expect.objectContaining({
        publicationId: 'publication-1',
        versionId: 'version-1',
        lifecycle: 'withdrawn',
        withdrawnAt: '2026-07-17T06:00:00.000Z',
      }),
    ]);
    expect(decision.candidateLifecyclePath).toEqual([]);
    expect(decision.publicationTransitions).toEqual([
      { publicationId: 'publication-1', path: ['current', 'withdrawn'] },
    ]);
    expect(evaluateKnowledgeUseAvailability({
      state: decision.nextState,
      assetApprovalStatus: 'approved',
    })).toEqual({
      canRetrieve: false,
      canAnswer: false,
      canSendAttachment: false,
      reasonCodes: ['current_publication_unavailable'],
    });
  });

  it('retires the item without deleting version or publication identities and blocks all new use', () => {
    const state = publicationState();
    const decision = decideKnowledgePublication({
      state,
      command: {
        kind: 'retire',
        idempotencyKey: 'retire-key-00001',
        expectedRevision: 7,
        decidedAt: '2026-07-17T07:00:00.000Z',
      },
      existingIdempotencyRecord: null,
    });

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.nextState.item.lifecycle).toBe('retired');
    expect(decision.nextState.item.revision).toBe(8);
    expect(decision.nextState.currentPublicationId).toBeNull();
    expect(decision.nextState.publications).toEqual([
      expect.objectContaining({
        publicationId: 'publication-1',
        versionId: 'version-1',
        lifecycle: 'superseded',
      }),
    ]);
    expect(decision.publicationTransitions).toEqual([
      { publicationId: 'publication-1', path: ['current', 'superseded'] },
    ]);
    expect(evaluateKnowledgeUseAvailability({
      state: decision.nextState,
      assetApprovalStatus: 'approved',
    })).toEqual({
      canRetrieve: false,
      canAnswer: false,
      canSendAttachment: false,
      reasonCodes: ['item_retired'],
    });
  });

  it('keeps AI-readable knowledge and attachment sending approval as independent decisions', () => {
    const approvalCases = [
      { status: 'approved' as const, reason: null },
      { status: 'not_approved' as const, reason: 'asset_not_approved' },
      { status: 'withdrawn' as const, reason: 'asset_approval_withdrawn' },
      { status: 'blocked' as const, reason: 'asset_approval_blocked' },
    ];

    for (const useScope of ['ai_customer_reply', 'internal_only'] as const) {
      const state = publicationState({
        publications: [oldPublication({ useScope })],
      });
      for (const approvalCase of approvalCases) {
        const reasonCodes = [
          ...(useScope === 'internal_only'
            ? ['use_scope_internal_only']
            : []),
          ...(approvalCase.reason === null ? [] : [approvalCase.reason]),
        ];
        expect(evaluateKnowledgeUseAvailability({
          state,
          assetApprovalStatus: approvalCase.status,
        })).toEqual({
          canRetrieve: true,
          canAnswer: useScope === 'ai_customer_reply',
          canSendAttachment:
            useScope === 'ai_customer_reply' &&
            approvalCase.status === 'approved',
          reasonCodes,
        });
      }
    }

    expect(evaluateKnowledgeUseAvailability({
      state: publicationState(),
      assetApprovalStatus: 'unknown' as never,
    })).toEqual({
      canRetrieve: false,
      canAnswer: false,
      canSendAttachment: false,
      reasonCodes: ['asset_approval_invalid'],
    });
  });

  it.each([
    {
      name: 'incomplete',
      publication: oldPublication({ complete: false }),
      reason: 'publication_incomplete',
    },
    ...(['pending', 'blocked', 'expired'] as const).map((safetyStatus) => ({
      name: `safety ${safetyStatus}`,
      publication: oldPublication({ safetyStatus }),
      reason: 'publication_safety_not_allowed',
    })),
  ])('blocks use when the current publication is $name', ({ publication, reason }) => {
    expect(evaluateKnowledgeUseAvailability({
      state: publicationState({ publications: [publication] }),
      assetApprovalStatus: 'approved',
    })).toEqual({
      canRetrieve: false,
      canAnswer: false,
      canSendAttachment: false,
      reasonCodes: [reason],
    });
  });

  it.each([
    {
      name: 'current publication has withdrawnAt',
      build: () =>
        publicationState({
          publications: [
            oldPublication({ withdrawnAt: '2026-07-17T08:00:00.000Z' }),
          ],
        }),
    },
    {
      name: 'superseded publication has withdrawnAt',
      build: () =>
        publicationState({
          currentPublicationId: null,
          publications: [
            oldPublication({
              lifecycle: 'superseded',
              withdrawnAt: '2026-07-17T08:00:00.000Z',
            }),
          ],
        }),
    },
    {
      name: 'withdrawn publication has no withdrawnAt',
      build: () =>
        publicationState({
          currentPublicationId: null,
          publications: [
            oldPublication({ lifecycle: 'withdrawn', withdrawnAt: null }),
          ],
        }),
    },
    {
      name: 'publication lifecycle is unknown',
      build: () =>
        publicationState({
          publications: [
            oldPublication({
              lifecycle: 'archived' as KnowledgePublication['lifecycle'],
            }),
          ],
        }),
    },
    {
      name: 'two publications reuse one versionId',
      build: () =>
        publicationState({
          currentPublicationId: 'publication-2',
          publications: [
            oldPublication({ lifecycle: 'superseded' }),
            oldPublication({
              publicationId: 'publication-2',
              versionNumber: 2,
              lifecycle: 'current',
            }),
          ],
        }),
    },
  ])('rejects invalid publication state when $name', ({ build }) => {
    const state = build();
    const stateBefore = structuredClone(state);
    let decision: ReturnType<typeof decideKnowledgePublication> | undefined;

    expect(() => {
      decision = decideKnowledgePublication({
        state,
        command: {
          kind: 'retire',
          idempotencyKey: 'retire-invalid-state',
          expectedRevision: 7,
          decidedAt: '2026-07-17T08:00:00.000Z',
        },
        existingIdempotencyRecord: null,
      });
    }).not.toThrow();

    expect(decision?.ok).toBe(false);
    if (decision?.ok !== false) return;
    expect(decision.reasonCodes).toEqual(['state_invalid']);
    expect(decision.shouldApplyNextState).toBe(false);
    expect(decision.publicationTransitions).toEqual([]);
    expect(decision.idempotencyRecord).toBeNull();
    expect(state).toEqual(stateBefore);
    expect(evaluateKnowledgeUseAvailability({
      state,
      assetApprovalStatus: 'approved',
    })).toEqual({
      canRetrieve: false,
      canAnswer: false,
      canSendAttachment: false,
      reasonCodes: ['state_invalid'],
    });
  });

  it('fails closed when use availability receives an inconsistent current pointer', () => {
    const invalidState = publicationState({
      currentPublicationId: 'publication-missing',
    });

    expect(evaluateKnowledgeUseAvailability({
      state: invalidState,
      assetApprovalStatus: 'approved',
    })).toEqual({
      canRetrieve: false,
      canAnswer: false,
      canSendAttachment: false,
      reasonCodes: ['state_invalid'],
    });
  });
});
