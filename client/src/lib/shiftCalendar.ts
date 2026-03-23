import { dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Shift } from './mockData';
import { getShiftTiming } from './calendarTime';

const locales = {
  'en-US': enUS,
};

export const calendarLocalizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export type ShiftCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Shift;
};

export function mapShiftToCalendarEvent(shift: Shift, viewerTimeZone: string): ShiftCalendarEvent {
  const timing = getShiftTiming(shift, viewerTimeZone);
  const staffLabel = shift.assignedStaff?.name || 'Open shift';
  const skillLabel = shift.requiredSkill?.name || 'Unspecified skill';

  return {
    id: shift.id,
    title: `${staffLabel} • ${skillLabel}`,
    start: timing.startUtc,
    end: timing.endUtc,
    resource: shift,
  };
}

export function mapShiftsToCalendarEvents(shifts: Shift[], viewerTimeZone: string) {
  return shifts.map((shift) => mapShiftToCalendarEvent(shift, viewerTimeZone));
}
