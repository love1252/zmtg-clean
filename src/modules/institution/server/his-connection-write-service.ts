import { createAuditEvent } from '@/modules/audit/domain/audit-events';
import {
  createAuditEventRepository,
  type AuditEventRepository,
} from '@/modules/audit/server/audit-event-repository';
import type { HisConnectionRepository } from '@/modules/institution/server/his-connection-repository';
import { createHisConnectionWriter } from '@/server/orchestration/his-connection-writer';
import type {
  CreateHisConnectionInput,
  UpdateHisConnectionInput,
} from '@/modules/institution/server/his-connection-write-input';
import type { AccessContext } from '@/modules/security/domain/access-control';
import type { TenantDatabase } from '@/server/db/client';

export type HisConnectionWriteSuccessDto = { ok: true };

export type CreateHisConnectionForTenantServiceResult =
  | { status: 'created'; dto: HisConnectionWriteSuccessDto }
  | { status: 'validation_failed' }
  | { status: 'conflict' }
  | { status: 'service_unavailable' };

export type UpdateHisConnectionForTenantServiceResult =
  | { status: 'updated'; dto: HisConnectionWriteSuccessDto }
  | { status: 'validation_failed' }
  | { status: 'conflict' }
  | { status: 'not_found' }
  | { status: 'service_unavailable' };

type HisConnectionWriteServiceDependencies = {
  database: TenantDatabase;
  hisConnectionRepositoryFactory?: (database: TenantDatabase) => HisConnectionWriteRepository;
  auditEventRepositoryFactory?: (database: TenantDatabase) => HisConnectionWriteAuditRepository;
};

type HisConnectionWriteRepository = Pick<
  HisConnectionRepository,
  'createHisConnectionForTenant' | 'updateHisConnectionForTenant'
>;

type HisConnectionWriteAuditRepository = Pick<AuditEventRepository, 'record'>;

export type CreateHisConnectionForTenantServiceInput =
  HisConnectionWriteServiceDependencies & {
    accessContext: AccessContext;
    metadata: CreateHisConnectionInput;
  };

export type UpdateHisConnectionForTenantServiceInput =
  HisConnectionWriteServiceDependencies & {
    accessContext: AccessContext;
    connectionId: string;
    metadata: UpdateHisConnectionInput;
  };

const writeFields = ['connectionName', 'sourceSystem', 'vendorType', 'systemType'] as const;

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

function normalizeTrustedText(value: unknown) {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function pickCreateMetadata(metadata: CreateHisConnectionInput): CreateHisConnectionInput {
  return {
    connectionName: metadata.connectionName,
    sourceSystem: metadata.sourceSystem,
    vendorType: metadata.vendorType,
    systemType: metadata.systemType,
  };
}

function pickUpdateMetadata(metadata: UpdateHisConnectionInput): UpdateHisConnectionInput {
  const values: UpdateHisConnectionInput = {};

  for (const field of writeFields) {
    if (metadata[field] !== undefined) {
      values[field] = metadata[field];
    }
  }

  return values;
}

async function runWriteTransaction<Result>(
  database: TenantDatabase,
  callback: (database: TenantDatabase) => Promise<Result>,
): Promise<Result> {
  return database.transaction(async (transactionDatabase) =>
    callback(transactionDatabase as unknown as TenantDatabase),
  );
}

function createAllowedAuditEvent(input: {
  accessContext: AccessContext;
  tenantId: string;
  actorUserId: string;
  resourceId: string;
  action: 'create' | 'update';
}) {
  return createAuditEvent({
    eventId: createAuditEventId(),
    context: {
      ...input.accessContext,
      tenantId: input.tenantId,
      userId: input.actorUserId,
    },
    resource: 'open_connection',
    resourceId: input.resourceId,
    action: input.action,
    result: 'allowed',
    reason: 'allowed_by_policy',
    occurredAt: new Date().toISOString(),
  });
}

function createDeniedAuditEvent(input: {
  accessContext: AccessContext;
  tenantId: string;
  actorUserId: string;
  resourceId?: string;
  action: 'create' | 'update';
  reason: 'invalid_his_connection_payload' | 'his_connection_name_conflict' | 'not_found_or_not_owned';
}) {
  return createAuditEvent({
    eventId: createAuditEventId(),
    context: {
      ...input.accessContext,
      tenantId: input.tenantId,
      userId: input.actorUserId,
    },
    resource: 'open_connection',
    resourceId: input.resourceId,
    action: input.action,
    result: 'denied',
    reason: input.reason,
    occurredAt: new Date().toISOString(),
  });
}

function createSuccessDto(): HisConnectionWriteSuccessDto {
  return { ok: true };
}

export async function createHisConnectionForTenantService(
  input: CreateHisConnectionForTenantServiceInput,
): Promise<CreateHisConnectionForTenantServiceResult> {
  const tenantId = normalizeTrustedText(input.accessContext.tenantId);
  const actorUserId = normalizeTrustedText(input.accessContext.userId);

  if (!tenantId || !actorUserId) {
    return { status: 'validation_failed' };
  }

  const hisConnectionRepositoryFactory =
    input.hisConnectionRepositoryFactory ?? createHisConnectionWriter;
  const auditEventRepositoryFactory =
    input.auditEventRepositoryFactory ?? createAuditEventRepository;
  const metadata = pickCreateMetadata(input.metadata);

  try {
    return await runWriteTransaction(input.database, async (transactionDatabase) => {
      const hisConnectionRepository = hisConnectionRepositoryFactory(transactionDatabase);
      const auditEventRepository = auditEventRepositoryFactory(transactionDatabase);
      const result = await hisConnectionRepository.createHisConnectionForTenant({
        tenantId,
        actorUserId,
        connectionName: metadata.connectionName,
        sourceSystem: metadata.sourceSystem,
        vendorType: metadata.vendorType,
        systemType: metadata.systemType,
      });

      if (result.status === 'validation_failed') {
        await auditEventRepository.record(
          createDeniedAuditEvent({
            accessContext: input.accessContext,
            tenantId,
            actorUserId,
            action: 'create',
            reason: 'invalid_his_connection_payload',
          }),
        );

        return { status: 'validation_failed' };
      }

      if (result.status === 'conflict') {
        await auditEventRepository.record(
          createDeniedAuditEvent({
            accessContext: input.accessContext,
            tenantId,
            actorUserId,
            action: 'create',
            reason: 'his_connection_name_conflict',
          }),
        );

        return { status: 'conflict' };
      }

      if (result.status !== 'ok') {
        return { status: 'service_unavailable' };
      }

      await auditEventRepository.record(
        createAllowedAuditEvent({
          accessContext: input.accessContext,
          tenantId,
          actorUserId,
          resourceId: result.record.connectionId,
          action: 'create',
        }),
      );

      return { status: 'created', dto: createSuccessDto() };
    });
  } catch {
    return { status: 'service_unavailable' };
  }
}

export async function updateHisConnectionForTenantService(
  input: UpdateHisConnectionForTenantServiceInput,
): Promise<UpdateHisConnectionForTenantServiceResult> {
  const tenantId = normalizeTrustedText(input.accessContext.tenantId);
  const actorUserId = normalizeTrustedText(input.accessContext.userId);
  const connectionId = normalizeTrustedText(input.connectionId);

  if (!tenantId || !actorUserId || !connectionId) {
    return { status: 'validation_failed' };
  }

  const hisConnectionRepositoryFactory =
    input.hisConnectionRepositoryFactory ?? createHisConnectionWriter;
  const auditEventRepositoryFactory =
    input.auditEventRepositoryFactory ?? createAuditEventRepository;
  const values = pickUpdateMetadata(input.metadata);

  try {
    return await runWriteTransaction(input.database, async (transactionDatabase) => {
      const hisConnectionRepository = hisConnectionRepositoryFactory(transactionDatabase);
      const auditEventRepository = auditEventRepositoryFactory(transactionDatabase);
      const result = await hisConnectionRepository.updateHisConnectionForTenant({
        tenantId,
        connectionId,
        actorUserId,
        values,
      });

      if (result.status === 'validation_failed') {
        await auditEventRepository.record(
          createDeniedAuditEvent({
            accessContext: input.accessContext,
            tenantId,
            actorUserId,
            resourceId: connectionId,
            action: 'update',
            reason: 'invalid_his_connection_payload',
          }),
        );

        return { status: 'validation_failed' };
      }

      if (result.status === 'conflict') {
        await auditEventRepository.record(
          createDeniedAuditEvent({
            accessContext: input.accessContext,
            tenantId,
            actorUserId,
            resourceId: connectionId,
            action: 'update',
            reason: 'his_connection_name_conflict',
          }),
        );

        return { status: 'conflict' };
      }

      if (result.status === 'not_found') {
        await auditEventRepository.record(
          createDeniedAuditEvent({
            accessContext: input.accessContext,
            tenantId,
            actorUserId,
            resourceId: connectionId,
            action: 'update',
            reason: 'not_found_or_not_owned',
          }),
        );

        return { status: 'not_found' };
      }

      if (result.status !== 'ok') {
        return { status: 'service_unavailable' };
      }

      await auditEventRepository.record(
        createAllowedAuditEvent({
          accessContext: input.accessContext,
          tenantId,
          actorUserId,
          resourceId: result.record.connectionId,
          action: 'update',
        }),
      );

      return { status: 'updated', dto: createSuccessDto() };
    });
  } catch {
    return { status: 'service_unavailable' };
  }
}
