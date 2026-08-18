import { and, eq } from 'drizzle-orm';

import type { TenantDatabase } from '@/server/db/client';
import {
  institutionOperatingContexts,
  institutionOperatingContextVersions,
} from '@/server/db/schema';

export type InstitutionOperatingContextForCareV1 = Readonly<{
  timeZone: string;
  version: string;
}>;

export async function readInstitutionOperatingContextForCareV1(
  database: TenantDatabase,
  input: Readonly<{ tenantId: string; institutionId: string }>,
): Promise<InstitutionOperatingContextForCareV1 | null> {
  const rows = await database
    .select({
      tenantId: institutionOperatingContexts.tenantId,
      institutionId: institutionOperatingContexts.institutionId,
      latestVersion: institutionOperatingContexts.latestVersion,
      timeZone: institutionOperatingContextVersions.timezone,
    })
    .from(institutionOperatingContexts)
    .innerJoin(
      institutionOperatingContextVersions,
      and(
        eq(
          institutionOperatingContextVersions.tenantId,
          institutionOperatingContexts.tenantId,
        ),
        eq(
          institutionOperatingContextVersions.institutionId,
          institutionOperatingContexts.institutionId,
        ),
        eq(
          institutionOperatingContextVersions.version,
          institutionOperatingContexts.latestVersion,
        ),
      ),
    )
    .where(
      and(
        eq(institutionOperatingContexts.tenantId, input.tenantId),
        eq(institutionOperatingContexts.institutionId, input.institutionId),
      ),
    )
    .limit(2);

  if (rows.length !== 1) return null;
  const row = rows[0];
  if (
    !row
    || row.tenantId !== input.tenantId
    || row.institutionId !== input.institutionId
    || !Number.isSafeInteger(row.latestVersion)
    || row.latestVersion < 1
    || typeof row.timeZone !== 'string'
    || row.timeZone.length === 0
  ) {
    return null;
  }

  return Object.freeze({
    timeZone: row.timeZone,
    version: String(row.latestVersion),
  });
}
