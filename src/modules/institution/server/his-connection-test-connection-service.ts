import {
  createHisConnectionRepository,
  type HisConnectionHealthErrorCode,
  type HisConnectionReadModel,
  type HisConnectionRepository,
} from '@/modules/institution/server/his-connection-repository';
import {
  runFakeHisConnectionTestProvider,
  type FakeHisConnectionTestProviderInput,
  type FakeHisConnectionTestProviderResult,
} from '@/modules/institution/server/his-connection-test-connection-fake-provider';
import type { AccessContext } from '@/modules/security/domain/access-control';
import type { TenantDatabase } from '@/server/db/client';

export type HisConnectionTestConnectionDto =
  | {
      ok: true;
      healthStatus: Extract<HisConnectionReadModel['healthStatus'], 'healthy'>;
      checkedAt: string;
    }
  | {
      ok: false;
      code: HisConnectionHealthErrorCode | 'validation_failed';
      error: string;
      healthStatus: HisConnectionReadModel['healthStatus'];
      checkedAt?: string;
    };

export type HisConnectionTestConnectionServiceResult =
  | { status: 'tested'; dto: HisConnectionTestConnectionDto }
  | { status: 'connection_not_active'; dto: HisConnectionTestConnectionDto }
  | { status: 'validation_failed' }
  | { status: 'not_found' }
  | { status: 'service_unavailable' };

export type HisConnectionTestConnectionRepository = Pick<
  HisConnectionRepository,
  'getHisConnectionByTenant' | 'writeHisConnectionHealthSummaryForTenant'
>;

type HisConnectionTestConnectionServiceDependencies = {
  database: TenantDatabase;
  hisConnectionRepository?: HisConnectionTestConnectionRepository;
  hisConnectionRepositoryFactory?: (database: TenantDatabase) => HisConnectionTestConnectionRepository;
  fakeProvider?: (
    input: FakeHisConnectionTestProviderInput,
  ) => Promise<FakeHisConnectionTestProviderResult>;
};

type HisConnectionTestConnectionServiceInput =
  HisConnectionTestConnectionServiceDependencies & {
    accessContext: AccessContext;
    connectionId: string;
  };

function normalizeTrustedText(value: unknown) {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isVisibleTenantRecord(record: HisConnectionReadModel, tenantId: string) {
  return record.tenantId === tenantId && record.deletedAt === null && record.status !== 'deleted';
}

function createFailureDto(input: {
  code: HisConnectionHealthErrorCode | 'validation_failed';
  healthStatus: HisConnectionReadModel['healthStatus'];
  checkedAt?: Date;
  error?: string;
}): HisConnectionTestConnectionDto {
  return {
    ok: false,
    code: input.code,
    error: input.error ?? '连接测试未通过，请检查配置或稍后重试',
    healthStatus: input.healthStatus,
    ...(input.checkedAt ? { checkedAt: input.checkedAt.toISOString() } : {}),
  };
}

function mapProviderResultToDto(
  result: FakeHisConnectionTestProviderResult,
): HisConnectionTestConnectionDto {
  if (result.ok) {
    return {
      ok: true,
      healthStatus: result.healthStatus,
      checkedAt: result.checkedAt.toISOString(),
    };
  }

  return createFailureDto({
    code: result.errorCode,
    healthStatus: result.healthStatus,
    checkedAt: result.checkedAt,
  });
}

function getRepository(
  input: HisConnectionTestConnectionServiceDependencies,
): HisConnectionTestConnectionRepository {
  return (
    input.hisConnectionRepository ??
    (input.hisConnectionRepositoryFactory ?? createHisConnectionRepository)(input.database)
  );
}

function getFakeProvider(input: HisConnectionTestConnectionServiceDependencies) {
  return input.fakeProvider ?? runFakeHisConnectionTestProvider;
}

function createFakeProviderInput(
  tenantId: string,
  record: HisConnectionReadModel,
): FakeHisConnectionTestProviderInput {
  return {
    tenantId,
    connectionId: record.connectionId,
    sourceSystem: record.sourceSystem,
    vendorType: record.vendorType,
    systemType: record.systemType,
    credentialConfigured: record.credentialConfigured,
    mode: 'manual',
  };
}

export async function testHisConnectionForTenantService(
  input: HisConnectionTestConnectionServiceInput,
): Promise<HisConnectionTestConnectionServiceResult> {
  const tenantId = normalizeTrustedText(input.accessContext.tenantId);
  const actorUserId = normalizeTrustedText(input.accessContext.userId);
  const connectionId = normalizeTrustedText(input.connectionId);

  if (!tenantId || !actorUserId || !connectionId) {
    return { status: 'validation_failed' };
  }

  try {
    const repository = getRepository(input);
    const record = await repository.getHisConnectionByTenant({ tenantId, connectionId });

    if (!record || !isVisibleTenantRecord(record, tenantId)) {
      return { status: 'not_found' };
    }

    if (record.status !== 'active') {
      return {
        status: 'connection_not_active',
        dto: createFailureDto({
          code: 'connection_not_active',
          healthStatus: record.healthStatus,
          error: '当前连接状态不允许测试',
        }),
      };
    }

    const providerResult = await getFakeProvider(input)(createFakeProviderInput(tenantId, record));

    if (!providerResult.ok && providerResult.errorCode === 'validation_failed') {
      return { status: 'validation_failed' };
    }

    const lastErrorCode = providerResult.ok
      ? null
      : (providerResult.errorCode as HisConnectionHealthErrorCode);

    const writeResult = await repository.writeHisConnectionHealthSummaryForTenant({
      tenantId,
      connectionId,
      healthStatus: providerResult.healthStatus,
      checkedAt: providerResult.checkedAt,
      lastErrorCode,
      actorUserId,
    });

    if (writeResult.status !== 'ok') {
      return { status: 'service_unavailable' };
    }

    return {
      status: 'tested',
      dto: mapProviderResultToDto(providerResult),
    };
  } catch {
    return { status: 'service_unavailable' };
  }
}
