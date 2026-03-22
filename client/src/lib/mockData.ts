export type Role = 'ADMIN' | 'MANAGER' | 'STAFF';

export interface Location {
  id: string;
  name: string;
  timezone: string;
}

export interface Skill {
  id: string;
  name: string;
}

export interface Availability {
  id: string;
  type: 'RECURRING' | 'EXCEPTION';
  dayOfWeek?: number; // 0-6
  date?: string; // YYYY-MM-DD
  timezone?: string;
  startTime: string; // HH:mm:ss
  endTime: string; // HH:mm:ss
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: Role;
  desiredHours: number;
  locations: Location[];
  skills: Skill[];
  availabilities: Availability[];
}

export interface Shift {
  id: string;
  location: Location;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm:ss
  endTime: string; // HH:mm:ss
  startUtc?: string;
  endUtc?: string;
  isOvernight?: boolean;
  requiredSkill: Skill; 
  assignedStaff: Staff | null;
  published: boolean;
}
