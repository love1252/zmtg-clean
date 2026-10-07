import type { AppointmentListItemV1 } from './appointment-list-pagination-contract';

export type WorkbenchAppointmentResultV1 = Readonly<{
  kind: 'ready';
  businessDate: string;
  timeZone: 'Asia/Shanghai';
  observedAt: string;
  today: Readonly<{ total: number; records: readonly AppointmentListItemV1[] }>;
  pending: Readonly<{ total: number; records: readonly AppointmentListItemV1[] }>;
  rescheduled: Readonly<{ total: number; records: readonly AppointmentListItemV1[] }>;
}> | Readonly<{ kind: 'unavailable' | 'forbidden' }>;
