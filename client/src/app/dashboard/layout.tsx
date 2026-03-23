"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import NotificationCenter from '../../components/layout/NotificationCenter';

type SessionUser = {
  id: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
};

type NavItem = {
  href: string;
  label: string;
  description: string;
};

function buildNav(role: SessionUser['role']): NavItem[] {
  const overviewOnly: NavItem[] = [{ href: '/dashboard', label: 'Overview', description: 'Role dashboard and alerts' }];
  const managementBase: NavItem[] = [
    { href: '/dashboard', label: 'Overview', description: 'Role dashboard and alerts' },
    { href: '/dashboard/schedules', label: 'Schedules', description: 'Build, assign, and publish shifts' },
  ];

  if (role === 'STAFF') {
    return overviewOnly;
  }

  if (role === 'MANAGER') {
    return [
      ...managementBase,
      { href: '/dashboard/users', label: 'Users', description: 'Staff roster, skills, and certifications' },
    ];
  }

  if (role === 'ADMIN') {
    return [
      ...managementBase,
      { href: '/dashboard/users', label: 'Users', description: 'Managers, staff, and location coverage' },
      { href: '/dashboard/operations', label: 'Operations', description: 'Admin data reset and seed controls' },
    ];
  }

  return overviewOnly;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const rawUser = window.localStorage.getItem('shiftSync_user');
    if (!rawUser) {
      router.replace('/');
      return;
    }

    setUser(JSON.parse(rawUser) as SessionUser);
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    const socket = io(apiUrl);

    socket.on('session_invalidated', (payload: { preservedUserIds?: string[] }) => {
      const preserved = payload?.preservedUserIds || [];
      const invalidated = (payload as { invalidatedUserIds?: string[] })?.invalidatedUserIds || [];
      if (invalidated.length > 0 && !invalidated.includes(user.id)) return;
      if (preserved.includes(user.id)) return;
      window.localStorage.removeItem('shiftSync_user');
      router.replace('/');
    });

    return () => {
      socket.disconnect();
    };
  }, [router, user]);

  const navItems = useMemo(() => (user ? buildNav(user.role) : []), [user]);

  function handleSignOut() {
    window.localStorage.removeItem('shiftSync_user');
    router.replace('/');
  }

  const currentSection =
    navItems.find((item) => item.href === pathname)?.label ||
    (pathname === '/dashboard/schedules'
      ? 'Schedules'
      : pathname === '/dashboard/users'
        ? 'Users'
        : pathname === '/dashboard/operations'
          ? 'Operations'
          : 'Overview');

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-800 bg-slate-900/95 lg:flex lg:flex-col">
          <div className="border-b border-slate-800 px-6 py-6">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Coastal Eats</p>
            <h1 className="mt-2 bg-gradient-to-r from-blue-300 via-cyan-300 to-emerald-300 bg-clip-text text-3xl font-black tracking-tight text-transparent">
              ShiftSync
            </h1>
            <p className="mt-3 text-sm text-slate-400">Multi-location scheduling, compliance, notifications, and audit controls.</p>
          </div>

          <nav className="flex-1 space-y-2 px-4 py-6">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={`block rounded-2xl border px-4 py-3 transition ${
                    active
                      ? 'border-cyan-500/30 bg-cyan-500/10 text-white'
                      : 'border-transparent bg-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-slate-800 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-600 bg-slate-800 font-bold text-white">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{user.name}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">{user.role}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300 transition hover:border-red-400/40 hover:text-white"
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="flex min-h-screen flex-1 flex-col lg:ml-72">
          <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Workspace</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{currentSection}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <NotificationCenter user={user} />
                  <button
                    onClick={handleSignOut}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300 transition hover:border-red-400/40 hover:text-white lg:hidden"
                  >
                    Logout
                  </button>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto lg:hidden">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={`${item.href}-${item.label}-mobile`}
                      href={item.href}
                      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? 'border-cyan-500/30 bg-cyan-500/10 text-white'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">{children}</div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className={`mx-auto grid max-w-3xl gap-2 ${navItems.length >= 3 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {navItems.slice(0, 3).map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={`${item.href}-${item.label}-bottom`}
                href={item.href}
                className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold transition ${
                  active ? 'bg-cyan-500/10 text-white' : 'bg-slate-900 text-slate-400'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={handleSignOut}
            className="rounded-2xl bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-300"
          >
            Logout
          </button>
        </div>
      </nav>
    </div>
  );
}
