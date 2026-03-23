"use client";

import React from 'react';
import DatePicker from 'react-datepicker';
import { ShiftPreview } from '../schedules/types';

type Props = {
  locationLabel: string;
  locationTimeZone: string;
  viewerTimeZone: string;
  startDateTime: Date | null;
  endDateTime: Date | null;
  shiftPreview: ShiftPreview | null;
  minDate?: Date;
  onChangeStartDateTime: (value: Date | null) => void;
  onChangeEndDateTime: (value: Date | null) => void;
};

export default function ShiftDateTimePicker({
  locationLabel,
  locationTimeZone,
  viewerTimeZone,
  startDateTime,
  endDateTime,
  shiftPreview,
  minDate,
  onChangeStartDateTime,
  onChangeEndDateTime,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Scheduling Context</p>
        <p className="mt-2 text-sm text-white">{locationLabel}</p>
        <p className="mt-1 text-xs text-slate-400">Pick the time in your local timezone. The app will convert it into the selected location&apos;s schedule automatically.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Your Timezone</p>
            <p className="mt-2 text-sm font-semibold text-white">{viewerTimeZone}</p>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Location Timezone</p>
            <p className="mt-2 text-sm font-semibold text-white">{locationTimeZone}</p>
          </div>
        </div>
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
        <p className="mt-2 text-xs text-slate-500">This picker uses your current timezone: {viewerTimeZone}</p>
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
        {shiftPreview && (
          <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">Live Time Conversion</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Your Time</p>
                <p className="mt-2 text-sm font-semibold text-white">{shiftPreview.viewerDate}</p>
                <p className="mt-1 text-sm text-cyan-300">{shiftPreview.viewerTimeRange}</p>
                <p className="mt-1 text-[11px] text-slate-500">{shiftPreview.viewerTimeZone}</p>
              </div>
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Location Time</p>
                <p className="mt-2 text-sm font-semibold text-white">{shiftPreview.locationDate}</p>
                <p className="mt-1 text-sm text-cyan-300">{shiftPreview.locationTimeRange}</p>
                <p className="mt-1 text-[11px] text-slate-500">{shiftPreview.locationTimeZone}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
