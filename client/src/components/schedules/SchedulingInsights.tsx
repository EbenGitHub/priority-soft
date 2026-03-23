import { FairnessAnalytics } from '../../lib/fairnessMetrics';
import { getShiftTiming, isShiftActive } from '../../lib/calendarTime';
import { Shift, Staff } from '../../lib/mockData';

type Props = {
  shifts: Shift[];
  staffList: Staff[];
  fairnessData: FairnessAnalytics | null;
  viewerTimeZone: string;
};

export default function SchedulingInsights({
  shifts,
  staffList,
  fairnessData,
  viewerTimeZone,
}: Props) {
  const projectedLaborDash = staffList
    .map((staff) => {
      const projectedShifts = shifts.filter((shift) => shift.assignedStaff?.id === staff.id);
      const hours = projectedShifts.reduce(
        (total, shift) => total + getShiftTiming(shift, viewerTimeZone).durationHours,
        0,
      );
      const overtimeHours = Math.max(0, hours - 40);
      const otCost = overtimeHours * 25.5 * 1.5;
      return { staff, hours, overtimeHours, otCost };
    })
    .filter((item) => item.hours > 0)
    .sort((left, right) => right.hours - left.hours);

  const onDutyShifts = shifts.filter((shift) => shift.assignedStaff && isShiftActive(shift, new Date()));

  return (
    <>
      {onDutyShifts.length > 0 && (
        <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-emerald-500/30 bg-emerald-950/20 p-8 shadow-2xl">
          <div className="absolute right-0 top-0 h-96 w-96 translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-3xl" />
          <h3 className="relative z-10 mb-6 flex items-center gap-3 text-2xl font-bold text-emerald-50">
            On-Duty Active Floor Tracker
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 animate-pulse">
              Monitoring Live Flow
            </span>
          </h3>
          <div className="relative z-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {onDutyShifts.map((shift) => {
              const timing = getShiftTiming(shift, viewerTimeZone);
              return (
                <div
                  key={`duty-${shift.id}`}
                  className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 shadow-lg transition-colors hover:border-emerald-400"
                >
                  <div>
                    <p className="mb-1 text-sm font-bold text-white">{shift.assignedStaff?.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                      {shift.location?.name} • {shift.requiredSkill?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Shift Ends</p>
                    <p className="font-mono font-bold text-emerald-300">
                      {timing.locationTimeRange.split(' - ')[1]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {projectedLaborDash.length > 0 && (
        <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-800 p-8 shadow-2xl">
          <div className="absolute right-0 top-0 h-96 w-96 translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/5 blur-3xl" />
          <h3 className="relative z-10 mb-6 flex items-center gap-3 text-2xl font-bold">
            Projected Labor Cost Analytics
            <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-500">
              Live Evaluation
            </span>
          </h3>
          <div className="relative z-10 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
            {projectedLaborDash.map((item) => (
              <div
                key={item.staff.id}
                className={`rounded-[1.5rem] border p-5 shadow-lg transition-transform hover:-translate-y-1 ${
                  item.overtimeHours > 0
                    ? 'border-amber-500/40 bg-amber-950/40'
                    : item.hours >= 35
                      ? 'border-blue-500/30 bg-blue-900/10'
                      : 'border-slate-700 bg-slate-900'
                }`}
              >
                <p className="mb-3 truncate font-bold">{item.staff.name}</p>
                <div className="flex items-end justify-between">
                  <p
                    className={`font-mono text-3xl font-extrabold ${
                      item.overtimeHours > 0
                        ? 'text-amber-400'
                        : item.hours >= 35
                          ? 'text-blue-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {item.hours.toFixed(1)}
                    <span className="ml-1 text-sm font-sans opacity-50">hrs</span>
                  </p>
                </div>
                {item.overtimeHours > 0 && (
                  <div className="mt-4 border-t border-amber-500/20 pt-4">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-500/70">
                      Overtime Target Premium
                    </p>
                    <p className="font-mono text-sm font-bold text-red-400">+${item.otCost.toFixed(2)}</p>
                  </div>
                )}
                {item.overtimeHours === 0 && item.hours >= 35 && (
                  <div className="mt-4 border-t border-blue-500/20 pt-4">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-blue-400/70">
                      Status Clearance Check
                    </p>
                    <p className="font-mono text-sm font-bold text-blue-300">Approaching Limit</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {fairnessData && fairnessData.totalPremiumShifts > 0 && (
        <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-800 p-8 shadow-xl">
          <div className="absolute right-0 top-0 h-96 w-96 translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/5 blur-3xl" />
          <div className="relative z-10 mb-6 flex items-center justify-between">
            <h3 className="flex items-center gap-3 text-2xl font-bold">
              Fairness & Equity Distribution
              <span className="rounded-md border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">
                Live Analytics
              </span>
            </h3>
            <div className="text-right">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Distribution Equity Grade
              </p>
              <p
                className={`font-mono text-3xl font-extrabold ${
                  fairnessData.overallScore >= 90
                    ? 'text-emerald-400'
                    : fairnessData.overallScore >= 70
                      ? 'text-amber-400'
                      : 'text-rose-400'
                }`}
              >
                {fairnessData.overallScore}%
              </p>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="rounded-[1.5rem] border border-slate-700 bg-slate-900 p-5">
              <p className="mb-4 flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500">
                <span>Premium Shift Allocation</span>
                <span className="text-fuchsia-400">Total: {fairnessData.totalPremiumShifts}</span>
              </p>
              <div className="space-y-3">
                {fairnessData.staffMetrics
                  .filter((metric) => metric.premiumShifts > 0)
                  .map((metric) => (
                    <div key={metric.staff.id} className="flex items-center gap-4">
                      <p className="w-32 truncate text-sm font-bold">{metric.staff.name}</p>
                      <div className="h-3 flex-1 overflow-hidden rounded-full border border-slate-700 bg-slate-800">
                        <div
                          className="h-full rounded-full bg-fuchsia-500 transition-all duration-1000"
                          style={{
                            width: `${(metric.premiumShifts / fairnessData.totalPremiumShifts) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="w-8 text-right font-mono text-xs text-slate-400">{metric.premiumShifts}</p>
                    </div>
                  ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-700 bg-slate-900 p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                Target Hours Fulfillment
              </p>
              <div className="custom-scrollbar max-h-48 space-y-3 overflow-y-auto pr-2">
                {fairnessData.staffMetrics.map((metric) => (
                  <div
                    key={metric.staff.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/50 p-2 transition-colors hover:bg-slate-800"
                  >
                    <p className="truncate text-sm font-bold">{metric.staff.name}</p>
                    <div className="flex items-center gap-3">
                      <p className="font-mono text-xs uppercase tracking-widest text-slate-400">
                        {metric.assignedHours.toFixed(1)} / {metric.targetHours}h
                      </p>
                      {metric.hoursVariance < 0 ? (
                        <p className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-rose-400">
                          {metric.hoursVariance.toFixed(1)}h Under
                        </p>
                      ) : metric.hoursVariance > 0 ? (
                        <p className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-400">
                          +{metric.hoursVariance.toFixed(1)}h Over
                        </p>
                      ) : (
                        <p className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                          Target Met
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
