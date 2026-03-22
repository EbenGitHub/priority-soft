import React, { useEffect, useState } from 'react';

export default function ManagerDashboard({ user }: { user: any }) {
  const [locations, setLocations] = useState(user.locations || []);
  const [selectedLoc, setSelectedLoc] = useState<string | null>(locations.length ? locations[0].id : null);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedLoc) return;
    const fetchStaff = async () => {
      setLoading(true);
      try {
        const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
        const res = await fetch(`${API_URL}/users/location/${selectedLoc}`);
        if(res.ok) setStaff(await res.json());
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchStaff();
  }, [selectedLoc]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
        <h3 className="text-xl font-bold mb-4 text-white">Your Assigned Locations</h3>
        <div className="flex flex-wrap gap-3">
          {locations.map((loc: any) => (
            <button 
              key={loc.id} 
              onClick={() => setSelectedLoc(loc.id)}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all border shadow-sm ${
                selectedLoc === loc.id 
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
              }`}
            >
              {loc.name}
            </button>
          ))}
          {locations.length === 0 && <p className="text-slate-400">No locations assigned to you.</p>}
        </div>
      </div>

      {selectedLoc && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
          <div className="flex justify-between items-center mb-6">
             <div>
               <h3 className="text-xl font-bold text-white">Location Roster</h3>
               <p className="text-sm text-slate-400">Viewing authorized staff members for scheduling.</p>
             </div>
             <span className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1 rounded-lg border border-slate-700">
               Timezone: {locations.find((l:any)=>l.id === selectedLoc)?.timezone}
             </span>
          </div>
          
          {loading ? (
            <div className="py-8 text-center text-slate-400">
              <svg className="animate-spin h-8 w-8 mx-auto text-blue-500" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {staff.filter(s => s.role === 'STAFF').map(member => (
                <div key={member.id} className="bg-slate-900 border border-slate-700 p-5 rounded-2xl hover:border-slate-600 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-bold text-white">{member.name}</p>
                      <p className="text-xs text-slate-400">{member.email}</p>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-md font-bold text-center">
                      {member.desiredHours}<br/>hrs
                    </span>
                  </div>
                  
                  <div className="space-y-1 mb-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {member.skills.map((sk: any) => (
                        <span key={sk.id} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">{sk.name}</span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-slate-800 p-2 rounded-lg border border-slate-700/50 flex justify-between items-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Availabilities</p>
                    <div className="text-xs text-slate-300 font-mono">
                      {member.availabilities?.length || 0} active
                    </div>
                  </div>
                </div>
              ))}
              {staff.filter(s => s.role === 'STAFF').length === 0 && <p className="text-slate-500 italic col-span-full">No active staff found for this territory.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
