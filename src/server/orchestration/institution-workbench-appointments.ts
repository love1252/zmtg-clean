import type { WorkbenchAppointmentResultV1 } from '@/modules/care/application/workbench-appointment-view';
import { readWorkbenchAppointmentsV1 } from '@/modules/care/server/workbench-appointment-repository';
import { getDatabase } from '@/server/db/client';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from './institution-capability-authority';
import { consumeInstitutionCareReadAuthorizationV1, resolveInstitutionCareReadAuthorizationV1 } from './institution-care-read-authorization';

export async function readCurrentInstitutionWorkbenchAppointmentsV1(): Promise<WorkbenchAppointmentResultV1> {
  try {
    const resolution = await resolveInstitutionCareReadAuthorizationV1();
    if (resolution.kind !== 'allowed') return { kind: resolution.kind };
    const scope = consumeInstitutionCareReadAuthorizationV1(resolution.authorization);
    if (!scope) return { kind: 'unavailable' };
    const status = await resolveInstitutionCapabilityAuthorityStatusV1();
    const matches = status?.data?.capabilities.filter(item => item.key === 'page_care_appointments') ?? [];
    const partitions = status?.partitions.filter(item => item.key === 'page_care_appointments') ?? [];
    const capability = matches[0];
    if (!status || status.scope.tenantId !== scope.tenantId || status.scope.institutionId !== scope.institutionId
      || status.contractVersion !== 'v1' || status.readiness !== 'ready' || status.failureCode !== null
      || matches.length !== 1 || partitions.length !== 1 || !capability
      || !['operational', 'read_only'].includes(capability.decision)
      || capability.dimensions.codeMaturity !== 'verified'
      || capability.dimensions.institutionAuthorization !== 'authorized'
      || capability.dimensions.connectionAvailability !== 'not_required'
      || capability.dimensions.dataReadiness !== 'ready'
      || capability.dimensions.productionRelease !== 'pilot_released'
      || capability.safeSummary !== (capability.decision === 'operational' ? '预约管理可用' : '预约管理仅供查看')
      || partitions[0]?.readiness !== 'ready' || partitions[0].failureCode !== null) return { kind: 'unavailable' };
    return await readWorkbenchAppointmentsV1(getDatabase(), {
      tenantId: scope.tenantId, institutionId: scope.institutionId, referenceTime: new Date().toISOString(),
    });
  } catch {
    return { kind: 'unavailable' };
  }
}
