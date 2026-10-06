import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, customerProfileSuggestions as suggestions, customers } from '@/server/db/schema';

export type ProfileScope = Readonly<{ tenantId: string; institutionId: string; customerId: string }>;
export type ProfileSuggestionRow = typeof suggestions.$inferSelect;
const scopeWhere = (scope: ProfileScope) => and(eq(suggestions.tenantId, scope.tenantId), eq(suggestions.institutionId, scope.institutionId), eq(suggestions.customerId, scope.customerId));
const customerColumns = { id: customers.id, projectInterest: customers.projectInterest, updatedAt: customers.updatedAt };
const sourceColumns = { id: appointments.id, project: appointments.project, status: appointments.status, scheduledAt: appointments.scheduledAt, updatedAt: appointments.updatedAt };

export function createCustomerProfileSuggestionRepository(database: TenantDatabase) {
  return {
    async customer(scope: ProfileScope, lock = false) {
      const query = database.select(customerColumns).from(customers).where(and(eq(customers.tenantId, scope.tenantId), eq(customers.institutionId, scope.institutionId), eq(customers.id, scope.customerId))).limit(1);
      return (await (lock ? query.for('update') : query))[0] ?? null;
    },
    async source(scope: ProfileScope, id: string, lock = false) {
      const query = database.select(sourceColumns).from(appointments).where(and(eq(appointments.tenantId, scope.tenantId), eq(appointments.institutionId, scope.institutionId), eq(appointments.customerId, scope.customerId), eq(appointments.id, id))).limit(1);
      return (await (lock ? query.for('update') : query))[0] ?? null;
    },
    async sources(scope: ProfileScope, page: number) {
      return database.select(sourceColumns).from(appointments).where(and(eq(appointments.tenantId, scope.tenantId), eq(appointments.institutionId, scope.institutionId), eq(appointments.customerId, scope.customerId), eq(appointments.status, 'confirmed'), sql`char_length(${appointments.project}) between 1 and 120`)).orderBy(desc(appointments.scheduledAt), appointments.id).limit(21).offset((page - 1) * 20);
    },
    async list(scope: ProfileScope, page: number) {
      return database.select().from(suggestions).where(scopeWhere(scope)).orderBy(desc(suggestions.createdAt), suggestions.id).limit(21).offset((page - 1) * 20);
    },
    async get(scope: ProfileScope, id: string, lock = false) {
      const query = database.select().from(suggestions).where(and(scopeWhere(scope), eq(suggestions.id, id))).limit(1);
      return (await (lock ? query.for('update') : query))[0] ?? null;
    },
    async byFingerprint(scope: ProfileScope, fingerprint: string) {
      return (await database.select().from(suggestions).where(and(scopeWhere(scope), eq(suggestions.fingerprint, fingerprint))).limit(1))[0] ?? null;
    },
    async create(value: typeof suggestions.$inferInsert) {
      return (await database.insert(suggestions).values(value).returning())[0];
    },
    async decide(scope: ProfileScope, id: string, patch: Partial<typeof suggestions.$inferInsert>) {
      const [row] = await database.update(suggestions).set(patch).where(and(scopeWhere(scope), eq(suggestions.id, id), eq(suggestions.state, 'pending'), eq(suggestions.revision, 1))).returning();
      if (!row) throw new Error('profile_decision_conflict');
      return row;
    },
    async applyProject(scope: ProfileScope, expected: Date, projectInterest: string) {
      const updatedAt = new Date(Math.max(Date.now(), expected.getTime() + 1));
      const [row] = await database.update(customers).set({ projectInterest, updatedAt }).where(and(eq(customers.tenantId, scope.tenantId), eq(customers.institutionId, scope.institutionId), eq(customers.id, scope.customerId), eq(customers.projectInterest, ''), gte(customers.updatedAt, expected), lt(customers.updatedAt, new Date(expected.getTime() + 1)))).returning({ updatedAt: customers.updatedAt });
      if (!row) throw new Error('profile_customer_conflict');
      return row.updatedAt;
    },
  };
}
