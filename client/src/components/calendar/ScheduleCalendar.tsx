"use client";

import React, { useMemo, useState } from 'react';
import { Calendar, View, Views } from 'react-big-calendar';
import { Shift } from '../../lib/mockData';
import { getShiftTiming } from '../../lib/calendarTime';
import { calendarLocalizer, mapShiftsToCalendarEvents, ShiftCalendarEvent } from '../../lib/shiftCalendar';

type Props = {
  shifts: Shift[];
  viewerTimeZone: string;
  title: string;
  subtitle: string;
  emptyLabel: string;
  locationTimeZoneLabel?: string;
  onSelectShift?: (shift: Shift) => void;
  layout?: 'sidebar' | 'stacked';
};

function EventCard({ event }: { event: ShiftCalendarEvent }) {
  const shift = event.resource;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-slate-950/90 px-2 py-1 text-[11px] leading-tight text-white">
      <span className="truncate font-semibold">{shift.assignedStaff?.name || 'Open shift'}</span>
      <span className="truncate text-[10px] text-slate-300">{shift.requiredSkill?.name}</span>
    </div>
  );
}

export default function ScheduleCalendar({
  shifts,
  viewerTimeZone,
  title,
  subtitle,
  emptyLabel,
  locationTimeZoneLabel,
  onSelectShift,
  layout = 'sidebar',
}: Props) {
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());

  const events = useMemo(() => mapShiftsToCalendarEvents(shifts, viewerTimeZone), [shifts, viewerTimeZone]);
  const upcomingShifts = useMemo(
    () =>
      [...shifts]
        .filter((shift) => getShiftTiming(shift, viewerTimeZone).endUtc.getTime() >= Date.now())
        .sort((left, right) => getShiftTiming(left, viewerTimeZone).startUtc.getTime() - getShiftTiming(right, viewerTimeZone).startUtc.getTime())
        .slice(0, 6),
    [shifts, viewerTimeZone],
  );

  return (
    <div className="rounded-[2rem] border border-slate-700 bg-slate-800 p-6 shadow-2xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          {locationTimeZoneLabel && <p className="mt-2 text-xs font-mono text-cyan-300">{locationTimeZoneLabel}</p>}
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-400">
          {events.length} events
        </span>
      </div>

      {events.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-slate-950 p-10 text-center text-sm text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <div className={`grid gap-6 ${layout === 'stacked' ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1fr)_320px]'}`}>
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
              eventPropGetter={(event) => ({
                className: event.resource.published ? 'calendar-event-published' : 'calendar-event-draft',
              })}
              onSelectEvent={(event) => onSelectShift?.(event.resource)}
            />
          </div>

          <div className="rounded-[1.5rem] border border-slate-700 bg-slate-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Upcoming</h4>
              <span className="text-xs text-slate-500">{viewerTimeZone}</span>
            </div>
            <div className="space-y-3">
              {upcomingShifts.map((shift) => {
                const timing = getShiftTiming(shift, viewerTimeZone);
                return (
                  <button
                    key={`upcoming-${shift.id}`}
                    type="button"
                    onClick={() => onSelectShift?.(shift)}
                    className="block w-full rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-cyan-500/40 hover:bg-slate-900/80"
                  >
                    <p className="text-sm font-semibold text-white">{shift.assignedStaff?.name || 'Open shift'}</p>
                    <p className="mt-1 text-xs text-slate-400">{shift.location?.name}</p>
                    <p className="mt-2 text-xs font-mono text-cyan-300">{timing.locationDate} • {timing.locationTimeRange}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{shift.requiredSkill?.name}</p>
                  </button>
                );
              })}
              {upcomingShifts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-500">
                  No upcoming shifts.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
