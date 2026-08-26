import { isProxy } from 'node:util/types';

import {
  APPOINTMENT_LIST_MAX_PAGE_V1,
  APPOINTMENT_LIST_PAGE_SIZE_V1,
  APPOINTMENT_LIST_PAGE_SIZES_V1,
  type AppointmentListPageSizeV1,
  type AppointmentListReaderResultV1,
} from '@/modules/care/application/appointment-list-pagination-contract';
import {
  APPOINTMENT_LIST_STATUSES_V1,
  type AppointmentListSourceRowV1,
  type AppointmentListSourceSummaryRowV1,
  type AppointmentListSourceV1,
  type AppointmentListStatusV1,
} from '@/modules/care/ports/appointment-list-source';

export {
  APPOINTMENT_LIST_MAX_OFFSET_V1,
  APPOINTMENT_LIST_MAX_PAGE_V1,
  APPOINTMENT_LIST_PAGE_SIZE_V1,
  APPOINTMENT_LIST_PAGE_SIZES_V1,
  type AppointmentListPageSizeV1,
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
  'customerDisplayName',
  'project',
  'scheduledAt',
  'status',
  'updatedAt',
  'tenantId',
  'institutionId',
] as const);
const SOURCE_SUMMARY_ROW_KEYS = Object.freeze([
  'status',
  'total',
  'tenantId',
  'institutionId',
] as const);
const allowedQueryKeys = new Set<string>([
  'page',
  'pageSize',
  'status',
  'q',
  'startDate',
  'endDate',
]);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const canonicalUtcInstant =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const dateOnly = /^\d{4}-\d{2}-\d{2}$/u;

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

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !dateOnly.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return date.toISOString().slice(0, 10) === value;
}

function currentShanghaiDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function chinaDayStartUtc(value: string) {
  return new Date(`${value}T00:00:00.000+08:00`).toISOString();
}

function chinaDayAfterUtc(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day + 1));
  return new Date(`${next.toISOString().slice(0, 10)}T00:00:00.000+08:00`).toISOString();
}

function parseQuery(searchParams: URLSearchParams): Readonly<{
  page: number;
  pageSize: AppointmentListPageSizeV1;
  status: AppointmentListStatusV1 | null;
  keyword: string | null;
  scheduledFrom: string | null;
  scheduledBefore: string | null;
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

    const pageSizeValue = searchParams.get('pageSize');
    const pageSize = pageSizeValue === null
      ? APPOINTMENT_LIST_PAGE_SIZE_V1
      : Number(pageSizeValue);
    if (
      !APPOINTMENT_LIST_PAGE_SIZES_V1.some(
        (candidate) => candidate === pageSize,
      )
    ) return null;

    const statusValue = searchParams.get('status');
    if (statusValue !== null && !isStatus(statusValue)) return null;

    const keywordValue = searchParams.get('q');
    if (
      keywordValue !== null &&
      (keywordValue.length === 0 ||
        keywordValue.length > 80 ||
        keywordValue.trim() !== keywordValue ||
        /[\u0000-\u001f\u007f]/u.test(keywordValue))
    ) return null;

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if ((startDate === null) !== (endDate === null)) return null;
    if (
      startDate !== null &&
      endDate !== null &&
      (!isDateOnly(startDate) ||
        !isDateOnly(endDate) ||
        startDate > endDate ||
        endDate > currentShanghaiDate())
    ) return null;

    return Object.freeze({
      page,
      pageSize: pageSize as AppointmentListPageSizeV1,
      status: statusValue,
      keyword: keywordValue,
      scheduledFrom: startDate === null ? null : chinaDayStartUtc(startDate),
      scheduledBefore: endDate === null ? null : chinaDayAfterUtc(endDate),
    });
  } catch {
    return null;
  }
}

function parseSummaryRow(
  value: unknown,
  tenantId: string,
  institutionId: string,
): AppointmentListSourceSummaryRowV1 | null {
  const row = snapshot(value, SOURCE_SUMMARY_ROW_KEYS);
  if (
    !row ||
    !isStatus(row.status) ||
    typeof row.total !== 'number' ||
    !Number.isSafeInteger(row.total) ||
    row.total < 0 ||
    row.tenantId !== tenantId ||
    row.institutionId !== institutionId
  ) return null;

  return Object.freeze({
    status: row.status,
    total: row.total,
    tenantId,
    institutionId,
  });
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
    typeof row.customerDisplayName !== 'string' ||
    row.customerDisplayName.length === 0 ||
    row.customerDisplayName.length > 120 ||
    row.customerDisplayName.trim() !== row.customerDisplayName ||
    typeof row.project !== 'string' ||
    row.project.length === 0 ||
    row.project.length > 160 ||
    row.project.trim() !== row.project ||
    !isCanonicalUtcInstant(row.scheduledAt) ||
    !isStatus(row.status) ||
    !isCanonicalUtcInstant(row.updatedAt) ||
    row.tenantId !== tenantId ||
    row.institutionId !== institutionId
  ) return null;

  return Object.freeze({
    appointmentId: row.appointmentId,
    customerDisplayName: row.customerDisplayName,
    project: row.project,
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
      if (
        !source ||
        typeof source.list !== 'function' ||
        isProxy(source.list) ||
        typeof source.summarize !== 'function' ||
        isProxy(source.summarize)
      ) {
        return UNAVAILABLE;
      }

      try {
        const filter = Object.freeze({
          tenantId: input.tenantId as string,
          institutionId: input.institutionId as string,
          keyword: query.keyword,
          scheduledFrom: query.scheduledFrom,
          scheduledBefore: query.scheduledBefore,
        });
        const [rows, summaryRows] = await Promise.all([
          source.list({
            ...filter,
            status: query.status,
            limit: query.pageSize + 1,
            offset: (query.page - 1) * query.pageSize,
          }),
          source.summarize(filter),
        ]);
        if (
          !Array.isArray(rows) ||
          rows.length > query.pageSize + 1 ||
          !Array.isArray(summaryRows) ||
          summaryRows.length > APPOINTMENT_LIST_STATUSES_V1.length
        ) return UNAVAILABLE;

        const parsedRows = rows.map((row) =>
          parseSourceRow(
            row,
            input.tenantId as string,
            input.institutionId as string,
          ),
        );
        if (
          parsedRows.some(
            (row) => row === null ||
              (query.status !== null && row.status !== query.status),
          )
        ) return UNAVAILABLE;

        const parsedSummaryRows = summaryRows.map((row) =>
          parseSummaryRow(
            row,
            input.tenantId as string,
            input.institutionId as string,
          ),
        );
        if (parsedSummaryRows.some((row) => row === null)) return UNAVAILABLE;

        const statusCounts: Record<AppointmentListStatusV1, number> = {
          pending_confirmation: 0,
          confirmed: 0,
          arrived: 0,
          completed: 0,
          reschedule_requested: 0,
          cancelled: 0,
        };
        const observedStatuses = new Set<AppointmentListStatusV1>();
        for (const row of parsedSummaryRows) {
          if (!row || observedStatuses.has(row.status)) return UNAVAILABLE;
          observedStatuses.add(row.status);
          statusCounts[row.status] = row.total;
        }
        const totalAll = APPOINTMENT_LIST_STATUSES_V1.reduce(
          (total, status) => total + statusCounts[status],
          0,
        );
        if (!Number.isSafeInteger(totalAll)) return UNAVAILABLE;

        const records = Object.freeze(
          parsedRows.slice(0, query.pageSize).map((row) => {
            if (!row) throw new Error('appointment_list_row_unavailable');
            return Object.freeze({
              contractVersion: 'v1' as const,
              appointmentId: row.appointmentId,
              customerDisplayName: row.customerDisplayName,
              project: row.project,
              scheduledAt: row.scheduledAt,
              status: row.status,
              updatedAt: row.updatedAt,
            });
          }),
        );
        const total = query.status === null
          ? totalAll
          : statusCounts[query.status];
        const offset = (query.page - 1) * query.pageSize;
        const hasMore = rows.length > query.pageSize;
        if (
          (records.length > 0 && total < offset + records.length) ||
          hasMore !== (total > offset + query.pageSize)
        ) return UNAVAILABLE;

        return Object.freeze({
          kind: 'ready' as const,
          records,
          pageInfo: Object.freeze({
            page: query.page,
            pageSize: query.pageSize,
            hasMore,
            total,
            pageCount: total === 0
              ? 0
              : Math.min(
                  APPOINTMENT_LIST_MAX_PAGE_V1,
                  Math.ceil(total / query.pageSize),
                ),
          }),
          summary: Object.freeze({
            total: totalAll,
            statusCounts: Object.freeze(statusCounts),
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
      typeof (record.source as AppointmentListSourceV1).list === 'function' &&
      typeof (record.source as AppointmentListSourceV1).summarize === 'function'
      ? (record.source as AppointmentListSourceV1)
      : null,
  );
}
