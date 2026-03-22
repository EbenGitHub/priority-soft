import { Staff, Shift } from './mockData';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  suggestions?: Staff[];
  warnings?: string[];
  requiresOverride?: boolean;
}

function parseDateTime(dateStr: string, timeStr: string): Date {
  const formattedTime = timeStr?.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${formattedTime || '00:00:00'}`);
}

function getDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00`).getDay(); // 0 = Sunday
}

function getShiftDuration(shift: Shift): number {
  if (!shift.startTime || !shift.endTime) return 0;
  const start = parseDateTime(shift.date, shift.startTime).getTime();
  const end = parseDateTime(shift.date, shift.endTime).getTime();
  return (end - start) / (1000 * 60 * 60);
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
  
  if (!targetShift.location || !staff.locations?.some(l => l.id === targetShift.location.id)) {
    return { valid: false, reason: `Staff member is not certified to work at this location.` };
  }

  if (!targetShift.requiredSkill || !staff.skills?.some(s => s.id === targetShift.requiredSkill.id)) {
    return { valid: false, reason: `Missing required specialized skill tag for this shift.` };
  }

  const shiftDay = getDayOfWeek(targetShift.date);
  let isAvailable = false;
  const fmtTargetStart = targetShift.startTime.slice(0, 5);
  const fmtTargetEnd = targetShift.endTime.slice(0, 5);

  for (const avail of staff.availabilities || []) {
    const fmtAvailStart = avail.startTime.slice(0, 5);
    const fmtAvailEnd = avail.endTime.slice(0, 5);
    if (avail.type === 'EXCEPTION' && avail.date === targetShift.date) {
        if (fmtTargetStart >= fmtAvailStart && fmtTargetEnd <= fmtAvailEnd) isAvailable = true;
    } else if (avail.type === 'RECURRING' && avail.dayOfWeek === shiftDay) {
        if (fmtTargetStart >= fmtAvailStart && fmtTargetEnd <= fmtAvailEnd) isAvailable = true;
    }
  }

  if (!isAvailable) {
    return { valid: false, reason: `Employee has not explicitly flagged availability for this specific timestamp.` };
  }

  const targetStart = parseDateTime(targetShift.date, targetShift.startTime).getTime();
  const targetEnd = parseDateTime(targetShift.date, targetShift.endTime).getTime();
  
  const staffShifts = allShifts.filter(s => s.assignedStaff?.id === staff.id && s.id !== targetShift.id);
  
  for (const existingShift of staffShifts) {
    if (!existingShift.startTime || !existingShift.endTime) continue;
    const existingStart = parseDateTime(existingShift.date, existingShift.startTime).getTime();
    const existingEnd = parseDateTime(existingShift.date, existingShift.endTime).getTime();
    
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
  const dailyHours = staffShifts.filter(s => s.date === targetShift.date).reduce((acc, s) => acc + getShiftDuration(s), 0) + getShiftDuration(targetShift);
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
