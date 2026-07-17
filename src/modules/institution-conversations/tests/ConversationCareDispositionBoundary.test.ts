import { describe, expect, it } from 'vitest';

import {
  classifyCareDisposition,
  createPendingCareDisposition,
  forceCloseCareDisposition,
  invalidateCareDispositionForCustomerInbound,
  type CareDisposition,
  type CreatePendingCareDispositionInput,
} from '@/modules/institution-conversations/domain/conversation-care-dispositions';

function input(overrides: Partial<CreatePendingCareDispositionInput> = {}): CreatePendingCareDispositionInput {
  return {
    dispositionId: 'disposition-safe', tenantId: 'tenant-safe', institutionId: 'institution-safe',
    conversationId: 'conversation-safe', segmentId: 'segment-safe', sourceMessageId: 'message-safe',
    sourceMessageOccurredAt: '2026-07-18T00:00:00.000Z', sourceMessageRevision: 1,
    lastCustomerMessageAt: '2026-07-18T00:00:00.000Z', identityState: 'unmatched', riskState: 'none',
    riskDomain: null, riskClosureReference: null, blockingReasonCodes: [], auditReference: 'audit_created_safe',
    snapshotCreatedAt: '2026-07-18T00:00:01.000Z', ...overrides,
  };
}

function pending(overrides: Partial<CreatePendingCareDispositionInput> = {}): CareDisposition {
  const result = createPendingCareDisposition(input(overrides));
  if (result.kind !== 'created') throw new Error(`fixture rejected: ${result.code}`);
  return result.disposition;
}

describe('Conversation care disposition boundary', () => {
  it.each([
    ['scope', { institutionId: 'institution-other' }, 'scope_mismatch'],
    ['target', { conversationId: 'conversation-other' }, 'target_mismatch'],
    ['source', { sourceMessageId: 'message-other' }, 'source_message_mismatch'],
    ['revision', { expectedRevision: 2 }, 'revision_conflict'],
  ] as const)('rejects %s mismatch before deriving a new snapshot', (_name, override, code) => {
    const result = classifyCareDisposition(pending(), {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: 'disposition-safe', expectedRevision: 1,
      conversationId: 'conversation-safe', segmentId: 'segment-safe', sourceMessageId: 'message-safe',
      classification: 'ambiguous', resolutionState: 'open', classifiedAt: '2026-07-18T00:01:00.000Z', resolvedAt: null,
      riskState: 'none', riskDomain: null, riskClosureReference: null, blockingReasonCodes: [], auditReference: 'audit_classified_safe',
      ...override,
    });

    expect(result).toEqual({ kind: 'blocked', code });
  });

  it('rejects unknown blockers, free text, and raw reference-shaped values', () => {
    expect(createPendingCareDisposition(input({ blockingReasonCodes: ['other' as never] }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(createPendingCareDisposition(input({ auditReference: 'free_text_not_allowed' }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(createPendingCareDisposition(input({ riskClosureReference: 'untrusted_reference' }))).toEqual({ kind: 'blocked', code: 'risk_conflict' });
  });

  it('rejects accessor, extra-field, and Proxy inputs without preserving caller objects', () => {
    const accessor = input() as Record<string, unknown>;
    Object.defineProperty(accessor, 'auditReference', { enumerable: true, get: () => 'audit_created_safe' });
    expect(createPendingCareDisposition(accessor)).toEqual({ kind: 'blocked', code: 'input_invalid' });

    expect(createPendingCareDisposition({ ...input(), extra: 'nope' } as unknown)).toEqual({ kind: 'blocked', code: 'input_invalid' });

    const proxied = new Proxy(input(), { ownKeys: () => { throw new Error('unexpected enumeration'); } });
    expect(createPendingCareDisposition(proxied)).toEqual({ kind: 'blocked', code: 'input_invalid' });
  });

  it('rejects stale/duplicate inbound facts and never reuses an old classification', () => {
    const result = invalidateCareDispositionForCustomerInbound(pending(), {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: 'disposition-safe', expectedRevision: 1,
      conversationId: 'conversation-safe', segmentId: 'segment-safe', sourceMessageId: 'message-safe',
      sourceMessageOccurredAt: '2026-07-18T00:00:00.000Z', sourceMessageRevision: 1,
      lastCustomerMessageAt: '2026-07-18T00:00:00.000Z', identityState: 'unmatched', riskState: 'none', riskDomain: null,
      riskClosureReference: null, blockingReasonCodes: [], auditReference: 'audit_new_safe', snapshotCreatedAt: '2026-07-18T00:02:00.000Z',
    });

    expect(result).toEqual({ kind: 'blocked', code: 'source_message_not_new' });
  });

  it('refuses force-close on an already invalidated revision', () => {
    const classified = classifyCareDisposition(pending(), {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: 'disposition-safe', expectedRevision: 1,
      conversationId: 'conversation-safe', segmentId: 'segment-safe', sourceMessageId: 'message-safe', classification: 'ambiguous',
      resolutionState: 'open', classifiedAt: '2026-07-18T00:01:00.000Z', resolvedAt: null, riskState: 'none', riskDomain: null,
      riskClosureReference: null, blockingReasonCodes: [], auditReference: 'audit_classified_safe',
    });
    if (classified.kind !== 'appended') throw new Error('expected classified disposition');

    const result = forceCloseCareDisposition(classified.previous, {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: 'disposition-safe', expectedRevision: 1,
      conversationId: 'conversation-safe', segmentId: 'segment-safe', sourceMessageId: 'message-safe',
      segmentClosedAt: '2026-07-18T00:02:00.000Z', auditReference: 'audit_forced_safe',
    });
    expect(result).toEqual({ kind: 'blocked', code: 'not_current' });
  });
});
