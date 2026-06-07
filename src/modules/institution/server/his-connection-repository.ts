import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import { hisConnections } from '@/server/db/schema';

type HisConnectionRow = typeof hisConnections.$inferSelect;
type HisConnectionMutableMetadata = Pick<
  HisConnectionRow,
  'connectionName' | 'sourceSystem' | 'vendorType' | 'systemType'
>;

export type HisConnectionReadModel = {
  connectionId: string;
  tenantId: string;
  connectionName: string;
  sourceSystem: string;
  vendorType: string;
  systemType: string;
  status: HisConnectionRow['status'];
  credentialConfigured: boolean;
  healthStatus: HisConnectionRow['healthStatus'];
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  deletedAt: string | null;
};

export type HisConnectionCredentialStatus = 'configured' | 'missing' | 'revoked' | 'deleted';
export type HisConnectionCredentialSummary = {
  connectionId: string;
  tenantId: string;
  status: HisConnectionRow['status'];
  credentialConfigured: boolean;
  credentialStatus: HisConnectionCredentialStatus;
  updatedAt: string;
  revokedAt: string | null;
  deletedAt: string | null;
};
export type HisConnectionLookupInput = {
  tenantId: string;
  connectionId: string;
};
export type CreateHisConnectionForTenantCommand = HisConnectionMutableMetadata & {
  tenantId: string;
  actorUserId: string;
};
export type UpdateHisConnectionValues = Partial<HisConnectionMutableMetadata>;
export type UpdateHisConnectionForTenantCommand = {
  tenantId: string;
  connectionId: string;
  values: UpdateHisConnectionValues;
  actorUserId: string;
};
export type HisConnectionStatusTransitionCommand = {
  tenantId: string;
  connectionId: string;
  actorUserId: string;
  reasonCode?: string;
};
export type HisConnectionCredentialReferenceCommand = HisConnectionLookupInput & {
  actorUserId: string;
  credentialRef: string;
};
export type HisConnectionCredentialClearCommand = HisConnectionLookupInput & {
  actorUserId: string;
  reasonCode?: string;
};
export type HisConnectionHealthErrorCode =
  | 'missing_credential'
  | 'credential_provider_unavailable'
  | 'credential_unavailable'
  | 'credential_revoked'
  | 'provider_timeout'
  | 'external_unreachable'
  | 'external_auth_failed'
  | 'external_rate_limited'
  | 'external_service_unavailable'
  | 'unsupported_vendor'
  | 'unsafe_external_response'
  | 'connection_not_active'
  | 'service_unavailable'
  | 'partial_capability_unavailable'
  | 'provider_retry_succeeded'
  | 'provider_warning'
  | 'limited_health_probe';
export type WriteHisConnectionHealthSummaryForTenantCommand = HisConnectionLookupInput & {
  healthStatus: HisConnectionRow['healthStatus'];
  checkedAt: Date | null;
  lastErrorCode: HisConnectionHealthErrorCode | null;
  actorUserId?: string;
};
export type CreateHisConnectionResult =
  | { status: 'ok'; record: HisConnectionReadModel }
  | { status: 'conflict' }
  | { status: 'validation_failed' };
export type UpdateHisConnectionResult =
  | { status: 'ok'; record: HisConnectionReadModel }
  | { status: 'not_found' }
  | { status: 'conflict' }
  | { status: 'validation_failed' };
export type HisConnectionStatusTransitionResult =
  | { status: 'ok'; record: HisConnectionReadModel }
  | { status: 'not_found' }
  | { status: 'conflict' }
  | { status: 'invalid_state_transition' }
  | { status: 'validation_failed' };
export type HisConnectionCredentialReferenceResult =
  | {
      status: 'ok';
      record: HisConnectionReadModel;
      summary: HisConnectionCredentialSummary;
    }
  | { status: 'not_found' }
  | { status: 'invalid_state_transition' }
  | { status: 'validation_failed' };
export type HisConnectionHealthSummaryWriteResult =
  | { status: 'ok'; record: HisConnectionReadModel }
  | { status: 'not_found' }
  | { status: 'validation_failed' };

const hisConnectionFieldLimits = {
  tenantId: 64,
  connectionId: 64,
  connectionName: 160,
  sourceSystem: 64,
  vendorType: 64,
  systemType: 64,
  actorUserId: 96,
  reasonCode: 96,
  credentialRef: 128,
} as const;

const hisConnectionHealthStatuses = ['unknown', 'healthy', 'degraded', 'failed'] as const;
const allowedHisConnectionHealthErrorCodes = new Set<HisConnectionHealthErrorCode>([
  'missing_credential',
  'credential_provider_unavailable',
  'credential_unavailable',
  'credential_revoked',
  'provider_timeout',
  'external_unreachable',
  'external_auth_failed',
  'external_rate_limited',
  'external_service_unavailable',
  'unsupported_vendor',
  'unsafe_external_response',
  'connection_not_active',
  'service_unavailable',
  'partial_capability_unavailable',
  'provider_retry_succeeded',
  'provider_warning',
  'limited_health_probe',
]);
const safeCredentialRefPattern = /^cred_ref_[a-zA-Z0-9_-]{12,}$/;
const forbiddenCredentialRefPattern =
  /sk_live|sk_test|token|secret|api[_-]?key|connection[_-]?string|password|oauth|basic[_-]?auth|private[_-]?key|raw[_-]?credential|raw[_-]?payload|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack/i;

function isVisibleHisConnectionRow(row: HisConnectionRow, tenantId: string) {
  return row.tenantId === tenantId && row.deletedAt === null;
}

function createHisConnectionId() {
  return `his_conn_${randomUUID()}`;
}

function normalizeRequiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) return null;

  return normalized;
}

function isValidOptionalText(value: unknown, maxLength: number): boolean {
  if (value === undefined) return true;
  return normalizeRequiredText(value, maxLength) !== null;
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function normalizeCredentialRef(value: unknown): string | null {
  const credentialRef = normalizeRequiredText(value, hisConnectionFieldLimits.credentialRef);

  if (!credentialRef) return null;
  if (!safeCredentialRefPattern.test(credentialRef)) return null;
  if (forbiddenCredentialRefPattern.test(credentialRef)) return null;

  return credentialRef;
}

function pickCreateHisConnectionValues(input: CreateHisConnectionForTenantCommand) {
  const tenantId = normalizeRequiredText(input.tenantId, hisConnectionFieldLimits.tenantId);
  const connectionName = normalizeRequiredText(
    input.connectionName,
    hisConnectionFieldLimits.connectionName,
  );
  const sourceSystem = normalizeRequiredText(input.sourceSystem, hisConnectionFieldLimits.sourceSystem);
  const vendorType = normalizeRequiredText(input.vendorType, hisConnectionFieldLimits.vendorType);
  const systemType = normalizeRequiredText(input.systemType, hisConnectionFieldLimits.systemType);
  const actorUserId = normalizeRequiredText(input.actorUserId, hisConnectionFieldLimits.actorUserId);

  if (!tenantId || !connectionName || !sourceSystem || !vendorType || !systemType || !actorUserId) {
    return null;
  }

  return {
    tenantId,
    connectionName,
    sourceSystem,
    vendorType,
    systemType,
    actorUserId,
  };
}

function pickUpdateHisConnectionValues(values: UpdateHisConnectionValues) {
  const picked: Partial<HisConnectionMutableMetadata> = {};

  if (values.connectionName !== undefined) {
    const connectionName = normalizeRequiredText(
      values.connectionName,
      hisConnectionFieldLimits.connectionName,
    );
    if (!connectionName) return null;
    picked.connectionName = connectionName;
  }

  if (values.sourceSystem !== undefined) {
    const sourceSystem = normalizeRequiredText(values.sourceSystem, hisConnectionFieldLimits.sourceSystem);
    if (!sourceSystem) return null;
    picked.sourceSystem = sourceSystem;
  }

  if (values.vendorType !== undefined) {
    const vendorType = normalizeRequiredText(values.vendorType, hisConnectionFieldLimits.vendorType);
    if (!vendorType) return null;
    picked.vendorType = vendorType;
  }

  if (values.systemType !== undefined) {
    const systemType = normalizeRequiredText(values.systemType, hisConnectionFieldLimits.systemType);
    if (!systemType) return null;
    picked.systemType = systemType;
  }

  return Object.keys(picked).length > 0 ? picked : null;
}

function pickStatusTransitionCommand(input: HisConnectionStatusTransitionCommand) {
  const tenantId = normalizeRequiredText(input.tenantId, hisConnectionFieldLimits.tenantId);
  const connectionId = normalizeRequiredText(
    input.connectionId,
    hisConnectionFieldLimits.connectionId,
  );
  const actorUserId = normalizeRequiredText(
    input.actorUserId,
    hisConnectionFieldLimits.actorUserId,
  );
  const reasonCodeIsValid = isValidOptionalText(
    input.reasonCode,
    hisConnectionFieldLimits.reasonCode,
  );

  if (!tenantId || !connectionId || !actorUserId || !reasonCodeIsValid) {
    return null;
  }

  return {
    tenantId,
    connectionId,
    actorUserId,
  };
}

function pickCredentialReferenceCommand(input: HisConnectionCredentialReferenceCommand) {
  const tenantId = normalizeRequiredText(input.tenantId, hisConnectionFieldLimits.tenantId);
  const connectionId = normalizeRequiredText(
    input.connectionId,
    hisConnectionFieldLimits.connectionId,
  );
  const actorUserId = normalizeRequiredText(
    input.actorUserId,
    hisConnectionFieldLimits.actorUserId,
  );
  const credentialRef = normalizeCredentialRef(input.credentialRef);

  if (!tenantId || !connectionId || !actorUserId || !credentialRef) {
    return null;
  }

  return {
    tenantId,
    connectionId,
    actorUserId,
    credentialRef,
  };
}

function pickCredentialClearCommand(input: HisConnectionCredentialClearCommand) {
  const tenantId = normalizeRequiredText(input.tenantId, hisConnectionFieldLimits.tenantId);
  const connectionId = normalizeRequiredText(
    input.connectionId,
    hisConnectionFieldLimits.connectionId,
  );
  const actorUserId = normalizeRequiredText(
    input.actorUserId,
    hisConnectionFieldLimits.actorUserId,
  );
  const reasonCodeIsValid = isValidOptionalText(
    input.reasonCode,
    hisConnectionFieldLimits.reasonCode,
  );

  if (!tenantId || !connectionId || !actorUserId || !reasonCodeIsValid) {
    return null;
  }

  return {
    tenantId,
    connectionId,
    actorUserId,
  };
}

function isHisConnectionHealthStatus(value: unknown): value is HisConnectionRow['healthStatus'] {
  return (
    typeof value === 'string' &&
    hisConnectionHealthStatuses.includes(value as (typeof hisConnectionHealthStatuses)[number])
  );
}

function isHisConnectionHealthErrorCode(value: unknown): value is HisConnectionHealthErrorCode {
  return (
    typeof value === 'string' &&
    allowedHisConnectionHealthErrorCodes.has(value as HisConnectionHealthErrorCode)
  );
}

function pickHealthSummaryCommand(input: WriteHisConnectionHealthSummaryForTenantCommand) {
  const tenantId = normalizeRequiredText(input.tenantId, hisConnectionFieldLimits.tenantId);
  const connectionId = normalizeRequiredText(
    input.connectionId,
    hisConnectionFieldLimits.connectionId,
  );
  const actorUserId =
    input.actorUserId === undefined
      ? undefined
      : normalizeRequiredText(input.actorUserId, hisConnectionFieldLimits.actorUserId);

  if (
    !tenantId ||
    !connectionId ||
    !isHisConnectionHealthStatus(input.healthStatus) ||
    (input.actorUserId !== undefined && !actorUserId)
  ) {
    return null;
  }

  if (input.healthStatus === 'unknown') {
    if (input.checkedAt !== null || input.lastErrorCode !== null) return null;

    return {
      tenantId,
      connectionId,
      healthStatus: input.healthStatus,
      checkedAt: null,
      lastErrorCode: null,
      actorUserId,
    };
  }

  if (!isValidDate(input.checkedAt)) {
    return null;
  }

  if (input.healthStatus === 'healthy') {
    if (input.lastErrorCode !== null) return null;

    return {
      tenantId,
      connectionId,
      healthStatus: input.healthStatus,
      checkedAt: input.checkedAt,
      lastErrorCode: null,
      actorUserId,
    };
  }

  if (!isHisConnectionHealthErrorCode(input.lastErrorCode)) {
    return null;
  }

  return {
    tenantId,
    connectionId,
    healthStatus: input.healthStatus,
    checkedAt: input.checkedAt,
    lastErrorCode: input.lastErrorCode,
    actorUserId,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function createSanitizedWriteError(
  action:
    | 'create'
    | 'update'
    | 'change status'
    | 'change credential reference'
    | 'write health summary',
) {
  if (action === 'write health summary') {
    return new Error('Failed to write HIS connection health summary');
  }

  return new Error(`Failed to ${action} HIS connection`);
}

async function findVisibleHisConnectionRowByTenant(
  database: TenantDatabase,
  input: HisConnectionLookupInput,
): Promise<HisConnectionRow | null> {
  const rows = await database
    .select()
    .from(hisConnections)
    .where(
      and(
        eq(hisConnections.tenantId, input.tenantId),
        eq(hisConnections.id, input.connectionId),
        isNull(hisConnections.deletedAt),
      ),
    );

  return (
    rows.find(
      (candidate) =>
        candidate.id === input.connectionId &&
        isVisibleHisConnectionRow(candidate, input.tenantId),
    ) ?? null
  );
}

type StatusTransitionDecision =
  | {
      status: 'ok';
      nextStatus: HisConnectionRow['status'];
      setRevokedAt?: boolean;
      setDeletedAt?: boolean;
    }
  | { status: 'conflict' | 'invalid_state_transition' };

function decidePauseTransition(currentStatus: HisConnectionRow['status']): StatusTransitionDecision {
  if (currentStatus === 'active' || currentStatus === 'error') {
    return { status: 'ok', nextStatus: 'paused' };
  }

  if (currentStatus === 'paused') {
    return { status: 'conflict' };
  }

  return { status: 'invalid_state_transition' };
}

function decideResumeTransition(currentStatus: HisConnectionRow['status']): StatusTransitionDecision {
  if (currentStatus === 'paused') {
    return { status: 'ok', nextStatus: 'active' };
  }

  if (currentStatus === 'active') {
    return { status: 'conflict' };
  }

  return { status: 'invalid_state_transition' };
}

function decideRevokeTransition(currentStatus: HisConnectionRow['status']): StatusTransitionDecision {
  if (
    currentStatus === 'draft' ||
    currentStatus === 'active' ||
    currentStatus === 'paused' ||
    currentStatus === 'error'
  ) {
    return { status: 'ok', nextStatus: 'revoked', setRevokedAt: true };
  }

  if (currentStatus === 'revoked') {
    return { status: 'conflict' };
  }

  return { status: 'invalid_state_transition' };
}

function decideSoftDeleteTransition(
  currentStatus: HisConnectionRow['status'],
): StatusTransitionDecision {
  if (
    currentStatus === 'draft' ||
    currentStatus === 'active' ||
    currentStatus === 'paused' ||
    currentStatus === 'revoked' ||
    currentStatus === 'error'
  ) {
    return { status: 'ok', nextStatus: 'deleted', setDeletedAt: true };
  }

  if (currentStatus === 'deleted') {
    return { status: 'conflict' };
  }

  return { status: 'invalid_state_transition' };
}

async function updateHisConnectionStatusForTenant(
  database: TenantDatabase,
  input: HisConnectionStatusTransitionCommand,
  decideTransition: (currentStatus: HisConnectionRow['status']) => StatusTransitionDecision,
): Promise<HisConnectionStatusTransitionResult> {
  const command = pickStatusTransitionCommand(input);

  if (!command) {
    return { status: 'validation_failed' };
  }

  const currentRow = await findVisibleHisConnectionRowByTenant(database, {
    tenantId: command.tenantId,
    connectionId: command.connectionId,
  });

  if (!currentRow) {
    return { status: 'not_found' };
  }

  const decision = decideTransition(currentRow.status);

  if (decision.status !== 'ok') {
    return { status: decision.status };
  }

  const now = new Date();
  const values: Partial<typeof hisConnections.$inferInsert> = {
    status: decision.nextStatus,
    updatedAt: now,
    updatedBy: command.actorUserId,
  };

  if (decision.setRevokedAt) {
    values.revokedAt = now;
  }

  if (decision.setDeletedAt) {
    values.deletedAt = now;
  }

  try {
    const [row] = await database
      .update(hisConnections)
      .set(values)
      .where(
        and(
          eq(hisConnections.tenantId, command.tenantId),
          eq(hisConnections.id, command.connectionId),
          isNull(hisConnections.deletedAt),
        ),
      )
      .returning();

    if (!row || row.id !== command.connectionId || row.tenantId !== command.tenantId) {
      return { status: 'not_found' };
    }

    if (decision.nextStatus !== 'deleted' && row.deletedAt !== null) {
      return { status: 'not_found' };
    }

    return { status: 'ok', record: mapHisConnectionRowToReadModel(row) };
  } catch {
    throw createSanitizedWriteError('change status');
  }
}

function getHisConnectionCredentialStatus(row: HisConnectionRow): HisConnectionCredentialStatus {
  if (row.deletedAt !== null || row.status === 'deleted') return 'deleted';
  if (row.revokedAt !== null || row.status === 'revoked') return 'revoked';

  return row.credentialRef === null ? 'missing' : 'configured';
}

function isHisConnectionCredentialConfigured(row: HisConnectionRow): boolean {
  return getHisConnectionCredentialStatus(row) === 'configured';
}

function canSetHisConnectionCredentialReference(row: HisConnectionRow): boolean {
  return row.deletedAt === null && row.status !== 'deleted' && row.status !== 'revoked';
}

export function mapHisConnectionRowToCredentialSummary(
  row: HisConnectionRow,
): HisConnectionCredentialSummary {
  return {
    connectionId: row.id,
    tenantId: row.tenantId,
    status: row.status,
    credentialConfigured: isHisConnectionCredentialConfigured(row),
    credentialStatus: getHisConnectionCredentialStatus(row),
    updatedAt: row.updatedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export function mapHisConnectionRowToReadModel(row: HisConnectionRow): HisConnectionReadModel {
  return {
    connectionId: row.id,
    tenantId: row.tenantId,
    connectionName: row.connectionName,
    sourceSystem: row.sourceSystem,
    vendorType: row.vendorType,
    systemType: row.systemType,
    status: row.status,
    credentialConfigured: isHisConnectionCredentialConfigured(row),
    healthStatus: row.healthStatus,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastErrorCode: row.lastErrorCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

async function updateHisConnectionCredentialReferenceForTenant(
  database: TenantDatabase,
  input: HisConnectionCredentialReferenceCommand,
): Promise<HisConnectionCredentialReferenceResult> {
  const command = pickCredentialReferenceCommand(input);

  if (!command) {
    return { status: 'validation_failed' };
  }

  const currentRow = await findVisibleHisConnectionRowByTenant(database, {
    tenantId: command.tenantId,
    connectionId: command.connectionId,
  });

  if (!currentRow) {
    return { status: 'not_found' };
  }

  if (!canSetHisConnectionCredentialReference(currentRow)) {
    return { status: 'invalid_state_transition' };
  }

  try {
    const [row] = await database
      .update(hisConnections)
      .set({
        credentialRef: command.credentialRef,
        updatedAt: new Date(),
        updatedBy: command.actorUserId,
      })
      .where(
        and(
          eq(hisConnections.tenantId, command.tenantId),
          eq(hisConnections.id, command.connectionId),
          isNull(hisConnections.deletedAt),
        ),
      )
      .returning();

    if (!row || row.id !== command.connectionId || !isVisibleHisConnectionRow(row, command.tenantId)) {
      return { status: 'not_found' };
    }

    return {
      status: 'ok',
      record: mapHisConnectionRowToReadModel(row),
      summary: mapHisConnectionRowToCredentialSummary(row),
    };
  } catch {
    throw createSanitizedWriteError('change credential reference');
  }
}

async function clearHisConnectionCredentialReferenceForTenantInDatabase(
  database: TenantDatabase,
  input: HisConnectionCredentialClearCommand,
): Promise<HisConnectionCredentialReferenceResult> {
  const command = pickCredentialClearCommand(input);

  if (!command) {
    return { status: 'validation_failed' };
  }

  const currentRow = await findVisibleHisConnectionRowByTenant(database, {
    tenantId: command.tenantId,
    connectionId: command.connectionId,
  });

  if (!currentRow) {
    return { status: 'not_found' };
  }

  try {
    const [row] = await database
      .update(hisConnections)
      .set({
        credentialRef: null,
        updatedAt: new Date(),
        updatedBy: command.actorUserId,
      })
      .where(
        and(
          eq(hisConnections.tenantId, command.tenantId),
          eq(hisConnections.id, command.connectionId),
          isNull(hisConnections.deletedAt),
        ),
      )
      .returning();

    if (!row || row.id !== command.connectionId || !isVisibleHisConnectionRow(row, command.tenantId)) {
      return { status: 'not_found' };
    }

    return {
      status: 'ok',
      record: mapHisConnectionRowToReadModel(row),
      summary: mapHisConnectionRowToCredentialSummary(row),
    };
  } catch {
    throw createSanitizedWriteError('change credential reference');
  }
}

export function createHisConnectionRepository(database: TenantDatabase) {
  return {
    async createHisConnectionForTenant(
      input: CreateHisConnectionForTenantCommand,
    ): Promise<CreateHisConnectionResult> {
      const values = pickCreateHisConnectionValues(input);

      if (!values) {
        return { status: 'validation_failed' };
      }

      const now = new Date();

      try {
        const [row] = await database
          .insert(hisConnections)
          .values({
            id: createHisConnectionId(),
            tenantId: values.tenantId,
            connectionName: values.connectionName,
            sourceSystem: values.sourceSystem,
            vendorType: values.vendorType,
            systemType: values.systemType,
            status: 'draft',
            healthStatus: 'unknown',
            createdAt: now,
            updatedAt: now,
            createdBy: values.actorUserId,
            updatedBy: values.actorUserId,
          })
          .returning();

        if (!row || !isVisibleHisConnectionRow(row, values.tenantId)) {
          throw createSanitizedWriteError('create');
        }

        return { status: 'ok', record: mapHisConnectionRowToReadModel(row) };
      } catch (error) {
        if (isUniqueViolation(error)) {
          return { status: 'conflict' };
        }

        throw createSanitizedWriteError('create');
      }
    },

    async updateHisConnectionForTenant(
      input: UpdateHisConnectionForTenantCommand,
    ): Promise<UpdateHisConnectionResult> {
      const tenantId = normalizeRequiredText(input.tenantId, hisConnectionFieldLimits.tenantId);
      const connectionId = normalizeRequiredText(
        input.connectionId,
        hisConnectionFieldLimits.connectionId,
      );
      const actorUserId = normalizeRequiredText(
        input.actorUserId,
        hisConnectionFieldLimits.actorUserId,
      );
      const values = pickUpdateHisConnectionValues(input.values);

      if (!tenantId || !connectionId || !actorUserId || !values) {
        return { status: 'validation_failed' };
      }

      try {
        const [row] = await database
          .update(hisConnections)
          .set({
            ...values,
            updatedAt: new Date(),
            updatedBy: actorUserId,
          })
          .where(
            and(
              eq(hisConnections.tenantId, tenantId),
              eq(hisConnections.id, connectionId),
              isNull(hisConnections.deletedAt),
            ),
          )
          .returning();

        if (!row || row.id !== connectionId || !isVisibleHisConnectionRow(row, tenantId)) {
          return { status: 'not_found' };
        }

        return { status: 'ok', record: mapHisConnectionRowToReadModel(row) };
      } catch (error) {
        if (isUniqueViolation(error)) {
          return { status: 'conflict' };
        }

        throw createSanitizedWriteError('update');
      }
    },

    async writeHisConnectionHealthSummaryForTenant(
      input: WriteHisConnectionHealthSummaryForTenantCommand,
    ): Promise<HisConnectionHealthSummaryWriteResult> {
      const command = pickHealthSummaryCommand(input);

      if (!command) {
        return { status: 'validation_failed' };
      }

      const values: Partial<typeof hisConnections.$inferInsert> = {
        healthStatus: command.healthStatus,
        lastCheckedAt: command.checkedAt,
        lastErrorCode: command.lastErrorCode,
        updatedAt: new Date(),
      };

      if (command.actorUserId !== undefined) {
        values.updatedBy = command.actorUserId;
      }

      try {
        const [row] = await database
          .update(hisConnections)
          .set(values)
          .where(
            and(
              eq(hisConnections.tenantId, command.tenantId),
              eq(hisConnections.id, command.connectionId),
              isNull(hisConnections.deletedAt),
            ),
          )
          .returning();

        if (
          !row ||
          row.id !== command.connectionId ||
          !isVisibleHisConnectionRow(row, command.tenantId)
        ) {
          return { status: 'not_found' };
        }

        return { status: 'ok', record: mapHisConnectionRowToReadModel(row) };
      } catch {
        throw createSanitizedWriteError('write health summary');
      }
    },

    async pauseHisConnectionForTenant(
      input: HisConnectionStatusTransitionCommand,
    ): Promise<HisConnectionStatusTransitionResult> {
      return updateHisConnectionStatusForTenant(database, input, decidePauseTransition);
    },

    async resumeHisConnectionForTenant(
      input: HisConnectionStatusTransitionCommand,
    ): Promise<HisConnectionStatusTransitionResult> {
      return updateHisConnectionStatusForTenant(database, input, decideResumeTransition);
    },

    async revokeHisConnectionForTenant(
      input: HisConnectionStatusTransitionCommand,
    ): Promise<HisConnectionStatusTransitionResult> {
      return updateHisConnectionStatusForTenant(database, input, decideRevokeTransition);
    },

    async softDeleteHisConnectionForTenant(
      input: HisConnectionStatusTransitionCommand,
    ): Promise<HisConnectionStatusTransitionResult> {
      return updateHisConnectionStatusForTenant(database, input, decideSoftDeleteTransition);
    },

    async setHisConnectionCredentialReferenceForTenant(
      input: HisConnectionCredentialReferenceCommand,
    ): Promise<HisConnectionCredentialReferenceResult> {
      return updateHisConnectionCredentialReferenceForTenant(database, input);
    },

    async rotateHisConnectionCredentialReferenceForTenant(
      input: HisConnectionCredentialReferenceCommand,
    ): Promise<HisConnectionCredentialReferenceResult> {
      return updateHisConnectionCredentialReferenceForTenant(database, input);
    },

    async clearHisConnectionCredentialReferenceForTenant(
      input: HisConnectionCredentialClearCommand,
    ): Promise<HisConnectionCredentialReferenceResult> {
      return clearHisConnectionCredentialReferenceForTenantInDatabase(database, input);
    },

    async revokeHisConnectionCredentialReferenceForTenant(
      input: HisConnectionCredentialClearCommand,
    ): Promise<HisConnectionCredentialReferenceResult> {
      return clearHisConnectionCredentialReferenceForTenantInDatabase(database, input);
    },

    async listHisConnectionsByTenant(tenantId: string): Promise<HisConnectionReadModel[]> {
      const rows = await database
        .select()
        .from(hisConnections)
        .where(and(eq(hisConnections.tenantId, tenantId), isNull(hisConnections.deletedAt)))
        .orderBy(asc(hisConnections.connectionName), asc(hisConnections.id));

      return rows
        .filter((row) => isVisibleHisConnectionRow(row, tenantId))
        .map(mapHisConnectionRowToReadModel);
    },

    async getHisConnectionByTenant(
      input: HisConnectionLookupInput,
    ): Promise<HisConnectionReadModel | null> {
      const rows = await database
        .select()
        .from(hisConnections)
        .where(
          and(
            eq(hisConnections.tenantId, input.tenantId),
            eq(hisConnections.id, input.connectionId),
            isNull(hisConnections.deletedAt),
          ),
        );

      const row = rows.find(
        (candidate) =>
          candidate.id === input.connectionId &&
          isVisibleHisConnectionRow(candidate, input.tenantId),
      );

      return row ? mapHisConnectionRowToReadModel(row) : null;
    },

    async getHisConnectionCredentialSummaryByTenant(
      input: HisConnectionLookupInput,
    ): Promise<HisConnectionCredentialSummary | null> {
      const row = await findVisibleHisConnectionRowByTenant(database, input);

      return row ? mapHisConnectionRowToCredentialSummary(row) : null;
    },
  };
}

export type HisConnectionRepository = ReturnType<typeof createHisConnectionRepository>;
