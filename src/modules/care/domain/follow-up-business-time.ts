const ISO_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-](\d{2}):(\d{2}))$/u;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

export type FollowUpBusinessDateProjection = Readonly<{
  date: string;
  timeZone: string;
  operatingContextVersion: string;
}>;

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

function readIsoInstant(value: unknown): Date | null {
  if (typeof value !== 'string') return null;

  const match = ISO_INSTANT_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);

  if (year < 1 || year > 9999 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  if (offsetHour > 23 || offsetMinute > 59) return null;

  const epochMilliseconds = Date.parse(value);
  return Number.isFinite(epochMilliseconds) ? new Date(epochMilliseconds) : null;
}

function readOperatingContextVersion(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    return null;
  }

  return CONTROL_CHARACTER_PATTERN.test(value) ? null : value;
}

function createBusinessDateFormatter(value: unknown): Intl.DateTimeFormat | null {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    return null;
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: value,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      era: 'short',
    });

    const resolvedTimeZone = formatter.resolvedOptions().timeZone;
    return resolvedTimeZone.startsWith('+') || resolvedTimeZone.startsWith('-')
      ? null
      : formatter;
  } catch {
    return null;
  }
}

function readCalendarPart(parts: Intl.DateTimeFormatPart[], type: 'year' | 'month' | 'day') {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value || !/^\d+$/u.test(value)) return null;

  const numericValue = Number(value);
  return Number.isInteger(numericValue) ? numericValue : null;
}

export function projectFollowUpBusinessDate(input: Readonly<{
  instant: unknown;
  timeZone: unknown;
  operatingContextVersion: unknown;
}>): FollowUpBusinessDateProjection | null {
  const instant = readIsoInstant(input.instant);
  const formatter = createBusinessDateFormatter(input.timeZone);
  const operatingContextVersion = readOperatingContextVersion(
    input.operatingContextVersion,
  );
  if (!instant || !formatter || !operatingContextVersion) return null;

  const parts = formatter.formatToParts(instant);
  const year = readCalendarPart(parts, 'year');
  const month = readCalendarPart(parts, 'month');
  const day = readCalendarPart(parts, 'day');
  const era = parts.find((part) => part.type === 'era')?.value;
  if (
    era !== 'AD' ||
    year === null ||
    year < 1 ||
    year > 9999 ||
    month === null ||
    month < 1 ||
    month > 12 ||
    day === null ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }

  return {
    date: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    timeZone: formatter.resolvedOptions().timeZone,
    operatingContextVersion,
  };
}
