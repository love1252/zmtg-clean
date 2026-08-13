import {
  createAttributedTenantAuditEventV1,
  createAuditEvent,
  type AttributedTenantAuditEventV1,
  type AuditReason,
  type TenantAuditEvent,
} from '@/modules/audit/domain/audit-events';
import {
  createAuditEventRepository,
  type AuditEventRepository,
} from '@/modules/audit/server/audit-event-repository';
import {
  createHisConnectionRepository,
  type HisConnectionHealthErrorCode,
  type HisConnectionHealthSummaryWriteResult,
  type HisConnectionReadModel,
  type HisConnectionRepository,
} from '@/modules/institution/server/his-connection-repository';
import {
  createHisConnectionWriter,
  type HisConnectionWriter,
} from '@/server/orchestration/his-connection-writer';
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

export type HisConnectionTestConnectionRepository =
  Pick<HisConnectionRepository, 'getHisConnectionByTenant'> &
  Pick<HisConnectionWriter, 'writeHisConnectionHealthSummaryForTenant'>;

type HisConnectionTestConnectionAuditRepository = Pick<AuditEventRepository, 'recordAttributed'>;

type HisConnectionTestConnectionServiceDependencies = {
  database: TenantDatabase;
  hisConnectionRepository?: HisConnectionTestConnectionRepository;
  hisConnectionRepositoryFactory?: (database: TenantDatabase) => HisConnectionTestConnectionRepository;
  hisConnectionWriterFactory?: (
    database: TenantDatabase,
  ) => Pick<HisConnectionWriter, 'writeHisConnectionHealthSummaryForTenant'>;
  auditEventRepository?: HisConnectionTestConnectionAuditRepository;
  auditEventRepositoryFactory?: (database: TenantDatabase) => HisConnectionTestConnectionAuditRepository;
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

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

function createNotApplicableAuditEvent(event: TenantAuditEvent): AttributedTenantAuditEventV1 {
  const attributedEvent = createAttributedTenantAuditEventV1({
    event,
    attribution: {
      institutionAttribution: 'not_applicable',
      tenantId: event.tenantId,
      institutionId: null,
    },
  });
  if (!attributedEvent) throw new Error('invalid_his_connection_test_audit_attribution');
  return attributedEvent;
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

function getRepositories(
  input: HisConnectionTestConnectionServiceDependencies,
) {
  const injected =
    input.hisConnectionRepository ??
    input.hisConnectionRepositoryFactory?.(input.database);

  return {
    reader: injected ?? createHisConnectionRepository(input.database),
    writer:
      injected ??
      (input.hisConnectionWriterFactory ?? createHisConnectionWriter)(
        input.database,
      ),
  };
}

function getAuditRepository(
  input: HisConnectionTestConnectionServiceDependencies,
): HisConnectionTestConnectionAuditRepository {
  return (
    input.auditEventRepository ??
    (input.auditEventRepositoryFactory ?? createAuditEventRepository)(input.database)
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

function mapProviderResultAuditReason(
  result: FakeHisConnectionTestProviderResult,
): AuditReason {
  if (result.ok) {
    return 'test_connection_provider_healthy';
  }

  switch (result.errorCode) {
    case 'missing_credential':
      return 'test_connection_missing_credential';
    case 'unsupported_vendor':
      return 'test_connection_unsupported_vendor';
    case 'limited_health_probe':
      return 'test_connection_limited_health_probe';
    case 'external_unreachable':
      return 'test_connection_external_unreachable';
    case 'provider_timeout':
      return 'test_connection_provider_timeout';
    case 'validation_failed':
      return 'provider_validation_failed';
    case 'connection_not_active':
      return 'test_connection_connection_not_active';
    default:
      return 'provider_health_failed';
  }
}

async function recordTestConnectionAudit(input: {
  auditRepository: HisConnectionTestConnectionAuditRepository;
  accessContext: AccessContext;
  tenantId: string;
  actorUserId: string;
  connectionId: string;
  result: 'allowed' | 'denied';
  reason: AuditReason;
}) {
  await input.auditRepository.recordAttributed(
    createNotApplicableAuditEvent(createAuditEvent({
      eventId: createAuditEventId(),
      context: {
        ...input.accessContext,
        tenantId: input.tenantId,
        userId: input.actorUserId,
      },
      resource: 'open_connection',
      resourceId: input.connectionId,
      action: 'test_connection',
      result: input.result,
      reason: input.reason,
      occurredAt: new Date().toISOString(),
    })),
  );
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
    const { reader: repository, writer } = getRepositories(input);
    const auditRepository = getAuditRepository(input);

    await recordTestConnectionAudit({
      auditRepository,
      accessContext: input.accessContext,
      tenantId,
      actorUserId,
      connectionId,
      result: 'allowed',
      reason: 'test_connection_requested',
    });

    const record = await repository.getHisConnectionByTenant({ tenantId, connectionId });

    if (!record || !isVisibleTenantRecord(record, tenantId)) {
      await recordTestConnectionAudit({
        auditRepository,
        accessContext: input.accessContext,
        tenantId,
        actorUserId,
        connectionId,
        result: 'denied',
        reason: 'not_found_or_not_owned',
      });

      return { status: 'not_found' };
    }

    if (record.status !== 'active') {
      await recordTestConnectionAudit({
        auditRepository,
        accessContext: input.accessContext,
        tenantId,
        actorUserId,
        connectionId,
        result: 'denied',
        reason: 'test_connection_connection_not_active',
      });

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
    await recordTestConnectionAudit({
      auditRepository,
      accessContext: input.accessContext,
      tenantId,
      actorUserId,
      connectionId,
      result: providerResult.ok ? 'allowed' : 'denied',
      reason: mapProviderResultAuditReason(providerResult),
    });

    if (!providerResult.ok && providerResult.errorCode === 'validation_failed') {
      return { status: 'validation_failed' };
    }

    const lastErrorCode = providerResult.ok
      ? null
      : (providerResult.errorCode as HisConnectionHealthErrorCode);

    let writeResult: HisConnectionHealthSummaryWriteResult;
    try {
      writeResult = await writer.writeHisConnectionHealthSummaryForTenant({
        tenantId,
        connectionId,
        healthStatus: providerResult.healthStatus,
        checkedAt: providerResult.checkedAt,
        lastErrorCode,
        actorUserId,
      });
    } catch {
      await recordTestConnectionAudit({
        auditRepository,
        accessContext: input.accessContext,
        tenantId,
        actorUserId,
        connectionId,
        result: 'denied',
        reason: 'repository_after_provider_failed',
      });

      return { status: 'service_unavailable' };
    }

    if (writeResult.status !== 'ok') {
      await recordTestConnectionAudit({
        auditRepository,
        accessContext: input.accessContext,
        tenantId,
        actorUserId,
        connectionId,
        result: 'denied',
        reason: 'repository_after_provider_failed',
      });

      return { status: 'service_unavailable' };
    }

    await recordTestConnectionAudit({
      auditRepository,
      accessContext: input.accessContext,
      tenantId,
      actorUserId,
      connectionId,
      result: 'allowed',
      reason: 'test_connection_completed',
    });

    return {
      status: 'tested',
      dto: mapProviderResultToDto(providerResult),
    };
  } catch {
    return { status: 'service_unavailable' };
  }
}
