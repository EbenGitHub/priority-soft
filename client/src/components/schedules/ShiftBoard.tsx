import { getShiftTiming } from '../../lib/calendarTime';
import { ShiftBoardProps } from './types';

export default function ShiftBoard({
  coverageGroups,
  viewerTimeZone,
  highlightedCoverageGroupId,
  publishingShiftId,
  onTogglePublish,
  onOpenAssignment,
  onOpenHistory,
  onOpenEdit,
}: ShiftBoardProps) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-800 p-8 shadow-2xl">
      <h3 className="mb-8 flex items-center gap-3 text-2xl font-bold">
        Pending Database Deployments
        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-400">
          {coverageGroups.length} schedule groups resolved
        </span>
      </h3>

      {coverageGroups.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-slate-700 py-16 text-center">
          <p className="text-lg italic text-slate-400">No shifts are plotted out for this territory.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {coverageGroups.map((group) => {
          const shift = group.shifts[0];
          const timing = getShiftTiming(shift, viewerTimeZone);
          const isHighlighted = highlightedCoverageGroupId === group.id;
          const assignedStaff = group.shifts.filter((item) => item.assignedStaff);

          return (
            <div
              key={shift.id}
              data-coverage-group={group.id}
              className={`group flex flex-col justify-between rounded-[1.5rem] border p-6 shadow-lg transition-colors ${
                isHighlighted
                  ? 'border-cyan-400 ring-2 ring-cyan-400/40 shadow-[0_0_25px_rgba(34,211,238,0.18)]'
                  : 'border-slate-700 bg-slate-900 hover:border-slate-500'
              }`}
            >
              <div className="mb-6">
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex flex-col gap-2">
                    <p className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-mono text-sm text-blue-400">
                      {timing.locationDate}
                    </p>
                    {timing.isOvernight && (
                      <span className="w-fit rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-violet-300">
                        Overnight
                      </span>
                    )}
                  </div>
                  <button
                    disabled={publishingShiftId === shift.id}
                    onClick={() => onTogglePublish(shift.id)}
                    className={`flex items-center rounded-lg border px-2 py-1 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      shift.published
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                    }`}
                  >
                    {publishingShiftId === shift.id
                      ? 'UPDATING...'
                      : shift.published
                        ? 'PUBLISHED'
                        : 'DRAFT (DEPLOY)'}
                  </button>
                </div>
                <p className="mb-2 text-2xl font-extrabold tracking-tighter">{timing.locationTimeRange}</p>
                <p className="mb-3 text-xs text-slate-400">{timing.locationTimeZone}</p>
                <p className="mb-3 text-xs text-slate-500">
                  Your view: {timing.viewerDate} • {timing.viewerTimeRange}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-block rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-300">
                    {group.requiredSkillName} Required
                  </span>
                  <span className="inline-block rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-300">
                    {assignedStaff.length}/{group.headcountNeeded} Assigned
                  </span>
                  {shift.skipManagerApproval && (
                    <span className="inline-block rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                      Skip Approval
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-800 pt-5">
                <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-inner">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Coverage Status
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {group.status === 'balanced' && 'Coverage matches requested headcount.'}
                    {group.status === 'understaffed' &&
                      `Understaffed. Add ${group.openCount} more assignment${group.openCount === 1 ? '' : 's'}.`}
                    {group.status === 'no_coverage' && 'No one is assigned yet.'}
                    {group.status === 'overstaffed' &&
                      `Overstaffed. Review ${Math.max(0, group.slotCount - group.headcountNeeded)} extra slot${Math.max(0, group.slotCount - group.headcountNeeded) === 1 ? '' : 's'}.`}
                  </p>
                  {assignedStaff.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {assignedStaff.map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.assignedStaff?.name}</p>
                            <p className="text-[11px] text-slate-400">Slot {item.slotIndex || 1}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onOpenAssignment(group.shifts.find((item) => !item.assignedStaff) || shift)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 py-3.5 text-sm font-bold text-slate-300 transition-all group-hover:border-blue-500/50 group-hover:bg-blue-500/10 group-hover:text-blue-400 hover:bg-slate-700"
                >
                  <span>Manage Assignments</span>
                  <span className="text-xl leading-none">→</span>
                </button>
                <button
                  onClick={() => onOpenHistory(shift)}
                  className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300"
                >
                  View Audit Trail
                </button>
                <button
                  onClick={() => onOpenEdit(shift)}
                  className="mt-3 w-full rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-blue-300 transition hover:border-blue-400 hover:text-white"
                >
                  Edit Shift
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
