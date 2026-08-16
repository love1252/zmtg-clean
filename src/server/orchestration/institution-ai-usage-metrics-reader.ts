import type { AiUsageMetrics } from '@/modules/institution-system/domain/ai-usage-metrics';
import {
  INSTITUTION_OPERATING_CONTEXT_PRODUCT_DEFAULT_V1,
} from '@/modules/institution-contracts/v1/institution-operating-context';
import {
  createInstitutionAiUsageMetricsReader,
} from '@/modules/institution-system/server/institution-ai-usage-metrics-reader';
import {
  createInstitutionAiUsageMetricsSource,
} from '@/modules/analytics/server/institution-ai-usage-metrics-source';
import { getDatabase } from '@/server/db/client';
import {
  consumeInstitutionAiUsageReadAuthorizationV1,
  resolveInstitutionAiUsageReadAuthorizationV1,
} from '@/server/orchestration/institution-ai-usage-read-authorization';

export type InstitutionAiUsagePresetV1 =
  | 'today'
  | 'last7days'
  | 'currentMonth'
  | 'lastMonth';

export type InstitutionAiUsageMetricsResultV1 =
  | Readonly<{
      kind: 'ready';
      preset: InstitutionAiUsagePresetV1;
      metrics: AiUsageMetrics;
    }>
  | Readonly<{
      kind: 'invalid_query';
      code: 'invalid_ai_usage_query';
    }>
  | Readonly<{ kind: 'forbidden' }>
  | Readonly<{ kind: 'unavailable' }>;

const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_WINDOW_MS = 31 * DAY_MS;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1_000;

const PRODUCT_TIME_ZONE =
  INSTITUTION_OPERATING_CONTEXT_PRODUCT_DEFAULT_V1.current.timeZone;

const INVALID_QUERY = Object.freeze({
  kind: 'invalid_query' as const,
  code: 'invalid_ai_usage_query' as const,
});
const FORBIDDEN = Object.freeze({
  kind: 'forbidden' as const,
});
const UNAVAILABLE = Object.freeze({
  kind: 'unavailable' as const,
});

const presets = Object.freeze([
  'today',
  'last7days',
  'currentMonth',
  'lastMonth',
] as const satisfies readonly InstitutionAiUsagePresetV1[]);

function parseQuery(
  searchParams: URLSearchParams,
): InstitutionAiUsagePresetV1 | null {
  const entries = [...searchParams.entries()];

  if (entries.some(([key]) => key !== 'preset')) {
    return null;
  }

  const rawPresets = searchParams.getAll('preset');
  if (rawPresets.length > 1) {
    return null;
  }

  if (rawPresets.length === 0) {
    return 'currentMonth';
  }

  const candidate = rawPresets[0];
  return presets.find((preset) => preset === candidate) ?? null;
}

function readProductLocalDate(
  epochMs: number,
): Readonly<{
  year: number;
  month: number;
  day: number;
}> | null {
  if (
    PRODUCT_TIME_ZONE !== 'Asia/Shanghai'
    || !Number.isSafeInteger(epochMs)
  ) {
    return null;
  }

  try {
    const local = new Date(epochMs + SHANGHAI_OFFSET_MS);
    if (!Number.isFinite(local.getTime())) {
      return null;
    }

    return Object.freeze({
      year: local.getUTCFullYear(),
      month: local.getUTCMonth() + 1,
      day: local.getUTCDate(),
    });
  } catch {
    return null;
  }
}

function toLocalMidnightEpochMs(
  year: number,
  month: number,
  day: number,
): number | null {
  try {
    const value =
      Date.UTC(year, month - 1, day)
      - SHANGHAI_OFFSET_MS;

    return Number.isSafeInteger(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

function shiftLocalDate(
  input: Readonly<{
    year: number;
    month: number;
    day: number;
  }>,
  days: number,
) {
  const shifted = new Date(
    Date.UTC(
      input.year,
      input.month - 1,
      input.day + days,
    ),
  );

  return Object.freeze({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

function resolveTimeWindow(
  preset: InstitutionAiUsagePresetV1,
  nowEpochMs: number,
): Readonly<{
  startInclusiveEpochMs: number;
  endExclusiveEpochMs: number;
}> | null {
  const localDate = readProductLocalDate(nowEpochMs);
  if (!localDate) {
    return null;
  }

  let startInclusiveEpochMs: number | null = null;
  let endExclusiveEpochMs: number | null = null;

  if (preset === 'today') {
    const tomorrow = shiftLocalDate(localDate, 1);
    startInclusiveEpochMs = toLocalMidnightEpochMs(
      localDate.year,
      localDate.month,
      localDate.day,
    );
    endExclusiveEpochMs = toLocalMidnightEpochMs(
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
    );
  } else if (preset === 'last7days') {
    const start = shiftLocalDate(localDate, -6);
    const tomorrow = shiftLocalDate(localDate, 1);
    startInclusiveEpochMs = toLocalMidnightEpochMs(
      start.year,
      start.month,
      start.day,
    );
    endExclusiveEpochMs = toLocalMidnightEpochMs(
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
    );
  } else if (preset === 'currentMonth') {
    startInclusiveEpochMs = toLocalMidnightEpochMs(
      localDate.year,
      localDate.month,
      1,
    );

    const nextMonth = new Date(
      Date.UTC(localDate.year, localDate.month, 1),
    );
    endExclusiveEpochMs = toLocalMidnightEpochMs(
      nextMonth.getUTCFullYear(),
      nextMonth.getUTCMonth() + 1,
      1,
    );
  } else {
    const currentMonthStart = toLocalMidnightEpochMs(
      localDate.year,
      localDate.month,
      1,
    );
    const previousMonth = new Date(
      Date.UTC(localDate.year, localDate.month - 2, 1),
    );

    startInclusiveEpochMs = toLocalMidnightEpochMs(
      previousMonth.getUTCFullYear(),
      previousMonth.getUTCMonth() + 1,
      1,
    );
    endExclusiveEpochMs = currentMonthStart;
  }

  if (
    startInclusiveEpochMs === null
    || endExclusiveEpochMs === null
    || startInclusiveEpochMs >= endExclusiveEpochMs
    || endExclusiveEpochMs - startInclusiveEpochMs > MAX_WINDOW_MS
  ) {
    return null;
  }

  return Object.freeze({
    startInclusiveEpochMs,
    endExclusiveEpochMs,
  });
}

export async function readCurrentInstitutionAiUsageMetricsV1(
  searchParams: URLSearchParams,
): Promise<InstitutionAiUsageMetricsResultV1> {
  try {
    const preset = parseQuery(searchParams);
    if (!preset) {
      return INVALID_QUERY;
    }

    const authorization =
      await resolveInstitutionAiUsageReadAuthorizationV1();

    if (authorization.kind === 'forbidden') {
      return FORBIDDEN;
    }

    if (authorization.kind !== 'allowed') {
      return UNAVAILABLE;
    }

    const pair =
      consumeInstitutionAiUsageReadAuthorizationV1(
        authorization.authorization,
      );

    if (!pair) {
      return UNAVAILABLE;
    }

    const timeWindow = resolveTimeWindow(
      preset,
      Date.now(),
    );

    if (!timeWindow) {
      return UNAVAILABLE;
    }

    const source =
      createInstitutionAiUsageMetricsSource(getDatabase());

    const reader =
      createInstitutionAiUsageMetricsReader(source);

    const result = await reader.read({
      scope: Object.freeze({
        tenantId: pair.tenantId,
        institutionId: pair.institutionId,
      }),
      timeWindow,
    });

    if (!result.ok) {
      return UNAVAILABLE;
    }

    const externallySafeMetrics =
      result.metrics.totalCallCount === 0
        ? Object.freeze({
            ...result.metrics,
            serviceUnits: null,
          })
        : result.metrics;

    return Object.freeze({
      kind: 'ready' as const,
      preset,
      metrics: externallySafeMetrics,
    });
  } catch {
    return UNAVAILABLE;
  }
}
