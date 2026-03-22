import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SwapRequest } from './entities/swap.entity';
import { ShiftsService } from '../shifts/shifts.service';
import { User } from '../users/entities/user.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class SwapsService {
  constructor(
    @InjectRepository(SwapRequest)
    private swapRepo: Repository<SwapRequest>,
    private shiftsService: ShiftsService,
    private readonly eventsGateway: EventsGateway
  ) {}

  async expireOldDrops() {
    const activeDrops = await this.swapRepo.find({ 
      where: { type: 'DROP', status: 'PENDING_PEER' }, 
      relations: ['initiatorShift'] 
    });
    const now = Date.now();
    for (const drop of activeDrops) {
      if (!drop.initiatorShift) continue;
      const shiftStart = new Date(`${drop.initiatorShift.date}T${drop.initiatorShift.startTime}`).getTime();
      if ((shiftStart - now) < 24 * 60 * 60 * 1000) {
        drop.status = 'CANCELLED';
        await this.swapRepo.save(drop);
      }
    }
  }

  async findAll() {
    await this.expireOldDrops();
    return this.swapRepo.find({ 
      relations: ['initiatorUser', 'initiatorShift', 'initiatorShift.location', 'initiatorShift.requiredSkill', 'targetShift', 'targetShift.location', 'targetShift.assignedStaff', 'targetUser'],
      order: { createdAt: 'DESC' }
    });
  }

  async create(data: { type: 'SWAP'|'DROP'; initiatorUserId: string; initiatorShiftId: string; targetShiftId?: string; targetUserId?: string; reason?: string }) {
    const pendingCount = await this.swapRepo.count({
      where: [
        { initiatorUser: { id: data.initiatorUserId }, status: 'PENDING_PEER' },
        { initiatorUser: { id: data.initiatorUserId }, status: 'PENDING_MANAGER' }
      ]
    });
    if (pendingCount >= 3) throw new BadRequestException('Maximum constraint locked: Authorized limit of 3 pending operations exceeded.');

    const swap = this.swapRepo.create({
      type: data.type,
      reason: data.reason,
      initiatorUser: { id: data.initiatorUserId } as User,
      initiatorShift: { id: data.initiatorShiftId } as Shift,
      status: 'PENDING_PEER',
      targetShift: data.targetShiftId ? ({ id: data.targetShiftId } as Shift) : null,
      targetUser: data.targetUserId ? ({ id: data.targetUserId } as User) : null
    } as any);
    const saved = await this.swapRepo.save(swap);
    this.eventsGateway.emitScheduleUpdate();
    return saved;
  }

  async acceptRequest(id: string, userId: string) {
    const req = await this.swapRepo.findOne({ where: { id }, relations: ['initiatorShift', 'targetShift', 'targetUser', 'initiatorUser'] });
    if (!req) throw new BadRequestException('Request sequence not found in memory pools');
    
    if (req.type === 'DROP') {
       await this.shiftsService.validateAssignment(req.initiatorShift, userId);
       req.targetUser = { id: userId } as User;
    } else {
       if (!req.targetUser || !req.targetShift) throw new BadRequestException('Swap request lacks target signature requirements');
       await this.shiftsService.validateAssignment(req.initiatorShift, req.targetUser.id);
       await this.shiftsService.validateAssignment(req.targetShift, req.initiatorUser.id);
    }

    req.status = 'PENDING_MANAGER';
    const saved = await this.swapRepo.save(req);
    this.eventsGateway.emitScheduleUpdate();
    return saved;
  }

  async declineRequest(id: string) {
    const req = await this.swapRepo.findOneBy({ id });
    if (!req) return null;
    req.status = 'REJECTED';
    const saved = await this.swapRepo.save(req);
    this.eventsGateway.emitScheduleUpdate();
    return saved;
  }

  async approveRequest(id: string) {
    const req = await this.swapRepo.findOne({ where: { id }, relations: ['initiatorUser', 'targetUser', 'initiatorShift', 'targetShift'] });
    if (!req) throw new BadRequestException('Request signature wiped');

    if (req.type === 'DROP') {
       if (!req.targetUser) throw new BadRequestException('Drop target identity void');
       await this.shiftsService.assignStaff(req.initiatorShift.id, req.targetUser.id);
    } else {
       if (!req.targetUser || !req.targetShift) throw new BadRequestException('Swap constraint signatures void');
       await this.shiftsService.assignStaff(req.initiatorShift.id, req.targetUser.id);
       await this.shiftsService.assignStaff(req.targetShift.id, req.initiatorUser.id);
    }
    req.status = 'APPROVED';
    const saved = await this.swapRepo.save(req);
    this.eventsGateway.emitScheduleUpdate();
    return saved;
  }

  async rejectRequest(id: string) {
    const req = await this.swapRepo.findOneBy({ id });
    if (!req) return null;
    req.status = 'REJECTED';
    const saved = await this.swapRepo.save(req);
    this.eventsGateway.emitScheduleUpdate();
    return saved;
  }
}
