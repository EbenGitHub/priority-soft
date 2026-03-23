import { getShiftTiming, getLocalDateKeyForUtc } from './calendarTime';
import { Shift, Staff } from './mockData';

function getShiftDurationHours(shift: Shift, viewerTimeZone = 'UTC') {
  return getShiftTiming(shift, viewerTimeZone).durationHours;
}

function getTrailingWeekShifts(staffShifts: Shift[], targetShift: Shift) {
  const targetTime = new Date(`${targetShift.date}T12:00:00Z`).getTime();
  const weekStart = targetTime - 6 * 24 * 60 * 60 * 1000;

  return staffShifts.filter((shift) => {
    const time = new Date(`${shift.date}T12:00:00Z`).getTime();
    return time >= weekStart && time <= targetTime;
  });
}

export type AssignmentOvertimeImpact = {
  shiftHours: number;
  currentWeeklyHours: number;
  projectedWeeklyHours: number;
  weeklyDeltaHours: number;
  currentDailyHours: number;
  projectedDailyHours: number;
  overtimeHoursAdded: number;
  projectedOvertimeCost: number;
  dailyWarning: boolean;
  dailyHardBlock: boolean;
  weeklyWarning: boolean;
  weeklyOvertime: boolean;
};

export function forecastAssignmentImpact(
  staff: Staff,
  targetShift: Shift,
  allShifts: Shift[],
): AssignmentOvertimeImpact {
  const staffShifts = allShifts.filter(
    (shift) => shift.assignedStaff?.id === staff.id && shift.id !== targetShift.id,
  );
  const shiftHours = getShiftDurationHours(targetShift);
  const weekShifts = getTrailingWeekShifts(staffShifts, targetShift);
  const currentWeeklyHours = weekShifts.reduce(
    (total, shift) => total + getShiftDurationHours(shift),
    0,
  );
  const projectedWeeklyHours = currentWeeklyHours + shiftHours;

  const targetTiming = getShiftTiming(targetShift, 'UTC');
  const targetDateKey = getLocalDateKeyForUtc(
    targetTiming.startUtc,
    targetShift.location?.timezone || 'UTC',
  );
  const sameDayShifts = staffShifts.filter(
    (shift) =>
      getLocalDateKeyForUtc(
        getShiftTiming(shift, 'UTC').startUtc,
        shift.location?.timezone || 'UTC',
      ) === targetDateKey,
  );
  const currentDailyHours = sameDayShifts.reduce(
    (total, shift) => total + getShiftDurationHours(shift),
    0,
  );
  const projectedDailyHours = currentDailyHours + shiftHours;

  const currentOvertimeHours = Math.max(0, currentWeeklyHours - 40);
  const projectedOvertimeHours = Math.max(0, projectedWeeklyHours - 40);
  const overtimeHoursAdded = projectedOvertimeHours - currentOvertimeHours;

  return {
    shiftHours,
    currentWeeklyHours,
    projectedWeeklyHours,
    weeklyDeltaHours: shiftHours,
    currentDailyHours,
    projectedDailyHours,
    overtimeHoursAdded,
    projectedOvertimeCost: projectedOvertimeHours * 25.5 * 1.5,
    dailyWarning: projectedDailyHours > 8,
    dailyHardBlock: projectedDailyHours > 12,
    weeklyWarning: projectedWeeklyHours >= 35,
    weeklyOvertime: projectedWeeklyHours >= 40,
  };
}
