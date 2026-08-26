import { and, asc, count, eq, gte, ilike, lt, or } from 'drizzle-orm';

import {
  APPOINTMENT_LIST_STATUSES_V1,
  type AppointmentListSourceQueryV1,
  type AppointmentListSourceSummaryQueryV1,
  type AppointmentListSourceV1,
} from '@/modules/care/ports/appointment-list-source';
import type { TenantDatabase } from '@/server/db/client';
import { appointments } from '@/server/db/schema';

const PAGE_SIZES_WITH_SENTINEL = Object.freeze([11, 21, 51, 101] as const);
const MAX_OFFSET = 9900;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const canonicalUtcInstant =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function isCanonicalUtcInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !canonicalUtcInstant.test(value)) return false;
  const epochMs = Date.parse(value);
  return Number.isFinite(epochMs) && new Date(epochMs).toISOString() === value;
}

function isFilter(
  value: AppointmentListSourceQueryV1 | AppointmentListSourceSummaryQueryV1,
): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.tenantId === 'string' &&
    idPattern.test(value.tenantId) &&
    typeof value.institutionId === 'string' &&
    idPattern.test(value.institutionId) &&
    (value.keyword === null ||
      (typeof value.keyword === 'string' &&
        value.keyword.length > 0 &&
        value.keyword.length <= 80 &&
        value.keyword.trim() === value.keyword &&
        !/[\u0000-\u001f\u007f]/u.test(value.keyword))) &&
    ((value.scheduledFrom === null && value.scheduledBefore === null) ||
      (isCanonicalUtcInstant(value.scheduledFrom) &&
        isCanonicalUtcInstant(value.scheduledBefore) &&
        value.scheduledFrom < value.scheduledBefore))
  );
}

function isQuery(value: AppointmentListSourceQueryV1): boolean {
  const pageSize = value.limit - 1;
  return (
    isFilter(value) &&
    (value.status === null ||
      APPOINTMENT_LIST_STATUSES_V1.some((item) => item === value.status)) &&
    PAGE_SIZES_WITH_SENTINEL.some((limit) => limit === value.limit) &&
    Number.isSafeInteger(value.offset) &&
    value.offset >= 0 &&
    value.offset <= MAX_OFFSET &&
    value.offset % pageSize === 0
  );
}

function conditionsFor(
  query: AppointmentListSourceQueryV1 | AppointmentListSourceSummaryQueryV1,
) {
  const conditions = [
    eq(appointments.tenantId, query.tenantId),
    eq(appointments.institutionId, query.institutionId),
  ];
  if ('status' in query && query.status !== null) {
    conditions.push(eq(appointments.status, query.status));
  }
  if (query.keyword !== null) {
    const escaped = query.keyword.replace(/[\\%_]/gu, '\\$&');
    const keywordCondition = or(
      ilike(appointments.customerDisplayName, `%${escaped}%`),
      ilike(appointments.project, `%${escaped}%`),
    );
    if (keywordCondition) conditions.push(keywordCondition);
  }
  if (query.scheduledFrom !== null && query.scheduledBefore !== null) {
    conditions.push(gte(appointments.scheduledAt, new Date(query.scheduledFrom)));
    conditions.push(lt(appointments.scheduledAt, new Date(query.scheduledBefore)));
  }
  return conditions;
}

export function createAppointmentListRepository(
  database: TenantDatabase,
): AppointmentListSourceV1 {
  return Object.freeze({
    async list(query: AppointmentListSourceQueryV1) {
      if (!isQuery(query)) {
        throw new Error('invalid_appointment_list_source_query');
      }

      const rows = await database
        .select({
          appointmentId: appointments.id,
          customerDisplayName: appointments.customerDisplayName,
          project: appointments.project,
          scheduledAt: appointments.scheduledAt,
          status: appointments.status,
          updatedAt: appointments.updatedAt,
          tenantId: appointments.tenantId,
          institutionId: appointments.institutionId,
        })
        .from(appointments)
        .where(and(...conditionsFor(query)))
        .orderBy(asc(appointments.scheduledAt), asc(appointments.id))
        .limit(query.limit)
        .offset(query.offset);

      if (rows.length > query.limit) {
        throw new Error('appointment_list_source_overflow');
      }

      return Object.freeze(
        rows.map((row) => {
          if (!row.institutionId) {
            throw new Error('appointment_institution_attribution_missing');
          }
          return Object.freeze({
            appointmentId: row.appointmentId,
            customerDisplayName: row.customerDisplayName,
            project: row.project,
            scheduledAt: row.scheduledAt.toISOString(),
            status: row.status,
            updatedAt: row.updatedAt.toISOString(),
            tenantId: row.tenantId,
            institutionId: row.institutionId,
          });
        }),
      );
    },
    async summarize(query: AppointmentListSourceSummaryQueryV1) {
      if (!isFilter(query)) {
        throw new Error('invalid_appointment_list_summary_query');
      }

      const rows = await database
        .select({
          status: appointments.status,
          total: count(appointments.id),
          tenantId: appointments.tenantId,
          institutionId: appointments.institutionId,
        })
        .from(appointments)
        .where(and(...conditionsFor(query)))
        .groupBy(
          appointments.status,
          appointments.tenantId,
          appointments.institutionId,
        );

      if (rows.length > APPOINTMENT_LIST_STATUSES_V1.length) {
        throw new Error('appointment_list_summary_overflow');
      }

      return Object.freeze(
        rows.map((row) => {
          if (
            !row.institutionId ||
            typeof row.total !== 'number' ||
            !Number.isSafeInteger(row.total) ||
            row.total < 0
          ) {
            throw new Error('appointment_list_summary_unavailable');
          }
          return Object.freeze({
            status: row.status,
            total: row.total,
            tenantId: row.tenantId,
            institutionId: row.institutionId,
          });
        }),
      );
    },
  });
}
