import { and, eq } from 'drizzle-orm';

import type { TenantDatabase } from '@/server/db/client';
import { institutionScopes } from '@/server/db/schema';

export type CurrentInstitutionAnchorFactRowV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  status: 'active' | 'suspended';
  revision: number;
}>;

export type InstitutionAnchorFactRepositoryV1 = Readonly<{
  findCurrentInstitutionAnchorFacts: (input: Readonly<{
    tenantId: string;
    institutionId: string;
  }>) => Promise<CurrentInstitutionAnchorFactRowV1[]>;
}>;

/**
 * Reads only the low-sensitivity fields needed to revalidate an institution anchor. The
 * repository deliberately returns up to two rows so the owner reader can fail closed if a
 * supposedly unique scope is duplicated. It does not issue guard evidence or authorize access.
 */
export function createInstitutionAnchorFactRepositoryV1(
  database: TenantDatabase,
): InstitutionAnchorFactRepositoryV1 {
  return Object.freeze({
    async findCurrentInstitutionAnchorFacts(input) {
      const rows = await database
        .select({
          tenantId: institutionScopes.tenantId,
          institutionId: institutionScopes.institutionId,
          status: institutionScopes.status,
          revision: institutionScopes.revision,
        })
        .from(institutionScopes)
        .where(
          and(
            eq(institutionScopes.tenantId, input.tenantId),
            eq(institutionScopes.institutionId, input.institutionId),
          ),
        )
        .limit(2);

      return rows as CurrentInstitutionAnchorFactRowV1[];
    },
  });
}
