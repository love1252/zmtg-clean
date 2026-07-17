export const aiUsageOutcomes = [
  'success',
  'failure',
  'rejection',
  'incomplete',
] as const;

export const aiUsageTerminalOutcomes = [
  'success',
  'failure',
  'rejection',
] as const;

export type AiUsageOutcome = (typeof aiUsageOutcomes)[number];
export type AiUsageTerminalOutcome = (typeof aiUsageTerminalOutcomes)[number];

export type AiUsageTerminalStatusPolicy = Readonly<
  Partial<Record<string, AiUsageTerminalOutcome>>
>;

export type AiUsageOutcomeClassifier = (
  status: string | null | undefined,
) => AiUsageOutcome;

export type AiUsageOutcomeClassifierResult =
  | Readonly<{
      ok: true;
      classify: AiUsageOutcomeClassifier;
    }>
  | Readonly<{
      ok: false;
      code: 'invalid_terminal_status_policy';
    }>;

function isTerminalOutcome(value: unknown): value is AiUsageTerminalOutcome {
  return value === 'success' || value === 'failure' || value === 'rejection';
}

function isValidStatusCode(status: string): boolean {
  return status.length > 0 && status.trim() === status;
}

export function createAiUsageOutcomeClassifier(
  policy: AiUsageTerminalStatusPolicy,
): AiUsageOutcomeClassifierResult {
  if (policy === null || typeof policy !== 'object' || Array.isArray(policy)) {
    return { ok: false, code: 'invalid_terminal_status_policy' };
  }

  const policyPrototype = Object.getPrototypeOf(policy);
  if (policyPrototype !== Object.prototype && policyPrototype !== null) {
    return { ok: false, code: 'invalid_terminal_status_policy' };
  }

  const outcomeByStatus = new Map<string, AiUsageTerminalOutcome>();

  for (const [status, outcome] of Object.entries(policy)) {
    if (!isValidStatusCode(status) || !isTerminalOutcome(outcome)) {
      return { ok: false, code: 'invalid_terminal_status_policy' };
    }

    outcomeByStatus.set(status, outcome);
  }

  return {
    ok: true,
    classify(status) {
      if (typeof status !== 'string') {
        return 'incomplete';
      }

      return outcomeByStatus.get(status) ?? 'incomplete';
    },
  };
}
