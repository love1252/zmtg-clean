import { and, asc, eq, isNull } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import { hisConnections } from '@/server/db/schema';

type HisConnectionRow = typeof hisConnections.$inferSelect;

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

function isVisibleHisConnectionRow(row: HisConnectionRow, tenantId: string) {
  return row.tenantId === tenantId && row.deletedAt === null;
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
