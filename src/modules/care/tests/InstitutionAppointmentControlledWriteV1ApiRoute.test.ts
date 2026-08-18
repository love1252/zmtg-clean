
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readAppointment: vi.fn(),
  mutateAppointment: vi.fn(),
}));

vi.mock(
  '@/server/orchestration/institution-appointment-controlled-write-runtime',
  () => ({
    readCurrentInstitutionAppointmentControlledV1:
      mocks.readAppointment,
    mutateCurrentInstitutionAppointmentControlledV1:
      mocks.mutateAppointment,
  }),
);

import {
  GET,
  PATCH,
} from '@/app/api/v1/institution/appointments/[appointmentId]/route';

const record = {
  contractVersion: 'v1',
  appointmentId: 'appointment-1',
  scheduledAt: '2026-08-20T08:30:00.000Z',
  status: 'confirmed',
  updatedAt: '2026-08-18T04:30:00.000Z',
  permissions: {
    canOperate: true,
    canReschedule: true,
    canCancel: true,
  },
};

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.readAppointment.mockResolvedValue({
    kind: 'ready',
    record,
  });
  mocks.mutateAppointment.mockResolvedValue({
    kind: 'ready',
    record,
  });
});

describe('/api/v1/institution/appointments/[appointmentId]', () => {
  it('GET returns a low-sensitive controlled detail', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/v1/institution/appointments/appointment-1',
      ),
      {
        params: Promise.resolve({
          appointmentId: 'appointment-1',
        }),
      },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: 'ready',
      record,
    });
    expect(mocks.readAppointment).toHaveBeenCalledWith(
      'appointment-1',
    );
  });

  it('PATCH delegates CAS mutation and maps conflict', async () => {
    const command = {
      command: 'transition',
      expectedUpdatedAt: record.updatedAt,
      targetStatus: 'arrived',
    };
    const response = await PATCH(
      new Request(
        'http://localhost/api/v1/institution/appointments/appointment-1',
        {
          method: 'PATCH',
          body: JSON.stringify(command),
        },
      ),
      {
        params: Promise.resolve({
          appointmentId: 'appointment-1',
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(mocks.mutateAppointment).toHaveBeenCalledWith(
      'appointment-1',
      command,
    );

    mocks.mutateAppointment.mockResolvedValueOnce({
      kind: 'conflict',
      code: 'stale_update',
    });
    const conflict = await PATCH(
      new Request(
        'http://localhost/api/v1/institution/appointments/appointment-1',
        {
          method: 'PATCH',
          body: JSON.stringify(command),
        },
      ),
      {
        params: Promise.resolve({
          appointmentId: 'appointment-1',
        }),
      },
    );
    expect(conflict.status).toBe(409);
  });
});
