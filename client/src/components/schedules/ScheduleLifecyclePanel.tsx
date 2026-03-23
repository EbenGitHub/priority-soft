export default function ScheduleLifecyclePanel({ cutoffHours }: { cutoffHours: number }) {
  return (
    <div className="mb-8 rounded-[2rem] border border-slate-700 bg-slate-800 p-6 shadow-xl">
      <h3 className="text-xl font-bold text-white">Schedule Lifecycle</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">1. Create</p>
          <p className="mt-2 text-sm text-white">Define date, time, skill, and headcount.</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">2. Publish</p>
          <p className="mt-2 text-sm text-white">Publish the weekly schedule when staffing is ready.</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">3. Lock Window</p>
          <p className="mt-2 text-sm text-white">
            Published schedules lock inside {cutoffHours} hours unless a manager override is
            documented.
          </p>
        </div>
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">4. Start</p>
          <p className="mt-2 text-sm text-white">
            Once the shift starts, schedule edits are blocked unless explicitly overridden.
          </p>
        </div>
      </div>
    </div>
  );
}
