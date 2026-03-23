import { CoverageHealthSectionProps } from './types';

function getCoverageTone(status: CoverageHealthSectionProps['coverageGroups'][number]['status']) {
  if (status === 'balanced') {
    return 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-400/40';
  }
  if (status === 'overstaffed') {
    return 'border-amber-500/20 bg-amber-500/5 hover:border-amber-400/40';
  }
  return 'border-rose-500/20 bg-rose-500/5 hover:border-rose-400/40';
}

function getCoverageBadgeTone(status: CoverageHealthSectionProps['coverageGroups'][number]['status']) {
  if (status === 'balanced') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  if (status === 'overstaffed') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
  return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
}

export default function CoverageHealthSection({
  coverageGroups,
  onFocusGroup,
}: CoverageHealthSectionProps) {
  if (coverageGroups.length === 0) return null;

  return (
    <section className="mb-8 rounded-[2rem] border border-slate-700 bg-slate-800 p-8 shadow-2xl">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white">Coverage Health</h3>
        <p className="mt-1 text-sm text-slate-400">
          Headcount targets, open coverage, and staffing imbalance warnings for this location.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {coverageGroups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => onFocusGroup(group.id)}
            className={`w-full rounded-[1.5rem] border p-5 text-left transition-all hover:-translate-y-0.5 ${getCoverageTone(
              group.status,
            )}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-white">
                  {group.dateLabel} • {group.timeRange}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {group.locationName} • {group.requiredSkillName} • {group.locationTimeZone}
                </p>
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${getCoverageBadgeTone(
                  group.status,
                )}`}
              >
                {group.status.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Needed</p>
                <p className="mt-2 text-2xl font-black text-white">{group.headcountNeeded}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Assigned</p>
                <p className="mt-2 text-2xl font-black text-white">{group.assignedCount}</p>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  {group.status === 'overstaffed' ? 'Extra' : 'Open'}
                </p>
                <p className="mt-2 text-2xl font-black text-white">
                  {group.status === 'overstaffed'
                    ? Math.max(0, group.slotCount - group.headcountNeeded)
                    : group.openCount}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-300">
              {group.status === 'balanced' && 'Coverage matches the requested headcount.'}
              {group.status === 'understaffed' &&
                `Understaffed by ${group.openCount}. Managers should assign additional staff before publish.`}
              {group.status === 'no_coverage' &&
                'No coverage assigned yet. This schedule currently has zero staffed slots.'}
              {group.status === 'overstaffed' &&
                'Current slot count exceeds requested headcount. Review whether this extra coverage is intentional.'}
            </p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              Click to jump to this schedule group
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
