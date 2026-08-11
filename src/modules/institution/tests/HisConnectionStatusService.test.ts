import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { AccessContext } from '@/modules/security/domain/access-control';
import type { TenantDatabase } from '@/server/db/client';
import type {
  HisConnectionReadModel,
  HisConnectionStatusTransitionResult,
} from '@/modules/institution/server/his-connection-repository';
import {
  pauseHisConnectionForTenantService,
  resumeHisConnectionForTenantService,
  revokeHisConnectionForTenantService,
  softDeleteHisConnectionForTenantService,
} from '@/modules/institution/server/his-connection-status-service';

const accessContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const statusRecord = {
  connectionId: 'his_conn_001',
  tenantId: 'demo-tenant-001',
  connectionName: '星澜 HIS 连接',
  sourceSystem: 'his',
  vendorType: 'demo_vendor',
  systemType: 'his',
  status: 'paused',
  credentialConfigured: true,
  healthStatus: 'healthy',
  lastCheckedAt: '2026-06-04T08:00:00.000Z',
  lastErrorCode: 'internal_error_should_not_leak',
  createdAt: '2026-06-04T07:00:00.000Z',
  updatedAt: '2026-06-04T08:10:00.000Z',
  revokedAt: null,
  deletedAt: null,
} satisfies HisConnectionReadModel;

function createStatusServiceHarness(input: {
  pauseResult?: HisConnectionStatusTransitionResult;
  resumeResult?: HisConnectionStatusTransitionResult;
  revokeResult?: HisConnectionStatusTransitionResult;
  softDeleteResult?: HisConnectionStatusTransitionResult;
  pauseError?: unknown;
  resumeError?: unknown;
  revokeError?: unknown;
  softDeleteError?: unknown;
  auditError?: unknown;
} = {}) {
  const transactionDatabase = { kind: 'transaction-database' } as unknown as TenantDatabase;
  const database = {
    transaction: vi.fn(async (callback: (transaction: TenantDatabase) => Promise<unknown>) =>
      callback(transactionDatabase),
    ),
  } as unknown as TenantDatabase;
  const hisConnectionRepository = {
    pauseHisConnectionForTenant: vi.fn(
      async (command: unknown): Promise<HisConnectionStatusTransitionResult> => {
        void command;
        if (input.pauseError) throw input.pauseError;
        return input.pauseResult ?? { status: 'ok', record: statusRecord };
      },
    ),
    resumeHisConnectionForTenant: vi.fn(
      async (command: unknown): Promise<HisConnectionStatusTransitionResult> => {
        void command;
        if (input.resumeError) throw input.resumeError;
        return input.resumeResult ?? { status: 'ok', record: { ...statusRecord, status: 'active' } };
      },
    ),
    revokeHisConnectionForTenant: vi.fn(
      async (command: unknown): Promise<HisConnectionStatusTransitionResult> => {
        void command;
        if (input.revokeError) throw input.revokeError;
        return input.revokeResult ?? { status: 'ok', record: { ...statusRecord, status: 'revoked' } };
      },
    ),
    softDeleteHisConnectionForTenant: vi.fn(
      async (command: unknown): Promise<HisConnectionStatusTransitionResult> => {
        void command;
        if (input.softDeleteError) throw input.softDeleteError;
        return (
          input.softDeleteResult ?? {
            status: 'ok',
            record: {
              ...statusRecord,
              status: 'deleted',
              deletedAt: '2026-06-04T08:20:00.000Z',
            },
          }
        );
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

function expectStatusCommand(
  command: unknown,
  input: { tenantId?: string; connectionId?: string; actorUserId?: string; reasonCode?: string },
) {
  expect(command).toEqual(input);
  expect(Object.keys(command as Record<string, unknown>).sort()).toEqual(
    Object.keys(input).sort(),
  );
}

function expectNoSensitiveData(payload: unknown) {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toMatch(
    /requestBody|request_body|responseBody|response_body|bodyTenantId|queryTenantId|headerTenantId|credentialRef|credentialConfigured|token|secret|apiKey|api_key|oauth|basicAuth|basic_auth|signingKey|signing_key|privateKey|private_key|connectionString|connection_string|rawPayload|raw_payload|raw HIS payload|DATABASE_URL|postgres:\/\/|select \* from|SQL|stack|constraint|index|冲突行详情|完整病历|完整治疗正文|咨询全文|图片 \/ 文件原文/i,
  );
}

function expectAllowedAuditEvent(
  event: unknown,
  input: { action: 'manage_status' | 'delete'; resourceId: string },
) {
  expect(event).toMatchObject({
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    tenantId: 'demo-tenant-001',
    scope: 'tenant',
    source: 'demo_session',
    resource: 'open_connection',
    resourceId: input.resourceId,
    action: input.action,
    result: 'allowed',
    reason: 'allowed_by_policy',
    occurredAt: expect.any(String),
  });
  expectNoSensitiveData(event);
}

function expectDeniedAuditEvent(
  event: unknown,
  input: {
    action: 'manage_status' | 'delete';
    reason: 'not_found_or_not_owned' | 'invalid_transition' | 'invalid_his_connection_payload';
    resourceId: string;
  },
) {
  expect(event).toMatchObject({
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    tenantId: 'demo-tenant-001',
    scope: 'tenant',
    source: 'demo_session',
    resource: 'open_connection',
    resourceId: input.resourceId,
    action: input.action,
    result: 'denied',
    reason: input.reason,
    occurredAt: expect.any(String),
  });
  expectNoSensitiveData(event);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('HIS 连接配置状态 service', () => {
  it('pause / resume / revoke 成功：调用对应 repository，写 manage_status allowed audit，并返回最小 DTO', async () => {
    const harness = createStatusServiceHarness();

    await expect(
      pauseHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_001',
        database: harness.database,
        reasonCode: 'operator_pause',
        hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'paused', dto: { ok: true } });
    await expect(
      resumeHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_001',
        database: harness.database,
        reasonCode: 'operator_resume',
        hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'resumed', dto: { ok: true } });
    await expect(
      revokeHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_001',
        database: harness.database,
        reasonCode: 'operator_revoke',
        hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'revoked', dto: { ok: true } });

    expect(harness.database.transaction).toHaveBeenCalledTimes(3);
    expect(harness.hisConnectionRepositoryFactory).toHaveBeenCalledWith(
      harness.transactionDatabase,
    );
    expect(harness.auditEventRepositoryFactory).toHaveBeenCalledWith(harness.transactionDatabase);
    expectStatusCommand(
      harness.hisConnectionRepository.pauseHisConnectionForTenant.mock.calls[0]?.[0],
      {
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        actorUserId: 'demo-user-admin',
        reasonCode: 'operator_pause',
      },
    );
    expectStatusCommand(
      harness.hisConnectionRepository.resumeHisConnectionForTenant.mock.calls[0]?.[0],
      {
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        actorUserId: 'demo-user-admin',
        reasonCode: 'operator_resume',
      },
    );
    expectStatusCommand(
      harness.hisConnectionRepository.revokeHisConnectionForTenant.mock.calls[0]?.[0],
      {
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        actorUserId: 'demo-user-admin',
        reasonCode: 'operator_revoke',
      },
    );
    for (const call of harness.auditRepository.record.mock.calls) {
      expectAllowedAuditEvent(call[0], {
        action: 'manage_status',
        resourceId: 'his_conn_001',
      });
    }
  });

  it('softDelete 成功：调用 softDelete repository，写 delete allowed audit，并返回 deleted + 最小 DTO', async () => {
    const harness = createStatusServiceHarness();

    const result = await softDeleteHisConnectionForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      reasonCode: 'archive_connection',
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(result).toEqual({ status: 'deleted', dto: { ok: true } });
    if (result.status !== 'deleted') {
      throw new Error('expected deleted result');
    }
    expectNoSensitiveData(result.dto);
    expectStatusCommand(
      harness.hisConnectionRepository.softDeleteHisConnectionForTenant.mock.calls[0]?.[0],
      {
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        actorUserId: 'demo-user-admin',
        reasonCode: 'archive_connection',
      },
    );
    expectAllowedAuditEvent(harness.auditRepository.record.mock.calls[0]?.[0], {
      action: 'delete',
      resourceId: 'his_conn_001',
    });
  });

  it('repository 非 ok 结果写 denied audit reason，并返回稳定 service result', async () => {
    const notFoundHarness = createStatusServiceHarness({ pauseResult: { status: 'not_found' } });
    const invalidTransitionHarness = createStatusServiceHarness({
      resumeResult: { status: 'invalid_state_transition' },
    });
    const validationHarness = createStatusServiceHarness({
      revokeResult: { status: 'validation_failed' },
    });
    const conflictHarness = createStatusServiceHarness({
      softDeleteResult: { status: 'conflict' },
    });

    await expect(
      pauseHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_missing',
        database: notFoundHarness.database,
        hisConnectionRepositoryFactory: notFoundHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: notFoundHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'not_found' });
    expectDeniedAuditEvent(notFoundHarness.auditRepository.record.mock.calls[0]?.[0], {
      action: 'manage_status',
      reason: 'not_found_or_not_owned',
      resourceId: 'his_conn_missing',
    });

    await expect(
      resumeHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_invalid_transition',
        database: invalidTransitionHarness.database,
        hisConnectionRepositoryFactory: invalidTransitionHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: invalidTransitionHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'invalid_transition' });
    expectDeniedAuditEvent(
      invalidTransitionHarness.auditRepository.record.mock.calls[0]?.[0],
      {
        action: 'manage_status',
        reason: 'invalid_transition',
        resourceId: 'his_conn_invalid_transition',
      },
    );

    await expect(
      revokeHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_validation_failed',
        database: validationHarness.database,
        hisConnectionRepositoryFactory: validationHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: validationHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'validation_failed' });
    expectDeniedAuditEvent(validationHarness.auditRepository.record.mock.calls[0]?.[0], {
      action: 'manage_status',
      reason: 'invalid_his_connection_payload',
      resourceId: 'his_conn_validation_failed',
    });

    await expect(
      softDeleteHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_conflict',
        database: conflictHarness.database,
        hisConnectionRepositoryFactory: conflictHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: conflictHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'conflict' });
    expectDeniedAuditEvent(conflictHarness.auditRepository.record.mock.calls[0]?.[0], {
      action: 'delete',
      reason: 'invalid_transition',
      resourceId: 'his_conn_conflict',
    });
  });

  it('repository thrown error 返回 service_unavailable，且不写 denied audit 或泄露异常', async () => {
    const harness = createStatusServiceHarness({
      pauseError: new Error(
        'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg stack constraint',
      ),
    });

    const result = await pauseHisConnectionForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(result).toEqual({ status: 'service_unavailable' });
    expectNoSensitiveData(result);
    expect(harness.auditRepository.record).not.toHaveBeenCalled();
  });

  it('audit 写入失败返回 service_unavailable，且不返回业务成功或原失败结果', async () => {
    const allowedHarness = createStatusServiceHarness({
      auditError: new Error('audit insert failed DATABASE_URL stack'),
    });
    const deniedHarness = createStatusServiceHarness({
      pauseResult: { status: 'conflict' },
      auditError: new Error('audit insert failed DATABASE_URL stack'),
    });

    await expect(
      resumeHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_001',
        database: allowedHarness.database,
        hisConnectionRepositoryFactory: allowedHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: allowedHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'service_unavailable' });
    await expect(
      pauseHisConnectionForTenantService({
        accessContext,
        connectionId: 'his_conn_conflict',
        database: deniedHarness.database,
        hisConnectionRepositoryFactory: deniedHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: deniedHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'service_unavailable' });
    expect(deniedHarness.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'open_connection',
        action: 'manage_status',
        result: 'denied',
        reason: 'invalid_transition',
      }),
    );
  });

  it('缺失可信 tenantId、actorUserId 或 path connectionId 时返回 validation_failed，且不调用 repository 或 audit', async () => {
    const missingTenantHarness = createStatusServiceHarness();
    const missingActorHarness = createStatusServiceHarness();
    const missingConnectionHarness = createStatusServiceHarness();

    await expect(
      pauseHisConnectionForTenantService({
        accessContext: { ...accessContext, tenantId: null },
        connectionId: 'his_conn_001',
        database: missingTenantHarness.database,
        hisConnectionRepositoryFactory: missingTenantHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: missingTenantHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'validation_failed' });
    await expect(
      resumeHisConnectionForTenantService({
        accessContext: { ...accessContext, userId: '   ' },
        connectionId: 'his_conn_001',
        database: missingActorHarness.database,
        hisConnectionRepositoryFactory: missingActorHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: missingActorHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'validation_failed' });
    await expect(
      revokeHisConnectionForTenantService({
        accessContext,
        connectionId: '   ',
        database: missingConnectionHarness.database,
        hisConnectionRepositoryFactory: missingConnectionHarness.hisConnectionRepositoryFactory,
        auditEventRepositoryFactory: missingConnectionHarness.auditEventRepositoryFactory,
      }),
    ).resolves.toEqual({ status: 'validation_failed' });

    for (const harness of [missingTenantHarness, missingActorHarness, missingConnectionHarness]) {
      expect(harness.database.transaction).not.toHaveBeenCalled();
      expect(harness.hisConnectionRepositoryFactory).not.toHaveBeenCalled();
      expect(harness.auditEventRepositoryFactory).not.toHaveBeenCalled();
      expect(harness.auditRepository.record).not.toHaveBeenCalled();
    }
  });

  it('service 不调用权限判断、fetch、localStorage、真实 HIS、凭证处理、机构系统、企微、AI、治疗摘要、随访任务或自动触达', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const localStorage = {
      clear: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorage);
    const harness = createStatusServiceHarness();

    await softDeleteHisConnectionForTenantService({
      accessContext,
      connectionId: 'his_conn_001',
      database: harness.database,
      hisConnectionRepositoryFactory: harness.hisConnectionRepositoryFactory,
      auditEventRepositoryFactory: harness.auditEventRepositoryFactory,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();

    const source = readFileSync(
      join(process.cwd(), 'src/modules/institution/server/his-connection-status-service.ts'),
      'utf8',
    );

    expect(source).not.toMatch(
      /fetch|localStorage|canAccessResource|Request|request\.json|headers|query|credentialRef|credentialConfigured|rawPayload|raw HIS|DATABASE_URL|treatmentSummary|treatment-summary|followUp|follow-up|follow_up|企业微信|企微|\bAI\b|\bRAG\b|\bAgent\b|自动触达|真实 HIS|测试连接/i,
    );
  });
});

describe('W6A default Writer construction', () => {
  it('uses server orchestration for the default Writer', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/modules/institution/server/his-connection-status-service.ts'),
      'utf8',
    );
    expect(source).toContain("@/server/orchestration/his-connection-writer");
    expect(source).toContain('createHisConnectionWriter');
  });
});
