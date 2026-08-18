
import type { AppointmentCommandStatus } from '@/modules/care/application/appointment-command-service';

const transitions = Object.freeze({
  pending_confirmation: Object.freeze([
    'confirmed',
    'reschedule_requested',
    'cancelled',
  ]),
  confirmed: Object.freeze([
    'arrived',
    'reschedule_requested',
    'cancelled',
  ]),
  arrived: Object.freeze(['completed']),
  completed: Object.freeze([]),
  reschedule_requested: Object.freeze([
    'confirmed',
    'cancelled',
  ]),
  cancelled: Object.freeze([]),
} satisfies Readonly<Record<AppointmentCommandStatus, readonly AppointmentCommandStatus[]>>);

export function canAppointmentControlledTransitionV1(
  from: AppointmentCommandStatus,
  to: AppointmentCommandStatus,
): boolean {
  const allowed =
    transitions[from] as readonly AppointmentCommandStatus[];
  return allowed.includes(to);
}

export function canAppointmentControlledRescheduleV1(
  status: AppointmentCommandStatus,
): boolean {
  return (
    status === 'pending_confirmation'
    || status === 'confirmed'
    || status === 'reschedule_requested'
  );
}

export function canAppointmentControlledCancelV1(
  status: AppointmentCommandStatus,
): boolean {
  return (
    status === 'pending_confirmation'
    || status === 'confirmed'
    || status === 'reschedule_requested'
  );
}
