import type {
  HisConnectionHealthErrorCode,
  HisConnectionReadModel,
} from '@/modules/institution/server/his-connection-repository';

type FakeProviderHealthStatus = Extract<
  HisConnectionReadModel['healthStatus'],
  'healthy' | 'degraded' | 'failed'
>;

export type FakeHisConnectionTestProviderInput = {
  tenantId: string;
  connectionId: string;
  sourceSystem: string;
  vendorType: string;
  systemType: string;
  credentialConfigured: boolean;
  mode: 'manual';
};

export type FakeHisConnectionTestProviderCode =
  | 'fake_success'
  | 'fake_missing_credential'
  | 'fake_unsupported_vendor'
  | 'fake_degraded'
  | 'fake_failed'
  | 'fake_timeout'
  | 'fake_validation_failed';

export type FakeHisConnectionTestProviderErrorCode =
  | HisConnectionHealthErrorCode
  | 'validation_failed';

export type FakeHisConnectionTestProviderResult =
  | {
      ok: true;
      providerCode: 'fake_success';
      healthStatus: Extract<FakeProviderHealthStatus, 'healthy'>;
      errorCode: null;
      checkedAt: Date;
    }
  | {
      ok: false;
      providerCode: Exclude<FakeHisConnectionTestProviderCode, 'fake_success'>;
      healthStatus: Extract<FakeProviderHealthStatus, 'degraded' | 'failed'>;
      errorCode: FakeHisConnectionTestProviderErrorCode;
      checkedAt: Date;
    };

export type FakeHisConnectionTestProviderOptions = {
  nowProvider?: () => Date;
};

const textFieldLimits = {
  tenantId: 64,
  connectionId: 64,
  sourceSystem: 64,
  vendorType: 64,
  systemType: 64,
} as const;

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) return null;

  return normalized;
}

function createResult(input: {
  ok: boolean;
  providerCode: FakeHisConnectionTestProviderCode;
  healthStatus: FakeProviderHealthStatus;
  errorCode: FakeHisConnectionTestProviderErrorCode | null;
  checkedAt: Date;
}): FakeHisConnectionTestProviderResult {
  if (input.ok) {
    return {
      ok: true,
      providerCode: 'fake_success',
      healthStatus: 'healthy',
      errorCode: null,
      checkedAt: input.checkedAt,
    };
  }

  return {
    ok: false,
    providerCode: input.providerCode as Exclude<
      FakeHisConnectionTestProviderCode,
      'fake_success'
    >,
    healthStatus: input.healthStatus as Extract<
      FakeProviderHealthStatus,
      'degraded' | 'failed'
    >,
    errorCode: input.errorCode ?? 'validation_failed',
    checkedAt: input.checkedAt,
  };
}

export async function runFakeHisConnectionTestProvider(
  input: FakeHisConnectionTestProviderInput,
  options: FakeHisConnectionTestProviderOptions = {},
): Promise<FakeHisConnectionTestProviderResult> {
  const checkedAt = options.nowProvider?.() ?? new Date();
  const tenantId = normalizeText(input.tenantId, textFieldLimits.tenantId);
  const connectionId = normalizeText(input.connectionId, textFieldLimits.connectionId);
  const sourceSystem = normalizeText(input.sourceSystem, textFieldLimits.sourceSystem);
  const vendorType = normalizeText(input.vendorType, textFieldLimits.vendorType);
  const systemType = normalizeText(input.systemType, textFieldLimits.systemType);

  if (
    !tenantId ||
    !connectionId ||
    !sourceSystem ||
    !vendorType ||
    !systemType ||
    typeof input.credentialConfigured !== 'boolean' ||
    input.mode !== 'manual'
  ) {
    return createResult({
      ok: false,
      providerCode: 'fake_validation_failed',
      healthStatus: 'failed',
      errorCode: 'validation_failed',
      checkedAt,
    });
  }

  if (!input.credentialConfigured) {
    return createResult({
      ok: false,
      providerCode: 'fake_missing_credential',
      healthStatus: 'failed',
      errorCode: 'missing_credential',
      checkedAt,
    });
  }

  if (sourceSystem !== 'his' || systemType !== 'his') {
    return createResult({
      ok: false,
      providerCode: 'fake_unsupported_vendor',
      healthStatus: 'failed',
      errorCode: 'unsupported_vendor',
      checkedAt,
    });
  }

  if (vendorType === 'demo_vendor') {
    return createResult({
      ok: true,
      providerCode: 'fake_success',
      healthStatus: 'healthy',
      errorCode: null,
      checkedAt,
    });
  }

  if (vendorType === 'demo_vendor_degraded') {
    return createResult({
      ok: false,
      providerCode: 'fake_degraded',
      healthStatus: 'degraded',
      errorCode: 'limited_health_probe',
      checkedAt,
    });
  }

  if (vendorType === 'demo_vendor_failed') {
    return createResult({
      ok: false,
      providerCode: 'fake_failed',
      healthStatus: 'failed',
      errorCode: 'external_unreachable',
      checkedAt,
    });
  }

  if (vendorType === 'demo_vendor_timeout') {
    return createResult({
      ok: false,
      providerCode: 'fake_timeout',
      healthStatus: 'failed',
      errorCode: 'provider_timeout',
      checkedAt,
    });
  }

  return createResult({
    ok: false,
    providerCode: 'fake_unsupported_vendor',
    healthStatus: 'failed',
    errorCode: 'unsupported_vendor',
    checkedAt,
  });
}
