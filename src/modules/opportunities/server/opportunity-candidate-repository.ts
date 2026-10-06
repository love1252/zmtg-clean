import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';

import { OPPORTUNITY_DEFINITIONS, type OpportunityQuery } from '@/modules/opportunities/domain/opportunity-candidate';
import type { TenantDatabase } from '@/server/db/client';
import { customers } from '@/server/db/schema';

export function createOpportunityCandidateRepository(database: TenantDatabase) {
  return Object.freeze({
    async read(input: Readonly<{ tenantId: string; institutionId: string; query: OpportunityQuery }>) {
      const { query } = input;
      const lifecycles = query.type === 'all'
        ? Object.values(OPPORTUNITY_DEFINITIONS).map(item => item.lifecycle)
        : [OPPORTUNITY_DEFINITIONS[query.type].lifecycle];
      const where = and(
        eq(customers.tenantId, input.tenantId),
        eq(customers.institutionId, input.institutionId),
        inArray(customers.lifecycle, lifecycles),
        query.priority === null ? undefined : eq(customers.priority, query.priority),
      );
      return database.transaction(async transaction => {
        const [aggregate] = await transaction.select({ total: count() }).from(customers).where(where);
        const rows = await transaction.select({
          tenantId: customers.tenantId,
          institutionId: customers.institutionId,
          customerId: customers.id,
          displayName: customers.displayName,
          lifecycle: customers.lifecycle,
          priority: customers.priority,
          updatedAt: customers.updatedAt,
        }).from(customers).where(where)
          .orderBy(desc(customers.updatedAt), asc(sql`${customers.id} COLLATE "C"`))
          .limit(query.pageSize).offset((query.page - 1) * query.pageSize);
        return { total: aggregate?.total, rows };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
  });
}
