import { describe, expect, it } from 'vitest';

import {
  createInstitutionAiUsageReadonlyViewModel,
} from '@/modules/institution-system/domain/ai-usage-readonly-view';

const readyInput = {
  kind: 'ready',
  metrics: {
    totalCallCount: 6,
    serviceUnits: null,
    failureCount: 1,
    rejectionCount: 1,
    incompleteCount: 1,
    successRate: { numerator: 3, denominator: 5, value: 0.6 },
    byServiceKey: [
      {
        serviceKey: 'analytics_report', totalCallCount: 2, serviceUnits: null,
        failureCount: 0, rejectionCount: 1, incompleteCount: 0,
        successRate: { numerator: 1, denominator: 2, value: 0.5 },
      },
      {
        serviceKey: 'conversation_ai', totalCallCount: 2, serviceUnits: null,
        failureCount: 0, rejectionCount: 0, incompleteCount: 1,
        successRate: { numerator: 1, denominator: 1, value: 1 },
      },
      {
        serviceKey: 'knowledge_qa', totalCallCount: 2, serviceUnits: null,
        failureCount: 1, rejectionCount: 0, incompleteCount: 0,
        successRate: { numerator: 1, denominator: 2, value: 0.5 },
      },
    ],
  },
} as const;

describe('AI usage readonly view model', () => {
  it('projects only validated low-sensitivity metrics with deterministic formatting', () => {
    const model = createInstitutionAiUsageReadonlyViewModel(readyInput);

    expect(model).toEqual({
      kind: 'ready',
      summary: {
        totalCallCount: '6',
        successRate: '60.0%',
        failureCount: '1',
        rejectionCount: '1',
        incompleteCount: '1',
      },
      byServiceKey: [
        { serviceKey: 'analytics_report', totalCallCount: '2', successRate: '50.0%', failureCount: '0', rejectionCount: '1', incompleteCount: '0' },
        { serviceKey: 'conversation_ai', totalCallCount: '2', successRate: '100.0%', failureCount: '0', rejectionCount: '0', incompleteCount: '1' },
        { serviceKey: 'knowledge_qa', totalCallCount: '2', successRate: '50.0%', failureCount: '1', rejectionCount: '0', incompleteCount: '0' },
      ],
    });
    expect(Object.isFrozen(model)).toBe(true);
    if (model.kind !== 'ready') throw new Error('expected ready model');
    expect(Object.isFrozen(model.byServiceKey)).toBe(true);
  });

  it('keeps no data, partial, too many, and unavailable distinct without substituting zeros', () => {
    expect(createInstitutionAiUsageReadonlyViewModel({ kind: 'no_data' })).toEqual({ kind: 'no_data' });
    expect(createInstitutionAiUsageReadonlyViewModel({ kind: 'partial' })).toEqual({ kind: 'partial' });
    expect(createInstitutionAiUsageReadonlyViewModel({ kind: 'too_many' })).toEqual({ kind: 'too_many' });
    expect(createInstitutionAiUsageReadonlyViewModel({ kind: 'unavailable' })).toEqual({ kind: 'unavailable' });
  });

  it('keeps a zero success-rate denominator explicitly not computable', () => {
    const model = createInstitutionAiUsageReadonlyViewModel({
      ...readyInput,
      metrics: {
        ...readyInput.metrics,
        totalCallCount: 1,
        failureCount: 0,
        rejectionCount: 0,
        incompleteCount: 1,
        successRate: { numerator: 0, denominator: 0, value: null },
        byServiceKey: [{
          serviceKey: 'conversation_ai', totalCallCount: 1, serviceUnits: null,
          failureCount: 0, rejectionCount: 0, incompleteCount: 1,
          successRate: { numerator: 0, denominator: 0, value: null },
        }],
      },
    });

    expect(model).toEqual(expect.objectContaining({
      kind: 'ready',
      summary: expect.objectContaining({ successRate: '不可计算' }),
    }));
  });

  it('fails closed for scope, sensitive extras, and malformed metrics instead of rendering them', () => {
    expect(createInstitutionAiUsageReadonlyViewModel({ ...readyInput, scope: { tenantId: 'x' } }))
      .toEqual({ kind: 'unavailable' });
    expect(createInstitutionAiUsageReadonlyViewModel({
      ...readyInput,
      metrics: { ...readyInput.metrics, prompt: 'sensitive' },
    })).toEqual({ kind: 'unavailable' });
  });
});
