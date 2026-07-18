import { describe, expect, it } from 'vitest';

import { getInstitutionAiUsageServiceKeyPolicySnapshot } from '@/modules/institution-system/server/institution-ai-usage-service-key-policy';

describe('Institution AI usage service-key policy', () => {
  it('returns the fixed, versioned owner policy and never derives a mapping from a caller value', () => {
    const result = getInstitutionAiUsageServiceKeyPolicySnapshot();

    expect(result).toEqual({
      ok: true,
      snapshot: expect.objectContaining({
        revision: 'institution_ai_usage_service_key_policy_v1',
        allowedServiceKeys: ['analytics_report', 'conversation_ai', 'knowledge_qa'],
      }),
    });
    if (!result.ok) throw new Error('expected owner policy');

    expect(result.snapshot.resolve('ai_qa', 'direct_answer')).toBe('conversation_ai');
    expect(result.snapshot.resolve('ai_qa', 'quota_rejected')).toBe('conversation_ai');
    expect(result.snapshot.resolve('knowledge_base_qa', 'rag_answer')).toBe('knowledge_qa');
    expect(result.snapshot.resolve('analytics', 'report')).toBeNull();
    expect(result.snapshot.resolve('openai_gpt_5', 'provider_cost')).toBeNull();
    expect(Object.isFrozen(result.snapshot)).toBe(true);
    expect(Object.isFrozen(result.snapshot.allowedServiceKeys)).toBe(true);
  });
});
