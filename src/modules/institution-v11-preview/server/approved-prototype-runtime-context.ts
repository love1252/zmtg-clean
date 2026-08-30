import { eq } from 'drizzle-orm';

import type { ApprovedPrototypeRuntimeContextV1 } from '@/modules/institution-v11-preview/server/approved-prototype-assets';
import { getDatabase } from '@/server/db/client';
import { tenants } from '@/server/db/schema';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';

/**
 * Resolves the low-sensitivity presentation context from the same authority-bearing
 * institution scope that unlocks the Approved runtime. No caller-provided scope is accepted.
 */
export async function resolveApprovedPrototypeRuntimeContextV1(): Promise<
  ApprovedPrototypeRuntimeContextV1 | null
> {
  try {
    const authorityStatus =
      await resolveInstitutionCapabilityAuthorityStatusV1();
    if (!authorityStatus) return null;
    const { scope } = authorityStatus;

    const tenantRows = await getDatabase()
      .select({ name: tenants.name, status: tenants.status })
      .from(tenants)
      .where(eq(tenants.id, scope.tenantId))
      .limit(2);
    const tenant = tenantRows.length === 1 ? tenantRows[0] : null;
    if (!tenant || tenant.status !== 'active' || tenant.name.trim().length === 0) {
      return null;
    }

    return Object.freeze({
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      institutionName: tenant.name.trim(),
    });
  } catch {
    return null;
  }
}
