import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or } from 'drizzle-orm';

import {
  CUSTOMER_LIST_AGE_BANDS_V1,
  CUSTOMER_LIST_GENDERS_V1,
  CUSTOMER_LIST_LIFECYCLES_V1,
  CUSTOMER_LIST_PRIORITIES_V1,
  type CustomerListAgeBandV1,
  type CustomerListSourceCountQueryV1,
  type CustomerListSourceQueryV1,
  type CustomerListSourceV1,
} from '@/modules/customer-center/ports/customer-list-source';
import type { TenantDatabase } from '@/server/db/client';
import { customers } from '@/server/db/schema';

const PAGE_SIZES_WITH_SENTINEL = Object.freeze([11, 21, 51, 101] as const);
const MAX_OFFSET = 9900;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const keywordPattern = /^[\p{L}\p{N}·.' -]{1,80}$/u;

const ageBandRanges: Readonly<Record<CustomerListAgeBandV1, readonly [number, number | null]>> =
  Object.freeze({
    under_20: Object.freeze([0, 19] as const),
    '20_29': Object.freeze([20, 29] as const),
    '30_39': Object.freeze([30, 39] as const),
    '40_49': Object.freeze([40, 49] as const),
    '50_59': Object.freeze([50, 59] as const),
    '60_plus': Object.freeze([60, null] as const),
  });

const importedAgeBandValues: Readonly<Record<CustomerListAgeBandV1, readonly string[]>> =
  Object.freeze({
    under_20: Object.freeze(['低敏年龄:<20', '低敏年龄:0-19']),
    '20_29': Object.freeze(['低敏年龄:20-29']),
    '30_39': Object.freeze(['低敏年龄:30-39']),
    '40_49': Object.freeze(['低敏年龄:40-49']),
    '50_59': Object.freeze(['低敏年龄:50-59']),
    '60_plus': Object.freeze(['低敏年龄:60+', '低敏年龄:60岁以上']),
  });

function isIsoDate(value: string) {
  if (!isoDatePattern.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}

function shiftUtcYear(date: Date, years: number) {
  const shifted = new Date(Date.UTC(
    date.getUTCFullYear() + years,
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
  if (shifted.getUTCMonth() !== date.getUTCMonth()) shifted.setUTCDate(0);
  return shifted;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function ageBandCondition(ageBand: CustomerListAgeBandV1) {
  const [minimumAge, maximumAge] = ageBandRanges[ageBand];
  const today = new Date();
  const latestBirthDate = isoDate(shiftUtcYear(today, -minimumAge));
  const exactImportedValues = importedAgeBandValues[ageBand];
  const dateCondition = maximumAge === null
    ? lte(customers.birthDate, latestBirthDate)
    : and(
        gte(customers.birthDate, isoDate(new Date(
          shiftUtcYear(today, -(maximumAge + 1)).getTime() + 24 * 60 * 60 * 1000,
        ))),
        lte(customers.birthDate, latestBirthDate),
      );
  return or(dateCondition, inArray(customers.birthDate, exactImportedValues));
}

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
      CUSTOMER_LIST_PRIORITIES_V1.some((item) => item === value.priority)) &&
    (value.keyword === null ||
      (typeof value.keyword === 'string' && keywordPattern.test(value.keyword))) &&
    (value.gender === null ||
      CUSTOMER_LIST_GENDERS_V1.some((item) => item === value.gender)) &&
    (value.ageBand === null ||
      CUSTOMER_LIST_AGE_BANDS_V1.some((item) => item === value.ageBand)) &&
    (value.createdFrom === null ||
      (typeof value.createdFrom === 'string' && isIsoDate(value.createdFrom))) &&
    (value.createdTo === null ||
      (typeof value.createdTo === 'string' && isIsoDate(value.createdTo))) &&
    (value.createdFrom === null || value.createdTo === null || value.createdFrom <= value.createdTo)
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
  if (query.keyword !== null) {
    conditions.push(ilike(customers.displayName, `%${query.keyword}%`));
  }
  if (query.gender !== null) {
    conditions.push(eq(customers.gender, query.gender === 'female' ? '女' : '男'));
  }
  if (query.ageBand !== null) {
    const condition = ageBandCondition(query.ageBand);
    if (condition) conditions.push(condition);
  }
  if (query.createdFrom !== null) {
    conditions.push(gte(customers.createdAt, new Date(`${query.createdFrom}T00:00:00.000Z`)));
  }
  if (query.createdTo !== null) {
    conditions.push(lte(customers.createdAt, new Date(`${query.createdTo}T23:59:59.999Z`)));
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
