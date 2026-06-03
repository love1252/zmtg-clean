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

const hisConnectionFieldLimits = {
  tenantId: 64,
  connectionId: 64,
  connectionName: 160,
  sourceSystem: 64,
  vendorType: 64,
  systemType: 64,
  actorUserId: 96,
  reasonCode: 96,
} as const;

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

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function createSanitizedWriteError(action: 'create' | 'update' | 'change status') {
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

export function mapHisConnectionRowToReadModel(row: HisConnectionRow): HisConnectionReadModel {
  return {
    connectionId: row.id,
    tenantId: row.tenantId,
    connectionName: row.connectionName,
    sourceSystem: row.sourceSystem,
    vendorType: row.vendorType,
    systemType: row.systemType,
    status: row.status,
    credentialConfigured: row.credentialRef !== null,
    healthStatus: row.healthStatus,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastErrorCode: row.lastErrorCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
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
  };
}

export type HisConnectionRepository = ReturnType<typeof createHisConnectionRepository>;
