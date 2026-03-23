"use client";

import React, { useMemo, useState } from 'react';
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { Calendar, View, Views } from 'react-big-calendar';
import { Availability, Location, Shift } from '../../lib/mockData';
import {
  buildShiftUtcRange,
  getLocalDateKeyForUtc,
  getShiftTiming,
  zonedLocalToUtc,
} from '../../lib/calendarTime';
import { calendarLocalizer } from '../../lib/shiftCalendar';

type AvailabilityCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource:
    | { kind: 'shift'; shift: Shift }
    | { kind: 'availability'; availability: Availability; locationLabel: string };
};

function getViewRange(date: Date, view: View) {
  if (view === Views.MONTH) {
    return {
      start: startOfWeek(startOfMonth(date)),
      end: endOfWeek(endOfMonth(date)),
    };
  }

  if (view === Views.DAY) {
    return {
      start: startOfDay(date),
      end: endOfDay(date),
    };
  }

  if (view === Views.AGENDA) {
    return {
      start: startOfDay(date),
      end: endOfDay(addDays(date, 30)),
    };
  }

  return {
    start: startOfWeek(date),
    end: endOfWeek(date),
  };
}

function getWeekdayInTimeZone(dateKey: string, timeZone: string) {
  const weekdayLabel = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(zonedLocalToUtc(dateKey, '12:00:00', timeZone));

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return weekdayMap[weekdayLabel] ?? 0;
}

function getLocationLabel(availability: Availability, locations: Location[]) {
  const matchingLocations = locations.filter((location) => location.timezone === availability.timezone);

  if (matchingLocations.length === 0) {
    return availability.timezone || 'Availability';
  }

  if (matchingLocations.length === 1) {
    return matchingLocations[0].name;
  }

  return matchingLocations.map((location) => location.name).join(' / ');
}

function buildAvailabilityOccurrences(
  availabilities: Availability[],
  locations: Location[],
  rangeStart: Date,
  rangeEnd: Date,
) {
  const events: AvailabilityCalendarEvent[] = [];
  const startKey = format(rangeStart, 'yyyy-MM-dd');
  const endKey = format(rangeEnd, 'yyyy-MM-dd');

  for (let cursor = startKey; cursor <= endKey; cursor = format(addDays(new Date(`${cursor}T12:00:00Z`), 1), 'yyyy-MM-dd')) {
    for (const availability of availabilities) {
      const timeZone = availability.timezone || locations[0]?.timezone || 'UTC';

      if (availability.type === 'RECURRING') {
        if (getWeekdayInTimeZone(cursor, timeZone) !== (availability.dayOfWeek ?? -1)) {
          continue;
        }
      } else if (availability.date !== cursor) {
        continue;
      }

      const timing = buildShiftUtcRange(cursor, availability.startTime, availability.endTime, timeZone);

      if (timing.endUtc < rangeStart || timing.startUtc > rangeEnd) {
        continue;
      }

      events.push({
        id: `${availability.id}:${cursor}`,
        title: `Available • ${getLocationLabel(availability, locations)}`,
        start: timing.startUtc,
        end: timing.endUtc,
        resource: {
          kind: 'availability',
          availability,
          locationLabel: getLocationLabel(availability, locations),
        },
      });
    }
  }

  return events;
}

function EventCard({ event }: { event: AvailabilityCalendarEvent }) {
  if (event.resource.kind === 'shift') {
    const shift = event.resource.shift;
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/90 px-2 py-1 text-[11px] leading-tight text-white">
        <span className="truncate font-semibold">{shift.location?.name}</span>
        <span className="truncate text-[10px] text-slate-300">{shift.requiredSkill?.name}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/90 px-2 py-1 text-[11px] leading-tight text-white">
      <span className="truncate font-semibold">Available</span>
      <span className="truncate text-[10px] text-slate-300">{event.resource.locationLabel}</span>
    </div>
  );
}

export default function StaffAvailabilityCalendar({
  shifts,
  availabilities,
  locations,
  viewerTimeZone,
}: {
  shifts: Shift[];
  availabilities: Availability[];
  locations: Location[];
  viewerTimeZone: string;
}) {
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());

  const range = useMemo(() => getViewRange(date, view), [date, view]);

  const events = useMemo(() => {
    const shiftEvents: AvailabilityCalendarEvent[] = shifts.map((shift) => {
      const timing = getShiftTiming(shift, viewerTimeZone);
      return {
        id: `shift:${shift.id}`,
        title: `${shift.location?.name} • ${shift.requiredSkill?.name}`,
        start: timing.startUtc,
        end: timing.endUtc,
        resource: {
          kind: 'shift',
          shift,
        },
      };
    });

    const availabilityEvents = buildAvailabilityOccurrences(
      availabilities,
      locations,
      range.start,
      range.end,
    );

    return [...shiftEvents, ...availabilityEvents].sort(
      (left, right) => left.start.getTime() - right.start.getTime(),
    );
  }, [availabilities, date, locations, range.end, range.start, shifts, view, viewerTimeZone]);

  const upcomingItems = useMemo(
    () =>
      events
        .filter((event) => event.end.getTime() >= Date.now())
        .slice(0, 8),
    [events],
  );

  return (
    <section className="rounded-[2rem] border border-slate-700 bg-slate-800 p-6 shadow-2xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-white">Work Calendar</h3>
          <p className="mt-1 text-sm text-slate-400">
            See assigned shifts and availability together in one planner view.
          </p>
          <p className="mt-2 text-xs font-mono text-cyan-300">Viewer timezone: {viewerTimeZone}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            Availability
          </span>
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
            Published Shift
          </span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
            Draft Shift
          </span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-[1.5rem] border border-slate-700 bg-slate-950 p-4">
          <Calendar
            className="shift-calendar"
            localizer={calendarLocalizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={view}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            onView={(nextView) => setView(nextView)}
            date={date}
            onNavigate={setDate}
            popup
            selectable={false}
            components={{ event: EventCard }}
            eventPropGetter={(event) => {
              if (event.resource.kind === 'availability') {
                return { className: 'calendar-event-availability' };
              }

              return {
                className: event.resource.shift.published
                  ? 'calendar-event-published'
                  : 'calendar-event-draft',
              };
            }}
          />
        </div>

        <div className="rounded-[1.5rem] border border-slate-700 bg-slate-950 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Upcoming</h4>
            <span className="text-xs text-slate-500">{upcomingItems.length} items</span>
          </div>
          <div className="space-y-3">
            {upcomingItems.map((event) => {
              if (event.resource.kind === 'shift') {
                const timing = getShiftTiming(event.resource.shift, viewerTimeZone);
                return (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <p className="text-sm font-semibold text-white">{event.resource.shift.location?.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{event.resource.shift.requiredSkill?.name}</p>
                    <p className="mt-2 text-xs font-mono text-cyan-300">
                      {timing.viewerDate} • {timing.viewerTimeRange}
                    </p>
                  </div>
                );
              }

              return (
                <div
                  key={event.id}
                  className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4"
                >
                  <p className="text-sm font-semibold text-white">Availability</p>
                  <p className="mt-1 text-xs text-slate-300">{event.resource.locationLabel}</p>
                  <p className="mt-2 text-xs font-mono text-emerald-300">
                    {getLocalDateKeyForUtc(event.start, viewerTimeZone)} •{' '}
                    {new Intl.DateTimeFormat('en-US', {
                      timeZone: viewerTimeZone,
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(event.start)}{' '}
                    -{' '}
                    {new Intl.DateTimeFormat('en-US', {
                      timeZone: viewerTimeZone,
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(event.end)}
                  </p>
                </div>
              );
            })}

            {upcomingItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-500">
                No upcoming shifts or availability windows in this view.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
