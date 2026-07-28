export const ANALYTICS_PERIOD_PRESETS = [
  'today',
  'week',
  'month',
  'quarter',
  'year',
  'custom',
] as const;

export type AnalyticsPeriodPreset = (typeof ANALYTICS_PERIOD_PRESETS)[number];

export type AnalyticsPeriodRequest =
  | Readonly<{
      preset: Exclude<AnalyticsPeriodPreset, 'custom'>;
      timeZone: string;
      asOf: string;
    }>
  | Readonly<{
      preset: 'custom';
      timeZone: string;
      asOf: string;
      startDate: string;
      endDateInclusive: string;
    }>;

export type AnalyticsPeriodWindow = Readonly<{
  timeZone: string;
  startDate: string;
  endDateExclusive: string;
  localDayCount: number;
}>;

export type AnalyticsPeriodPair = Readonly<{
  preset: AnalyticsPeriodPreset;
  asOfBusinessDate: string;
  current: AnalyticsPeriodWindow;
  previous: AnalyticsPeriodWindow;
}>;

export type AnalyticsPeriodFailureCode =
  | 'invalid_instant'
  | 'invalid_time_zone'
  | 'invalid_period_preset'
  | 'invalid_local_date'
  | 'invalid_custom_range'
  | 'invalid_period_window';

export type InstitutionBusinessDateResult =
  | Readonly<{ ok: true; businessDate: string }>
  | Readonly<{ ok: false; reasonCode: 'invalid_instant' | 'invalid_time_zone' }>;

export type AnalyticsPeriodResolution =
  | Readonly<{ ok: true; value: AnalyticsPeriodPair }>
  | Readonly<{
      ok: false;
      reasonCode: Exclude<AnalyticsPeriodFailureCode, 'invalid_period_window'>;
    }>;

export type AnalyticsPeriodContainmentResult =
  | Readonly<{ ok: true; contains: boolean; businessDate: string }>
  | Readonly<{ ok: false; reasonCode: AnalyticsPeriodFailureCode }>;

export type AnalyticsLocalDateParts = Readonly<{
  year: number;
  month: number;
  day: number;
  ordinal: number;
}>;

export type AnalyticsLocalDateStartResolution =
  | Readonly<{ ok: true; instant: string }>
  | Readonly<{
      ok: false;
      reasonCode:
        | 'invalid_local_date'
        | 'invalid_time_zone'
        | 'unresolvable_local_date_start';
    }>;

const millisecondsPerCalendarDay = 86_400_000;
const periodPresetSet = new Set<string>(ANALYTICS_PERIOD_PRESETS);
const explicitInstantPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/u;
const ianaTimeZonePattern =
  /^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)+$/u;

function parseInstant(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = explicitInstantPattern.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[10] === undefined ? 0 : Number(match[10]);
  const offsetMinute = match[11] === undefined ? 0 : Number(match[11]);
  if (
    year < 1000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0)
  ) {
    return null;
  }

  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function createDateFormatter(timeZone: unknown) {
  if (
    typeof timeZone !== 'string' ||
    (timeZone !== 'UTC' && !ianaTimeZonePattern.test(timeZone))
  ) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat('en-CA-u-ca-iso8601-nu-latn', {
      timeZone,
      calendar: 'iso8601',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return null;
  }
}

function localDatePartsFromFormatter(
  formatter: Intl.DateTimeFormat,
  timestamp: number,
) {
  let year = '';
  let month = '';
  let day = '';

  for (const part of formatter.formatToParts(new Date(timestamp))) {
    if (part.type === 'year') year = part.value;
    if (part.type === 'month') month = part.value;
    if (part.type === 'day') day = part.value;
  }

  if (!/^\d+$/u.test(year) || !/^\d+$/u.test(month) || !/^\d+$/u.test(day)) {
    return null;
  }

  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  if (
    !Number.isSafeInteger(numericYear) ||
    !Number.isSafeInteger(numericMonth) ||
    !Number.isSafeInteger(numericDay)
  ) {
    return null;
  }

  const date = new Date(0);
  date.setUTCFullYear(numericYear, numericMonth - 1, numericDay);
  date.setUTCHours(0, 0, 0, 0);
  if (
    date.getUTCFullYear() !== numericYear ||
    date.getUTCMonth() !== numericMonth - 1 ||
    date.getUTCDate() !== numericDay
  ) {
    return null;
  }

  return {
    year: numericYear,
    month: numericMonth,
    day: numericDay,
    ordinal: date.getTime() / millisecondsPerCalendarDay,
  };
}

function localDateFromFormatter(formatter: Intl.DateTimeFormat, timestamp: number) {
  const parts = localDatePartsFromFormatter(formatter, timestamp);
  if (!parts || parts.year < 1000 || parts.year > 9999) return null;
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(
    2,
    '0',
  )}-${String(parts.day).padStart(2, '0')}`;
}

export function parseAnalyticsLocalDate(
  value: unknown,
): AnalyticsLocalDateParts | null {
  if (typeof value !== 'string') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return null;

  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    ordinal: timestamp / millisecondsPerCalendarDay,
  };
}

function localDateFromOrdinal(ordinal: number) {
  const date = new Date(ordinal * millisecondsPerCalendarDay);
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDateFromParts(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function windowFromOrdinals(
  timeZone: string,
  startOrdinal: number,
  endOrdinalExclusive: number,
): AnalyticsPeriodWindow {
  return {
    timeZone,
    startDate: localDateFromOrdinal(startOrdinal),
    endDateExclusive: localDateFromOrdinal(endOrdinalExclusive),
    localDayCount: endOrdinalExclusive - startOrdinal,
  };
}

export function toInstitutionBusinessDate(input: {
  readonly instant: string;
  readonly timeZone: string;
}): InstitutionBusinessDateResult {
  const timestamp = parseInstant(input.instant);
  if (timestamp === null) {
    return { ok: false, reasonCode: 'invalid_instant' };
  }

  if (input.timeZone === 'UTC') {
    const instant = new Date(timestamp);
    const businessDate = localDateFromParts(
      instant.getUTCFullYear(),
      instant.getUTCMonth() + 1,
      instant.getUTCDate(),
    );
    const parsedBusinessDate = parseAnalyticsLocalDate(businessDate);
    if (
      !parsedBusinessDate ||
      parsedBusinessDate.year !== instant.getUTCFullYear() ||
      parsedBusinessDate.month !== instant.getUTCMonth() + 1 ||
      parsedBusinessDate.day !== instant.getUTCDate()
    ) {
      return { ok: false, reasonCode: 'invalid_instant' };
    }
    return { ok: true, businessDate };
  }

  const formatter = createDateFormatter(input.timeZone);
  if (!formatter) {
    return { ok: false, reasonCode: 'invalid_time_zone' };
  }

  const businessDate = localDateFromFormatter(formatter, timestamp);
  return businessDate
    ? { ok: true, businessDate }
    : { ok: false, reasonCode: 'invalid_instant' };
}

export function resolveAnalyticsLocalDateStartInstant(input: {
  readonly localDate: string;
  readonly timeZone: string;
}): AnalyticsLocalDateStartResolution {
  const localDate = parseAnalyticsLocalDate(input?.localDate);
  if (!localDate) {
    return { ok: false, reasonCode: 'invalid_local_date' };
  }

  if (input.timeZone === 'UTC') {
    const timestamp = localDate.ordinal * millisecondsPerCalendarDay;
    const instant = new Date(timestamp);
    const expectedInstant = `${input.localDate}T00:00:00.000Z`;
    if (
      !Number.isFinite(timestamp) ||
      instant.getUTCFullYear() !== localDate.year ||
      instant.getUTCMonth() !== localDate.month - 1 ||
      instant.getUTCDate() !== localDate.day ||
      instant.getUTCHours() !== 0 ||
      instant.getUTCMinutes() !== 0 ||
      instant.getUTCSeconds() !== 0 ||
      instant.getUTCMilliseconds() !== 0 ||
      instant.toISOString() !== expectedInstant
    ) {
      return { ok: false, reasonCode: 'unresolvable_local_date_start' };
    }
    return { ok: true, instant: expectedInstant };
  }

  const formatter = createDateFormatter(input?.timeZone);
  if (!formatter) {
    return { ok: false, reasonCode: 'invalid_time_zone' };
  }

  const searchPadding = millisecondsPerCalendarDay * 2;
  let lower = localDate.ordinal * millisecondsPerCalendarDay - searchPadding;
  let upper = localDate.ordinal * millisecondsPerCalendarDay + searchPadding;
  const lowerOrdinal = localDatePartsFromFormatter(formatter, lower)?.ordinal;
  const upperOrdinal = localDatePartsFromFormatter(formatter, upper)?.ordinal;
  if (
    lowerOrdinal === undefined ||
    upperOrdinal === undefined ||
    lowerOrdinal >= localDate.ordinal ||
    upperOrdinal < localDate.ordinal
  ) {
    return { ok: false, reasonCode: 'unresolvable_local_date_start' };
  }

  while (lower < upper) {
    const midpoint = lower + Math.floor((upper - lower) / 2);
    const midpointOrdinal = localDatePartsFromFormatter(
      formatter,
      midpoint,
    )?.ordinal;
    if (midpointOrdinal === undefined) {
      return { ok: false, reasonCode: 'unresolvable_local_date_start' };
    }
    if (midpointOrdinal < localDate.ordinal) {
      lower = midpoint + 1;
    } else {
      upper = midpoint;
    }
  }

  const resolvedOrdinal = localDatePartsFromFormatter(formatter, lower)?.ordinal;
  const previousOrdinal = localDatePartsFromFormatter(
    formatter,
    lower - 1,
  )?.ordinal;
  if (
    resolvedOrdinal !== localDate.ordinal ||
    previousOrdinal === localDate.ordinal
  ) {
    return { ok: false, reasonCode: 'unresolvable_local_date_start' };
  }

  return { ok: true, instant: new Date(lower).toISOString() };
}

export function resolveAnalyticsPeriod(
  input: AnalyticsPeriodRequest,
): AnalyticsPeriodResolution {
  if (!periodPresetSet.has(input?.preset)) {
    return { ok: false, reasonCode: 'invalid_period_preset' };
  }

  const asOfDateResult = toInstitutionBusinessDate({
    instant: input.asOf,
    timeZone: input.timeZone,
  });
  if (!asOfDateResult.ok) {
    return asOfDateResult;
  }

  const asOfDate = parseAnalyticsLocalDate(asOfDateResult.businessDate);
  if (!asOfDate) {
    return { ok: false, reasonCode: 'invalid_local_date' };
  }

  let startOrdinal: number;
  let endOrdinalExclusive: number;

  if (input.preset === 'custom') {
    const startDate = parseAnalyticsLocalDate(input.startDate);
    const endDate = parseAnalyticsLocalDate(input.endDateInclusive);
    if (!startDate || !endDate) {
      return { ok: false, reasonCode: 'invalid_local_date' };
    }
    if (endDate.ordinal < startDate.ordinal) {
      return { ok: false, reasonCode: 'invalid_custom_range' };
    }
    startOrdinal = startDate.ordinal;
    endOrdinalExclusive = endDate.ordinal + 1;
  } else {
    endOrdinalExclusive = asOfDate.ordinal + 1;
    if (input.preset === 'today') {
      startOrdinal = asOfDate.ordinal;
    } else if (input.preset === 'week') {
      const sundayBasedWeekday = new Date(
        asOfDate.ordinal * millisecondsPerCalendarDay,
      ).getUTCDay();
      const daysSinceMonday = (sundayBasedWeekday + 6) % 7;
      startOrdinal = asOfDate.ordinal - daysSinceMonday;
    } else if (input.preset === 'month') {
      startOrdinal = parseAnalyticsLocalDate(
        localDateFromParts(asOfDate.year, asOfDate.month, 1),
      )?.ordinal ?? Number.NaN;
    } else if (input.preset === 'quarter') {
      const quarterStartMonth = Math.floor((asOfDate.month - 1) / 3) * 3 + 1;
      startOrdinal = parseAnalyticsLocalDate(
        localDateFromParts(asOfDate.year, quarterStartMonth, 1),
      )?.ordinal ?? Number.NaN;
    } else if (input.preset === 'year') {
      startOrdinal = parseAnalyticsLocalDate(
        localDateFromParts(asOfDate.year, 1, 1),
      )?.ordinal ?? Number.NaN;
    } else {
      return { ok: false, reasonCode: 'invalid_period_preset' };
    }
  }

  if (
    !Number.isInteger(startOrdinal) ||
    !Number.isInteger(endOrdinalExclusive) ||
    endOrdinalExclusive <= startOrdinal
  ) {
    return { ok: false, reasonCode: 'invalid_local_date' };
  }

  const localDayCount = endOrdinalExclusive - startOrdinal;
  const value = {
    preset: input.preset,
    asOfBusinessDate: asOfDateResult.businessDate,
    current: windowFromOrdinals(input.timeZone, startOrdinal, endOrdinalExclusive),
    previous: windowFromOrdinals(
      input.timeZone,
      startOrdinal - localDayCount,
      startOrdinal,
    ),
  } satisfies AnalyticsPeriodPair;
  if (!isAnalyticsPeriodPairValid(value)) {
    return { ok: false, reasonCode: 'invalid_local_date' };
  }

  return {
    ok: true,
    value,
  };
}

export function isAnalyticsPeriodWindowValid(
  window: AnalyticsPeriodWindow | null | undefined,
) {
  const startDate = parseAnalyticsLocalDate(window?.startDate);
  const endDate = parseAnalyticsLocalDate(window?.endDateExclusive);
  const localDayCount = window?.localDayCount;
  return Boolean(
    startDate &&
      endDate &&
      typeof localDayCount === 'number' &&
      Number.isSafeInteger(localDayCount) &&
      localDayCount > 0 &&
      endDate.ordinal - startDate.ordinal === localDayCount &&
      createDateFormatter(window?.timeZone),
  );
}

export function isAnalyticsPeriodPairValid(
  periods: AnalyticsPeriodPair | null | undefined,
) {
  const current = periods?.current;
  const previous = periods?.previous;
  if (
    typeof periods?.preset !== 'string' ||
    !periodPresetSet.has(periods.preset) ||
    !parseAnalyticsLocalDate(periods.asOfBusinessDate) ||
    !isAnalyticsPeriodWindowValid(current) ||
    !isAnalyticsPeriodWindowValid(previous) ||
    !current ||
    !previous ||
    current.timeZone !== previous.timeZone ||
    previous.endDateExclusive !== current.startDate ||
    previous.localDayCount !== current.localDayCount
  ) {
    return false;
  }

  const start = parseAnalyticsLocalDate(current.startDate);
  const end = parseAnalyticsLocalDate(current.endDateExclusive);
  const asOf = parseAnalyticsLocalDate(periods.asOfBusinessDate);
  if (!start || !end || !asOf) return false;
  if (periods.preset === 'custom') return true;
  if (end.ordinal !== asOf.ordinal + 1) return false;

  if (periods.preset === 'today') {
    return current.localDayCount === 1;
  }
  if (periods.preset === 'week') {
    const weekday = new Date(start.ordinal * millisecondsPerCalendarDay).getUTCDay();
    return weekday === 1 && current.localDayCount <= 7;
  }
  if (periods.preset === 'month') {
    const nextMonth = Date.UTC(start.year, start.month, 1) / millisecondsPerCalendarDay;
    return start.day === 1 && end.ordinal <= nextMonth;
  }
  if (periods.preset === 'quarter') {
    const nextQuarter =
      Date.UTC(start.year, start.month + 2, 1) / millisecondsPerCalendarDay;
    return (
      start.day === 1 &&
      [1, 4, 7, 10].includes(start.month) &&
      end.ordinal <= nextQuarter
    );
  }
  if (periods.preset === 'year') {
    const nextYear = Date.UTC(start.year + 1, 0, 1) / millisecondsPerCalendarDay;
    return start.month === 1 && start.day === 1 && end.ordinal <= nextYear;
  }
  return false;
}

export function isInstantInAnalyticsPeriod(
  window: AnalyticsPeriodWindow,
  instant: string,
): AnalyticsPeriodContainmentResult {
  if (!isAnalyticsPeriodWindowValid(window)) {
    return { ok: false, reasonCode: 'invalid_period_window' };
  }

  const businessDateResult = toInstitutionBusinessDate({
    instant,
    timeZone: window.timeZone,
  });
  if (!businessDateResult.ok) {
    return businessDateResult;
  }

  return {
    ok: true,
    contains:
      businessDateResult.businessDate >= window.startDate &&
      businessDateResult.businessDate < window.endDateExclusive,
    businessDate: businessDateResult.businessDate,
  };
}
