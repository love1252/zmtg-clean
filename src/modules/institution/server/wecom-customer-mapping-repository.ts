import { and, eq } from 'drizzle-orm';
import type {
  PersistedWeComCustomerMappingStatus,
} from '@/modules/institution/domain/wecom-customer-mapping';
import type { TenantDatabase } from '@/server/db/client';
import { weComCustomerMappingStates } from '@/server/db/schema';

export type WeComCustomerMappingStatus = PersistedWeComCustomerMappingStatus;
export type WeComCustomerMappingSourceMode = 'real_readonly_proof';

export type WeComCustomerMappingState = {
  id: string;
  tenantId: string;
  institutionId: string;
  proofContactId: string;
  proofEmployeeId: string;
  sourceMode: WeComCustomerMappingSourceMode;
  customerId: string;
  status: WeComCustomerMappingStatus;
  decidedBy: string;
  decidedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type WeComCustomerMappingScope = {
  tenantId: string;
  institutionId: string;
  proofContactId: string;
};

export type CreateWeComCustomerMappingStateInput = WeComCustomerMappingScope & {
  id: string;
  proofEmployeeId: string;
  sourceMode: WeComCustomerMappingSourceMode;
  customerId: string;
  status: WeComCustomerMappingStatus;
  decidedBy: string;
  decidedAt: string;
};

export type UpdateWeComCustomerMappingStateInput = WeComCustomerMappingScope & {
  customerId: string;
  expectedCustomerId: string;
  expectedStatus: WeComCustomerMappingStatus;
  status: WeComCustomerMappingStatus;
  decidedBy: string;
  decidedAt: string;
};

type WeComCustomerMappingStateRow = typeof weComCustomerMappingStates.$inferSelect;

export function mapWeComCustomerMappingStateRow(
  row: WeComCustomerMappingStateRow,
): WeComCustomerMappingState {
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

export function createWeComCustomerMappingRepository(database: TenantDatabase) {
  return {
    async findByScope(
      input: WeComCustomerMappingScope,
    ): Promise<WeComCustomerMappingState | null> {
      const [row] = await database
        .select()
        .from(weComCustomerMappingStates)
        .where(
          and(
            eq(weComCustomerMappingStates.tenantId, input.tenantId),
            eq(weComCustomerMappingStates.institutionId, input.institutionId),
            eq(weComCustomerMappingStates.proofContactId, input.proofContactId),
          ),
        );

      return row ? mapWeComCustomerMappingStateRow(row) : null;
    },

    async createIfAbsent(
      input: CreateWeComCustomerMappingStateInput,
    ): Promise<WeComCustomerMappingState | null> {
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

      return row ? mapWeComCustomerMappingStateRow(row) : null;
    },

    async updateWhenCurrentStatus(
      input: UpdateWeComCustomerMappingStateInput,
    ): Promise<WeComCustomerMappingState | null> {
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

      return row ? mapWeComCustomerMappingStateRow(row) : null;
    },
  };
}

export type WeComCustomerMappingRepository = ReturnType<
  typeof createWeComCustomerMappingRepository
>;
