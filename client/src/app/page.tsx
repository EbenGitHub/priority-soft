"use client";

import React, { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123'); // pre-filled standard sandbox password
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        throw new Error('Invalid email or password');
      }

      const user = await res.json();
      // Temporarily store in localStorage to mock session
      localStorage.setItem('shiftSync_user', JSON.stringify(user));
      
      setSuccess(true);
      
      // Simulate navigation to dashboard
      setTimeout(() => {
        window.location.href = '/dashboard'; 
      }, 1000);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 font-sans">
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-10 w-full max-w-md border border-slate-700">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">
            ShiftSync
          </h1>
          <p className="text-slate-400 mt-2">Sign in to Coastal Eats</p>
        </div>

        {success ? (
          <div className="text-center p-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-400 mb-6 border border-emerald-500/30">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome back!</h2>
            <p className="text-slate-400">Loading your dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="admin@coastaleats.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg transform transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}

        {!success && (
          <div className="mt-8 pt-6 border-t border-slate-700">
            <p className="text-sm text-slate-400 text-center mb-4">Sandbox Demo Accounts</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button onClick={() => setEmail('admin@coastaleats.com')} type="button" className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300 transition-colors">Admin</button>
              <button onClick={() => setEmail('eastmanager@coastaleats.com')} type="button" className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300 transition-colors">Manager</button>
              <button onClick={() => setEmail('sarah@coastaleats.com')} type="button" className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300 transition-colors">Staff</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
