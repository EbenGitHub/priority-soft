"use client";

import React, { useEffect, useState } from 'react';

export default function PingPage() {
  const [user, setUser] = useState<any>(null);
  const [backendStatus, setBackendStatus] = useState({ server: 'loading', database: 'loading' });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // 1. Load User
    const userData = localStorage.getItem('shiftSync_user');
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      // Not logged in, redirect to home
      window.location.href = '/';
      return;
    }

    // 2. Load System Ping
    const runPing = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ping`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setBackendStatus(data);
      } catch (error: any) {
        setErrorMsg(error.message);
        setBackendStatus({ server: 'error', database: 'error' });
      }
    };
    runPing();
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('shiftSync_user');
    window.location.href = '/';
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header / Nav */}
        <div className="flex items-center justify-between bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              ShiftSync Dashboard
            </h1>
            <p className="text-slate-400 mt-1">Welcome back, <span className="text-white font-medium">{user.name}</span></p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="block text-xs text-slate-400 uppercase tracking-wider font-bold">Role</span>
              <span className="inline-block mt-1 px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-sm font-semibold">
                {user.role}
              </span>
            </div>
            <button 
              onClick={handleSignOut}
              className="px-4 py-2 bg-slate-700 hover:bg-red-500/20 text-slate-300 hover:text-red-400 hover:border-red-500/30 border border-slate-600 rounded-lg transition-colors text-sm font-semibold"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* System Status Ping Widget */}
        <div className="bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-700 w-full max-w-md">
          <h2 className="text-xl font-bold mb-6 text-slate-200">System Status</h2>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
              <span className="text-slate-300">Backend Server</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                backendStatus.server === 'ok' 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                  : backendStatus.server === 'loading'
                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                {backendStatus.server}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
              <span className="text-slate-300">Database</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                backendStatus.database === 'ok' 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                  : backendStatus.database === 'loading'
                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                {backendStatus.database}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <p className="font-semibold mb-1">Connection Error:</p>
              <p className="font-mono text-xs break-all">{errorMsg}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
