"use client";

import React, { useEffect, useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('shiftSync_user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      window.location.href = '/';
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('shiftSync_user');
    window.location.href = '/';
  };

  if (!user) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
       <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex-col hidden lg:flex shadow-2xl z-10 relative">
        <div className="p-6 h-20 flex items-center border-b border-slate-800">
          <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight cursor-default">
            ShiftSync
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <a href="#" className="flex items-center px-4 py-3 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl font-bold transition-all shadow-inner">
            Dashboard
          </a>
          <a href="#" className="flex items-center px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all font-medium border border-transparent hover:border-slate-700">
            Schedules
          </a>
          <a href="#" className="flex items-center px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all font-medium border border-transparent hover:border-slate-700">
            Team Messages
          </a>
        </nav>
        
        <div className="p-5 border-t border-slate-800 bg-slate-900 mt-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-600 border border-slate-500 flex items-center justify-center font-bold text-white shadow-inner">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-bold text-sm text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            className="w-full py-2.5 bg-slate-800 hover:bg-red-500/10 text-slate-300 hover:text-red-400 rounded-xl transition-all text-sm font-bold border border-slate-700 hover:border-red-500/30"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto">
        <div className="p-8 pb-20">
          {children}
        </div>
      </main>
    </div>
  );
}
