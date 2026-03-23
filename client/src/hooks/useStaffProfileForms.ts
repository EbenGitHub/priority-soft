"use client";

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Availability, Staff } from '../lib/mockData';
import {
  createAvailability,
  deleteAvailability,
  updateAvailability,
  updateDesiredHours,
} from '../lib/staffDashboardApi';

type Params = {
  userId: string;
  userDesiredHours?: number;
  profile: Staff | null;
  viewerTimeZone: string;
  refreshProfile: () => Promise<void>;
};

export function useStaffProfileForms({
  userId,
  userDesiredHours,
  profile,
  viewerTimeZone,
  refreshProfile,
}: Params) {
  const [desiredHours, setDesiredHours] = useState(String(userDesiredHours || ''));
  const [savingDesiredHours, setSavingDesiredHours] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityType, setAvailabilityType] = useState<'RECURRING' | 'EXCEPTION'>('RECURRING');
  const [availabilityDayOfWeek, setAvailabilityDayOfWeek] = useState('1');
  const [availabilityDate, setAvailabilityDate] = useState('');
  const [availabilityExceptionDate, setAvailabilityExceptionDate] = useState<Date | null>(null);
  const [availabilityStartTime, setAvailabilityStartTime] = useState('09:00');
  const [availabilityEndTime, setAvailabilityEndTime] = useState('17:00');
  const [availabilityLocationId, setAvailabilityLocationId] = useState('');
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<string | null>(null);
  const [deletingAvailabilityId, setDeletingAvailabilityId] = useState<string | null>(null);

  const certifiedLocations = profile?.locations || [];
  const availabilityItems = profile?.availabilities || [];

  const getAvailabilityLocationLabel = useMemo(
    () => (availability: Availability) => {
      const matchingLocations = certifiedLocations.filter(
        (location) => location.timezone === availability.timezone,
      );
      if (matchingLocations.length === 0) {
        return availability.timezone || 'Unassigned timezone';
      }
      if (matchingLocations.length === 1) {
        return `${matchingLocations[0].name} • ${matchingLocations[0].timezone}`;
      }
      return `${matchingLocations.map((location) => location.name).join(' / ')} • ${availability.timezone}`;
    },
    [certifiedLocations],
  );

  const resetAvailabilityForm = () => {
    setEditingAvailabilityId(null);
    setAvailabilityType('RECURRING');
    setAvailabilityDayOfWeek('1');
    setAvailabilityDate('');
    setAvailabilityExceptionDate(null);
    setAvailabilityStartTime('09:00');
    setAvailabilityEndTime('17:00');
    setAvailabilityLocationId(profile?.locations?.[0]?.id || '');
  };

  const syncFormFromProfile = (nextProfile: Staff | null) => {
    if (!nextProfile) return;
    setDesiredHours(String(nextProfile.desiredHours ?? ''));
    setAvailabilityLocationId((current) => current || nextProfile.locations?.[0]?.id || '');
  };

  const saveDesiredHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDesiredHours(true);
    try {
      const updated = await updateDesiredHours(userId, Math.max(0, Number(desiredHours) || 0));
      localStorage.setItem('shiftSync_user', JSON.stringify(updated));
      setDesiredHours(String(updated.desiredHours ?? ''));
      toast.success('Desired hours updated.');
      await refreshProfile();
    } catch (error: any) {
      toast.error(error.message || 'Unable to update desired hours.');
    } finally {
      setSavingDesiredHours(false);
    }
  };

  const submitAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (availabilityStartTime >= availabilityEndTime) {
      toast.error('Availability end must be later than the start time.');
      return;
    }
    const selectedAvailabilityLocation = profile?.locations?.find(
      (location) => location.id === availabilityLocationId,
    );
    if (!selectedAvailabilityLocation) {
      toast.error('Choose one of your certified locations for this availability window.');
      return;
    }

    setSavingAvailability(true);
    try {
      const payload: any = {
        type: availabilityType,
        startTime: `${availabilityStartTime}:00`,
        endTime: `${availabilityEndTime}:00`,
        timezone: selectedAvailabilityLocation.timezone || viewerTimeZone,
      };
      if (availabilityType === 'RECURRING') {
        payload.dayOfWeek = Number(availabilityDayOfWeek);
      } else {
        payload.date = availabilityDate;
      }

      if (editingAvailabilityId) {
        await updateAvailability(userId, editingAvailabilityId, payload);
      } else {
        await createAvailability(userId, payload);
      }

      await refreshProfile();
      setEditingAvailabilityId(null);
      setAvailabilityDate('');
      setAvailabilityExceptionDate(null);
      toast.success(editingAvailabilityId ? 'Availability updated.' : 'Availability added.');
    } catch (error: any) {
      toast.error(
        error.message ||
          (editingAvailabilityId ? 'Unable to update availability.' : 'Unable to add availability.'),
      );
    } finally {
      setSavingAvailability(false);
    }
  };

  const startEditingAvailability = (availability: Availability) => {
    setEditingAvailabilityId(availability.id);
    setAvailabilityType(availability.type);
    setAvailabilityDayOfWeek(String(availability.dayOfWeek ?? '1'));
    setAvailabilityStartTime(availability.startTime.slice(0, 5));
    setAvailabilityEndTime(availability.endTime.slice(0, 5));
    const matchingLocation =
      profile?.locations?.find((location) => location.timezone === availability.timezone) ||
      profile?.locations?.[0] ||
      null;
    setAvailabilityLocationId(matchingLocation?.id || '');
    if (availability.type === 'EXCEPTION' && availability.date) {
      setAvailabilityDate(availability.date);
      setAvailabilityExceptionDate(new Date(`${availability.date}T12:00:00`));
    } else {
      setAvailabilityDate('');
      setAvailabilityExceptionDate(null);
    }
  };

  const handleDeleteAvailability = async (availabilityId: string) => {
    setDeletingAvailabilityId(availabilityId);
    try {
      await deleteAvailability(userId, availabilityId);
      await refreshProfile();
      if (editingAvailabilityId === availabilityId) {
        resetAvailabilityForm();
      }
      toast.success('Availability deleted.');
    } catch (error: any) {
      toast.error(error.message || 'Unable to delete availability.');
    } finally {
      setDeletingAvailabilityId(null);
    }
  };

  const setExceptionDate = (value: Date | null) => {
    setAvailabilityExceptionDate(value);
    if (!value) {
      setAvailabilityDate('');
      return;
    }
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    setAvailabilityDate(`${year}-${month}-${day}`);
  };

  return {
    desiredHours,
    setDesiredHours,
    savingDesiredHours,
    savingAvailability,
    availabilityType,
    setAvailabilityType,
    availabilityDayOfWeek,
    setAvailabilityDayOfWeek,
    availabilityDate,
    availabilityExceptionDate,
    availabilityStartTime,
    setAvailabilityStartTime,
    availabilityEndTime,
    setAvailabilityEndTime,
    availabilityLocationId,
    setAvailabilityLocationId,
    editingAvailabilityId,
    deletingAvailabilityId,
    availabilityItems,
    certifiedLocations,
    getAvailabilityLocationLabel,
    saveDesiredHours,
    submitAvailability,
    startEditingAvailability,
    resetAvailabilityForm,
    handleDeleteAvailability,
    setExceptionDate,
    syncFormFromProfile,
  };
}
