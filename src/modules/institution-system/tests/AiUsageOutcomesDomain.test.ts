import { describe, expect, it } from 'vitest';
import {
  createAiUsageOutcomeClassifier,
  type AiUsageTerminalOutcome,
  type AiUsageTerminalStatusPolicy,
} from '@/modules/institution-system/domain/ai-usage-outcomes';

const terminalStatusPolicy = {
  succeeded: 'success',
  failed: 'failure',
  provider_unavailable: 'failure',
  rate_limited: 'failure',
  rejected: 'rejection',
  sensitive_input_rejected: 'rejection',
} satisfies AiUsageTerminalStatusPolicy;

function requireClassifier(policy: AiUsageTerminalStatusPolicy = terminalStatusPolicy) {
  const result = createAiUsageOutcomeClassifier(policy);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.code);
  }
  return result.classify;
}

describe('AI usage outcome domain', () => {
  it.each([
    ['succeeded', 'success'],
    ['failed', 'failure'],
    ['provider_unavailable', 'failure'],
    ['rate_limited', 'failure'],
    ['rejected', 'rejection'],
    ['sensitive_input_rejected', 'rejection'],
  ] as const)('按调用者终态策略将 %s 确定性归类为 %s', (status, expected) => {
    expect(requireClassifier()(status)).toBe(expected);
  });

  it.each([
    'queued',
    'running',
    'future_terminal_status',
    '',
    null,
    undefined,
  ] as const)('未列入策略的状态 %s 一律归为 incomplete', (status) => {
    expect(requireClassifier()(status)).toBe('incomplete');
  });

  it('相同持久化状态仅由调用者策略决定，不按状态名称猜测', () => {
    const classifiedAsFailure = requireClassifier({ rate_limited: 'failure' });
    const notDeclaredTerminal = requireClassifier({});

    expect(classifiedAsFailure('rate_limited')).toBe('failure');
    expect(notDeclaredTerminal('rate_limited')).toBe('incomplete');
  });

  it.each([
    {
      name: '非法 key/value',
      policies: [{ '': 'success' }, { succeeded: 'incomplete' }, { succeeded: 'unknown' }],
    },
    {
      name: '非普通映射对象',
      policies: [new Date(0), new Map([['succeeded', 'success']])],
    },
    {
      name: '数组',
      policies: [['success']],
    },
  ])('拒绝$name终态策略且不创建部分 classifier', ({ policies }) => {
    for (const policy of policies) {
      const result = createAiUsageOutcomeClassifier(
        policy as unknown as AiUsageTerminalStatusPolicy,
      );

      expect(result).toEqual({
        ok: false,
        code: 'invalid_terminal_status_policy',
      });
    }
  });

  it('不修改策略输入，并在创建 classifier 时复制受控映射', () => {
    const policy: Record<string, AiUsageTerminalOutcome> = {
      succeeded: 'success',
    };
    const before = structuredClone(policy);
    const classifier = requireClassifier(policy);

    expect(policy).toEqual(before);

    policy.succeeded = 'failure';
    expect(classifier('succeeded')).toBe('success');
  });
});
