import { SchedulingHeaderProps } from './types';

export default function SchedulingHeader({
  isConnected,
  lastSync,
  viewerTimeZone,
  onCreateShift,
}: SchedulingHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-4">
          <h2 className="text-4xl font-extrabold tracking-tight">Shift Scheduling Console</h2>
          <span
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
              isConnected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'animate-pulse bg-emerald-400' : 'bg-rose-400'}`} />
            {isConnected ? 'Live Socket Connected' : 'Connecting Sync...'}
          </span>
        </div>
        <p className="text-lg text-slate-400">
          Build, validate and publish weekly configurations across Live Server API bounds.
        </p>
        <p className="mt-2 font-mono text-xs text-slate-500">
          Viewer timezone: {viewerTimeZone} • Last sync: {new Date(lastSync).toLocaleTimeString()}
        </p>
      </div>
      <button
        onClick={onCreateShift}
        className="whitespace-nowrap rounded-xl border border-blue-500 bg-blue-600 px-6 py-3 font-bold shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-colors hover:bg-blue-500"
      >
        + Build Unassigned Shift Template
      </button>
    </header>
  );
}
