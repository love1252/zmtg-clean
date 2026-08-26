import type { TenantDatabase } from '@/server/db/client';
import { customerSensitiveProfiles } from '@/server/db/schema';

type CustomerSensitiveProfileInsertV1 = typeof customerSensitiveProfiles.$inferInsert;

export type ImportedCustomerSensitiveProfileV1 = Readonly<{
  id: string;
  tenantId: string;
  institutionId: string;
  customerId: string;
  phoneDigest: string | null;
  protectedPhone: CustomerSensitiveProfileInsertV1['protectedPhone'];
  nationalIdDigest: string | null;
  protectedNationalId: CustomerSensitiveProfileInsertV1['protectedNationalId'];
  externalPatientIdDigest: string | null;
  protectedExternalPatientId: CustomerSensitiveProfileInsertV1['protectedExternalPatientId'];
  actorId: string;
}>;

export function createCustomerSensitiveProfileRepositoryV1(database: TenantDatabase) {
  return Object.freeze({
    async createImportedProfile(input: ImportedCustomerSensitiveProfileV1): Promise<void> {
      await database.insert(customerSensitiveProfiles).values({
        id: input.id,
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        customerId: input.customerId,
        phoneDigest: input.phoneDigest,
        protectedPhone: input.protectedPhone,
        nationalIdDigest: input.nationalIdDigest,
        protectedNationalId: input.protectedNationalId,
        externalPatientIdDigest: input.externalPatientIdDigest,
        protectedExternalPatientId: input.protectedExternalPatientId,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      });
    },
  });
}
