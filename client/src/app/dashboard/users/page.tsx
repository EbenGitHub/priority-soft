"use client";

import React, { useEffect, useMemo, useState } from 'react';

type DashboardUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  isActive?: boolean;
  desiredHours?: number;
  locations?: Array<{ id: string; name: string; timezone: string }>;
  skills?: Array<{ id: string; name: string }>;
  availabilities?: Array<{
    id: string;
    type: 'RECURRING' | 'EXCEPTION';
    dayOfWeek?: number;
    date?: string;
    timezone?: string;
    startTime: string;
    endTime: string;
  }>;
};

type SessionUser = {
  id: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  locations?: Array<{ id: string; name: string; timezone: string }>;
};

type LocationSummary = {
  id: string;
  name: string;
  timezone: string;
};

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function UsersPage() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [locationSelections, setLocationSelections] = useState<Record<string, string[]>>({});
  const [staffLocationSelections, setStaffLocationSelections] = useState<Record<string, string[]>>({});
  const [staffSkillSelections, setStaffSkillSelections] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const rawUser = window.localStorage.getItem('shiftSync_user');
    if (rawUser) {
      setSessionUser(JSON.parse(rawUser) as SessionUser);
    }
  }, []);

  useEffect(() => {
    if (!sessionUser) return;
    const currentUser = sessionUser;

    async function loadData() {
      setLoading(true);
      try {
        const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
        const [usersRes, locationsRes] = await Promise.all([
          fetch(`${API_URL}/users?actorId=${encodeURIComponent(currentUser.id)}`),
          fetch(`${API_URL}/locations?actorId=${encodeURIComponent(currentUser.id)}`),
        ]);

        const usersData = (await usersRes.json()) as DashboardUser[];
        const locationsData = (await locationsRes.json()) as LocationSummary[];

        setUsers(usersData);
        setLocations(locationsData);
        setLocationSelections(
          Object.fromEntries(
            usersData
              .filter((user) => user.role === 'MANAGER')
              .map((user) => [user.id, (user.locations || []).map((location) => location.id)]),
          ),
        );
        setStaffLocationSelections(
          Object.fromEntries(
            usersData
              .filter((user) => user.role === 'STAFF')
              .map((user) => [user.id, (user.locations || []).map((location) => location.id)]),
          ),
        );
        setStaffSkillSelections(
          Object.fromEntries(
            usersData
              .filter((user) => user.role === 'STAFF')
              .map((user) => [user.id, (user.skills || []).map((skill) => skill.id)]),
          ),
        );

        const defaultLocation =
          currentUser.role === 'MANAGER'
            ? currentUser.locations?.[0]?.id || ''
            : locationsData[0]?.id || '';
        setSelectedLocationId((current) => current || defaultLocation);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [sessionUser]);

  const allowedLocationIds = useMemo(
    () => new Set(sessionUser?.role === 'MANAGER' ? sessionUser.locations?.map((location) => location.id) || [] : locations.map((location) => location.id)),
    [locations, sessionUser],
  );

  const visibleUsers = useMemo(() => {
    if (!sessionUser) return [];

    if (sessionUser.role === 'ADMIN') {
      if (!selectedLocationId) return users;
      return users.filter((user) => user.locations?.some((location) => location.id === selectedLocationId));
    }

    return users.filter((user) => user.locations?.some((location) => allowedLocationIds.has(location.id)));
  }, [allowedLocationIds, selectedLocationId, sessionUser, users]);

  const staffUsers = visibleUsers.filter((user) => user.role === 'STAFF');
  const managerUsers = visibleUsers.filter((user) => user.role === 'MANAGER');

  async function adminUpdateUser(userId: string, payload: Partial<Pick<DashboardUser, 'desiredHours' | 'isActive'>> & { locationIds?: string[]; skillIds?: string[] }) {
    if (!sessionUser) return;
    setSavingUserId(userId);
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/users/${userId}/admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorId: sessionUser.id,
          ...payload,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || 'Unable to update user.');
      setUsers((current) => current.map((user) => (user.id === userId ? { ...user, ...body } : user)));
    } catch (error: any) {
      console.error(error);
    } finally {
      setSavingUserId(null);
    }
  }

  const staffBySkill = useMemo(() => {
    const counts = new Map<string, number>();
    for (const staffMember of staffUsers) {
      for (const skill of staffMember.skills || []) {
        counts.set(skill.name, (counts.get(skill.name) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [staffUsers]);

  const allSkills = useMemo(() => {
    const skillMap = new Map<string, { id: string; name: string }>();
    for (const appUser of users) {
      for (const skill of appUser.skills || []) {
        skillMap.set(skill.id, skill);
      }
    }
    return [...skillMap.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [users]);

  const managerScopedLocations = useMemo(() => {
    if (sessionUser?.role === 'MANAGER') {
      const allowed = new Set(sessionUser.locations?.map((location) => location.id) || []);
      return locations.filter((location) => allowed.has(location.id));
    }
    return locations;
  }, [locations, sessionUser]);

  if (sessionUser && sessionUser.role === 'STAFF') {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up space-y-8 text-white">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight">Users</h2>
          <p className="mt-2 text-lg text-slate-400">
            {sessionUser?.role === 'ADMIN'
              ? 'Review staff and manager coverage across locations.'
              : 'Review staff qualifications, certifications, and availability across your locations.'}
          </p>
        </div>
        {sessionUser?.role === 'ADMIN' && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Filter by Location</label>
            <select
              value={selectedLocationId}
              onChange={(event) => setSelectedLocationId(event.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white"
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-[1.75rem] border border-slate-700 bg-slate-800 p-6 shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Visible Staff</p>
          <p className="mt-3 text-4xl font-black text-white">{staffUsers.length}</p>
        </div>
        <div className="rounded-[1.75rem] border border-slate-700 bg-slate-800 p-6 shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Visible Managers</p>
          <p className="mt-3 text-4xl font-black text-white">{managerUsers.length}</p>
        </div>
        <div className="rounded-[1.75rem] border border-slate-700 bg-slate-800 p-6 shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Skills Covered</p>
          <p className="mt-3 text-4xl font-black text-white">{staffBySkill.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <a href="#staff-directory" className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:border-cyan-400/40 hover:text-white">
          Staff Directory
        </a>
        {sessionUser?.role === 'ADMIN' && (
          <a href="#manager-directory" className="rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:border-amber-400/40 hover:text-white">
            Manager Directory
          </a>
        )}
      </div>

      <div id="staff-directory" className="rounded-[2rem] border border-slate-700 bg-slate-800 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold">Staff Directory</h3>
            <p className="mt-1 text-sm text-slate-400">Skills, certifications, target hours, and availability summaries.</p>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-400">{staffUsers.length} staff</span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-500">Loading users...</div>
        ) : staffUsers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-500">No staff members match the current scope.</div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {staffUsers.map((staffMember) => (
              <div key={staffMember.id} className="rounded-[1.5rem] border border-slate-700 bg-slate-950 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-bold text-white">{staffMember.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{staffMember.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${staffMember.isActive === false ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>
                      {staffMember.isActive === false ? 'Disabled' : 'Active'}
                    </span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                      {staffMember.desiredHours || 0}h target
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {(staffMember.skills || []).map((skill) => (
                        <span key={skill.id} className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-300">
                          {skill.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Certified Locations</p>
                    <div className="space-y-2">
                      {(staffMember.locations || []).map((location) => (
                        <div key={location.id} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                          <p className="text-sm font-semibold text-white">{location.name}</p>
                          <p className="text-[11px] font-mono text-slate-500">{location.timezone}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Availability</p>
                  <div className="space-y-2">
                    {(staffMember.availabilities || []).slice(0, 4).map((availability) => (
                      <div key={availability.id} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                        <span className="font-semibold text-white">
                          {availability.type === 'RECURRING'
                            ? `${weekdayLabels[availability.dayOfWeek || 0]} recurring`
                            : availability.date}
                        </span>
                        <span className="mx-2 text-slate-500">•</span>
                        <span>{availability.startTime.slice(0, 5)} - {availability.endTime.slice(0, 5)}</span>
                        {availability.timezone && <span className="ml-2 text-[11px] font-mono text-slate-500">{availability.timezone}</span>}
                      </div>
                    ))}
                    {(staffMember.availabilities || []).length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-500">No availability records.</div>
                    )}
                  </div>
                </div>
                {(sessionUser?.role === 'ADMIN' || sessionUser?.role === 'MANAGER') && (
                  <div className="mt-5 border-t border-slate-800 pt-5 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Edit Certified Locations</p>
                        <div className="space-y-2">
                          {managerScopedLocations.map((location) => {
                            const checked = (staffLocationSelections[staffMember.id] || []).includes(location.id);
                            return (
                              <label key={location.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => {
                                    setStaffLocationSelections((current) => {
                                      const next = new Set(current[staffMember.id] || []);
                                      if (event.target.checked) next.add(location.id);
                                      else next.delete(location.id);
                                      return { ...current, [staffMember.id]: [...next] };
                                    });
                                  }}
                                />
                                <span>{location.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Edit Skills</p>
                        <div className="space-y-2">
                          {allSkills.map((skill) => {
                            const checked = (staffSkillSelections[staffMember.id] || []).includes(skill.id);
                            return (
                              <label key={skill.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => {
                                    setStaffSkillSelections((current) => {
                                      const next = new Set(current[staffMember.id] || []);
                                      if (event.target.checked) next.add(skill.id);
                                      else next.delete(skill.id);
                                      return { ...current, [staffMember.id]: [...next] };
                                    });
                                  }}
                                />
                                <span>{skill.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={savingUserId === staffMember.id}
                      onClick={() =>
                        adminUpdateUser(staffMember.id, {
                          locationIds: staffLocationSelections[staffMember.id] || [],
                          skillIds: staffSkillSelections[staffMember.id] || [],
                        })
                      }
                      className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-300 transition hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingUserId === staffMember.id ? 'Saving...' : 'Save Certifications And Skills'}
                    </button>
                  </div>
                )}
                {sessionUser?.role === 'ADMIN' && (
                  <div className="mt-5 border-t border-slate-800 pt-5">
                    <button
                      type="button"
                      disabled={savingUserId === staffMember.id}
                      onClick={() => adminUpdateUser(staffMember.id, { isActive: !(staffMember.isActive !== false) })}
                      className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${staffMember.isActive === false ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400 hover:text-white' : 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:border-rose-400 hover:text-white'}`}
                    >
                      {savingUserId === staffMember.id ? 'Saving...' : staffMember.isActive === false ? 'Enable User' : 'Disable User'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {sessionUser?.role === 'ADMIN' && (
        <div id="manager-directory" className="rounded-[2rem] border border-slate-700 bg-slate-800 p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold">Manager Directory</h3>
              <p className="mt-1 text-sm text-slate-400">Managers, assigned restaurants, and coverage scope.</p>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-400">{managerUsers.length} managers</span>
          </div>

          {managerUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-500">No managers found for this scope.</div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {managerUsers.map((manager) => {
                const managedLocations = manager.locations || [];
                const coveredStaffCount = users.filter(
                  (user) => user.role === 'STAFF' && user.locations?.some((location) => managedLocations.some((managedLocation) => managedLocation.id === location.id)),
                ).length;

                return (
                  <div key={manager.id} className="rounded-[1.5rem] border border-slate-700 bg-slate-950 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xl font-bold text-white">{manager.name}</p>
                        <p className="mt-1 text-sm text-slate-400">{manager.email}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${manager.isActive === false ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>
                          {manager.isActive === false ? 'Disabled' : 'Active'}
                        </span>
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
                          {coveredStaffCount} staff in scope
                        </span>
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Managed Restaurants</p>
                      <div className="space-y-3">
                        {locations.map((location) => {
                          const selected = (locationSelections[manager.id] || []).includes(location.id);
                          return (
                            <label key={location.id} className={`flex items-start gap-3 rounded-xl border p-4 ${selected ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-slate-800 bg-slate-900'}`}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) => {
                                  setLocationSelections((current) => {
                                    const existing = current[manager.id] || [];
                                    const next = event.target.checked
                                      ? [...existing, location.id]
                                      : existing.filter((id) => id !== location.id);
                                    return { ...current, [manager.id]: next };
                                  });
                                }}
                                className="mt-1"
                              />
                              <div>
                                <p className="text-sm font-semibold text-white">{location.name}</p>
                                <p className="mt-1 text-[11px] font-mono text-slate-500">{location.timezone}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-800 pt-5">
                      <button
                        type="button"
                        disabled={savingUserId === manager.id}
                        onClick={() => adminUpdateUser(manager.id, { locationIds: locationSelections[manager.id] || [] })}
                        className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-300 transition hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingUserId === manager.id ? 'Saving...' : 'Save Managed Locations'}
                      </button>
                      <button
                        type="button"
                        disabled={savingUserId === manager.id}
                        onClick={() => adminUpdateUser(manager.id, { isActive: !(manager.isActive !== false) })}
                        className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${manager.isActive === false ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400 hover:text-white' : 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:border-rose-400 hover:text-white'}`}
                      >
                        {savingUserId === manager.id ? 'Saving...' : manager.isActive === false ? 'Enable Manager' : 'Disable Manager'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
