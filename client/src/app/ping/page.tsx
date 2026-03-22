import React from 'react';

export default async function PingPage() {
  let backendStatus = { server: 'unknown', database: 'unknown' };
  let errorMsg = null;

  try {
    const res = await fetch('http://localhost:8080/ping', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    backendStatus = await res.json();
  } catch (error: any) {
    errorMsg = error.message;
    backendStatus.server = 'error';
    backendStatus.database = 'error';
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 font-sans">
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-10 w-full max-w-md border border-slate-700">
        <h1 className="text-3xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          System Status
        </h1>
        
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
            <span className="text-lg text-slate-300">Backend Server</span>
            <span className={`px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wider border ${
              backendStatus.server === 'ok' 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {backendStatus.server}
            </span>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl">
            <span className="text-lg text-slate-300">Database</span>
            <span className={`px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wider border ${
              backendStatus.database === 'ok' 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {backendStatus.database}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            <p className="font-semibold mb-1">Connection Error:</p>
            <p className="font-mono text-xs break-all">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
