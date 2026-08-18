
import {
  consumeInstitutionCustomerWriteAuthorizationV1,
  resolveInstitutionCustomerWriteAuthorizationV1,
} from '@/server/orchestration/institution-customer-write-authorization';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';

export async function canCurrentInstitutionCreateFormalCustomerV1(): Promise<boolean> {
  try {
    const resolution = await resolveInstitutionCustomerWriteAuthorizationV1();
    if (resolution.kind !== 'allowed') return false;

    const actor = consumeInstitutionCustomerWriteAuthorizationV1(
      resolution.authorization,
    );
    if (
      !actor ||
      (actor.role !== 'tenant_admin' && actor.role !== 'tenant_operator')
    ) {
      return false;
    }

    const status = await resolveInstitutionCapabilityAuthorityStatusV1();
    if (
      !status ||
      status.contractVersion !== 'v1' ||
      status.scope.tenantId !== actor.tenantId ||
      status.scope.institutionId !== actor.institutionId ||
      status.readiness !== 'ready' ||
      status.failureCode !== null ||
      !status.data
    ) {
      return false;
    }

    const capabilities = status.data.capabilities.filter(
      (item) => item.key === 'action_customer_create',
    );
    const partitions = status.partitions.filter(
      (item) => item.key === 'action_customer_create',
    );

    return (
      capabilities.length === 1 &&
      partitions.length === 1 &&
      capabilities[0]?.decision === 'operational' &&
      capabilities[0].dimensions.codeMaturity === 'verified' &&
      capabilities[0].dimensions.institutionAuthorization === 'authorized' &&
      capabilities[0].dimensions.connectionAvailability === 'not_required' &&
      capabilities[0].dimensions.dataReadiness === 'ready' &&
      capabilities[0].dimensions.productionRelease === 'pilot_released' &&
      capabilities[0].safeSummary === null &&
      partitions[0]?.readiness === 'ready' &&
      partitions[0].failureCode === null
    );
  } catch {
    return false;
  }
}
