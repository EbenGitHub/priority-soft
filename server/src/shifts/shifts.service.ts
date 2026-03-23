import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Shift } from './entities/shift.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Skill } from '../users/entities/skill.entity';
import { AvailabilityType } from '../users/enums/availability-type.enum';
import { SwapRequest } from '../swaps/entities/swap.entity';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { availabilityContainsShift, buildShiftUtcRange, getLocalDateKey, getShiftUtcRange } from '../calendar/calendar-time.util';
import { AuditService } from '../audit/audit.service';
import { AuthzService } from '../authz/authz.service';
import { Permission } from '../authz/permissions.enum';
import { SettingsService } from '../settings/settings.service';

type AuditActorPayload = {
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  cutoffOverrideReason?: string;
};

type OvertimeNotificationPayload = {
  locationId: string;
  assignedStaffName: string;
  weeklyHours: number;
  shiftId: string;
  userId: string;
};

type CutoffOverrideContext = {
  shift: Shift;
  actor: { actorId: string; actorName: string; actorRole: string };
  reason: string;
  actionLabel: string;
};

@Injectable()
export class ShiftsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Shift) private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Location) private readonly locRepo: Repository<Location>,
    @InjectRepository(Skill) private readonly skillRepo: Repository<Skill>,
    @InjectRepository(SwapRequest) private readonly swapRepo: Repository<SwapRequest>,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    private readonly authzService: AuthzService,
    private readonly settingsService: SettingsService,
  ) {}

  private snapshotShift(shift: Shift) {
    return {
      shiftId: shift.id,
      date: shift.date,
      endDate: shift.endDate,
      startTime: shift.startTime,
      endTime: shift.endTime,
      startUtc: shift.startUtc?.toISOString?.() || null,
      endUtc: shift.endUtc?.toISOString?.() || null,
      isOvernight: shift.isOvernight,
      skipManagerApproval: shift.skipManagerApproval,
      published: shift.published,
      assignedStaffId: shift.assignedStaff?.id || null,
      assignedStaffName: shift.assignedStaff?.name || null,
      requiredSkillId: shift.requiredSkill?.id || null,
      requiredSkillName: shift.requiredSkill?.name || null,
      locationId: shift.location?.id || null,
      locationName: shift.location?.name || null,
      scheduleGroupId: shift.scheduleGroupId || null,
      headcountNeeded: shift.headcountNeeded,
      slotIndex: shift.slotIndex,
    };
  }

  private async buildAlternativeSuggestions(shift: Shift, excludedUserId?: string) {
    const staffMembers = await this.userRepo.find({
      where: { role: 'STAFF' as any },
      relations: ['locations', 'skills', 'availabilities'],
    });

    const suggestions: Array<{ id: string; name: string }> = [];

    for (const staffMember of staffMembers) {
      if (staffMember.id === excludedUserId) continue;

      try {
        await this.validateAssignment(shift, staffMember.id, undefined, false);
        suggestions.push({ id: staffMember.id, name: staffMember.name });
      } catch {
        continue;
      }

      if (suggestions.length >= 3) break;
    }

    return suggestions;
  }

  private async acquireStaffAssignmentLock(queryRunner: { query: (query: string, parameters?: any[]) => Promise<any> }, userId: string) {
    await queryRunner.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`assign-staff:${userId}`]);
  }

  private async authorizeScheduleMutation(locationId: string, actor: AuditActorPayload | undefined, permission: Permission) {
    const actingUser = await this.authzService.assertLocationPermission(actor?.actorId, permission, locationId);
    return {
      actorId: actingUser.id,
      actorName: actingUser.name,
      actorRole: actingUser.role,
    };
  }

  private normalizeShiftTiming(
    data: { date: string; startTime: string; endTime: string; endDate?: string | null },
    timeZone: string,
  ) {
    const timing = buildShiftUtcRange(data.date, data.startTime, data.endTime, timeZone, data.endDate);
    if (timing.durationHours <= 0) {
      throw new BadRequestException('Shift end must be after shift start.');
    }
    if (timing.durationHours > 24) {
      throw new BadRequestException('Shift duration cannot exceed 24 hours.');
    }
    return timing;
  }

  async createShift(data: { locationId: string; date: string; endDate?: string; startTime: string; endTime: string; requiredSkillId: string; headcountNeeded?: number; skipManagerApproval?: boolean; actorId?: string; actorName?: string; actorRole?: string }) {
    const loc = await this.locRepo.findOneBy({ id: data.locationId });
    const skill = await this.skillRepo.findOneBy({ id: data.requiredSkillId });
    if (!loc || !skill) throw new NotFoundException('Invalid location or skill');
    const normalizedActor = await this.authorizeScheduleMutation(loc.id, data, Permission.SHIFT_CREATE);
    const requestedHeadcount = Math.max(1, data.headcountNeeded || 1);
    const timing = this.normalizeShiftTiming(data, loc.timezone);

    const existingGroup = await this.shiftRepo.find({
      where: {
        location: { id: data.locationId },
        requiredSkill: { id: data.requiredSkillId },
        date: data.date,
        endDate: timing.endDate,
        startTime: data.startTime,
        endTime: data.endTime,
      },
      relations: ['location', 'requiredSkill', 'assignedStaff'],
      order: { slotIndex: 'ASC' },
    });

    let saved: Shift;
    let groupId = existingGroup[0]?.scheduleGroupId || existingGroup[0]?.id || randomUUID();

    if (existingGroup.length > 0) {
      for (const slot of existingGroup) {
        slot.headcountNeeded = requestedHeadcount;
        slot.scheduleGroupId = groupId;
        slot.endDate = timing.endDate;
        slot.skipManagerApproval = Boolean(data.skipManagerApproval);
      }
      await this.shiftRepo.save(existingGroup);

      if (requestedHeadcount > existingGroup.length) {
        const extraSlots = Array.from({ length: requestedHeadcount - existingGroup.length }, (_, index) =>
          this.shiftRepo.create({
            location: loc,
            requiredSkill: skill,
            date: data.date,
            endDate: timing.endDate,
            startTime: data.startTime,
            endTime: data.endTime,
            startUtc: timing.startUtc,
            endUtc: timing.endUtc,
            isOvernight: timing.isOvernight,
            skipManagerApproval: Boolean(data.skipManagerApproval),
            published: false,
            scheduleGroupId: groupId,
            headcountNeeded: requestedHeadcount,
            slotIndex: existingGroup.length + index + 1,
          }),
        );
        const createdSlots = await this.shiftRepo.save(extraSlots);
        saved = createdSlots[0];
      } else {
        saved = existingGroup[0];
      }
    } else {
      const slots = Array.from({ length: requestedHeadcount }, (_, index) =>
        this.shiftRepo.create({
          location: loc,
          requiredSkill: skill,
          date: data.date,
          endDate: timing.endDate,
          startTime: data.startTime,
          endTime: data.endTime,
          startUtc: timing.startUtc,
          endUtc: timing.endUtc,
          isOvernight: timing.isOvernight,
          skipManagerApproval: Boolean(data.skipManagerApproval),
          published: false,
          scheduleGroupId: groupId,
          headcountNeeded: requestedHeadcount,
          slotIndex: index + 1,
        }),
      );
      const createdSlots = await this.shiftRepo.save(slots);
      saved = createdSlots[0];
    }

    await this.auditService.logShiftChange({
      shift: saved,
      location: loc,
      action: 'SHIFT_CREATED',
      actor: normalizedActor,
      beforeState: null,
      afterState: this.snapshotShift({
        ...saved,
        location: loc,
        requiredSkill: skill,
      } as Shift),
      summary: `Created schedule for ${loc.name} on ${saved.date} from ${saved.startTime} to ${saved.endTime} with headcount ${requestedHeadcount}.`,
    });
    this.eventsGateway.emitScheduleUpdate();
    return { scheduleGroupId: groupId, headcountNeeded: requestedHeadcount, primaryShiftId: saved.id };
  }

  async updateShift(
    shiftId: string,
    data: {
      locationId: string;
      date: string;
      endDate?: string;
      startTime: string;
      endTime: string;
      requiredSkillId: string;
      headcountNeeded?: number;
      skipManagerApproval?: boolean;
      cutoffOverrideReason?: string;
      actorId?: string;
      actorName?: string;
      actorRole?: string;
    },
  ) {
    const existingShift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['location', 'requiredSkill', 'assignedStaff'],
    });
    if (!existingShift) throw new NotFoundException('Shift not found');

    const nextLocation = await this.locRepo.findOneBy({ id: data.locationId });
    const nextSkill = await this.skillRepo.findOneBy({ id: data.requiredSkillId });
    if (!nextLocation || !nextSkill) throw new NotFoundException('Invalid location or skill');

    await this.authorizeScheduleMutation(existingShift.location.id, data, Permission.SHIFT_CREATE);
    const normalizedActor = await this.authorizeScheduleMutation(nextLocation.id, data, Permission.SHIFT_CREATE);
    const timing = this.normalizeShiftTiming(data, nextLocation.timezone);
    const groupId = existingShift.scheduleGroupId || existingShift.id;
    const requestedHeadcount = Math.max(1, data.headcountNeeded || 1);

    const groupShifts = await this.shiftRepo.find({
      where: [{ scheduleGroupId: groupId }, { id: groupId }],
      relations: ['location', 'requiredSkill', 'assignedStaff'],
      order: { slotIndex: 'ASC' },
    });
    const targetShifts = groupShifts.length > 0 ? groupShifts : [existingShift];

    for (const shift of targetShifts) {
      this.validateCutoff(shift, data.cutoffOverrideReason);
    }

    const assignedCount = targetShifts.filter((shift) => Boolean(shift.assignedStaff)).length;
    if (requestedHeadcount < assignedCount) {
      throw new BadRequestException(`Cannot reduce headcount below currently assigned staff count (${assignedCount}).`);
    }

    const cancelledSwaps = await this.cancelPendingSwapsForShiftIds(targetShifts.map((shift) => shift.id));

    for (const shift of targetShifts) {
      shift.location = nextLocation;
      shift.requiredSkill = nextSkill;
      shift.date = data.date;
      shift.endDate = timing.endDate;
      shift.startTime = data.startTime;
      shift.endTime = data.endTime;
      shift.startUtc = timing.startUtc;
      shift.endUtc = timing.endUtc;
      shift.isOvernight = timing.isOvernight;
      shift.headcountNeeded = requestedHeadcount;
      shift.scheduleGroupId = groupId;
      shift.skipManagerApproval = Boolean(data.skipManagerApproval);
    }

    let updatedShifts = await this.shiftRepo.save(targetShifts);

    if (requestedHeadcount > updatedShifts.length) {
      const extra = Array.from({ length: requestedHeadcount - updatedShifts.length }, (_, index) =>
        this.shiftRepo.create({
          location: nextLocation,
          requiredSkill: nextSkill,
          date: data.date,
          endDate: timing.endDate,
          startTime: data.startTime,
          endTime: data.endTime,
          startUtc: timing.startUtc,
          endUtc: timing.endUtc,
          isOvernight: timing.isOvernight,
          skipManagerApproval: Boolean(data.skipManagerApproval),
          published: false,
          scheduleGroupId: groupId,
          headcountNeeded: requestedHeadcount,
          slotIndex: updatedShifts.length + index + 1,
        }),
      );
      updatedShifts = [...updatedShifts, ...(await this.shiftRepo.save(extra))];
    } else if (requestedHeadcount < updatedShifts.length) {
      const removable = [...updatedShifts]
        .filter((shift) => !shift.assignedStaff)
        .sort((left, right) => right.slotIndex - left.slotIndex)
        .slice(0, updatedShifts.length - requestedHeadcount);
      if (removable.length > 0) {
        await this.shiftRepo.remove(removable);
        updatedShifts = updatedShifts.filter((shift) => !removable.some((item) => item.id === shift.id));
      }
    }

    for (const shift of updatedShifts) {
      await this.auditService.logShiftChange({
        shift,
        location: nextLocation,
        action: 'SHIFT_UPDATED',
        actor: normalizedActor,
        beforeState: shift.id === existingShift.id ? this.snapshotShift(existingShift) : null,
        afterState: {
          ...this.snapshotShift(shift),
          cutoffOverrideReason: data.cutoffOverrideReason?.trim() || null,
        },
        summary: `Updated schedule at ${nextLocation.name} for ${shift.date} ${shift.startTime}-${shift.endTime}.${data.cutoffOverrideReason?.trim() ? ` Override reason: ${data.cutoffOverrideReason.trim()}` : ''}`,
      });
    }

    if (data.cutoffOverrideReason?.trim()) {
      await this.notifyCutoffOverrideUsed({
        shift: updatedShifts[0],
        actor: normalizedActor,
        reason: data.cutoffOverrideReason.trim(),
        actionLabel: 'edit the schedule',
      });
    }

    for (const swap of cancelledSwaps) {
      const swapUsers = [swap.initiatorUser?.id, swap.targetUser?.id].filter(Boolean) as string[];
      await this.notificationsService.createForUsers(swapUsers, {
        type: 'SWAP_REQUEST_CANCELLED',
        title: 'Pending swap cancelled',
        message: 'A manager edited the underlying shift, so the pending swap or drop request was cancelled.',
        metadata: { shiftId: existingShift.id, swapId: swap.id },
      });
    }

    this.eventsGateway.emitScheduleUpdate();
    return { scheduleGroupId: groupId, headcountNeeded: requestedHeadcount, primaryShiftId: updatedShifts[0]?.id || existingShift.id };
  }

  async findAll(actorId?: string) {
    if (actorId) {
      const actor = await this.userRepo.findOne({ where: { id: actorId } });
      if (actor?.role === 'STAFF') {
        return this.shiftRepo.find({
          where: { published: true },
          relations: ['requiredSkill', 'assignedStaff', 'location'],
          order: { date: 'ASC', startTime: 'ASC' },
        });
      }
    }

    return this.shiftRepo.find({
      relations: ['requiredSkill', 'assignedStaff', 'location'],
      order: { date: 'ASC', startTime: 'ASC' }
    });
  }

  async findByLocation(locationId: string) {
    return this.shiftRepo.find({
      where: { location: { id: locationId } },
      relations: ['requiredSkill', 'assignedStaff', 'location'],
      order: { date: 'ASC', startTime: 'ASC' }
    });
  }

  async findOneForWorkflow(shiftId: string) {
    return this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['location', 'requiredSkill', 'assignedStaff'],
    });
  }

  private getDayOfWeek(dateStr: string): number {
    return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  }

  private getShiftDuration(shift: Shift): number {
    return getShiftUtcRange(shift).durationHours;
  }

  private async notifyManagersForLocation(locationId: string, payload: Parameters<NotificationsService['createForUsers']>[1]) {
    const managers = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.locations', 'location')
      .where('user.role = :role', { role: 'MANAGER' })
      .andWhere('location.id = :locationId', { locationId })
      .getMany();

    await this.notificationsService.createForUsers(
      managers.map((manager) => manager.id),
      payload,
    );
  }

  private async notifyManagersAndAdminsForLocation(
    locationId: string,
    payload: Parameters<NotificationsService['createForUsers']>[1],
  ) {
    const managers = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.locations', 'location')
      .where('user.role = :managerRole', { managerRole: 'MANAGER' })
      .andWhere('location.id = :locationId', { locationId })
      .getMany();

    const admins = await this.userRepo.find({
      where: { role: 'ADMIN' as any },
    });

    await this.notificationsService.createForUsers(
      [...managers.map((manager) => manager.id), ...admins.map((admin) => admin.id)],
      payload,
    );
  }

  private async notifyCutoffOverrideUsed({
    shift,
    actor,
    reason,
    actionLabel,
  }: CutoffOverrideContext) {
    await this.notifyManagersAndAdminsForLocation(shift.location.id, {
      type: 'SCHEDULE_OVERRIDE_USED',
      title: 'Cutoff override used',
      message: `${actor.actorName} used a cutoff override to ${actionLabel} at ${shift.location.name}. Reason: ${reason}`,
      metadata: {
        shiftId: shift.id,
        locationId: shift.location.id,
        actorId: actor.actorId,
        action: actionLabel,
        cutoffOverrideReason: reason,
      },
    });
  }

  private async getWeeklyHoursForStaff(staffId: string, shift: Shift) {
    const shiftDate = new Date(`${shift.date}T12:00:00Z`);
    const day = shiftDate.getUTCDay();
    const weekStart = new Date(shiftDate);
    weekStart.setUTCDate(shiftDate.getUTCDate() - day);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    const start = weekStart.toISOString().split('T')[0];
    const end = weekEnd.toISOString().split('T')[0];

    const shifts = await this.shiftRepo
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.assignedStaff', 'assignedStaff')
      .where('assignedStaff.id = :staffId', { staffId })
      .andWhere('shift.date BETWEEN :start AND :end', { start, end })
      .getMany();

    return shifts.reduce((total, scheduledShift) => total + this.getShiftDuration(scheduledShift), 0);
  }

  private getWeekRange(weekStart: string) {
    const start = new Date(`${weekStart}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  }

  private calculateConsecutiveDays(shifts: Shift[], newShift: Shift): number {
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

  public async getCutoffHours() {
    return this.settingsService.getCutoffHours();
  }

  public validateCutoff(shift: Shift, overrideReason?: string, configuredCutoffHours = 48) {
    const shiftStart = getShiftUtcRange(shift).startUtc.getTime();
    const now = Date.now();
    const diffHours = (shiftStart - now) / (1000 * 60 * 60);
    if (diffHours <= 0) {
      throw new ForbiddenException('Cannot modify a shift that has already started or already passed.');
    }
    if (diffHours < configuredCutoffHours) {
      if (overrideReason?.trim()) return true;
      throw new ForbiddenException({
        code: 'CUTOFF_OVERRIDE_REQUIRED',
        message: `Cannot modify schedule within ${configuredCutoffHours} hours of shift without an override reason.`,
        shiftStartsInHours: Number(diffHours.toFixed(1)),
        cutoffHours: configuredCutoffHours,
      });
    }
    return false;
  }

  private async cancelPendingSwapsForShiftIds(shiftIds: string[]) {
    if (shiftIds.length === 0) return [];
    const activeSwaps = await this.swapRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.initiatorUser', 'initiatorUser')
      .leftJoinAndSelect('s.targetUser', 'targetUser')
      .where('s.status IN (:...statuses)', { statuses: ['PENDING_PEER', 'PENDING_MANAGER'] })
      .andWhere('(s.initiatorShiftId IN (:...shiftIds) OR s.targetShiftId IN (:...shiftIds))', { shiftIds })
      .getMany();

    for (const swap of activeSwaps) {
      swap.status = 'CANCELLED';
      await this.swapRepo.save(swap);
    }

    return activeSwaps;
  }

  async togglePublish(shiftId: string, actor?: AuditActorPayload) {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['assignedStaff', 'location'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    const normalizedActor = await this.authorizeScheduleMutation(shift.location.id, actor, Permission.SHIFT_PUBLISH);
    const cutoffHours = await this.getCutoffHours();
    const usedCutoffOverride = shift.published ? this.validateCutoff(shift, actor?.cutoffOverrideReason, cutoffHours) : false;
    const beforeState = this.snapshotShift(shift);

    shift.published = !shift.published;
    const saved = await this.shiftRepo.save(shift);
    await this.auditService.logShiftChange({
      shift: saved,
      location: saved.location,
      action: saved.published ? 'SHIFT_PUBLISHED' : 'SHIFT_UNPUBLISHED',
      actor: normalizedActor,
      beforeState,
      afterState: {
        ...this.snapshotShift(saved),
        cutoffOverrideReason: usedCutoffOverride ? actor?.cutoffOverrideReason || null : null,
      },
      summary: saved.published
        ? `Published shift at ${saved.location.name}.`
        : `Unpublished shift at ${saved.location.name}.${usedCutoffOverride ? ` Override reason: ${actor?.cutoffOverrideReason}` : ''}`,
    });
    this.eventsGateway.emitScheduleUpdate();

    if (saved.published && saved.assignedStaff) {
      await this.notificationsService.createForUser(saved.assignedStaff.id, {
        type: 'SCHEDULE_PUBLISHED',
        title: 'Schedule published',
        message: `${saved.location.name} published your ${saved.date} shift schedule.`,
        metadata: { shiftId: saved.id },
      });
    }

    return saved;
  }

  async publishWeek(locationId: string, weekStart: string, publish: boolean, actor?: AuditActorPayload) {
    const normalizedActor = await this.authorizeScheduleMutation(locationId, actor, Permission.SHIFT_PUBLISH);
    const { start, end } = this.getWeekRange(weekStart);
    const targetShifts = await this.shiftRepo
      .createQueryBuilder('shift')
      .leftJoinAndSelect('shift.location', 'location')
      .leftJoinAndSelect('shift.assignedStaff', 'assignedStaff')
      .leftJoinAndSelect('shift.requiredSkill', 'requiredSkill')
      .where('location.id = :locationId', { locationId })
      .andWhere('shift.date BETWEEN :start AND :end', { start, end })
      .getMany();
    for (const shift of targetShifts) {
      const usedCutoffOverride = !publish && shift.published
        ? this.validateCutoff(shift, actor?.cutoffOverrideReason, await this.getCutoffHours())
        : false;
      if (!publish && shift.published) {
      }

      if (shift.published === publish) continue;

      const beforeState = this.snapshotShift(shift);
      shift.published = publish;
      const saved = await this.shiftRepo.save(shift);
      await this.auditService.logShiftChange({
        shift: saved,
        location: saved.location,
        action: publish ? 'SHIFT_PUBLISHED' : 'SHIFT_UNPUBLISHED',
        actor: normalizedActor,
        beforeState,
        afterState: {
          ...this.snapshotShift(saved),
          cutoffOverrideReason: usedCutoffOverride ? actor?.cutoffOverrideReason || null : null,
        },
        summary: publish
          ? `Published weekly schedule slot at ${saved.location.name}.`
          : `Unpublished weekly schedule slot at ${saved.location.name}.${usedCutoffOverride ? ` Override reason: ${actor?.cutoffOverrideReason}` : ''}`,
      });

      if (publish && saved.assignedStaff) {
        await this.notificationsService.createForUser(saved.assignedStaff.id, {
          type: 'SCHEDULE_PUBLISHED',
          title: 'Schedule published',
          message: `${saved.location.name} published your ${saved.date} shift schedule.`,
          metadata: { shiftId: saved.id },
        });
      }
    }

    this.eventsGateway.emitScheduleUpdate();
    return { updated: targetShifts.length, weekStart, locationId, publish };
  }

  async validateAssignment(shift: Shift, userId: string, overrideReason?: string, includeSuggestions = true) {
    const staff = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['locations', 'skills', 'availabilities']
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    if (!staff.locations.some(l => l.id === shift.location.id)) {
      throw new BadRequestException({
        message: 'Staff member is not certified to work at this location.',
        suggestions: includeSuggestions ? await this.buildAlternativeSuggestions(shift, staff.id) : [],
      });
    }

    if (!staff.skills.some(s => s.id === shift.requiredSkill.id)) {
      throw new BadRequestException({
        message: 'Missing required specialized skill tag for this shift.',
        suggestions: includeSuggestions ? await this.buildAlternativeSuggestions(shift, staff.id) : [],
      });
    }

    let isAvailable = false;

    for (const avail of staff.availabilities) {
      if (availabilityContainsShift(avail, shift)) isAvailable = true;
      if (isAvailable) break;
    }

    if (!isAvailable) {
      throw new BadRequestException({
        message: 'Employee has not explicitly flagged availability for this specific timestamp.',
        suggestions: includeSuggestions ? await this.buildAlternativeSuggestions(shift, staff.id) : [],
      });
    }

    const targetRange = getShiftUtcRange(shift);
    const targetStart = targetRange.startUtc.getTime();
    const targetEnd = targetRange.endUtc.getTime();

    const allStaffShifts = await this.shiftRepo.find({
      where: { assignedStaff: { id: staff.id } }
    });

    for (const existingShift of allStaffShifts) {
      if (existingShift.id === shift.id) continue;
      const existingRange = getShiftUtcRange(existingShift);
      const existingStart = existingRange.startUtc.getTime();
      const existingEnd = existingRange.endUtc.getTime();

      if (targetStart < existingEnd && targetEnd > existingStart) {
         throw new BadRequestException({
           message: `Overlaps completely with an existing shift (${existingShift.startTime}-${existingShift.endTime}).`,
           suggestions: includeSuggestions ? await this.buildAlternativeSuggestions(shift, staff.id) : [],
         });
      }

      const hoursBetweenBefore = (targetStart - existingEnd) / (1000 * 60 * 60);
      const hoursBetweenAfter = (existingStart - targetEnd) / (1000 * 60 * 60);

      if (targetStart >= existingEnd && hoursBetweenBefore < 10) {
        throw new BadRequestException({
          message: `Violates 10-hour rest compliance rule (Only rested ${hoursBetweenBefore.toFixed(1)} hours).`,
          suggestions: includeSuggestions ? await this.buildAlternativeSuggestions(shift, staff.id) : [],
        });
      }
      if (targetEnd <= existingStart && hoursBetweenAfter < 10) {
        throw new BadRequestException({
          message: `Violates 10-hour rest compliance rule (Next shift cuts rest to ${hoursBetweenAfter.toFixed(1)} hours).`,
          suggestions: includeSuggestions ? await this.buildAlternativeSuggestions(shift, staff.id) : [],
        });
      }
    }

    // Phase 5 Labor Laws Integration Bound:
    const shiftDayKey = getLocalDateKey(targetRange.startUtc, shift.location.timezone);
    const dailyHours =
      allStaffShifts
        .filter((scheduledShift) => getLocalDateKey(getShiftUtcRange(scheduledShift).startUtc, scheduledShift.location?.timezone || shift.location.timezone) === shiftDayKey)
        .reduce((acc, s) => acc + this.getShiftDuration(s), 0) + this.getShiftDuration(shift);
    if (dailyHours > 12) {
      throw new BadRequestException({
        message: 'Labor Law Block: Exceeds 12 active hours in a single deployment cycle.',
        suggestions: includeSuggestions ? await this.buildAlternativeSuggestions(shift, staff.id) : [],
      });
    }

    const consecutiveDays = this.calculateConsecutiveDays(allStaffShifts, shift);
    if (consecutiveDays >= 7) {
      if (!overrideReason) {
         throw new ConflictException(`Labor Law Limit: 7 Consecutive days requires explicit Manager Override Reasoning.`);
      }
      // System securely bypassed by explicitly recorded Manager override
      console.log(`[COMPLIANCE AUDIT] 7th-day progression forcefully overridden via Auth Code: ${overrideReason}`);
    }
  }

  private async assignStaffInternal(
    shiftId: string,
    userId: string | null,
    overrideReason?: string,
    actor?: AuditActorPayload & { systemAction?: boolean },
  ) {
    const currentShift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['location'],
    });
    if (!currentShift) throw new NotFoundException('Shift not found');
    const normalizedActor = actor?.systemAction
      ? { actorId: 'system-auto-approval', actorName: 'System Auto-Approval', actorRole: 'SYSTEM' }
      : await this.authorizeScheduleMutation(currentShift.location.id, actor, Permission.SHIFT_ASSIGN);

    const cutoffHours = await this.getCutoffHours();
    let cancelledSwaps: SwapRequest[] = [];
    let notificationUserId: string | null = null;
    let notificationPayload: Parameters<NotificationsService['createForUser']>[1] | null = null;
    let overtimePayload: OvertimeNotificationPayload | null = null;

    const saved = await this.dataSource.transaction(async (manager) => {
      const shiftRepo = manager.getRepository(Shift);
      const userRepo = manager.getRepository(User);
      const swapRepo = manager.getRepository(SwapRequest);

      if (userId !== null) {
        await this.acquireStaffAssignmentLock(manager, userId);
      }

      const shift = await shiftRepo.findOne({
        where: { id: shiftId },
        relations: ['location', 'requiredSkill', 'assignedStaff'],
      });
      if (!shift) throw new NotFoundException('Shift not found');

      const previousAssignedStaffId = shift.assignedStaff?.id ?? null;
      const beforeState = this.snapshotShift(shift);

      const usedCutoffOverride = shift.assignedStaff || shift.published
        ? this.validateCutoff(shift, actor?.cutoffOverrideReason, cutoffHours)
        : false;

      const activeSwaps = await swapRepo
        .createQueryBuilder('s')
        .leftJoinAndSelect('s.initiatorUser', 'initiatorUser')
        .leftJoinAndSelect('s.targetUser', 'targetUser')
        .where('s.status IN (:...statuses)', { statuses: ['PENDING_PEER', 'PENDING_MANAGER'] })
        .andWhere('(s.initiatorShiftId = :shiftId OR s.targetShiftId = :shiftId)', { shiftId: shift.id })
        .getMany();

      for (const swap of activeSwaps) {
        swap.status = 'CANCELLED';
        await swapRepo.save(swap);
      }
      cancelledSwaps = activeSwaps;

      if (userId === null) {
        shift.assignedStaff = null;
        const unassigned = await shiftRepo.save(shift);
        await this.auditService.logShiftChange({
          shift: unassigned,
          location: unassigned.location,
          action: 'SHIFT_UNASSIGNED',
          actor: normalizedActor,
          beforeState,
          afterState: {
            ...this.snapshotShift(unassigned),
            cutoffOverrideReason: usedCutoffOverride ? actor?.cutoffOverrideReason || null : null,
          },
          summary: `Removed staff assignment from shift at ${unassigned.location.name}.${usedCutoffOverride ? ` Override reason: ${actor?.cutoffOverrideReason}` : ''}`,
        });
        if (usedCutoffOverride && actor?.cutoffOverrideReason?.trim()) {
          await this.notifyCutoffOverrideUsed({
            shift: unassigned,
            actor: normalizedActor,
            reason: actor.cutoffOverrideReason.trim(),
            actionLabel: 'unassign staff from a locked shift',
          });
        }
        return unassigned;
      }

      await this.validateAssignment(shift, userId, overrideReason);
      const assignedStaff = await userRepo.findOneBy({ id: userId });
      if (!assignedStaff) throw new NotFoundException('Staff member not found');

      const allStaffShifts = await shiftRepo.find({
        where: { assignedStaff: { id: userId } },
        relations: ['location'],
      });
      const targetRange = getShiftUtcRange(shift);
      const targetStart = targetRange.startUtc.getTime();
      const targetEnd = targetRange.endUtc.getTime();

      for (const existingShift of allStaffShifts) {
        if (existingShift.id === shift.id) continue;
        const existingRange = getShiftUtcRange(existingShift);
        const existingStart = existingRange.startUtc.getTime();
        const existingEnd = existingRange.endUtc.getTime();

        if (targetStart < existingEnd && targetEnd > existingStart) {
          throw new ConflictException(
            `Concurrent assignment conflict: ${assignedStaff.name} was assigned to another overlapping shift while you were making this change.`,
          );
        }
      }

      shift.assignedStaff = assignedStaff;
      const timing = buildShiftUtcRange(shift.date, shift.startTime, shift.endTime, shift.location.timezone, shift.endDate);
      shift.startUtc = timing.startUtc;
      shift.endUtc = timing.endUtc;
      shift.isOvernight = timing.isOvernight;
      const assigned = await shiftRepo.save(shift);
      await this.auditService.logShiftChange({
        shift: assigned,
        location: assigned.location,
        action: previousAssignedStaffId && previousAssignedStaffId !== userId ? 'SHIFT_REASSIGNED' : 'SHIFT_ASSIGNED',
        actor: normalizedActor,
        beforeState,
        afterState: {
          ...this.snapshotShift(assigned),
          cutoffOverrideReason: usedCutoffOverride ? actor?.cutoffOverrideReason || null : null,
        },
        summary: previousAssignedStaffId && previousAssignedStaffId !== userId
          ? `Reassigned shift at ${assigned.location.name} to ${assignedStaff.name}.${usedCutoffOverride ? ` Override reason: ${actor?.cutoffOverrideReason}` : ''}`
          : `Assigned ${assignedStaff.name} to shift at ${assigned.location.name}.${usedCutoffOverride ? ` Override reason: ${actor?.cutoffOverrideReason}` : ''}`,
      });

      if (previousAssignedStaffId !== userId) {
        notificationUserId = userId;
        notificationPayload = {
          type: 'SHIFT_ASSIGNED',
          title: previousAssignedStaffId ? 'Shift reassigned to you' : 'New shift assigned',
          message: `You were assigned to the ${assigned.location.name} shift on ${assigned.date} from ${assigned.startTime.slice(0, 5)} to ${assigned.endTime.slice(0, 5)}.`,
          metadata: { shiftId: assigned.id },
        };
      }

      const weeklyHours = await this.getWeeklyHoursForStaff(userId, assigned);
      if (weeklyHours >= 35) {
        overtimePayload = {
          locationId: assigned.location.id,
          assignedStaffName: assignedStaff.name,
          weeklyHours,
          shiftId: assigned.id,
          userId,
        };
      }

      return assigned;
    });

    for (const swap of cancelledSwaps) {
      const swapUsers = [swap.initiatorUser?.id, swap.targetUser?.id].filter(Boolean) as string[];
      await this.notificationsService.createForUsers(swapUsers, {
        type: 'SWAP_REQUEST_CANCELLED',
        title: 'Pending swap cancelled',
        message: 'A manager changed the underlying shift, so the pending swap or drop request was cancelled.',
        metadata: { shiftId: saved.id, swapId: swap.id },
      });
    }

    this.eventsGateway.emitScheduleUpdate();

    if (notificationUserId && notificationPayload) {
      await this.notificationsService.createForUser(notificationUserId, notificationPayload);
    }

    if (overtimePayload !== null) {
      const payload = overtimePayload as OvertimeNotificationPayload;
      await this.notifyManagersForLocation(payload.locationId, {
        type: 'OVERTIME_WARNING',
        title: 'Projected overtime warning',
        message: `${payload.assignedStaffName} is projected for ${payload.weeklyHours.toFixed(1)} hours this week after this assignment.`,
        metadata: { shiftId: payload.shiftId, userId: payload.userId },
      });
    }

    return saved;
  }

  async assignStaff(shiftId: string, userId: string | null, overrideReason?: string, actor?: AuditActorPayload) {
    return this.assignStaffInternal(shiftId, userId, overrideReason, actor);
  }

  async assignStaffSystem(shiftId: string, userId: string | null, overrideReason?: string) {
    return this.assignStaffInternal(shiftId, userId, overrideReason, {
      systemAction: true,
    });
  }
}
