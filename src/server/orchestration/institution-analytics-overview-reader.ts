import { and, eq } from 'drizzle-orm';

import {
  createAnalyticsOverviewReaderV1,
  type AnalyticsOverviewReaderResultV1,
} from '@/modules/institution-analytics/application/institution/analytics-overview-reader';
import {
  createInstitutionAnalyticsOverviewRepository,
} from '@/modules/institution-analytics/server/institution-analytics-overview-repository';
import { getDatabase, type TenantDatabase } from '@/server/db/client';
import {
  institutionOperatingContexts,
  institutionOperatingContextVersions,
} from '@/server/db/schema';
import {
  consumeInstitutionAnalyticsReadAuthorizationV1,
  resolveInstitutionAnalyticsReadAuthorizationV1,
} from '@/server/orchestration/institution-analytics-read-authorization';

export type InstitutionAnalyticsOverviewResultV1 =
  | AnalyticsOverviewReaderResultV1
  | Readonly<{ kind: 'forbidden' }>;

const FORBIDDEN = Object.freeze({ kind: 'forbidden' } as const);
const UNAVAILABLE = Object.freeze({ kind: 'unavailable' } as const);

async function readOperatingContext(
  database: TenantDatabase,
  pair: Readonly<{ tenantId: string; institutionId: string }>,
) {
  const rows = await database
    .select({
      tenantId: institutionOperatingContexts.tenantId,
      institutionId: institutionOperatingContexts.institutionId,
      latestVersion: institutionOperatingContexts.latestVersion,
      timezone: institutionOperatingContextVersions.timezone,
      currency: institutionOperatingContextVersions.currency,
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
        eq(institutionOperatingContexts.tenantId, pair.tenantId),
        eq(institutionOperatingContexts.institutionId, pair.institutionId),
      ),
    )
    .limit(2);

  if (rows.length !== 1) return null;
  const row = rows[0];
  if (
    row.tenantId !== pair.tenantId
    || row.institutionId !== pair.institutionId
    || !Number.isSafeInteger(row.latestVersion)
    || row.latestVersion <= 0
    || typeof row.timezone !== 'string'
    || row.timezone.length === 0
    || typeof row.currency !== 'string'
    || !/^[A-Z]{3}$/u.test(row.currency)
  ) return null;

  return Object.freeze({
    timeZone: row.timezone,
    defaultCurrency: row.currency,
  });
}

export async function readCurrentInstitutionAnalyticsOverviewV1(): Promise<InstitutionAnalyticsOverviewResultV1> {
  try {
    const authorization = await resolveInstitutionAnalyticsReadAuthorizationV1();
    if (authorization.kind === 'forbidden') return FORBIDDEN;
    if (authorization.kind !== 'allowed') return UNAVAILABLE;

    const pair = consumeInstitutionAnalyticsReadAuthorizationV1(
      authorization.authorization,
    );
    if (!pair) return UNAVAILABLE;

    const database = getDatabase();
    const context = await readOperatingContext(database, pair);
    if (!context) return UNAVAILABLE;

    const source = createInstitutionAnalyticsOverviewRepository(database);
    const reader = createAnalyticsOverviewReaderV1({ source });
    const nowEpochMs = Date.now();
    if (!Number.isSafeInteger(nowEpochMs)) return UNAVAILABLE;

    return await reader.read({
      tenantId: pair.tenantId,
      institutionId: pair.institutionId,
      timeZone: context.timeZone,
      defaultCurrency: context.defaultCurrency,
      asOf: new Date(nowEpochMs).toISOString(),
    });
  } catch {
    return UNAVAILABLE;
  }
}
