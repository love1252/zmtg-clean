import { and, eq } from 'drizzle-orm';

import type {
  WeComMappingCommandRepository,
  WeComMappingRepositoryCreateInput,
  WeComMappingRepositoryUpdateInput,
  WeComMappingState,
} from '@/modules/messaging/application/wecom-customer-mapping-command-service';
import type { TenantDatabase } from '@/server/db/client';
import { weComCustomerMappingStates } from '@/server/db/schema';

type MappingRow = typeof weComCustomerMappingStates.$inferSelect;

function mapRow(row: MappingRow): WeComMappingState {
  return {
    id: row.id,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    proofContactId: row.proofContactId,
    proofEmployeeId: row.proofEmployeeId,
    sourceMode: row.sourceMode,
    customerId: row.customerId,
    status: row.status,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createWeComMappingCommandRepository(
  database: TenantDatabase,
): WeComMappingCommandRepository {
  return Object.freeze({
    async create(input: WeComMappingRepositoryCreateInput): Promise<WeComMappingState | null> {
      const [row] = await database
        .insert(weComCustomerMappingStates)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          proofContactId: input.proofContactId,
          proofEmployeeId: input.proofEmployeeId,
          sourceMode: input.sourceMode,
          customerId: input.customerId,
          status: input.status,
          decidedBy: input.decidedBy,
          decidedAt: new Date(input.decidedAt),
        })
        .onConflictDoNothing()
        .returning();

      return row ? mapRow(row) : null;
    },

    async update(input: WeComMappingRepositoryUpdateInput): Promise<WeComMappingState | null> {
      const decidedAt = new Date(input.decidedAt);
      const [row] = await database
        .update(weComCustomerMappingStates)
        .set({
          customerId: input.customerId,
          status: input.status,
          decidedBy: input.decidedBy,
          decidedAt,
          updatedAt: decidedAt,
        })
        .where(
          and(
            eq(weComCustomerMappingStates.tenantId, input.tenantId),
            eq(weComCustomerMappingStates.institutionId, input.institutionId),
            eq(weComCustomerMappingStates.proofContactId, input.proofContactId),
            eq(weComCustomerMappingStates.customerId, input.expectedCustomerId),
            eq(weComCustomerMappingStates.status, input.expectedStatus),
          ),
        )
        .returning();

      return row ? mapRow(row) : null;
    },
  });
}
