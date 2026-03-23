import { getShiftTiming } from '../../lib/calendarTime';
import { ShiftAuditModalProps } from './types';

export default function ShiftAuditModal({
  shift,
  viewerTimeZone,
  loading,
  logs,
  onClose,
}: ShiftAuditModalProps) {
  if (!shift) return null;

  const timing = getShiftTiming(shift, viewerTimeZone);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-900 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/50 p-6">
          <div>
            <h3 className="text-xl font-bold">Shift Audit Trail</h3>
            <p className="mt-1 font-mono text-xs text-slate-400">
              {timing.locationDate} • {timing.locationTimeRange} • {shift.location?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-500">
              Loading audit history...
            </div>
          )}
          {!loading && logs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-500">
              No audit events recorded for this shift yet.
            </div>
          )}
          {!loading && logs.length > 0 && (
            <div className="space-y-4">
              {logs.map((entry) => (
                <div key={entry.id} className="rounded-[1.5rem] border border-slate-700 bg-slate-950 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
                        {entry.action.replaceAll('_', ' ')}
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">{entry.summary}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {entry.actorName} • {entry.actorRole}
                      </p>
                    </div>
                    <p className="font-mono text-xs text-slate-500">
                      {new Date(entry.occurredAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        Before
                      </p>
                      <pre className="whitespace-pre-wrap text-xs text-slate-300">
                        {JSON.stringify(entry.beforeState, null, 2)}
                      </pre>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        After
                      </p>
                      <pre className="whitespace-pre-wrap text-xs text-slate-300">
                        {JSON.stringify(entry.afterState, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
