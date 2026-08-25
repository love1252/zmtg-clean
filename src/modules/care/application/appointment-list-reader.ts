import { isProxy } from 'node:util/types';

import {
  APPOINTMENT_LIST_MAX_PAGE_V1,
  APPOINTMENT_LIST_PAGE_SIZE_V1,
  type AppointmentListReaderResultV1,
} from '@/modules/care/application/appointment-list-pagination-contract';
import {
  APPOINTMENT_LIST_STATUSES_V1,
  type AppointmentListSourceRowV1,
  type AppointmentListSourceV1,
  type AppointmentListStatusV1,
} from '@/modules/care/ports/appointment-list-source';

export {
  APPOINTMENT_LIST_MAX_OFFSET_V1,
  APPOINTMENT_LIST_MAX_PAGE_V1,
  APPOINTMENT_LIST_PAGE_SIZE_V1,
  type AppointmentListItemV1,
  type AppointmentListReaderResultV1,
} from '@/modules/care/application/appointment-list-pagination-contract';

export type AppointmentListReaderV1 = Readonly<{
  read: (input: Readonly<{
    tenantId: string;
    institutionId: string;
    searchParams: URLSearchParams;
  }>) => Promise<AppointmentListReaderResultV1>;
}>;

const FACTORY_KEYS = Object.freeze(['source'] as const);
const READ_KEYS = Object.freeze([
  'tenantId',
  'institutionId',
  'searchParams',
] as const);
const SOURCE_ROW_KEYS = Object.freeze([
  'appointmentId',
  'scheduledAt',
  'status',
  'updatedAt',
  'tenantId',
  'institutionId',
] as const);
const allowedQueryKeys = new Set<string>(['page', 'status']);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const canonicalUtcInstant =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const INVALID_QUERY = Object.freeze({
  kind: 'invalid_query',
  code: 'invalid_appointment_query',
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

function isStatus(value: unknown): value is AppointmentListStatusV1 {
  return APPOINTMENT_LIST_STATUSES_V1.some((item) => item === value);
}

function isCanonicalUtcInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !canonicalUtcInstant.test(value)) return false;
  const epochMs = Date.parse(value);
  return Number.isFinite(epochMs) && new Date(epochMs).toISOString() === value;
}

function parseQuery(searchParams: URLSearchParams): Readonly<{
  page: number;
  status: AppointmentListStatusV1 | null;
}> | null {
  try {
    if (!(searchParams instanceof URLSearchParams) || isProxy(searchParams)) {
      return null;
    }

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
      page > APPOINTMENT_LIST_MAX_PAGE_V1
    ) return null;

    const statusValue = searchParams.get('status');
    if (statusValue !== null && !isStatus(statusValue)) return null;

    return Object.freeze({ page, status: statusValue });
  } catch {
    return null;
  }
}

function parseSourceRow(
  value: unknown,
  tenantId: string,
  institutionId: string,
): AppointmentListSourceRowV1 | null {
  const row = snapshot(value, SOURCE_ROW_KEYS);
  if (
    !row ||
    !isId(row.appointmentId) ||
    !isCanonicalUtcInstant(row.scheduledAt) ||
    !isStatus(row.status) ||
    !isCanonicalUtcInstant(row.updatedAt) ||
    row.tenantId !== tenantId ||
    row.institutionId !== institutionId
  ) return null;

  return Object.freeze({
    appointmentId: row.appointmentId,
    scheduledAt: row.scheduledAt,
    status: row.status,
    updatedAt: row.updatedAt,
    tenantId,
    institutionId,
  });
}

function makeReader(source: AppointmentListSourceV1 | null): AppointmentListReaderV1 {
  return Object.freeze({
    async read(value): Promise<AppointmentListReaderResultV1> {
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
          status: query.status,
          limit: APPOINTMENT_LIST_PAGE_SIZE_V1 + 1,
          offset: (query.page - 1) * APPOINTMENT_LIST_PAGE_SIZE_V1,
        });
        if (
          !Array.isArray(rows) ||
          rows.length > APPOINTMENT_LIST_PAGE_SIZE_V1 + 1
        ) return UNAVAILABLE;

        const parsedRows = rows.map((row) =>
          parseSourceRow(
            row,
            input.tenantId as string,
            input.institutionId as string,
          ),
        );
        if (parsedRows.some((row) => row === null)) return UNAVAILABLE;

        const records = Object.freeze(
          parsedRows.slice(0, APPOINTMENT_LIST_PAGE_SIZE_V1).map((row) => {
            if (!row) throw new Error('appointment_list_row_unavailable');
            return Object.freeze({
              contractVersion: 'v1' as const,
              appointmentId: row.appointmentId,
              scheduledAt: row.scheduledAt,
              status: row.status,
              updatedAt: row.updatedAt,
            });
          }),
        );

        return Object.freeze({
          kind: 'ready' as const,
          records,
          pageInfo: Object.freeze({
            page: query.page,
            pageSize: APPOINTMENT_LIST_PAGE_SIZE_V1,
            hasMore: rows.length > APPOINTMENT_LIST_PAGE_SIZE_V1,
          }),
        });
      } catch {
        return UNAVAILABLE;
      }
    },
  });
}

export function createAppointmentListReaderV1(input: Readonly<{
  source: AppointmentListSourceV1;
}>): AppointmentListReaderV1 {
  const record = snapshot(input, FACTORY_KEYS);
  return makeReader(
    record &&
      record.source !== null &&
      typeof record.source === 'object' &&
      !isProxy(record.source) &&
      typeof (record.source as AppointmentListSourceV1).list === 'function'
      ? (record.source as AppointmentListSourceV1)
      : null,
  );
}
