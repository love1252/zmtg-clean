import { eq } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import { platformAiModelConfigSnapshots } from '@/server/db/schema';
import {
  platformAiModelConfigSnapshotId,
} from './platformAiModelConfigPersistence';
import type {
  PlatformAiModelConfigDryRunResult,
  PlatformAiModelConfigModelState,
  PlatformAiModelConfigProviderState,
  PlatformAiModelConfigScenarioDefaultPatch,
  PlatformAiModelConfigSnapshotRecord,
  PlatformAiModelConfigSnapshotUpsertInput,
} from './platformAiModelConfigPersistenceTypes';

type SnapshotRow = typeof platformAiModelConfigSnapshots.$inferSelect;

function mapSnapshotRow(row: SnapshotRow): PlatformAiModelConfigSnapshotRecord {
  return {
    id: row.id,
    scenarioDefaults: row.scenarioDefaults as PlatformAiModelConfigScenarioDefaultPatch[],
    agentInheritance: row.agentInheritance as PlatformAiModelConfigSnapshotRecord['agentInheritance'],
    modelStates: row.modelStates as PlatformAiModelConfigModelState[],
    providerStates: row.providerStates as PlatformAiModelConfigProviderState[],
    dryRunResults: row.dryRunResults as PlatformAiModelConfigDryRunResult[],
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPlatformAiModelConfigSnapshotRepository(database: TenantDatabase) {
  return {
    async findSnapshot(): Promise<PlatformAiModelConfigSnapshotRecord | null> {
      const rows = await database
        .select()
        .from(platformAiModelConfigSnapshots)
        .where(eq(platformAiModelConfigSnapshots.id, platformAiModelConfigSnapshotId))
        .limit(1);

      return rows[0] ? mapSnapshotRow(rows[0]) : null;
    },

    async upsertSnapshot(input: PlatformAiModelConfigSnapshotUpsertInput): Promise<PlatformAiModelConfigSnapshotRecord> {
      const rows = await database
        .insert(platformAiModelConfigSnapshots)
        .values({
          id: input.id,
          scenarioDefaults: input.scenarioDefaults,
          agentInheritance: input.agentInheritance,
          modelStates: input.modelStates,
          providerStates: input.providerStates,
          dryRunResults: input.dryRunResults,
          updatedBy: input.updatedBy,
          updatedAt: input.updatedAt,
        })
        .onConflictDoUpdate({
          target: platformAiModelConfigSnapshots.id,
          set: {
            scenarioDefaults: input.scenarioDefaults,
            agentInheritance: input.agentInheritance,
            modelStates: input.modelStates,
            providerStates: input.providerStates,
            dryRunResults: input.dryRunResults,
            updatedBy: input.updatedBy,
            updatedAt: input.updatedAt,
          },
        })
        .returning();

      const row = rows[0];
      if (!row) throw new Error('ai_model_config_snapshot_save_failed');

      return mapSnapshotRow(row);
    },
  };
}

export type PlatformAiModelConfigSnapshotRepository = ReturnType<
  typeof createPlatformAiModelConfigSnapshotRepository
>;
