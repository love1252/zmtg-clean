import type { AppointmentListItemV1 } from './appointment-list-pagination-contract';

export type AppointmentCalendarResultV1 =
  | Readonly<{ kind: 'ready'; records: readonly AppointmentListItemV1[]; range: Readonly<{ startDate: string; endDate: string }> }>
  | Readonly<{ kind: 'too_many'; limit: number }>
  | Readonly<{ kind: 'invalid_query'; code: 'invalid_appointment_query' }>
  | Readonly<{ kind: 'unavailable' }>;

export function isAppointmentDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || value < '0100-01-01') return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function shiftAppointmentDate(value: string, days: number): string | null {
  if (!isAppointmentDate(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  return isAppointmentDate(result) ? result : null;
}

export function appointmentShanghaiDate(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}

export function appointmentCalendarRange(date: string, view: 'day' | 'week') {
  if (!isAppointmentDate(date)) return null;
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const startDate = view === 'day' ? date : shiftAppointmentDate(date, -((weekday + 6) % 7));
  const endDate = startDate && shiftAppointmentDate(startDate, view === 'day' ? 0 : 6);
  return startDate && endDate ? { startDate, endDate } : null;
}

export function appointmentShanghaiTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '时间不可用';
  return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
}
