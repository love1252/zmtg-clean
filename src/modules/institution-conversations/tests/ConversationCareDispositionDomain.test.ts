import { describe, expect, it } from 'vitest';

import {
  classifyCareDisposition,
  closeCareDispositionNormally,
  createPendingCareDisposition,
  forceCloseCareDisposition,
  invalidateCareDispositionForCustomerInbound,
  isCareDispositionConsumable,
  isValidCareDisposition,
  type CareDisposition,
  type CreatePendingCareDispositionInput,
} from '@/modules/institution-conversations/domain/conversation-care-dispositions';

function createInput(
  overrides: Partial<CreatePendingCareDispositionInput> = {},
): CreatePendingCareDispositionInput {
  return {
    dispositionId: 'disposition-1',
    tenantId: 'tenant-1',
    institutionId: 'institution-1',
    conversationId: 'conversation-1',
    segmentId: 'segment-1',
    sourceMessageId: 'message-1',
    sourceMessageOccurredAt: '2026-07-18T00:00:00.000Z',
    sourceMessageRevision: 1,
    lastCustomerMessageAt: '2026-07-18T00:00:00.000Z',
    identityState: 'matched',
    riskState: 'none',
    riskDomain: null,
    riskClosureReference: null,
    blockingReasonCodes: [],
    auditReference: 'audit_created_1',
    snapshotCreatedAt: '2026-07-18T00:00:01.000Z',
    ...overrides,
  };
}

function pending(
  overrides: Partial<CreatePendingCareDispositionInput> = {},
): CareDisposition {
  const result = createPendingCareDisposition(createInput(overrides));
  if (result.kind !== 'created') {
    throw new Error(`fixture rejected: ${result.code}`);
  }
  return result.disposition;
}

describe('Conversation care disposition domain', () => {
  it('creates an immutable unclassified current snapshot from low-sensitivity facts', () => {
    const rawInput = createInput();
    const before = structuredClone(rawInput);
    const result = createPendingCareDisposition(rawInput);

    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.disposition).toMatchObject({
      revision: 1,
      classification: null,
      resolutionState: 'open',
      segmentCloseKind: 'open',
      resolvedAt: null,
      invalidatedAt: null,
    });
    expect(Object.isFrozen(result.disposition)).toBe(true);
    expect(Object.isFrozen(result.disposition.blockingReasonCodes)).toBe(true);
    expect(isValidCareDisposition(result.disposition)).toBe(true);
    expect(isCareDispositionConsumable(result.disposition)).toBe(false);
    expect(rawInput).toEqual(before);
  });

  it('appends a classified revision and invalidates the preceding snapshot', () => {
    const result = classifyCareDisposition(pending(), {
      tenantId: 'tenant-1', institutionId: 'institution-1', dispositionId: 'disposition-1',
      expectedRevision: 1, conversationId: 'conversation-1', segmentId: 'segment-1',
      sourceMessageId: 'message-1', classification: 'simple_confirmation',
      resolutionState: 'resolved', classifiedAt: '2026-07-18T00:01:00.000Z',
      resolvedAt: '2026-07-18T00:01:00.000Z', riskState: 'none', riskDomain: null,
      riskClosureReference: null, blockingReasonCodes: [], auditReference: 'audit_classified_1',
    });

    expect(result.kind).toBe('appended');
    if (result.kind !== 'appended') return;
    expect(result.previous).toMatchObject({ resolutionState: 'invalidated', invalidatedAt: '2026-07-18T00:01:00.000Z' });
    expect(result.current).toMatchObject({ revision: 2, classification: 'simple_confirmation', resolutionState: 'resolved' });
    expect(Object.isFrozen(result.previous)).toBe(true);
    expect(Object.isFrozen(result.current)).toBe(true);
    expect(isCareDispositionConsumable(result.current)).toBe(true);
  });

  it('does not expand classification for blocker-only facts', () => {
    const result = classifyCareDisposition(pending(), {
      tenantId: 'tenant-1', institutionId: 'institution-1', dispositionId: 'disposition-1',
      expectedRevision: 1, conversationId: 'conversation-1', segmentId: 'segment-1',
      sourceMessageId: 'message-1', classification: 'ambiguous', resolutionState: 'open',
      classifiedAt: '2026-07-18T00:01:00.000Z', resolvedAt: null, riskState: 'none', riskDomain: null,
      riskClosureReference: null, blockingReasonCodes: ['complaint'], auditReference: 'audit_classified_1',
    });

    expect(result.kind).toBe('appended');
    if (result.kind !== 'appended') return;
    expect(result.current.classification).toBe('ambiguous');
    expect(result.current.blockingReasonCodes).toEqual(['complaint']);
  });

  it('requires risk classification and a controlled domain for risk facts', () => {
    const invalid = classifyCareDisposition(pending(), {
      tenantId: 'tenant-1', institutionId: 'institution-1', dispositionId: 'disposition-1',
      expectedRevision: 1, conversationId: 'conversation-1', segmentId: 'segment-1',
      sourceMessageId: 'message-1', classification: 'simple_confirmation', resolutionState: 'open',
      classifiedAt: '2026-07-18T00:01:00.000Z', resolvedAt: null, riskState: 'confirmed',
      riskDomain: 'clinical', riskClosureReference: null, blockingReasonCodes: ['clinical_risk'],
      auditReference: 'audit_classified_1',
    });

    expect(invalid).toEqual({ kind: 'blocked', code: 'risk_conflict' });
  });

  it('requires a new customer message to atomically invalidate and open a new unclassified revision', () => {
    const classified = classifyCareDisposition(pending(), {
      tenantId: 'tenant-1', institutionId: 'institution-1', dispositionId: 'disposition-1',
      expectedRevision: 1, conversationId: 'conversation-1', segmentId: 'segment-1',
      sourceMessageId: 'message-1', classification: 'substantive_consultation', resolutionState: 'resolved',
      classifiedAt: '2026-07-18T00:01:00.000Z', resolvedAt: '2026-07-18T00:01:00.000Z',
      riskState: 'none', riskDomain: null, riskClosureReference: null, blockingReasonCodes: [],
      auditReference: 'audit_classified_1',
    });
    if (classified.kind !== 'appended') throw new Error('expected classified disposition');

    const next = invalidateCareDispositionForCustomerInbound(classified.current, {
      tenantId: 'tenant-1', institutionId: 'institution-1', dispositionId: 'disposition-1',
      expectedRevision: 2, conversationId: 'conversation-1', segmentId: 'segment-1',
      sourceMessageId: 'message-2', sourceMessageOccurredAt: '2026-07-18T00:02:00.000Z',
      sourceMessageRevision: 2, lastCustomerMessageAt: '2026-07-18T00:02:00.000Z',
      identityState: 'matched', riskState: 'none', riskDomain: null, riskClosureReference: null,
      blockingReasonCodes: [], auditReference: 'audit_new_message_1', snapshotCreatedAt: '2026-07-18T00:02:01.000Z',
    });

    expect(next.kind).toBe('appended');
    if (next.kind !== 'appended') return;
    expect(next.previous).toMatchObject({ resolutionState: 'invalidated', invalidatedAt: '2026-07-18T00:02:01.000Z' });
    expect(next.current).toMatchObject({ revision: 3, sourceMessageId: 'message-2', classification: null, resolutionState: 'open' });
  });

  it('normal close only closes the service window and does not fabricate resolution', () => {
    const result = closeCareDispositionNormally(pending(), {
      tenantId: 'tenant-1', institutionId: 'institution-1', dispositionId: 'disposition-1',
      expectedRevision: 1, conversationId: 'conversation-1', segmentId: 'segment-1',
      sourceMessageId: 'message-1', segmentClosedAt: '2026-07-18T00:03:00.000Z', auditReference: 'audit_closed_1',
    });

    expect(result.kind).toBe('appended');
    if (result.kind !== 'appended') return;
    expect(result.current).toMatchObject({ segmentCloseKind: 'normal', resolutionState: 'open', resolvedAt: null });
  });

  it('force close preserves risk and adds only the fixed unresolved blocker', () => {
    const result = forceCloseCareDisposition(pending({
      riskState: 'confirmed', riskDomain: 'clinical', blockingReasonCodes: ['clinical_risk'],
    }), {
      tenantId: 'tenant-1', institutionId: 'institution-1', dispositionId: 'disposition-1',
      expectedRevision: 1, conversationId: 'conversation-1', segmentId: 'segment-1',
      sourceMessageId: 'message-1', segmentClosedAt: '2026-07-18T00:03:00.000Z', auditReference: 'audit_forced_1',
    });

    expect(result.kind).toBe('appended');
    if (result.kind !== 'appended') return;
    expect(result.current).toMatchObject({
      segmentCloseKind: 'forced', resolutionState: 'open', resolvedAt: null,
      riskState: 'confirmed', riskDomain: 'clinical',
    });
    expect(result.current.blockingReasonCodes).toEqual(['clinical_risk', 'forced_close_unresolved']);
  });
});
