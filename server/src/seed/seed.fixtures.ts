import { Location } from '../locations/entities/location.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { SwapRequest } from '../swaps/entities/swap.entity';
import { User } from '../users/entities/user.entity';

type NotificationSeedInput = Pick<Notification, 'type' | 'title' | 'message'> & {
  user: User;
  metadata?: Record<string, unknown>;
  readAt?: Date;
};

type AuditSeedInput = {
  shift: Shift;
  location: Location;
  action: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  summary: string;
};

type NotificationFixtureContext = {
  admin: User;
  eastManager: User;
  westManager: User;
  staff1: User;
  staff3: User;
  staff4: User;
  staff5: User;
  staff6: User;
  staff7: User;
};

type SwapFixtureContext = {
  staff1: User;
  staff3: User;
  staff4: User;
  staff6: User;
  staff8: User;
  nycLunch: Shift;
  nycHostEvening: Shift;
  miamiDinner: Shift;
  miamiHost: Shift;
  sundayChaosShift: Shift;
};

type AuditFixtureContext = {
  admin: User;
  eastManager: User;
  westManager: User;
  staff1: User;
  staff2: User;
  staff3: User;
  staff5: User;
  staff6: User;
  staff7: User;
  nycLunch: Shift;
  nycHostEvening: Shift;
  nycFridayClose: Shift;
  miamiHost: Shift;
  laLineClose: Shift;
  seattleLinePrep: Shift;
  seattleServerOpen: Shift;
  sundayChaosShift: Shift;
  premiumNycSat: Shift;
  premiumMiamiFri: Shift;
  crossTimezoneEast: Shift;
  crossTimezoneWest: Shift;
  overtimeTrap6: Shift;
  fairnessComplaintShift: Shift;
  loc1: Location;
  loc2: Location;
  loc3: Location;
  loc4: Location;
};

export function buildNotificationFixtures({
  admin,
  eastManager,
  westManager,
  staff1,
  staff3,
  staff4,
  staff5,
  staff6,
  staff7,
}: NotificationFixtureContext): NotificationSeedInput[] {
  return [
    {
      user: staff1,
      type: 'SHIFT_ASSIGNED',
      title: 'New shift assigned',
      message: 'You were assigned to the NYC lunch shift on March 24 from 11:00 to 17:00.',
      metadata: { emailEnabled: false },
    },
    {
      user: staff1,
      type: 'SHIFT_UPDATED',
      title: 'Shift updated',
      message: 'Your Thursday host coverage was moved to a later start to avoid overlap.',
      metadata: { emailEnabled: false },
    },
    {
      user: staff1,
      type: 'SCHEDULE_PUBLISHED',
      title: 'Schedule published',
      message: 'Your next weekly schedule has been published for Coastal Eats NYC.',
      metadata: { emailEnabled: false },
      readAt: new Date(),
    },
    {
      user: staff3,
      type: 'SWAP_REQUEST_APPROVED',
      title: 'Swap approved',
      message: 'A manager approved your Friday shift adjustment.',
      metadata: { emailEnabled: true },
    },
    {
      user: staff4,
      type: 'DROP_REQUEST_OPEN',
      title: 'Open shift available',
      message: 'A qualified open shift is available in Miami this Saturday.',
      metadata: { emailEnabled: false },
    },
    {
      user: staff5,
      type: 'SHIFT_ASSIGNED',
      title: 'Cross-timezone assignment',
      message:
        'You were assigned to an Eastern time shift while certified for both Eastern and Pacific locations.',
      metadata: { emailEnabled: false },
    },
    {
      user: staff6,
      type: 'SHIFT_ASSIGNED',
      title: 'Sunday closing assignment',
      message: 'You are scheduled for the Sunday night Miami close at 7:00 PM local time.',
      metadata: { emailEnabled: true },
    },
    {
      user: staff7,
      type: 'OVERTIME_WARNING',
      title: 'Hours approaching overtime',
      message: 'You are on pace for 48+ hours across LA and Seattle this week.',
      metadata: { emailEnabled: false },
    },
    {
      user: eastManager,
      type: 'SWAP_APPROVAL_REQUIRED',
      title: 'Swap approval required',
      message: 'A Friday evening server swap is waiting for manager approval.',
      metadata: { emailEnabled: true },
    },
    {
      user: eastManager,
      type: 'AVAILABILITY_CHANGED',
      title: 'Availability changed',
      message: 'Noah Flex updated weekday availability at NYC and Miami.',
      metadata: { emailEnabled: true },
    },
    {
      user: eastManager,
      type: 'OVERTIME_WARNING',
      title: 'Projected overtime warning',
      message:
        'Maria Bartender is projected above 35 hours if the Sunday close stays assigned.',
      metadata: { emailEnabled: true },
    },
    {
      user: westManager,
      type: 'OVERTIME_WARNING',
      title: 'Projected overtime warning',
      message:
        'Priya Prep is approaching 48 hours with the LA and Seattle blocks still assigned.',
      metadata: { emailEnabled: false },
    },
    {
      user: admin,
      type: 'SWAP_REQUEST_SUBMITTED',
      title: 'Cross-location staffing pressure',
      message: 'Miami Sunday coverage risk is likely to require a late staffing move.',
      metadata: { emailEnabled: true },
    },
    {
      user: admin,
      type: 'OVERTIME_WARNING',
      title: 'Cross-location overtime alert',
      message: 'The LA location has two staff members approaching overtime this week.',
      metadata: { emailEnabled: true },
    },
    {
      user: admin,
      type: 'SCHEDULE_PUBLISHED',
      title: 'Schedule published',
      message: 'East Coast schedules for the week of March 23 have been published.',
      metadata: { emailEnabled: true },
    },
  ];
}

export function buildSwapFixtures({
  staff1,
  staff3,
  staff4,
  staff6,
  staff8,
  nycLunch,
  nycHostEvening,
  miamiDinner,
  miamiHost,
  sundayChaosShift,
}: SwapFixtureContext): Partial<SwapRequest>[] {
  return [
    {
      type: 'SWAP',
      status: 'PENDING_MANAGER',
      reason: 'Need to trade Friday coverage for family travel.',
      initiatorUser: staff1,
      initiatorShift: nycLunch,
      targetShift: nycHostEvening,
      targetUser: staff4,
    },
    {
      type: 'DROP',
      status: 'PENDING_PEER',
      reason: 'Can no longer make the dinner block.',
      initiatorUser: staff3,
      initiatorShift: miamiDinner,
    },
    {
      type: 'DROP',
      status: 'PENDING_PEER',
      reason: 'Sunday night callout test scenario.',
      initiatorUser: staff6,
      initiatorShift: sundayChaosShift,
    },
    {
      type: 'SWAP',
      status: 'PENDING_PEER',
      reason: 'Would like to trade but may cancel before approval.',
      initiatorUser: staff1,
      initiatorShift: nycHostEvening,
      targetShift: miamiHost,
      targetUser: staff8,
    },
  ];
}

export function buildAuditFixtures({
  eastManager,
  westManager,
  staff1,
  staff2,
  staff3,
  staff5,
  staff6,
  staff7,
  nycLunch,
  nycFridayClose,
  laLineClose,
  seattleLinePrep,
  seattleServerOpen,
  sundayChaosShift,
  premiumNycSat,
  premiumMiamiFri,
  crossTimezoneEast,
  crossTimezoneWest,
  overtimeTrap6,
  fairnessComplaintShift,
  loc1,
  loc2,
  loc3,
  loc4,
}: AuditFixtureContext): AuditSeedInput[] {
  return [
    {
      shift: nycFridayClose,
      location: loc1,
      action: 'SHIFT_CREATED',
      actorId: eastManager.id,
      actorName: eastManager.name,
      actorRole: eastManager.role,
      beforeState: null,
      afterState: {
        date: '2026-03-27',
        startTime: '23:00:00',
        endTime: '03:00:00',
        published: false,
      },
      summary: 'Created an overnight bartender shift for Friday close.',
    },
    {
      shift: nycFridayClose,
      location: loc1,
      action: 'SHIFT_ASSIGNED',
      actorId: eastManager.id,
      actorName: eastManager.name,
      actorRole: eastManager.role,
      beforeState: { assignedStaffId: null, assignedStaffName: null },
      afterState: { assignedStaffId: staff3.id, assignedStaffName: staff3.name },
      summary: 'Assigned Maria Bartender to the overnight closing shift.',
    },
    {
      shift: nycFridayClose,
      location: loc1,
      action: 'SHIFT_PUBLISHED',
      actorId: eastManager.id,
      actorName: eastManager.name,
      actorRole: eastManager.role,
      beforeState: { published: false },
      afterState: { published: true },
      summary: 'Published a NYC schedule block to staff.',
    },
    {
      shift: nycLunch,
      location: loc1,
      action: 'SHIFT_ASSIGNED',
      actorId: eastManager.id,
      actorName: eastManager.name,
      actorRole: eastManager.role,
      beforeState: { assignedStaffId: null, assignedStaffName: null },
      afterState: { assignedStaffId: staff1.id, assignedStaffName: staff1.name },
      summary: 'Assigned Sarah Server to Tuesday lunch coverage.',
    },
    {
      shift: laLineClose,
      location: loc3,
      action: 'SHIFT_PUBLISHED',
      actorId: westManager.id,
      actorName: westManager.name,
      actorRole: westManager.role,
      beforeState: { published: false },
      afterState: { published: true },
      summary: 'Published the LA line cook schedule block.',
    },
    {
      shift: seattleLinePrep,
      location: loc4,
      action: 'SHIFT_REASSIGNED',
      actorId: westManager.id,
      actorName: westManager.name,
      actorRole: westManager.role,
      beforeState: { assignedStaffId: null, assignedStaffName: null },
      afterState: { assignedStaffId: staff2.id, assignedStaffName: staff2.name },
      summary: 'Placed John Cook on Seattle evening prep coverage.',
    },
    {
      shift: seattleServerOpen,
      location: loc4,
      action: 'SHIFT_CREATED',
      actorId: westManager.id,
      actorName: westManager.name,
      actorRole: westManager.role,
      beforeState: null,
      afterState: {
        date: seattleServerOpen.date,
        startTime: seattleServerOpen.startTime,
        endTime: seattleServerOpen.endTime,
        assignedStaffId: null,
      },
      summary: 'Created an unassigned Seattle server opening shift.',
    },
    {
      shift: sundayChaosShift,
      location: loc2,
      action: 'SHIFT_ASSIGNED',
      actorId: eastManager.id,
      actorName: eastManager.name,
      actorRole: eastManager.role,
      beforeState: { assignedStaffId: null, assignedStaffName: null },
      afterState: { assignedStaffId: staff6.id, assignedStaffName: staff6.name },
      summary: 'Assigned Leo Closer to the Sunday night Miami close.',
    },
    {
      shift: premiumNycSat,
      location: loc1,
      action: 'SHIFT_PUBLISHED',
      actorId: eastManager.id,
      actorName: eastManager.name,
      actorRole: eastManager.role,
      beforeState: { published: false },
      afterState: { published: true },
      summary: 'Published a premium Saturday night NYC shift.',
    },
    {
      shift: premiumMiamiFri,
      location: loc2,
      action: 'SHIFT_PUBLISHED',
      actorId: eastManager.id,
      actorName: eastManager.name,
      actorRole: eastManager.role,
      beforeState: { published: false },
      afterState: { published: true },
      summary: 'Published a premium Friday night Miami shift.',
    },
    {
      shift: crossTimezoneEast,
      location: loc1,
      action: 'SHIFT_ASSIGNED',
      actorId: eastManager.id,
      actorName: eastManager.name,
      actorRole: eastManager.role,
      beforeState: { assignedStaffId: null, assignedStaffName: null },
      afterState: { assignedStaffId: staff5.id, assignedStaffName: staff5.name },
      summary: 'Assigned Emma Cross-Coast to an Eastern time server shift.',
    },
    {
      shift: crossTimezoneWest,
      location: loc3,
      action: 'SHIFT_CREATED',
      actorId: westManager.id,
      actorName: westManager.name,
      actorRole: westManager.role,
      beforeState: null,
      afterState: {
        date: crossTimezoneWest.date,
        startTime: crossTimezoneWest.startTime,
        endTime: crossTimezoneWest.endTime,
        assignedStaffId: null,
      },
      summary: 'Created a Pacific time shift for cross-timezone staffing tests.',
    },
    {
      shift: overtimeTrap6,
      location: loc4,
      action: 'SHIFT_ASSIGNED',
      actorId: westManager.id,
      actorName: westManager.name,
      actorRole: westManager.role,
      beforeState: { assignedStaffId: null, assignedStaffName: null },
      afterState: { assignedStaffId: staff7.id, assignedStaffName: staff7.name },
      summary: 'Assigned Priya Prep to a sixth high-hours shift to trigger overtime review.',
    },
    {
      shift: fairnessComplaintShift,
      location: loc2,
      action: 'SHIFT_CREATED',
      actorId: eastManager.id,
      actorName: eastManager.name,
      actorRole: eastManager.role,
      beforeState: null,
      afterState: {
        date: fairnessComplaintShift.date,
        startTime: fairnessComplaintShift.startTime,
        endTime: fairnessComplaintShift.endTime,
        assignedStaffId: staff6.id,
      },
      summary: 'Created another premium Miami shift for fairness complaint investigation.',
    },
  ];
}
