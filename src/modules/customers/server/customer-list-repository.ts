import { and, asc, desc, eq } from 'drizzle-orm';

import {
  CUSTOMER_LIST_LIFECYCLES_V1,
  CUSTOMER_LIST_PRIORITIES_V1,
  type CustomerListSourceQueryV1,
  type CustomerListSourceV1,
} from '@/modules/customer-center/ports/customer-list-source';
import type { TenantDatabase } from '@/server/db/client';
import { customers } from '@/server/db/schema';

const PAGE_SIZE_WITH_SENTINEL = 21;
const MAX_OFFSET = 1980;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

function isQuery(value: CustomerListSourceQueryV1): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.tenantId === 'string' &&
    idPattern.test(value.tenantId) &&
    typeof value.institutionId === 'string' &&
    idPattern.test(value.institutionId) &&
    (value.lifecycle === null ||
      CUSTOMER_LIST_LIFECYCLES_V1.some((item) => item === value.lifecycle)) &&
    (value.priority === null ||
      CUSTOMER_LIST_PRIORITIES_V1.some((item) => item === value.priority)) &&
    value.limit === PAGE_SIZE_WITH_SENTINEL &&
    Number.isSafeInteger(value.offset) &&
    value.offset >= 0 &&
    value.offset <= MAX_OFFSET &&
    value.offset % 20 === 0
  );
}

export function createCustomerListRepository(
  database: TenantDatabase,
): CustomerListSourceV1 {
  return Object.freeze({
    async list(query: CustomerListSourceQueryV1) {
      if (!isQuery(query)) throw new Error('invalid_customer_list_source_query');

      const conditions = [
        eq(customers.tenantId, query.tenantId),
        eq(customers.institutionId, query.institutionId),
      ];
      if (query.lifecycle !== null) {
        conditions.push(eq(customers.lifecycle, query.lifecycle));
      }
      if (query.priority !== null) {
        conditions.push(eq(customers.priority, query.priority));
      }

      const rows = await database
        .select({
          customerId: customers.id,
          displayName: customers.displayName,
          lifecycle: customers.lifecycle,
          priority: customers.priority,
          updatedAt: customers.updatedAt,
          tenantId: customers.tenantId,
          institutionId: customers.institutionId,
        })
        .from(customers)
        .where(and(...conditions))
        .orderBy(desc(customers.updatedAt), asc(customers.id))
        .limit(query.limit)
        .offset(query.offset);

      if (rows.length > PAGE_SIZE_WITH_SENTINEL) {
        throw new Error('customer_list_source_overflow');
      }

      return Object.freeze(
        rows.map((row) => {
          if (!row.institutionId) {
            throw new Error('customer_institution_attribution_missing');
          }
          return Object.freeze({
            customerId: row.customerId,
            displayName: row.displayName,
            lifecycle: row.lifecycle,
            priority: row.priority,
            updatedAt: row.updatedAt.toISOString(),
            tenantId: row.tenantId,
            institutionId: row.institutionId,
          });
        }),
      );
    },
  });
}
