import type { AppointmentListStatusV1 } from '@/modules/care/ports/appointment-list-source';

export const APPOINTMENT_LIST_PAGE_SIZE_V1 = 20;
export const APPOINTMENT_LIST_PAGE_SIZES_V1 = Object.freeze([
  10,
  20,
  50,
  100,
] as const);
export type AppointmentListPageSizeV1 =
  (typeof APPOINTMENT_LIST_PAGE_SIZES_V1)[number];
export const APPOINTMENT_LIST_MAX_PAGE_V1 = 100;
export const APPOINTMENT_LIST_MAX_OFFSET_V1 = 9900;

export type AppointmentListItemV1 = Readonly<{
  contractVersion: 'v1';
  appointmentId: string;
  customerDisplayName: string;
  project: string;
  scheduledAt: string;
  status: AppointmentListStatusV1;
  updatedAt: string;
}>;

export type AppointmentListReaderResultV1 =
  | Readonly<{
      kind: 'ready';
      records: readonly AppointmentListItemV1[];
      pageInfo: Readonly<{
        page: number;
        pageSize: AppointmentListPageSizeV1;
        hasMore: boolean;
        total: number;
        pageCount: number;
      }>;
      summary: Readonly<{
        total: number;
        statusCounts: Readonly<Record<AppointmentListStatusV1, number>>;
      }>;
    }>
  | Readonly<{
      kind: 'invalid_query';
      code: 'invalid_appointment_query';
    }>
  | Readonly<{ kind: 'unavailable' }>;
