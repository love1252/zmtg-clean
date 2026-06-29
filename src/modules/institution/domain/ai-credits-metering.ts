export type AiCreditMeteringUsageStatus =
  | 'succeeded'
  | 'failed'
  | 'rejected'
  | 'sensitive_input_rejected'
  | 'rate_limited'
  | 'provider_unavailable';

export type AiCreditMeteringStatus = 'metered' | 'not_billable' | 'pending' | 'legacy';

export type AiCreditMeteringReason =
  | 'succeeded_metered'
  | 'non_succeeded_not_billable'
  | 'sensitive_input_rejected_not_billable'
  | 'quota_exceeded_ai_calls_not_billable'
  | 'missing_metering_rule'
  | 'disabled_metering_rule'
  | 'invalid_metering_rule'
  | 'insufficient_token_usage'
  | 'legacy_record';

export type AiCreditMeteringRuleInput = {
  enabled: boolean;
  meteringVersion: string;
  inputTokenWeight: number;
  outputTokenWeight: number;
  modelMultiplier: number;
  creditsPerStandardTokenUnit: number;
  ragCreditSurcharge: number;
  formulaVersion?: string;
};

export type AiCreditMeteringUsageInput = {
  status: AiCreditMeteringUsageStatus;
  errorCode?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  legacyMetering?: boolean;
};

export type AiCreditMeteringDetails = {
  meteringVersion: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  inputTokenWeight: number | null;
  outputTokenWeight: number | null;
  modelMultiplier: number | null;
  creditsPerStandardTokenUnit: number | null;
  ragCreditSurcharge: number | null;
  weightedStandardTokens: number | null;
  formulaVersion: string;
  billable: boolean;
  reason: AiCreditMeteringReason;
  usageStatus: AiCreditMeteringUsageStatus;
};

export type AiCreditMeteringResult = {
  aiCreditsConsumed: number | null;
  meteringStatus: AiCreditMeteringStatus;
  meteringVersion: string | null;
  meteringDetails: AiCreditMeteringDetails;
};

const DEFAULT_FORMULA_VERSION = 'ai-credits-v0.6-domain-03';

function isNonNegativeInteger(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function normalizeTotalTokens(inputTokens: number, outputTokens: number, totalTokens: number | null | undefined) {
  if (isNonNegativeInteger(totalTokens) && totalTokens >= inputTokens + outputTokens) {
    return totalTokens;
  }

  return inputTokens + outputTokens;
}

function isValidMeteringRule(rule: AiCreditMeteringRuleInput): boolean {
  return isPositiveFinite(rule.inputTokenWeight)
    && isPositiveFinite(rule.outputTokenWeight)
    && isPositiveFinite(rule.modelMultiplier)
    && isPositiveFinite(rule.creditsPerStandardTokenUnit)
    && isNonNegativeInteger(rule.ragCreditSurcharge);
}

function createDetails(input: {
  usage: AiCreditMeteringUsageInput;
  rule: AiCreditMeteringRuleInput | null;
  billable: boolean;
  reason: AiCreditMeteringReason;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  weightedStandardTokens: number | null;
}): AiCreditMeteringDetails {
  const formulaVersion = input.rule?.formulaVersion ?? DEFAULT_FORMULA_VERSION;

  return {
    meteringVersion: input.rule?.meteringVersion ?? null,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens: input.totalTokens,
    inputTokenWeight: input.rule?.inputTokenWeight ?? null,
    outputTokenWeight: input.rule?.outputTokenWeight ?? null,
    modelMultiplier: input.rule?.modelMultiplier ?? null,
    creditsPerStandardTokenUnit: input.rule?.creditsPerStandardTokenUnit ?? null,
    ragCreditSurcharge: input.rule?.ragCreditSurcharge ?? null,
    weightedStandardTokens: input.weightedStandardTokens,
    formulaVersion,
    billable: input.billable,
    reason: input.reason,
    usageStatus: input.usage.status,
  };
}

function getNotBillableReason(usage: AiCreditMeteringUsageInput): AiCreditMeteringReason {
  if (usage.status === 'sensitive_input_rejected') {
    return 'sensitive_input_rejected_not_billable';
  }

  if (usage.status === 'rejected' && usage.errorCode === 'quota_exceeded_ai_calls') {
    return 'quota_exceeded_ai_calls_not_billable';
  }

  return 'non_succeeded_not_billable';
}

export function calculateAiCreditMetering(input: {
  rule?: AiCreditMeteringRuleInput | null;
  usage: AiCreditMeteringUsageInput;
}): AiCreditMeteringResult {
  const rule = input.rule ?? null;

  if (input.usage.legacyMetering) {
    return {
      aiCreditsConsumed: null,
      meteringStatus: 'legacy',
      meteringVersion: rule?.meteringVersion ?? null,
      meteringDetails: createDetails({
        usage: input.usage,
        rule,
        billable: false,
        reason: 'legacy_record',
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        weightedStandardTokens: null,
      }),
    };
  }

  if (input.usage.status !== 'succeeded') {
    const reason = getNotBillableReason(input.usage);

    return {
      aiCreditsConsumed: 0,
      meteringStatus: 'not_billable',
      meteringVersion: rule?.meteringVersion ?? null,
      meteringDetails: createDetails({
        usage: input.usage,
        rule,
        billable: false,
        reason,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        weightedStandardTokens: null,
      }),
    };
  }

  if (!rule) {
    return {
      aiCreditsConsumed: null,
      meteringStatus: 'pending',
      meteringVersion: null,
      meteringDetails: createDetails({
        usage: input.usage,
        rule: null,
        billable: false,
        reason: 'missing_metering_rule',
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        weightedStandardTokens: null,
      }),
    };
  }

  if (!rule.enabled) {
    return {
      aiCreditsConsumed: null,
      meteringStatus: 'pending',
      meteringVersion: rule.meteringVersion,
      meteringDetails: createDetails({
        usage: input.usage,
        rule,
        billable: false,
        reason: 'disabled_metering_rule',
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        weightedStandardTokens: null,
      }),
    };
  }

  if (!isValidMeteringRule(rule)) {
    return {
      aiCreditsConsumed: null,
      meteringStatus: 'pending',
      meteringVersion: rule.meteringVersion,
      meteringDetails: createDetails({
        usage: input.usage,
        rule,
        billable: false,
        reason: 'invalid_metering_rule',
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        weightedStandardTokens: null,
      }),
    };
  }

  if (!isNonNegativeInteger(input.usage.inputTokens)
    || !isNonNegativeInteger(input.usage.outputTokens)
    || input.usage.inputTokens + input.usage.outputTokens <= 0) {
    return {
      aiCreditsConsumed: null,
      meteringStatus: 'pending',
      meteringVersion: rule.meteringVersion,
      meteringDetails: createDetails({
        usage: input.usage,
        rule,
        billable: false,
        reason: 'insufficient_token_usage',
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        weightedStandardTokens: null,
      }),
    };
  }

  const inputTokens = input.usage.inputTokens;
  const outputTokens = input.usage.outputTokens;
  const totalTokens = normalizeTotalTokens(inputTokens, outputTokens, input.usage.totalTokens);
  const weightedStandardTokens = (
    inputTokens * rule.inputTokenWeight
    + outputTokens * rule.outputTokenWeight
  ) * rule.modelMultiplier;
  const tokenCredits = Math.ceil(weightedStandardTokens / rule.creditsPerStandardTokenUnit);
  const aiCreditsConsumed = tokenCredits + rule.ragCreditSurcharge;

  return {
    aiCreditsConsumed,
    meteringStatus: 'metered',
    meteringVersion: rule.meteringVersion,
    meteringDetails: createDetails({
      usage: input.usage,
      rule,
      billable: true,
      reason: 'succeeded_metered',
      inputTokens,
      outputTokens,
      totalTokens,
      weightedStandardTokens,
    }),
  };
}
