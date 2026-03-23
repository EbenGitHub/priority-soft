import { Skill } from '../../lib/mockData';
import { validateAssignment } from '../../lib/schedulingRules';
import { getShiftTiming } from '../../lib/calendarTime';
import { forecastAssignmentImpact } from '../../lib/overtimeForecast';
import ModalShell from '../ui/ModalShell';
import { ShiftAssignmentModalProps } from './types';

export default function ShiftAssignmentModal({
  shift,
  viewerTimeZone,
  activeCoverageGroup,
  validationData,
  staffList,
  shifts,
  assigningOperationKeys,
  getAssignmentKey,
  getUnassignKey,
  classifyAssignmentConflict,
  isWarnOnlyConflict,
  onClose,
  onAttemptAssignment,
  onRemoveAssignment,
}: ShiftAssignmentModalProps) {
  if (!shift) return null;

  const shiftTiming = getShiftTiming(shift, viewerTimeZone);
  const rankedCandidates = [...staffList]
    .map((staff) => ({ staff, preflight: validateAssignment(staff, shift, shifts, staffList) }))
    .sort((left, right) => {
      const score = (validity: typeof left.preflight) => {
        if (validity.valid && !validity.requiresOverride) return 0;
        if (validity.valid && validity.requiresOverride) return 1;
        const classification = classifyAssignmentConflict(validity);
        if (classification.kind === 'occupied') return 2;
        if (classification.kind === 'availability') return 3;
        if (classification.kind === 'compliance') return 4;
        return 5;
      };

      return score(left.preflight) - score(right.preflight);
    });

  return (
    <ModalShell title="Deploy Live Roster Match" onClose={onClose} maxWidthClass="max-w-2xl">
      <p className="mt-1 font-mono text-xs text-slate-400">
        {shiftTiming.locationDate} • {shiftTiming.locationTimeRange} ({shiftTiming.locationTimeZone})
      </p>

      <div className="custom-scrollbar mt-6 max-h-[70vh] overflow-y-auto pr-2">
        {activeCoverageGroup && (
          <div
            className={`mb-8 rounded-2xl border p-5 ${
              activeCoverageGroup.status === 'balanced'
                ? 'border-emerald-500/20 bg-emerald-500/10'
                : activeCoverageGroup.status === 'overstaffed'
                  ? 'border-amber-500/20 bg-amber-500/10'
                  : 'border-rose-500/20 bg-rose-500/10'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
                  Group Staffing Status
                </p>
                <p className="mt-2 text-sm text-white">
                  Need {activeCoverageGroup.headcountNeeded} staff, currently assigned{' '}
                  {activeCoverageGroup.assignedCount}, slot count {activeCoverageGroup.slotCount}.
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                  activeCoverageGroup.status === 'balanced'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : activeCoverageGroup.status === 'overstaffed'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                {activeCoverageGroup.status.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              {activeCoverageGroup.status === 'balanced' &&
                'This group already meets the target. Assigning more staff here would create overstaffing unless you are filling a replacement slot.'}
              {activeCoverageGroup.status === 'understaffed' &&
                `This group is understaffed. Add ${activeCoverageGroup.openCount} more assignment${
                  activeCoverageGroup.openCount === 1 ? '' : 's'
                } to reach target headcount.`}
              {activeCoverageGroup.status === 'no_coverage' &&
                `This group has no one assigned yet. Add ${activeCoverageGroup.headcountNeeded} staff to cover it.`}
              {activeCoverageGroup.status === 'overstaffed' &&
                `This group is overstaffed. Deduct ${Math.max(
                  0,
                  activeCoverageGroup.slotCount - activeCoverageGroup.headcountNeeded,
                )} slot${
                  Math.max(0, activeCoverageGroup.slotCount - activeCoverageGroup.headcountNeeded) === 1
                    ? ''
                    : 's'
                } or remove extra assignments if the excess is not intentional.`}
            </p>
            <div className="mt-5 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Current Group Assignments
              </p>
              {activeCoverageGroup.shifts.filter((item) => item.assignedStaff).length === 0 && (
                <p className="text-sm text-slate-500">No staff assigned in this group yet.</p>
              )}
              {activeCoverageGroup.shifts
                .filter((item) => item.assignedStaff)
                .map((item) => (
                  <div
                    key={`group-assigned-${item.id}`}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950 p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{item.assignedStaff?.name}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Slot {item.slotIndex || 1} • {item.requiredSkill?.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={assigningOperationKeys.includes(getUnassignKey(item.id))}
                      onClick={() => onRemoveAssignment(item)}
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-rose-300 transition hover:border-rose-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {assigningOperationKeys.includes(getUnassignKey(item.id))
                        ? 'Unassigning...'
                        : 'Unassign'}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {validationData && !validationData.valid && (
          <div className="mb-8 animate-fade-in-up rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <p className="text-lg font-extrabold text-red-400">System Block Active</p>
            </div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">
              Rule Violated
            </p>
            <p className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 font-mono text-sm leading-relaxed text-red-300">
              {validationData.reason}
            </p>
            {validationData.suggestions && validationData.suggestions.length > 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                  Suggested Alternatives
                </p>
                <div className="flex flex-wrap gap-2">
                  {validationData.suggestions.map((candidate) => {
                    const suggestedStaff = staffList.find((staff) => staff.id === candidate.id);
                    if (!suggestedStaff) return null;

                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => onAttemptAssignment(suggestedStaff)}
                        disabled={assigningOperationKeys.some((key) =>
                          key.startsWith(`assign:${shift.id}:`),
                        )}
                        className="rounded-full border border-emerald-500/30 bg-slate-950 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {candidate.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Manual Selection Candidates
          </p>
          <div className="space-y-4">
            {rankedCandidates.map(({ staff, preflight }) => {
              const isBlocked = !preflight.valid && !isWarnOnlyConflict(preflight);
              const classification = !preflight.valid ? classifyAssignmentConflict(preflight) : null;
              const impact = forecastAssignmentImpact(staff, shift, shifts);
              const recommendationLabel = preflight.valid
                ? preflight.requiresOverride
                  ? 'Override Needed'
                  : 'Recommended'
                : classification?.label;
              const recommendationClass =
                preflight.valid && !preflight.requiresOverride
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : preflight.valid && preflight.requiresOverride
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : classification?.tone === 'rose'
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                      : classification?.tone === 'amber'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400';
              const assignmentKey = getAssignmentKey(shift.id, staff.id);
              const isAssigning = assigningOperationKeys.includes(assignmentKey);

              return (
                <div
                  key={staff.id}
                  className={`flex items-center justify-between rounded-[1.5rem] border bg-slate-800 p-5 transition-all ${
                    isBlocked ? 'border-slate-700 opacity-70' : 'border-slate-700 shadow-lg hover:border-blue-500/50'
                  }`}
                >
                  <div className="flex-1">
                    <p className="mb-2 text-lg font-bold text-white">{staff.name}</p>
                    <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest">
                      <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-400">
                        {staff.skills?.map((skill: Skill) => skill.name).join(' / ')}
                      </span>
                      <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-400">
                        {staff.desiredHours}h Target
                      </span>
                      <span className={`rounded border px-2 py-0.5 ${recommendationClass}`}>
                        {recommendationLabel}
                      </span>
                    </div>

                    {preflight.warnings && preflight.warnings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {preflight.warnings.map((warning, index) => (
                          <p
                            key={index}
                            className={`inline-block rounded border px-2 py-1 font-mono text-xs ${
                              preflight.requiresOverride && warning.includes('7 Consecutive')
                                ? 'border-red-500/20 bg-red-500/10 text-red-400'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                            }`}
                          >
                            ⚠️ {warning}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                          Weekly Impact
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {impact.currentWeeklyHours.toFixed(1)}h {'->'} {impact.projectedWeeklyHours.toFixed(1)}h
                        </p>
                        <p
                          className={`mt-1 text-[11px] ${
                            impact.weeklyOvertime
                              ? 'text-rose-300'
                              : impact.weeklyWarning
                                ? 'text-amber-300'
                                : 'text-slate-400'
                          }`}
                        >
                          {impact.weeklyOvertime
                            ? `Overtime triggered. +${impact.overtimeHoursAdded.toFixed(1)}h OT, projected OT cost $${impact.projectedOvertimeCost.toFixed(2)}`
                            : impact.weeklyWarning
                              ? 'Approaching overtime threshold'
                              : 'Within regular weekly range'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                          Daily Impact
                        </p>
                        <p className="mt-2 text-sm text-white">
                          {impact.currentDailyHours.toFixed(1)}h {'->'} {impact.projectedDailyHours.toFixed(1)}h
                        </p>
                        <p
                          className={`mt-1 text-[11px] ${
                            impact.dailyHardBlock
                              ? 'text-rose-300'
                              : impact.dailyWarning
                                ? 'text-amber-300'
                                : 'text-slate-400'
                          }`}
                        >
                          {impact.dailyHardBlock
                            ? 'Would exceed the 12-hour hard limit'
                            : impact.dailyWarning
                              ? 'Would enter daily overtime'
                              : 'No daily overtime issue'}
                        </p>
                      </div>
                    </div>
                    {!preflight.valid && (
                      <p
                        className={`ml-1 mt-2 font-mono text-xs ${
                          classification?.tone === 'rose'
                            ? 'text-rose-400'
                            : classification?.tone === 'amber'
                              ? 'text-amber-300'
                              : 'text-red-400'
                        }`}
                      >
                        {preflight.reason}
                      </p>
                    )}
                  </div>

                  <button
                    disabled={isBlocked || isAssigning}
                    onClick={() => onAttemptAssignment(staff)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-6 py-3 text-sm font-bold shadow-sm transition-all ${
                      isBlocked || isAssigning
                        ? 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600'
                        : !preflight.valid
                          ? 'border-rose-500 bg-rose-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.2)] hover:bg-rose-500'
                          : preflight.requiresOverride
                            ? 'border-amber-500 bg-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:bg-amber-500'
                            : 'border-emerald-500 bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:bg-emerald-500'
                    }`}
                  >
                    <span>
                      {isAssigning
                        ? 'ASSIGNING...'
                        : isBlocked
                          ? 'BLOCKED'
                          : !preflight.valid
                            ? 'ASSIGN WITH WARNING'
                            : preflight.requiresOverride
                              ? 'OVERRIDE EXECUTE'
                              : 'ASSIGN SHIFT'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
