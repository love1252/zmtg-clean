import { describe, expect, it } from 'vitest';

import { proposeKnowledgeAnswerSnapshotCandidate } from '../domain/knowledge-answer-snapshot-candidate';

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

function expectClosed(input: unknown) {
  expect(() => proposeKnowledgeAnswerSnapshotCandidate(input)).not.toThrow();
  expect(proposeKnowledgeAnswerSnapshotCandidate(input)).toEqual({
    ok: false,
    reasonCodes: ['input_invalid'],
  });
}

describe('knowledge answer snapshot candidate boundary', () => {
  it('fails closed for Proxy and revoked Proxy input without invoking caller behavior', () => {
    const proxy = new Proxy(candidateInput(), {});
    const { proxy: revoked, revoke } = Proxy.revocable(candidateInput(), {});
    revoke();

    expectClosed(proxy);
    expectClosed(revoked);
  });

  it('rejects accessors, symbols, hidden fields, custom prototypes, and null prototypes', () => {
    const accessor = candidateInput();
    Object.defineProperty(accessor, 'questionHash', {
      enumerable: true,
      get: () => `sha256:${'a'.repeat(64)}`,
    });
    const symbol = { ...candidateInput(), [Symbol('hidden')]: 'value' };
    const hidden = candidateInput();
    Object.defineProperty(hidden, 'hidden', { value: 'value' });
    const custom = Object.assign(Object.create({ inherited: true }), candidateInput());
    const nullPrototype = Object.assign(Object.create(null), candidateInput());

    expectClosed(accessor);
    expectClosed(symbol);
    expectClosed(hidden);
    expectClosed(custom);
    expectClosed(nullPrototype);
  });

  it('rejects Proxy, sparse, accessor, symbol, hidden, and prototype-mutated reference arrays', () => {
    const sparse = [opaque('cite', 'e')] as string[];
    sparse.length = 2;
    const accessor = [opaque('cite', 'e')];
    Object.defineProperty(accessor, '0', {
      enumerable: true,
      get: () => opaque('cite', 'e'),
    });
    const symbol = [opaque('cite', 'e')];
    Object.defineProperty(symbol as object, Symbol('hidden'), { value: 'value' });
    const hidden = [opaque('cite', 'e')];
    Object.defineProperty(hidden, 'hidden', { value: 'value' });
    const custom = [opaque('cite', 'e')];
    Object.setPrototypeOf(custom, { custom: true });

    for (const citationReferenceHashes of [
      new Proxy([opaque('cite', 'e')], {}),
      sparse,
      accessor,
      symbol,
      hidden,
      custom,
    ]) {
      expectClosed(candidateInput({ citationReferenceHashes }));
    }
  });

  it('does not retain mutable caller arrays after descriptor snapshotting', () => {
    const references = [opaque('cite', 'e')];
    const input = candidateInput({ citationReferenceHashes: references });
    const decision = proposeKnowledgeAnswerSnapshotCandidate(input);

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    references[0] = opaque('cite', 'f');
    expect(decision.candidate).not.toHaveProperty('citationReferenceHashes');
    expect(Object.isFrozen(decision.candidate.ownerRequirements)).toBe(true);
  });

  it('rejects oversize, fractional, non-finite, and wrong-type bounds without a sensitive blacklist', () => {
    for (const input of [
      candidateInput({ questionLength: 4097 }),
      candidateInput({ questionLength: 1.5 }),
      candidateInput({ contentLength: Number.POSITIVE_INFINITY }),
      candidateInput({ contentLength: '240' }),
      candidateInput({ securityResultCandidate: 'safe' }),
      candidateInput({ noAnswerReason: 'free-text reason' }),
    ]) {
      expectClosed(input);
    }
  });
});
