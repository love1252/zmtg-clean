import { isProxy } from 'node:util/types';
import {
  parseAppointmentListQueryV1,
  parseAppointmentSourceRowV1,
} from './appointment-list-reader';
import type { AppointmentCalendarResultV1 } from './appointment-calendar-contract';
import type { AppointmentListItemV1 } from './appointment-list-pagination-contract';
import { APPOINTMENT_CALENDAR_LIMIT_V1, type AppointmentCalendarSourceV1 } from '../ports/appointment-list-source';

const UNAVAILABLE = Object.freeze({ kind: 'unavailable' } as const);
const INVALID = Object.freeze({ kind: 'invalid_query', code: 'invalid_appointment_query' } as const);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
type CalendarInput = Readonly<{ tenantId: string; institutionId: string; searchParams: URLSearchParams }>;

function snapshotInput(value: unknown): CalendarInput | null {
  if (!value || typeof value !== 'object' || isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = ['tenantId', 'institutionId', 'searchParams'] as const;
  if (Reflect.ownKeys(descriptors).length !== keys.length || keys.some((key) => !descriptors[key]?.enumerable || !('value' in descriptors[key]))) return null;
  const tenantId = descriptors.tenantId.value;
  const institutionId = descriptors.institutionId.value;
  const searchParams = descriptors.searchParams.value;
  if (typeof tenantId !== 'string' || typeof institutionId !== 'string' || !idPattern.test(tenantId) || !idPattern.test(institutionId) || !(searchParams instanceof URLSearchParams) || isProxy(searchParams)) return null;
  return Object.freeze({ tenantId, institutionId, searchParams: new URLSearchParams(searchParams) });
}

export function createAppointmentCalendarReaderV1({ source }: Readonly<{ source: AppointmentCalendarSourceV1 }>) {
  return Object.freeze({
    async read(value: CalendarInput): Promise<AppointmentCalendarResultV1> {
      try {
        const input = snapshotInput(value);
        if (!input) return UNAVAILABLE;
        const query = parseAppointmentListQueryV1(input.searchParams);
        if (!query || input.searchParams.has('page') || input.searchParams.has('pageSize') ||
          query.scheduledFrom === null || query.scheduledBefore === null ||
          Date.parse(query.scheduledBefore) - Date.parse(query.scheduledFrom) > 7 * 86400000) return INVALID;
        if (!source || isProxy(source) || typeof source.listCalendar !== 'function' || isProxy(source.listCalendar)) return UNAVAILABLE;
        const rows = await source.listCalendar({
          tenantId: input.tenantId, institutionId: input.institutionId,
          status: query.status, keyword: query.keyword,
          scheduledFrom: query.scheduledFrom, scheduledBefore: query.scheduledBefore,
          limit: APPOINTMENT_CALENDAR_LIMIT_V1 + 1, offset: 0,
        });
        if (!Array.isArray(rows) || isProxy(rows) || rows.length > APPOINTMENT_CALENDAR_LIMIT_V1 + 1) return UNAVAILABLE;
        const ids = new Set<string>();
        const records: AppointmentListItemV1[] = [];
        for (const value of rows) {
          const row = parseAppointmentSourceRowV1(value, input.tenantId, input.institutionId);
          if (!row || ids.has(row.appointmentId) || row.scheduledAt < query.scheduledFrom || row.scheduledAt >= query.scheduledBefore ||
            (query.status !== null && row.status !== query.status)) return UNAVAILABLE;
          ids.add(row.appointmentId);
          records.push(Object.freeze({ contractVersion: 'v1', appointmentId: row.appointmentId,
            customerDisplayName: row.customerDisplayName, project: row.project, scheduledAt: row.scheduledAt,
            status: row.status, updatedAt: row.updatedAt }));
        }
        if (records.length > APPOINTMENT_CALENDAR_LIMIT_V1) return Object.freeze({ kind: 'too_many', limit: APPOINTMENT_CALENDAR_LIMIT_V1 });
        return Object.freeze({ kind: 'ready', records: Object.freeze(records), range: Object.freeze({
          startDate: input.searchParams.get('startDate')!, endDate: input.searchParams.get('endDate')!,
        }) });
      } catch {
        return UNAVAILABLE;
      }
    },
  });
}
