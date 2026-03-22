import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Skill } from '../users/entities/skill.entity';
import { Availability } from '../users/entities/availability.entity';
import { Role } from '../users/enums/role.enum';
import { AvailabilityType } from '../users/enums/availability-type.enum';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { SwapRequest } from '../swaps/entities/swap.entity';
import { buildShiftUtcRange } from '../calendar/calendar-time.util';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Location) private readonly locationRepository: Repository<Location>,
    @InjectRepository(Skill) private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Availability) private readonly availabilityRepository: Repository<Availability>,
    @InjectRepository(Notification) private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(AuditLog) private readonly auditRepository: Repository<AuditLog>,
    @InjectRepository(Shift) private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(SwapRequest) private readonly swapRepository: Repository<SwapRequest>,
  ) {}

  private async findOrCreateLocation(name: string, timezone: string) {
    const existing = await this.locationRepository.findOne({ where: { name } });
    if (existing) return existing;
    return this.locationRepository.save({ name, timezone });
  }

  private async findOrCreateSkill(name: string) {
    const existing = await this.skillRepository.findOne({ where: { name } });
    if (existing) return existing;
    return this.skillRepository.save({ name });
  }

  private async findOrCreateUser(data: Partial<User>) {
    const existing = await this.userRepository.findOne({
      where: { email: data.email },
      relations: ['locations', 'skills'],
    });
    if (existing) return existing;
    return this.userRepository.save(this.userRepository.create(data));
  }

  private async ensureRecurringAvailability(
    user: User,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    timezone: string,
  ) {
    const existing = await this.availabilityRepository.findOne({
      where: {
        user: { id: user.id },
        type: AvailabilityType.RECURRING,
        dayOfWeek,
        startTime,
        endTime,
      },
    });
    if (existing) return existing;

    return this.availabilityRepository.save({
      user,
      type: AvailabilityType.RECURRING,
      dayOfWeek,
      startTime,
      endTime,
      timezone,
    });
  }

  private async ensureExceptionAvailability(
    user: User,
    date: string,
    startTime: string,
    endTime: string,
    timezone: string,
  ) {
    const existing = await this.availabilityRepository.findOne({
      where: {
        user: { id: user.id },
        type: AvailabilityType.EXCEPTION,
        date,
        startTime,
        endTime,
      },
    });
    if (existing) return existing;

    return this.availabilityRepository.save({
      user,
      type: AvailabilityType.EXCEPTION,
      date,
      startTime,
      endTime,
      timezone,
    });
  }

  private async ensureNotificationPreference(
    user: User,
    inAppEnabled: boolean,
    emailEnabled: boolean,
  ) {
    const existing = await this.preferenceRepository.findOne({
      where: { user: { id: user.id } },
      relations: ['user'],
    });
    if (existing) return existing;

    return this.preferenceRepository.save({
      user,
      inAppEnabled,
      emailEnabled,
    });
  }

  private async ensureNotification(data: {
    user: User;
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    readAt?: Date;
  }) {
    const existing = await this.notificationRepository.findOne({
      where: {
        user: { id: data.user.id },
        type: data.type,
        title: data.title,
        message: data.message,
      },
      relations: ['user'],
    });
    if (existing) return existing;

    return this.notificationRepository.save({
      ...data,
      metadata: data.metadata || {},
    });
  }

  private async ensureShift(data: {
    location: Location;
    requiredSkill: Skill;
    date: string;
    startTime: string;
    endTime: string;
    assignedStaff?: User | null;
    published?: boolean;
  }) {
    const existing = await this.shiftRepository.findOne({
      where: {
        location: { id: data.location.id },
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
      },
      relations: ['location', 'requiredSkill', 'assignedStaff'],
    });
    if (existing) return existing;

    const timing = buildShiftUtcRange(data.date, data.startTime, data.endTime, data.location.timezone);
    return this.shiftRepository.save({
      location: data.location,
      requiredSkill: data.requiredSkill,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      startUtc: timing.startUtc,
      endUtc: timing.endUtc,
      isOvernight: timing.isOvernight,
      assignedStaff: data.assignedStaff || null,
      published: data.published || false,
    });
  }

  private async ensureSwap(data: Partial<SwapRequest>) {
    const existing = await this.swapRepository.findOne({
      where: {
        type: data.type,
        status: data.status,
        initiatorUser: { id: data.initiatorUser?.id },
        initiatorShift: { id: data.initiatorShift?.id },
      },
      relations: ['initiatorUser', 'initiatorShift'],
    });
    if (existing) return existing;

    return this.swapRepository.save(this.swapRepository.create(data));
  }

  private async ensureAuditLog(data: {
    shift: Shift;
    location: Location;
    action: string;
    actorId: string | null;
    actorName: string;
    actorRole: string;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
    summary: string;
  }) {
    const existing = await this.auditRepository.findOne({
      where: {
        shift: { id: data.shift.id },
        action: data.action,
        summary: data.summary,
      },
      relations: ['shift'],
    });
    if (existing) return existing;

    return this.auditRepository.save(data);
  }

  async onApplicationBootstrap() {
    this.logger.log('Ensuring Coastal Eats demo data exists...');

    // 1. Locations
    const loc1 = await this.findOrCreateLocation('Coastal Eats - NYC', 'America/New_York');
    const loc2 = await this.findOrCreateLocation('Coastal Eats - Miami', 'America/New_York');
    const loc3 = await this.findOrCreateLocation('Coastal Eats - LA', 'America/Los_Angeles');
    const loc4 = await this.findOrCreateLocation('Coastal Eats - Seattle', 'America/Los_Angeles');
    const locations = [loc1, loc2, loc3, loc4];

    // 2. Skills
    const skillBartender = await this.findOrCreateSkill('bartender');
    const skillCook = await this.findOrCreateSkill('line cook');
    const skillServer = await this.findOrCreateSkill('server');
    const skillHost = await this.findOrCreateSkill('host');

    // 3. Admin User
    const admin = await this.findOrCreateUser({
      name: 'Corporate Admin',
      email: 'admin@coastaleats.com',
      role: Role.ADMIN,
      locations: locations, // Admins oversee everything
    });

    // 4. Managers
    const eastManager = await this.findOrCreateUser({
      name: 'East Coast Manager',
      email: 'eastmanager@coastaleats.com',
      role: Role.MANAGER,
      locations: [loc1, loc2],
    });

    const westManager = await this.findOrCreateUser({
      name: 'West Coast Manager',
      email: 'westmanager@coastaleats.com',
      role: Role.MANAGER,
      locations: [loc3, loc4],
    });

    // 5. Staff
    const staff1 = await this.findOrCreateUser({
      name: 'Sarah Server',
      email: 'sarah@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 35,
      locations: [loc1],
      skills: [skillServer, skillHost],
    });

    const staff2 = await this.findOrCreateUser({
      name: 'John Cook',
      email: 'john@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 40,
      locations: [loc3, loc4],
      skills: [skillCook],
    });

    const staff3 = await this.findOrCreateUser({
      name: 'Maria Bartender',
      email: 'maria@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 20,
      locations: [loc1, loc2],
      skills: [skillBartender, skillServer],
    });

    const staff4 = await this.findOrCreateUser({
      name: 'Noah Flex',
      email: 'noah@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 32,
      locations: [loc1, loc2],
      skills: [skillServer, skillHost],
    });

    // 6. Availabilities
    // Sarah works weekdays, 9am to 5pm
    for (let day = 1; day <= 5; day++) {
      await this.ensureRecurringAvailability(staff1, day, '09:00:00', '17:00:00', loc1.timezone);
    }

    // John works evenings weekends (Fri, Sat, Sun)
    for (const day of [5, 6, 0]) {
      await this.ensureRecurringAvailability(staff2, day, '16:00:00', '23:59:59', loc3.timezone);
    }

    // Maria is an exception test: available Dec 31st for a massive shift
    await this.ensureExceptionAvailability(staff3, '2026-12-31', '10:00:00', '22:00:00', loc1.timezone);

    for (let day = 1; day <= 5; day++) {
      await this.ensureRecurringAvailability(staff4, day, '12:00:00', '22:00:00', loc1.timezone);
    }

    const nycLunch = await this.ensureShift({
      location: loc1,
      requiredSkill: skillServer,
      date: '2026-03-24',
      startTime: '11:00:00',
      endTime: '17:00:00',
      assignedStaff: staff1,
      published: true,
    });
    const nycHostEvening = await this.ensureShift({
      location: loc1,
      requiredSkill: skillHost,
      date: '2026-03-26',
      startTime: '16:00:00',
      endTime: '22:00:00',
      assignedStaff: staff4,
      published: false,
    });
    const nycFridayClose = await this.ensureShift({
      location: loc1,
      requiredSkill: skillBartender,
      date: '2026-03-27',
      startTime: '23:00:00',
      endTime: '03:00:00',
      assignedStaff: staff3,
      published: true,
    });
    const miamiDinner = await this.ensureShift({
      location: loc2,
      requiredSkill: skillServer,
      date: '2026-03-27',
      startTime: '17:00:00',
      endTime: '23:00:00',
      assignedStaff: staff3,
      published: true,
    });
    const miamiHost = await this.ensureShift({
      location: loc2,
      requiredSkill: skillHost,
      date: '2026-03-28',
      startTime: '14:00:00',
      endTime: '20:00:00',
      assignedStaff: staff4,
      published: true,
    });
    const laLineClose = await this.ensureShift({
      location: loc3,
      requiredSkill: skillCook,
      date: '2026-03-29',
      startTime: '15:00:00',
      endTime: '23:00:00',
      assignedStaff: staff2,
      published: true,
    });
    const seattleLinePrep = await this.ensureShift({
      location: loc4,
      requiredSkill: skillCook,
      date: '2026-03-28',
      startTime: '16:00:00',
      endTime: '23:59:59',
      assignedStaff: staff2,
      published: false,
    });
    const seattleServerOpen = await this.ensureShift({
      location: loc4,
      requiredSkill: skillServer,
      date: '2026-03-30',
      startTime: '09:00:00',
      endTime: '15:00:00',
      assignedStaff: null,
      published: false,
    });

    await this.ensureNotificationPreference(admin, true, true);
    await this.ensureNotificationPreference(eastManager, true, true);
    await this.ensureNotificationPreference(westManager, true, false);
    await this.ensureNotificationPreference(staff1, true, false);
    await this.ensureNotificationPreference(staff2, true, false);
    await this.ensureNotificationPreference(staff3, true, true);
    await this.ensureNotificationPreference(staff4, true, false);

    await this.ensureNotification({
      user: staff1,
      type: 'SHIFT_ASSIGNED',
      title: 'New shift assigned',
      message: 'You were assigned to the NYC lunch shift on March 24 from 11:00 to 17:00.',
      metadata: { emailEnabled: false },
    });
    await this.ensureNotification({
      user: staff1,
      type: 'SHIFT_UPDATED',
      title: 'Shift updated',
      message: 'Your Thursday host coverage was moved to a later start to avoid overlap.',
      metadata: { emailEnabled: false },
    });
    await this.ensureNotification({
      user: staff1,
      type: 'SCHEDULE_PUBLISHED',
      title: 'Schedule published',
      message: 'Your next weekly schedule has been published for Coastal Eats NYC.',
      metadata: { emailEnabled: false },
      readAt: new Date(),
    });
    await this.ensureNotification({
      user: staff3,
      type: 'SWAP_REQUEST_APPROVED',
      title: 'Swap approved',
      message: 'A manager approved your Friday shift adjustment.',
      metadata: { emailEnabled: true },
    });
    await this.ensureNotification({
      user: staff4,
      type: 'DROP_REQUEST_OPEN',
      title: 'Open shift available',
      message: 'A qualified open shift is available in Miami this Saturday.',
      metadata: { emailEnabled: false },
    });
    await this.ensureNotification({
      user: eastManager,
      type: 'SWAP_APPROVAL_REQUIRED',
      title: 'Swap approval required',
      message: 'A Friday evening server swap is waiting for manager approval.',
      metadata: { emailEnabled: true },
    });
    await this.ensureNotification({
      user: eastManager,
      type: 'AVAILABILITY_CHANGED',
      title: 'Availability changed',
      message: 'Noah Flex updated weekday availability at NYC and Miami.',
      metadata: { emailEnabled: true },
    });
    await this.ensureNotification({
      user: eastManager,
      type: 'OVERTIME_WARNING',
      title: 'Projected overtime warning',
      message: 'Maria Bartender is projected above 35 hours if the Sunday close stays assigned.',
      metadata: { emailEnabled: true },
    });
    await this.ensureNotification({
      user: westManager,
      type: 'OVERTIME_WARNING',
      title: 'Projected overtime warning',
      message: 'John Cook is approaching 40 hours with the Seattle prep block still assigned.',
      metadata: { emailEnabled: false },
    });
    await this.ensureNotification({
      user: admin,
      type: 'OVERTIME_WARNING',
      title: 'Cross-location overtime alert',
      message: 'The LA location has two staff members approaching overtime this week.',
      metadata: { emailEnabled: true },
    });
    await this.ensureNotification({
      user: admin,
      type: 'SCHEDULE_PUBLISHED',
      title: 'Schedule published',
      message: 'East Coast schedules for the week of March 23 have been published.',
      metadata: { emailEnabled: true },
    });

    const seededSwap: Partial<SwapRequest> = {
      type: 'SWAP',
      status: 'PENDING_MANAGER',
      reason: 'Need to trade Friday coverage for family travel.',
      initiatorUser: staff1,
      initiatorShift: nycLunch,
      targetShift: nycHostEvening,
      targetUser: staff4,
    };
    const seededDrop: Partial<SwapRequest> = {
      type: 'DROP',
      status: 'PENDING_PEER',
      reason: 'Can no longer make the dinner block.',
      initiatorUser: staff3,
      initiatorShift: miamiDinner,
    };

    await this.ensureSwap(seededSwap);
    await this.ensureSwap(seededDrop);

    await this.ensureAuditLog({
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
    });
    await this.ensureAuditLog({
      shift: nycFridayClose,
      location: loc1,
      action: 'SHIFT_ASSIGNED',
      actorId: eastManager.id,
      actorName: eastManager.name,
      actorRole: eastManager.role,
      beforeState: { assignedStaffId: null, assignedStaffName: null },
      afterState: { assignedStaffId: staff3.id, assignedStaffName: staff3.name },
      summary: 'Assigned Maria Bartender to the overnight closing shift.',
    });
    await this.ensureAuditLog({
      shift: nycFridayClose,
      location: loc1,
      action: 'SHIFT_PUBLISHED',
      actorId: eastManager.id,
      actorName: eastManager.name,
      actorRole: eastManager.role,
      beforeState: { published: false },
      afterState: { published: true },
      summary: 'Published a NYC schedule block to staff.',
    });
    await this.ensureAuditLog({
      shift: nycLunch,
      location: loc1,
      action: 'SHIFT_ASSIGNED',
      actorId: eastManager.id,
      actorName: eastManager.name,
      actorRole: eastManager.role,
      beforeState: { assignedStaffId: null, assignedStaffName: null },
      afterState: { assignedStaffId: staff1.id, assignedStaffName: staff1.name },
      summary: 'Assigned Sarah Server to Tuesday lunch coverage.',
    });
    await this.ensureAuditLog({
      shift: laLineClose,
      location: loc3,
      action: 'SHIFT_PUBLISHED',
      actorId: westManager.id,
      actorName: westManager.name,
      actorRole: westManager.role,
      beforeState: { published: false },
      afterState: { published: true },
      summary: 'Published the LA line cook schedule block.',
    });
    await this.ensureAuditLog({
      shift: seattleLinePrep,
      location: loc4,
      action: 'SHIFT_REASSIGNED',
      actorId: westManager.id,
      actorName: westManager.name,
      actorRole: westManager.role,
      beforeState: { assignedStaffId: null, assignedStaffName: null },
      afterState: { assignedStaffId: staff2.id, assignedStaffName: staff2.name },
      summary: 'Placed John Cook on Seattle evening prep coverage.',
    });
    await this.ensureAuditLog({
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
    });

    this.logger.log('Seed data successfully committed.');
  }
}
