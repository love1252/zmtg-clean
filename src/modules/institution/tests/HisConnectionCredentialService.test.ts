import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { HisConnectionCredentialReferenceResult } from '@/modules/institution/server/his-connection-repository';
import type {
  StoreSyntheticCredentialReferenceInput,
  StoreSyntheticCredentialReferenceResult,
} from '@/modules/institution/server/his-connection-credential-storage';
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
  const credentialStorage = {
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
});
