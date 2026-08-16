import {
  createAppointmentListReaderV1,
  type AppointmentListReaderResultV1,
} from '@/modules/care/application/appointment-list-reader';
import { createAppointmentListRepository } from '@/modules/care/server/appointment-list-repository';
import { getDatabase } from '@/server/db/client';
import {
  consumeInstitutionCareReadAuthorizationV1,
  resolveInstitutionCareReadAuthorizationV1,
} from '@/server/orchestration/institution-care-read-authorization';

export type InstitutionAppointmentListResultV1 =
  | AppointmentListReaderResultV1
  | Readonly<{ kind: 'forbidden' }>;

const FORBIDDEN = Object.freeze({ kind: 'forbidden' } as const);
const UNAVAILABLE = Object.freeze({ kind: 'unavailable' } as const);

export async function readCurrentInstitutionAppointmentsV1(
  searchParams: URLSearchParams,
): Promise<InstitutionAppointmentListResultV1> {
  try {
    const resolution = await resolveInstitutionCareReadAuthorizationV1();
    if (resolution.kind === 'forbidden') return FORBIDDEN;
    if (resolution.kind !== 'allowed') return UNAVAILABLE;

    const pair = consumeInstitutionCareReadAuthorizationV1(
      resolution.authorization,
    );
    if (!pair) return UNAVAILABLE;

    const source = createAppointmentListRepository(getDatabase());
    const reader = createAppointmentListReaderV1({ source });
    return await reader.read({
      tenantId: pair.tenantId,
      institutionId: pair.institutionId,
      searchParams,
    });
  } catch {
    return UNAVAILABLE;
  }
}
