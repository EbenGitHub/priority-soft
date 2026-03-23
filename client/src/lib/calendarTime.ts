import { Shift } from './mockData';

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

function normalizeTime(time: string) {
  return time.length === 5 ? `${time}:00` : time;
}

function parseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, month, day };
}

function parseTime(time: string) {
  const [hour, minute, second] = normalizeTime(time).split(':').map(Number);
  return { hour, minute, second };
}

function formatDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getDateParts(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || '0');
  const weekdayLabel = parts.find((part) => part.type === 'weekday')?.value || 'Sun';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: lookup('year'),
    month: lookup('month'),
    day: lookup('day'),
    hour: lookup('hour'),
    minute: lookup('minute'),
    second: lookup('second'),
    weekday: weekdayMap[weekdayLabel] ?? 0,
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getDateParts(date, timeZone);
  const utcEquivalent = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return utcEquivalent - date.getTime();
}

function addDays(date: string, amount: number) {
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + amount);
  return base.toISOString().split('T')[0];
}

export function zonedLocalToUtc(date: string, time: string, timeZone: string) {
  const parsedDate = parseDate(date);
  const parsedTime = parseTime(time);
  const targetUtcGuess = Date.UTC(
    parsedDate.year,
    parsedDate.month - 1,
    parsedDate.day,
    parsedTime.hour,
    parsedTime.minute,
    parsedTime.second,
  );

  let resolvedUtc = targetUtcGuess;
  for (let index = 0; index < 4; index += 1) {
    const offset = getTimeZoneOffsetMs(new Date(resolvedUtc), timeZone);
    const next = targetUtcGuess - offset;
    if (next === resolvedUtc) break;
    resolvedUtc = next;
  }

  return new Date(resolvedUtc);
}

export function buildShiftUtcRange(
  date: string,
  startTime: string,
  endTime: string,
  timeZone: string,
  explicitEndDate?: string | null,
) {
  const endDate = explicitEndDate || (normalizeTime(endTime) <= normalizeTime(startTime) ? addDays(date, 1) : date);
  const overnight = endDate !== date || normalizeTime(endTime) <= normalizeTime(startTime);
  const startUtc = zonedLocalToUtc(date, startTime, timeZone);
  const endUtc = zonedLocalToUtc(endDate, endTime, timeZone);

  return {
    startUtc,
    endUtc,
    isOvernight: overnight,
    durationHours: (endUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60),
  };
}

export function getShiftTiming(shift: Shift, viewerTimeZone: string) {
  const locationTimeZone = shift.location?.timezone || 'UTC';
  const startUtc =
    shift.startUtc ? new Date(shift.startUtc) : buildShiftUtcRange(shift.date, shift.startTime, shift.endTime, locationTimeZone).startUtc;
  const endUtc =
    shift.endUtc ? new Date(shift.endUtc) : buildShiftUtcRange(shift.date, shift.startTime, shift.endTime, locationTimeZone, shift.endDate).endUtc;
  const isOvernight =
    typeof shift.isOvernight === 'boolean'
      ? shift.isOvernight
      : (shift.endDate || shift.date) !== shift.date || normalizeTime(shift.endTime) <= normalizeTime(shift.startTime);

  const durationHours = (endUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60);

  const locationDate = new Intl.DateTimeFormat('en-US', {
    timeZone: locationTimeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(startUtc);
  const viewerDate = new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTimeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(startUtc);
  const locationTimeRange = `${new Intl.DateTimeFormat('en-US', {
    timeZone: locationTimeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(startUtc)} - ${new Intl.DateTimeFormat('en-US', {
    timeZone: locationTimeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(endUtc)}`;
  const viewerTimeRange = `${new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTimeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(startUtc)} - ${new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTimeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(endUtc)}`;

  return {
    startUtc,
    endUtc,
    isOvernight,
    durationHours,
    locationTimeZone,
    viewerTimeZone,
    locationDate,
    viewerDate,
    locationTimeRange,
    viewerTimeRange,
    locationDateKey: formatDate(startUtc, locationTimeZone),
    viewerDateKey: formatDate(startUtc, viewerTimeZone),
    locationWeekday: getDateParts(startUtc, locationTimeZone).weekday,
    viewerWeekday: getDateParts(startUtc, viewerTimeZone).weekday,
  };
}

export function isShiftActive(shift: Shift, now = new Date()) {
  const timing = getShiftTiming(shift, 'UTC');
  const currentMs = now.getTime();
  return timing.startUtc.getTime() <= currentMs && currentMs <= timing.endUtc.getTime();
}

export function getLocalDateKeyForUtc(date: Date, timeZone: string) {
  return formatDate(date, timeZone);
}
