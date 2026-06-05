import {
  mapHisConnectionCredentialSuccessToDto,
  type HisConnectionCredentialSuccessDto,
} from '@/modules/institution/server/his-connection-credential-dto';
import { createAuditEvent } from '@/modules/audit/domain/audit-events';
import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type {
  HisConnectionCredentialMutationInput,
  HisConnectionCredentialReasonInput,
} from '@/modules/institution/server/his-connection-credential-input';
import type {
  StoreSyntheticCredentialReferenceInput,
  StoreSyntheticCredentialReferenceResult,
} from '@/modules/institution/server/his-connection-credential-storage';
import {
  createHisConnectionRepository,
  type HisConnectionCredentialReferenceResult,
  type HisConnectionRepository,
} from '@/modules/institution/server/his-connection-repository';
import type { AccessContext } from '@/modules/security/domain/access-control';
import type { TenantDatabase } from '@/server/db/client';

export type HisConnectionCredentialServiceSuccessStatus =
  | 'created'
  | 'updated'
  | 'rotated'
  | 'cleared'
  | 'revoked';

export type HisConnectionCredentialServiceFailureStatus =
  | 'validation_failed'
  | 'not_found'
  | 'invalid_state_transition'
  | 'service_unavailable';

export type HisConnectionCredentialServiceResult =
  | {
      status: HisConnectionCredentialServiceSuccessStatus;
      dto: HisConnectionCredentialSuccessDto;
    }
  | { status: HisConnectionCredentialServiceFailureStatus };

type HisConnectionCredentialRepository = Pick<
  HisConnectionRepository,
  | 'setHisConnectionCredentialReferenceForTenant'
  | 'rotateHisConnectionCredentialReferenceForTenant'
  | 'clearHisConnectionCredentialReferenceForTenant'
  | 'revokeHisConnectionCredentialReferenceForTenant'
>;

type HisConnectionCredentialAuditRepository = Pick<AuditEventRepository, 'record'>;

type HisConnectionCredentialStorage = {
  storeSyntheticCredentialReference(
    input: StoreSyntheticCredentialReferenceInput,
  ): Promise<StoreSyntheticCredentialReferenceResult>;
};

type HisConnectionCredentialServiceDependencies = {
  database: TenantDatabase;
  hisConnectionRepository?: HisConnectionCredentialRepository;
  hisConnectionRepositoryFactory?: (database: TenantDatabase) => HisConnectionCredentialRepository;
  auditEventRepository?: HisConnectionCredentialAuditRepository;
  auditEventRepositoryFactory?: (database: TenantDatabase) => HisConnectionCredentialAuditRepository;
};

type HisConnectionCredentialMutationServiceInput =
  HisConnectionCredentialServiceDependencies & {
    accessContext: AccessContext;
    connectionId: string;
    credentialInput: HisConnectionCredentialMutationInput;
    credentialStorage: HisConnectionCredentialStorage;
  };

type HisConnectionCredentialReasonServiceInput =
  HisConnectionCredentialServiceDependencies & {
    accessContext: AccessContext;
    connectionId: string;
    credentialInput: HisConnectionCredentialReasonInput;
  };

function normalizeTrustedText(value: unknown) {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

async function runCredentialTransaction<Result>(
  database: TenantDatabase,
  callback: (database: TenantDatabase) => Promise<Result>,
): Promise<Result> {
  return database.transaction(async (transactionDatabase) =>
    callback(transactionDatabase as unknown as TenantDatabase),
  );
}

function createSuccessResult(
  status: HisConnectionCredentialServiceSuccessStatus,
  credentialConfigured: boolean,
): HisConnectionCredentialServiceResult {
  return {
    status,
    dto: mapHisConnectionCredentialSuccessToDto({ credentialConfigured }),
  };
}

function mapRepositoryResult(
  result: HisConnectionCredentialReferenceResult,
  successStatus: HisConnectionCredentialServiceSuccessStatus,
): HisConnectionCredentialServiceResult {
  if (result.status !== 'ok') {
    return { status: result.status };
  }

  return createSuccessResult(successStatus, result.summary.credentialConfigured);
}

function getRepository(
  input: HisConnectionCredentialServiceDependencies,
  database: TenantDatabase,
): HisConnectionCredentialRepository {
  return (
    input.hisConnectionRepository ??
    (input.hisConnectionRepositoryFactory ?? createHisConnectionRepository)(database)
  );
}

function getAuditRepository(
  input: HisConnectionCredentialServiceDependencies,
  database: TenantDatabase,
): HisConnectionCredentialAuditRepository | null {
  return (
    input.auditEventRepository ??
    input.auditEventRepositoryFactory?.(database) ??
    null
  );
}

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

async function recordAllowedCredentialAudit(input: {
  dependencies: HisConnectionCredentialServiceDependencies;
  database: TenantDatabase;
  accessContext: AccessContext;
  connectionId: string;
}) {
  const auditRepository = getAuditRepository(input.dependencies, input.database);

  if (!auditRepository) {
    return;
  }

  await auditRepository.record(
    createAuditEvent({
      eventId: createAuditEventId(),
      context: input.accessContext,
      resource: 'open_connection',
      resourceId: input.connectionId,
      action: 'manage_credentials',
      result: 'allowed',
      reason: 'allowed_by_policy',
      occurredAt: new Date().toISOString(),
    }),
  );
}

async function storeSyntheticCredentialReference(input: {
  tenantId: string;
  connectionId: string;
  credentialInput: HisConnectionCredentialMutationInput;
  credentialStorage: HisConnectionCredentialStorage;
}) {
  return input.credentialStorage.storeSyntheticCredentialReference({
    tenantId: input.tenantId,
    connectionId: input.connectionId,
    placeholder: input.credentialInput.syntheticPlaceholder,
    idempotencyKey: input.credentialInput.idempotencyKey,
  });
}

async function runStoredCredentialReferenceService(
  input: HisConnectionCredentialMutationServiceInput,
  config: {
    repositoryMethod:
      | 'setHisConnectionCredentialReferenceForTenant'
      | 'rotateHisConnectionCredentialReferenceForTenant';
    successStatus: Extract<
      HisConnectionCredentialServiceSuccessStatus,
      'created' | 'updated' | 'rotated'
    >;
  },
): Promise<HisConnectionCredentialServiceResult> {
  const tenantId = normalizeTrustedText(input.accessContext.tenantId);
  const actorUserId = normalizeTrustedText(input.accessContext.userId);
  const connectionId = normalizeTrustedText(input.connectionId);

  if (!tenantId || !actorUserId || !connectionId) {
    return { status: 'validation_failed' };
  }

  try {
    const stored = await storeSyntheticCredentialReference({
      tenantId,
      connectionId,
      credentialInput: input.credentialInput,
      credentialStorage: input.credentialStorage,
    });

    if (stored.status !== 'stored') {
      return { status: 'validation_failed' };
    }

    return await runCredentialTransaction(input.database, async (transactionDatabase) => {
      const repository = getRepository(input, transactionDatabase);
      const result = await repository[config.repositoryMethod]({
        tenantId,
        connectionId,
        actorUserId,
        credentialRef: stored.credentialRef,
      });

      if (result.status === 'ok') {
        await recordAllowedCredentialAudit({
          dependencies: input,
          database: transactionDatabase,
          accessContext: input.accessContext,
          connectionId,
        });
      }

      return mapRepositoryResult(result, config.successStatus);
    });
  } catch {
    return { status: 'service_unavailable' };
  }
}

async function runClearCredentialReferenceService(
  input: HisConnectionCredentialReasonServiceInput,
  config: {
    repositoryMethod:
      | 'clearHisConnectionCredentialReferenceForTenant'
      | 'revokeHisConnectionCredentialReferenceForTenant';
    successStatus: Extract<HisConnectionCredentialServiceSuccessStatus, 'cleared' | 'revoked'>;
  },
): Promise<HisConnectionCredentialServiceResult> {
  const tenantId = normalizeTrustedText(input.accessContext.tenantId);
  const actorUserId = normalizeTrustedText(input.accessContext.userId);
  const connectionId = normalizeTrustedText(input.connectionId);

  if (!tenantId || !actorUserId || !connectionId) {
    return { status: 'validation_failed' };
  }

  try {
    return await runCredentialTransaction(input.database, async (transactionDatabase) => {
      const repository = getRepository(input, transactionDatabase);
      const result = await repository[config.repositoryMethod]({
        tenantId,
        connectionId,
        actorUserId,
        ...(input.credentialInput.reasonCode === undefined
          ? {}
          : { reasonCode: input.credentialInput.reasonCode }),
      });

      if (result.status === 'ok') {
        await recordAllowedCredentialAudit({
          dependencies: input,
          database: transactionDatabase,
          accessContext: input.accessContext,
          connectionId,
        });
      }

      return mapRepositoryResult(result, config.successStatus);
    });
  } catch {
    return { status: 'service_unavailable' };
  }
}

export async function createHisConnectionCredentialForTenantService(
  input: HisConnectionCredentialMutationServiceInput,
): Promise<HisConnectionCredentialServiceResult> {
  return runStoredCredentialReferenceService(input, {
    repositoryMethod: 'setHisConnectionCredentialReferenceForTenant',
    successStatus: 'created',
  });
}

export async function updateHisConnectionCredentialForTenantService(
  input: HisConnectionCredentialMutationServiceInput,
): Promise<HisConnectionCredentialServiceResult> {
  return runStoredCredentialReferenceService(input, {
    repositoryMethod: 'setHisConnectionCredentialReferenceForTenant',
    successStatus: 'updated',
  });
}

export async function rotateHisConnectionCredentialForTenantService(
  input: HisConnectionCredentialMutationServiceInput,
): Promise<HisConnectionCredentialServiceResult> {
  return runStoredCredentialReferenceService(input, {
    repositoryMethod: 'rotateHisConnectionCredentialReferenceForTenant',
    successStatus: 'rotated',
  });
}

export async function clearHisConnectionCredentialForTenantService(
  input: HisConnectionCredentialReasonServiceInput,
): Promise<HisConnectionCredentialServiceResult> {
  return runClearCredentialReferenceService(input, {
    repositoryMethod: 'clearHisConnectionCredentialReferenceForTenant',
    successStatus: 'cleared',
  });
}

export async function revokeHisConnectionCredentialForTenantService(
  input: HisConnectionCredentialReasonServiceInput,
): Promise<HisConnectionCredentialServiceResult> {
  return runClearCredentialReferenceService(input, {
    repositoryMethod: 'revokeHisConnectionCredentialReferenceForTenant',
    successStatus: 'revoked',
  });
}
