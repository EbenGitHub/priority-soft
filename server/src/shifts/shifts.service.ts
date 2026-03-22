import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Skill } from '../users/entities/skill.entity';
import { AvailabilityType } from '../users/enums/availability-type.enum';
import { SwapRequest } from '../swaps/entities/swap.entity';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift) private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Location) private readonly locRepo: Repository<Location>,
    @InjectRepository(Skill) private readonly skillRepo: Repository<Skill>,
    @InjectRepository(SwapRequest) private readonly swapRepo: Repository<SwapRequest>,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createShift(data: { locationId: string; date: string; startTime: string; endTime: string; requiredSkillId: string }) {
    const loc = await this.locRepo.findOneBy({ id: data.locationId });
    const skill = await this.skillRepo.findOneBy({ id: data.requiredSkillId });
    if (!loc || !skill) throw new NotFoundException('Invalid location or skill');

    const shift = this.shiftRepo.create({
      location: loc,
      requiredSkill: skill,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      published: false,
    });
    const saved = await this.shiftRepo.save(shift);
    this.eventsGateway.emitScheduleUpdate();
    return saved;
  }

  async findAll() {
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

  private parseDateTime(dateStr: string, timeStr: string): number {
    return new Date(`${dateStr}T${timeStr}`).getTime();
  }

  private getDayOfWeek(dateStr: string): number {
    return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  }

  private getShiftDuration(shift: Shift): number {
    if (!shift.startTime || !shift.endTime) return 0;
    const start = this.parseDateTime(shift.date, shift.startTime);
    const end = this.parseDateTime(shift.date, shift.endTime);
    return (end - start) / (1000 * 60 * 60);
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

  public validateCutoff(shift: Shift) {
    const shiftStart = this.parseDateTime(shift.date, shift.startTime);
    const now = Date.now();
    const diffHours = (shiftStart - now) / (1000 * 60 * 60);
    if (diffHours <= 48 && diffHours > -100) {
      throw new ForbiddenException(`Cannot modify schedule within 48 hours of shift. (Shift starts in ${diffHours.toFixed(1)} hours)`);
    }
  }

  async togglePublish(shiftId: string) {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId },
      relations: ['assignedStaff', 'location'],
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.published) this.validateCutoff(shift);

    shift.published = !shift.published;
    const saved = await this.shiftRepo.save(shift);
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

  async validateAssignment(shift: Shift, userId: string, overrideReason?: string) {
    const staff = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['locations', 'skills', 'availabilities']
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    if (!staff.locations.some(l => l.id === shift.location.id)) {
      throw new BadRequestException('Staff member is not certified to work at this location.');
    }

    if (!staff.skills.some(s => s.id === shift.requiredSkill.id)) {
      throw new BadRequestException('Missing required specialized skill tag for this shift.');
    }

    const shiftDay = this.getDayOfWeek(shift.date);
    let isAvailable = false;

    for (const avail of staff.availabilities) {
      if (avail.type === AvailabilityType.EXCEPTION && avail.date === shift.date) {
         if (shift.startTime >= avail.startTime && shift.endTime <= avail.endTime) isAvailable = true;
      } else if (avail.type === AvailabilityType.RECURRING && avail.dayOfWeek === shiftDay) {
         if (shift.startTime >= avail.startTime && shift.endTime <= avail.endTime) isAvailable = true;
      }
    }

    if (!isAvailable) {
      // throw new BadRequestException('Employee has not explicitly flagged availability for this specific timestamp.');
    }

    const targetStart = this.parseDateTime(shift.date, shift.startTime);
    const targetEnd = this.parseDateTime(shift.date, shift.endTime);

    const allStaffShifts = await this.shiftRepo.find({
      where: { assignedStaff: { id: staff.id } }
    });

    for (const existingShift of allStaffShifts) {
      if (existingShift.id === shift.id) continue;
      const existingStart = this.parseDateTime(existingShift.date, existingShift.startTime);
      const existingEnd = this.parseDateTime(existingShift.date, existingShift.endTime);

      if (targetStart < existingEnd && targetEnd > existingStart) {
         throw new BadRequestException(`Overlaps completely with an existing shift (${existingShift.startTime}-${existingShift.endTime}).`);
      }

      const hoursBetweenBefore = (targetStart - existingEnd) / (1000 * 60 * 60);
      const hoursBetweenAfter = (existingStart - targetEnd) / (1000 * 60 * 60);

      if (targetStart >= existingEnd && hoursBetweenBefore < 10) {
        throw new BadRequestException(`Violates 10-hour rest compliance rule (Only rested ${hoursBetweenBefore.toFixed(1)} hours).`);
      }
      if (targetEnd <= existingStart && hoursBetweenAfter < 10) {
        throw new BadRequestException(`Violates 10-hour rest compliance rule (Next shift cuts rest to ${hoursBetweenAfter.toFixed(1)} hours).`);
      }
    }

    // Phase 5 Labor Laws Integration Bound:
    const dailyHours = allStaffShifts.filter(s => s.date === shift.date).reduce((acc, s) => acc + this.getShiftDuration(s), 0) + this.getShiftDuration(shift);
    if (dailyHours > 12) {
      throw new BadRequestException(`Labor Law Block: Exceeds 12 active hours in a single deployment cycle.`);
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

  async assignStaff(shiftId: string, userId: string | null, overrideReason?: string) {
    const shift = await this.shiftRepo.findOne({ 
      where: { id: shiftId }, 
      relations: ['location', 'requiredSkill', 'assignedStaff'] 
    });
    if (!shift) throw new NotFoundException('Shift not found');
    const previousAssignedStaffId = shift.assignedStaff?.id ?? null;

    if (userId === null) {
      if (shift.assignedStaff) this.validateCutoff(shift);
    } else if (shift.assignedStaff && shift.assignedStaff.id !== userId) {
      this.validateCutoff(shift);
    }

    const activeSwaps = await this.swapRepo.createQueryBuilder('s')
       .leftJoinAndSelect('s.initiatorUser', 'initiatorUser')
       .leftJoinAndSelect('s.targetUser', 'targetUser')
       .where('s.status IN (:...statuses)', { statuses: ['PENDING_PEER', 'PENDING_MANAGER'] })
       .andWhere('(s.initiatorShiftId = :shiftId OR s.targetShiftId = :shiftId)', { shiftId: shift.id })
       .getMany();
       
    if (activeSwaps.length > 0) {
       for (const swap of activeSwaps) {
         swap.status = 'CANCELLED';
         await this.swapRepo.save(swap);
         const swapUsers = [swap.initiatorUser?.id, swap.targetUser?.id].filter(Boolean) as string[];
         await this.notificationsService.createForUsers(swapUsers, {
           type: 'SWAP_REQUEST_CANCELLED',
           title: 'Pending swap cancelled',
           message: 'A manager changed the underlying shift, so the pending swap or drop request was cancelled.',
           metadata: { shiftId: shift.id, swapId: swap.id },
         });
       }
    }

    if (userId === null) {
      shift.assignedStaff = null;
      const saved = await this.shiftRepo.save(shift);
      this.eventsGateway.emitScheduleUpdate();
      return saved;
    }

    await this.validateAssignment(shift, userId, overrideReason);
    const assignedStaff = await this.userRepo.findOneBy({ id: userId });
    if (!assignedStaff) throw new NotFoundException('Staff member not found');

    shift.assignedStaff = assignedStaff;
    const saved = await this.shiftRepo.save(shift);
    this.eventsGateway.emitScheduleUpdate();

    if (previousAssignedStaffId !== userId) {
      await this.notificationsService.createForUser(userId, {
        type: 'SHIFT_ASSIGNED',
        title: previousAssignedStaffId ? 'Shift reassigned to you' : 'New shift assigned',
        message: `You were assigned to the ${saved.location.name} shift on ${saved.date} from ${saved.startTime.slice(0, 5)} to ${saved.endTime.slice(0, 5)}.`,
        metadata: { shiftId: saved.id },
      });
    }

    const weeklyHours = await this.getWeeklyHoursForStaff(userId, saved);
    if (weeklyHours >= 35) {
      await this.notifyManagersForLocation(saved.location.id, {
        type: 'OVERTIME_WARNING',
        title: 'Projected overtime warning',
        message: `${assignedStaff.name} is projected for ${weeklyHours.toFixed(1)} hours this week after this assignment.`,
        metadata: { shiftId: saved.id, userId },
      });
    }

    return saved;
  }
}
