import React, { useEffect, useState } from 'react';

export default function AdminDashboard({ user }: { user: any }) {
  const [users, setUsers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  useEffect(() => {
    const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    Promise.all([
      fetch(`${API_URL}/users`).then(r => r.json()),
      fetch(`${API_URL}/locations`).then(r => r.json())
    ]).then(([uData, lData]) => {
      setUsers(uData);
      setLocations(lData);
    });
  }, []);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
        <h3 className="text-xl font-bold mb-4 text-white">Global Staff Directory</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="p-4 text-slate-400 font-semibold text-xs uppercase tracking-wider rounded-tl-lg">User</th>
                <th className="p-4 text-slate-400 font-semibold text-xs uppercase tracking-wider">Role</th>
                <th className="p-4 text-slate-400 font-semibold text-xs uppercase tracking-wider">Primary Location</th>
                <th className="p-4 text-slate-400 font-semibold text-xs uppercase tracking-wider rounded-tr-lg">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-700/20 transition-colors group">
                  <td className="p-4">
                    <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{u.name}</p>
                    <p className="text-slate-400 text-xs">{u.email}</p>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 text-[10px] rounded-full border font-bold uppercase tracking-wider ${
                      u.role === 'ADMIN' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                      u.role === 'MANAGER' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-slate-700/50 text-slate-300 border-slate-600'
                    }`}>{u.role}</span>
                  </td>
                  <td className="p-4 text-slate-300">
                    <div className="flex gap-2 items-center flex-wrap">
                      {u.locations?.[0]?.name ? (
                        <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded border border-emerald-500/20">{u.locations[0].name}</span>
                      ) : (
                        <span className="text-slate-500 italic text-xs">-</span>
                      )}
                      {u.locations?.length > 1 && (
                         <span className="text-xs text-slate-400">+{u.locations.length - 1}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <button className="text-xs bg-slate-900 border border-slate-600 hover:border-blue-500 hover:text-blue-400 text-slate-300 px-3 py-1.5 rounded transition-colors font-medium">Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
        <h3 className="text-xl font-bold mb-4 text-white">Active Properties</h3>
        <ul className="space-y-4">
          {locations.map(loc => (
            <li key={loc.id} className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex justify-between items-center group hover:border-slate-500 transition-colors">
              <div>
                <p className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{loc.name}</p>
                <p className="text-xs text-slate-500 font-mono mt-1">{loc.timezone}</p>
              </div>
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              </div>
            </li>
          ))}
          {locations.length === 0 && <p className="text-slate-500 italic">No locations configured.</p>}
        </ul>
      </div>
    </div>
  );
}
