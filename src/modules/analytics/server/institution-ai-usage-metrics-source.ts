import { and, asc, eq, gte, lt } from 'drizzle-orm';

import type { TenantDatabase } from '@/server/db/client';
import { aiCallUsageRecords } from '@/server/db/schema';

export const INSTITUTION_AI_USAGE_SOURCE_LIMIT_WITH_SENTINEL = 10_001;

const MAX_WINDOW_MS = 31 * 24 * 60 * 60 * 1_000;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const queryKeys = Object.freeze([
  'tenantId',
  'institutionId',
  'startInclusiveEpochMs',
  'endExclusiveEpochMs',
] as const);

export type InstitutionAiUsageMetricsSourceQuery = Readonly<{
  tenantId: string;
  institutionId: string;
  startInclusiveEpochMs: number;
  endExclusiveEpochMs: number;
}>;

function isExactPlainQuery(
  value: unknown,
): value is InstitutionAiUsageMetricsSourceQuery {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return false;
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(descriptors).length !== queryKeys.length
    || queryKeys.some((key) => !Object.hasOwn(descriptors, key))
  ) {
    return false;
  }

  for (const key of queryKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || !descriptor.enumerable
      || !('value' in descriptor)
    ) {
      return false;
    }
  }

  const input = value as InstitutionAiUsageMetricsSourceQuery;
  if (
    !idPattern.test(input.tenantId)
    || !idPattern.test(input.institutionId)
    || !Number.isSafeInteger(input.startInclusiveEpochMs)
    || !Number.isSafeInteger(input.endExclusiveEpochMs)
    || input.startInclusiveEpochMs >= input.endExclusiveEpochMs
    || input.endExclusiveEpochMs - input.startInclusiveEpochMs > MAX_WINDOW_MS
  ) {
    return false;
  }

  try {
    return (
      new Date(input.startInclusiveEpochMs).getTime()
        === input.startInclusiveEpochMs
      && new Date(input.endExclusiveEpochMs).getTime()
        === input.endExclusiveEpochMs
    );
  } catch {
    return false;
  }
}

export function createInstitutionAiUsageMetricsSource(
  database: TenantDatabase,
) {
  return Object.freeze({
    async listInstitutionUsageMetricRecords(
      input: InstitutionAiUsageMetricsSourceQuery,
    ) {
      if (!isExactPlainQuery(input)) {
        throw new Error('invalid_institution_ai_usage_metrics_source_query');
      }

      const startInclusive = new Date(input.startInclusiveEpochMs);
      const endExclusive = new Date(input.endExclusiveEpochMs);

      const rows = await database
        .select({
          tenantId: aiCallUsageRecords.tenantId,
          institutionId: aiCallUsageRecords.institutionId,
          status: aiCallUsageRecords.status,
          serviceCategory: aiCallUsageRecords.serviceCategory,
          serviceAction: aiCallUsageRecords.serviceAction,
          createdAt: aiCallUsageRecords.createdAt,
        })
        .from(aiCallUsageRecords)
        .where(
          and(
            eq(aiCallUsageRecords.tenantId, input.tenantId),
            eq(aiCallUsageRecords.institutionId, input.institutionId),
            gte(aiCallUsageRecords.createdAt, startInclusive),
            lt(aiCallUsageRecords.createdAt, endExclusive),
          ),
        )
        .orderBy(
          asc(aiCallUsageRecords.createdAt),
          asc(aiCallUsageRecords.id),
        )
        .limit(INSTITUTION_AI_USAGE_SOURCE_LIMIT_WITH_SENTINEL);

      return Object.freeze(
        rows.map((row) =>
          Object.freeze({
            tenantId: row.tenantId,
            institutionId: row.institutionId,
            status: row.status,
            serviceCategory: row.serviceCategory,
            serviceAction: row.serviceAction,
            createdAt: row.createdAt,
          }),
        ),
      );
    },
  });
}
