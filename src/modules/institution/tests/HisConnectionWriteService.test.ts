import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttributedTenantAuditEventV1 } from '@/modules/audit/domain/audit-events';
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
    recordAttributed: vi.fn(async (event: AttributedTenantAuditEventV1) => {
      expect(event).toMatchObject({
        institutionAttribution: 'not_applicable',
        institutionId: null,
      });
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

function expectNoSensitiveAuditData(event: unknown) {
  const serialized = JSON.stringify(event);

  expect(serialized).not.toMatch(
    /requestBody|request_body|responseBody|response_body|credentialRef|credentialConfigured|token|secret|apiKey|api_key|oauth|basicAuth|basic_auth|signingKey|signing_key|privateKey|private_key|connectionString|connection_string|rawPayload|raw_payload|raw HIS payload|DATABASE_URL|postgres:\/\/|select \* from|SQL|stack|constraint|index|冲突行详情|完整病历|完整治疗正文|咨询全文|图片 \/ 文件原文/i,
  );
}

function expectDeniedAuditEvent(
  event: unknown,
  input: {
    action: 'create' | 'update';
    reason:
      | 'invalid_his_connection_payload'
      | 'his_connection_name_conflict'
      | 'not_found_or_not_owned';
    resourceId?: string;
  },
) {
  expect(event).toMatchObject({
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    tenantId: 'demo-tenant-001',
    scope: 'tenant',
    source: 'demo_session',
    resource: 'open_connection',
    action: input.action,
    result: 'denied',
    reason: input.reason,
    occurredAt: expect.any(String),
  });

  if (input.resourceId === undefined) {
    expect(event).not.toHaveProperty('resourceId');
  } else {
    expect(event).toMatchObject({ resourceId: input.resourceId });
  }

  expectNoSensitiveAuditData(event);
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
    expect(harness.auditRepository.recordAttributed).toHaveBeenCalledWith(
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
    expect(harness.auditRepository.recordAttributed).toHaveBeenCalledWith(
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

  it('repository 非 ok 结果在同一事务中写 denied audit，并返回原有稳定结果', async () => {
    const createValidationHarness = createServiceHarness({
      createResult: { status: 'validation_failed' },
    });
    const createConflictHarness = createServiceHarness({ createResult: { status: 'conflict' } });
    const updateValidationHarness = createServiceHarness({
      updateResult: { status: 'validation_failed' },
    });
    const updateConflictHarness = createServiceHarness({ updateResult: { status: 'conflict' } });
    const notFoundHarness = createServiceHarness({ updateResult: { status: 'not_found' } });

    await expect(
      createHisConnectionForTenantService({
        accessContext,
        database: createValidationHarness.database,
        metadata: createMetadata,
        hisConnectionRepositoryFactory: createValidationHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: createValidationHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'validation_failed' });
    expect(createValidationHarness.auditRepository.recordAttributed).toHaveBeenCalledTimes(1);
    expectDeniedAuditEvent(createValidationHarness.auditRepository.recordAttributed.mock.calls[0]?.[0], {
      action: 'create',
      reason: 'invalid_his_connection_payload',
    });

    await expect(
      createHisConnectionForTenantService({
        accessContext,
        database: createConflictHarness.database,
        metadata: createMetadata,
        hisConnectionRepositoryFactory: createConflictHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: createConflictHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'conflict' });
    expect(createConflictHarness.auditRepository.recordAttributed).toHaveBeenCalledTimes(1);
    expectDeniedAuditEvent(createConflictHarness.auditRepository.recordAttributed.mock.calls[0]?.[0], {
      action: 'create',
      reason: 'his_connection_name_conflict',
    });

    await expect(
      updateHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_invalid',
        database: updateValidationHarness.database,
        metadata: updateMetadata,
        hisConnectionRepositoryFactory: updateValidationHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: updateValidationHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'validation_failed' });
    expect(updateValidationHarness.auditRepository.recordAttributed).toHaveBeenCalledTimes(1);
    expectDeniedAuditEvent(updateValidationHarness.auditRepository.recordAttributed.mock.calls[0]?.[0], {
      action: 'update',
      reason: 'invalid_his_connection_payload',
      resourceId: 'his_conn_invalid',
    });

    await expect(
      updateHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_conflict',
        database: updateConflictHarness.database,
        metadata: updateMetadata,
        hisConnectionRepositoryFactory: updateConflictHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: updateConflictHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'conflict' });
    expect(updateConflictHarness.auditRepository.recordAttributed).toHaveBeenCalledTimes(1);
    expectDeniedAuditEvent(updateConflictHarness.auditRepository.recordAttributed.mock.calls[0]?.[0], {
      action: 'update',
      reason: 'his_connection_name_conflict',
      resourceId: 'his_conn_conflict',
    });

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
    expect(notFoundHarness.auditRepository.recordAttributed).toHaveBeenCalledTimes(1);
    expectDeniedAuditEvent(notFoundHarness.auditRepository.recordAttributed.mock.calls[0]?.[0], {
      action: 'update',
      reason: 'not_found_or_not_owned',
      resourceId: 'his_conn_missing',
    });
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
    expect(harness.auditRepository.recordAttributed).not.toHaveBeenCalled();
  });

  it('audit 失败时 create / update 返回 service_unavailable，且不返回业务成功或原失败结果', async () => {
    const createHarness = createServiceHarness({
      auditError: new Error('audit insert failed DATABASE_URL stack'),
    });
    const updateHarness = createServiceHarness({
      auditError: new Error('audit insert failed DATABASE_URL stack'),
    });
    const deniedHarness = createServiceHarness({
      createResult: { status: 'conflict' },
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
    await expect(
      createHisConnectionForTenantService({
        accessContext,
        database: deniedHarness.database,
        metadata: createMetadata,
        hisConnectionRepositoryFactory: deniedHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: deniedHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'service_unavailable' });
    expect(deniedHarness.auditRepository.recordAttributed).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'open_connection',
        action: 'create',
        result: 'denied',
        reason: 'his_connection_name_conflict',
      }),
    );
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

describe('W6A default Writer construction', () => {
  it('uses server orchestration for the default Writer', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/modules/institution/server/his-connection-write-service.ts'),
      'utf8',
    );
    expect(source).toContain("@/server/orchestration/his-connection-writer");
    expect(source).toContain('createHisConnectionWriter');
  });
});
