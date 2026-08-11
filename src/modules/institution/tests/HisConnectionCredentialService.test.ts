import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { HisConnectionCredentialReferenceResult } from '@/modules/institution/server/his-connection-repository';
import type {
  HisConnectionCredentialProvider,
  StoreSyntheticCredentialReferenceInput,
  StoreSyntheticCredentialReferenceResult,
} from '@/modules/institution/server/his-connection-credential-storage';
import { createHisConnectionCredentialProviderFailure } from '@/modules/institution/server/his-connection-credential-provider-failure';
import type { AccessContext } from '@/modules/security/domain/access-control';
import type { TenantDatabase } from '@/server/db/client';
import {
  clearHisConnectionCredentialForTenantService,
  createHisConnectionCredentialForTenantService,
  revokeHisConnectionCredentialForTenantService,
  rotateHisConnectionCredentialForTenantService,
  updateHisConnectionCredentialForTenantService,
} from '@/modules/institution/server/his-connection-credential-service';

const accessContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const parsedCredentialInput = {
  credentialType: 'api_key',
  syntheticPlaceholder: 'synthetic_placeholder_service_demo',
  idempotencyKey: 'idem_service_demo',
  reasonCode: 'operator_update',
} as const;

const safeCredentialRef = 'cred_ref_service_demo_safe_001';

const providerFailureAuditCases = [
  {
    category: 'provider_unavailable',
    expectedReason: 'provider_unavailable',
    expectedStatus: 'service_unavailable',
  },
  {
    category: 'timeout',
    expectedReason: 'provider_timeout',
    expectedStatus: 'service_unavailable',
  },
  {
    category: 'retry_exhausted',
    expectedReason: 'provider_retry_exhausted',
    expectedStatus: 'service_unavailable',
  },
  {
    category: 'circuit_open',
    expectedReason: 'provider_circuit_open',
    expectedStatus: 'service_unavailable',
  },
  {
    category: 'validation_failed',
    expectedReason: 'provider_validation_failed',
    expectedStatus: 'validation_failed',
  },
  {
    category: 'provider_write_failed',
    expectedReason: 'provider_write_failed',
    expectedStatus: 'service_unavailable',
  },
  {
    category: 'provider_describe_failed',
    expectedReason: 'provider_describe_failed',
    expectedStatus: 'service_unavailable',
  },
  {
    category: 'provider_health_failed',
    expectedReason: 'provider_health_failed',
    expectedStatus: 'service_unavailable',
  },
  {
    category: 'repository_after_provider_failed',
    expectedReason: 'repository_after_provider_failed',
    expectedStatus: 'service_unavailable',
  },
  {
    category: 'audit_after_provider_failed',
    expectedReason: 'audit_after_provider_failed',
    expectedStatus: 'service_unavailable',
  },
  {
    category: 'tenant_connection_mismatch',
    expectedReason: 'not_found_or_not_owned',
    expectedStatus: 'service_unavailable',
  },
  {
    category: 'idempotency_conflict',
    expectedReason: 'provider_validation_failed',
    expectedStatus: 'service_unavailable',
  },
  {
    category: 'invalid_state',
    expectedReason: 'invalid_transition',
    expectedStatus: 'invalid_state_transition',
  },
] as const;

function createOkCredentialResult(input: {
  credentialConfigured: boolean;
}): HisConnectionCredentialReferenceResult {
  return {
    status: 'ok',
    record: {
      connectionId: 'his_conn_001',
      tenantId: 'demo-tenant-001',
      connectionName: '星澜 HIS 连接',
      sourceSystem: 'his',
      vendorType: 'demo_vendor',
      systemType: 'his',
      status: 'draft',
      credentialConfigured: input.credentialConfigured,
      healthStatus: 'unknown',
      lastCheckedAt: null,
      lastErrorCode: null,
      createdAt: '2026-06-06T00:00:00.000Z',
      updatedAt: '2026-06-06T00:10:00.000Z',
      revokedAt: null,
      deletedAt: null,
    },
    summary: {
      connectionId: 'his_conn_001',
      tenantId: 'demo-tenant-001',
      status: 'draft',
      credentialConfigured: input.credentialConfigured,
      credentialStatus: input.credentialConfigured ? 'configured' : 'missing',
      updatedAt: '2026-06-06T00:10:00.000Z',
      revokedAt: null,
      deletedAt: null,
    },
  };
}

function createServiceHarness(input: {
  storageResult?: StoreSyntheticCredentialReferenceResult;
  repositoryResult?: HisConnectionCredentialReferenceResult;
  storageError?: unknown;
  repositoryError?: unknown;
  auditError?: unknown;
} = {}) {
  const transactionDatabase = { kind: 'transaction-database' } as unknown as TenantDatabase;
  const database = {
    transaction: vi.fn(async (callback: (transaction: TenantDatabase) => Promise<unknown>) =>
      callback(transactionDatabase),
    ),
  } as unknown as TenantDatabase;
  const credentialStorage: Pick<
    HisConnectionCredentialProvider,
    'storeSyntheticCredentialReference' | 'health' | 'describeCredentialReference'
  > = {
    storeSyntheticCredentialReference: vi.fn(
      async (
        command: StoreSyntheticCredentialReferenceInput,
      ): Promise<StoreSyntheticCredentialReferenceResult> => {
        void command;
        if (input.storageError) throw input.storageError;
        return (
          input.storageResult ?? {
            status: 'stored',
            credentialRef: safeCredentialRef,
            provider: 'in_memory_test_only',
            storedAt: '2026-06-06T00:00:00.000Z',
          }
        );
      },
    ),
    health: vi.fn(async () => ({
      status: 'available' as const,
      provider: 'in_memory_test_only' as const,
      mode: 'test_only' as const,
      acceptsRealCredentialMaterial: false as const,
      storesRawCredentialMaterial: false as const,
      supportsTestConnection: false as const,
      connectedProvider: false as const,
      checkedAt: '2026-06-06T00:00:00.000Z',
    })),
    describeCredentialReference: vi.fn(async () => ({ status: 'not_found' as const })),
  };
  const hisConnectionRepository = {
    setHisConnectionCredentialReferenceForTenant: vi.fn(
      async (command: unknown): Promise<HisConnectionCredentialReferenceResult> => {
        void command;
        if (input.repositoryError) throw input.repositoryError;
        return input.repositoryResult ?? createOkCredentialResult({ credentialConfigured: true });
      },
    ),
    rotateHisConnectionCredentialReferenceForTenant: vi.fn(
      async (command: unknown): Promise<HisConnectionCredentialReferenceResult> => {
        void command;
        if (input.repositoryError) throw input.repositoryError;
        return input.repositoryResult ?? createOkCredentialResult({ credentialConfigured: true });
      },
    ),
    clearHisConnectionCredentialReferenceForTenant: vi.fn(
      async (command: unknown): Promise<HisConnectionCredentialReferenceResult> => {
        void command;
        if (input.repositoryError) throw input.repositoryError;
        return input.repositoryResult ?? createOkCredentialResult({ credentialConfigured: false });
      },
    ),
    revokeHisConnectionCredentialReferenceForTenant: vi.fn(
      async (command: unknown): Promise<HisConnectionCredentialReferenceResult> => {
        void command;
        if (input.repositoryError) throw input.repositoryError;
        return input.repositoryResult ?? createOkCredentialResult({ credentialConfigured: false });
      },
    ),
  };
  const hisConnectionRepositoryFactory = vi.fn(() => hisConnectionRepository);
  const auditEventRepository = {
    record: vi.fn(async (event: TenantAuditEvent) => {
      void event;
      if (input.auditError) throw input.auditError;
    }),
  };
  const auditEventRepositoryFactory = vi.fn(() => auditEventRepository);

  return {
    auditEventRepository,
    auditEventRepositoryFactory,
    credentialStorage,
    database,
    hisConnectionRepository,
    hisConnectionRepositoryFactory,
    transactionDatabase,
  };
}

function expectNoCredentialLeak(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /cred_ref_service_demo_safe_001|credentialRef|credential_ref|scoped|tenant:connection|idempotencyKey|idem_service_demo|synthetic_placeholder_service_demo|token|secret|apiKey|api_key|connectionString|connection_string|rawCredential|raw_credential|rawPayload|raw_payload|DATABASE_URL|postgres:\/\/|select \* from|SQL|stack/i,
  );
}

function expectProviderFailureAuditEvent(
  event: TenantAuditEvent,
  reason: TenantAuditEvent['reason'],
) {
  expect(event).toMatchObject({
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    tenantId: 'demo-tenant-001',
    resource: 'open_connection',
    resourceId: 'his_conn_001',
    action: 'manage_credentials',
    result: 'denied',
    reason,
    source: 'demo_session',
  });
  expectNoCredentialLeak(event);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('HIS 连接配置凭证 service 最小边界', () => {
  it('create credential 调用 storage + repository set，并返回最小成功 DTO', async () => {
    const harness = createServiceHarness();

    const result = await createHisConnectionCredentialForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      credentialStorage: harness.credentialStorage,
      credentialInput: parsedCredentialInput,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
    });

    expect(result).toEqual({
      status: 'created',
      dto: { ok: true, credentialConfigured: true },
    });
    if (result.status !== 'created') {
      throw new Error('expected created result');
    }
    expect(harness.credentialStorage.storeSyntheticCredentialReference).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      placeholder: 'synthetic_placeholder_service_demo',
      idempotencyKey: 'idem_service_demo',
    });
    expect(harness.credentialStorage.health).not.toHaveBeenCalled();
    expect(harness.credentialStorage.describeCredentialReference).not.toHaveBeenCalled();
    expect(harness.database.transaction).toHaveBeenCalledTimes(1);
    expect(harness.hisConnectionRepositoryFactory).toHaveBeenCalledWith(
      harness.transactionDatabase,
    );
    expect(
      harness.hisConnectionRepository.setHisConnectionCredentialReferenceForTenant,
    ).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      actorUserId: 'demo-user-admin',
      credentialRef: safeCredentialRef,
    });
    expectNoCredentialLeak(result.dto);
  });

  it('update credential 调用 storage + repository set', async () => {
    const harness = createServiceHarness();

    const result = await updateHisConnectionCredentialForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      credentialStorage: harness.credentialStorage,
      credentialInput: parsedCredentialInput,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
    });

    expect(result).toEqual({
      status: 'updated',
      dto: { ok: true, credentialConfigured: true },
    });
    expect(
      harness.hisConnectionRepository.setHisConnectionCredentialReferenceForTenant,
    ).toHaveBeenCalledTimes(1);
    expect(harness.credentialStorage.storeSyntheticCredentialReference).toHaveBeenCalledTimes(1);
    expect(harness.credentialStorage.health).not.toHaveBeenCalled();
    expect(harness.credentialStorage.describeCredentialReference).not.toHaveBeenCalled();
  });

  it('rotate credential 调用 storage + repository rotate', async () => {
    const harness = createServiceHarness();

    const result = await rotateHisConnectionCredentialForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      credentialStorage: harness.credentialStorage,
      credentialInput: parsedCredentialInput,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
    });

    expect(result).toEqual({
      status: 'rotated',
      dto: { ok: true, credentialConfigured: true },
    });
    expect(
      harness.hisConnectionRepository.rotateHisConnectionCredentialReferenceForTenant,
    ).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      actorUserId: 'demo-user-admin',
      credentialRef: safeCredentialRef,
    });
    expect(harness.credentialStorage.storeSyntheticCredentialReference).toHaveBeenCalledTimes(1);
    expect(harness.credentialStorage.health).not.toHaveBeenCalled();
    expect(harness.credentialStorage.describeCredentialReference).not.toHaveBeenCalled();
  });

  it('clear / revoke credential 只调用 repository clear / revoke，不强制读取内部 credentialRef', async () => {
    const clearHarness = createServiceHarness();
    const revokeHarness = createServiceHarness();

    await expect(
      clearHisConnectionCredentialForTenantService({
        accessContext,
        connectionId: 'his_conn_001',
        database: clearHarness.database,
        credentialInput: { reasonCode: 'operator_clear' },
        hisConnectionRepositoryFactory: clearHarness.hisConnectionRepositoryFactory,
      }),
    ).resolves.toEqual({
      status: 'cleared',
      dto: { ok: true, credentialConfigured: false },
    });
    await expect(
      revokeHisConnectionCredentialForTenantService({
        accessContext,
        connectionId: 'his_conn_001',
        database: revokeHarness.database,
        credentialInput: { reasonCode: 'operator_revoke' },
        hisConnectionRepositoryFactory: revokeHarness.hisConnectionRepositoryFactory,
      }),
    ).resolves.toEqual({
      status: 'revoked',
      dto: { ok: true, credentialConfigured: false },
    });

    expect(clearHarness.credentialStorage.storeSyntheticCredentialReference).not.toHaveBeenCalled();
    expect(revokeHarness.credentialStorage.storeSyntheticCredentialReference).not.toHaveBeenCalled();
    expect(clearHarness.credentialStorage.health).not.toHaveBeenCalled();
    expect(revokeHarness.credentialStorage.health).not.toHaveBeenCalled();
    expect(clearHarness.credentialStorage.describeCredentialReference).not.toHaveBeenCalled();
    expect(revokeHarness.credentialStorage.describeCredentialReference).not.toHaveBeenCalled();
    expect(
      clearHarness.hisConnectionRepository.clearHisConnectionCredentialReferenceForTenant,
    ).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      actorUserId: 'demo-user-admin',
      reasonCode: 'operator_clear',
    });
    expect(
      revokeHarness.hisConnectionRepository.revokeHisConnectionCredentialReferenceForTenant,
    ).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      actorUserId: 'demo-user-admin',
      reasonCode: 'operator_revoke',
    });
  });

  it('service 不读取 request / header / query / localStorage，不调用真实 HIS 或测试连接', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const localStorage = {
      clear: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorage);
    const harness = createServiceHarness();

    await createHisConnectionCredentialForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      credentialStorage: harness.credentialStorage,
      credentialInput: parsedCredentialInput,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      request: { headers: { tenantId: 'forged' }, query: { tenantId: 'forged' } },
    } as Parameters<typeof createHisConnectionCredentialForTenantService>[0] & {
      request: unknown;
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('storage validation_failed 映射为稳定 failure，且不调用 repository', async () => {
    const harness = createServiceHarness({ storageResult: { status: 'validation_failed' } });

    const result = await createHisConnectionCredentialForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      credentialStorage: harness.credentialStorage,
      credentialInput: parsedCredentialInput,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
    });

    expect(result).toEqual({ status: 'validation_failed' });
    expect(harness.database.transaction).not.toHaveBeenCalled();
    expect(
      harness.hisConnectionRepository.setHisConnectionCredentialReferenceForTenant,
    ).not.toHaveBeenCalled();
  });

  it('repository not_found / invalid_state_transition / validation_failed 映射稳定', async () => {
    for (const status of ['not_found', 'invalid_state_transition', 'validation_failed'] as const) {
      const harness = createServiceHarness({ repositoryResult: { status } });

      await expect(
        createHisConnectionCredentialForTenantService({
          accessContext,
          connectionId: 'his_conn_001',
          database: harness.database,
          credentialStorage: harness.credentialStorage,
          credentialInput: parsedCredentialInput,
          hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
        }),
      ).resolves.toEqual({ status });
    }
  });

  it('storage 成功但 repository 失败时不泄露 credentialRef、idempotencyKey 或 storage 内部信息', async () => {
    const harness = createServiceHarness({ repositoryResult: { status: 'not_found' } });

    const result = await rotateHisConnectionCredentialForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      credentialStorage: harness.credentialStorage,
      credentialInput: parsedCredentialInput,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
    });

    expect(result).toEqual({ status: 'not_found' });
    expectNoCredentialLeak(result);
  });

  it('repository 成功后写入 allowed audit，且 metadata 不包含 placeholder、idempotencyKey 或 credentialRef', async () => {
    const harness = createServiceHarness();

    const result = await createHisConnectionCredentialForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      credentialStorage: harness.credentialStorage,
      credentialInput: parsedCredentialInput,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(result).toEqual({
      status: 'created',
      dto: { ok: true, credentialConfigured: true },
    });
    expect(harness.auditEventRepositoryFactory).toHaveBeenCalledWith(
      harness.transactionDatabase,
    );
    expect(harness.auditEventRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'demo-user-admin',
        actorRole: 'tenant_admin',
        tenantId: 'demo-tenant-001',
        resource: 'open_connection',
        resourceId: 'his_conn_001',
        action: 'manage_credentials',
        result: 'allowed',
        reason: 'allowed_by_policy',
        source: 'demo_session',
      }),
    );
    expectNoCredentialLeak(harness.auditEventRepository.record.mock.calls);
  });

  it('allowed audit 写入失败时 fail closed 为 service_unavailable，且不泄露敏感信息', async () => {
    const harness = createServiceHarness({
      auditError: new Error('credentialRef=cred_ref_service_demo_safe_001 sk_live stack'),
    });

    const result = await rotateHisConnectionCredentialForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      credentialStorage: harness.credentialStorage,
      credentialInput: parsedCredentialInput,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(result).toEqual({ status: 'service_unavailable' });
    expect(harness.auditEventRepository.record).toHaveBeenCalledTimes(1);
    expectNoCredentialLeak(result);
  });

  it('thrown error 映射为 service_unavailable，且不泄露 SQL / stack / DATABASE_URL', async () => {
    const storageHarness = createServiceHarness({
      storageError: new Error('DATABASE_URL=postgres://tenant:secret@localhost stack'),
    });
    const repositoryHarness = createServiceHarness({
      repositoryError: new Error('select * from his_connections stack'),
    });

    await expect(
      createHisConnectionCredentialForTenantService({
        accessContext,
        connectionId: 'his_conn_001',
        database: storageHarness.database,
        credentialStorage: storageHarness.credentialStorage,
        credentialInput: parsedCredentialInput,
        hisConnectionRepositoryFactory: storageHarness.hisConnectionRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'service_unavailable' });
    await expect(
      clearHisConnectionCredentialForTenantService({
        accessContext,
        connectionId: 'his_conn_001',
        database: repositoryHarness.database,
        credentialInput: { reasonCode: 'operator_clear' },
        hisConnectionRepositoryFactory: repositoryHarness.hisConnectionRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'service_unavailable' });
  });

  it('已知 provider failure 写一条 denied audit，按稳定 mapping 返回，且不写 allowed audit', async () => {
    for (const { category, expectedReason, expectedStatus } of providerFailureAuditCases) {
      const harness = createServiceHarness({
        storageError: createHisConnectionCredentialProviderFailure({
          category,
          operation: 'store',
          tenantId: 'demo-tenant-001',
          connectionId: 'his_conn_001',
          unsafeMessage:
            'credentialRef=cred_ref_service_demo_safe_001 idempotencyKey=idem_service_demo sk_live stack',
        }),
      });

      const result = await createHisConnectionCredentialForTenantService({
        accessContext,
        connectionId: 'his_conn_001',
        database: harness.database,
        credentialStorage: harness.credentialStorage,
        credentialInput: parsedCredentialInput,
        hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
      });

      expect(result).toEqual({ status: expectedStatus });
      expect(harness.database.transaction).not.toHaveBeenCalled();
      expect(harness.auditEventRepository.record).toHaveBeenCalledTimes(1);
      expectProviderFailureAuditEvent(
        harness.auditEventRepository.record.mock.calls[0][0] as TenantAuditEvent,
        expectedReason,
      );
      expect(harness.auditEventRepository.record.mock.calls[0][0]).not.toMatchObject({
        result: 'allowed',
        reason: 'allowed_by_policy',
      });
      expectNoCredentialLeak(result);
    }
  });

  it('provider revoke failure 写 provider_revoke_failed audit，且不暴露 provider / repository 原始错误', async () => {
    const harness = createServiceHarness({
      repositoryError: createHisConnectionCredentialProviderFailure({
        category: 'provider_revoke_failed',
        operation: 'revoke',
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        unsafeMessage:
          'providerPath=/vault/his/secret credentialRef=cred_ref_service_demo_safe_001 stack',
      }),
    });

    const result = await revokeHisConnectionCredentialForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      credentialInput: { reasonCode: 'operator_revoke' },
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(result).toEqual({ status: 'service_unavailable' });
    expect(harness.database.transaction).toHaveBeenCalledTimes(1);
    expect(harness.auditEventRepository.record).toHaveBeenCalledTimes(1);
    expectProviderFailureAuditEvent(
      harness.auditEventRepository.record.mock.calls[0][0] as TenantAuditEvent,
      'provider_revoke_failed',
    );
    expectNoCredentialLeak(harness.auditEventRepository.record.mock.calls);
  });

  it('provider failure audit 写入失败时 fail closed 为 service_unavailable，且不泄露 audit 原始错误', async () => {
    const harness = createServiceHarness({
      storageError: createHisConnectionCredentialProviderFailure({
        category: 'validation_failed',
        operation: 'store',
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
      }),
      auditError: new Error(
        'audit insert failed credentialRef=cred_ref_service_demo_safe_001 DATABASE_URL stack',
      ),
    });

    const result = await createHisConnectionCredentialForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      credentialStorage: harness.credentialStorage,
      credentialInput: parsedCredentialInput,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(result).toEqual({ status: 'service_unavailable' });
    expect(harness.auditEventRepository.record).toHaveBeenCalledTimes(1);
    expectNoCredentialLeak(result);
  });

  it('未知 thrown error 不写 provider failure audit，只返回 service_unavailable', async () => {
    const harness = createServiceHarness({
      storageError: new Error(
        'credentialRef=cred_ref_service_demo_safe_001 DATABASE_URL=postgres://tenant:secret@localhost stack',
      ),
    });

    const result = await createHisConnectionCredentialForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      credentialStorage: harness.credentialStorage,
      credentialInput: parsedCredentialInput,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(result).toEqual({ status: 'service_unavailable' });
    expect(harness.auditEventRepository.record).not.toHaveBeenCalled();
    expectNoCredentialLeak(result);
  });
});

describe('W6A default Writer construction', () => {
  it('uses server orchestration for the default Writer', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/modules/institution/server/his-connection-credential-service.ts'),
      'utf8',
    );
    expect(source).toContain("@/server/orchestration/his-connection-writer");
    expect(source).toContain('createHisConnectionWriter');
  });
});
