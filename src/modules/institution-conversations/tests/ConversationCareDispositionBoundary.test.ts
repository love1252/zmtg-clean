import { describe, expect, it } from 'vitest';

import {
  classifyCareDisposition,
  closeCareDispositionNormally,
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
    snapshotCreatedAt: '2026-07-18T00:00:01.000Z', serverReferenceTime: '2026-07-18T01:00:00.000Z', ...overrides,
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
      serverReferenceTime: '2026-07-18T01:00:00.000Z',
      ...override,
    });

    expect(result).toEqual({ kind: 'blocked', code });
  });

  it('rejects unknown blockers, free text, and raw reference-shaped values', () => {
    expect(createPendingCareDisposition(input({ blockingReasonCodes: ['other' as never] }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(createPendingCareDisposition(input({ auditReference: 'free_text_not_allowed' }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(createPendingCareDisposition(input({ riskClosureReference: 'untrusted_reference' }))).toEqual({ kind: 'blocked', code: 'risk_conflict' });
    expect(createPendingCareDisposition(input({ conversationId: '13800138000' }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(createPendingCareDisposition(input({ auditReference: 'audit_medical_record_1' }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
  });

  it('rejects accessor, extra-field, and Proxy inputs without preserving caller objects', () => {
    const accessor = input() as Record<string, unknown>;
    Object.defineProperty(accessor, 'auditReference', { enumerable: true, get: () => 'audit_created_safe' });
    expect(createPendingCareDisposition(accessor)).toEqual({ kind: 'blocked', code: 'input_invalid' });

    expect(createPendingCareDisposition({ ...input(), extra: 'nope' } as unknown)).toEqual({ kind: 'blocked', code: 'input_invalid' });

    const transparentProxy = new Proxy(input(), {});
    expect(createPendingCareDisposition(transparentProxy)).toEqual({ kind: 'blocked', code: 'input_invalid' });

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
      serverReferenceTime: '2026-07-18T01:00:00.000Z',
    });

    expect(result).toEqual({ kind: 'blocked', code: 'source_message_not_new' });
  });

  it('refuses force-close on an already invalidated revision', () => {
    const classified = classifyCareDisposition(pending(), {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: 'disposition-safe', expectedRevision: 1,
      conversationId: 'conversation-safe', segmentId: 'segment-safe', sourceMessageId: 'message-safe', classification: 'ambiguous',
      resolutionState: 'open', classifiedAt: '2026-07-18T00:01:00.000Z', resolvedAt: null, riskState: 'none', riskDomain: null,
      riskClosureReference: null, blockingReasonCodes: [], auditReference: 'audit_classified_safe',
      serverReferenceTime: '2026-07-18T01:00:00.000Z',
    });
    if (classified.kind !== 'appended') throw new Error('expected classified disposition');

    const result = forceCloseCareDisposition(classified.previous, {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: 'disposition-safe', expectedRevision: 1,
      conversationId: 'conversation-safe', segmentId: 'segment-safe', sourceMessageId: 'message-safe',
      segmentClosedAt: '2026-07-18T00:02:00.000Z', auditReference: 'audit_forced_safe',
      serverReferenceTime: '2026-07-18T01:00:00.000Z',
    });
    expect(result).toEqual({ kind: 'blocked', code: 'not_current' });
  });

  it.each([
    ['unclassified', pending(), 'state_conflict'],
    ['clinical unconfirmed', pending({ riskState: 'unconfirmed', riskDomain: 'clinical', blockingReasonCodes: ['clinical_risk'] }), 'state_conflict'],
    ['clinical confirmed', pending({ riskState: 'confirmed', riskDomain: 'clinical', blockingReasonCodes: ['clinical_risk'] }), 'state_conflict'],
    ['any blocker', pending({ blockingReasonCodes: ['complaint'] }), 'state_conflict'],
  ] as const)('rejects normal close for %s facts', (_name, current, code) => {
    expect(closeCareDispositionNormally(current, {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: 'disposition-safe', expectedRevision: 1,
      conversationId: 'conversation-safe', segmentId: 'segment-safe', sourceMessageId: 'message-safe',
      segmentClosedAt: '2026-07-18T00:02:00.000Z', auditReference: 'audit_closed_safe',
      serverReferenceTime: '2026-07-18T01:00:00.000Z',
    })).toEqual({ kind: 'blocked', code });
  });

  it('rejects overflow revisions and non-canonical, impossible, future, or regressing timestamps', () => {
    expect(createPendingCareDisposition(input({ sourceMessageRevision: Number.MAX_SAFE_INTEGER }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    const overflowRevision = structuredClone(pending()) as { revision: number };
    overflowRevision.revision = Number.MAX_SAFE_INTEGER;
    expect(classifyCareDisposition(overflowRevision, {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: 'disposition-safe', expectedRevision: Number.MAX_SAFE_INTEGER,
      conversationId: 'conversation-safe', segmentId: 'segment-safe', sourceMessageId: 'message-safe', classification: 'ambiguous',
      resolutionState: 'open', classifiedAt: '2026-07-18T00:01:00.000Z', resolvedAt: null, riskState: 'none', riskDomain: null,
      riskClosureReference: null, blockingReasonCodes: [], auditReference: 'audit_classified_safe', serverReferenceTime: '2026-07-18T01:00:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(createPendingCareDisposition(input({ sourceMessageOccurredAt: '2026-02-30T00:00:00.000Z' }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(createPendingCareDisposition(input({ snapshotCreatedAt: '2099-01-01T00:00:00.000Z', serverReferenceTime: '2026-07-18T01:00:00.000Z' }))).toEqual({ kind: 'blocked', code: 'timestamp_conflict' });
    expect(createPendingCareDisposition(input({ lastCustomerMessageAt: '2026-07-17T23:59:59.999Z' }))).toEqual({ kind: 'blocked', code: 'timestamp_conflict' });
  });
});
