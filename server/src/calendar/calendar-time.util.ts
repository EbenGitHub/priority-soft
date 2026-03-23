import { Shift } from '../shifts/entities/shift.entity';
import { Availability } from '../users/entities/availability.entity';

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
  const derivedEndDate = explicitEndDate || (normalizeTime(endTime) <= normalizeTime(startTime) ? addDays(date, 1) : date);
  const isOvernight = derivedEndDate !== date || normalizeTime(endTime) <= normalizeTime(startTime);
  const startUtc = zonedLocalToUtc(date, startTime, timeZone);
  const endUtc = zonedLocalToUtc(derivedEndDate, endTime, timeZone);

  return {
    startUtc,
    endUtc,
    isOvernight,
    endDate: derivedEndDate,
    durationHours: (endUtc.getTime() - startUtc.getTime()) / (1000 * 60 * 60),
  };
}

export function getShiftUtcRange(shift: Shift) {
  const timeZone = shift.location?.timezone || 'UTC';

  if (shift.startUtc && shift.endUtc) {
    return {
      startUtc: shift.startUtc,
      endUtc: shift.endUtc,
      isOvernight:
        typeof shift.isOvernight === 'boolean'
          ? shift.isOvernight
          : normalizeTime(shift.endTime) <= normalizeTime(shift.startTime),
      durationHours: (shift.endUtc.getTime() - shift.startUtc.getTime()) / (1000 * 60 * 60),
    };
  }

  return buildShiftUtcRange(shift.date, shift.startTime, shift.endTime, timeZone, shift.endDate);
}

export function getLocalDateKey(date: Date, timeZone: string) {
  return formatDate(date, timeZone);
}

export function formatPreview(shiftLike: {
  date: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
  location: { timezone: string };
}, viewerTimeZone: string) {
  const timing = buildShiftUtcRange(
    shiftLike.date,
    shiftLike.startTime,
    shiftLike.endTime,
    shiftLike.location.timezone,
    shiftLike.endDate || null,
  );

  const locationDate = new Intl.DateTimeFormat('en-US', {
    timeZone: shiftLike.location.timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(timing.startUtc);
  const viewerDate = new Intl.DateTimeFormat('en-US', {
    timeZone: viewerTimeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(timing.startUtc);

  return {
    startUtc: timing.startUtc.toISOString(),
    endUtc: timing.endUtc.toISOString(),
    isOvernight: timing.isOvernight,
    durationHours: timing.durationHours,
    locationDate,
    locationTimeRange: `${new Intl.DateTimeFormat('en-US', {
      timeZone: shiftLike.location.timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(timing.startUtc)} - ${new Intl.DateTimeFormat('en-US', {
      timeZone: shiftLike.location.timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(timing.endUtc)}`,
    locationTimeZone: shiftLike.location.timezone,
    viewerDate,
    viewerTimeRange: `${new Intl.DateTimeFormat('en-US', {
      timeZone: viewerTimeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(timing.startUtc)} - ${new Intl.DateTimeFormat('en-US', {
      timeZone: viewerTimeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(timing.endUtc)}`,
    viewerTimeZone,
  };
}

export function availabilityContainsShift(availability: Availability, shift: Shift) {
  const shiftTiming = getShiftUtcRange(shift);
  const timeZone = availability.timezone || shift.location?.timezone || 'UTC';
  const candidateDates =
    availability.type === 'EXCEPTION' && availability.date
      ? [availability.date]
      : [
          getLocalDateKey(shiftTiming.startUtc, timeZone),
          getLocalDateKey(new Date(shiftTiming.startUtc.getTime() - 24 * 60 * 60 * 1000), timeZone),
        ];

  for (const candidateDate of candidateDates) {
    const candidateDay = getDateParts(new Date(`${candidateDate}T12:00:00Z`), 'UTC').weekday;
    const matchesRule =
      availability.type === 'EXCEPTION'
        ? availability.date === candidateDate
        : availability.dayOfWeek === candidateDay;
    if (!matchesRule) continue;

    const availabilityWindow = buildShiftUtcRange(
      candidateDate,
      availability.startTime,
      availability.endTime,
      timeZone,
    );

    if (
      shiftTiming.startUtc.getTime() >= availabilityWindow.startUtc.getTime() &&
      shiftTiming.endUtc.getTime() <= availabilityWindow.endUtc.getTime()
    ) {
      return true;
    }
  }

  return false;
}
