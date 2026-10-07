import { createAppointmentCalendarReaderV1 } from '@/modules/care/application/appointment-calendar-reader';
import type { AppointmentCalendarResultV1 } from '@/modules/care/application/appointment-calendar-contract';
import { createAppointmentListRepository } from '@/modules/care/server/appointment-list-repository';
import { getDatabase } from '@/server/db/client';
import { consumeInstitutionCareReadAuthorizationV1, resolveInstitutionCareReadAuthorizationV1 } from './institution-care-read-authorization';

export async function readCurrentInstitutionAppointmentCalendarV1(searchParams: URLSearchParams): Promise<AppointmentCalendarResultV1 | Readonly<{ kind: 'forbidden' }>> {
  try {
    const resolution = await resolveInstitutionCareReadAuthorizationV1();
    if (resolution.kind === 'forbidden') return { kind: 'forbidden' };
    if (resolution.kind !== 'allowed') return { kind: 'unavailable' };
    const pair = consumeInstitutionCareReadAuthorizationV1(resolution.authorization);
    if (!pair) return { kind: 'unavailable' };
    const reader = createAppointmentCalendarReaderV1({ source: createAppointmentListRepository(getDatabase()) });
    return await reader.read({ tenantId: pair.tenantId, institutionId: pair.institutionId, searchParams });
  } catch {
    return { kind: 'unavailable' };
  }
}
