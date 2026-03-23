"use client";

import React, { useState, useEffect } from 'react';
import { Location, Skill, Shift, Staff } from '../../../lib/mockData';
import { validateAssignment, ValidationResult } from '../../../lib/schedulingRules';
import { FairnessAnalytics } from '../../../lib/fairnessMetrics';
import { useRealtime } from '../../../lib/useRealtime';
import { fetchCalendarShifts } from '../../../lib/calendarApi';
import { buildShiftUtcRange } from '../../../lib/calendarTime';
import { fetchShiftAuditLogs } from '../../../lib/auditApi';
import { AuditLogRecord } from '../../../lib/auditTypes';
import { getMockAuditLogsForShift } from '../../../lib/mockAuditLogs';
import { fetchSchedulingSettings, updateSchedulingSettings } from '../../../lib/settingsApi';
import ScheduleCalendar from '../../../components/calendar/ScheduleCalendar';
import ReasonModal from '../../../components/ui/ReasonModal';
import SchedulingHeader from '../../../components/schedules/SchedulingHeader';
import SchedulingInsights from '../../../components/schedules/SchedulingInsights';
import LocationWeekControls from '../../../components/schedules/LocationWeekControls';
import ScheduleLifecyclePanel from '../../../components/schedules/ScheduleLifecyclePanel';
import CoverageHealthSection from '../../../components/schedules/CoverageHealthSection';
import ShiftBoard from '../../../components/schedules/ShiftBoard';
import ShiftAssignmentModal from '../../../components/schedules/ShiftAssignmentModal';
import ShiftEditorModal from '../../../components/schedules/ShiftEditorModal';
import ShiftAuditModal from '../../../components/schedules/ShiftAuditModal';
import { toast } from 'sonner';
import { getShiftCoverageGroupId, groupShiftCoverage } from '../../../lib/shiftCoverage';
import { useViewerTimeZone } from '../../../hooks/useViewerTimeZone';
import { useShiftEditor } from '../../../hooks/useShiftEditor';
import {
  AssignmentConflictClassification,
  OverrideRequest,
  SchedulingActor,
} from '../../../components/schedules/types';

export default function SchedulingPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [assignModalShift, setAssignModalShift] = useState<Shift | null>(null);
  const [historyShift, setHistoryShift] = useState<Shift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<AuditLogRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedWeekStart, setSelectedWeekStart] = useState('');
  const viewerTimeZone = useViewerTimeZone();
  const [actor, setActor] = useState<SchedulingActor>({});

  const [validationData, setValidationData] = useState<ValidationResult | null>(null);
  const [fairnessData, setFairnessData] = useState<FairnessAnalytics | null>(null);
  const [creatingShift, setCreatingShift] = useState(false);
  const [assigningOperationKeys, setAssigningOperationKeys] = useState<string[]>([]);
  const [removingShiftId, setRemovingShiftId] = useState<string | null>(null);
  const [publishingShiftId, setPublishingShiftId] = useState<string | null>(null);
  const [publishingWeek, setPublishingWeek] = useState<null | 'publish' | 'unpublish'>(null);
  const [cutoffHours, setCutoffHours] = useState(48);
  const [cutoffInput, setCutoffInput] = useState('48');
  const [savingCutoff, setSavingCutoff] = useState(false);
  const [overrideRequest, setOverrideRequest] = useState<OverrideRequest | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [cutoffOverrideRequest, setCutoffOverrideRequest] = useState<null | {
    action: 'edit' | 'unassign';
    shift: Shift;
    message: string;
  }>(null);
  const [cutoffOverrideReason, setCutoffOverrideReason] = useState('');
  const [highlightedCoverageGroupId, setHighlightedCoverageGroupId] = useState<string | null>(null);

  const availableLocations =
    actor.actorRole === 'MANAGER' && actor.locationIds && actor.locationIds.length > 0
      ? locations.filter((location) => actor.locationIds?.includes(location.id))
      : locations;
  const activeLocation = availableLocations.find((location) => location.id === selectedLocation) || null;
  const canManageSchedules = actor.actorRole === 'MANAGER' || actor.actorRole === 'ADMIN';

  const {
    showShiftModal,
    setShowShiftModal,
    editingShift,
    startDateTime,
    endDateTime,
    newShiftLocation,
    setNewShiftLocation,
    newShiftSkill,
    setNewShiftSkill,
    newShiftHeadcount,
    setNewShiftHeadcount,
    newShiftSkipManagerApproval,
    setNewShiftSkipManagerApproval,
    shiftPreview,
    activeDraftLocation,
    planningMinDate,
    shiftDateOrderInvalid,
    isOvernightDraft,
    setShiftBuilderStart,
    setShiftBuilderEnd,
    openCreateShiftModal,
    openEditShiftModal,
    resetShiftForm,
    getLocationTimedDraft,
  } = useShiftEditor({
    locations,
    skills,
    selectedLocation,
    selectedWeekStart,
    viewerTimeZone,
  });

  const classifyAssignmentConflict = (
    result: ValidationResult,
  ): AssignmentConflictClassification => {
    const reason = result.reason || '';
    if (reason.includes('Overlaps') || reason.includes('rest compliance')) {
      return { kind: 'occupied', label: 'Occupied', tone: 'rose' as const };
    }
    if (reason.includes('availability')) {
      return { kind: 'availability', label: 'Unavailable', tone: 'amber' as const };
    }
    if (reason.includes('12 active hours') || reason.includes('Labor Law')) {
      return { kind: 'compliance', label: 'Compliance Risk', tone: 'amber' as const };
    }
    if (reason.includes('certified to work at this location')) {
      return { kind: 'ineligible', label: 'Wrong Location', tone: 'slate' as const };
    }
    if (reason.includes('Missing required specialized skill')) {
      return { kind: 'ineligible', label: 'Missing Skill', tone: 'slate' as const };
    }
    return { kind: 'warning', label: 'Needs Review', tone: 'amber' as const };
  };

  const isWarnOnlyConflict = (result: ValidationResult) => {
    const conflict = classifyAssignmentConflict(result);
    return conflict.kind === 'occupied' || conflict.kind === 'availability';
  };

  const moveSelectedWeek = (direction: -1 | 1) => {
    if (!selectedWeekStart) return;
    const base = new Date(`${selectedWeekStart}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + direction * 7);
    setSelectedWeekStart(base.toISOString().split('T')[0]);
  };

  const fetchReferenceData = async () => {
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const [locRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/locations`),
        fetch(`${API_URL}/users`),
      ]);
      const lData = (await locRes.json()) as Location[];
      const uData = await usersRes.json();

      const allowedLocationIds =
        actor.actorRole === 'MANAGER' && actor.locationIds && actor.locationIds.length > 0
          ? new Set(actor.locationIds)
          : null;
      const visibleLocations = allowedLocationIds
        ? lData.filter((location: Location) => allowedLocationIds.has(location.id))
        : lData;

      setLocations(visibleLocations);
      if (visibleLocations.length > 0) {
        setSelectedLocation((current) =>
          current && visibleLocations.some((location: Location) => location.id === current)
            ? current
            : visibleLocations[0].id,
        );
      }

      const allStaff = uData.filter((u: any) => u.role === 'STAFF');
      setStaffList(allStaff);

      const uniqueSkills = new Map();
      allStaff.forEach((staff: any) => {
        staff.skills?.forEach((skill: any) => uniqueSkills.set(skill.id, skill));
      });
      const skillsArr = Array.from(uniqueSkills.values()) as Skill[];
      setSkills(skillsArr);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!historyShift) return;
    const shiftId = historyShift.id;

    let cancelled = false;
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const logs = await fetchShiftAuditLogs(shiftId);
        if (!cancelled) setShiftHistory(logs);
      } catch {
        if (!cancelled) setShiftHistory(getMockAuditLogsForShift(shiftId));
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [historyShift]);
  
  // Phase 7: Real-Time Sync Hook mapping to local re-renders
  const { isConnected, lastSync } = useRealtime(() => {
     // Re-triggering data arrays logically to simulate push mutations and progress clocks.
     fetchShifts();
     fetchFairness();
     fetchReferenceData();
  });

  useEffect(() => {
    const today = new Date();
    const dayOffset = (today.getUTCDay() + 6) % 7;
    today.setUTCDate(today.getUTCDate() - dayOffset);
    setSelectedWeekStart(today.toISOString().split('T')[0]);
    const rawUser = window.localStorage.getItem('shiftSync_user');
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser) as { id: string; name: string; role: string; locations?: Array<{ id: string }> };
      setActor({
        actorId: parsedUser.id,
        actorName: parsedUser.name,
        actorRole: parsedUser.role,
        locationIds: Array.isArray(parsedUser.locations) ? parsedUser.locations.map((location) => location.id) : [],
      });
    }
  }, []);

  useEffect(() => {
    fetchReferenceData();
  }, [actor.actorRole, actor.locationIds]);

  useEffect(() => {
    if (availableLocations.length === 0) return;
    if (!selectedLocation || !availableLocations.some((location) => location.id === selectedLocation)) {
      setSelectedLocation(availableLocations[0].id);
    }
  }, [availableLocations, selectedLocation]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await fetchSchedulingSettings();
        setCutoffHours(settings.cutoffHours);
        setCutoffInput(String(settings.cutoffHours));
      } catch {
        setCutoffHours(48);
        setCutoffInput('48');
      }
    }

    loadSettings();
  }, []);

  const fetchShifts = async () => {
    try {
      const calendarShifts = await fetchCalendarShifts({ viewerTimeZone });
      setShifts(calendarShifts);
    } catch(err) {
      try {
        const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
        const res = await fetch(`${API_URL}/shifts`);
        if (res.ok) {
          const rawShifts = (await res.json()) as Shift[];
          setShifts(
            rawShifts.map((shift) => {
              const derived = buildShiftUtcRange(
                shift.date,
                shift.startTime,
                shift.endTime,
                shift.location?.timezone || 'UTC',
                shift.endDate,
              );
              return {
                ...shift,
                startUtc: derived.startUtc.toISOString(),
                endUtc: derived.endUtc.toISOString(),
                isOvernight: derived.isOvernight,
              };
            }),
          );
        }
      } catch (fallbackError) {
        console.error(fallbackError);
      }
    }
  };

  const fetchFairness = async () => {
    if (!selectedLocation) return;
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/analytics/fairness?locationId=${selectedLocation}`);
      if (res.ok) setFairnessData(await res.json());
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchShifts();
    fetchFairness();
  }, [selectedLocation, viewerTimeZone]);

  const locShifts = shifts.filter(s => s.location?.id === selectedLocation);
  const coverageGroups = groupShiftCoverage(locShifts, viewerTimeZone);
  const activeAssignmentCoverageGroup = assignModalShift
    ? coverageGroups.find((group) => group.id === getShiftCoverageGroupId(assignModalShift))
    : null;
  const displayCalendarShifts = coverageGroups.map((group) => group.shifts[0]);

  const getAssignmentKey = (shiftId: string, staffId: string) => `assign:${shiftId}:${staffId}`;
  const getUnassignKey = (shiftId: string) => `unassign:${shiftId}`;

  const upsertAssignmentModalGroup = (nextShifts: Shift[], sourceShift: Shift) => {
    const groupId = getShiftCoverageGroupId(sourceShift);
    const updatedGroup = groupShiftCoverage(
      nextShifts.filter((shift) => shift.location?.id === sourceShift.location?.id),
      viewerTimeZone,
    ).find((group) => group.id === groupId);

    if (!updatedGroup) {
      setAssignModalShift(null);
      return;
    }

    const nextOpenShift = updatedGroup.shifts.find((shift) => !shift.assignedStaff);
    setAssignModalShift(nextOpenShift || updatedGroup.shifts[0] || null);
  };

  const focusCoverageGroup = (groupId: string) => {
    setHighlightedCoverageGroupId(groupId);
    const target = document.querySelector<HTMLElement>(`[data-coverage-group="${groupId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    window.setTimeout(() => {
      setHighlightedCoverageGroupId((current) => (current === groupId ? null : current));
    }, 2200);
  };

  const isCutoffOverrideError = (payload: any) => payload?.code === 'CUTOFF_OVERRIDE_REQUIRED';

  const submitShiftForm = async (cutoffReason?: string) => {
    const locationTimedDraft = getLocationTimedDraft();
    if (!locationTimedDraft || !newShiftSkill || !newShiftLocation || shiftDateOrderInvalid) {
      if (shiftDateOrderInvalid) {
        toast.error('Shift end must be later than shift start.');
      } else {
        toast.error('Choose a location, start time, and end time.');
      }
      return false;
    }
    setCreatingShift(true);
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/shifts${editingShift ? `/${editingShift.id}` : ''}`, {
        method: editingShift ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: newShiftLocation,
          date: locationTimedDraft.date,
          endDate: locationTimedDraft.endDate,
          startTime: locationTimedDraft.startTime,
          endTime: locationTimedDraft.endTime,
          requiredSkillId: newShiftSkill,
          headcountNeeded: newShiftHeadcount,
          skipManagerApproval: newShiftSkipManagerApproval,
          cutoffOverrideReason: cutoffReason,
          ...actor,
        })
      });
      if (res.ok) {
         await fetchShifts();
         await fetchFairness();
         resetShiftForm();
         setShowShiftModal(false);
         setCutoffOverrideRequest(null);
         setCutoffOverrideReason('');
         toast.success(editingShift ? 'Shift updated.' : 'Shift created.');
         return true;
      } else {
         const err = await res.json().catch(() => null);
         if (editingShift && isCutoffOverrideError(err)) {
           setCutoffOverrideRequest({
             action: 'edit',
             shift: editingShift,
             message: err?.message || 'This shift is inside the schedule lock window and needs an override reason.',
           });
           return false;
         }
         toast.error(err?.message || 'Failed to create shift.');
      }
    } catch (err) {
      console.error(err);
      toast.error(editingShift ? 'Failed to update shift.' : 'Failed to create shift.');
    } finally {
      setCreatingShift(false);
    }
    return false;
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitShiftForm();
  };

  const saveCutoffSettings = async () => {
    const nextCutoff = Math.max(0, Number(cutoffInput) || 0);
    setSavingCutoff(true);
    try {
      const settings = await updateSchedulingSettings({
        cutoffHours: nextCutoff,
        actorId: actor.actorId,
      });
      setCutoffHours(settings.cutoffHours);
      setCutoffInput(String(settings.cutoffHours));
      toast.success('Cutoff updated.');
    } catch (error: any) {
      toast.error(error.message || 'Unable to update cutoff.');
    } finally {
      setSavingCutoff(false);
    }
  };

  const executeAssignment = async (shift: Shift, targetStaff: Staff, reason?: string) => {
    const assignmentKey = getAssignmentKey(shift.id, targetStaff.id);
    setAssigningOperationKeys((current) => [...current, assignmentKey]);
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/shifts/${shift.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetStaff.id, overrideReason: reason, ...actor })
      });

      if (!res.ok) {
        const errData = await res.json();
        if (res.status === 409) {
          const conflictMessage =
            errData?.code === 'SIMULTANEOUS_ASSIGNMENT_CONFLICT'
              ? errData.message ||
                'Another manager assigned this staff member elsewhere while you were working. Review the updated roster and choose a different candidate.'
              : errData.message || 'Concurrent assignment conflict.';
          setValidationData({ valid: false, reason: conflictMessage, suggestions: errData.suggestions || [] });
          await fetchShifts();
          toast.error(
            errData?.code === 'SIMULTANEOUS_ASSIGNMENT_CONFLICT'
              ? conflictMessage
              : errData.message || 'Concurrent assignment conflict.',
          );
          return;
        }
        setValidationData({
          valid: false,
          reason: errData.message || 'Database rejected assignment.',
          suggestions: errData.suggestions || [],
        });
        toast.error(errData.message || 'Unable to assign shift.');
        return;
      }

      const shiftsResponse = await fetch(`${API_URL}/shifts`);
      const nextShifts = shiftsResponse.ok ? (await shiftsResponse.json()) as Shift[] : shifts;
      setShifts(nextShifts);
      await fetchFairness();
      setValidationData(null);
      setOverrideRequest(null);
      setOverrideReason('');
      upsertAssignmentModalGroup(nextShifts, shift);
      toast.success(`Assigned ${targetStaff.name}.`);
    } catch (e) {
      console.error(e);
      toast.error('Unable to assign shift.');
    } finally {
      setAssigningOperationKeys((current) => current.filter((key) => key !== assignmentKey));
    }
  };

  const attemptAssignment = async (targetStaff: Staff) => {
    if (!assignModalShift) return;

    const result = validateAssignment(targetStaff, assignModalShift, shifts, staffList);
    if (!result.valid) {
      setValidationData(result);
      if (!isWarnOnlyConflict(result)) {
        toast.error(result.reason || 'Assignment blocked.');
        return;
      }
      toast.warning(result.reason || 'This staff member has a conflict. The server will run final validation.');
    }

    if (result.requiresOverride) {
       setOverrideRequest({
         staff: targetStaff,
         shift: assignModalShift,
         warnings: result.warnings || [],
       });
       setOverrideReason('');
       return;
    }

    await executeAssignment(assignModalShift, targetStaff);
  };

  const removeAssignment = async (shift: Shift, cutoffReason?: string) => {
    const unassignKey = getUnassignKey(shift.id);
    setRemovingShiftId(shift.id);
    setAssigningOperationKeys((current) => [...current, unassignKey]);
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/shifts/${shift.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: null, cutoffOverrideReason: cutoffReason, ...actor })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        if (isCutoffOverrideError(err)) {
          setCutoffOverrideRequest({
            action: 'unassign',
            shift,
            message: err?.message || 'This shift is inside the schedule lock window and needs an override reason.',
          });
          return;
        }
        toast.error(err?.message || 'Unable to remove assignment.');
        return;
      }
      const shiftsResponse = await fetch(`${API_URL}/shifts`);
      const nextShifts = shiftsResponse.ok ? (await shiftsResponse.json()) as Shift[] : shifts;
      setShifts(nextShifts);
      await fetchFairness();
      if (assignModalShift) {
        upsertAssignmentModalGroup(nextShifts, assignModalShift);
      }
      setCutoffOverrideRequest(null);
      setCutoffOverrideReason('');
      toast.success('Assignment removed.');
    } catch (err) {
      console.error(err);
      toast.error('Unable to remove assignment.');
    } finally {
      setRemovingShiftId(null);
      setAssigningOperationKeys((current) => current.filter((key) => key !== unassignKey));
    }
  };

  const togglePublishState = async (shiftId: string) => {
     setPublishingShiftId(shiftId);
     try {
       const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
       const res = await fetch(`${API_URL}/shifts/${shiftId}/publish`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(actor),
       });
       if (!res.ok) {
         const err = await res.json();
         toast.error(err?.message || 'Unable to update publish state.');
         return;
       }
       await fetchShifts();
       toast.success('Schedule publish state updated.');
     } catch(err) {
       console.error(err);
       toast.error('Unable to update publish state.');
     } finally {
       setPublishingShiftId(null);
     }
  };

  const publishWeek = async (publish: boolean) => {
    if (!selectedLocation || !selectedWeekStart) return;
    setPublishingWeek(publish ? 'publish' : 'unpublish');
    try {
      const API_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const res = await fetch(`${API_URL}/shifts/publish-week`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocation,
          weekStart: selectedWeekStart,
          publish,
          ...actor,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err?.message || 'Unable to update weekly publish state.');
        return;
      }
      await fetchShifts();
      toast.success(publish ? 'Week published.' : 'Week unpublished.');
    } catch (error) {
      console.error(error);
      toast.error('Unable to update weekly publish state.');
    } finally {
      setPublishingWeek(null);
    }
  };

  if (locations.length === 0) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;
  if (!canManageSchedules) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in-up">
        <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-8 shadow-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Access Restricted</p>
          <h2 className="mt-3 text-3xl font-black text-white">Schedule management is limited to managers and admins.</h2>
          <p className="mt-3 text-slate-300">Staff users can review assigned shifts from the overview dashboard, but cannot create, assign, unassign, publish, or modify schedules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up text-white font-sans">
      <SchedulingHeader
        isConnected={isConnected}
        lastSync={lastSync}
        viewerTimeZone={viewerTimeZone}
        onCreateShift={openCreateShiftModal}
      />

      <SchedulingInsights
        shifts={shifts}
        staffList={staffList}
        fairnessData={fairnessData}
        viewerTimeZone={viewerTimeZone}
      />

      <LocationWeekControls
        availableLocations={availableLocations}
        selectedLocation={selectedLocation}
        selectedWeekStart={selectedWeekStart}
        cutoffInput={cutoffInput}
        cutoffHours={cutoffHours}
        savingCutoff={savingCutoff}
        publishingWeek={publishingWeek}
        onSelectLocation={setSelectedLocation}
        onChangeWeekStart={setSelectedWeekStart}
        onMoveWeek={moveSelectedWeek}
        onCutoffInputChange={setCutoffInput}
        onSaveCutoff={saveCutoffSettings}
        onPublishWeek={publishWeek}
      />

      <ScheduleLifecyclePanel cutoffHours={cutoffHours} />

      <div className="mb-8">
        <ScheduleCalendar
          shifts={displayCalendarShifts}
          viewerTimeZone={viewerTimeZone}
          title="Schedule Calendar"
          subtitle="Calendar view for the selected location, with an upcoming queue similar to a planner."
          emptyLabel="No shifts are scheduled for this location yet."
          locationTimeZoneLabel={activeLocation ? `${activeLocation.name} • ${activeLocation.timezone}` : undefined}
          onSelectShift={(shift) => setHistoryShift(shift)}
        />
      </div>

      <CoverageHealthSection coverageGroups={coverageGroups} onFocusGroup={focusCoverageGroup} />

      <ShiftBoard
        coverageGroups={coverageGroups}
        viewerTimeZone={viewerTimeZone}
        highlightedCoverageGroupId={highlightedCoverageGroupId}
        publishingShiftId={publishingShiftId}
        onTogglePublish={togglePublishState}
        onOpenAssignment={(shift) => {
          setAssignModalShift(shift);
          setValidationData(null);
        }}
        onOpenHistory={setHistoryShift}
        onOpenEdit={openEditShiftModal}
      />

      <ShiftAssignmentModal
        shift={assignModalShift}
        viewerTimeZone={viewerTimeZone}
        activeCoverageGroup={activeAssignmentCoverageGroup || null}
        validationData={validationData}
        staffList={staffList}
        shifts={shifts}
        assigningOperationKeys={assigningOperationKeys}
        getAssignmentKey={getAssignmentKey}
        getUnassignKey={getUnassignKey}
        classifyAssignmentConflict={classifyAssignmentConflict}
        isWarnOnlyConflict={isWarnOnlyConflict}
        onClose={() => setAssignModalShift(null)}
        onAttemptAssignment={attemptAssignment}
        onRemoveAssignment={removeAssignment}
      />

      <ShiftEditorModal
        isOpen={showShiftModal}
        editingShift={editingShift}
        availableLocations={availableLocations}
        activeDraftLocation={activeDraftLocation}
        viewerTimeZone={viewerTimeZone}
        startDateTime={startDateTime}
        endDateTime={endDateTime}
        planningMinDate={planningMinDate}
        skills={skills}
        newShiftLocation={newShiftLocation}
        newShiftSkill={newShiftSkill}
        newShiftHeadcount={newShiftHeadcount}
        newShiftSkipManagerApproval={newShiftSkipManagerApproval}
        cutoffHours={cutoffHours}
        isOvernightDraft={isOvernightDraft}
        shiftDateOrderInvalid={shiftDateOrderInvalid}
        shiftPreview={shiftPreview}
        creatingShift={creatingShift}
        onClose={() => {
          setShowShiftModal(false);
          resetShiftForm();
        }}
        onSubmit={handleCreateShift}
        onChangeStartDateTime={setShiftBuilderStart}
        onChangeEndDateTime={setShiftBuilderEnd}
        onChangeLocation={setNewShiftLocation}
        onChangeSkill={setNewShiftSkill}
        onChangeHeadcount={setNewShiftHeadcount}
        onChangeSkipManagerApproval={setNewShiftSkipManagerApproval}
      />

      <ShiftAuditModal
        shift={historyShift}
        viewerTimeZone={viewerTimeZone}
        loading={historyLoading}
        logs={shiftHistory}
        onClose={() => setHistoryShift(null)}
      />

      {overrideRequest && (
        <ReasonModal
          title="Manager Override Required"
          subtitle={overrideRequest.warnings.join(' | ')}
          label="Override Reason"
          placeholder="Document why this 7th consecutive day assignment should be allowed."
          submitLabel="Apply Override"
          initialValue={overrideReason}
          required
          loading={assigningOperationKeys.includes(getAssignmentKey(overrideRequest.shift.id, overrideRequest.staff.id))}
          onClose={() => {
            if (assigningOperationKeys.includes(getAssignmentKey(overrideRequest.shift.id, overrideRequest.staff.id))) return;
            setOverrideRequest(null);
            setOverrideReason('');
          }}
          onSubmit={(value) => {
            setOverrideReason(value);
            executeAssignment(overrideRequest.shift, overrideRequest.staff, value);
          }}
        />
      )}

      {cutoffOverrideRequest && (
        <ReasonModal
          title="Cutoff Override Required"
          subtitle={cutoffOverrideRequest.message}
          label="Override Reason"
          placeholder="Document why this locked schedule change must still happen."
          submitLabel={cutoffOverrideRequest.action === 'edit' ? 'Override And Save' : 'Override And Unassign'}
          initialValue={cutoffOverrideReason}
          required
          loading={
            cutoffOverrideRequest.action === 'edit'
              ? creatingShift
              : assigningOperationKeys.includes(getUnassignKey(cutoffOverrideRequest.shift.id))
          }
          onClose={() => {
            if (
              cutoffOverrideRequest.action === 'edit'
                ? creatingShift
                : assigningOperationKeys.includes(getUnassignKey(cutoffOverrideRequest.shift.id))
            ) {
              return;
            }
            setCutoffOverrideRequest(null);
            setCutoffOverrideReason('');
          }}
          onSubmit={async (value) => {
            setCutoffOverrideReason(value);
            if (cutoffOverrideRequest.action === 'edit') {
              await submitShiftForm(value);
              return;
            }
            await removeAssignment(cutoffOverrideRequest.shift, value);
          }}
        />
      )}
    </div>
  );
}
