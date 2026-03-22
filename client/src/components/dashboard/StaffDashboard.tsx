"use client";
import React, { useEffect, useState } from 'react';
import { Shift, Staff } from '../../lib/mockData';
import { validateAssignment } from '../../lib/schedulingRules';
import { getShiftTiming } from '../../lib/calendarTime';

interface SwapRequest {
  id: string;
  type: string;
  status: string;
  initiatorShift?: Shift | null;
  targetShift?: Shift | null;
  initiatorUser?: any;
  targetUser?: any;
}

export default function StaffDashboard({ user }: { user: any }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerTimeZone, setViewerTimeZone] = useState('UTC');

  const [showSwapModal, setShowSwapModal] = useState<Shift | null>(null);
  const [swapTargetId, setSwapTargetId] = useState('');
  const [swapReason, setSwapReason] = useState('');

  const fetchLiveState = async () => {
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const [shRes, usrRes] = await Promise.all([
        fetch(`${API_URL}/shifts`),
        fetch(`${API_URL}/users`)
      ]);
      if (shRes.ok) setShifts(await shRes.json());
      if (usrRes.ok) setAllStaff(await usrRes.json());
    } catch(err) {}
    setLoading(false);
  };

  const refreshSwaps = async () => {
     try {
       const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
       const res = await fetch(`${API_URL}/swaps`);
       if (res.ok) setSwaps(await res.json());
     } catch (err) {}
  };

  useEffect(() => {
    setViewerTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);

  useEffect(() => {
    fetchLiveState();
    refreshSwaps();
  }, []);

  const handleDrop = async (shiftId: string) => {
    const reason = prompt('Reason for dropping shift (optional)?');
    if (reason === null) return;
    try {
       const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
       const res = await fetch(`${API_URL}/swaps`, {
         method: 'POST', headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ type: 'DROP', initiatorUserId: user.id, initiatorShiftId: shiftId, reason })
       });
       if (!res.ok) throw new Error((await res.json()).message || 'Database block executed');
       refreshSwaps();
    } catch (e:any) {
       alert(e.message);
    }
  };

  const submitSwap = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!showSwapModal || !swapTargetId) return;
     const targetShift = shifts.find(s => s.id === swapTargetId);
     if (!targetShift) return;

     const targetUser = allStaff.find(s => s.id === targetShift.assignedStaff?.id);
     if (!targetUser) return;

     const initiatorCanWorkTarget = validateAssignment(user, targetShift, shifts, allStaff);
     const targetCanWorkInitiator = validateAssignment(targetUser, showSwapModal, shifts, allStaff);

     if (!initiatorCanWorkTarget.valid) {
        alert(`You are not cleared for their shift: ${initiatorCanWorkTarget.reason}`);
        return;
     }
     if (!targetCanWorkInitiator.valid) {
        alert(`They are not cleared for your shift: ${targetCanWorkInitiator.reason}`);
        return;
     }

     try {
       const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
       const res = await fetch(`${API_URL}/swaps`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'SWAP', initiatorUserId: user.id, initiatorShiftId: showSwapModal.id,
            targetShiftId: targetShift.id, targetUserId: targetUser.id, reason: swapReason
          })
       });
       if (!res.ok) throw new Error((await res.json()).message);
       setShowSwapModal(null);
       refreshSwaps();
     } catch (e:any) {
       alert(e.message);
     }
  };

  const handleAction = async (id: string, action: string) => {
     try {
       const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
       await fetch(`${API_URL}/swaps/${id}/${action}`, {
         method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id })
       });
       refreshSwaps();
     } catch (err) {}
  };

  if (loading) return <div>Loading Profile Interface...</div>;

  const myShifts = shifts.filter(s => s.assignedStaff?.id === user.id);
  const swapOptions = shifts.filter(s => s.assignedStaff && s.assignedStaff.id !== user.id && new Date(`${s.date}T${s.startTime}`).getTime() > Date.now());

  const coverageDrops = swaps.filter(s => s.type === 'DROP' && s.status === 'PENDING_PEER' && s.initiatorUser?.id !== user.id);
  const incomingSwaps = swaps.filter(s => s.type === 'SWAP' && s.status === 'PENDING_PEER' && s.targetUser?.id === user.id);
  const myUpdates = swaps.filter(s => s.initiatorUser?.id === user.id && ['APPROVED', 'REJECTED', 'CANCELLED'].includes(s.status));

  return (
    <div className="space-y-8 animate-fade-in-up">
       <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
           {/* My Shifts */}
           <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl p-6">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">My Scheduled Shifts</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                 {myShifts.length === 0 && <p className="text-slate-500 italic py-5 text-center bg-slate-900 border border-slate-800 rounded-xl">No shifts assigned to your profile currently.</p>}
                 {myShifts.map(shift => {
                    const activeReq = swaps.find(s => s.initiatorShift?.id === shift.id && ['PENDING_PEER', 'PENDING_MANAGER'].includes(s.status));
                    const timing = getShiftTiming(shift, viewerTimeZone);
                    return (
                      <div key={shift.id} className="bg-slate-900 border border-slate-700 p-5 rounded-[1.5rem] flex justify-between items-center group shadow-md transition-all hover:border-slate-500">
                         <div>
                            <p className="font-mono text-emerald-400 text-sm mb-1 bg-emerald-500/10 inline-block px-2 rounded-md">{timing.locationDate}</p>
                            <p className="font-bold text-2xl tracking-tight mb-1">{timing.locationTimeRange}</p>
                            <p className="text-xs text-slate-400">{shift.location?.name} • {timing.locationTimeZone} • <span className="text-slate-300 font-bold">{shift.requiredSkill?.name}</span></p>
                            <p className="text-[11px] text-slate-500 mt-1">Your time: {timing.viewerDate} • {timing.viewerTimeRange}</p>
                         </div>
                         <div>
                            {activeReq ? (
                               <div className="bg-amber-500/10 text-amber-500 border border-amber-500/30 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-center shadow-inner">
                                 {activeReq.type === 'DROP' ? 'Drop Request' : 'Peer Swap'}<br/><span className="text-slate-300 font-normal mt-1 block">Pending Approval</span>
                               </div>
                            ) : (
                               <div className="flex flex-col gap-2">
                                  <button onClick={() => setShowSwapModal(shift)} className="text-[11px] block text-center uppercase tracking-widest bg-blue-600/20 text-blue-400 border border-blue-500/30 px-4 py-2.5 rounded-xl hover:bg-blue-600 hover:text-white font-bold transition-all shadow-sm">Request Swap</button>
                                  <button onClick={() => handleDrop(shift.id)} className="text-[11px] block text-center uppercase tracking-widest bg-slate-800 text-slate-300 border border-slate-600 px-4 py-2.5 rounded-xl hover:border-slate-500 hover:text-white transition-all shadow-sm">Drop Shift</button>
                               </div>
                            )}
                         </div>
                      </div>
                    );
                 })}
              </div>
           </div>

           {/* Inbox / Notifications Pane */}
           <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl p-6 flex flex-col">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">Notification Inbox</h3>
              <div className="space-y-4 flex-1 overflow-y-auto pr-3 custom-scrollbar">
                 {incomingSwaps.length === 0 && myUpdates.length === 0 && (
                    <div className="text-slate-500 italic py-10 text-center bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center">
                       <span className="text-3xl mb-3 opacity-50">📬</span>
                       All caught up. No messages remaining.
                    </div>
                 )}
                 
                 {incomingSwaps.map(req => {
                    const fromShift = shifts.find(s => s.id === req.initiatorShift?.id);
                    const toShift = shifts.find(s => s.id === req.targetShift?.id);
                    const fromTiming = fromShift ? getShiftTiming(fromShift, viewerTimeZone) : null;
                    const toTiming = toShift ? getShiftTiming(toShift, viewerTimeZone) : null;
                    return (
                        <div key={req.id} className="bg-blue-900/20 border border-blue-500/30 p-5 rounded-[1.5rem] shadow-sm transform transition-all hover:scale-[1.01]">
                           <div className="flex justify-between items-start mb-2">
                             <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">Swap Request</p>
                             <span className="text-[10px] text-slate-500 font-mono">Restricted</span>
                           </div>
                           <p className="text-base font-bold mb-3"><span className="text-blue-300">{req.initiatorUser?.name}</span> has requested to swap shifts with you!</p>
                           <div className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-slate-300 mb-5 border border-slate-800 flex flex-col gap-2">
                             <div className="flex justify-between"><span className="text-slate-500">Their Shift:</span> <span className="text-emerald-400">{fromTiming?.locationDate} @ {fromTiming?.locationTimeRange}</span></div>
                             <div className="flex justify-between"><span className="text-slate-500">Your Shift:</span> <span className="text-blue-400">{toTiming?.locationDate} @ {toTiming?.locationTimeRange}</span></div>
                           </div>
                           <div className="flex gap-3">
                             <button onClick={() => handleAction(req.id, 'decline')} className="flex-1 bg-transparent text-slate-400 border border-slate-600 py-2.5 rounded-xl hover:text-white hover:bg-slate-700 font-bold text-sm transition-all">Decline</button>
                             <button onClick={() => handleAction(req.id, 'accept')} className="flex-1 bg-emerald-600 text-white border border-emerald-500 py-2.5 rounded-xl hover:bg-emerald-500 font-bold text-sm shadow-lg transition-all hover:-translate-y-0.5">Accept Swap</button>
                           </div>
                        </div>
                    );
                 })}

                 {myUpdates.map(req => (
                     <div key={req.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl flex justify-between items-center group relative shadow-md">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">{req.type} Complete Workflow Event</p>
                          <p className={`text-sm font-bold bg-slate-800 px-3 py-1 rounded-lg border ${req.status === 'APPROVED' ? 'text-emerald-400 border-emerald-500/30' : req.status === 'REJECTED' ? 'text-red-400 border-red-500/30' : 'text-amber-500 border-amber-500/30'}`}>
                            Status: {req.status}
                          </p>
                        </div>
                     </div>
                 ))}
              </div>
           </div>
       </div>

       {/* Coverage Board */}
       <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full"></div>
          <h3 className="text-3xl font-bold mb-2 text-white relative z-10">Coverage Marketplace</h3>
          <p className="text-slate-400 text-base mb-8 relative z-10 max-w-2xl">Open dropped shifts available for immediate pickup. The constraint engine will statically auto-verify your compliance capabilities before establishing pickup authorization.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
             {coverageDrops.length === 0 && <div className="col-span-full border-2 border-dashed border-slate-700 rounded-[2rem] p-12 text-center text-slate-500 italic">No shifts currently open for remote coverage.</div>}
             {coverageDrops.map(req => {
                const shift = shifts.find(s => s.id === req.initiatorShift?.id);
                if (!shift) return null;
                const timing = getShiftTiming(shift, viewerTimeZone);
                return (
                  <div key={req.id} className="bg-slate-900 border border-slate-700 p-6 rounded-[1.5rem] flex flex-col justify-between hover:border-blue-500/50 transition-colors shadow-xl group">
                     <div>
                        <div className="flex justify-between items-start mb-4">
                           <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest shadow-sm">{req.initiatorUser?.name} Dropped</span>
                           <span className="text-slate-500 text-xs font-mono bg-slate-800 px-2 py-1 rounded-md border border-slate-700">{shift.location?.name}</span>
                        </div>
                        <p className="font-extrabold text-2xl tracking-tighter mb-1">{timing.locationTimeRange}</p>
                        <p className="text-sm text-emerald-400 font-mono">{timing.locationDate}</p>
                        <p className="text-xs text-slate-500 mb-6">{timing.locationTimeZone} • Your time: {timing.viewerTimeRange}</p>
                     </div>
                     <button onClick={() => {
                        const check = validateAssignment(user, shift, shifts, allStaff);
                        if (!check.valid) return alert(`System Block: ${check.reason}`);
                        handleAction(req.id, 'accept');
                     }} className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600 hover:text-white font-bold py-3.5 rounded-xl transition-all shadow-sm group-hover:shadow-[0_0_15px_rgba(37,99,235,0.2)]">Pick Up Coverage</button>
                  </div>
                )
             })}
          </div>
       </div>

       {/* Peer Swap Action Modal Form */}
       {showSwapModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
           <div className="bg-slate-900 rounded-[2rem] border border-slate-700 w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                 <h3 className="text-xl font-bold">Initiate Peer Swap Agreement</h3>
                 <button onClick={() => setShowSwapModal(null)} className="h-10 w-10 bg-slate-800 flex items-center justify-center rounded-full hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors">✕</button>
              </div>
              <form onSubmit={submitSwap} className="p-8 space-y-6">
                 <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-inner">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Shift being surrendered</p>
                    <p className="text-emerald-400 font-mono text-base">{showSwapModal.date} • {showSwapModal.startTime.slice(0,5)} to {showSwapModal.endTime.slice(0,5)}</p>
                 </div>
                 
                 <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Select Compatible Target Shift</label>
                    <select required value={swapTargetId} onChange={e=>setSwapTargetId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-blue-500 shadow-inner">
                      <option value="">-- Dropdown loads future eligible shifts --</option>
                      {swapOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.date} {s.startTime.slice(0,5)} ({s.assignedStaff?.name} @ {s.location?.name})</option>
                      ))}
                    </select>
                 </div>
                 
                 <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Optional Memo Reference</label>
                    <input type="text" placeholder="Hey, could you help me cover this?" value={swapReason} onChange={e=>setSwapReason(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-blue-500 shadow-inner" />
                 </div>

                 <div className="pt-2">
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-4 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg border border-blue-500 text-sm tracking-wide">Dispatch Swap Request Envelope</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
