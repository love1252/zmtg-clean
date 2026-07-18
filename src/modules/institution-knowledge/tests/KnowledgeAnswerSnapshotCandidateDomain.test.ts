import { describe, expect, it } from 'vitest';

import {
  knowledgeAnswerNoAnswerReasons,
  proposeKnowledgeAnswerSnapshotCandidate,
} from '../domain/knowledge-answer-snapshot-candidate';

const opaque = (prefix: string, fill: string): string =>
  `${prefix}_${fill.repeat(64)}`;

function candidateInput(overrides: Record<string, unknown> = {}) {
  return {
    candidateReference: opaque('anscand', 'a'),
    scopeKind: 'institution',
    scopeReferenceHash: opaque('scope', 'b'),
    questionHash: `sha256:${'c'.repeat(64)}`,
    questionLength: 91,
    contentHash: `sha256:${'d'.repeat(64)}`,
    contentLength: 240,
    citationReferenceHashes: [opaque('cite', 'e')],
    securityResultCandidate: 'allowed',
    noAnswerReason: 'relevance_insufficient',
    ...overrides,
  };
}

describe('knowledge answer snapshot candidate domain', () => {
  it('emits only a deeply frozen blocked non-authorizing candidate', () => {
    const input = candidateInput();
    const before = structuredClone(input);
    const decision = proposeKnowledgeAnswerSnapshotCandidate(input);

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(input).toEqual(before);
    expect(decision.candidate.authorization).toBe('non_authorizing');
    expect(decision.candidate.status).toBe('blocked');
    expect(decision.candidate.kind).toBe('non_authorizing_candidate');
    expect(decision.candidate.candidateReference).toBe(opaque('anscand', 'a'));
    expect(decision.candidate).not.toHaveProperty('answer');
    expect(decision.candidate).not.toHaveProperty('citation');
    expect(decision.candidate).not.toHaveProperty('retrievalResult');
    expect(decision.candidate).not.toHaveProperty('publication');
    expect(decision.candidate).not.toHaveProperty('auditRecord');
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.candidate)).toBe(true);
    expect(Object.isFrozen(decision.candidate.ownerRequirements)).toBe(true);
    expect(Object.isFrozen(decision.candidate.ownerRequirements[0])).toBe(true);
    expect(decision.candidate.ownerRequirements.map((item) => item.code)).toEqual([
      'owner_sealed_current_publication_citations_required',
      'base_fresh_institution_action_object_guard_required',
      'authoritative_single_scope_required',
      'result_safety_validation_required',
      'mig03_atomic_snapshot_audit_required',
      'retention_required',
      'capability_release_required',
    ]);
  });

  it('keeps all controlled no-answer reasons blocked and never treats candidate security as authorization', () => {
    for (const noAnswerReason of knowledgeAnswerNoAnswerReasons) {
      const decision = proposeKnowledgeAnswerSnapshotCandidate(
        candidateInput({ noAnswerReason, securityResultCandidate: 'allowed' }),
      );

      expect(decision.ok).toBe(true);
      if (!decision.ok) continue;
      expect(decision.candidate.status).toBe('blocked');
      expect(decision.candidate.noAnswerReason).toBe(noAnswerReason);
      expect(decision.candidate.securityResultCandidate).toBe('allowed');
    }
  });

  it('requires one opaque scope candidate and bounded opaque references without implementing hash IO', () => {
    const invalidInputs = [
      candidateInput({ scopeKind: 'customer', scopeReferenceHash: 'customer-42' }),
      candidateInput({ questionHash: 'sha256:not-a-real-hash' }),
      candidateInput({ questionHash: `sha256:${'c'.repeat(64)}\n` }),
      candidateInput({ contentLength: -1 }),
      candidateInput({ citationReferenceHashes: [] }),
      candidateInput({ citationReferenceHashes: [opaque('cite', 'e'), opaque('cite', 'e')] }),
      candidateInput({ citationReferenceHashes: Array.from({ length: 17 }, (_, index) => opaque('cite', index.toString(16))) }),
    ];

    for (const input of invalidInputs) {
      const decision = proposeKnowledgeAnswerSnapshotCandidate(input);
      expect(decision).toEqual({ ok: false, reasonCodes: ['input_invalid'] });
    }
  });

  it('rejects sensitive or provider-shaped raw fields by exact shape without copying them into output', () => {
    const decision = proposeKnowledgeAnswerSnapshotCandidate({
      ...candidateInput(),
      questionBody: 'customer message body',
      answerBody: 'provider completion',
      customerFreeText: 'customer name',
      model: 'model-name',
      provider: 'provider-name',
      tokenCount: 123,
      cost: 9,
    });

    expect(decision).toEqual({ ok: false, reasonCodes: ['input_invalid'] });
    expect(JSON.stringify(decision)).not.toContain('customer message body');
    expect(JSON.stringify(decision)).not.toContain('provider completion');
  });
});
