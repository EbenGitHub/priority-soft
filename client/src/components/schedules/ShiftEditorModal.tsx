import ShiftDateTimePicker from '../calendar/ShiftDateTimePicker';
import ModalShell from '../ui/ModalShell';
import { ShiftEditorModalProps } from './types';

export default function ShiftEditorModal({
  isOpen,
  editingShift,
  availableLocations,
  activeDraftLocation,
  startDateTime,
  endDateTime,
  planningMinDate,
  skills,
  newShiftLocation,
  newShiftSkill,
  newShiftHeadcount,
  newShiftSkipManagerApproval,
  cutoffHours,
  isOvernightDraft,
  shiftDateOrderInvalid,
  shiftPreview,
  creatingShift,
  onClose,
  onSubmit,
  onChangeStartDateTime,
  onChangeEndDateTime,
  onChangeLocation,
  onChangeSkill,
  onChangeHeadcount,
  onChangeSkipManagerApproval,
}: ShiftEditorModalProps) {
  if (!isOpen) return null;

  return (
    <ModalShell
      title={editingShift ? 'Edit Shift' : 'New Shift Query'}
      onClose={onClose}
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <ShiftDateTimePicker
          locationLabel={activeDraftLocation?.name || 'Select a location'}
          locationTimeZone={activeDraftLocation?.timezone || 'UTC'}
          startDateTime={startDateTime}
          endDateTime={endDateTime}
          minDate={planningMinDate}
          onChangeStartDateTime={onChangeStartDateTime}
          onChangeEndDateTime={onChangeEndDateTime}
        />
        <div>
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Location
          </label>
          <select
            value={newShiftLocation}
            onChange={(event) => onChangeLocation(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-sm text-white shadow-inner transition-colors focus:border-blue-500 focus:outline-none"
          >
            {availableLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} • {location.timezone}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
            Cutoff Policy
          </p>
          <p className="mt-2 text-sm text-white">
            Current cutoff is {cutoffHours} hours. Existing shifts cannot be edited once they start
            or once they are inside that cutoff unless an override is documented.
          </p>
        </div>
        <div
          className={`rounded-2xl border p-4 ${
            isOvernightDraft ? 'border-violet-500/30 bg-violet-500/10' : 'border-slate-700 bg-slate-950'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Overnight Handling
              </p>
              <p className="mt-2 text-sm text-white">
                {isOvernightDraft
                  ? 'This draft will be stored as a single cross-date or overnight shift.'
                  : 'Start and end can sit on different dates. If they share the same date and the end time is earlier, it still becomes overnight.'}
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                isOvernightDraft
                  ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400'
              }`}
            >
              {isOvernightDraft ? 'Overnight' : 'Same Day'}
            </span>
          </div>
        </div>
        {shiftDateOrderInvalid && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">
              Invalid Time Range
            </p>
            <p className="mt-2 text-sm text-white">
              Shift end must be later than shift start. Adjust the end date/time so the shift moves
              forward in time.
            </p>
          </div>
        )}
        <div>
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Mandatory Certification
          </label>
          <select
            value={newShiftSkill}
            onChange={(event) => onChangeSkill(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-sm text-white shadow-inner transition-colors focus:border-blue-500 focus:outline-none"
          >
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Headcount Needed
          </label>
          <input
            type="number"
            min={1}
            value={newShiftHeadcount}
            onChange={(event) => onChangeHeadcount(Math.max(1, Number(event.target.value) || 1))}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-sm text-white shadow-inner transition-colors focus:border-blue-500 focus:outline-none"
          />
          <p className="mt-2 text-xs text-slate-500">
            Creating a schedule with headcount greater than 1 creates multiple staffing slots in
            the same schedule group.
          </p>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
              Skip Manager Approval
            </p>
            <p className="mt-2 text-sm text-white">
              Off by default. If enabled, accepted swap/drop changes for this shift are applied
              immediately without waiting for manager approval.
            </p>
          </div>
          <input
            type="checkbox"
            checked={newShiftSkipManagerApproval}
            onChange={(event) => onChangeSkipManagerApproval(event.target.checked)}
            className="h-5 w-5 rounded border-slate-600 bg-slate-950 text-emerald-500"
          />
        </label>
        {shiftPreview && (
          <div className="space-y-2 rounded-2xl border border-slate-700 bg-slate-950 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Time Preview
              </p>
              {shiftPreview.isOvernight && (
                <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-violet-300">
                  Overnight
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white">
              {shiftPreview.locationDate} • {shiftPreview.locationTimeRange}
            </p>
            <p className="text-xs text-slate-400">{shiftPreview.locationTimeZone}</p>
            <p className="text-xs text-slate-500">
              Viewer: {shiftPreview.viewerDate} • {shiftPreview.viewerTimeRange} (
              {shiftPreview.viewerTimeZone})
            </p>
            <p className="text-xs text-slate-500">
              UTC: {new Date(shiftPreview.startUtc).toISOString()} →{' '}
              {new Date(shiftPreview.endUtc).toISOString()}
            </p>
            <p className="font-mono text-xs text-emerald-400">
              {shiftPreview.durationHours.toFixed(1)}h total
            </p>
            <p className="text-xs text-amber-300">
              Headcount target: {newShiftHeadcount}. The dashboard will warn if this schedule ends
              up understaffed or overstaffed.
            </p>
            <p className="text-xs text-emerald-300">
              {newShiftSkipManagerApproval
                ? 'Peer-accepted shift changes for this shift will skip manager approval.'
                : 'Peer-accepted shift changes for this shift will still require manager approval.'}
            </p>
          </div>
        )}
        <div className="pt-4">
          <button
            type="submit"
            disabled={
              creatingShift ||
              !newShiftLocation ||
              !newShiftSkill ||
              !startDateTime ||
              !endDateTime ||
              shiftDateOrderInvalid
            }
            className="w-full rounded-xl border border-blue-500 bg-blue-600 py-3.5 font-bold transition-all hover:-translate-y-0.5 hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {creatingShift
              ? editingShift
                ? 'Saving...'
                : 'Creating...'
              : editingShift
                ? 'Save Shift Changes'
                : 'Push Query to Database'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
