import {
  createCustomerListReaderV1,
  type CustomerListReaderResultV1,
} from '@/modules/customer-center/application/customer-list-reader';
import { createCustomerListRepository } from '@/modules/customers/server/customer-list-repository';
import { getDatabase } from '@/server/db/client';
import {
  consumeInstitutionCustomerReadAuthorizationV1,
  resolveInstitutionCustomerReadAuthorizationV1,
} from '@/server/orchestration/institution-customer-read-authorization';

export type InstitutionCustomerListResultV1 =
  | CustomerListReaderResultV1
  | Readonly<{ kind: 'forbidden' }>;

const FORBIDDEN = Object.freeze({ kind: 'forbidden' } as const);
const UNAVAILABLE = Object.freeze({ kind: 'unavailable' } as const);

export async function readCurrentInstitutionCustomersV1(
  searchParams: URLSearchParams,
): Promise<InstitutionCustomerListResultV1> {
  try {
    const resolution = await resolveInstitutionCustomerReadAuthorizationV1();
    if (resolution.kind === 'forbidden') return FORBIDDEN;
    if (resolution.kind !== 'allowed') return UNAVAILABLE;

    const pair = consumeInstitutionCustomerReadAuthorizationV1(
      resolution.authorization,
    );
    if (!pair) return UNAVAILABLE;

    const source = createCustomerListRepository(getDatabase());
    const reader = createCustomerListReaderV1({ source });
    return await reader.read({
      tenantId: pair.tenantId,
      institutionId: pair.institutionId,
      searchParams,
    });
  } catch {
    return UNAVAILABLE;
  }
}
