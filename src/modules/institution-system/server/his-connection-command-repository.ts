import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';

import {
  decideHisConnectionStatusTransition,
  type CreateHisConnectionResult,
  type HisConnectionCommandPersistence,
  type HisConnectionCredentialReferenceResult,
  type HisConnectionCredentialStatus,
  type HisConnectionCredentialSummary,
  type HisConnectionHealthSummaryWriteResult,
  type HisConnectionReadModel,
  type HisConnectionStatus,
  type HisConnectionStatusTransitionResult,
  type NormalizedCreateHisConnectionCommand,
  type NormalizedCredentialClearCommand,
  type NormalizedCredentialReferenceCommand,
  type NormalizedHealthSummaryCommand,
  type NormalizedStatusTransitionCommand,
  type NormalizedUpdateHisConnectionCommand,
  type UpdateHisConnectionResult,
} from '@/modules/institution-system/application/his-connection-command-service';
import type { TenantDatabase } from '@/server/db/client';
import { hisConnections } from '@/server/db/schema';

type Row = typeof hisConnections.$inferSelect;

function createId() {
  return `his_conn_${randomUUID()}`;
}

function visible(row: Row, tenantId: string) {
  return row.tenantId === tenantId && row.deletedAt === null;
}

function credentialStatus(row: Row): HisConnectionCredentialStatus {
  if (row.deletedAt !== null || row.status === 'deleted') return 'deleted';
  if (row.revokedAt !== null || row.status === 'revoked') return 'revoked';
  return row.credentialRef === null ? 'missing' : 'configured';
}

function credentialConfigured(row: Row) {
  return credentialStatus(row) === 'configured';
}

function mapRow(row: Row): HisConnectionReadModel {
  return {
    connectionId: row.id,
    tenantId: row.tenantId,
    connectionName: row.connectionName,
    sourceSystem: row.sourceSystem,
    vendorType: row.vendorType,
    systemType: row.systemType,
    status: row.status as HisConnectionStatus,
    credentialConfigured: credentialConfigured(row),
    healthStatus: row.healthStatus,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastErrorCode: row.lastErrorCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function mapCredentialSummary(row: Row): HisConnectionCredentialSummary {
  return {
    connectionId: row.id,
    tenantId: row.tenantId,
    status: row.status as HisConnectionStatus,
    credentialConfigured: credentialConfigured(row),
    credentialStatus: credentialStatus(row),
    updatedAt: row.updatedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function uniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function sanitized(action: string) {
  return new Error(`Failed to ${action} HIS connection`);
}

async function findVisible(
  database: TenantDatabase,
  tenantId: string,
  connectionId: string,
): Promise<Row | null> {
  const rows = await database
    .select()
    .from(hisConnections)
    .where(
      and(
        eq(hisConnections.tenantId, tenantId),
        eq(hisConnections.id, connectionId),
        isNull(hisConnections.deletedAt),
      ),
    );
  return rows.find((row) => row.id === connectionId && visible(row, tenantId)) ?? null;
}

async function transitionStatus(
  database: TenantDatabase,
  action: 'pause' | 'resume' | 'revoke' | 'delete',
  input: NormalizedStatusTransitionCommand,
): Promise<HisConnectionStatusTransitionResult> {
  const current = await findVisible(database, input.tenantId, input.connectionId);
  if (!current) return { status: 'not_found' };

  const decision = decideHisConnectionStatusTransition(
    action,
    current.status as HisConnectionStatus,
  );
  if (decision.status !== 'ok') return { status: decision.status };

  const now = new Date();
  const values: Partial<typeof hisConnections.$inferInsert> = {
    status: decision.nextStatus,
    updatedAt: now,
    updatedBy: input.actorUserId,
  };
  if (decision.setRevokedAt) values.revokedAt = now;
  if (decision.setDeletedAt) values.deletedAt = now;

  try {
    const [row] = await database
      .update(hisConnections)
      .set(values)
      .where(
        and(
          eq(hisConnections.tenantId, input.tenantId),
          eq(hisConnections.id, input.connectionId),
          isNull(hisConnections.deletedAt),
        ),
      )
      .returning();

    if (!row || row.id !== input.connectionId || row.tenantId !== input.tenantId) {
      return { status: 'not_found' };
    }
    if (decision.nextStatus !== 'deleted' && row.deletedAt !== null) {
      return { status: 'not_found' };
    }
    return { status: 'ok', record: mapRow(row) };
  } catch {
    throw sanitized('change status');
  }
}

async function setCredential(
  database: TenantDatabase,
  input: NormalizedCredentialReferenceCommand,
): Promise<HisConnectionCredentialReferenceResult> {
  const current = await findVisible(database, input.tenantId, input.connectionId);
  if (!current) return { status: 'not_found' };
  if (current.status === 'deleted' || current.status === 'revoked') {
    return { status: 'invalid_state_transition' };
  }

  try {
    const [row] = await database
      .update(hisConnections)
      .set({
        credentialRef: input.credentialRef,
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
      })
      .where(
        and(
          eq(hisConnections.tenantId, input.tenantId),
          eq(hisConnections.id, input.connectionId),
          isNull(hisConnections.deletedAt),
        ),
      )
      .returning();

    if (!row || row.id !== input.connectionId || !visible(row, input.tenantId)) {
      return { status: 'not_found' };
    }
    return {
      status: 'ok',
      record: mapRow(row),
      summary: mapCredentialSummary(row),
    };
  } catch {
    throw sanitized('change credential reference');
  }
}

async function clearCredential(
  database: TenantDatabase,
  input: NormalizedCredentialClearCommand,
): Promise<HisConnectionCredentialReferenceResult> {
  const current = await findVisible(database, input.tenantId, input.connectionId);
  if (!current) return { status: 'not_found' };

  try {
    const [row] = await database
      .update(hisConnections)
      .set({
        credentialRef: null,
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
      })
      .where(
        and(
          eq(hisConnections.tenantId, input.tenantId),
          eq(hisConnections.id, input.connectionId),
          isNull(hisConnections.deletedAt),
        ),
      )
      .returning();

    if (!row || row.id !== input.connectionId || !visible(row, input.tenantId)) {
      return { status: 'not_found' };
    }
    return {
      status: 'ok',
      record: mapRow(row),
      summary: mapCredentialSummary(row),
    };
  } catch {
    throw sanitized('change credential reference');
  }
}

export function createHisConnectionCommandRepository(
  database: TenantDatabase,
): HisConnectionCommandPersistence {
  return Object.freeze({
    async createHisConnectionForTenant(
      input: NormalizedCreateHisConnectionCommand,
    ): Promise<CreateHisConnectionResult> {
      const now = new Date();
      try {
        const [row] = await database
          .insert(hisConnections)
          .values({
            id: createId(),
            tenantId: input.tenantId,
            connectionName: input.connectionName,
            sourceSystem: input.sourceSystem,
            vendorType: input.vendorType,
            systemType: input.systemType,
            status: 'draft',
            healthStatus: 'unknown',
            createdAt: now,
            updatedAt: now,
            createdBy: input.actorUserId,
            updatedBy: input.actorUserId,
          })
          .returning();
        if (!row || !visible(row, input.tenantId)) throw sanitized('create');
        return { status: 'ok', record: mapRow(row) };
      } catch (error) {
        if (uniqueViolation(error)) return { status: 'conflict' };
        throw sanitized('create');
      }
    },

    async updateHisConnectionForTenant(
      input: NormalizedUpdateHisConnectionCommand,
    ): Promise<UpdateHisConnectionResult> {
      try {
        const [row] = await database
          .update(hisConnections)
          .set({
            ...input.values,
            updatedAt: new Date(),
            updatedBy: input.actorUserId,
          })
          .where(
            and(
              eq(hisConnections.tenantId, input.tenantId),
              eq(hisConnections.id, input.connectionId),
              isNull(hisConnections.deletedAt),
            ),
          )
          .returning();
        if (!row || row.id !== input.connectionId || !visible(row, input.tenantId)) {
          return { status: 'not_found' };
        }
        return { status: 'ok', record: mapRow(row) };
      } catch (error) {
        if (uniqueViolation(error)) return { status: 'conflict' };
        throw sanitized('update');
      }
    },

    pauseHisConnectionForTenant(input: NormalizedStatusTransitionCommand) {
      return transitionStatus(database, 'pause', input);
    },
    resumeHisConnectionForTenant(input: NormalizedStatusTransitionCommand) {
      return transitionStatus(database, 'resume', input);
    },
    revokeHisConnectionForTenant(input: NormalizedStatusTransitionCommand) {
      return transitionStatus(database, 'revoke', input);
    },
    softDeleteHisConnectionForTenant(input: NormalizedStatusTransitionCommand) {
      return transitionStatus(database, 'delete', input);
    },
    setHisConnectionCredentialReferenceForTenant(
      input: NormalizedCredentialReferenceCommand,
    ) {
      return setCredential(database, input);
    },
    rotateHisConnectionCredentialReferenceForTenant(
      input: NormalizedCredentialReferenceCommand,
    ) {
      return setCredential(database, input);
    },
    clearHisConnectionCredentialReferenceForTenant(
      input: NormalizedCredentialClearCommand,
    ) {
      return clearCredential(database, input);
    },
    revokeHisConnectionCredentialReferenceForTenant(
      input: NormalizedCredentialClearCommand,
    ) {
      return clearCredential(database, input);
    },

    async writeHisConnectionHealthSummaryForTenant(
      input: NormalizedHealthSummaryCommand,
    ): Promise<HisConnectionHealthSummaryWriteResult> {
      const values: Partial<typeof hisConnections.$inferInsert> = {
        healthStatus: input.healthStatus,
        lastCheckedAt: input.checkedAt,
        lastErrorCode: input.lastErrorCode,
        updatedAt: new Date(),
      };
      if (input.actorUserId !== undefined) values.updatedBy = input.actorUserId;

      try {
        const [row] = await database
          .update(hisConnections)
          .set(values)
          .where(
            and(
              eq(hisConnections.tenantId, input.tenantId),
              eq(hisConnections.id, input.connectionId),
              isNull(hisConnections.deletedAt),
            ),
          )
          .returning();
        if (!row || row.id !== input.connectionId || !visible(row, input.tenantId)) {
          return { status: 'not_found' };
        }
        return { status: 'ok', record: mapRow(row) };
      } catch {
        throw new Error('Failed to write HIS connection health summary');
      }
    },
  });
}
