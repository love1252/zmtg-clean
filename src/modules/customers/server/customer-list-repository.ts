import { and, asc, count, desc, eq } from 'drizzle-orm';

import {
  CUSTOMER_LIST_LIFECYCLES_V1,
  CUSTOMER_LIST_PRIORITIES_V1,
  type CustomerListSourceCountQueryV1,
  type CustomerListSourceQueryV1,
  type CustomerListSourceV1,
} from '@/modules/customer-center/ports/customer-list-source';
import type { TenantDatabase } from '@/server/db/client';
import { customers } from '@/server/db/schema';

const PAGE_SIZES_WITH_SENTINEL = Object.freeze([11, 21, 51, 101] as const);
const MAX_OFFSET = 9900;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

function isFilter(
  value: CustomerListSourceQueryV1 | CustomerListSourceCountQueryV1,
): boolean {
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
      CUSTOMER_LIST_PRIORITIES_V1.some((item) => item === value.priority))
  );
}

function isQuery(value: CustomerListSourceQueryV1): boolean {
  const pageSize = value.limit - 1;
  return (
    isFilter(value) &&
    PAGE_SIZES_WITH_SENTINEL.some((limit) => limit === value.limit) &&
    Number.isSafeInteger(value.offset) &&
    value.offset >= 0 &&
    value.offset <= MAX_OFFSET &&
    value.offset % pageSize === 0
  );
}

function conditionsFor(
  query: CustomerListSourceQueryV1 | CustomerListSourceCountQueryV1,
) {
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
  return conditions;
}

export function createCustomerListRepository(
  database: TenantDatabase,
): CustomerListSourceV1 {
  return Object.freeze({
    async list(query: CustomerListSourceQueryV1) {
      if (!isQuery(query)) throw new Error('invalid_customer_list_source_query');

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
        .where(and(...conditionsFor(query)))
        .orderBy(desc(customers.updatedAt), asc(customers.id))
        .limit(query.limit)
        .offset(query.offset);

      if (rows.length > query.limit) {
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
    async count(query: CustomerListSourceCountQueryV1) {
      if (!isFilter(query)) throw new Error('invalid_customer_list_count_query');

      const rows = await database
        .select({ total: count(customers.id) })
        .from(customers)
        .where(and(...conditionsFor(query)));
      const total = rows[0]?.total;
      if (
        typeof total !== 'number' ||
        !Number.isSafeInteger(total) ||
        total < 0 ||
        rows.length !== 1
      ) {
        throw new Error('customer_list_count_unavailable');
      }
      return total;
    },
  });
}
