import { Staff, Shift } from './mockData';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  suggestions?: Staff[];
}

function parseDateTime(dateStr: string, timeStr: string): Date {
  const formattedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return new Date(`${dateStr}T${formattedTime}`);
}

function getDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00`).getDay(); // 0 = Sunday
}

export function validateAssignment(
  staff: Staff, 
  targetShift: Shift, 
  allShifts: Shift[], 
  allStaff: Staff[]
): ValidationResult {
  
  // Rule 4: Location Check
  if (!targetShift.location || !staff.locations.some(l => l.id === targetShift.location.id)) {
    return { 
      valid: false, 
      reason: `Staff member is not certified to work at this location.`,
      suggestions: findSuggestions(targetShift, allShifts, allStaff)
    };
  }

  // Rule 3: Skill Check
  if (!targetShift.requiredSkill || !staff.skills.some(s => s.id === targetShift.requiredSkill.id)) {
    return { 
      valid: false, 
      reason: `Missing required specialized skill tag for this shift.`,
      suggestions: findSuggestions(targetShift, allShifts, allStaff)
    };
  }

  // Rule 5: Availability Rules
  const shiftDay = getDayOfWeek(targetShift.date);
  let isAvailable = false;

  const fmtTargetStart = targetShift.startTime.slice(0, 5);
  const fmtTargetEnd = targetShift.endTime.slice(0, 5);

  for (const avail of staff.availabilities) {
    const fmtAvailStart = avail.startTime.slice(0, 5);
    const fmtAvailEnd = avail.endTime.slice(0, 5);
    
    if (avail.type === 'EXCEPTION' && avail.date === targetShift.date) {
        if (fmtTargetStart >= fmtAvailStart && fmtTargetEnd <= fmtAvailEnd) isAvailable = true;
    } else if (avail.type === 'RECURRING' && avail.dayOfWeek === shiftDay) {
        if (fmtTargetStart >= fmtAvailStart && fmtTargetEnd <= fmtAvailEnd) isAvailable = true;
    }
  }

  if (!isAvailable) {
    return { 
      valid: false, 
      reason: `Employee has not explicitly flagged availability for this specific timestamp.`,
      suggestions: findSuggestions(targetShift, allShifts, allStaff)
    };
  }

  // Rule 1 & 2: Double Booking & 10 HR Rest
  const targetStart = parseDateTime(targetShift.date, targetShift.startTime).getTime();
  const targetEnd = parseDateTime(targetShift.date, targetShift.endTime).getTime();
  
  const staffShifts = allShifts.filter(s => s.assignedStaff?.id === staff.id && s.id !== targetShift.id);
  
  for (const existingShift of staffShifts) {
    const existingStart = parseDateTime(existingShift.date, existingShift.startTime).getTime();
    const existingEnd = parseDateTime(existingShift.date, existingShift.endTime).getTime();
    
    if (targetStart < existingEnd && targetEnd > existingStart) {
      return { 
        valid: false, 
        reason: `Overlaps completely with an existing shift (${existingShift.startTime.slice(0,5)}-${existingShift.endTime.slice(0,5)}).`,
        suggestions: findSuggestions(targetShift, allShifts, allStaff)
      };
    }

    const hoursBetweenBefore = (targetStart - existingEnd) / (1000 * 60 * 60);
    const hoursBetweenAfter = (existingStart - targetEnd) / (1000 * 60 * 60);

    if (targetStart >= existingEnd && hoursBetweenBefore < 10) {
      return { 
        valid: false, 
        reason: `Violates 10-hour rest compliance rule (Only rested ${hoursBetweenBefore.toFixed(1)} hours).`,
        suggestions: findSuggestions(targetShift, allShifts, allStaff)
      };
    }
    
    if (targetEnd <= existingStart && hoursBetweenAfter < 10) {
      return { 
        valid: false, 
        reason: `Violates 10-hour rest compliance rule (Next shift cuts rest to ${hoursBetweenAfter.toFixed(1)} hours).`,
        suggestions: findSuggestions(targetShift, allShifts, allStaff)
      };
    }
  }

  return { valid: true };
}

export function findSuggestions(shift: Shift, allShifts: Shift[], allStaff: Staff[]): Staff[] {
  return allStaff.filter(staff => {
    const targetStart = parseDateTime(shift.date, shift.startTime).getTime();
    const targetEnd = parseDateTime(shift.date, shift.endTime).getTime();

    if (!shift.requiredSkill || !staff.skills.some(s => s.id === shift.requiredSkill.id)) return false;
    if (!shift.location || !staff.locations.some(l => l.id === shift.location.id)) return false;

    const staffShifts = allShifts.filter(s => s.assignedStaff?.id === staff.id && s.id !== shift.id);
    for (const existingShift of staffShifts) {
      const existingStart = parseDateTime(existingShift.date, existingShift.startTime).getTime();
      const existingEnd = parseDateTime(existingShift.date, existingShift.endTime).getTime();
      
      if (targetStart < existingEnd && targetEnd > existingStart) return false;
      const hoursBetweenBefore = (targetStart - existingEnd) / (1000 * 60 * 60);
      const hoursBetweenAfter = (existingStart - targetEnd) / (1000 * 60 * 60);
      if (targetStart >= existingEnd && hoursBetweenBefore < 10) return false;
      if (targetEnd <= existingStart && hoursBetweenAfter < 10) return false;
    }

    const shiftDay = getDayOfWeek(shift.date);
    let isAvailable = false;
    const fmtTargetStart = shift.startTime.slice(0, 5);
    const fmtTargetEnd = shift.endTime.slice(0, 5);

    for (const avail of staff.availabilities) {
      const fmtAvailStart = avail.startTime.slice(0, 5);
      const fmtAvailEnd = avail.endTime.slice(0, 5);
      
      if (avail.type === 'EXCEPTION' && avail.date === shift.date) {
        if (fmtTargetStart >= fmtAvailStart && fmtTargetEnd <= fmtAvailEnd) isAvailable = true;
      } else if (avail.type === 'RECURRING' && avail.dayOfWeek === shiftDay) {
        if (fmtTargetStart >= fmtAvailStart && fmtTargetEnd <= fmtAvailEnd) isAvailable = true;
      }
    }
    if (!isAvailable) return false;

    return true;
  });
}
