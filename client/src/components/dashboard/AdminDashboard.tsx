"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { exportAuditLogsCsv, fetchAuditLogs } from '../../lib/auditApi';
import { AuditLogRecord } from '../../lib/auditTypes';
import { exportMockAuditLogsCsv, getMockAuditLogs } from '../../lib/mockAuditLogs';
import { Shift } from '../../lib/mockData';
import ScheduleCalendar from '../calendar/ScheduleCalendar';
import { getShiftTiming } from '../../lib/calendarTime';
import { groupShiftCoverage } from '../../lib/shiftCoverage';

type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  locations?: Array<{ id: string; name: string; timezone: string }>;
};

type LocationSummary = {
  id: string;
  name: string;
  timezone: string;
};

export default function AdminDashboard({ user }: { user: UserSummary }) {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [usingMockAudit, setUsingMockAudit] = useState(false);
  const [viewerTimeZone, setViewerTimeZone] = useState('UTC');
  const [fairnessScore, setFairnessScore] = useState<number | null>(null);

  useEffect(() => {
    setViewerTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    Promise.all([
      fetch(`${API_URL}/users`).then((response) => response.json()),
      fetch(`${API_URL}/locations`).then((response) => response.json()),
      fetch(`${API_URL}/shifts`).then((response) => response.json()),
    ]).then(([usersData, locationsData, shiftsData]) => {
      setUsers(usersData);
      setLocations(locationsData);
      setShifts(shiftsData);
      if (locationsData.length > 0) setSelectedLocationId(locationsData[0].id);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAudit() {
      setLoadingAudit(true);
      try {
        const logs = await fetchAuditLogs({
          locationId: selectedLocationId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        if (!cancelled) {
          setAuditLogs(logs);
          setUsingMockAudit(false);
        }
      } catch {
        if (!cancelled) {
          setAuditLogs(
            getMockAuditLogs({
              locationId: selectedLocationId || undefined,
              startDate: startDate || undefined,
              endDate: endDate || undefined,
            }),
          );
          setUsingMockAudit(true);
        }
      } finally {
        if (!cancelled) setLoadingAudit(false);
      }
    }

    loadAudit();
    return () => {
      cancelled = true;
    };
  }, [selectedLocationId, startDate, endDate]);

  useEffect(() => {
    const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    const query = selectedLocationId ? `?locationId=${selectedLocationId}` : '';
    fetch(`${API_URL}/analytics/fairness${query}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setFairnessScore(data?.overallScore ?? null))
      .catch(() => setFairnessScore(null));
  }, [selectedLocationId]);

  const displayedLocationName = useMemo(
    () => locations.find((location) => location.id === selectedLocationId)?.name || 'All locations',
    [locations, selectedLocationId],
  );
  const calendarShifts = useMemo(
    () => (selectedLocationId ? shifts.filter((shift) => shift.location?.id === selectedLocationId) : shifts),
    [selectedLocationId, shifts],
  );
  const displayedLocationTimeZone = useMemo(
    () => locations.find((location) => location.id === selectedLocationId)?.timezone,
    [locations, selectedLocationId],
  );
  const coverageGroups = useMemo(() => groupShiftCoverage(calendarShifts, viewerTimeZone), [calendarShifts, viewerTimeZone]);
  const projectedOvertimeCost = useMemo(() => {
    const byStaff = new Map<string, number>();
    for (const shift of calendarShifts) {
      if (!shift.assignedStaff?.id) continue;
      byStaff.set(shift.assignedStaff.id, (byStaff.get(shift.assignedStaff.id) || 0) + getShiftTiming(shift, viewerTimeZone).durationHours);
    }
    return [...byStaff.values()].reduce((total, hours) => total + Math.max(0, hours - 40) * 25.5 * 1.5, 0);
  }, [calendarShifts, viewerTimeZone]);

  async function handleExport() {
    const filters = {
      locationId: selectedLocationId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    let content = '';
    try {
      content = await exportAuditLogsCsv(filters);
      setUsingMockAudit(false);
    } catch {
      content = exportMockAuditLogsCsv(filters);
      setUsingMockAudit(true);
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-export-${selectedLocationId || 'all'}-${startDate || 'start'}-${endDate || 'end'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Projected OT Cost</p>
            <p className="mt-3 text-3xl font-black text-white">${projectedOvertimeCost.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Fairness Score</p>
            <p className="mt-3 text-3xl font-black text-white">{fairnessScore ?? '--'}{fairnessScore !== null ? '%' : ''}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">Understaffed</p>
            <p className="mt-3 text-3xl font-black text-white">{coverageGroups.filter((group) => group.status === 'understaffed').length}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Overstaffed</p>
            <p className="mt-3 text-3xl font-black text-white">{coverageGroups.filter((group) => group.status === 'overstaffed').length}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 shadow-lg">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">No Coverage</p>
            <p className="mt-3 text-3xl font-black text-white">{coverageGroups.filter((group) => group.status === 'no_coverage').length}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">Audit Export Console</h3>
              <p className="mt-1 text-sm text-slate-400">
                {usingMockAudit ? 'Mock audit data active' : 'Live audit data active'}
              </p>
            </div>
            <button
              onClick={handleExport}
              className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-300 transition hover:border-cyan-400 hover:text-white"
            >
              Export CSV
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Location</label>
              <select
                value={selectedLocationId}
                onChange={(event) => setSelectedLocationId(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white"
              >
                <option value="">All locations</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
          <ScheduleCalendar
            shifts={calendarShifts}
            viewerTimeZone={viewerTimeZone}
            title="Operations Calendar"
            subtitle="Google Calendar-style overview of upcoming scheduled work across the selected scope."
            emptyLabel="No scheduled shifts exist for the current filter."
            locationTimeZoneLabel={displayedLocationTimeZone ? `${displayedLocationName} • ${displayedLocationTimeZone}` : undefined}
            layout="stacked"
          />
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">Audit Timeline</h3>
              <p className="mt-1 text-sm text-slate-400">{displayedLocationName}</p>
            </div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-400">
              {auditLogs.length} events
            </span>
          </div>

          {loadingAudit && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-500">
              Loading audit events...
            </div>
          )}

          {!loadingAudit && auditLogs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-500">
              No audit events match the current filter.
            </div>
          )}

          {!loadingAudit && auditLogs.length > 0 && (
            <div className="space-y-4">
              {auditLogs.map((entry) => (
                <div key={entry.id} className="rounded-[1.5rem] border border-slate-700 bg-slate-950 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">{entry.action.replaceAll('_', ' ')}</p>
                      <p className="mt-2 text-base font-semibold text-white">{entry.summary}</p>
                      <p className="mt-1 text-xs text-slate-400">{entry.locationName} • {entry.actorName} ({entry.actorRole})</p>
                    </div>
                    <p className="text-xs font-mono text-slate-500">{new Date(entry.occurredAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
          <h3 className="mb-4 text-xl font-bold text-white">Global Staff Directory</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-900">
                <tr>
                  <th className="rounded-tl-lg p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">User</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Role</th>
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Primary Location</th>
                  <th className="rounded-tr-lg p-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Admin View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.map((entry) => (
                  <tr key={entry.id} className="group transition-colors hover:bg-slate-700/20">
                    <td className="p-4">
                      <p className="font-bold text-white transition-colors group-hover:text-cyan-300">{entry.name}</p>
                      <p className="text-xs text-slate-400">{entry.email}</p>
                    </td>
                    <td className="p-4">
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        entry.role === 'ADMIN'
                          ? 'border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300'
                          : entry.role === 'MANAGER'
                            ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                            : 'border-slate-600 bg-slate-700/50 text-slate-300'
                      }`}>
                        {entry.role}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300">
                      {entry.locations?.[0]?.name || <span className="text-xs italic text-slate-500">-</span>}
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      Acting as {user.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
        <h3 className="mb-4 text-xl font-bold text-white">Active Properties</h3>
        <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Org Structure</h4>
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex justify-center">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Restaurant Group</p>
                <p className="mt-1 font-bold text-white">Coastal Eats</p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {locations.map((location) => {
                const managersForLocation = users.filter((entry) => entry.role === 'MANAGER' && entry.locations?.some((managedLocation) => managedLocation.id === location.id));
                const staffForLocation = users.filter((entry) => entry.role === 'STAFF' && entry.locations?.some((staffLocation) => staffLocation.id === location.id));

                return (
                  <div key={`org-${location.id}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">Location</p>
                      <p className="mt-1 font-semibold text-white">{location.name}</p>
                    </div>
                    <div className="mt-4 grid gap-4">
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Managers</p>
                        <div className="flex flex-wrap gap-2">
                          {managersForLocation.map((manager) => (
                            <span key={manager.id} className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">{manager.name}</span>
                          ))}
                          {managersForLocation.length === 0 && <span className="text-xs text-slate-500">No manager assigned</span>}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Staff</p>
                        <div className="flex flex-wrap gap-2">
                          {staffForLocation.map((staffMember) => (
                            <span key={staffMember.id} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">{staffMember.name}</span>
                          ))}
                          {staffForLocation.length === 0 && <span className="text-xs text-slate-500">No staff assigned</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <ul className="space-y-4">
          {locations.map((location) => (
            <li key={location.id} className="group flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 p-4 transition-colors hover:border-slate-500">
              <div>
                <p className="text-sm font-bold text-white transition-colors group-hover:text-cyan-300">{location.name}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">{location.timezone}</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              </div>
            </li>
          ))}
          {locations.length === 0 && <p className="italic text-slate-500">No locations configured.</p>}
        </ul>
      </div>
    </div>
  );
}
