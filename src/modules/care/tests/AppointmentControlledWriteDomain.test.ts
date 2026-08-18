
import { describe, expect, it } from 'vitest';

import {
  canAppointmentControlledCancelV1,
  canAppointmentControlledRescheduleV1,
  canAppointmentControlledTransitionV1,
} from '@/modules/care/domain/appointment-controlled-write';

describe('Appointment controlled-write domain', () => {
  it('allows only the frozen forward status transitions', () => {
    expect(
      canAppointmentControlledTransitionV1(
        'pending_confirmation',
        'confirmed',
      ),
    ).toBe(true);
    expect(
      canAppointmentControlledTransitionV1(
        'confirmed',
        'arrived',
      ),
    ).toBe(true);
    expect(
      canAppointmentControlledTransitionV1(
        'arrived',
        'completed',
      ),
    ).toBe(true);
    expect(
      canAppointmentControlledTransitionV1(
        'completed',
        'confirmed',
      ),
    ).toBe(false);
  });

  it('limits reschedule to pre-terminal appointment states', () => {
    expect(
      canAppointmentControlledRescheduleV1(
        'pending_confirmation',
      ),
    ).toBe(true);
    expect(
      canAppointmentControlledRescheduleV1(
        'reschedule_requested',
      ),
    ).toBe(true);
    expect(
      canAppointmentControlledRescheduleV1(
        'completed',
      ),
    ).toBe(false);
  });

  it('limits cancel to the frozen pre-arrival states', () => {
    expect(
      canAppointmentControlledCancelV1(
        'confirmed',
      ),
    ).toBe(true);
    expect(
      canAppointmentControlledCancelV1(
        'arrived',
      ),
    ).toBe(false);
    expect(
      canAppointmentControlledCancelV1(
        'cancelled',
      ),
    ).toBe(false);
  });
});
