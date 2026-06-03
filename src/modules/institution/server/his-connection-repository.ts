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
export type CreateHisConnectionResult =
  | { status: 'ok'; record: HisConnectionReadModel }
  | { status: 'conflict' }
  | { status: 'validation_failed' };
export type UpdateHisConnectionResult =
  | { status: 'ok'; record: HisConnectionReadModel }
  | { status: 'not_found' }
  | { status: 'conflict' }
  | { status: 'validation_failed' };

const hisConnectionFieldLimits = {
  tenantId: 64,
  connectionId: 64,
  connectionName: 160,
  sourceSystem: 64,
  vendorType: 64,
  systemType: 64,
  actorUserId: 96,
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

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function createSanitizedWriteError(action: 'create' | 'update') {
  return new Error(`Failed to ${action} HIS connection`);
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
