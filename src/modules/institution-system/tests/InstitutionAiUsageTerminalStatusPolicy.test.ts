import { describe, expect, it } from 'vitest';

import { createAiUsageOutcomeClassifier } from '@/modules/institution-system/domain/ai-usage-outcomes';
import { getInstitutionAiUsageTerminalStatusPolicySnapshot } from '@/modules/institution-system/server/institution-ai-usage-terminal-status-policy';

describe('Institution AI usage terminal-status policy', () => {
  it('returns the fixed, versioned owner policy and keeps unknown statuses incomplete', () => {
    const result = getInstitutionAiUsageTerminalStatusPolicySnapshot();

    expect(result).toEqual({
      ok: true,
      snapshot: {
        revision: 'institution_ai_usage_terminal_status_policy_v1',
        terminalStatusPolicy: {
          succeeded: 'success',
          failed: 'failure',
          rate_limited: 'failure',
          provider_unavailable: 'failure',
          rejected: 'rejection',
          sensitive_input_rejected: 'rejection',
        },
      },
    });
    if (!result.ok) throw new Error('expected owner policy');

    const classifier = createAiUsageOutcomeClassifier(result.snapshot.terminalStatusPolicy);
    expect(classifier).toEqual(expect.objectContaining({ ok: true }));
    if (!classifier.ok) throw new Error('expected classifier');
    expect(classifier.classify('succeeded')).toBe('success');
    expect(classifier.classify('provider_unavailable')).toBe('failure');
    expect(classifier.classify('sensitive_input_rejected')).toBe('rejection');
    expect(classifier.classify('future_status')).toBe('incomplete');
    expect(Object.isFrozen(result.snapshot)).toBe(true);
    expect(Object.isFrozen(result.snapshot.terminalStatusPolicy)).toBe(true);
  });
});
