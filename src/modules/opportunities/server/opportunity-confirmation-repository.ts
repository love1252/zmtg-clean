import { and, desc, eq } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import { customers, institutionOpportunityConfirmations as confirmations } from '@/server/db/schema';
type Scope = Readonly<{ tenantId: string; institutionId: string }>;
export type OpportunityConfirmationRow = typeof confirmations.$inferSelect;
const whereScope = (scope: Scope) => and(eq(confirmations.tenantId, scope.tenantId), eq(confirmations.institutionId, scope.institutionId));
export function createOpportunityConfirmationRepository(database: TenantDatabase) {
  return {
    async customer(scope: Scope, customerId: string, lock = false) {
      const query = database.select({ tenantId: customers.tenantId, institutionId: customers.institutionId, customerId: customers.id, displayName: customers.displayName, lifecycle: customers.lifecycle, priority: customers.priority, updatedAt: customers.updatedAt }).from(customers)
        .where(and(eq(customers.tenantId, scope.tenantId), eq(customers.institutionId, scope.institutionId), eq(customers.id, customerId))).limit(1);
      return (await (lock ? query.for('update') : query))[0] ?? null;
    },
    async byKey(scope: Scope, key: string) {
      return (await database.select().from(confirmations).where(and(whereScope(scope), eq(confirmations.idempotencyKey, key))).limit(1))[0] ?? null;
    },
    async candidate(scope: Scope, customerId: string, type: OpportunityConfirmationRow['opportunityType']) {
      return (await database.select().from(confirmations).where(and(whereScope(scope), eq(confirmations.customerId, customerId), eq(confirmations.opportunityType, type))).limit(1))[0] ?? null;
    },
    async history(scope: Scope, customerId: string) {
      return database.select().from(confirmations).where(and(whereScope(scope), eq(confirmations.customerId, customerId))).orderBy(desc(confirmations.confirmedAt), confirmations.id).limit(4);
    },
    async create(value: typeof confirmations.$inferInsert) {
      const [row] = await database.insert(confirmations).values(value).returning();
      if (!row) throw new Error('opportunity_confirmation_insert_failed');
      return row;
    },
  };
}
