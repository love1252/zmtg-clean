import type { AppointmentListStatusV1 } from '@/modules/care/ports/appointment-list-source';

export const APPOINTMENT_LIST_PAGE_SIZE_V1 = 20;
export const APPOINTMENT_LIST_MAX_PAGE_V1 = 100;
export const APPOINTMENT_LIST_MAX_OFFSET_V1 = 1980;

export type AppointmentListItemV1 = Readonly<{
  contractVersion: 'v1';
  appointmentId: string;
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
        pageSize: typeof APPOINTMENT_LIST_PAGE_SIZE_V1;
        hasMore: boolean;
      }>;
    }>
  | Readonly<{
      kind: 'invalid_query';
      code: 'invalid_appointment_query';
    }>
  | Readonly<{ kind: 'unavailable' }>;
