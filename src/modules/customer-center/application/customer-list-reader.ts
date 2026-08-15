import { isProxy } from 'node:util/types';

import {
  CUSTOMER_LIST_LIFECYCLES_V1,
  CUSTOMER_LIST_PRIORITIES_V1,
  type CustomerListLifecycleV1,
  type CustomerListPriorityV1,
  type CustomerListSourceRowV1,
  type CustomerListSourceV1,
} from '@/modules/customer-center/ports/customer-list-source';

export const CUSTOMER_LIST_PAGE_SIZE_V1 = 20;
export const CUSTOMER_LIST_MAX_PAGE_V1 = 100;
export const CUSTOMER_LIST_MAX_OFFSET_V1 = 1980;

export type CustomerListItemV1 = Readonly<{
  contractVersion: 'v1';
  customerId: string;
  displayName: string;
  lifecycle: CustomerListLifecycleV1;
  priority: CustomerListPriorityV1;
  updatedAt: string;
}>;

export type CustomerListReaderResultV1 =
  | Readonly<{
      kind: 'ready';
      records: readonly CustomerListItemV1[];
      pageInfo: Readonly<{
        page: number;
        pageSize: typeof CUSTOMER_LIST_PAGE_SIZE_V1;
        hasMore: boolean;
      }>;
    }>
  | Readonly<{ kind: 'invalid_query'; code: 'invalid_customer_query' }>
  | Readonly<{ kind: 'unavailable' }>;

export type CustomerListReaderV1 = Readonly<{
  read: (input: Readonly<{
    tenantId: string;
    institutionId: string;
    searchParams: URLSearchParams;
  }>) => Promise<CustomerListReaderResultV1>;
}>;

const FACTORY_KEYS = Object.freeze(['source'] as const);
const READ_KEYS = Object.freeze([
  'tenantId',
  'institutionId',
  'searchParams',
] as const);
const SOURCE_ROW_KEYS = Object.freeze([
  'customerId',
  'displayName',
  'lifecycle',
  'priority',
  'updatedAt',
  'tenantId',
  'institutionId',
] as const);
const ALLOWED_QUERY_KEYS = Object.freeze([
  'page',
  'lifecycle',
  'priority',
] as const);
const allowedQueryKeys = new Set<string>(ALLOWED_QUERY_KEYS);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const canonicalUtcInstant =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const INVALID_QUERY = Object.freeze({
  kind: 'invalid_query',
  code: 'invalid_customer_query',
} as const);
const UNAVAILABLE = Object.freeze({ kind: 'unavailable' } as const);

function snapshot(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(descriptors, key))
    ) return null;

    const result: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      Object.defineProperty(result, key, {
        value: descriptor.value,
        enumerable: true,
      });
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && idPattern.test(value);
}

function isLifecycle(value: unknown): value is CustomerListLifecycleV1 {
  return CUSTOMER_LIST_LIFECYCLES_V1.some((item) => item === value);
}

function isPriority(value: unknown): value is CustomerListPriorityV1 {
  return CUSTOMER_LIST_PRIORITIES_V1.some((item) => item === value);
}

function parseQuery(searchParams: URLSearchParams): Readonly<{
  page: number;
  lifecycle: CustomerListLifecycleV1 | null;
  priority: CustomerListPriorityV1 | null;
}> | null {
  try {
    if (
      !(searchParams instanceof URLSearchParams) ||
      isProxy(searchParams)
    ) return null;

    for (const key of searchParams.keys()) {
      if (!allowedQueryKeys.has(key) || searchParams.getAll(key).length !== 1) {
        return null;
      }
    }

    const pageValue = searchParams.get('page');
    if (pageValue !== null && !/^(?:[1-9]|[1-9]\d|100)$/u.test(pageValue)) {
      return null;
    }
    const page = pageValue === null ? 1 : Number(pageValue);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > CUSTOMER_LIST_MAX_PAGE_V1
    ) return null;

    const lifecycleValue = searchParams.get('lifecycle');
    if (lifecycleValue !== null && !isLifecycle(lifecycleValue)) return null;
    const priorityValue = searchParams.get('priority');
    if (priorityValue !== null && !isPriority(priorityValue)) return null;

    return Object.freeze({
      page,
      lifecycle: lifecycleValue,
      priority: priorityValue,
    });
  } catch {
    return null;
  }
}

function parseSourceRow(
  value: unknown,
  tenantId: string,
  institutionId: string,
): CustomerListSourceRowV1 | null {
  const row = snapshot(value, SOURCE_ROW_KEYS);
  if (
    !row ||
    !isId(row.customerId) ||
    typeof row.displayName !== 'string' ||
    row.displayName.length === 0 ||
    row.displayName.length > 120 ||
    !isLifecycle(row.lifecycle) ||
    !isPriority(row.priority) ||
    typeof row.updatedAt !== 'string' ||
    !canonicalUtcInstant.test(row.updatedAt) ||
    !Number.isFinite(Date.parse(row.updatedAt)) ||
    new Date(Date.parse(row.updatedAt)).toISOString() !== row.updatedAt ||
    row.tenantId !== tenantId ||
    row.institutionId !== institutionId
  ) return null;

  return Object.freeze({
    customerId: row.customerId,
    displayName: row.displayName,
    lifecycle: row.lifecycle,
    priority: row.priority,
    updatedAt: row.updatedAt,
    tenantId,
    institutionId,
  });
}

function makeReader(source: CustomerListSourceV1 | null): CustomerListReaderV1 {
  return Object.freeze({
    async read(value): Promise<CustomerListReaderResultV1> {
      const input = snapshot(value, READ_KEYS);
      if (
        !input ||
        !isId(input.tenantId) ||
        !isId(input.institutionId) ||
        !(input.searchParams instanceof URLSearchParams)
      ) return UNAVAILABLE;

      const query = parseQuery(input.searchParams);
      if (!query) return INVALID_QUERY;
      if (!source || typeof source.list !== 'function' || isProxy(source.list)) {
        return UNAVAILABLE;
      }

      try {
        const rows = await source.list({
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          lifecycle: query.lifecycle,
          priority: query.priority,
          limit: CUSTOMER_LIST_PAGE_SIZE_V1 + 1,
          offset: (query.page - 1) * CUSTOMER_LIST_PAGE_SIZE_V1,
        });
        if (!Array.isArray(rows) || rows.length > CUSTOMER_LIST_PAGE_SIZE_V1 + 1) {
          return UNAVAILABLE;
        }

        const parsedRows = rows.map((row) =>
          parseSourceRow(row, input.tenantId as string, input.institutionId as string),
        );
        if (parsedRows.some((row) => row === null)) return UNAVAILABLE;

        const records = Object.freeze(
          parsedRows.slice(0, CUSTOMER_LIST_PAGE_SIZE_V1).map((row) => {
            if (!row) throw new Error('customer_list_row_unavailable');
            return Object.freeze({
              contractVersion: 'v1' as const,
              customerId: row.customerId,
              displayName: row.displayName,
              lifecycle: row.lifecycle,
              priority: row.priority,
              updatedAt: row.updatedAt,
            });
          }),
        );

        return Object.freeze({
          kind: 'ready' as const,
          records,
          pageInfo: Object.freeze({
            page: query.page,
            pageSize: CUSTOMER_LIST_PAGE_SIZE_V1,
            hasMore: rows.length > CUSTOMER_LIST_PAGE_SIZE_V1,
          }),
        });
      } catch {
        return UNAVAILABLE;
      }
    },
  });
}

export function createCustomerListReaderV1(input: Readonly<{
  source: CustomerListSourceV1;
}>): CustomerListReaderV1 {
  const record = snapshot(input, FACTORY_KEYS);
  return makeReader(
    record &&
      record.source !== null &&
      typeof record.source === 'object' &&
      !isProxy(record.source) &&
      typeof (record.source as CustomerListSourceV1).list === 'function'
      ? (record.source as CustomerListSourceV1)
      : null,
  );
}
