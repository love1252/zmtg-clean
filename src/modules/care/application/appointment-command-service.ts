export const appointmentCommandStatuses = [
  'pending_confirmation',
  'confirmed',
  'arrived',
  'completed',
  'reschedule_requested',
  'cancelled',
] as const;

export type AppointmentCommandStatus = (typeof appointmentCommandStatuses)[number];

export type AppointmentCommandAttribution = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

export type AppointmentCommandRecord = AppointmentCommandAttribution &
  Readonly<{
    id: string;
    customerId: string;
    customerDisplayName: string;
    project: string;
    scheduledAt: string;
    consultantUserId: string;
    status: AppointmentCommandStatus;
    note: string;
    createdAt: string;
    updatedAt: string;
  }>;

export type CreateAppointmentCommandResult =
  | { kind: 'created'; record: AppointmentCommandRecord }
  | { kind: 'invalid_reference'; reason: 'customer_not_found_or_not_owned' }
  | { kind: 'conflict'; resourceId: string; reason: 'appointment_conflict' };

export type UpdateAppointmentCommandResult =
  | { kind: 'updated'; record: AppointmentCommandRecord }
  | { kind: 'not_found_or_not_owned' }
  | { kind: 'conflict'; resourceId: string; reason: 'stale_update' };

export type CreateAppointmentCommand = Readonly<{
  attribution: AppointmentCommandAttribution;
  appointment: Readonly<{
    id: string;
    customerId: string;
    project: string;
    scheduledAt: Date;
    consultantUserId: string;
    status: AppointmentCommandStatus;
    note: string;
  }>;
}>;

export type UpdateAppointmentCommand = Readonly<{
  attribution: AppointmentCommandAttribution;
  appointmentId: string;
  expectedUpdatedAt: string;
  status: AppointmentCommandStatus;
  note: string;
}>;

export interface AppointmentCommandRepository {
  create(
    input: AppointmentCommandAttribution &
      Readonly<{
        id: string;
        customerId: string;
        project: string;
        scheduledAt: Date;
        consultantUserId: string;
        status: AppointmentCommandStatus;
        note: string;
      }>,
  ): Promise<CreateAppointmentCommandResult>;

  update(
    input: AppointmentCommandAttribution &
      Readonly<{
        appointmentId: string;
        expectedUpdatedAt: string;
        status: AppointmentCommandStatus;
        note: string;
      }>,
  ): Promise<UpdateAppointmentCommandResult>;
}

export class AppointmentCommandInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentCommandInputError';
  }
}

function requireExactIdentifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new AppointmentCommandInputError(`invalid_${field}`);
  }
  return value;
}

function copyString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new AppointmentCommandInputError(`invalid_${field}`);
  }
  return value;
}

function copyDate(value: Date): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new AppointmentCommandInputError('invalid_scheduled_at');
  }
  return new Date(value.getTime());
}

function requireStatus(value: unknown): AppointmentCommandStatus {
  if (
    typeof value !== 'string' ||
    !appointmentCommandStatuses.includes(value as AppointmentCommandStatus)
  ) {
    throw new AppointmentCommandInputError('invalid_appointment_status');
  }
  return value as AppointmentCommandStatus;
}

function requireCanonicalIsoTimestamp(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new AppointmentCommandInputError('invalid_expected_updated_at');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new AppointmentCommandInputError('invalid_expected_updated_at');
  }
  return value;
}

function normalizeAttribution(
  attribution: AppointmentCommandAttribution,
): AppointmentCommandAttribution {
  return {
    tenantId: requireExactIdentifier(attribution?.tenantId, 'tenant_id'),
    institutionId: requireExactIdentifier(attribution?.institutionId, 'institution_id'),
  };
}

export function createAppointmentCommandService(
  repository: AppointmentCommandRepository,
) {
  return Object.freeze({
    async createAppointment(input: CreateAppointmentCommand) {
      return repository.create({
        ...normalizeAttribution(input.attribution),
        id: requireExactIdentifier(input.appointment.id, 'appointment_id'),
        customerId: requireExactIdentifier(input.appointment.customerId, 'customer_id'),
        project: copyString(input.appointment.project, 'project'),
        scheduledAt: copyDate(input.appointment.scheduledAt),
        consultantUserId: requireExactIdentifier(
          input.appointment.consultantUserId,
          'consultant_user_id',
        ),
        status: requireStatus(input.appointment.status),
        note: copyString(input.appointment.note, 'note'),
      });
    },

    async updateAppointment(input: UpdateAppointmentCommand) {
      return repository.update({
        ...normalizeAttribution(input.attribution),
        appointmentId: requireExactIdentifier(input.appointmentId, 'appointment_id'),
        expectedUpdatedAt: requireCanonicalIsoTimestamp(input.expectedUpdatedAt),
        status: requireStatus(input.status),
        note: copyString(input.note, 'note'),
      });
    },
  });
}
