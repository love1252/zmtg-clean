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
import type {
  HisConnectionRepository,
  HisConnectionStatusTransitionResult,
} from '@/modules/institution/server/his-connection-repository';
import { createHisConnectionWriter } from '@/server/orchestration/his-connection-writer';
import type { AccessContext, ProtectedAction } from '@/modules/security/domain/access-control';
import type { TenantDatabase } from '@/server/db/client';

export type HisConnectionStatusSuccessDto = { ok: true };

export type HisConnectionStatusServiceResult =
  | { status: 'paused'; dto: HisConnectionStatusSuccessDto }
  | { status: 'resumed'; dto: HisConnectionStatusSuccessDto }
  | { status: 'revoked'; dto: HisConnectionStatusSuccessDto }
  | { status: 'deleted'; dto: HisConnectionStatusSuccessDto }
  | { status: 'validation_failed' }
  | { status: 'not_found' }
  | { status: 'conflict' }
  | { status: 'invalid_transition' }
  | { status: 'service_unavailable' };

type HisConnectionStatusRepository = Pick<
  HisConnectionRepository,
  | 'pauseHisConnectionForTenant'
  | 'resumeHisConnectionForTenant'
  | 'revokeHisConnectionForTenant'
  | 'softDeleteHisConnectionForTenant'
>;

type HisConnectionStatusAuditRepository = Pick<AuditEventRepository, 'recordAttributed'>;

type HisConnectionStatusServiceDependencies = {
  database: TenantDatabase;
  hisConnectionRepository?: HisConnectionStatusRepository;
  hisConnectionRepositoryFactory?: (database: TenantDatabase) => HisConnectionStatusRepository;
  auditEventRepository?: HisConnectionStatusAuditRepository;
  auditEventRepositoryFactory?: (database: TenantDatabase) => HisConnectionStatusAuditRepository;
};

type HisConnectionStatusServiceInput = HisConnectionStatusServiceDependencies & {
  accessContext: AccessContext;
  connectionId: string;
  reasonCode?: string;
};

type StatusOperationConfig = {
  repositoryMethod: keyof HisConnectionStatusRepository;
  successStatus: Extract<
    HisConnectionStatusServiceResult,
    { dto: HisConnectionStatusSuccessDto }
  >['status'];
  auditAction: Extract<ProtectedAction, 'manage_status' | 'delete'>;
};

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

function createNotApplicableAuditEvent(event: TenantAuditEvent): AttributedTenantAuditEventV1 {
  const attributedEvent = createAttributedTenantAuditEventV1({
    event,
    attribution: {
      institutionAttribution: 'not_applicable',
      tenantId: event.tenantId,
      institutionId: null,
    },
  });
  if (!attributedEvent) throw new Error('invalid_his_connection_status_audit_attribution');
  return attributedEvent;
}

function normalizeOptionalText(value: unknown) {
  if (value === undefined) return undefined;

  return normalizeTrustedText(value) ?? undefined;
}

async function runStatusTransaction<Result>(
  database: TenantDatabase,
  callback: (database: TenantDatabase) => Promise<Result>,
): Promise<Result> {
  return database.transaction(async (transactionDatabase) =>
    callback(transactionDatabase as unknown as TenantDatabase),
  );
}

function createStatusAuditEvent(input: {
  accessContext: AccessContext;
  tenantId: string;
  actorUserId: string;
  connectionId: string;
  action: Extract<ProtectedAction, 'manage_status' | 'delete'>;
  result: 'allowed' | 'denied';
  reason: AuditReason;
}) {
  return createNotApplicableAuditEvent(createAuditEvent({
    eventId: createAuditEventId(),
    context: {
      ...input.accessContext,
      tenantId: input.tenantId,
      userId: input.actorUserId,
    },
    resource: 'open_connection',
    resourceId: input.connectionId,
    action: input.action,
    result: input.result,
    reason: input.reason,
    occurredAt: new Date().toISOString(),
  }));
}

function createSuccessDto(): HisConnectionStatusSuccessDto {
  return { ok: true };
}

function mapRepositoryFailureResult(
  result: Exclude<HisConnectionStatusTransitionResult, { status: 'ok' }>,
): Exclude<HisConnectionStatusServiceResult, { dto: HisConnectionStatusSuccessDto }> {
  if (result.status === 'invalid_state_transition') {
    return { status: 'invalid_transition' };
  }

  return { status: result.status };
}

function mapRepositoryFailureReason(
  result: Exclude<HisConnectionStatusTransitionResult, { status: 'ok' }>,
): Extract<AuditReason, 'not_found_or_not_owned' | 'invalid_transition' | 'invalid_his_connection_payload'> {
  if (result.status === 'not_found') return 'not_found_or_not_owned';
  if (result.status === 'validation_failed') return 'invalid_his_connection_payload';

  return 'invalid_transition';
}

async function runHisConnectionStatusService(
  input: HisConnectionStatusServiceInput,
  config: StatusOperationConfig,
): Promise<HisConnectionStatusServiceResult> {
  const tenantId = normalizeTrustedText(input.accessContext.tenantId);
  const actorUserId = normalizeTrustedText(input.accessContext.userId);
  const connectionId = normalizeTrustedText(input.connectionId);
  const reasonCode = normalizeOptionalText(input.reasonCode);

  if (!tenantId || !actorUserId || !connectionId) {
    return { status: 'validation_failed' };
  }

  const hisConnectionRepositoryFactory =
    input.hisConnectionRepositoryFactory ?? createHisConnectionWriter;
  const auditEventRepositoryFactory =
    input.auditEventRepositoryFactory ?? createAuditEventRepository;

  try {
    return await runStatusTransaction(input.database, async (transactionDatabase) => {
      const hisConnectionRepository =
        input.hisConnectionRepository ?? hisConnectionRepositoryFactory(transactionDatabase);
      const auditEventRepository =
        input.auditEventRepository ?? auditEventRepositoryFactory(transactionDatabase);
      const command = {
        tenantId,
        connectionId,
        actorUserId,
        ...(reasonCode === undefined ? {} : { reasonCode }),
      };
      const result = await hisConnectionRepository[config.repositoryMethod](command);

      if (result.status !== 'ok') {
        await auditEventRepository.recordAttributed(
          createStatusAuditEvent({
            accessContext: input.accessContext,
            tenantId,
            actorUserId,
            connectionId,
            action: config.auditAction,
            result: 'denied',
            reason: mapRepositoryFailureReason(result),
          }),
        );

        return mapRepositoryFailureResult(result);
      }

      await auditEventRepository.recordAttributed(
        createStatusAuditEvent({
          accessContext: input.accessContext,
          tenantId,
          actorUserId,
          connectionId,
          action: config.auditAction,
          result: 'allowed',
          reason: 'allowed_by_policy',
        }),
      );

      return { status: config.successStatus, dto: createSuccessDto() };
    });
  } catch {
    return { status: 'service_unavailable' };
  }
}

export async function pauseHisConnectionForTenantService(
  input: HisConnectionStatusServiceInput,
): Promise<HisConnectionStatusServiceResult> {
  return runHisConnectionStatusService(input, {
    repositoryMethod: 'pauseHisConnectionForTenant',
    successStatus: 'paused',
    auditAction: 'manage_status',
  });
}

export async function resumeHisConnectionForTenantService(
  input: HisConnectionStatusServiceInput,
): Promise<HisConnectionStatusServiceResult> {
  return runHisConnectionStatusService(input, {
    repositoryMethod: 'resumeHisConnectionForTenant',
    successStatus: 'resumed',
    auditAction: 'manage_status',
  });
}

export async function revokeHisConnectionForTenantService(
  input: HisConnectionStatusServiceInput,
): Promise<HisConnectionStatusServiceResult> {
  return runHisConnectionStatusService(input, {
    repositoryMethod: 'revokeHisConnectionForTenant',
    successStatus: 'revoked',
    auditAction: 'manage_status',
  });
}

export async function softDeleteHisConnectionForTenantService(
  input: HisConnectionStatusServiceInput,
): Promise<HisConnectionStatusServiceResult> {
  return runHisConnectionStatusService(input, {
    repositoryMethod: 'softDeleteHisConnectionForTenant',
    successStatus: 'deleted',
    auditAction: 'delete',
  });
}
