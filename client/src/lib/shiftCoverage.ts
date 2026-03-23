import { Shift } from './mockData';
import { getShiftTiming } from './calendarTime';

export type ShiftCoverageGroup = {
  id: string;
  locationId: string;
  locationName: string;
  requiredSkillName: string;
  dateLabel: string;
  timeRange: string;
  locationTimeZone: string;
  headcountNeeded: number;
  slotCount: number;
  assignedCount: number;
  openCount: number;
  status: 'understaffed' | 'overstaffed' | 'balanced' | 'no_coverage';
  shifts: Shift[];
};

export function groupShiftCoverage(shifts: Shift[], viewerTimeZone: string) {
  const groups = new Map<string, Shift[]>();

  for (const shift of shifts) {
    const key =
      shift.scheduleGroupId ||
      `${shift.location?.id}:${shift.requiredSkill?.id}:${shift.date}:${shift.startTime}:${shift.endTime}`;
    const current = groups.get(key) || [];
    current.push(shift);
    groups.set(key, current);
  }

  return [...groups.entries()].map(([id, items]) => {
    const reference = items[0];
    const timing = getShiftTiming(reference, viewerTimeZone);
    const headcountNeeded = reference.headcountNeeded || items.length || 1;
    const assignedCount = items.filter((shift) => Boolean(shift.assignedStaff)).length;
    const slotCount = items.length;
    const openCount = Math.max(0, headcountNeeded - assignedCount);

    let status: ShiftCoverageGroup['status'] = 'balanced';
    if (assignedCount === 0) status = 'no_coverage';
    else if (assignedCount < headcountNeeded) status = 'understaffed';
    else if (assignedCount > headcountNeeded || slotCount > headcountNeeded) status = 'overstaffed';

    return {
      id,
      locationId: reference.location?.id || '',
      locationName: reference.location?.name || 'Unknown location',
      requiredSkillName: reference.requiredSkill?.name || 'Unknown skill',
      dateLabel: timing.locationDate,
      timeRange: timing.locationTimeRange,
      locationTimeZone: timing.locationTimeZone,
      headcountNeeded,
      slotCount,
      assignedCount,
      openCount,
      status,
      shifts: items.sort((left, right) => (left.slotIndex || 0) - (right.slotIndex || 0)),
    };
  });
}

export function getShiftCoverageGroupId(shift: Shift) {
  return (
    shift.scheduleGroupId ||
    `${shift.location?.id}:${shift.requiredSkill?.id}:${shift.date}:${shift.startTime}:${shift.endTime}`
  );
}
