"use client";

import React from 'react';
import DatePicker from 'react-datepicker';

type Props = {
  locationLabel: string;
  locationTimeZone: string;
  startDateTime: Date | null;
  endDateTime: Date | null;
  minDate?: Date;
  onChangeStartDateTime: (value: Date | null) => void;
  onChangeEndDateTime: (value: Date | null) => void;
};

export default function ShiftDateTimePicker({
  locationLabel,
  locationTimeZone,
  startDateTime,
  endDateTime,
  minDate,
  onChangeStartDateTime,
  onChangeEndDateTime,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Scheduling Context</p>
        <p className="mt-2 text-sm text-white">{locationLabel}</p>
        <p className="mt-1 text-xs text-slate-400">Create the shift against the location’s local schedule and verify it in the preview below.</p>
        <p className="mt-2 text-xs font-mono text-cyan-300">{locationTimeZone}</p>
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Shift Start</label>
        <DatePicker
          selected={startDateTime}
          onChange={onChangeStartDateTime}
          showTimeSelect
          minDate={minDate}
          dateFormat="MMMM d, yyyy h:mm aa"
          placeholderText="Choose a start date and time"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-sm text-white shadow-inner outline-none transition focus:border-blue-500"
          calendarClassName="shift-datepicker-calendar"
          popperClassName="shift-datepicker-popper"
        />
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Shift End</label>
        <DatePicker
          selected={endDateTime}
          onChange={onChangeEndDateTime}
          showTimeSelect
          minDate={startDateTime || minDate}
          timeIntervals={30}
          timeCaption="End"
          dateFormat="MMMM d, yyyy h:mm aa"
          placeholderText="Choose an end date and time"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-sm text-white shadow-inner outline-none transition focus:border-blue-500"
          calendarClassName="shift-datepicker-calendar"
          popperClassName="shift-datepicker-popper"
        />
        <p className="mt-2 text-xs text-slate-500">End date and time can spill into the next day, so overnight and cross-date shifts are explicit.</p>
      </div>
    </div>
  );
}
