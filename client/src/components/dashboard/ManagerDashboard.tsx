"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shift, Staff } from '../../lib/mockData';
import ScheduleCalendar from '../calendar/ScheduleCalendar';
import { toast } from 'sonner';
import { getShiftTiming } from '../../lib/calendarTime';
import { groupShiftCoverage } from '../../lib/shiftCoverage';
import { forecastAssignmentImpact } from '../../lib/overtimeForecast';
import { useRealtime } from '../../lib/useRealtime';

interface SwapRequest {
  id: string;
  type: string;
  status: string;
  initiatorShift?: Shift | null;
  targetShift?: Shift | null;
  initiatorUser?: any;
  targetUser?: any;
}

export default function ManagerDashboard({ user }: { user: any }) {
  const queryClient = useQueryClient();
  const [locations, setLocations] = useState(user.locations || []);
  const [selectedLoc, setSelectedLoc] = useState<string | null>(locations.length ? locations[0].id : null);
  const [viewerTimeZone, setViewerTimeZone] = useState('UTC');
  const [actingSwapId, setActingSwapId] = useState<string | null>(null);
  const [selectedFairnessStaffId, setSelectedFairnessStaffId] = useState<string>('');

  useEffect(() => {
    setViewerTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);

  const { data: staff = [], isLoading: loading, isFetching: staffRefreshing } = useQuery<Staff[]>({
    queryKey: ['manager-staff', user.id, selectedLoc],
    enabled: Boolean(selectedLoc),
    queryFn: async () => {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/users/location/${selectedLoc}?actorId=${encodeURIComponent(user.id)}`);
      if (!res.ok) return [];
      return res.json();
    },
    placeholderData: (previous) => previous,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: approvalData, isFetching: approvalsRefreshing } = useQuery({
    queryKey: ['manager-approvals', user.id],
    queryFn: async () => {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const [shRes, swRes] = await Promise.all([
        fetch(`${API_URL}/shifts?actorId=${encodeURIComponent(user.id)}`),
        fetch(`${API_URL}/swaps`),
      ]);
      return {
        shifts: shRes.ok ? ((await shRes.json()) as Shift[]) : [],
        swaps: swRes.ok ? ((await swRes.json()) as SwapRequest[]) : [],
      };
    },
    placeholderData: (previous) => previous,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const shifts = approvalData?.shifts || [];
  const swaps = approvalData?.swaps || [];

  useRealtime(() => {
    queryClient.invalidateQueries({ queryKey: ['manager-approvals', user.id] });
    queryClient.invalidateQueries({ queryKey: ['manager-staff', user.id, selectedLoc] });
  });

  const { data: fairnessScore = null, isFetching: fairnessRefreshing } = useQuery({
    queryKey: ['manager-fairness', selectedLoc],
    enabled: Boolean(selectedLoc),
    queryFn: async () => {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const response = await fetch(`${API_URL}/analytics/fairness?locationId=${selectedLoc}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data?.overallScore ?? null;
    },
    placeholderData: (previous) => previous,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const handleManagerAction = async (req: SwapRequest, approve: boolean) => {
     setActingSwapId(req.id);
     try {
       const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
       const action = approve ? 'approve' : 'reject';
       const res = await fetch(`${API_URL}/swaps/${req.id}/${action}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ actorId: user.id }),
       });
       if (!res.ok) throw new Error((await res.json()).message);
       await queryClient.invalidateQueries({ queryKey: ['manager-approvals', user.id] });
       toast.success(approve ? 'Swap approved.' : 'Swap rejected.');
     } catch (err:any) {
       toast.error(err.message || 'Unable to complete manager action.');
     } finally {
       setActingSwapId(null);
     }
  };

  const managerLocs = locations.map((l:any) => l.id);
  const approvalQueue = swaps.filter(s => s.status === 'PENDING_MANAGER').filter(s => {
     const shift = shifts.find(sh => sh.id === s.initiatorShift?.id);
     return shift && managerLocs.includes(shift.location?.id);
  });
  const selectedLocation = locations.find((location: any) => location.id === selectedLoc);
  const selectedLocationShifts = shifts.filter((shift) => shift.location?.id === selectedLoc);
  const locationStaff = staff.filter((member) => member.role === 'STAFF');
  const coverageGroups = groupShiftCoverage(selectedLocationShifts, viewerTimeZone);
  const overtimeCost = (() => {
    const byStaff = new Map<string, number>();
    for (const shift of selectedLocationShifts) {
      if (!shift.assignedStaff?.id) continue;
      byStaff.set(shift.assignedStaff.id, (byStaff.get(shift.assignedStaff.id) || 0) + getShiftTiming(shift, viewerTimeZone).durationHours);
    }
    return [...byStaff.values()].reduce((total, hours) => total + Math.max(0, hours - 40) * 25.5 * 1.5, 0);
  })();
  const understaffedCount = coverageGroups.filter((group) => group.status === 'understaffed').length;
  const overstaffedCount = coverageGroups.filter((group) => group.status === 'overstaffed').length;
  const noCoverageCount = coverageGroups.filter((group) => group.status === 'no_coverage').length;
  const overtimeWatchlist = staff
    .filter((member) => member.role === 'STAFF')
    .map((member) => {
      const memberShifts = selectedLocationShifts.filter((shift) => shift.assignedStaff?.id === member.id);
      const totalHours = memberShifts.reduce(
        (total, shift) => total + getShiftTiming(shift, viewerTimeZone).durationHours,
        0,
      );
      const latestShift = [...memberShifts].sort(
        (left, right) =>
          getShiftTiming(right, viewerTimeZone).startUtc.getTime() -
          getShiftTiming(left, viewerTimeZone).startUtc.getTime(),
      )[0];
      const forecast = latestShift ? forecastAssignmentImpact(member, latestShift, selectedLocationShifts) : null;
      return {
        member,
        totalHours,
        forecast,
      };
    })
    .filter((item) => item.totalHours > 0)
    .sort((left, right) => right.totalHours - left.totalHours)
    .slice(0, 5);
  const isSaturdayNightShift = (shift: Shift) => {
    const timing = getShiftTiming(shift, viewerTimeZone);
    return timing.locationWeekday === 6 && timing.startUtc.toLocaleTimeString('en-US', {
      timeZone: shift.location?.timezone || 'UTC',
      hour: '2-digit',
      hour12: false,
    }) >= '17';
  };
  const saturdayNightShifts = selectedLocationShifts.filter(
    (shift) => shift.assignedStaff?.id && isSaturdayNightShift(shift),
  );
  const fairnessInvestigation = useMemo(() => {
    const staffById = new Map(locationStaff.map((member) => [member.id, member]));
    const counts = locationStaff.map((member) => ({
      staff: member,
      shiftCount: saturdayNightShifts.filter((shift) => shift.assignedStaff?.id === member.id).length,
      shifts: saturdayNightShifts.filter((shift) => shift.assignedStaff?.id === member.id),
    }));
    const selectedStaff =
      staffById.get(selectedFairnessStaffId) || counts[0]?.staff || null;
    const selected = counts.find((item) => item.staff.id === selectedStaff?.id) || null;
    const average = counts.length
      ? counts.reduce((total, item) => total + item.shiftCount, 0) / counts.length
      : 0;
    const maxCount = counts.length ? Math.max(...counts.map((item) => item.shiftCount)) : 0;

    return {
      counts,
      selected,
      average,
      maxCount,
      summary:
        !selected
          ? 'No staff available for fairness review.'
          : selected.shiftCount === 0
            ? `${selected.staff.name} has not received any Saturday night shifts in the current location view.`
            : selected.shiftCount < average
              ? `${selected.staff.name} has received fewer Saturday night shifts than the team average.`
              : `${selected.staff.name} has received Saturday night shifts at or above the current team average.`,
    };
  }, [locationStaff, saturdayNightShifts, selectedFairnessStaffId]);

  useEffect(() => {
    if (!locationStaff.length) {
      setSelectedFairnessStaffId('');
      return;
    }
    if (!selectedFairnessStaffId || !locationStaff.some((member) => member.id === selectedFairnessStaffId)) {
      setSelectedFairnessStaffId(locationStaff[0].id);
    }
  }, [locationStaff, selectedFairnessStaffId]);

  const backgroundRefreshing = staffRefreshing || approvalsRefreshing || fairnessRefreshing;

  return (
    <div className="space-y-8 animate-fade-in-up">
       {backgroundRefreshing && !loading && (
         <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs font-semibold text-cyan-200">
           Syncing live changes...
         </div>
       )}
       <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
         <div className="rounded-[1.5rem] border border-slate-700 bg-slate-800 p-5 shadow-lg">
           <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Projected OT Cost</p>
           <p className="mt-3 text-3xl font-black text-white">${overtimeCost.toFixed(2)}</p>
         </div>
         <div className="rounded-[1.5rem] border border-slate-700 bg-slate-800 p-5 shadow-lg">
           <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Fairness Score</p>
           <p className="mt-3 text-3xl font-black text-white">{fairnessScore ?? '--'}{fairnessScore !== null ? '%' : ''}</p>
         </div>
         <div className="rounded-[1.5rem] border border-rose-500/20 bg-rose-500/5 p-5 shadow-lg">
           <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">Understaffed</p>
           <p className="mt-3 text-3xl font-black text-white">{understaffedCount}</p>
         </div>
         <div className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/5 p-5 shadow-lg">
           <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Overstaffed</p>
           <p className="mt-3 text-3xl font-black text-white">{overstaffedCount}</p>
         </div>
         <div className="rounded-[1.5rem] border border-rose-500/20 bg-rose-500/5 p-5 shadow-lg">
           <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">No Coverage</p>
           <p className="mt-3 text-3xl font-black text-white">{noCoverageCount}</p>
         </div>
       </div>

       {selectedLoc && overtimeWatchlist.length > 0 && (
         <div id="overtime-watchlist" className="dashboard-focus-target rounded-[2rem] border border-amber-500/20 bg-amber-500/5 p-8 shadow-2xl">
           <div className="mb-6 flex items-center justify-between gap-4">
             <div>
               <h3 className="text-2xl font-bold text-white">Overtime Watchlist</h3>
               <p className="mt-2 text-sm text-slate-300">
                 Managers can see who is closest to overtime and which assignments are driving it.
               </p>
             </div>
             <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
               What-if aware
             </span>
           </div>
           <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
             {overtimeWatchlist.map(({ member, totalHours, forecast }) => (
               <div key={member.id} className="rounded-[1.5rem] border border-slate-700 bg-slate-900 p-5 shadow-lg">
                 <div className="flex items-start justify-between gap-3">
                   <div>
                     <p className="text-lg font-bold text-white">{member.name}</p>
                     <p className="mt-1 text-xs text-slate-400">{member.email}</p>
                   </div>
                   <span
                     className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                       totalHours >= 40
                         ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                         : totalHours >= 35
                           ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                           : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                     }`}
                   >
                     {totalHours >= 40 ? 'Overtime' : totalHours >= 35 ? 'At Risk' : 'Stable'}
                   </span>
                 </div>
                 <p className="mt-4 text-3xl font-black text-white">{totalHours.toFixed(1)}h</p>
                 <p className="mt-1 text-xs text-slate-500">Assigned in the selected location view</p>
                 {forecast && (
                   <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
                     <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                       Last Assignment Impact
                     </p>
                     <p className="mt-2 text-sm text-white">
                       Weekly: {forecast.currentWeeklyHours.toFixed(1)}h {'->'} {forecast.projectedWeeklyHours.toFixed(1)}h
                     </p>
                     <p className="mt-1 text-[11px] text-slate-400">
                       OT cost projection: ${forecast.projectedOvertimeCost.toFixed(2)}
                     </p>
                   </div>
                 )}
               </div>
             ))}
           </div>
         </div>
       )}

       {selectedLoc && locationStaff.length > 0 && (
         <div id="fairness-investigation" className="dashboard-focus-target rounded-[2rem] border border-fuchsia-500/20 bg-fuchsia-500/5 p-8 shadow-2xl">
           <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
             <div>
               <h3 className="text-2xl font-bold text-white">Fairness Investigation</h3>
               <p className="mt-2 text-sm text-slate-300">
                 Review Saturday night distribution for a specific employee and compare it with the rest of the team.
               </p>
             </div>
             <div className="min-w-[260px]">
               <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                 Investigate Staff Member
               </label>
               <select
                 value={selectedFairnessStaffId}
                 onChange={(event) => setSelectedFairnessStaffId(event.target.value)}
                 className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
               >
                 {locationStaff.map((member) => (
                   <option key={member.id} value={member.id}>
                     {member.name}
                   </option>
                 ))}
               </select>
             </div>
           </div>

           <div className="grid gap-4 lg:grid-cols-4">
             <div className="rounded-[1.5rem] border border-slate-700 bg-slate-900 p-5 shadow-lg">
               <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Selected Staff</p>
               <p className="mt-3 text-2xl font-black text-white">{fairnessInvestigation.selected?.staff.name || '--'}</p>
             </div>
             <div className="rounded-[1.5rem] border border-fuchsia-500/20 bg-fuchsia-500/10 p-5 shadow-lg">
               <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-300">Saturday Nights</p>
               <p className="mt-3 text-3xl font-black text-white">{fairnessInvestigation.selected?.shiftCount ?? 0}</p>
             </div>
             <div className="rounded-[1.5rem] border border-slate-700 bg-slate-900 p-5 shadow-lg">
               <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Team Average</p>
               <p className="mt-3 text-3xl font-black text-white">{fairnessInvestigation.average.toFixed(1)}</p>
             </div>
             <div className="rounded-[1.5rem] border border-slate-700 bg-slate-900 p-5 shadow-lg">
               <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Highest Team Count</p>
               <p className="mt-3 text-3xl font-black text-white">{fairnessInvestigation.maxCount}</p>
             </div>
           </div>

           <div className="mt-6 rounded-[1.5rem] border border-slate-700 bg-slate-900 p-5">
             <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Investigation Summary</p>
             <p className="mt-3 text-base text-white">{fairnessInvestigation.summary}</p>
           </div>

           <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
             <div className="rounded-[1.5rem] border border-slate-700 bg-slate-900 p-5">
               <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Team Comparison</p>
               <div className="space-y-3">
                 {fairnessInvestigation.counts
                   .sort((left, right) => right.shiftCount - left.shiftCount || left.staff.name.localeCompare(right.staff.name))
                   .map((item) => (
                     <div key={item.staff.id} className="flex items-center gap-4">
                       <p className="w-32 truncate text-sm font-semibold text-white">{item.staff.name}</p>
                       <div className="h-3 flex-1 overflow-hidden rounded-full border border-slate-700 bg-slate-950">
                         <div
                           className={`h-full rounded-full ${
                             item.staff.id === fairnessInvestigation.selected?.staff.id ? 'bg-fuchsia-500' : 'bg-slate-600'
                           }`}
                           style={{
                             width: `${fairnessInvestigation.maxCount === 0 ? 0 : (item.shiftCount / fairnessInvestigation.maxCount) * 100}%`,
                           }}
                         />
                       </div>
                       <p className="w-8 text-right font-mono text-xs text-slate-400">{item.shiftCount}</p>
                     </div>
                   ))}
               </div>
             </div>

             <div className="rounded-[1.5rem] border border-slate-700 bg-slate-900 p-5">
               <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Actual Saturday Night Assignments</p>
               <div className="space-y-3">
                 {(fairnessInvestigation.selected?.shifts || []).map((shift) => {
                   const timing = getShiftTiming(shift, viewerTimeZone);
                   return (
                     <div key={shift.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                       <p className="text-sm font-semibold text-white">{shift.location?.name}</p>
                       <p className="mt-1 text-xs text-slate-400">{shift.requiredSkill?.name}</p>
                       <p className="mt-2 text-xs font-mono text-fuchsia-300">
                         {timing.locationDate} • {timing.locationTimeRange}
                       </p>
                     </div>
                   );
                 })}
                 {(fairnessInvestigation.selected?.shifts || []).length === 0 && (
                   <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center text-sm text-slate-500">
                     No Saturday night assignments found for this staff member in the selected location view.
                   </div>
                 )}
               </div>
             </div>
           </div>
         </div>
       )}
       
       {/* Live Approval Queue Panel */}
       {approvalQueue.length > 0 && (
         <div id="approval-queue" className="dashboard-focus-target bg-emerald-900/20 rounded-[2rem] border border-emerald-500/30 p-8 shadow-2xl">
            <h3 className="text-2xl font-bold mb-6 text-emerald-400 flex items-center gap-3">
              Action Required: Approval Queue
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full border border-emerald-500/30">{approvalQueue.length} Pending</span>
            </h3>
            <div className="space-y-4">
              {approvalQueue.map(req => {
                 const initShift = shifts.find(s=>s.id === req.initiatorShift?.id);
                 const targShift = shifts.find(s=>s.id === req.targetShift?.id);
                 return (
                   <div key={req.id} className="bg-slate-900 border border-emerald-500/20 p-5 rounded-2xl flex justify-between items-center group relative overflow-hidden shadow-lg transition-colors hover:border-emerald-500/50">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
                      <div className="pl-4">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{req.type} Authorization</p>
                         <p className="text-xl tracking-tight font-bold text-white mb-1">
                           {req.type==='DROP' ? `${req.initiatorUser?.name} offered a drop picked up by ${req.targetUser?.name}` 
                                             : `${req.initiatorUser?.name} requested to swap shifts with ${req.targetUser?.name}`}
                         </p>
                         <div className="mt-4 bg-slate-950 p-4 rounded-xl text-sm font-mono text-slate-300 border border-slate-800">
                            {req.type==='DROP' && initShift ? (
                              <span>Deployment: {initShift.date} ({initShift.startTime?.slice(0,5)}-{initShift.endTime?.slice(0,5)})</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <p><span className="text-slate-500">{req.initiatorUser?.name} works:</span> {targShift?.date} @ {targShift?.startTime?.slice(0,5)}</p>
                                <p><span className="text-slate-500">{req.targetUser?.name} works:</span> {initShift?.date} @ {initShift?.startTime?.slice(0,5)}</p>
                              </div>
                            )}
                         </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleManagerAction(req, false)}
                          disabled={actingSwapId === req.id}
                          className="px-6 py-3.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 font-bold transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actingSwapId === req.id ? 'Working...' : 'Reject Override'}
                        </button>
                        <button
                          onClick={() => handleManagerAction(req, true)}
                          disabled={actingSwapId === req.id}
                          className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 border border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actingSwapId === req.id ? 'Working...' : 'Authorize Execution'}
                        </button>
                      </div>
                   </div>
                 );
              })}
            </div>
         </div>
       )}

       {/* Manager Territory Core */}
       <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden p-8">
          <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">Your Assigned Territories</h3>
          <div className="flex gap-4">
            {locations.map((loc: any) => (
              <button 
                key={loc.id}
                onClick={() => setSelectedLoc(loc.id)}
                className={`px-5 py-2.5 rounded-xl font-bold transition-all border shadow-sm ${
                    selectedLoc === loc.id 
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
              >
                {loc.name}
              </button>
            ))}
          </div>
       </div>

       {selectedLoc && (
         <ScheduleCalendar
           shifts={selectedLocationShifts}
           viewerTimeZone={viewerTimeZone}
           title="Location Schedule Calendar"
           subtitle="Planner view for the territory you currently manage."
           emptyLabel="No shifts scheduled for this location."
           locationTimeZoneLabel={selectedLocation ? `${selectedLocation.name} • ${selectedLocation.timezone}` : undefined}
           layout="stacked"
         />
       )}

       {selectedLoc && (
         <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl p-8">
            <h3 className="text-2xl font-bold mb-6 flex items-center justify-between">
              <span>Location Staff Roster</span>
              <span className="text-xs bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 font-mono tracking-widest uppercase">Live View</span>
            </h3>
            
            {loading ? (
               <div className="text-center py-12 text-slate-500 italic">Querying location roster...</div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {staff.filter(u => u.role === 'STAFF').map((member) => (
                   <div key={member.id} className="bg-slate-900 border border-slate-700 p-6 rounded-2xl flex flex-col hover:border-slate-500 transition-colors shadow-lg group">
                     <p className="font-bold text-xl mb-1">{member.name}</p>
                     <p className="text-sm text-slate-400 mb-4">{member.email}</p>
                     
                     <div className="mt-auto space-y-3">
                       <div className="flex justify-between text-sm">
                          <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Hours Needed</span>
                          <span className="font-mono text-emerald-400 font-bold">{member.desiredHours}h</span>
                       </div>
                       <div>
                          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-2">Certifications</p>
                          <div className="flex flex-wrap gap-2">
                            {member.skills.map((s:any) => (
                               <span key={s.id} className="text-[10px] bg-slate-800 border border-slate-600 px-2 py-0.5 rounded text-slate-300">
                                 {s.name}
                               </span>
                            ))}
                          </div>
                       </div>
                     </div>
                   </div>
                 ))}
                 {staff.filter(s => s.role === 'STAFF').length === 0 && (
                   <div className="col-span-full py-8 text-center text-slate-500 italic border-2 border-dashed border-slate-700 rounded-2xl">
                     No personnel registered to this jurisdiction.
                   </div>
                 )}
               </div>
            )}
         </div>
       )}
    </div>
  );
}
