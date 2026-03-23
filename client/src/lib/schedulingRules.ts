import { Staff, Shift } from './mockData';
import { buildShiftUtcRange, getShiftTiming, getLocalDateKeyForUtc } from './calendarTime';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  suggestions?: Staff[];
  warnings?: string[];
  requiresOverride?: boolean;
}

function getDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00`).getDay(); // 0 = Sunday
}

function getShiftDuration(shift: Shift): number {
  return getShiftTiming(shift, 'UTC').durationHours;
}

function calculateConsecutiveDays(shifts: Shift[], newShift: Shift): number {
   const targetDate = new Date(`${newShift.date}T12:00:00Z`);
   let consecutive = 1;

   for (let i = 1; i <= 7; i++) {
      const prevDate = new Date(targetDate.getTime() - (i * 24 * 60 * 60 * 1000));
      const prevIso = prevDate.toISOString().split('T')[0];
      if (shifts.some(s => s.date === prevIso)) consecutive++;
      else break; 
   }
   for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(targetDate.getTime() + (i * 24 * 60 * 60 * 1000));
      const nextIso = nextDate.toISOString().split('T')[0];
      if (shifts.some(s => s.date === nextIso)) consecutive++;
      else break;
   }
   return consecutive;
}

function calculateWeeklyHours(shifts: Shift[], newShift: Shift): number {
   const targetTime = new Date(`${newShift.date}T12:00:00Z`).getTime();
   const weekStart = targetTime - (6 * 24 * 60 * 60 * 1000); // 7-day trailing bounds
   const weekShifts = shifts.filter(s => {
      const t = new Date(`${s.date}T12:00:00Z`).getTime();
      return t >= weekStart && t <= targetTime;
   });
   return weekShifts.reduce((acc, s) => acc + getShiftDuration(s), 0) + getShiftDuration(newShift);
}

export function validateAssignment(
  staff: Staff, 
  targetShift: Shift, 
  allShifts: Shift[], 
  allStaff: Staff[]
): ValidationResult {
  const warnings: string[] = [];
  let requiresOverride = false;
  void allStaff;
  
  if (!targetShift.location || !staff.locations?.some(l => l.id === targetShift.location.id)) {
    return { valid: false, reason: `Staff member is not certified to work at this location.` };
  }

  if (!targetShift.requiredSkill || !staff.skills?.some(s => s.id === targetShift.requiredSkill.id)) {
    return { valid: false, reason: `Missing required specialized skill tag for this shift.` };
  }

  let isAvailable = false;
  const targetTiming = getShiftTiming(targetShift, 'UTC');

  for (const avail of staff.availabilities || []) {
    const availabilityTimeZone =
      avail.location?.timezone ||
      avail.timezone ||
      targetShift.location?.timezone ||
      staff.locations?.[0]?.timezone ||
      'UTC';

    const candidateDates =
      avail.type === 'EXCEPTION' && avail.date
        ? [avail.date]
        : [
            getLocalDateKeyForUtc(targetTiming.startUtc, availabilityTimeZone),
            getLocalDateKeyForUtc(
              new Date(targetTiming.startUtc.getTime() - 24 * 60 * 60 * 1000),
              availabilityTimeZone,
            ),
          ];

    for (const candidateDate of candidateDates) {
      const availabilityWindow = buildShiftUtcRange(
        candidateDate,
        avail.startTime,
        avail.endTime,
        availabilityTimeZone,
      );
      const candidateDay = getDayOfWeek(candidateDate);
      const matchesRule =
        avail.type === 'EXCEPTION'
          ? avail.date === candidateDate
          : avail.dayOfWeek === candidateDay;

      if (!matchesRule) continue;

      if (
        targetTiming.startUtc.getTime() >= availabilityWindow.startUtc.getTime() &&
        targetTiming.endUtc.getTime() <= availabilityWindow.endUtc.getTime()
      ) {
        isAvailable = true;
        break;
      }
    }

    if (isAvailable) break;
  }

  if (!isAvailable) {
    return { valid: false, reason: `Employee has not explicitly flagged availability for this specific timestamp.` };
  }

  const targetStart = targetTiming.startUtc.getTime();
  const targetEnd = targetTiming.endUtc.getTime();
  
  const staffShifts = allShifts.filter(s => s.assignedStaff?.id === staff.id && s.id !== targetShift.id);
  
  for (const existingShift of staffShifts) {
    if (!existingShift.startTime || !existingShift.endTime) continue;
    const existingTiming = getShiftTiming(existingShift, 'UTC');
    const existingStart = existingTiming.startUtc.getTime();
    const existingEnd = existingTiming.endUtc.getTime();
    
    if (targetStart < existingEnd && targetEnd > existingStart) {
      return { valid: false, reason: `Overlaps completely with an existing shift (${existingShift.startTime.slice(0,5)}-${existingShift.endTime.slice(0,5)}).` };
    }

    const hoursBetweenBefore = (targetStart - existingEnd) / (1000 * 60 * 60);
    const hoursBetweenAfter = (existingStart - targetEnd) / (1000 * 60 * 60);

    if (targetStart >= existingEnd && hoursBetweenBefore < 10) {
      return { valid: false, reason: `Violates 10-hour rest compliance rule (Only rested ${hoursBetweenBefore.toFixed(1)} hours).` };
    }
    
    if (targetEnd <= existingStart && hoursBetweenAfter < 10) {
      return { valid: false, reason: `Violates 10-hour rest compliance rule (Next shift cuts rest to ${hoursBetweenAfter.toFixed(1)} hours).` };
    }
  }

  // Phase 5: Overtime & Labor Cost Algorithms (Preflight)
  const targetDateKey = getLocalDateKeyForUtc(
    targetTiming.startUtc,
    targetShift.location?.timezone || 'UTC',
  );
  const dailyHours =
    staffShifts
      .filter(
        (shift) =>
          getLocalDateKeyForUtc(
            getShiftTiming(shift, 'UTC').startUtc,
            shift.location?.timezone || 'UTC',
          ) === targetDateKey,
      )
      .reduce((acc, s) => acc + getShiftDuration(s), 0) + getShiftDuration(targetShift);
  if (dailyHours > 12) {
      return { valid: false, reason: `Labor Law Violation: Cannot exceed 12 active hours in a single deployment cycle (${dailyHours}h target).` };
  } else if (dailyHours > 8) {
      warnings.push(`Daily hours projecting ${dailyHours}h threshold (Over 8h is classified as Overtime).`);
  }

  const weeklyHours = calculateWeeklyHours(staffShifts, targetShift);
  if (weeklyHours >= 40) {
      warnings.push(`CRITICAL: Deployment pushes employee to ${weeklyHours}h rolling (Overtime restrictions triggered / 1.5x Pay).`);
  } else if (weeklyHours >= 35) {
      warnings.push(`Warning: Employee evaluating closely to overtime labor boundaries (${weeklyHours}h rolling sum).`);
  }

  const consecutiveDays = calculateConsecutiveDays(staffShifts, targetShift);
  if (consecutiveDays >= 7) {
      requiresOverride = true;
      warnings.push(`Labor Law Lockout: 7 Consecutive days sequence engaged. Explicit Manager Override Memo Required.`);
  } else if (consecutiveDays === 6) {
      warnings.push(`Labor Law Warning: 6 Consecutive days execution sequence approaching hard cutoff.`);
  }

  return { valid: true, warnings, requiresOverride };
}
