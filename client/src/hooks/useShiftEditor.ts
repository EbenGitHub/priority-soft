"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { previewShiftTiming } from '../lib/calendarApi';
import { buildShiftUtcRange, getDateTimePartsInTimeZone, getShiftTiming } from '../lib/calendarTime';
import { Location, Shift, Skill } from '../lib/mockData';
import { ShiftPreview } from '../components/schedules/types';

type Params = {
  locations: Location[];
  skills: Skill[];
  selectedLocation: string;
  selectedWeekStart: string;
  viewerTimeZone: string;
};

export function useShiftEditor({
  locations,
  skills,
  selectedLocation,
  selectedWeekStart,
  viewerTimeZone,
}: Params) {
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [startDateTime, setStartDateTime] = useState<Date | null>(null);
  const [endDateTime, setEndDateTime] = useState<Date | null>(null);
  const [newShiftLocation, setNewShiftLocation] = useState('');
  const [newShiftSkill, setNewShiftSkill] = useState('');
  const [newShiftHeadcount, setNewShiftHeadcount] = useState(1);
  const [newShiftSkipManagerApproval, setNewShiftSkipManagerApproval] = useState(false);
  const [shiftPreview, setShiftPreview] = useState<ShiftPreview | null>(null);

  const activeDraftLocation =
    locations.find((location) => location.id === newShiftLocation) ||
    locations.find((location) => location.id === selectedLocation) ||
    null;

  const planningMinDate = useMemo(() => new Date(), []);
  const shiftDateOrderInvalid = Boolean(
    startDateTime && endDateTime && endDateTime.getTime() <= startDateTime.getTime(),
  );
  const isOvernightDraft = shiftPreview?.isOvernight || false;

  useEffect(() => {
    if (locations.length > 0) {
      setNewShiftLocation((current) =>
        current && locations.some((location) => location.id === current)
          ? current
          : selectedLocation || locations[0]?.id || '',
      );
    }
  }, [locations, selectedLocation]);

  useEffect(() => {
    if (skills.length > 0) {
      setNewShiftSkill((current) =>
        current && skills.some((skill) => skill.id === current) ? current : skills[0]?.id || '',
      );
    }
  }, [skills]);

  const setShiftBuilderStart = useCallback((value: Date | null) => {
    setStartDateTime(value);
  }, []);

  const setShiftBuilderEnd = useCallback((value: Date | null) => {
    setEndDateTime(value);
  }, []);

  const resetShiftForm = useCallback(() => {
    setEditingShift(null);
    setStartDateTime(null);
    setEndDateTime(null);
    setNewShiftHeadcount(1);
    setNewShiftSkipManagerApproval(false);
    setShiftPreview(null);
  }, []);

  const openCreateShiftModal = useCallback(() => {
    const weekAnchor = selectedWeekStart ? new Date(`${selectedWeekStart}T09:00:00Z`) : new Date();
    const nextHour = new Date(Math.max(weekAnchor.getTime(), Date.now()));
    nextHour.setMinutes(0, 0, 0);
    const defaultEnd = new Date(nextHour);
    defaultEnd.setHours(defaultEnd.getHours() + 8);

    resetShiftForm();
    setNewShiftLocation(selectedLocation || locations[0]?.id || '');
    setShiftBuilderStart(nextHour);
    setShiftBuilderEnd(defaultEnd);
    setShowShiftModal(true);
  }, [locations, resetShiftForm, selectedLocation, selectedWeekStart, setShiftBuilderEnd, setShiftBuilderStart]);

  const openEditShiftModal = useCallback(
    (shift: Shift) => {
      resetShiftForm();
      setEditingShift(shift);
      setNewShiftLocation(shift.location.id);
      setNewShiftSkill(shift.requiredSkill.id);
      setNewShiftHeadcount(shift.headcountNeeded || 1);
      setNewShiftSkipManagerApproval(Boolean(shift.skipManagerApproval));
      setShiftBuilderStart(shift.startUtc ? new Date(shift.startUtc) : new Date(`${shift.date}T${shift.startTime}`));
      setShiftBuilderEnd(
        shift.endUtc ? new Date(shift.endUtc) : new Date(`${shift.endDate || shift.date}T${shift.endTime}`),
      );
      setShowShiftModal(true);
    },
    [resetShiftForm, setShiftBuilderEnd, setShiftBuilderStart],
  );

  const getLocationTimedDraft = useCallback(() => {
    const location = locations.find((item) => item.id === newShiftLocation);
    if (!location || !startDateTime || !endDateTime) {
      return null;
    }

    const start = getDateTimePartsInTimeZone(startDateTime, location.timezone);
    const end = getDateTimePartsInTimeZone(endDateTime, location.timezone);

    return {
      location,
      date: start.date,
      endDate: end.date,
      startTime: start.time,
      endTime: end.time,
    };
  }, [endDateTime, locations, newShiftLocation, startDateTime]);

  useEffect(() => {
    async function loadPreview() {
      const locationTimedDraft = getLocationTimedDraft();
      if (!locationTimedDraft) {
        setShiftPreview(null);
        return;
      }

      try {
        const preview = await previewShiftTiming({
          locationId: locationTimedDraft.location.id,
          date: locationTimedDraft.date,
          endDate: locationTimedDraft.endDate,
          startTime: locationTimedDraft.startTime,
          endTime: locationTimedDraft.endTime,
          viewerTimeZone,
        });
        setShiftPreview(preview);
      } catch {
        const fallback = buildShiftUtcRange(
          locationTimedDraft.date,
          locationTimedDraft.startTime,
          locationTimedDraft.endTime,
          locationTimedDraft.location.timezone,
          locationTimedDraft.endDate,
        );
        const fallbackShift = {
          id: 'preview',
          location: locationTimedDraft.location,
          date: locationTimedDraft.date,
          endDate: locationTimedDraft.endDate,
          startTime: locationTimedDraft.startTime,
          endTime: locationTimedDraft.endTime,
          startUtc: fallback.startUtc.toISOString(),
          endUtc: fallback.endUtc.toISOString(),
          isOvernight: fallback.isOvernight,
          requiredSkill: skills.find((skill) => skill.id === newShiftSkill) || null,
          assignedStaff: null,
          published: false,
          skipManagerApproval: newShiftSkipManagerApproval,
        } as Shift;
        const timing = getShiftTiming(fallbackShift, viewerTimeZone);
        setShiftPreview({
          startUtc: timing.startUtc.toISOString(),
          endUtc: timing.endUtc.toISOString(),
          isOvernight: timing.isOvernight,
          durationHours: timing.durationHours,
          locationDate: timing.locationDate,
          locationTimeRange: timing.locationTimeRange,
          locationTimeZone: timing.locationTimeZone,
          viewerDate: timing.viewerDate,
          viewerTimeRange: timing.viewerTimeRange,
          viewerTimeZone: timing.viewerTimeZone,
        });
      }
    }

    loadPreview();
  }, [
    getLocationTimedDraft,
    newShiftSkill,
    newShiftSkipManagerApproval,
    skills,
    viewerTimeZone,
  ]);

  return {
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
  };
}
