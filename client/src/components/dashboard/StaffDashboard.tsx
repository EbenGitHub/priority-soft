import React, { useEffect, useState } from 'react';

export default function StaffDashboard({ user }: { user: any }) {
  const [availabilities, setAvailabilities] = useState(user.availabilities || []);
  const [dayOfWeek, setDayOfWeek] = useState('1'); // 1 = Monday
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [loading, setLoading] = useState(false);

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const addAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'RECURRING',
          dayOfWeek: parseInt(dayOfWeek),
          startTime: startTime + ':00',
          endTime: endTime + ':00',
        })
      });
      if (res.ok) {
        const newAvail = await res.json();
        setAvailabilities([...availabilities, newAvail]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Profile Info */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
        <h3 className="text-xl font-bold mb-4 text-white">My Profile</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-400 uppercase tracking-widest font-semibold mb-2">Certified Locations</p>
            <div className="flex flex-wrap gap-2">
              {user.locations?.map((loc: any) => (
                <span key={loc.id} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-lg text-sm">{loc.name}</span>
              ))}
              {!user.locations?.length && <span className="text-slate-500">None assigned</span>}
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-400 uppercase tracking-widest font-semibold mb-2">My Skills</p>
            <div className="flex flex-wrap gap-2">
              {user.skills?.map((skill: any) => (
                <span key={skill.id} className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-lg text-sm">{skill.name}</span>
              ))}
              {!user.skills?.length && <span className="text-slate-500">No skills added</span>}
            </div>
          </div>
          <div>
             <p className="text-sm text-slate-400 uppercase tracking-widest font-semibold mb-1">Target Hours</p>
             <p className="text-lg font-medium text-white">{user.desiredHours} hrs / week</p>
          </div>
        </div>
      </div>

      {/* Availability Manager */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
        <h3 className="text-xl font-bold mb-4 text-white">Manage Availability</h3>
        
        <form onSubmit={addAvailability} className="flex flex-wrap lg:flex-nowrap gap-2 items-end mb-6">
          <div className="flex-1 min-w-[100px]">
            <label className="block text-xs text-slate-400 mb-1">Day</label>
            <select value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-blue-500">
              {days.map((day, idx) => <option key={idx} value={idx}>{day}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Start</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm w-24 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">End</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-sm w-24 focus:outline-none focus:border-blue-500" />
          </div>
          <button disabled={loading} type="submit" className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50">Add</button>
        </form>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
           {availabilities.length === 0 && <p className="text-slate-500 text-sm text-center py-4">No availability set.</p>}
           {availabilities.map((av: any, i: number) => (
             <div key={i} className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-700">
               <div>
                 <span className="font-semibold text-emerald-400">{days[av.dayOfWeek]}</span>
                 {av.type === 'EXCEPTION' && <span className="ml-2 text-[10px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded font-mono border border-yellow-500/30">Exception: {av.date}</span>}
               </div>
               <div className="text-sm text-slate-300 font-mono">
                 {av.startTime.substring(0, 5)} - {av.endTime.substring(0, 5)}
               </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
