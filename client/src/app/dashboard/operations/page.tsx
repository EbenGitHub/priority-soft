"use client";

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { io, Socket } from 'socket.io-client';
import ModalShell from '../../../components/ui/ModalShell';

type SessionUser = {
  id: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
};

type OperationTarget = 'all' | 'users' | 'shifts' | 'notifications' | 'audit';
type OperationProgressEvent = {
  scope: 'reset' | 'seed';
  target: string;
  message: string;
  status: 'running' | 'completed' | 'failed';
  counts?: Record<string, number>;
};

const SEED_ACTIONS: Array<{
  target: OperationTarget;
  title: string;
  description: string;
}> = [
  { target: 'all', title: 'Seed All Demo Data', description: 'Rebuild the complete demo state: users, shifts, notifications, swaps, and audit history.' },
  { target: 'users', title: 'Seed Users Only', description: 'Create locations, skills, users, availabilities, and notification preferences.' },
  { target: 'shifts', title: 'Seed Shifts', description: 'Create the seeded schedule scenarios after ensuring the user bundle exists.' },
  { target: 'notifications', title: 'Seed Notifications', description: 'Populate persisted notifications after ensuring users and shifts exist.' },
  { target: 'audit', title: 'Seed Audit & Swaps', description: 'Populate swap requests and audit history after ensuring users and shifts exist.' },
];

export default function OperationsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [progressLog, setProgressLog] = useState<
    Array<OperationProgressEvent & { id: string; createdAt: string }>
  >([]);

  useEffect(() => {
    const rawUser = window.localStorage.getItem('shiftSync_user');
    if (!rawUser) return;
    setUser(JSON.parse(rawUser) as SessionUser);
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return;
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    const socket: Socket = io(apiUrl);

    socket.on('connect', () => {
      socket.emit('notifications:join', { userId: user.id });
    });

    socket.on('operation_progress', (event: OperationProgressEvent) => {
      setProgressLog((current) => [
        {
          ...event,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 40));
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  async function runSeed(target: OperationTarget) {
    if (!user) return;
    setRunningAction(`seed:${target}`);
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/admin/ops/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: user.id, target }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || 'Operation failed.');
      toast.success(`Seed action completed: ${target}.`);
    } catch (error: any) {
      toast.error(error.message || 'Unable to run seed action.');
    } finally {
      setRunningAction(null);
    }
  }

  async function resetDatabase() {
    if (!user) return;

    setRunningAction('reset');
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${apiUrl}/admin/ops/reset`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: user.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || 'Reset failed.');
      toast.success('Database cleared.');
      setShowResetModal(false);
    } catch (error: any) {
      toast.error(error.message || 'Unable to reset database.');
    } finally {
      setRunningAction(null);
    }
  }

  if (!user) return null;

  if (user.role !== 'ADMIN') {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in-up">
        <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-8 shadow-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Access Restricted</p>
          <h2 className="mt-3 text-3xl font-black text-white">Operations controls are limited to admins.</h2>
          <p className="mt-3 text-slate-300">This page contains destructive reset and seed actions for evaluation workflows.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up text-white">
      <header className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Admin Controls</p>
        <h2 className="mt-2 text-4xl font-extrabold tracking-tight">Operations</h2>
        <p className="mt-3 max-w-3xl text-slate-400">
          Reset the database, run targeted seed bundles, and prepare the assessment environment quickly for a reviewer or scenario walkthrough.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[2rem] border border-slate-700 bg-slate-800 p-8 shadow-2xl">
          <div className="mb-6">
            <h3 className="text-2xl font-bold">Seed Controls</h3>
            <p className="mt-2 text-sm text-slate-400">Each action is idempotent. Run individual bundles when you want a narrower refresh instead of reseeding everything.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {SEED_ACTIONS.map((action) => (
              <div key={action.target} className="rounded-[1.5rem] border border-slate-700 bg-slate-900 p-5">
                <h4 className="text-lg font-bold text-white">{action.title}</h4>
                <p className="mt-2 min-h-16 text-sm text-slate-400">{action.description}</p>
                <button
                  type="button"
                  disabled={runningAction !== null}
                  onClick={() => runSeed(action.target)}
                  className="mt-5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-300 transition hover:border-blue-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {runningAction === `seed:${action.target}` ? 'Running...' : action.title}
                </button>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-rose-500/30 bg-rose-500/10 p-6 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">Danger Zone</p>
            <h3 className="mt-3 text-2xl font-bold text-white">Delete All Data</h3>
            <p className="mt-3 text-sm text-slate-300">
              Truncates the application tables, including users, shifts, notifications, swaps, audit logs, and scheduling settings.
            </p>
            <button
              type="button"
              disabled={runningAction !== null}
              onClick={() => setShowResetModal(true)}
              className="mt-5 w-full rounded-xl border border-rose-500/30 bg-rose-500/20 px-4 py-3 text-sm font-bold text-rose-200 transition hover:border-rose-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {runningAction === 'reset' ? 'Deleting...' : 'Delete All Data'}
            </button>
          </div>

          <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 p-6 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Useful Flow</p>
            <ol className="mt-4 space-y-3 text-sm text-slate-300">
              <li>1. Delete all data when you want a totally clean review environment.</li>
              <li>2. Run Seed Users Only to restore login accounts and availability.</li>
              <li>3. Run Seed Shifts when you want schedule scenarios without redoing everything else.</li>
              <li>4. Run Seed All Demo Data when you want the full assessment demo state back.</li>
            </ol>
          </div>

          <div className="rounded-[2rem] border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">Live Progress</p>
                <h3 className="mt-2 text-xl font-bold text-white">Operations Feed</h3>
              </div>
              {progressLog.length > 0 && (
                <button
                  type="button"
                  onClick={() => setProgressLog([])}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-300 transition hover:border-slate-600 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="custom-scrollbar mt-4 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
              {progressLog.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950 p-4 text-sm text-slate-500">
                  Reset and seed progress updates will appear here.
                </div>
              )}
              {progressLog.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        {entry.scope} • {entry.target}
                      </p>
                      <p className="mt-2 text-sm text-white">{entry.message}</p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                        entry.status === 'completed'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : entry.status === 'failed'
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                            : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </div>
                  {entry.counts && Object.keys(entry.counts).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(entry.counts).map(([key, value]) => (
                        <span
                          key={key}
                          className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-300"
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-slate-500">
                    {new Date(entry.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {showResetModal && (
        <ModalShell
          title="Delete All Data"
          subtitle="This will wipe the application data tables. Admin access is preserved, but demo users, shifts, notifications, swaps, audit logs, and settings will be cleared."
          onClose={() => {
            if (runningAction === 'reset') return;
            setShowResetModal(false);
          }}
          maxWidthClass="max-w-lg"
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">
                Destructive Action
              </p>
              <p className="mt-2 text-sm text-white">
                Use this only when you intentionally want a clean environment. The fastest recovery path after reset is usually `Seed All Demo Data`.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={runningAction === 'reset'}
                onClick={() => setShowResetModal(false)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={runningAction === 'reset'}
                onClick={resetDatabase}
                className="rounded-xl border border-rose-500/30 bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
              >
                {runningAction === 'reset' ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
