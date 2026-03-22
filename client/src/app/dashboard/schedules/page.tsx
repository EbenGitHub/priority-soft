"use client";

import React, { useState, useEffect } from 'react';
import { Location, Skill, Shift, Staff } from '../../../lib/mockData';
import { validateAssignment, ValidationResult } from '../../../lib/schedulingRules';

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

  const [validationData, setValidationData] = useState<ValidationResult | null>(null);

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
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/shifts`);
      if (res.ok) {
         setShifts(await res.json());
      }
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, [selectedLocation]);

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
    
    // Front-end Pre-Flight bounds check logic to deliver instant suggestions pane
    const result = validateAssignment(targetStaff, assignModalShift, shifts, staffList);
    if (!result.valid) {
      setValidationData(result);
      return;
    }

    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/shifts/${assignModalShift.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetStaff.id })
      });
      
      if (!res.ok) {
         const errData = await res.json();
         setValidationData({ valid: false, reason: errData.message || 'Database rejected assignment.' });
         return;
      }
      
      await fetchShifts();
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

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up text-white font-sans">
      <header className="mb-8 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight">Shift Scheduling Console</h2>
          <p className="text-slate-400 mt-2 text-lg">Build, validate and publish weekly configurations across Live Server API bounds.</p>
        </div>
        <button 
          onClick={() => setShowShiftModal(true)}
          className="bg-blue-600 hover:bg-blue-500 font-bold py-3 px-6 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.3)] border border-blue-500 transition-colors whitespace-nowrap"
        >
          + Build Unassigned Shift Template
        </button>
      </header>

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
              
              return (
                <div key={shift.id} className="bg-slate-900 border border-slate-700 p-6 rounded-[1.5rem] flex flex-col justify-between group hover:border-slate-500 transition-colors shadow-lg">
                  <div className="mb-6">
                    <div className="flex justify-between items-start mb-2">
                       <p className="font-mono text-sm text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{shift.date}</p>
                       <button onClick={()=>togglePublishState(shift.id)} className={`text-xs px-2 py-1 flex items-center border rounded-lg font-bold transition-colors ${shift.published ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20'}`}>
                         {shift.published ? 'PUBLISHED' : 'DRAFT (DEPLOY)'}
                       </button>
                    </div>
                    <p className="font-extrabold text-2xl tracking-tighter mb-2">{shift.startTime.slice(0,5)} <span className="text-slate-500 font-normal">to</span> {shift.endTime.slice(0,5)}</p>
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

      {/* Staff Assignment Modal */}
      {assignModalShift && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-slate-900 rounded-[2rem] border border-slate-700 w-full max-w-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                 <div>
                   <h3 className="text-xl font-bold">Deploy Live Roster Match</h3>
                   <p className="text-xs text-slate-400 mt-1 font-mono">{assignModalShift.date} • {assignModalShift.startTime} to {assignModalShift.endTime}</p>
                 </div>
                 <button onClick={() => setAssignModalShift(null)} className="h-10 w-10 bg-slate-800 flex items-center justify-center rounded-full hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors">✕</button>
              </div>
              <div className="p-8">
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
                       
                       <div className="pt-5 border-t border-red-500/20">
                         <p className="text-slate-300 text-xs font-bold uppercase tracking-widest mb-3">AI Engine Fallback Suggestions:</p>
                         
                         {validationData.suggestions && validationData.suggestions.length > 0 ? (
                           <div className="flex flex-wrap gap-2">
                             {validationData.suggestions.map(sugg => (
                               <button onClick={() => attemptAssignment(sugg)} key={sugg.id} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40 px-4 py-2 rounded-lg text-sm font-bold transition-all hover:-translate-y-0.5 shadow-lg">
                                 Auto-Assign: {sugg.name}
                               </button>
                             ))}
                           </div>
                         ) : (
                           <p className="text-slate-500 text-sm italic">The validation engine scanned the entire roster and found no available compliant alternatives for this shift.</p>
                         )}
                       </div>
                    </div>
                 )}

                 {/* Roster Listing */}
                 <div>
                   <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-4">Manual Selection Roster</p>
                   <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-3 custom-scrollbar">
                      {staffList.map(staff => (
                         <div key={staff.id} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 flex justify-between items-center hover:border-slate-500 transition-colors shadow-sm">
                            <div>
                               <p className="font-bold text-lg text-white mb-1">{staff.name}</p>
                               <p className="text-xs text-slate-400 font-mono">
                                 {staff.skills.map(s=>s.name).join(' / ')} • {staff.desiredHours}h Target
                               </p>
                            </div>
                            <button onClick={() => attemptAssignment(staff)} className="bg-slate-900 border border-slate-600 hover:border-blue-500 text-slate-300 hover:text-blue-400 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm">Execute Fit Test</button>
                         </div>
                      ))}
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
