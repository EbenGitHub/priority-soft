import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Skill } from '../users/entities/skill.entity';
import { AvailabilityType } from '../users/enums/availability-type.enum';
import { SwapRequest } from '../swaps/entities/swap.entity';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift) private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Location) private readonly locRepo: Repository<Location>,
    @InjectRepository(Skill) private readonly skillRepo: Repository<Skill>,
    @InjectRepository(SwapRequest) private readonly swapRepo: Repository<SwapRequest>,
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
    return this.shiftRepo.save(shift);
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

  public validateCutoff(shift: Shift) {
    const shiftStart = this.parseDateTime(shift.date, shift.startTime);
    const now = Date.now();
    const diffHours = (shiftStart - now) / (1000 * 60 * 60);
    if (diffHours <= 48 && diffHours > -100) {
      throw new ForbiddenException(`Cannot modify schedule within 48 hours of shift. (Shift starts in ${diffHours.toFixed(1)} hours)`);
    }
  }

  async togglePublish(shiftId: string) {
    const shift = await this.shiftRepo.findOneBy({ id: shiftId });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.published) this.validateCutoff(shift);

    shift.published = !shift.published;
    return this.shiftRepo.save(shift);
  }

  async validateAssignment(shift: Shift, userId: string) {
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
      throw new BadRequestException('Employee has not explicitly flagged availability for this specific timestamp.');
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
  }

  async assignStaff(shiftId: string, userId: string | null) {
    const shift = await this.shiftRepo.findOne({ 
      where: { id: shiftId }, 
      relations: ['location', 'requiredSkill', 'assignedStaff'] 
    });
    if (!shift) throw new NotFoundException('Shift not found');

    if (userId === null) {
      if (shift.assignedStaff) this.validateCutoff(shift);
    } else if (shift.assignedStaff && shift.assignedStaff.id !== userId) {
      this.validateCutoff(shift);
    }

    const activeSwaps = await this.swapRepo.createQueryBuilder('s')
       .where('s.status IN (:...statuses)', { statuses: ['PENDING_PEER', 'PENDING_MANAGER'] })
       .andWhere('(s.initiatorShiftId = :shiftId OR s.targetShiftId = :shiftId)', { shiftId: shift.id })
       .getMany();
       
    if (activeSwaps.length > 0) {
       for (const swap of activeSwaps) {
         swap.status = 'CANCELLED';
         await this.swapRepo.save(swap);
       }
    }

    if (userId === null) {
      shift.assignedStaff = null;
      return this.shiftRepo.save(shift);
    }

    await this.validateAssignment(shift, userId);

    shift.assignedStaff = { id: userId } as User;
    return this.shiftRepo.save(shift);
  }
}
