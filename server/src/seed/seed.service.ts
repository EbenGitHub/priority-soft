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
import { randomUUID } from 'crypto';
import {
  buildAuditFixtures,
  buildNotificationFixtures,
  buildSwapFixtures,
} from './seed.fixtures';

type SeedContext = Map<string, Promise<any>>;

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Availability)
    private readonly availabilityRepository: Repository<Availability>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(SwapRequest)
    private readonly swapRepository: Repository<SwapRequest>,
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
    if (existing) {
      existing.name = data.name || existing.name;
      existing.role = data.role || existing.role;
      existing.desiredHours = data.desiredHours ?? existing.desiredHours;
      existing.password = data.password || existing.password || 'password123';
      if (data.locations?.length) {
        existing.locations = data.locations;
      }
      if (data.skills?.length) {
        existing.skills = data.skills;
      }
      return this.userRepository.save(existing);
    }
    return this.userRepository.save(this.userRepository.create(data));
  }

  private async ensureRecurringAvailability(
    user: User,
    location: Location,
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
        location: { id: location.id },
      },
      relations: ['location'],
    });
    if (existing) return existing;

    return this.availabilityRepository.save({
      user,
      location,
      type: AvailabilityType.RECURRING,
      dayOfWeek,
      startTime,
      endTime,
      timezone,
    });
  }

  private async ensureExceptionAvailability(
    user: User,
    location: Location,
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
        location: { id: location.id },
      },
      relations: ['location'],
    });
    if (existing) return existing;

    return this.availabilityRepository.save({
      user,
      location,
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
    if (existing) {
      existing.inAppEnabled = inAppEnabled;
      existing.emailEnabled = emailEnabled;
      return this.preferenceRepository.save(existing);
    }

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
    endDate?: string | null;
    startTime: string;
    endTime: string;
    assignedStaff?: User | null;
    published?: boolean;
    headcountNeeded?: number;
    scheduleGroupId?: string;
    slotIndex?: number;
  }) {
    const timing = buildShiftUtcRange(
      data.date,
      data.startTime,
      data.endTime,
      data.location.timezone,
      data.endDate,
    );
    const existing = await this.shiftRepository
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.location', 'location')
      .leftJoinAndSelect('shift.requiredSkill', 'requiredSkill')
      .leftJoinAndSelect('shift.assignedStaff', 'assignedStaff')
      .where('location.id = :locationId', { locationId: data.location.id })
      .andWhere('requiredSkill.id = :requiredSkillId', { requiredSkillId: data.requiredSkill.id })
      .andWhere('shift.date = :date', { date: data.date })
      .andWhere('shift.startTime = :startTime', { startTime: data.startTime })
      .andWhere('shift.endTime = :endTime', { endTime: data.endTime })
      .andWhere('shift.slotIndex = :slotIndex', { slotIndex: data.slotIndex || 1 })
      .andWhere(
        timing.endDate ? 'shift.endDate = :endDate' : 'shift.endDate IS NULL',
        timing.endDate ? { endDate: timing.endDate } : {},
      )
      .getOne();

    if (existing) {
      existing.location = data.location;
      existing.requiredSkill = data.requiredSkill;
      existing.date = data.date;
      existing.endDate = timing.endDate;
      existing.startTime = data.startTime;
      existing.endTime = data.endTime;
      existing.startUtc = timing.startUtc;
      existing.endUtc = timing.endUtc;
      existing.isOvernight = timing.isOvernight;
      existing.assignedStaff = data.assignedStaff || null;
      existing.scheduleGroupId = data.scheduleGroupId || existing.scheduleGroupId || randomUUID();
      existing.headcountNeeded = data.headcountNeeded || 1;
      existing.slotIndex = data.slotIndex || 1;
      existing.published = Boolean(data.published);
      return this.shiftRepository.save(existing);
    }

    return this.shiftRepository.save({
      location: data.location,
      requiredSkill: data.requiredSkill,
      date: data.date,
      endDate: timing.endDate,
      startTime: data.startTime,
      endTime: data.endTime,
      startUtc: timing.startUtc,
      endUtc: timing.endUtc,
      isOvernight: timing.isOvernight,
      assignedStaff: data.assignedStaff || null,
      scheduleGroupId: data.scheduleGroupId || randomUUID(),
      headcountNeeded: data.headcountNeeded || 1,
      slotIndex: data.slotIndex || 1,
      published: Boolean(data.published),
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

  private getSeedContext(context?: SeedContext) {
    return context || new Map<string, Promise<any>>();
  }

  private cacheBundle<T>(
    context: SeedContext,
    key: string,
    factory: () => Promise<T>,
  ) {
    const cached = context.get(key);
    if (cached) {
      return cached as Promise<T>;
    }

    const promise = factory();
    context.set(key, promise);
    return promise;
  }

  private async ensureCoreReferences() {
    const loc1 = await this.findOrCreateLocation(
      'Coastal Eats - NYC',
      'America/New_York',
    );
    const loc2 = await this.findOrCreateLocation(
      'Coastal Eats - Miami',
      'America/New_York',
    );
    const loc3 = await this.findOrCreateLocation(
      'Coastal Eats - LA',
      'America/Los_Angeles',
    );
    const loc4 = await this.findOrCreateLocation(
      'Coastal Eats - Seattle',
      'America/Los_Angeles',
    );
    const locations = [loc1, loc2, loc3, loc4];

    const skillBartender = await this.findOrCreateSkill('bartender');
    const skillCook = await this.findOrCreateSkill('line cook');
    const skillServer = await this.findOrCreateSkill('server');
    const skillHost = await this.findOrCreateSkill('host');
    const skillBarback = await this.findOrCreateSkill('barback');
    const skillPrepCook = await this.findOrCreateSkill('prep cook');
    const skillDishwasher = await this.findOrCreateSkill('dishwasher');
    const skillExpo = await this.findOrCreateSkill('expo');
    const skillShiftLead = await this.findOrCreateSkill('shift lead');
    const skillPastry = await this.findOrCreateSkill('pastry cook');

    return {
      loc1,
      loc2,
      loc3,
      loc4,
      locations,
      skillBartender,
      skillCook,
      skillServer,
      skillHost,
      skillBarback,
      skillPrepCook,
      skillDishwasher,
      skillExpo,
      skillShiftLead,
      skillPastry,
    };
  }

  async ensureBootstrapAdmin() {
    const existingAdmin = await this.userRepository.findOne({
      where: { role: Role.ADMIN },
    });

    if (existingAdmin) {
      this.logger.log('Bootstrap admin already exists. Skipping demo seed on startup.');
      return existingAdmin;
    }

    const admin = await this.findOrCreateUser({
      name: 'Corporate Admin',
      email: 'admin@coastaleats.com',
      role: Role.ADMIN,
      password: 'password123',
      desiredHours: 0,
    });

    this.logger.log(`Bootstrap admin created: ${admin.email}`);
    return admin;
  }

  async seedUsersBundle(context?: SeedContext) {
    const seedContext = this.getSeedContext(context);
    return this.cacheBundle(seedContext, 'users', async () => {
      const {
      loc1,
      loc2,
      loc3,
      loc4,
      locations,
      skillBartender,
      skillCook,
      skillServer,
      skillHost,
      skillBarback,
      skillPrepCook,
      skillDishwasher,
      skillExpo,
      skillShiftLead,
      skillPastry,
    } = await this.ensureCoreReferences();

    const admin = await this.findOrCreateUser({
      name: 'Corporate Admin',
      email: 'admin@coastaleats.com',
      role: Role.ADMIN,
      locations: locations,
    });

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

    const staff1 = await this.findOrCreateUser({
      name: 'Sarah Server',
      email: 'sarah@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 35,
      locations: [loc1],
      skills: [skillServer, skillHost, skillExpo],
    });

    const staff2 = await this.findOrCreateUser({
      name: 'John Cook',
      email: 'john@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 40,
      locations: [loc3, loc4],
      skills: [skillCook, skillPrepCook, skillDishwasher],
    });

    const staff3 = await this.findOrCreateUser({
      name: 'Maria Bartender',
      email: 'maria@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 20,
      locations: [loc1, loc2],
      skills: [skillBartender, skillServer, skillBarback],
    });

    const staff4 = await this.findOrCreateUser({
      name: 'Noah Flex',
      email: 'noah@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 32,
      locations: [loc1, loc2],
      skills: [skillServer, skillHost, skillShiftLead],
    });

    const staff5 = await this.findOrCreateUser({
      name: 'Emma Cross-Coast',
      email: 'emma@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 30,
      locations: [loc1, loc3],
      skills: [skillServer, skillBartender, skillBarback, skillShiftLead],
    });

    const staff6 = await this.findOrCreateUser({
      name: 'Leo Closer',
      email: 'leo@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 38,
      locations: [loc1, loc2],
      skills: [skillBartender, skillServer, skillBarback],
    });

    const staff7 = await this.findOrCreateUser({
      name: 'Priya Prep',
      email: 'priya@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 42,
      locations: [loc3, loc4],
      skills: [skillCook, skillPrepCook, skillPastry],
    });

    const staff8 = await this.findOrCreateUser({
      name: 'Ava Host',
      email: 'ava@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 24,
      locations: [loc2],
      skills: [skillHost, skillServer, skillExpo],
    });

    for (let day = 1; day <= 5; day++) {
      await this.ensureRecurringAvailability(
        staff1,
        loc1,
        day,
        '09:00:00',
        '17:00:00',
        loc1.timezone,
      );
    }

    // John works evenings weekends (Fri, Sat, Sun)
    for (const day of [5, 6, 0]) {
      await this.ensureRecurringAvailability(
        staff2,
        loc3,
        day,
        '16:00:00',
        '23:59:59',
        loc3.timezone,
      );
    }

    // Maria is an exception test: available Dec 31st for a massive shift
    await this.ensureExceptionAvailability(
      staff3,
      loc1,
      '2026-12-31',
      '10:00:00',
      '22:00:00',
      loc1.timezone,
    );

    for (let day = 1; day <= 5; day++) {
      await this.ensureRecurringAvailability(
        staff4,
        loc1,
        day,
        '12:00:00',
        '22:00:00',
        loc1.timezone,
      );
    }

    for (let day = 1; day <= 5; day++) {
      await this.ensureRecurringAvailability(
        staff5,
        loc1,
        day,
        '09:00:00',
        '17:00:00',
        loc1.timezone,
      );
    }

    for (const day of [4, 5, 6, 0]) {
      await this.ensureRecurringAvailability(
        staff6,
        loc2,
        day,
        '16:00:00',
        '23:59:59',
        loc2.timezone,
      );
    }

    for (const day of [1, 2, 3, 4, 5, 6]) {
      await this.ensureRecurringAvailability(
        staff7,
        loc3,
        day,
        '14:00:00',
        '23:00:00',
        loc3.timezone,
      );
    }

    for (const day of [4, 5, 6]) {
      await this.ensureRecurringAvailability(
        staff8,
        loc2,
        day,
        '10:00:00',
        '18:00:00',
        loc2.timezone,
      );
    }

    await this.ensureNotificationPreference(admin, true, true);
    await this.ensureNotificationPreference(eastManager, true, true);
    await this.ensureNotificationPreference(westManager, true, false);
    await this.ensureNotificationPreference(staff1, true, false);
    await this.ensureNotificationPreference(staff2, true, false);
    await this.ensureNotificationPreference(staff3, true, true);
    await this.ensureNotificationPreference(staff4, true, false);
    await this.ensureNotificationPreference(staff5, true, false);
    await this.ensureNotificationPreference(staff6, true, true);
    await this.ensureNotificationPreference(staff7, true, false);
    await this.ensureNotificationPreference(staff8, true, false);

      return {
      admin,
      eastManager,
      westManager,
      staff1,
      staff2,
      staff3,
      staff4,
      staff5,
      staff6,
      staff7,
      staff8,
      loc1,
      loc2,
      loc3,
      loc4,
      skillBartender,
      skillCook,
      skillServer,
      skillHost,
      };
    });
  }

  async seedShiftsBundle(context?: SeedContext) {
    const seedContext = this.getSeedContext(context);
    return this.cacheBundle(seedContext, 'shifts', async () => {
      const {
      staff1,
      staff2,
      staff3,
      staff4,
      staff5,
      staff6,
      staff7,
      staff8,
      loc1,
      loc2,
      loc3,
      loc4,
      skillBartender,
      skillCook,
      skillServer,
      skillHost,
      } = await this.seedUsersBundle(seedContext);

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
    const sundayChaosShift = await this.ensureShift({
      location: loc2,
      requiredSkill: skillBartender,
      date: '2026-03-29',
      startTime: '19:00:00',
      endTime: '23:00:00',
      assignedStaff: staff6,
      published: true,
    });
    const sundayCoverageOption = await this.ensureShift({
      location: loc1,
      requiredSkill: skillBartender,
      date: '2026-03-29',
      startTime: '12:00:00',
      endTime: '18:00:00',
      assignedStaff: staff3,
      published: true,
    });
    const premiumNycSat = await this.ensureShift({
      location: loc1,
      requiredSkill: skillBartender,
      date: '2026-03-28',
      startTime: '18:00:00',
      endTime: '23:30:00',
      assignedStaff: staff3,
      published: true,
    });
    const premiumMiamiFri = await this.ensureShift({
      location: loc2,
      requiredSkill: skillBartender,
      date: '2026-03-27',
      startTime: '18:00:00',
      endTime: '23:30:00',
      assignedStaff: staff6,
      published: true,
    });
    const crossTimezoneEast = await this.ensureShift({
      location: loc1,
      requiredSkill: skillServer,
      date: '2026-03-31',
      startTime: '09:00:00',
      endTime: '17:00:00',
      assignedStaff: staff5,
      published: true,
    });
    const crossTimezoneWest = await this.ensureShift({
      location: loc3,
      requiredSkill: skillServer,
      date: '2026-04-01',
      startTime: '09:00:00',
      endTime: '17:00:00',
      assignedStaff: null,
      published: false,
    });
    const overtimeTrap1 = await this.ensureShift({
      location: loc3,
      requiredSkill: skillCook,
      date: '2026-03-24',
      startTime: '14:00:00',
      endTime: '22:00:00',
      assignedStaff: staff7,
      published: true,
    });
    const overtimeTrap2 = await this.ensureShift({
      location: loc3,
      requiredSkill: skillCook,
      date: '2026-03-25',
      startTime: '14:00:00',
      endTime: '22:00:00',
      assignedStaff: staff7,
      published: true,
    });
    const overtimeTrap3 = await this.ensureShift({
      location: loc3,
      requiredSkill: skillCook,
      date: '2026-03-26',
      startTime: '14:00:00',
      endTime: '22:00:00',
      assignedStaff: staff7,
      published: true,
    });
    const overtimeTrap4 = await this.ensureShift({
      location: loc4,
      requiredSkill: skillCook,
      date: '2026-03-27',
      startTime: '14:00:00',
      endTime: '22:00:00',
      assignedStaff: staff7,
      published: true,
    });
    const overtimeTrap5 = await this.ensureShift({
      location: loc4,
      requiredSkill: skillCook,
      date: '2026-03-28',
      startTime: '14:00:00',
      endTime: '22:00:00',
      assignedStaff: staff7,
      published: true,
    });
    const overtimeTrap6 = await this.ensureShift({
      location: loc4,
      requiredSkill: skillCook,
      date: '2026-03-29',
      startTime: '14:00:00',
      endTime: '22:00:00',
      assignedStaff: staff7,
      published: true,
    });
    const fairnessComplaintShift = await this.ensureShift({
      location: loc2,
      requiredSkill: skillBartender,
      date: '2026-04-03',
      startTime: '18:00:00',
      endTime: '23:00:00',
      assignedStaff: staff6,
      published: false,
    });

      return {
      nycLunch,
      nycHostEvening,
      nycFridayClose,
      miamiDinner,
      miamiHost,
      laLineClose,
      seattleLinePrep,
      seattleServerOpen,
      sundayChaosShift,
      sundayCoverageOption,
      premiumNycSat,
      premiumMiamiFri,
      crossTimezoneEast,
      crossTimezoneWest,
      overtimeTrap1,
      overtimeTrap2,
      overtimeTrap3,
      overtimeTrap4,
      overtimeTrap5,
      overtimeTrap6,
      fairnessComplaintShift,
      staff1,
      staff3,
      staff4,
      staff5,
      staff6,
      staff7,
      staff8,
      loc1,
      loc2,
      loc3,
      loc4,
      };
    });
  }

  async seedNotificationsBundle(context?: SeedContext) {
    const seedContext = this.getSeedContext(context);
    return this.cacheBundle(seedContext, 'notifications', async () => {
      const {
        admin,
        eastManager,
        westManager,
        staff1,
        staff3,
        staff4,
        staff5,
        staff6,
        staff7,
      } = await this.seedUsersBundle(seedContext);

      for (const notification of buildNotificationFixtures({
        admin,
        eastManager,
        westManager,
        staff1,
        staff3,
        staff4,
        staff5,
        staff6,
        staff7,
      })) {
        await this.ensureNotification(notification);
      }
    });
  }

  async seedAuditBundle(context?: SeedContext) {
    const seedContext = this.getSeedContext(context);
    return this.cacheBundle(seedContext, 'audit', async () => {
      const {
      admin,
      eastManager,
      westManager,
      staff1,
      staff2,
      staff3,
      staff4,
      staff5,
      staff6,
      staff7,
      staff8,
      nycLunch,
      nycHostEvening,
      nycFridayClose,
      miamiDinner,
      miamiHost,
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
    } = {
      ...(await this.seedUsersBundle(seedContext)),
      ...(await this.seedShiftsBundle(seedContext)),
    };

      for (const swap of buildSwapFixtures({
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
      })) {
        await this.ensureSwap(swap);
      }

      for (const auditLog of buildAuditFixtures({
        admin,
        eastManager,
        westManager,
        staff1,
        staff2,
        staff3,
        staff5,
        staff6,
        staff7,
        nycLunch,
        nycHostEvening,
        nycFridayClose,
        miamiHost,
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
      })) {
        await this.ensureAuditLog(auditLog);
      }
    });
  }

  async seedAll() {
    this.logger.log('Ensuring Coastal Eats demo data exists...');
    const context = this.getSeedContext();
    await this.seedUsersBundle(context);
    this.logger.log('Users seeded successfully...');
    await this.seedShiftsBundle(context);
    this.logger.log('Shifts seeded successfully...');
    await this.seedNotificationsBundle(context);
    this.logger.log('Notifications seeded successfully...');
    await this.seedAuditBundle(context);
    this.logger.log('Audits seeded successfully...');
    this.logger.log('Seed data successfully committed.');
  }

  async onApplicationBootstrap() {
    await this.ensureBootstrapAdmin();
  }
}
