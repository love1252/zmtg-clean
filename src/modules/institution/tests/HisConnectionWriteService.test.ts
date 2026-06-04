import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { AccessContext } from '@/modules/security/domain/access-control';
import type { TenantDatabase } from '@/server/db/client';
import type {
  CreateHisConnectionInput,
  UpdateHisConnectionInput,
} from '@/modules/institution/server/his-connection-write-input';
import type {
  CreateHisConnectionResult,
  HisConnectionReadModel,
  UpdateHisConnectionResult,
} from '@/modules/institution/server/his-connection-repository';
import {
  createHisConnectionForTenantService,
  updateHisConnectionForTenantService,
} from '@/modules/institution/server/his-connection-write-service';

const accessContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const createMetadata = {
  connectionName: '星澜 HIS 连接',
  sourceSystem: 'his',
  vendorType: 'demo_vendor',
  systemType: 'his',
} satisfies CreateHisConnectionInput;

const updateMetadata = {
  connectionName: '星澜 HIS 连接更新',
  sourceSystem: 'clinic_his',
} satisfies UpdateHisConnectionInput;

const createdRecord = {
  connectionId: 'his_conn_created',
  tenantId: 'demo-tenant-001',
  connectionName: '星澜 HIS 连接',
  sourceSystem: 'his',
  vendorType: 'demo_vendor',
  systemType: 'his',
  status: 'draft',
  credentialConfigured: false,
  healthStatus: 'unknown',
  lastCheckedAt: null,
  lastErrorCode: null,
  createdAt: '2026-06-04T08:00:00.000Z',
  updatedAt: '2026-06-04T08:00:00.000Z',
  revokedAt: null,
  deletedAt: null,
} satisfies HisConnectionReadModel;

const updatedRecord = {
  ...createdRecord,
  connectionId: 'his_conn_001',
  connectionName: '星澜 HIS 连接更新',
  sourceSystem: 'clinic_his',
  updatedAt: '2026-06-04T08:10:00.000Z',
} satisfies HisConnectionReadModel;

function createServiceHarness(input: {
  createResult?: CreateHisConnectionResult;
  updateResult?: UpdateHisConnectionResult;
  createError?: unknown;
  updateError?: unknown;
  auditError?: unknown;
} = {}) {
  const transactionDatabase = { kind: 'transaction-database' } as unknown as TenantDatabase;
  const database = {
    transaction: vi.fn(async (callback: (transaction: TenantDatabase) => Promise<unknown>) =>
      callback(transactionDatabase),
    ),
  } as unknown as TenantDatabase;
  const hisConnectionRepository = {
    createHisConnectionForTenant: vi.fn(
      async (command: unknown): Promise<CreateHisConnectionResult> => {
        void command;
        if (input.createError) throw input.createError;
        return input.createResult ?? { status: 'ok', record: createdRecord };
      },
    ),
    updateHisConnectionForTenant: vi.fn(
      async (command: unknown): Promise<UpdateHisConnectionResult> => {
        void command;
        if (input.updateError) throw input.updateError;
        return input.updateResult ?? { status: 'ok', record: updatedRecord };
      },
    ),
  };
  const auditRepository = {
    record: vi.fn(async (event: TenantAuditEvent) => {
      void event;
      if (input.auditError) throw input.auditError;
    }),
  };
  const hisConnectionRepositoryFactory = vi.fn(() => hisConnectionRepository);
  const auditEventRepositoryFactory = vi.fn(() => auditRepository);

  return {
    auditEventRepositoryFactory,
    auditRepository,
    database,
    hisConnectionRepository,
    hisConnectionRepositoryFactory,
    transactionDatabase,
  };
}

function expectNoPrivateWriteData(payload: unknown) {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toMatch(
    /tenantId|connectionId|status|credentialRef|credentialConfigured|healthStatus|lastCheckedAt|lastErrorCode|createdAt|updatedAt|createdBy|updatedBy|revokedAt|deletedAt|actorUserId|token|secret|apiKey|api_key|oauth|basicAuth|basic_auth|signingKey|signing_key|privateKey|private_key|connectionString|connection_string|rawPayload|raw_payload|requestBody|request_body|responseBody|response_body|DATABASE_URL|postgres:\/\/|select \* from|stack/i,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('HIS 连接配置写入 service', () => {
  it('create ok：在同一事务中调用 repository create、写 allowed audit，并返回最小成功结果', async () => {
    const harness = createServiceHarness();

    const result = await createHisConnectionForTenantService({
      accessContext,
      database: harness.database,
      metadata: createMetadata,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(result).toEqual({ status: 'created', dto: { ok: true } });
    if (result.status !== 'created') {
      throw new Error('expected created result');
    }
    expect(harness.database.transaction).toHaveBeenCalledTimes(1);
    expect(harness.hisConnectionRepositoryFactory).toHaveBeenCalledWith(
      harness.transactionDatabase,
    );
    expect(harness.auditEventRepositoryFactory).toHaveBeenCalledWith(harness.transactionDatabase);
    expect(harness.hisConnectionRepository.createHisConnectionForTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      actorUserId: 'demo-user-admin',
      connectionName: '星澜 HIS 连接',
      sourceSystem: 'his',
      vendorType: 'demo_vendor',
      systemType: 'his',
    });
    expect(harness.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'demo-user-admin',
        actorRole: 'tenant_admin',
        tenantId: 'demo-tenant-001',
        scope: 'tenant',
        source: 'demo_session',
        resource: 'open_connection',
        resourceId: 'his_conn_created',
        action: 'create',
        result: 'allowed',
        reason: 'allowed_by_policy',
        occurredAt: expect.any(String),
      }),
    );
    expectNoPrivateWriteData(result.dto);
  });

  it('update ok：使用可信 tenantId 和 path connectionId，且只传入 parser 输出的非空子集', async () => {
    const harness = createServiceHarness();
    const metadataWithForbiddenFields = {
      ...updateMetadata,
      tenantId: 'forged-tenant',
      credentialRef: 'cred_ref_should_not_pass',
      status: 'active',
      healthStatus: 'healthy',
    } as UpdateHisConnectionInput;

    const result = await updateHisConnectionForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      metadata: metadataWithForbiddenFields,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(result).toEqual({ status: 'updated', dto: { ok: true } });
    if (result.status !== 'updated') {
      throw new Error('expected updated result');
    }
    expect(harness.hisConnectionRepository.updateHisConnectionForTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      actorUserId: 'demo-user-admin',
      values: {
        connectionName: '星澜 HIS 连接更新',
        sourceSystem: 'clinic_his',
      },
    });
    expect(harness.hisConnectionRepository.updateHisConnectionForTenant).not.toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'forged-tenant',
      }),
    );
    expect(harness.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'open_connection',
        resourceId: 'his_conn_001',
        action: 'update',
        result: 'allowed',
        reason: 'allowed_by_policy',
      }),
    );
    expectNoPrivateWriteData(result.dto);
  });

  it('create command 只包含可信 tenantId、actorUserId 和四个安全元数据字段', async () => {
    const harness = createServiceHarness();
    const metadataWithForbiddenFields = {
      ...createMetadata,
      tenantId: 'forged-tenant',
      connectionId: 'forged-connection',
      credentialRef: 'cred_ref_should_not_pass',
      rawPayload: { external: true },
    } as CreateHisConnectionInput;

    await createHisConnectionForTenantService({
      accessContext,
      database: harness.database,
      metadata: metadataWithForbiddenFields,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    const command = harness.hisConnectionRepository.createHisConnectionForTenant.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    if (!command) {
      throw new Error('expected create command');
    }

    expect(Object.keys(command).sort()).toEqual(
      [
        'actorUserId',
        'connectionName',
        'sourceSystem',
        'systemType',
        'tenantId',
        'vendorType',
      ].sort(),
    );
    expect(command).toEqual({
      tenantId: 'demo-tenant-001',
      actorUserId: 'demo-user-admin',
      connectionName: '星澜 HIS 连接',
      sourceSystem: 'his',
      vendorType: 'demo_vendor',
      systemType: 'his',
    });
  });

  it('稳定映射 repository validation_failed、conflict 和 not_found 结果', async () => {
    const validationHarness = createServiceHarness({
      createResult: { status: 'validation_failed' },
    });
    const conflictHarness = createServiceHarness({ createResult: { status: 'conflict' } });
    const notFoundHarness = createServiceHarness({ updateResult: { status: 'not_found' } });

    await expect(
      createHisConnectionForTenantService({
        accessContext,
        database: validationHarness.database,
        metadata: createMetadata,
        hisConnectionRepositoryFactory: validationHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: validationHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'validation_failed' });

    await expect(
      createHisConnectionForTenantService({
        accessContext,
        database: conflictHarness.database,
        metadata: createMetadata,
        hisConnectionRepositoryFactory: conflictHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: conflictHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'conflict' });

    await expect(
      updateHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_missing',
        database: notFoundHarness.database,
        metadata: updateMetadata,
        hisConnectionRepositoryFactory: notFoundHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: notFoundHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'not_found' });
  });

  it('repository thrown error 映射为 service_unavailable，且不泄露内部异常', async () => {
    const harness = createServiceHarness({
      createError: new Error(
        'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg token stack',
      ),
    });

    const result = await createHisConnectionForTenantService({
      accessContext,
      database: harness.database,
      metadata: createMetadata,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(result).toEqual({ status: 'service_unavailable' });
    expect(JSON.stringify(result)).not.toMatch(/DATABASE_URL|postgres:\/\/|token|stack/i);
    expect(harness.auditRepository.record).not.toHaveBeenCalled();
  });

  it('audit 失败时 create / update 返回 service_unavailable，且不返回业务成功', async () => {
    const createHarness = createServiceHarness({
      auditError: new Error('audit insert failed DATABASE_URL stack'),
    });
    const updateHarness = createServiceHarness({
      auditError: new Error('audit insert failed DATABASE_URL stack'),
    });

    await expect(
      createHisConnectionForTenantService({
        accessContext,
        database: createHarness.database,
        metadata: createMetadata,
        hisConnectionRepositoryFactory: createHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: createHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'service_unavailable' });
    await expect(
      updateHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_001',
        database: updateHarness.database,
        metadata: updateMetadata,
        hisConnectionRepositoryFactory: updateHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: updateHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'service_unavailable' });
  });

  it('service 不调用 fetch、localStorage、真实 HIS、治疗摘要、随访任务或自动触达', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const localStorage = {
      clear: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorage);
    const harness = createServiceHarness();

    await createHisConnectionForTenantService({
      accessContext,
      database: harness.database,
      metadata: createMetadata,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();

    const source = readFileSync(
      join(process.cwd(), 'src/modules/institution/server/his-connection-write-service.ts'),
      'utf8',
    );

    expect(source).not.toMatch(
      /fetch|localStorage|Request|request\.json|headers|query|credentialRef|credentialConfigured|rawPayload|raw HIS|DATABASE_URL|treatmentSummary|treatment-summary|followUp|follow-up|follow_up|自动触达|真实 HIS|测试连接/i,
    );
  });
});
