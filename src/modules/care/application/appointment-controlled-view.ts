
import type { AppointmentCommandStatus } from '@/modules/care/application/appointment-command-service';

export type AppointmentControlledDtoV1 = Readonly<{
  contractVersion: 'v1';
  appointmentId: string;
  scheduledAt: string;
  status: AppointmentCommandStatus;
  updatedAt: string;
  permissions: Readonly<{
    canOperate: boolean;
    canReschedule: boolean;
    canCancel: boolean;
  }>;
}>;
