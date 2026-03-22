"use client";

import React, { useState, useEffect } from 'react';
import { Location, Skill, Shift, Staff } from '../../../lib/mockData';
import { validateAssignment, ValidationResult } from '../../../lib/schedulingRules';
import { FairnessAnalytics } from '../../../lib/fairnessMetrics';
import { useRealtime } from '../../../lib/useRealtime';
import { fetchCalendarShifts, previewShiftTiming } from '../../../lib/calendarApi';
import { buildShiftUtcRange, getShiftTiming, isShiftActive } from '../../../lib/calendarTime';

export default function SchedulingPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [assignModalShift, setAssignModalShift] = useState<Shift | null>(null);

  const [newShiftDate, setNewShiftDate] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('');
  const [newShiftEnd, setNewShiftEnd] = useState('');
  const [newShiftSkill, setNewShiftSkill] = useState('');
  const [viewerTimeZone, setViewerTimeZone] = useState('UTC');
  const [shiftPreview, setShiftPreview] = useState<null | {
    startUtc: string;
    endUtc: string;
    isOvernight: boolean;
    durationHours: number;
    locationDate: string;
    locationTimeRange: string;
    locationTimeZone: string;
    viewerDate: string;
    viewerTimeRange: string;
    viewerTimeZone: string;
  }>(null);

  const [validationData, setValidationData] = useState<ValidationResult | null>(null);
  const [fairnessData, setFairnessData] = useState<FairnessAnalytics | null>(null);
  
  // Phase 7: Real-Time Sync Hook mapping to local re-renders
  const { isConnected, lastSync } = useRealtime(() => {
     // Re-triggering data arrays logically to simulate push mutations and progress clocks.
     fetchShifts();
     fetchFairness();
  });

  useEffect(() => {
    setViewerTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);

  useEffect(() => {
    const initData = async () => {
      try {
        const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
        const [locRes, usersRes] = await Promise.all([
          fetch(`${API_URL}/locations`),
          fetch(`${API_URL}/users`)
        ]);
        const lData = await locRes.json();
        const uData = await usersRes.json();
        
        setLocations(lData);
        if (lData.length > 0) setSelectedLocation(lData[0].id);

        const allStaff = uData.filter((u: any) => u.role === 'STAFF');
        setStaffList(allStaff);

        const uniqueSkills = new Map();
        allStaff.forEach((s: any) => {
           s.skills?.forEach((sk: any) => uniqueSkills.set(sk.id, sk));
        });
        const skillsArr = Array.from(uniqueSkills.values()) as Skill[];
        setSkills(skillsArr);
        if (skillsArr.length > 0) setNewShiftSkill(skillsArr[0].id);
      } catch (err) {
        console.error(err);
      }
    };
    initData();
  }, []);

  const fetchShifts = async () => {
    try {
      const calendarShifts = await fetchCalendarShifts({ viewerTimeZone });
      setShifts(calendarShifts);
    } catch(err) {
      try {
        const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
        const res = await fetch(`${API_URL}/shifts`);
        if (res.ok) {
          const rawShifts = (await res.json()) as Shift[];
          setShifts(
            rawShifts.map((shift) => {
              const derived = buildShiftUtcRange(
                shift.date,
                shift.startTime,
                shift.endTime,
                shift.location?.timezone || 'UTC',
              );
              return {
                ...shift,
                startUtc: derived.startUtc.toISOString(),
                endUtc: derived.endUtc.toISOString(),
                isOvernight: derived.isOvernight,
              };
            }),
          );
        }
      } catch (fallbackError) {
        console.error(fallbackError);
      }
    }
  };

  const fetchFairness = async () => {
    if (!selectedLocation) return;
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/analytics/fairness?locationId=${selectedLocation}`);
      if (res.ok) setFairnessData(await res.json());
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchShifts();
    fetchFairness();
  }, [selectedLocation, viewerTimeZone]);

  useEffect(() => {
    async function loadPreview() {
      const location = locations.find((item) => item.id === selectedLocation);
      if (!location || !newShiftDate || !newShiftStart || !newShiftEnd) {
        setShiftPreview(null);
        return;
      }

      try {
        const preview = await previewShiftTiming({
          locationId: selectedLocation,
          date: newShiftDate,
          startTime: `${newShiftStart}:00`,
          endTime: `${newShiftEnd}:00`,
          viewerTimeZone,
        });
        setShiftPreview(preview);
      } catch {
        const fallback = buildShiftUtcRange(
          newShiftDate,
          `${newShiftStart}:00`,
          `${newShiftEnd}:00`,
          location.timezone,
        );
        const fallbackShift = {
          id: 'preview',
          location,
          date: newShiftDate,
          startTime: `${newShiftStart}:00`,
          endTime: `${newShiftEnd}:00`,
          startUtc: fallback.startUtc.toISOString(),
          endUtc: fallback.endUtc.toISOString(),
          isOvernight: fallback.isOvernight,
          requiredSkill: skills.find((skill) => skill.id === newShiftSkill) || null,
          assignedStaff: null,
          published: false,
        } as Shift;
        const timing = getShiftTiming(fallbackShift, viewerTimeZone);
        setShiftPreview({
          startUtc: timing.startUtc.toISOString(),
          endUtc: timing.endUtc.toISOString(),
          isOvernight: timing.isOvernight,
          durationHours: timing.durationHours,
          locationDate: timing.locationDate,
          locationTimeRange: timing.locationTimeRange,
          locationTimeZone: timing.locationTimeZone,
          viewerDate: timing.viewerDate,
          viewerTimeRange: timing.viewerTimeRange,
          viewerTimeZone: timing.viewerTimeZone,
        });
      }
    }

    loadPreview();
  }, [locations, newShiftDate, newShiftEnd, newShiftSkill, newShiftStart, selectedLocation, skills, viewerTimeZone]);

  const locShifts = shifts.filter(s => s.location?.id === selectedLocation);

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation,
          date: newShiftDate,
          startTime: newShiftStart + ':00',
          endTime: newShiftEnd + ':00',
          requiredSkillId: newShiftSkill
        })
      });
      if (res.ok) {
         await fetchShifts();
         await fetchFairness();
         setShowShiftModal(false);
      } else {
         alert('Failed to construct shift slot over database network');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const attemptAssignment = async (targetStaff: Staff) => {
    if (!assignModalShift) return;
    
    const result = validateAssignment(targetStaff, assignModalShift, shifts, staffList);
    if (!result.valid) {
      setValidationData(result);
      return;
    }

    let overrideReason = null;
    if (result.requiresOverride) {
       overrideReason = prompt('🚨 ' + result.warnings?.join(' | ') + '\n\nManager Override Authentication Required. Please specify execution reasoning to continue deployment:');
       if (!overrideReason) return; // Manager cancelled execution sequence
    }

    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/shifts/${assignModalShift.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetStaff.id, overrideReason }) // Mock integration bridging sequence bounds
      });
      
      if (!res.ok) {
         const errData = await res.json();
         // Phase 7 Constraint: Gracefully catch 409 Optimistic Concurrency Lock Exceptions natively!
         if (res.status === 409 && errData.message?.includes('Lock')) {
             setValidationData({ valid: false, reason: 'CONCURRENCY LOCK ENGAGED: Another manager has already mutated this shift entity fractions of a second ago. The remote DOM is being forcefully re-synced.' });
             await fetchShifts();
             return;
         }
         setValidationData({ valid: false, reason: errData.message || 'Database rejected assignment.' });
         return;
      }
      
      await fetchShifts();
      await fetchFairness();
      setValidationData(null);
      setAssignModalShift(null);
    } catch (e) {
      console.error(e);
    }
  };

  const removeAssignment = async (shift: Shift) => {
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/shifts/${shift.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: null })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Error removing assignment: ${err.message}`);
        return;
      }
      fetchShifts();
      fetchFairness();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePublishState = async (shiftId: string) => {
     try {
       const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
       const res = await fetch(`${API_URL}/shifts/${shiftId}/publish`, { method: 'PUT' });
       if (!res.ok) {
         const err = await res.json();
         alert(`Error publishing deployment clause: ${err.message}`);
         return;
       }
       fetchShifts();
     } catch(err) {
       console.error(err);
     }
  };

  if (locations.length === 0) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;

  // Render Core Visualizations natively intercepting constraints dynamically across all active DB rows
  const projectedLaborDash = staffList.map(staff => {
      const pShifts = shifts.filter(s => s.assignedStaff?.id === staff.id);
      const hours = pShifts.reduce((acc, s) => {
          return acc + getShiftTiming(s, viewerTimeZone).durationHours;
      }, 0);
      const overtimeHours = Math.max(0, hours - 40);
      const otCost = overtimeHours * 25.50 * 1.5; // Benchmark standard 1.5x Premium Rate
      return { staff, hours, overtimeHours, otCost };
  }).filter(d => d.hours > 0).sort((a,b) => b.hours - a.hours);

  // Phase 7.1: On-Duty Live Computation
  const now = new Date();
  const onDutyShifts = shifts.filter((shift) => shift.assignedStaff && isShiftActive(shift, now));

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up text-white font-sans">
      <header className="mb-8 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-4xl font-extrabold tracking-tight">Shift Scheduling Console</h2>
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border flex items-center gap-2 ${isConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
               <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
               {isConnected ? 'Live Socket Connected' : 'Connecting Sync...'}
            </span>
          </div>
          <p className="text-slate-400 text-lg">Build, validate and publish weekly configurations across Live Server API bounds.</p>
          <p className="text-xs text-slate-500 mt-2 font-mono">Viewer timezone: {viewerTimeZone} • Last sync: {new Date(lastSync).toLocaleTimeString()}</p>
        </div>
        <button 
          onClick={() => setShowShiftModal(true)}
          className="bg-blue-600 hover:bg-blue-500 font-bold py-3 px-6 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-500 transition-colors whitespace-nowrap"
        >
          + Build Unassigned Shift Template
        </button>
      </header>
      
      {/* On-Duty Now Live Dashboard */}
      {onDutyShifts.length > 0 && (
          <div className="bg-emerald-950/20 rounded-[2rem] border border-emerald-500/30 shadow-2xl overflow-hidden p-8 mb-8 relative">
             <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
             <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 relative z-10 text-emerald-50">
                On-Duty Active Floor Tracker
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-widest uppercase border border-emerald-500/30 px-3 py-1 rounded-md animate-pulse">Monitoring Live Flow</span>
             </h3>
             
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                {onDutyShifts.map(shift => (
                  (() => {
                    const timing = getShiftTiming(shift, viewerTimeZone);
                    return (
                   <div key={`duty-${shift.id}`} className="bg-slate-900 border border-emerald-500/40 p-4 rounded-2xl flex items-center justify-between shadow-lg hover:border-emerald-400 transition-colors">
                      <div>
                         <p className="font-bold text-white text-sm mb-1">{shift.assignedStaff?.name}</p>
                         <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">{shift.location?.name} • {shift.requiredSkill?.name}</p>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Shift Ends</p>
                         <p className="font-mono font-bold text-emerald-300">{timing.locationTimeRange.split(' - ')[1]}</p>
                      </div>
                   </div>
                    );
                  })()
                ))}
             </div>
          </div>
      )}

      {/* Overtime & Compliance Dashboard */}
      {projectedLaborDash.length > 0 && (
         <div className="bg-slate-800 rounded-[2rem] border border-slate-700 shadow-2xl overflow-hidden p-8 mb-8 relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3 relative z-10">
               Projected Labor Cost Analytics
               <span className="bg-amber-500/10 text-amber-500 text-[10px] font-bold tracking-widest uppercase border border-amber-500/20 px-3 py-1 rounded-md">Live Evaluation</span>
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4 relative z-10">
               {projectedLaborDash.map(d => (
                  <div key={d.staff.id} className={`p-5 rounded-[1.5rem] border hover:-translate-y-1 transition-transform shadow-lg ${d.overtimeHours > 0 ? 'bg-amber-950/40 border-amber-500/40' : d.hours >= 35 ? 'bg-blue-900/10 border-blue-500/30' : 'bg-slate-900 border-slate-700'}`}>
                     <p className="font-bold mb-3 truncate">{d.staff.name}</p>
                     <div className="flex justify-between items-end">
                       <p className={`font-mono text-3xl font-extrabold ${d.overtimeHours > 0 ? 'text-amber-400' : d.hours >= 35 ? 'text-blue-400' : 'text-emerald-400'}`}>{d.hours.toFixed(1)}<span className="text-sm font-sans opacity-50 ml-1">hrs</span></p>
                     </div>
                     {d.overtimeHours > 0 && (
                         <div className="mt-4 pt-4 border-t border-amber-500/20">
                            <p className="text-[10px] font-bold tracking-widest uppercase text-amber-500/70 mb-1">Overtime Target Premium</p>
                            <p className="text-sm text-red-400 font-mono font-bold">+${d.otCost.toFixed(2)}</p>
                         </div>
                     )}
                     {d.overtimeHours === 0 && d.hours >= 35 && (
                         <div className="mt-4 pt-4 border-t border-blue-500/20">
                            <p className="text-[10px] font-bold tracking-widest uppercase text-blue-400/70 mb-1">Status Clearance Check</p>
                            <p className="text-sm text-blue-300 font-mono font-bold">Approaching Limit</p>
                         </div>
                     )}
                  </div>
               ))}
            </div>
         </div>
      )}

      {/* Schedule Fairness Analytics */}
      {fairnessData && fairnessData.totalPremiumShifts > 0 && (
         <div className="bg-slate-800 rounded-[2rem] border border-slate-700 shadow-xl overflow-hidden p-8 mb-8 relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-fuchsia-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
            <div className="flex justify-between items-center mb-6 relative z-10">
               <h3 className="text-2xl font-bold flex items-center gap-3">
                  Fairness & Equity Distribution
                  <span className="bg-fuchsia-500/10 text-fuchsia-400 text-[10px] font-bold tracking-widest uppercase border border-fuchsia-500/20 px-3 py-1 rounded-md">Live Analytics</span>
               </h3>
               <div className="flex items-center gap-4">
                  <div className="text-right">
                     <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-0.5">Distribution Equity Grade</p>
                     <p className={`font-mono text-3xl font-extrabold ${fairnessData.overallScore >= 90 ? 'text-emerald-400' : fairnessData.overallScore >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {fairnessData.overallScore}%
                     </p>
                  </div>
               </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
               <div className="bg-slate-900 border border-slate-700 rounded-[1.5rem] p-5">
                  <p className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-4 flex justify-between">
                     <span>Premium Shift Allocation</span>
                     <span className="text-fuchsia-400">Total: {fairnessData.totalPremiumShifts}</span>
                  </p>
                  <div className="space-y-3">
                     {fairnessData.staffMetrics.filter(m => m.premiumShifts > 0).map(m => (
                        <div key={m.staff.id} className="flex items-center gap-4">
                           <p className="w-32 font-bold text-sm truncate">{m.staff.name}</p>
                           <div className="flex-1 bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
                               <div className="bg-fuchsia-500 h-full rounded-full transition-all duration-1000" style={{ width: `${(m.premiumShifts / fairnessData.totalPremiumShifts) * 100}%` }}></div>
                           </div>
                           <p className="font-mono text-xs w-8 text-right text-slate-400">{m.premiumShifts}</p>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="bg-slate-900 border border-slate-700 rounded-[1.5rem] p-5">
                  <p className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-4 flex justify-between">
                     <span>Target Hours Fulfillment</span>
                  </p>
                  <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                     {fairnessData.staffMetrics.map(m => (
                        <div key={m.staff.id} className="flex justify-between items-center p-2 rounded-lg border border-slate-800 bg-slate-800/50 hover:bg-slate-800 transition-colors">
                           <p className="font-bold text-sm truncate">{m.staff.name}</p>
                           <div className="flex items-center gap-3">
                              <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">{m.assignedHours.toFixed(1)} / {m.targetHours}h</p>
                              {m.hoursVariance < 0 ? (
                                <p className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 uppercase tracking-widest">{m.hoursVariance.toFixed(1)}h Under</p>
                              ) : m.hoursVariance > 0 ? (
                                <p className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest">+{m.hoursVariance.toFixed(1)}h Over</p>
                              ) : (
                                <p className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">Target Met</p>
                              )}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Location Filter */}
      <div className="flex gap-4 mb-8">
        {locations.map(loc => (
          <button 
            key={loc.id}
            onClick={() => setSelectedLocation(loc.id)}
            className={`px-5 py-2.5 rounded-xl font-bold transition-all border shadow-sm ${
                selectedLocation === loc.id 
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
          >
            {loc.name}
          </button>
        ))}
      </div>

      {/* Shifts Board */}
      <div className="bg-slate-800 rounded-[2rem] border border-slate-700 shadow-2xl overflow-hidden p-8">
         <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
           Pending Database Deployments
           <span className="text-xs bg-slate-900 border border-slate-700 px-3 py-1 rounded-full text-slate-400">{locShifts.length} remote clusters resolved</span>
         </h3>
         
         {locShifts.length === 0 && (
           <div className="text-center py-16 border-2 border-dashed border-slate-700 rounded-3xl">
             <p className="text-slate-400 italic text-lg">No shifts are plotted out for this territory.</p>
           </div>
         )}

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locShifts.map(shift => {
              const assigned = shift.assignedStaff;
              const skill = shift.requiredSkill;
              const timing = getShiftTiming(shift, viewerTimeZone);
              
              return (
                <div key={shift.id} className="bg-slate-900 border border-slate-700 p-6 rounded-[1.5rem] flex flex-col justify-between group hover:border-slate-500 transition-colors shadow-lg">
                  <div className="mb-6">
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex flex-col gap-2">
                         <p className="font-mono text-sm text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{timing.locationDate}</p>
                         {timing.isOvernight && (
                           <span className="w-fit text-[10px] uppercase tracking-widest font-bold bg-violet-500/10 text-violet-300 border border-violet-500/30 px-2 py-1 rounded-md">Overnight</span>
                         )}
                       </div>
                       <button onClick={()=>togglePublishState(shift.id)} className={`text-xs px-2 py-1 flex items-center border rounded-lg font-bold transition-colors ${shift.published ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20'}`}>
                         {shift.published ? 'PUBLISHED' : 'DRAFT (DEPLOY)'}
                       </button>
                    </div>
                    <p className="font-extrabold text-2xl tracking-tighter mb-2">{timing.locationTimeRange}</p>
                    <p className="text-xs text-slate-400 mb-3">{timing.locationTimeZone}</p>
                    <p className="text-xs text-slate-500 mb-3">Your view: {timing.viewerDate} • {timing.viewerTimeRange}</p>
                    <span className="inline-block text-[11px] bg-slate-800 text-slate-300 border border-slate-600 px-2.5 py-1 rounded-md font-bold uppercase tracking-widest">{skill?.name} Required</span>
                  </div>
                  
                  <div className="pt-5 border-t border-slate-800">
                    {assigned ? (
                       <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center shadow-inner">
                          <div>
                            <p className="font-bold text-sm">{assigned.name}</p>
                            <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase mt-0.5">Assigned</p>
                          </div>
                          <button onClick={() => removeAssignment(shift)} className="text-xs text-red-400 hover:text-red-300 font-semibold bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors hover:bg-red-500/20">Remove</button>
                       </div>
                    ) : (
                       <button onClick={() => { setAssignModalShift(shift); setValidationData(null); }} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 py-3.5 rounded-xl font-bold transition-all text-sm flex justify-center items-center gap-2 group-hover:border-blue-500/50 group-hover:bg-blue-500/10 text-slate-300 group-hover:text-blue-400">
                         <span>Assign Open Shift</span>
                         <span className="text-xl leading-none">→</span>
                       </button>
                    )}
                  </div>
                </div>
              );
            })}
         </div>
      </div>

      {/* Staff Assignment Modal Flow */}
      {assignModalShift && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-slate-900 rounded-[2rem] border border-slate-700 w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 shrink-0">
                 <div>
                   <h3 className="text-xl font-bold">Deploy Live Roster Match</h3>
                   {(() => {
                     const timing = getShiftTiming(assignModalShift, viewerTimeZone);
                     return <p className="text-xs text-slate-400 mt-1 font-mono">{timing.locationDate} • {timing.locationTimeRange} ({timing.locationTimeZone})</p>;
                   })()}
                 </div>
                 <button onClick={() => setAssignModalShift(null)} className="h-10 w-10 bg-slate-800 flex items-center justify-center rounded-full hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors">✕</button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                 {/* Constraint Violations Pane */}
                 {validationData && !validationData.valid && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 mb-8 animate-fade-in-up">
                       <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">⚠️</span>
                          <p className="text-red-400 font-extrabold text-lg">System Block Active</p>
                       </div>
                       <p className="text-red-300 text-sm mb-5 leading-relaxed bg-red-500/10 p-3 rounded-lg border border-red-500/20 font-mono">
                         {validationData.reason}
                       </p>
                    </div>
                 )}

                 {/* Constraint Visualization Roster Listing */}
                 <div>
                   <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4">Manual Selection Candidates</p>
                   <div className="space-y-4">
                      {staffList.map(staff => {
                         // PRE-FLIGHT CAPTURE: Calculate 'What-If' scenarios natively here!
                         const preflight = validateAssignment(staff, assignModalShift, shifts, staffList);
                         const isBlocked = !preflight.valid;

                         return (
                           <div key={staff.id} className={`bg-slate-800 p-5 rounded-[1.5rem] border flex justify-between items-center transition-all ${isBlocked ? 'opacity-50 border-slate-700 grayscale' : 'border-slate-700 hover:border-blue-500/50 shadow-lg'}`}>
                              <div className="flex-1">
                                 <p className="font-bold text-lg text-white mb-2">{staff.name}</p>
                                 <div className="flex flex-wrap gap-2 text-[10px] font-bold tracking-widest uppercase mb-3">
                                   <span className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-slate-400">{staff.skills?.map((s: Skill)=>s.name).join(' / ')}</span>
                                   <span className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-slate-400">{staff.desiredHours}h Target</span>
                                 </div>
                                 
                                 {/* Visualize dynamic warnings triggered by attempting this connection */}
                                 {preflight.warnings && preflight.warnings.length > 0 && (
                                   <div className="space-y-1 mt-2">
                                     {preflight.warnings.map((w: string, idx: number) => (
                                       <p key={idx} className={`text-xs px-2 py-1 object-fit inline-block rounded border font-mono ${preflight.requiresOverride && w.includes('7 Consecutive') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'}`}>⚠️ {w}</p>
                                     ))}
                                   </div>
                                 )}
                                 {isBlocked && <p className="text-xs text-red-400 mt-2 font-mono ml-1">{preflight.reason}</p>}
                              </div>
                              <button disabled={isBlocked} onClick={() => attemptAssignment(staff)} className={`px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm flex flex-col gap-1 items-center ${isBlocked ? 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800' : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.2)]'}`}>
                                <span>{isBlocked ? 'BLOCKED' : preflight.requiresOverride ? 'OVERRIDE EXECUTE' : 'ASSIGN SHIFT'}</span>
                              </button>
                           </div>
                         );
                      })}
                   </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Create Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-slate-900 rounded-[2rem] border border-slate-700 w-full max-w-sm overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                 <h3 className="text-xl font-bold">New Shift Query</h3>
                 <button onClick={() => setShowShiftModal(false)} className="h-10 w-10 bg-slate-800 flex items-center justify-center rounded-full hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors">✕</button>
              </div>
              <form onSubmit={handleCreateShift} className="p-8 space-y-5">
                 <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Target Date</label>
                    <input type="date" required value={newShiftDate} onChange={e=>setNewShiftDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors shadow-inner" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Block Start</label>
                      <input type="time" required value={newShiftStart} onChange={e=>setNewShiftStart(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors shadow-inner" />
                   </div>
                   <div>
                      <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Block End</label>
                      <input type="time" required value={newShiftEnd} onChange={e=>setNewShiftEnd(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors shadow-inner" />
                   </div>
                 </div>
                 <div>
                    <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Mandatory Certification</label>
                    <select value={newShiftSkill} onChange={e=>setNewShiftSkill(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors shadow-inner">
                      {skills.map(sk => <option key={sk.id} value={sk.id}>{sk.name}</option>)}
                    </select>
                 </div>
                 {shiftPreview && (
                   <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 space-y-2">
                     <div className="flex items-center justify-between">
                       <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Time Preview</p>
                       {shiftPreview.isOvernight && <span className="text-[10px] uppercase tracking-widest font-bold bg-violet-500/10 text-violet-300 border border-violet-500/30 px-2 py-1 rounded-md">Overnight</span>}
                     </div>
                     <p className="text-sm text-white font-semibold">{shiftPreview.locationDate} • {shiftPreview.locationTimeRange}</p>
                     <p className="text-xs text-slate-400">{shiftPreview.locationTimeZone}</p>
                     <p className="text-xs text-slate-500">Viewer: {shiftPreview.viewerDate} • {shiftPreview.viewerTimeRange} ({shiftPreview.viewerTimeZone})</p>
                     <p className="text-xs text-slate-500">UTC: {new Date(shiftPreview.startUtc).toISOString()} → {new Date(shiftPreview.endUtc).toISOString()}</p>
                     <p className="text-xs text-emerald-400 font-mono">{shiftPreview.durationHours.toFixed(1)}h total</p>
                   </div>
                 )}
                 
                 <div className="pt-4">
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 font-bold py-3.5 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-500 transition-all hover:-translate-y-0.5">Push Query to Database</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
