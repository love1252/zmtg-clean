import { and, asc, eq } from 'drizzle-orm';

import {
  APPOINTMENT_LIST_STATUSES_V1,
  type AppointmentListSourceQueryV1,
  type AppointmentListSourceV1,
} from '@/modules/care/ports/appointment-list-source';
import type { TenantDatabase } from '@/server/db/client';
import { appointments } from '@/server/db/schema';

const PAGE_SIZE_WITH_SENTINEL = 21;
const MAX_OFFSET = 1980;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

function isQuery(value: AppointmentListSourceQueryV1): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.tenantId === 'string' &&
    idPattern.test(value.tenantId) &&
    typeof value.institutionId === 'string' &&
    idPattern.test(value.institutionId) &&
    (value.status === null ||
      APPOINTMENT_LIST_STATUSES_V1.some((item) => item === value.status)) &&
    value.limit === PAGE_SIZE_WITH_SENTINEL &&
    Number.isSafeInteger(value.offset) &&
    value.offset >= 0 &&
    value.offset <= MAX_OFFSET &&
    value.offset % 20 === 0
  );
}

export function createAppointmentListRepository(
  database: TenantDatabase,
): AppointmentListSourceV1 {
  return Object.freeze({
    async list(query: AppointmentListSourceQueryV1) {
      if (!isQuery(query)) {
        throw new Error('invalid_appointment_list_source_query');
      }

      const conditions = [
        eq(appointments.tenantId, query.tenantId),
        eq(appointments.institutionId, query.institutionId),
      ];
      if (query.status !== null) {
        conditions.push(eq(appointments.status, query.status));
      }

      const rows = await database
        .select({
          appointmentId: appointments.id,
          scheduledAt: appointments.scheduledAt,
          status: appointments.status,
          updatedAt: appointments.updatedAt,
          tenantId: appointments.tenantId,
          institutionId: appointments.institutionId,
        })
        .from(appointments)
        .where(and(...conditions))
        .orderBy(asc(appointments.scheduledAt), asc(appointments.id))
        .limit(query.limit)
        .offset(query.offset);

      if (rows.length > PAGE_SIZE_WITH_SENTINEL) {
        throw new Error('appointment_list_source_overflow');
      }

      return Object.freeze(
        rows.map((row) => {
          if (!row.institutionId) {
            throw new Error('appointment_institution_attribution_missing');
          }
          return Object.freeze({
            appointmentId: row.appointmentId,
            scheduledAt: row.scheduledAt.toISOString(),
            status: row.status,
            updatedAt: row.updatedAt.toISOString(),
            tenantId: row.tenantId,
            institutionId: row.institutionId,
          });
        }),
      );
    },
  });
}
