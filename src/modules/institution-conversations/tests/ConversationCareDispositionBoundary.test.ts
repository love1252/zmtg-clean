import { describe, expect, it } from 'vitest';

import {
  classifyCareDisposition as reduceClassifyCareDisposition,
  closeCareDispositionNormally as reduceCloseCareDispositionNormally,
  createPendingCareDisposition as reduceCreatePendingCareDisposition,
  forceCloseCareDisposition as reduceForceCloseCareDisposition,
  invalidateCareDispositionForCustomerInbound as reduceInvalidateCareDispositionForCustomerInbound,
  type CareDisposition,
  type CreatePendingCareDispositionInput,
} from '@/modules/institution-conversations/domain/conversation-care-dispositions';

const token = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const nextToken = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
const references = Object.freeze({
  dispositionId: `disp_${token}`,
  conversationId: `conv_${token}`,
  segmentId: `seg_${token}`,
  sourceMessageId: `msg_${token}`,
  otherConversationId: `conv_${nextToken}`,
  otherSourceMessageId: `msg_${nextToken}`,
  nextSourceMessageId: `msg_${nextToken}`,
  createdAudit: `audit_${token}`,
  classifiedAudit: `audit_${nextToken}`,
  newAudit: `audit_${'a'.repeat(64)}`,
  closedAudit: `audit_${'b'.repeat(64)}`,
  forcedAudit: `audit_${'c'.repeat(64)}`,
  riskClosure: `riskclose_${token}`,
});

function serverClock(): { referenceTime: string } {
  return { referenceTime: '2026-07-18T01:00:00.000Z' };
}

const createPendingCareDisposition = (rawInput: unknown) => reduceCreatePendingCareDisposition(rawInput, serverClock());
const classifyCareDisposition = (rawCurrent: unknown, rawInput: unknown) => reduceClassifyCareDisposition(rawCurrent, rawInput, serverClock());
const invalidateCareDispositionForCustomerInbound = (rawCurrent: unknown, rawInput: unknown) => reduceInvalidateCareDispositionForCustomerInbound(rawCurrent, rawInput, serverClock());
const closeCareDispositionNormally = (rawCurrent: unknown, rawInput: unknown) => reduceCloseCareDispositionNormally(rawCurrent, rawInput, serverClock());
const forceCloseCareDisposition = (rawCurrent: unknown, rawInput: unknown) => reduceForceCloseCareDisposition(rawCurrent, rawInput, serverClock());

function input(overrides: Partial<CreatePendingCareDispositionInput> = {}): CreatePendingCareDispositionInput {
  return {
    dispositionId: references.dispositionId, tenantId: 'tenant-safe', institutionId: 'institution-safe',
    conversationId: references.conversationId, segmentId: references.segmentId, sourceMessageId: references.sourceMessageId,
    sourceMessageOccurredAt: '2026-07-18T00:00:00.000Z', sourceMessageRevision: 1,
    lastCustomerMessageAt: '2026-07-18T00:00:00.000Z', identityState: 'unmatched', riskState: 'none',
    riskDomain: null, riskClosureReference: null, blockingReasonCodes: [], auditReference: references.createdAudit,
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
    ['target', { conversationId: references.otherConversationId }, 'target_mismatch'],
    ['source', { sourceMessageId: references.otherSourceMessageId }, 'source_message_mismatch'],
    ['revision', { expectedRevision: 2 }, 'revision_conflict'],
  ] as const)('rejects %s mismatch before deriving a new snapshot', (_name, override, code) => {
    const result = classifyCareDisposition(pending(), {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: references.dispositionId, expectedRevision: 1,
      conversationId: references.conversationId, segmentId: references.segmentId, sourceMessageId: references.sourceMessageId,
      classification: 'ambiguous', resolutionState: 'open', classifiedAt: '2026-07-18T00:01:00.000Z', resolvedAt: null,
      riskState: 'none', riskDomain: null, riskClosureReference: null, blockingReasonCodes: [], auditReference: references.classifiedAudit,
      ...override,
    });

    expect(result).toEqual({ kind: 'blocked', code });
  });

  it('rejects uncontrolled object-reference values rather than inferring low sensitivity from words', () => {
    expect(createPendingCareDisposition(input({ blockingReasonCodes: ['other' as never] }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    const attackValues = [
      '张三', '上海市静安区南京西路', '请尽快处理这段完整消息正文', 'wxid_abc123',
      '138-0013-8000', '110105-19491231-002X', '病历诊断：高血压',
    ];
    const fields = ['dispositionId', 'conversationId', 'segmentId', 'sourceMessageId', 'auditReference'] as const;

    for (const value of attackValues) {
      for (const field of fields) {
        expect(createPendingCareDisposition(input({ [field]: value }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
      }
      expect(createPendingCareDisposition(input({
        riskState: 'resolved', riskDomain: 'non_clinical', riskClosureReference: value,
      }))).toEqual({ kind: 'blocked', code: 'risk_conflict' });
    }
  });

  it('rejects accessor, extra-field, and Proxy inputs without preserving caller objects', () => {
    const accessor = input() as Record<string, unknown>;
    Object.defineProperty(accessor, 'auditReference', { enumerable: true, get: () => references.createdAudit });
    expect(createPendingCareDisposition(accessor)).toEqual({ kind: 'blocked', code: 'input_invalid' });

    expect(createPendingCareDisposition({ ...input(), extra: 'nope' } as unknown)).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(createPendingCareDisposition({ ...input(), serverReferenceTime: '2099-01-01T00:00:00.000Z' } as unknown)).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(reduceCreatePendingCareDisposition(input(), new Proxy(serverClock(), {}))).toEqual({ kind: 'blocked', code: 'input_invalid' });

    const transparentProxy = new Proxy(input(), {});
    expect(createPendingCareDisposition(transparentProxy)).toEqual({ kind: 'blocked', code: 'input_invalid' });

    const proxied = new Proxy(input(), { ownKeys: () => { throw new Error('unexpected enumeration'); } });
    expect(createPendingCareDisposition(proxied)).toEqual({ kind: 'blocked', code: 'input_invalid' });
  });

  it('rejects stale/duplicate inbound facts and never reuses an old classification', () => {
    const result = invalidateCareDispositionForCustomerInbound(pending(), {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: references.dispositionId, expectedRevision: 1,
      conversationId: references.conversationId, segmentId: references.segmentId, sourceMessageId: references.sourceMessageId,
      sourceMessageOccurredAt: '2026-07-18T00:00:00.000Z', sourceMessageRevision: 1,
      lastCustomerMessageAt: '2026-07-18T00:00:00.000Z', identityState: 'unmatched', riskState: 'none', riskDomain: null,
      riskClosureReference: null, blockingReasonCodes: [], auditReference: references.newAudit, snapshotCreatedAt: '2026-07-18T00:02:00.000Z',
    });

    expect(result).toEqual({ kind: 'blocked', code: 'source_message_not_new' });
  });

  it('refuses force-close on an already invalidated revision', () => {
    const classified = classifyCareDisposition(pending(), {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: references.dispositionId, expectedRevision: 1,
      conversationId: references.conversationId, segmentId: references.segmentId, sourceMessageId: references.sourceMessageId, classification: 'ambiguous',
      resolutionState: 'open', classifiedAt: '2026-07-18T00:01:00.000Z', resolvedAt: null, riskState: 'none', riskDomain: null,
      riskClosureReference: null, blockingReasonCodes: [], auditReference: references.classifiedAudit,
    });
    if (classified.kind !== 'appended') throw new Error('expected classified disposition');

    const result = forceCloseCareDisposition(classified.previous, {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: references.dispositionId, expectedRevision: 1,
      conversationId: references.conversationId, segmentId: references.segmentId, sourceMessageId: references.sourceMessageId,
      segmentClosedAt: '2026-07-18T00:02:00.000Z', auditReference: references.forcedAudit,
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
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: references.dispositionId, expectedRevision: 1,
      conversationId: references.conversationId, segmentId: references.segmentId, sourceMessageId: references.sourceMessageId,
      segmentClosedAt: '2026-07-18T00:02:00.000Z', auditReference: references.closedAudit,
    })).toEqual({ kind: 'blocked', code });
  });

  it('rejects overflow revisions and non-canonical, impossible, future, or regressing timestamps', () => {
    expect(createPendingCareDisposition(input({ sourceMessageRevision: Number.MAX_SAFE_INTEGER }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    const overflowRevision = structuredClone(pending()) as { revision: number };
    overflowRevision.revision = Number.MAX_SAFE_INTEGER;
    expect(classifyCareDisposition(overflowRevision, {
      tenantId: 'tenant-safe', institutionId: 'institution-safe', dispositionId: references.dispositionId, expectedRevision: Number.MAX_SAFE_INTEGER,
      conversationId: references.conversationId, segmentId: references.segmentId, sourceMessageId: references.sourceMessageId, classification: 'ambiguous',
      resolutionState: 'open', classifiedAt: '2026-07-18T00:01:00.000Z', resolvedAt: null, riskState: 'none', riskDomain: null,
      riskClosureReference: null, blockingReasonCodes: [], auditReference: references.classifiedAudit,
    })).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(createPendingCareDisposition(input({ sourceMessageOccurredAt: '2026-02-30T00:00:00.000Z' }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(createPendingCareDisposition(input({ snapshotCreatedAt: '2099-01-01T00:00:00.000Z' }))).toEqual({ kind: 'blocked', code: 'timestamp_conflict' });
    expect(createPendingCareDisposition(input({ lastCustomerMessageAt: '2026-07-17T23:59:59.999Z' }))).toEqual({ kind: 'blocked', code: 'timestamp_conflict' });
  });
});
