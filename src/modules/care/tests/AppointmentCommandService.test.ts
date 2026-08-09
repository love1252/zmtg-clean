import { describe, expect, it, vi } from 'vitest';

import {
  AppointmentCommandInputError,
  createAppointmentCommandService,
  type AppointmentCommandRepository,
  type CreateAppointmentCommandResult,
  type UpdateAppointmentCommandResult,
} from '@/modules/care/application/appointment-command-service';

function repositoryMock() {
  const create = vi.fn<AppointmentCommandRepository['create']>(
    async (_input): Promise<CreateAppointmentCommandResult> => ({
      kind: 'invalid_reference',
      reason: 'customer_not_found_or_not_owned',
    }),
  );
  const update = vi.fn<AppointmentCommandRepository['update']>(
    async (_input): Promise<UpdateAppointmentCommandResult> => ({
      kind: 'not_found_or_not_owned',
    }),
  );
  const repository: AppointmentCommandRepository = { create, update };
  return { create, repository, update };
}

describe('AppointmentCommandService', () => {
  it('create 只接受 server-side tenant + institution attribution 并复制 scheduledAt', async () => {
    const mock = repositoryMock();
    const service = createAppointmentCommandService(mock.repository);
    const scheduledAt = new Date('2026-08-10T03:00:00.000Z');

    await service.createAppointment({
      attribution: { tenantId: 'tenant-a', institutionId: 'institution-a' },
      appointment: {
        id: 'appointment-a',
        customerId: 'customer-a',
        project: 'low-sensitive-project',
        scheduledAt,
        consultantUserId: 'consultant-a',
        status: 'pending_confirmation',
        note: 'manual confirmation',
      },
    });

    expect(mock.create).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      id: 'appointment-a',
      customerId: 'customer-a',
      project: 'low-sensitive-project',
      scheduledAt: new Date('2026-08-10T03:00:00.000Z'),
      consultantUserId: 'consultant-a',
      status: 'pending_confirmation',
      note: 'manual confirmation',
    });
    expect(mock.create.mock.calls[0]?.[0]?.scheduledAt).not.toBe(scheduledAt);
  });

  it('missing / malformed institution attribution 在 repository 前 fail-closed', async () => {
    const mock = repositoryMock();
    const service = createAppointmentCommandService(mock.repository);

    await expect(
      service.createAppointment({
        attribution: { tenantId: 'tenant-a', institutionId: '' },
        appointment: {
          id: 'appointment-a',
          customerId: 'customer-a',
          project: 'project',
          scheduledAt: new Date('2026-08-10T03:00:00.000Z'),
          consultantUserId: 'consultant-a',
          status: 'pending_confirmation',
          note: '',
        },
      }),
    ).rejects.toBeInstanceOf(AppointmentCommandInputError);

    await expect(
      service.createAppointment({
        attribution: { tenantId: ' tenant-a', institutionId: 'institution-a' },
        appointment: {
          id: 'appointment-a',
          customerId: 'customer-a',
          project: 'project',
          scheduledAt: new Date('2026-08-10T03:00:00.000Z'),
          consultantUserId: 'consultant-a',
          status: 'pending_confirmation',
          note: '',
        },
      }),
    ).rejects.toThrow('invalid_tenant_id');

    expect(mock.create).not.toHaveBeenCalled();
  });

  it('update 显式携带 canonical expectedUpdatedAt CAS', async () => {
    const mock = repositoryMock();
    const service = createAppointmentCommandService(mock.repository);

    await service.updateAppointment({
      attribution: { tenantId: 'tenant-a', institutionId: 'institution-a' },
      appointmentId: 'appointment-a',
      expectedUpdatedAt: '2026-08-09T13:30:00.000Z',
      status: 'confirmed',
      note: 'confirmed manually',
    });

    expect(mock.update).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      appointmentId: 'appointment-a',
      expectedUpdatedAt: '2026-08-09T13:30:00.000Z',
      status: 'confirmed',
      note: 'confirmed manually',
    });
  });

  it('update 拒绝非 canonical timestamp，避免退化为无版本更新', async () => {
    const mock = repositoryMock();
    const service = createAppointmentCommandService(mock.repository);

    await expect(
      service.updateAppointment({
        attribution: { tenantId: 'tenant-a', institutionId: 'institution-a' },
        appointmentId: 'appointment-a',
        expectedUpdatedAt: 'not-a-timestamp',
        status: 'confirmed',
        note: '',
      }),
    ).rejects.toThrow('invalid_expected_updated_at');

    expect(mock.update).not.toHaveBeenCalled();
  });
});
