"use client";
import React, { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import { Availability, Shift, Staff } from '../../lib/mockData';
import { validateAssignment } from '../../lib/schedulingRules';
import { getShiftTiming } from '../../lib/calendarTime';
import {
  actOnSwapRequest,
  createDropRequest,
  createSwapRequest,
  fetchStaffDashboardState,
  fetchSwapRequests,
  StaffSwapRequest,
} from '../../lib/staffDashboardApi';
import { useRealtime } from '../../lib/useRealtime';
import { useViewerTimeZone } from '../../hooks/useViewerTimeZone';
import { useStaffProfileForms } from '../../hooks/useStaffProfileForms';
import ModalShell from '../ui/ModalShell';
import ReasonModal from '../ui/ReasonModal';
import StaffAvailabilityCalendar from '../calendar/StaffAvailabilityCalendar';
import { toast } from 'sonner';

export default function StaffDashboard({ user }: { user: any }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [swaps, setSwaps] = useState<StaffSwapRequest[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [profile, setProfile] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const viewerTimeZone = useViewerTimeZone();

  const [showSwapModal, setShowSwapModal] = useState<Shift | null>(null);
  const [swapTargetId, setSwapTargetId] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [dropShift, setDropShift] = useState<Shift | null>(null);
  const [dropReason, setDropReason] = useState('');
  const [submittingSwap, setSubmittingSwap] = useState(false);
  const [submittingDrop, setSubmittingDrop] = useState(false);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);

  const {
    desiredHours,
    setDesiredHours,
    savingDesiredHours,
    savingAvailability,
    availabilityType,
    setAvailabilityType,
    availabilityDayOfWeek,
    setAvailabilityDayOfWeek,
    availabilityDate,
    availabilityExceptionDate,
    availabilityStartTime,
    setAvailabilityStartTime,
    availabilityEndTime,
    setAvailabilityEndTime,
    availabilityLocationId,
    setAvailabilityLocationId,
    editingAvailabilityId,
    deletingAvailabilityId,
    availabilityItems,
    certifiedLocations,
    getAvailabilityLocationLabel,
    saveDesiredHours,
    submitAvailability,
    startEditingAvailability,
    resetAvailabilityForm,
    handleDeleteAvailability,
    setExceptionDate,
    syncFormFromProfile,
  } = useStaffProfileForms({
    userId: user.id,
    userDesiredHours: user.desiredHours,
    profile,
    viewerTimeZone,
    refreshProfile: async () => {
      await fetchLiveState();
    },
  });

  useRealtime(() => {
    fetchLiveState();
    refreshSwaps();
  });

  const fetchLiveState = async () => {
    setLoading(true);
    try {
      const state = await fetchStaffDashboardState(user.id);
      setShifts(state.shifts);
      setAllStaff(state.staff);
      if (state.profile) {
        setProfile(state.profile);
        syncFormFromProfile(state.profile);
      } else {
        setProfile(null);
      }
    } catch(err) {
      setShifts([]);
      setAllStaff([]);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshSwaps = async () => {
     try {
       setSwaps(await fetchSwapRequests());
     } catch (err) {}
  };

  useEffect(() => {
    fetchLiveState();
    refreshSwaps();
  }, [user.id]);

  const handleDrop = async (shiftId: string, reason: string) => {
    setSubmittingDrop(true);
    try {
       await createDropRequest(user.id, shiftId, reason);
       await refreshSwaps();
       setDropShift(null);
       setDropReason('');
       toast.success('Drop request submitted.');
    } catch (e:any) {
       toast.error(e.message || 'Unable to submit drop request.');
    } finally {
       setSubmittingDrop(false);
    }
  };

  const submitSwap = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!showSwapModal || !swapTargetId) return;
     const targetShift = shifts.find(s => s.id === swapTargetId);
     if (!targetShift) return;

     const targetUser = allStaff.find(s => s.id === targetShift.assignedStaff?.id);
     if (!targetUser) return;

     const initiatorCanWorkTarget = validateAssignment(currentStaff, targetShift, shifts, allStaff);
     const targetCanWorkInitiator = validateAssignment(targetUser, showSwapModal, shifts, allStaff);

     if (!initiatorCanWorkTarget.valid) {
        toast.error(`You are not cleared for their shift: ${initiatorCanWorkTarget.reason}`);
        return;
     }
     if (!targetCanWorkInitiator.valid) {
        toast.error(`They are not cleared for your shift: ${targetCanWorkInitiator.reason}`);
        return;
     }

     setSubmittingSwap(true);
     try {
       await createSwapRequest({
         type: 'SWAP',
         initiatorUserId: user.id,
         initiatorShiftId: showSwapModal.id,
         targetShiftId: targetShift.id,
         targetUserId: targetUser.id,
         reason: swapReason,
       });
       setShowSwapModal(null);
       setSwapTargetId('');
       setSwapReason('');
       await refreshSwaps();
       toast.success('Swap request sent.');
     } catch (e:any) {
       toast.error(e.message || 'Unable to create swap request.');
     } finally {
       setSubmittingSwap(false);
     }
  };

  const handleAction = async (id: string, action: string) => {
     setActingRequestId(id);
     try {
       await actOnSwapRequest(id, action, user.id);
       await refreshSwaps();
       toast.success(
         action === 'accept'
           ? 'Request accepted.'
           : action === 'decline'
             ? 'Request declined.'
             : action === 'cancel'
               ? 'Request cancelled.'
               : 'Request updated.',
       );
     } catch (err: any) {
       toast.error(err.message || 'Unable to process request.');
     } finally {
       setActingRequestId(null);
     }
  };

  const currentStaff = profile || user;
  const myShifts = shifts.filter(s => s.assignedStaff?.id === user.id);
  const activeSwapShiftIds = new Set(
    swaps
      .filter((request) => ['PENDING_PEER', 'PENDING_MANAGER'].includes(request.status))
      .flatMap((request) => [request.initiatorShift?.id, request.targetShift?.id].filter(Boolean) as string[]),
  );
  const swapOptions = useMemo(() => {
    return shifts
      .filter((shift) => {
        if (!shift.published) return false;
        if (!shift.assignedStaff || shift.assignedStaff.id === user.id) return false;
        if (getShiftTiming(shift, viewerTimeZone).startUtc.getTime() <= Date.now()) return false;
        if (activeSwapShiftIds.has(shift.id)) return false;
        return true;
      })
      .filter((shift) => {
        const targetUser = allStaff.find((staffMember) => staffMember.id === shift.assignedStaff?.id);
        if (!targetUser || !showSwapModal) return false;

        const initiatorCanWorkTarget = validateAssignment(currentStaff, shift, shifts, allStaff);
        const targetCanWorkInitiator = validateAssignment(targetUser, showSwapModal, shifts, allStaff);

        return initiatorCanWorkTarget.valid && targetCanWorkInitiator.valid;
      });
  }, [activeSwapShiftIds, allStaff, currentStaff, shifts, showSwapModal, user.id, viewerTimeZone]);

  const coverageDrops = swaps.filter(s => s.type === 'DROP' && s.status === 'PENDING_PEER' && s.initiatorUser?.id !== user.id);
  const incomingSwaps = swaps.filter(s => s.type === 'SWAP' && s.status === 'PENDING_PEER' && s.targetUser?.id === user.id);
  const pendingManagerRequests = swaps.filter(
    (request) =>
      request.status === 'PENDING_MANAGER' &&
      (request.initiatorUser?.id === user.id || request.targetUser?.id === user.id),
  );
  const myUpdates = swaps.filter(s => s.initiatorUser?.id === user.id && ['APPROVED', 'REJECTED', 'CANCELLED'].includes(s.status));
  const weekdayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (loading) return <div>Loading Profile Interface...</div>;

  return (
    <div className="space-y-8 animate-fade-in-up">
       <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl p-6">
             <h3 className="text-2xl font-bold mb-6">Work Preferences</h3>
             <form onSubmit={saveDesiredHours} className="space-y-4">
               <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                 <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Desired Hours</p>
                 <p className="mt-2 text-sm text-slate-300">Set the weekly hours you want managers to target when distributing shifts.</p>
                 <div className="mt-4 flex items-center gap-3">
                   <input type="number" min={0} value={desiredHours} onChange={(e) => setDesiredHours(e.target.value)} className="w-32 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none" />
                   <button type="submit" disabled={savingDesiredHours} className="rounded-xl border border-emerald-500 bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50">
                     {savingDesiredHours ? 'Saving...' : 'Save Hours'}
                   </button>
                 </div>
               </div>
             </form>
             <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-4">
               <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Current Profile</p>
               <p className="mt-2 text-sm text-white">{profile?.name || user.name}</p>
               <p className="mt-1 text-xs text-slate-400">Skills: {profile?.skills?.map((skill) => skill.name).join(', ') || 'None assigned'}</p>
               <p className="mt-1 text-xs text-slate-400">Certified locations: {profile?.locations?.map((location) => location.name).join(', ') || 'None assigned'}</p>
             </div>
          </div>

          <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl p-6">
             <h3 className="text-2xl font-bold mb-6">Availability</h3>
             <form onSubmit={submitAvailability} className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Type</label>
                   <select value={availabilityType} onChange={(e) => setAvailabilityType(e.target.value as 'RECURRING' | 'EXCEPTION')} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none">
                     <option value="RECURRING">Recurring Weekly</option>
                     <option value="EXCEPTION">One-off Exception</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Location</label>
                   <select
                     value={availabilityLocationId}
                     onChange={(e) => setAvailabilityLocationId(e.target.value)}
                     className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                   >
                     {certifiedLocations.length === 0 && <option value="">No certified locations</option>}
                     {certifiedLocations.map((location) => (
                       <option key={location.id} value={location.id}>
                         {location.name} ({location.timezone})
                       </option>
                     ))}
                   </select>
                   <p className="mt-2 text-xs text-slate-500">
                     Availability is interpreted in the selected location&apos;s timezone.
                   </p>
                 </div>
               </div>

               {availabilityType === 'RECURRING' ? (
                 <div>
                   <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Day of Week</label>
                   <select value={availabilityDayOfWeek} onChange={(e) => setAvailabilityDayOfWeek(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none">
                     {weekdayLabels.map((label, index) => <option key={label} value={index}>{label}</option>)}
                   </select>
                 </div>
               ) : (
                 <div>
                   <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Exception Date</label>
                   <DatePicker
                     selected={availabilityExceptionDate}
                     onChange={setExceptionDate}
                     minDate={new Date()}
                     dateFormat="MMMM d, yyyy"
                     placeholderText="Choose an exception date"
                     className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                     calendarClassName="shift-datepicker-calendar"
                     popperClassName="shift-datepicker-popper"
                   />
                 </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Start Time</label>
                   <input type="time" required value={availabilityStartTime} onChange={(e) => setAvailabilityStartTime(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none" />
                 </div>
                 <div>
                   <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">End Time</label>
                   <input type="time" required value={availabilityEndTime} onChange={(e) => setAvailabilityEndTime(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none" />
                 </div>
               </div>

               <div className="flex flex-wrap gap-3">
                 <button type="submit" disabled={savingAvailability || !availabilityLocationId || (availabilityType === 'EXCEPTION' && !availabilityDate)} className="rounded-xl border border-blue-500 bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-50">
                   {savingAvailability ? 'Saving...' : editingAvailabilityId ? 'Save Availability' : 'Add Availability'}
                 </button>
                 {editingAvailabilityId && (
                   <button
                     type="button"
                     onClick={resetAvailabilityForm}
                     className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-300 transition hover:border-slate-600 hover:text-white"
                   >
                     Cancel Edit
                   </button>
                 )}
               </div>
             </form>

             <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-4">
               <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Saved Windows</p>
               <div className="mt-4 space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                 {availabilityItems.length === 0 && <p className="text-sm text-slate-500 italic">No availability windows saved yet.</p>}
                 {availabilityItems.map((availability: Availability) => (
                   <div key={availability.id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                     <div className="flex items-start justify-between gap-3">
                       <div>
                         <p className="text-sm font-semibold text-white">
                           {availability.type === 'RECURRING'
                             ? `${weekdayLabels[availability.dayOfWeek || 0]}`
                             : availability.date}
                         </p>
                         <p className="mt-1 text-xs text-slate-400">{availability.startTime.slice(0, 5)} - {availability.endTime.slice(0, 5)} • {availability.location?.name || getAvailabilityLocationLabel(availability)}</p>
                       </div>
                       <div className="flex gap-2">
                         <button
                           type="button"
                           onClick={() => startEditingAvailability(availability)}
                           className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-blue-300 transition hover:border-blue-400 hover:text-white"
                         >
                           Edit
                         </button>
                         <button
                           type="button"
                           disabled={deletingAvailabilityId === availability.id}
                           onClick={() => handleDeleteAvailability(availability.id)}
                           className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-rose-300 transition hover:border-rose-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                         >
                           {deletingAvailabilityId === availability.id ? 'Deleting...' : 'Delete'}
                         </button>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          </div>
       </div>

       <StaffAvailabilityCalendar
         shifts={myShifts}
         availabilities={availabilityItems}
         locations={certifiedLocations}
         viewerTimeZone={viewerTimeZone}
       />

       <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
           {/* My Shifts */}
           <div id="my-scheduled-shifts" className="dashboard-focus-target bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl p-6">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">My Scheduled Shifts</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar">
                 {myShifts.length === 0 && <p className="text-slate-500 italic py-5 text-center bg-slate-900 border border-slate-800 rounded-xl">No shifts assigned to your profile currently.</p>}
                 {myShifts.map(shift => {
                    const activeReq = swaps.find(
                      (s) =>
                        ['PENDING_PEER', 'PENDING_MANAGER'].includes(s.status) &&
                        (
                          (s.initiatorShift?.id === shift.id && s.initiatorUser?.id === user.id) ||
                          (s.targetShift?.id === shift.id && s.targetUser?.id === user.id)
                        ),
                    );
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
                               <div className="flex flex-col gap-2">
                                 <div className="bg-amber-500/10 text-amber-500 border border-amber-500/30 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-center shadow-inner">
                                   {activeReq.type === 'DROP' ? 'Drop Request' : 'Peer Swap'}<br/><span className="text-slate-300 font-normal mt-1 block">Pending Approval</span>
                                 </div>
                                 <p className="max-w-[220px] text-center text-[11px] text-slate-400">
                                   Original assignments stay in place until a manager approves the change.
                                 </p>
                                 <button disabled={actingRequestId === activeReq.id} onClick={() => handleAction(activeReq.id, 'cancel')} className="text-[11px] block text-center uppercase tracking-widest bg-rose-500/10 text-rose-300 border border-rose-500/30 px-4 py-2.5 rounded-xl hover:bg-rose-500/20 font-bold transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-50">{actingRequestId === activeReq.id ? 'Working...' : 'Cancel Request'}</button>
                               </div>
                            ) : (
                               <div className="flex flex-col gap-2">
                                  <button onClick={() => setShowSwapModal(shift)} className="text-[11px] block text-center uppercase tracking-widest bg-blue-600/20 text-blue-400 border border-blue-500/30 px-4 py-2.5 rounded-xl hover:bg-blue-600 hover:text-white font-bold transition-all shadow-sm">Request Swap</button>
                                  <button onClick={() => { setDropShift(shift); setDropReason(''); }} className="text-[11px] block text-center uppercase tracking-widest bg-slate-800 text-slate-300 border border-slate-600 px-4 py-2.5 rounded-xl hover:border-slate-500 hover:text-white transition-all shadow-sm">Drop Shift</button>
                               </div>
                            )}
                         </div>
                      </div>
                    );
                 })}
              </div>
           </div>

           {/* Inbox / Notifications Pane */}
           <div id="notification-inbox" className="dashboard-focus-target bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl p-6 flex flex-col">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">Notification Inbox</h3>
              <div className="space-y-4 flex-1 overflow-y-auto pr-3 custom-scrollbar">
                 {incomingSwaps.length === 0 && pendingManagerRequests.length === 0 && myUpdates.length === 0 && (
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
                             <button disabled={actingRequestId === req.id} onClick={() => handleAction(req.id, 'decline')} className="flex-1 bg-transparent text-slate-400 border border-slate-600 py-2.5 rounded-xl hover:text-white hover:bg-slate-700 font-bold text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50">{actingRequestId === req.id ? 'Working...' : 'Decline'}</button>
                             <button disabled={actingRequestId === req.id} onClick={() => handleAction(req.id, 'accept')} className="flex-1 bg-emerald-600 text-white border border-emerald-500 py-2.5 rounded-xl hover:bg-emerald-500 font-bold text-sm shadow-lg transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">{actingRequestId === req.id ? 'Working...' : 'Accept Swap'}</button>
                           </div>
                        </div>
                    );
                 })}

                 {pendingManagerRequests.map(req => {
                   const initShift = shifts.find((s) => s.id === req.initiatorShift?.id);
                   const targShift = shifts.find((s) => s.id === req.targetShift?.id);
                   const isInitiator = req.initiatorUser?.id === user.id;
                   return (
                     <div key={`pending-manager-${req.id}`} className="bg-amber-900/20 border border-amber-500/30 p-5 rounded-[1.5rem] shadow-sm">
                       <div className="flex justify-between items-start mb-2">
                         <p className="text-[10px] text-amber-300 font-bold uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                           Awaiting Manager Approval
                         </p>
                         <span className="text-[10px] text-slate-500 font-mono">
                           {req.type}
                         </span>
                       </div>
                       <p className="text-base font-bold mb-3 text-white">
                         {req.type === 'DROP'
                           ? 'Coverage has been claimed and is waiting for manager approval.'
                           : 'Both staff members agreed to the swap. A manager must approve it before anything changes.'}
                       </p>
                       <div className="bg-slate-950 p-4 rounded-xl text-xs font-mono text-slate-300 mb-5 border border-slate-800 flex flex-col gap-2">
                         <div className="flex justify-between">
                           <span className="text-slate-500">Your role:</span>
                           <span className="text-amber-300">{isInitiator ? 'Requester' : 'Accepting staff'}</span>
                         </div>
                         {initShift && (
                           <div className="flex justify-between">
                             <span className="text-slate-500">Initiator shift:</span>
                             <span>{getShiftTiming(initShift, viewerTimeZone).locationDate} @ {getShiftTiming(initShift, viewerTimeZone).locationTimeRange}</span>
                           </div>
                         )}
                         {targShift && (
                           <div className="flex justify-between">
                             <span className="text-slate-500">Target shift:</span>
                             <span>{getShiftTiming(targShift, viewerTimeZone).locationDate} @ {getShiftTiming(targShift, viewerTimeZone).locationTimeRange}</span>
                           </div>
                         )}
                       </div>
                       <p className="mb-4 text-sm text-slate-300">
                         Original assignments stay in place until the manager approves. Either participating staff member can still cancel before that approval happens.
                       </p>
                       <button
                         disabled={actingRequestId === req.id}
                         onClick={() => handleAction(req.id, 'cancel')}
                         className="w-full rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-300 transition hover:border-rose-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                       >
                         {actingRequestId === req.id ? 'Working...' : isInitiator ? 'Cancel Request' : 'Withdraw Acceptance'}
                       </button>
                     </div>
                   );
                 })}

                 {myUpdates.map(req => {
                   const updateTone =
                     req.status === 'APPROVED'
                       ? 'text-emerald-400 border-emerald-500/30'
                       : req.status === 'REJECTED'
                         ? 'text-red-400 border-red-500/30'
                         : 'text-amber-500 border-amber-500/30';
                   const updateMessage =
                     req.status === 'CANCELLED'
                       ? 'Cancelled before manager approval. Original shift assignments remain unchanged.'
                       : req.status === 'REJECTED'
                         ? 'Rejected during workflow review. Original shift assignments remain unchanged.'
                         : 'Approved and applied. Your schedule has been updated.';

                   return (
                     <div key={req.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl group relative shadow-md">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">{req.type} Complete Workflow Event</p>
                            <p className={`inline-flex text-sm font-bold bg-slate-800 px-3 py-1 rounded-lg border ${updateTone}`}>
                              Status: {req.status}
                            </p>
                            <p className="mt-3 max-w-xl text-sm text-slate-300">{updateMessage}</p>
                          </div>
                        </div>
                     </div>
                   );
                 })}
              </div>
           </div>
       </div>

       {/* Coverage Board */}
       <div id="coverage-marketplace" className="dashboard-focus-target bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl p-8 relative overflow-hidden">
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
                        const check = validateAssignment(currentStaff, shift, shifts, allStaff);
                        if (!check.valid) return toast.error(`System Block: ${check.reason}`);
                        handleAction(req.id, 'accept');
                     }} disabled={actingRequestId === req.id} className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600 hover:text-white font-bold py-3.5 rounded-xl transition-all shadow-sm group-hover:shadow-[0_0_15px_rgba(37,99,235,0.2)] disabled:cursor-not-allowed disabled:opacity-50">{actingRequestId === req.id ? 'Working...' : 'Pick Up Coverage'}</button>
                  </div>
                )
             })}
          </div>
       </div>

       {/* Peer Swap Action Modal Form */}
      {showSwapModal && (
        <ModalShell title="Initiate Peer Swap Agreement" onClose={() => setShowSwapModal(null)} maxWidthClass="max-w-lg">
              <form onSubmit={submitSwap} className="space-y-6">
                 <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-inner">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Shift being surrendered</p>
                    <p className="text-emerald-400 font-mono text-base">{showSwapModal.date} • {showSwapModal.startTime.slice(0,5)} to {showSwapModal.endTime.slice(0,5)}</p>
                    <p className="mt-2 text-xs text-slate-400">{showSwapModal.skipManagerApproval ? 'This shift is configured to skip manager approval once the peer accepts.' : 'This shift still requires manager approval after peer acceptance.'}</p>
                 </div>
                 
                 <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Select Compatible Target Shift</label>
                    <select required value={swapTargetId} onChange={e=>setSwapTargetId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-blue-500 shadow-inner">
                      <option value="">-- Compatible published shifts only --</option>
                      {swapOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.date} {s.startTime.slice(0,5)} ({s.assignedStaff?.name} @ {s.location?.name})</option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-slate-500">
                      Only shifts that pass both sides of the swap check are listed here.
                    </p>
                    {swapOptions.length === 0 && (
                      <div className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-3 text-xs text-slate-400">
                        No compatible published shifts are available for a peer swap right now.
                      </div>
                    )}
                 </div>
                 
                 <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Optional Memo Reference</label>
                    <input type="text" placeholder="Hey, could you help me cover this?" value={swapReason} onChange={e=>setSwapReason(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-blue-500 shadow-inner" />
                 </div>

                 <div className="pt-2">
                    <button type="submit" disabled={submittingSwap} className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-4 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg border border-blue-500 text-sm tracking-wide disabled:cursor-not-allowed disabled:opacity-50">{submittingSwap ? 'Submitting...' : 'Dispatch Swap Request Envelope'}</button>
                 </div>
              </form>
        </ModalShell>
      )}

      {dropShift && (
        <ReasonModal
          title="Drop Shift"
          subtitle="Add an optional note for the manager and pickup staff."
          label="Reason"
          placeholder="Explain why you need coverage for this shift."
          submitLabel="Submit Drop Request"
          initialValue={dropReason}
          loading={submittingDrop}
          onClose={() => {
            if (submittingDrop) return;
            setDropShift(null);
            setDropReason('');
          }}
          onSubmit={(value) => handleDrop(dropShift.id, value)}
        />
      )}
    </div>
  );
}
