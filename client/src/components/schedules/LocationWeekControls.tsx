import { LocationWeekControlsProps } from './types';

export default function LocationWeekControls({
  availableLocations,
  selectedLocation,
  selectedWeekStart,
  cutoffInput,
  cutoffHours,
  savingCutoff,
  publishingWeek,
  onSelectLocation,
  onChangeWeekStart,
  onMoveWeek,
  onCutoffInputChange,
  onSaveCutoff,
  onPublishWeek,
}: LocationWeekControlsProps) {
  return (
    <>
      <div className="mb-8 flex gap-4">
        {availableLocations.map((location) => (
          <button
            key={location.id}
            onClick={() => onSelectLocation(location.id)}
            className={`rounded-xl border px-5 py-2.5 font-bold shadow-sm transition-all ${
              selectedLocation === location.id
                ? 'border-blue-500/50 bg-blue-500/20 text-blue-400'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {location.name}
          </button>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap items-end gap-4 rounded-[1.5rem] border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex gap-2">
          <button
            onClick={() => onMoveWeek(-1)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            Previous Week
          </button>
          <button
            onClick={() => onMoveWeek(1)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            Next Week
          </button>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Week Start
          </label>
          <input
            type="date"
            value={selectedWeekStart}
            onChange={(event) => onChangeWeekStart(event.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
          />
        </div>

        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
            Planning Window
          </p>
          <p className="mt-1 text-sm text-white">Use the week picker to plan any upcoming future week.</p>
        </div>

        <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">Cutoff Hours</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={cutoffInput}
              onChange={(event) => onCutoffInputChange(event.target.value)}
              type="number"
              min={0}
              className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              disabled={savingCutoff}
              onClick={onSaveCutoff}
              className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-violet-300 disabled:opacity-50"
            >
              {savingCutoff ? 'Saving...' : 'Save'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">Current lock window: {cutoffHours} hours</p>
        </div>

        <button
          disabled={publishingWeek !== null}
          onClick={() => onPublishWeek(true)}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-300 transition hover:border-emerald-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {publishingWeek === 'publish' ? 'Publishing...' : 'Publish Week'}
        </button>
        <button
          disabled={publishingWeek !== null}
          onClick={() => onPublishWeek(false)}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300 transition hover:border-amber-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {publishingWeek === 'unpublish' ? 'Updating...' : 'Unpublish Week'}
        </button>
      </div>
    </>
  );
}
