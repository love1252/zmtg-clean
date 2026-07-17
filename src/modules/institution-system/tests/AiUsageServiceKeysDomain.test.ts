import { describe, expect, it } from 'vitest';
import {
  createAiUsageServiceKeyPolicySnapshot,
  type AiUsageServiceKeyPolicy,
} from '@/modules/institution-system/domain/ai-usage-service-keys';

function requirePolicySnapshot(policy: AiUsageServiceKeyPolicy) {
  const result = createAiUsageServiceKeyPolicySnapshot(policy);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.code);
  }
  return result.isAllowed;
}

describe('AI usage service key domain', () => {
  it('只允许调用者注入的低敏稳定 serviceKey，不内置生产注册表', () => {
    const isAllowed = requirePolicySnapshot([
      'conversation_ai',
      'knowledge_qa',
      'analytics_report',
      'future_approved_ai',
    ]);

    expect(isAllowed('conversation_ai')).toBe(true);
    expect(isAllowed('knowledge_qa')).toBe(true);
    expect(isAllowed('analytics_report')).toBe(true);
    expect(isAllowed('future_approved_ai')).toBe(true);
    expect(isAllowed('future_unapproved_ai')).toBe(false);
  });

  it.each([
    { name: '空策略', policy: [] },
    { name: 'null', policy: null },
    { name: '普通对象', policy: { 0: 'conversation_ai', length: 1 } },
    { name: 'Set', policy: new Set(['conversation_ai']) },
    { name: '字符串', policy: 'conversation_ai' },
  ])('拒绝$name且不创建部分策略快照', ({ policy }) => {
    expect(createAiUsageServiceKeyPolicySnapshot(
      policy as unknown as AiUsageServiceKeyPolicy,
    )).toEqual({
      ok: false,
      code: 'invalid_service_key_policy',
    });
  });

  it.each([
    '',
    ' conversation_ai',
    'conversation_ai ',
    'Conversation_AI',
    'conversation-ai',
    'conversation.ai',
    'conversation/ai',
    '_conversation_ai',
    'conversation_ai_',
    'conversation__ai',
    'conversation AI',
    '会话_ai',
    'a'.repeat(65),
  ])('拒绝非低敏稳定机器 key：%s', (invalidServiceKey) => {
    expect(createAiUsageServiceKeyPolicySnapshot([invalidServiceKey])).toEqual({
      ok: false,
      code: 'invalid_service_key_policy',
    });
  });

  it('接受 1 至 64 字符的小写 snake_case 边界', () => {
    const shortestKey = 'a';
    const longestKey = 'a'.repeat(64);
    const isAllowed = requirePolicySnapshot([shortestKey, longestKey]);

    expect(isAllowed(shortestKey)).toBe(true);
    expect(isAllowed(longestKey)).toBe(true);
  });

  it('拒绝重复、稀疏和非字符串策略项', () => {
    const sparsePolicy = new Array<string>(3);
    sparsePolicy[0] = 'conversation_ai';
    sparsePolicy[2] = 'knowledge_qa';

    for (const policy of [
      ['conversation_ai', 'conversation_ai'],
      sparsePolicy,
      ['conversation_ai', 1],
    ]) {
      expect(createAiUsageServiceKeyPolicySnapshot(
        policy as unknown as AiUsageServiceKeyPolicy,
      )).toEqual({
        ok: false,
        code: 'invalid_service_key_policy',
      });
    }
  });

  it('不修改输入，并以创建时快照拒绝后续替换或自动注册', () => {
    const policy = ['conversation_ai', 'knowledge_qa'];
    const before = structuredClone(policy);
    const isAllowed = requirePolicySnapshot(policy);

    expect(policy).toEqual(before);

    policy[0] = 'analytics_report';
    policy.push('future_approved_ai');

    expect(isAllowed('conversation_ai')).toBe(true);
    expect(isAllowed('knowledge_qa')).toBe(true);
    expect(isAllowed('analytics_report')).toBe(false);
    expect(isAllowed('future_approved_ai')).toBe(false);
  });
});
