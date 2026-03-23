"use client";
import React, { useEffect, useState } from 'react';
import { Shift } from '../../lib/mockData';
import ScheduleCalendar from '../calendar/ScheduleCalendar';
import { toast } from 'sonner';
import { getShiftTiming } from '../../lib/calendarTime';
import { groupShiftCoverage } from '../../lib/shiftCoverage';

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
  const [locations, setLocations] = useState(user.locations || []);
  const [selectedLoc, setSelectedLoc] = useState<string | null>(locations.length ? locations[0].id : null);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [viewerTimeZone, setViewerTimeZone] = useState('UTC');
  const [actingSwapId, setActingSwapId] = useState<string | null>(null);
  const [fairnessScore, setFairnessScore] = useState<number | null>(null);

  useEffect(() => {
    setViewerTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);

  useEffect(() => {
    if (!selectedLoc) return;
    const fetchStaff = async () => {
      setLoading(true);
      try {
        const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
        const res = await fetch(`${API_URL}/users/location/${selectedLoc}`);
        if(res.ok) setStaff(await res.json());
      } catch (err) {}
      setLoading(false);
    };
    fetchStaff();
  }, [selectedLoc]);

  const loadApprovals = async () => {
     try {
       const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
       const [shRes, swRes] = await Promise.all([
          fetch(`${API_URL}/shifts`),
          fetch(`${API_URL}/swaps`)
       ]);
       if (shRes.ok) setShifts(await shRes.json());
       if (swRes.ok) setSwaps(await swRes.json());
     } catch(err) {}
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  useEffect(() => {
    if (!selectedLoc) return;
    const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    fetch(`${API_URL}/analytics/fairness?locationId=${selectedLoc}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setFairnessScore(data?.overallScore ?? null))
      .catch(() => setFairnessScore(null));
  }, [selectedLoc]);

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
       await loadApprovals();
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

  return (
    <div className="space-y-8 animate-fade-in-up">
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
       
       {/* Live Approval Queue Panel */}
       {approvalQueue.length > 0 && (
         <div className="bg-emerald-900/20 rounded-[2rem] border border-emerald-500/30 p-8 shadow-2xl">
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
