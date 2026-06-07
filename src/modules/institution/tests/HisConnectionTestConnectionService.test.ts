import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type {
  HisConnectionHealthSummaryWriteResult,
  HisConnectionReadModel,
} from '@/modules/institution/server/his-connection-repository';
import {
  runFakeHisConnectionTestProvider,
  type FakeHisConnectionTestProviderInput,
  type FakeHisConnectionTestProviderResult,
} from '@/modules/institution/server/his-connection-test-connection-fake-provider';
import {
  testHisConnectionForTenantService,
  type HisConnectionTestConnectionRepository,
} from '@/modules/institution/server/his-connection-test-connection-service';
import type { AccessContext } from '@/modules/security/domain/access-control';
import type { TenantDatabase } from '@/server/db/client';

const fixedCheckedAt = new Date('2026-06-07T09:30:00.000Z');

const accessContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const activeConnection = {
  connectionId: 'his_conn_001',
  tenantId: 'demo-tenant-001',
  connectionName: '星澜 HIS 连接',
  sourceSystem: 'his',
  vendorType: 'demo_vendor',
  systemType: 'his',
  status: 'active',
  credentialConfigured: true,
  healthStatus: 'unknown',
  lastCheckedAt: null,
  lastErrorCode: null,
  createdAt: '2026-06-07T08:00:00.000Z',
  updatedAt: '2026-06-07T08:10:00.000Z',
  revokedAt: null,
  deletedAt: null,
} satisfies HisConnectionReadModel;

type ServiceHarnessInput = {
  record?: HisConnectionReadModel | null;
  writeResult?: HisConnectionHealthSummaryWriteResult;
  getError?: unknown;
  writeError?: unknown;
  auditError?: unknown;
  provider?: (
    input: FakeHisConnectionTestProviderInput,
  ) => Promise<FakeHisConnectionTestProviderResult>;
};

function createServiceHarness(input: ServiceHarnessInput = {}) {
  const database = { kind: 'database' } as unknown as TenantDatabase;
  const auditEventRepository = {
    record: vi.fn(async (_event: TenantAuditEvent) => {
      if (input.auditError) throw input.auditError;
    }),
  };
  const auditEventRepositoryFactory = vi.fn(() => auditEventRepository);
  const defaultWriteResult: HisConnectionHealthSummaryWriteResult = {
    status: 'ok',
    record: activeConnection,
  };
  const repository = {
    getHisConnectionByTenant: vi.fn(async (): Promise<HisConnectionReadModel | null> => {
      if (input.getError) throw input.getError;
      return input.record === undefined ? activeConnection : input.record;
    }),
    writeHisConnectionHealthSummaryForTenant: vi.fn(
      async (): Promise<HisConnectionHealthSummaryWriteResult> => {
      if (input.writeError) throw input.writeError;
      return input.writeResult ?? defaultWriteResult;
    }),
  } satisfies HisConnectionTestConnectionRepository;
  const hisConnectionRepositoryFactory = vi.fn(() => repository);
  const fakeProvider = vi.fn(input.provider ?? ((providerInput: FakeHisConnectionTestProviderInput) =>
    runFakeHisConnectionTestProvider(providerInput, {
      nowProvider: () => fixedCheckedAt,
    })));

  return {
    auditEventRepository,
    auditEventRepositoryFactory,
    database,
    fakeProvider,
    hisConnectionRepositoryFactory,
    repository,
  };
}

function expectSafeTestConnectionPayload(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /tenantId|credentialRef|credential_ref|cred_ref_|token|secret|apiKey|api_key|endpoint|headers|rawPayload|raw_payload|rawHisPayload|providerRawError|externalResponseBody|DATABASE_URL|postgres:\/\/|select \* from|SQL|stack/i,
  );
}

function expectNoSensitiveAuditData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /requestBody|body|credentialRef|credential_ref|cred_ref_|token|secret|apiKey|api_key|endpoint|headers|rawPayload|raw_payload|rawHisPayload|providerRawError|externalResponseBody|DATABASE_URL|postgres:\/\/|select \* from|SQL|stack/i,
  );
}

function expectTestConnectionAuditEvent(
  event: unknown,
  input: {
    result: TenantAuditEvent['result'];
    reason: TenantAuditEvent['reason'];
    connectionId?: string;
  },
) {
  expect(event).toMatchObject({
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    tenantId: 'demo-tenant-001',
    scope: 'tenant',
    resource: 'open_connection',
    action: 'test_connection',
    result: input.result,
    reason: input.reason,
    source: 'demo_session',
  });
  if (input.connectionId !== undefined) {
    expect(event).toMatchObject({ resourceId: input.connectionId });
  }
  expect((event as TenantAuditEvent).eventId).toEqual(expect.any(String));
  expect(Number.isFinite(Date.parse((event as TenantAuditEvent).occurredAt))).toBe(true);
  expectNoSensitiveAuditData(event);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('HIS 测试连接 fake provider service', () => {
  it('fake success 返回 healthy，且不读取环境变量、网络或真实凭证', async () => {
    process.env.HIS_TEST_CONNECTION_SCENARIO = 'fake_timeout_should_not_be_used';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    const result = await runFakeHisConnectionTestProvider(
      {
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        sourceSystem: 'his',
        vendorType: 'demo_vendor',
        systemType: 'his',
        credentialConfigured: true,
        mode: 'manual',
        scenario: 'fake_timeout_from_frontend',
        credentialRef: 'cred_ref_should_not_be_used',
        endpoint: 'https://external.example.test',
      } as never,
      { nowProvider: () => fixedCheckedAt },
    );

    expect(result).toEqual({
      ok: true,
      providerCode: 'fake_success',
      healthStatus: 'healthy',
      errorCode: null,
      checkedAt: fixedCheckedAt,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expectSafeTestConnectionPayload(result);

    delete process.env.HIS_TEST_CONNECTION_SCENARIO;
  });

  it('fake provider 支持 missing credential、unsupported、degraded、failed、timeout 和 invalid input', async () => {
    const baseInput = {
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      sourceSystem: 'his',
      vendorType: 'demo_vendor',
      systemType: 'his',
      credentialConfigured: true,
      mode: 'manual',
    } as const;

    await expect(
      runFakeHisConnectionTestProvider(
        { ...baseInput, credentialConfigured: false },
        { nowProvider: () => fixedCheckedAt },
      ),
    ).resolves.toMatchObject({
      ok: false,
      providerCode: 'fake_missing_credential',
      healthStatus: 'failed',
      errorCode: 'missing_credential',
    });
    await expect(
      runFakeHisConnectionTestProvider(
        { ...baseInput, vendorType: 'unknown_vendor' },
        { nowProvider: () => fixedCheckedAt },
      ),
    ).resolves.toMatchObject({
      ok: false,
      providerCode: 'fake_unsupported_vendor',
      healthStatus: 'failed',
      errorCode: 'unsupported_vendor',
    });
    await expect(
      runFakeHisConnectionTestProvider(
        { ...baseInput, vendorType: 'demo_vendor_degraded' },
        { nowProvider: () => fixedCheckedAt },
      ),
    ).resolves.toMatchObject({
      ok: false,
      providerCode: 'fake_degraded',
      healthStatus: 'degraded',
      errorCode: 'limited_health_probe',
    });
    await expect(
      runFakeHisConnectionTestProvider(
        { ...baseInput, vendorType: 'demo_vendor_failed' },
        { nowProvider: () => fixedCheckedAt },
      ),
    ).resolves.toMatchObject({
      ok: false,
      providerCode: 'fake_failed',
      healthStatus: 'failed',
      errorCode: 'external_unreachable',
    });
    await expect(
      runFakeHisConnectionTestProvider(
        { ...baseInput, vendorType: 'demo_vendor_timeout' },
        { nowProvider: () => fixedCheckedAt },
      ),
    ).resolves.toMatchObject({
      ok: false,
      providerCode: 'fake_timeout',
      healthStatus: 'failed',
      errorCode: 'provider_timeout',
    });
    await expect(
      runFakeHisConnectionTestProvider(
        { ...baseInput, tenantId: '   ' },
        { nowProvider: () => fixedCheckedAt },
      ),
    ).resolves.toMatchObject({
      ok: false,
      providerCode: 'fake_validation_failed',
      healthStatus: 'failed',
      errorCode: 'validation_failed',
    });
  });
});

describe('HIS 测试连接 service 最小 runtime', () => {
  it('fake success 后写回 healthy，并返回安全 DTO', async () => {
    const harness = createServiceHarness();

    const result = await testHisConnectionForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      fakeProvider: harness.fakeProvider,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(result).toEqual({
      status: 'tested',
      dto: {
        ok: true,
        healthStatus: 'healthy',
        checkedAt: '2026-06-07T09:30:00.000Z',
      },
    });
    expect(harness.repository.getHisConnectionByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
    });
    expect(harness.fakeProvider).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      sourceSystem: 'his',
      vendorType: 'demo_vendor',
      systemType: 'his',
      credentialConfigured: true,
      mode: 'manual',
    });
    expect(harness.repository.writeHisConnectionHealthSummaryForTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      healthStatus: 'healthy',
      checkedAt: fixedCheckedAt,
      lastErrorCode: null,
      actorUserId: 'demo-user-admin',
    });
    expect(harness.auditEventRepository.record).toHaveBeenCalledTimes(3);
    expectTestConnectionAuditEvent(harness.auditEventRepository.record.mock.calls[0]?.[0], {
      result: 'allowed',
      reason: 'test_connection_requested',
      connectionId: 'his_conn_001',
    });
    expectTestConnectionAuditEvent(harness.auditEventRepository.record.mock.calls[1]?.[0], {
      result: 'allowed',
      reason: 'test_connection_provider_healthy',
      connectionId: 'his_conn_001',
    });
    expectTestConnectionAuditEvent(harness.auditEventRepository.record.mock.calls[2]?.[0], {
      result: 'allowed',
      reason: 'test_connection_completed',
      connectionId: 'his_conn_001',
    });
    if (result.status !== 'tested') {
      throw new Error('expected tested result');
    }
    expectSafeTestConnectionPayload(result.dto);
  });

  it('missing credential、unsupported、degraded 和 timeout 会写回对应健康摘要', async () => {
    const cases = [
      {
        record: { ...activeConnection, credentialConfigured: false },
        expectedStatus: 'failed',
        expectedCode: 'missing_credential',
      },
      {
        record: { ...activeConnection, vendorType: 'unknown_vendor' },
        expectedStatus: 'failed',
        expectedCode: 'unsupported_vendor',
      },
      {
        record: { ...activeConnection, vendorType: 'demo_vendor_degraded' },
        expectedStatus: 'degraded',
        expectedCode: 'limited_health_probe',
      },
      {
        record: { ...activeConnection, vendorType: 'demo_vendor_timeout' },
        expectedStatus: 'failed',
        expectedCode: 'provider_timeout',
      },
    ] as const;

    for (const routeCase of cases) {
      const harness = createServiceHarness({ record: routeCase.record });

      const result = await testHisConnectionForTenantService({
        accessContext,
        connectionId: routeCase.record.connectionId,
        database: harness.database,
        fakeProvider: harness.fakeProvider,
        hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
      });

      expect(result).toMatchObject({
        status: 'tested',
        dto: {
          ok: false,
          code: routeCase.expectedCode,
          healthStatus: routeCase.expectedStatus,
          checkedAt: '2026-06-07T09:30:00.000Z',
        },
      });
      expect(harness.repository.writeHisConnectionHealthSummaryForTenant).toHaveBeenCalledWith(
        expect.objectContaining({
          healthStatus: routeCase.expectedStatus,
          lastErrorCode: routeCase.expectedCode,
        }),
      );
      expect(harness.auditEventRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'test_connection',
          resourceId: routeCase.record.connectionId,
          result: 'denied',
          reason:
            routeCase.expectedCode === 'missing_credential'
              ? 'test_connection_missing_credential'
              : routeCase.expectedCode === 'unsupported_vendor'
                ? 'test_connection_unsupported_vendor'
                : routeCase.expectedCode === 'limited_health_probe'
                  ? 'test_connection_limited_health_probe'
                  : 'test_connection_provider_timeout',
        }),
      );
      expect(harness.auditEventRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'test_connection',
          resourceId: routeCase.record.connectionId,
          result: 'allowed',
          reason: 'test_connection_completed',
        }),
      );
      expectNoSensitiveAuditData(harness.auditEventRepository.record.mock.calls);
      expectSafeTestConnectionPayload(result);
    }
  });

  it('输入非法、连接不存在或跨租户时不调用 fake provider 或健康写回', async () => {
    const invalidHarness = createServiceHarness();
    const notFoundHarness = createServiceHarness({ record: null });
    const crossTenantHarness = createServiceHarness({
      record: { ...activeConnection, tenantId: 'other-tenant' },
    });

    await expect(
      testHisConnectionForTenantService({
        accessContext: { ...accessContext, tenantId: null },
        connectionId: 'his_conn_001',
        database: invalidHarness.database,
        fakeProvider: invalidHarness.fakeProvider,
        hisConnectionRepositoryFactory: invalidHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: invalidHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'validation_failed' });
    await expect(
      testHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_missing',
        database: notFoundHarness.database,
        fakeProvider: notFoundHarness.fakeProvider,
        hisConnectionRepositoryFactory: notFoundHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: notFoundHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'not_found' });
    await expect(
      testHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_other',
        database: crossTenantHarness.database,
        fakeProvider: crossTenantHarness.fakeProvider,
        hisConnectionRepositoryFactory: crossTenantHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: crossTenantHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'not_found' });

    expect(invalidHarness.repository.getHisConnectionByTenant).not.toHaveBeenCalled();
    expect(notFoundHarness.fakeProvider).not.toHaveBeenCalled();
    expect(crossTenantHarness.fakeProvider).not.toHaveBeenCalled();
    expect(notFoundHarness.repository.writeHisConnectionHealthSummaryForTenant).not.toHaveBeenCalled();
    expect(crossTenantHarness.repository.writeHisConnectionHealthSummaryForTenant).not.toHaveBeenCalled();
    expect(invalidHarness.auditEventRepository.record).not.toHaveBeenCalled();
    expect(notFoundHarness.auditEventRepository.record).toHaveBeenCalledTimes(2);
    expect(crossTenantHarness.auditEventRepository.record).toHaveBeenCalledTimes(2);
    expectTestConnectionAuditEvent(notFoundHarness.auditEventRepository.record.mock.calls[0]?.[0], {
      result: 'allowed',
      reason: 'test_connection_requested',
      connectionId: 'his_conn_missing',
    });
    expectTestConnectionAuditEvent(notFoundHarness.auditEventRepository.record.mock.calls[1]?.[0], {
      result: 'denied',
      reason: 'not_found_or_not_owned',
      connectionId: 'his_conn_missing',
    });
    expectTestConnectionAuditEvent(crossTenantHarness.auditEventRepository.record.mock.calls[1]?.[0], {
      result: 'denied',
      reason: 'not_found_or_not_owned',
      connectionId: 'his_conn_other',
    });
  });

  it('非 active 或已删除连接不调用 fake provider，也不写健康状态', async () => {
    const blockedRecords = [
      { ...activeConnection, status: 'draft' },
      { ...activeConnection, status: 'paused' },
      { ...activeConnection, status: 'revoked' },
      { ...activeConnection, status: 'error' },
      { ...activeConnection, status: 'deleted', deletedAt: '2026-06-07T09:00:00.000Z' },
    ] satisfies HisConnectionReadModel[];

    for (const record of blockedRecords) {
      const harness = createServiceHarness({ record });

      const result = await testHisConnectionForTenantService({
        accessContext,
        connectionId: record.connectionId,
        database: harness.database,
        fakeProvider: harness.fakeProvider,
        hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
      });

      if (record.status === 'deleted') {
        expect(result).toEqual({ status: 'not_found' });
      } else {
        expect(result).toMatchObject({
          status: 'connection_not_active',
          dto: {
            ok: false,
            code: 'connection_not_active',
            healthStatus: record.healthStatus,
          },
        });
      }
      expect(harness.fakeProvider).not.toHaveBeenCalled();
      expect(harness.repository.writeHisConnectionHealthSummaryForTenant).not.toHaveBeenCalled();
      if (record.status === 'deleted') {
        expect(harness.auditEventRepository.record).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'test_connection',
            result: 'denied',
            reason: 'not_found_or_not_owned',
          }),
        );
      } else {
        expect(harness.auditEventRepository.record).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'test_connection',
            result: 'denied',
            reason: 'test_connection_connection_not_active',
          }),
        );
      }
      expectNoSensitiveAuditData(harness.auditEventRepository.record.mock.calls);
    }
  });

  it('repository 写回失败时返回 service_unavailable，不声称测试成功', async () => {
    const writeNotFoundHarness = createServiceHarness({ writeResult: { status: 'not_found' } });
    const writeErrorHarness = createServiceHarness({
      writeError: new Error('DATABASE_URL=postgres://secret stack'),
    });

    await expect(
      testHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_001',
        database: writeNotFoundHarness.database,
        fakeProvider: writeNotFoundHarness.fakeProvider,
        hisConnectionRepositoryFactory: writeNotFoundHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: writeNotFoundHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'service_unavailable' });
    await expect(
      testHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_001',
        database: writeErrorHarness.database,
        fakeProvider: writeErrorHarness.fakeProvider,
        hisConnectionRepositoryFactory: writeErrorHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: writeErrorHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'service_unavailable' });
    expect(writeNotFoundHarness.auditEventRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'test_connection',
        resourceId: 'his_conn_001',
        result: 'denied',
        reason: 'repository_after_provider_failed',
      }),
    );
    expect(writeErrorHarness.auditEventRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'test_connection',
        resourceId: 'his_conn_001',
        result: 'denied',
        reason: 'repository_after_provider_failed',
      }),
    );
    expectNoSensitiveAuditData(writeNotFoundHarness.auditEventRepository.record.mock.calls);
    expectNoSensitiveAuditData(writeErrorHarness.auditEventRepository.record.mock.calls);
  });

  it('audit 写入失败时 fail closed 为 service_unavailable，且不泄露 audit 原始错误', async () => {
    const harness = createServiceHarness({
      auditError: new Error('audit insert failed credentialRef=cred_ref DATABASE_URL stack'),
    });

    const result = await testHisConnectionForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      fakeProvider: harness.fakeProvider,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(result).toEqual({ status: 'service_unavailable' });
    expect(harness.auditEventRepository.record).toHaveBeenCalledTimes(1);
    expect(harness.fakeProvider).not.toHaveBeenCalled();
    expect(harness.repository.writeHisConnectionHealthSummaryForTenant).not.toHaveBeenCalled();
    expectNoSensitiveAuditData(result);
  });
});
