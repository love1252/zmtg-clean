import { and, eq } from 'drizzle-orm';

import type { CustomerReferenceV1 } from '@/modules/institution-contracts/v1/customer';
import type { TenantDatabase } from '@/server/db/client';
import { customers } from '@/server/db/schema';

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

export type CustomerReferenceQueryV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  customerId: string;
}>;

export function createCustomerReferenceRepositoryV1(database: TenantDatabase) {
  return Object.freeze({
    async resolve(
      input: CustomerReferenceQueryV1,
    ): Promise<CustomerReferenceV1 | null> {
      if (
        !idPattern.test(input.tenantId)
        || !idPattern.test(input.institutionId)
        || !idPattern.test(input.customerId)
      ) {
        return null;
      }

      const rows = await database
        .select({
          id: customers.id,
          displayName: customers.displayName,
          tenantId: customers.tenantId,
          institutionId: customers.institutionId,
        })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, input.tenantId),
            eq(customers.institutionId, input.institutionId),
            eq(customers.id, input.customerId),
          ),
        )
        .limit(2);

      if (
        rows.length !== 1
        || rows[0]?.tenantId !== input.tenantId
        || rows[0]?.institutionId !== input.institutionId
      ) {
        return null;
      }

      return Object.freeze({
        contractVersion: 'v1' as const,
        customerId: rows[0].id,
        displayName: rows[0].displayName,
        maskedReference: null,
      });
    },
  });
}
