export const ANALYTICS_AI_CALL_USAGE_STATUSES = [
  'succeeded',
  'failed',
  'sensitive_input_rejected',
  'rate_limited',
  'provider_unavailable',
  'rejected',
] as const;

export type AnalyticsAiCallUsageStatus =
  (typeof ANALYTICS_AI_CALL_USAGE_STATUSES)[number];

export const ANALYTICS_AI_CREDIT_METERING_STATUSES = [
  'metered',
  'not_billable',
  'pending',
  'legacy',
] as const;

export type AnalyticsAiCreditMeteringStatus =
  (typeof ANALYTICS_AI_CREDIT_METERING_STATUSES)[number];

export type TenantAiCallUsageScope = Readonly<{
  kind: 'tenant';
  tenantId: string;
}>;

export type InstitutionAiCallUsageScope = Readonly<{
  kind: 'institution';
  tenantId: string;
  institutionId: string;
}>;

export type AiCallUsageScope =
  | TenantAiCallUsageScope
  | InstitutionAiCallUsageScope;

export type AnalyticsJsonValue =
  | string
  | number
  | boolean
  | null
  | AnalyticsJsonValue[]
  | { [key: string]: AnalyticsJsonValue };

export type AnalyticsJsonObject = {
  [key: string]: AnalyticsJsonValue;
};

export type AppendAiCallUsageCommand = Readonly<{
  scope: AiCallUsageScope;
  id: string;
  actorUserId: string;
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  status: AnalyticsAiCallUsageStatus;
  errorCode: string | null;
  aiCreditsConsumed: number | null;
  meteringStatus: AnalyticsAiCreditMeteringStatus | null;
  meteringVersion: string | null;
  meteringDetails: AnalyticsJsonObject | null;
  serviceCategory?: string | null;
  serviceName?: string | null;
  serviceSource?: string | null;
  serviceAction?: string | null;
  serviceVersion?: string | null;
  metadata?: AnalyticsJsonObject | null;
}>;

export type NormalizedAiCallUsageAppend = Readonly<{
  scope: AiCallUsageScope;
  id: string;
  actorUserId: string;
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  status: AnalyticsAiCallUsageStatus;
  errorCode: string | null;
  aiCreditsConsumed: number | null;
  meteringStatus: AnalyticsAiCreditMeteringStatus | null;
  meteringVersion: string | null;
  meteringDetails: AnalyticsJsonObject | null;
  serviceCategory: string | null;
  serviceName: string | null;
  serviceSource: string | null;
  serviceAction: string | null;
  serviceVersion: string | null;
  metadata: AnalyticsJsonObject | null;
}>;

export type AnalyticsAiCallUsageRecord = Readonly<{
  id: string;
  tenantId: string;
  institutionId: string | null;
  actorUserId: string;
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  status: AnalyticsAiCallUsageStatus;
  errorCode: string | null;
  aiCreditsConsumed: number | null;
  meteringStatus: AnalyticsAiCreditMeteringStatus | null;
  meteringVersion: string | null;
  meteringDetails: unknown | null;
  serviceCategory: string | null;
  serviceName: string | null;
  serviceSource: string | null;
  serviceAction: string | null;
  serviceVersion: string | null;
  metadata: unknown | null;
  createdAt: Date;
}>;

export interface AiCallUsageCommandRepository {
  append(input: NormalizedAiCallUsageAppend): Promise<AnalyticsAiCallUsageRecord>;
}

export class AiCallUsageCommandInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiCallUsageCommandInputError';
  }
}

function requireExactString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new AiCallUsageCommandInputError(`invalid_${field}`);
  }
  return value;
}

function optionalExactString(value: unknown, field: string) {
  if (value === null || value === undefined) return null;
  return requireExactString(value, field);
}

function optionalNonNegativeInteger(value: unknown, field: string) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new AiCallUsageCommandInputError(`invalid_${field}`);
  }
  return value;
}

function normalizeScope(scope: AiCallUsageScope): AiCallUsageScope {
  if (!scope || typeof scope !== 'object') {
    throw new AiCallUsageCommandInputError('invalid_scope');
  }
  if (scope.kind === 'tenant') {
    return { kind: 'tenant', tenantId: requireExactString(scope.tenantId, 'tenant_id') };
  }
  if (scope.kind === 'institution') {
    return {
      kind: 'institution',
      tenantId: requireExactString(scope.tenantId, 'tenant_id'),
      institutionId: requireExactString(scope.institutionId, 'institution_id'),
    };
  }
  throw new AiCallUsageCommandInputError('invalid_scope');
}

function requireStatus(value: unknown): AnalyticsAiCallUsageStatus {
  if (
    typeof value !== 'string' ||
    !ANALYTICS_AI_CALL_USAGE_STATUSES.includes(value as AnalyticsAiCallUsageStatus)
  ) {
    throw new AiCallUsageCommandInputError('invalid_status');
  }
  return value as AnalyticsAiCallUsageStatus;
}

function optionalMeteringStatus(value: unknown): AnalyticsAiCreditMeteringStatus | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== 'string' ||
    !ANALYTICS_AI_CREDIT_METERING_STATUSES.includes(
      value as AnalyticsAiCreditMeteringStatus,
    )
  ) {
    throw new AiCallUsageCommandInputError('invalid_metering_status');
  }
  return value as AnalyticsAiCreditMeteringStatus;
}

export function createAiCallUsageCommandService(
  repository: AiCallUsageCommandRepository,
) {
  return Object.freeze({
    async appendUsage(
      input: AppendAiCallUsageCommand,
    ): Promise<AnalyticsAiCallUsageRecord> {
      return repository.append({
        scope: normalizeScope(input.scope),
        id: requireExactString(input.id, 'id'),
        actorUserId: requireExactString(input.actorUserId, 'actor_user_id'),
        provider: requireExactString(input.provider, 'provider'),
        model: requireExactString(input.model, 'model'),
        promptTokens: optionalNonNegativeInteger(input.promptTokens, 'prompt_tokens'),
        completionTokens: optionalNonNegativeInteger(
          input.completionTokens,
          'completion_tokens',
        ),
        totalTokens: optionalNonNegativeInteger(input.totalTokens, 'total_tokens'),
        latencyMs: optionalNonNegativeInteger(input.latencyMs, 'latency_ms'),
        status: requireStatus(input.status),
        errorCode: optionalExactString(input.errorCode, 'error_code'),
        aiCreditsConsumed: optionalNonNegativeInteger(
          input.aiCreditsConsumed,
          'ai_credits_consumed',
        ),
        meteringStatus: optionalMeteringStatus(input.meteringStatus),
        meteringVersion: optionalExactString(input.meteringVersion, 'metering_version'),
        meteringDetails: input.meteringDetails ?? null,
        serviceCategory: optionalExactString(input.serviceCategory, 'service_category'),
        serviceName: optionalExactString(input.serviceName, 'service_name'),
        serviceSource: optionalExactString(input.serviceSource, 'service_source'),
        serviceAction: optionalExactString(input.serviceAction, 'service_action'),
        serviceVersion: optionalExactString(input.serviceVersion, 'service_version'),
        metadata: input.metadata ?? null,
      });
    },
  });
}
