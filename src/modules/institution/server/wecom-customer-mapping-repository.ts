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
    async findByScope(input: WeComCustomerMappingScope): Promise<WeComCustomerMappingState | null> {
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

    async findByScopeForUpdate(input: WeComCustomerMappingScope): Promise<WeComCustomerMappingState | null> {
      const [row] = await database
        .select()
        .from(weComCustomerMappingStates)
        .where(
          and(
            eq(weComCustomerMappingStates.tenantId, input.tenantId),
            eq(weComCustomerMappingStates.institutionId, input.institutionId),
            eq(weComCustomerMappingStates.proofContactId, input.proofContactId),
          ),
        )
        .for('update');
      return row ? mapWeComCustomerMappingStateRow(row) : null;
    },

    async createIfAbsent(input: CreateWeComCustomerMappingStateInput): Promise<WeComCustomerMappingState | null> {
      void input;
      throw new Error('legacy_wecom_mapping_writer_disabled');
    },

    async updateWhenCurrentStatus(input: UpdateWeComCustomerMappingStateInput): Promise<WeComCustomerMappingState | null> {
      void input;
      throw new Error('legacy_wecom_mapping_writer_disabled');
    },
  };
}

export type WeComCustomerMappingRepository = ReturnType<
  typeof createWeComCustomerMappingRepository
>;
