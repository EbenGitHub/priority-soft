import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SwapRequest } from './entities/swap.entity';
import { ShiftsService } from '../shifts/shifts.service';
import { User } from '../users/entities/user.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SwapsService {
  constructor(
    @InjectRepository(SwapRequest)
    private swapRepo: Repository<SwapRequest>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private shiftsService: ShiftsService,
    private readonly eventsGateway: EventsGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async findManagersForLocation(locationId: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.locations', 'location')
      .where('user.role = :role', { role: 'MANAGER' })
      .andWhere('location.id = :locationId', { locationId })
      .getMany();
  }

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

    const swap: SwapRequest = this.swapRepo.create({
      type: data.type,
      reason: data.reason,
      initiatorUser: { id: data.initiatorUserId } as User,
      initiatorShift: { id: data.initiatorShiftId } as Shift,
      status: 'PENDING_PEER',
      targetShift: data.targetShiftId ? ({ id: data.targetShiftId } as Shift) : null,
      targetUser: data.targetUserId ? ({ id: data.targetUserId } as User) : null
    } as Partial<SwapRequest>);
    const saved: SwapRequest = await this.swapRepo.save(swap);
    this.eventsGateway.emitScheduleUpdate();

    if (saved.type === 'SWAP' && data.targetUserId) {
      await this.notificationsService.createForUser(data.targetUserId, {
        type: 'SWAP_REQUEST_SUBMITTED',
        title: 'New swap request',
        message: 'Another staff member proposed a shift swap that needs your response.',
        metadata: { swapId: saved.id },
      });
    }

    return saved;
  }

  async acceptRequest(id: string, userId: string) {
    const req = await this.swapRepo.findOne({
      where: { id },
      relations: ['initiatorShift', 'initiatorShift.location', 'targetShift', 'targetUser', 'initiatorUser'],
    });
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

    await this.notificationsService.createForUsers([req.initiatorUser.id, req.targetUser?.id || userId], {
      type: req.type === 'DROP' ? 'DROP_REQUEST_CLAIMED' : 'SWAP_APPROVAL_REQUIRED',
      title: req.type === 'DROP' ? 'Drop claimed, awaiting approval' : 'Swap awaiting manager approval',
      message:
        req.type === 'DROP'
          ? 'A qualified staff member claimed the dropped shift. A manager must approve the reassignment.'
          : 'Both staff members accepted the swap. A manager must approve the final change.',
      metadata: { swapId: saved.id },
    });

    const managers = await this.findManagersForLocation(req.initiatorShift.location.id);
    await this.notificationsService.createForUsers(
      managers.map((manager) => manager.id),
      {
        type: 'SWAP_APPROVAL_REQUIRED',
        title: req.type === 'DROP' ? 'Drop approval required' : 'Swap approval required',
        message:
          req.type === 'DROP'
            ? 'A dropped shift has been claimed and is waiting for manager approval.'
            : 'A shift swap is waiting for manager approval.',
        metadata: { swapId: saved.id },
      },
    );

    return saved;
  }

  async declineRequest(id: string) {
    const req = await this.swapRepo.findOne({ where: { id }, relations: ['initiatorUser'] });
    if (!req) return null;
    req.status = 'REJECTED';
    const saved = await this.swapRepo.save(req);
    this.eventsGateway.emitScheduleUpdate();
    await this.notificationsService.createForUser(req.initiatorUser.id, {
      type: 'SWAP_REQUEST_REJECTED',
      title: 'Swap request declined',
      message: 'The other staff member declined your swap or pickup request.',
      metadata: { swapId: saved.id },
    });
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

    await this.notificationsService.createForUsers(
      [req.initiatorUser.id, req.targetUser?.id].filter(Boolean) as string[],
      {
        type: 'SWAP_REQUEST_APPROVED',
        title: req.type === 'DROP' ? 'Coverage approved' : 'Swap approved',
        message:
          req.type === 'DROP'
            ? 'A manager approved the drop request and reassigned the shift.'
            : 'A manager approved the swap request. Your schedule has been updated.',
        metadata: { swapId: saved.id },
      },
    );

    return saved;
  }

  async rejectRequest(id: string) {
    const req = await this.swapRepo.findOne({
      where: { id },
      relations: ['initiatorUser', 'targetUser'],
    });
    if (!req) return null;
    req.status = 'REJECTED';
    const saved = await this.swapRepo.save(req);
    this.eventsGateway.emitScheduleUpdate();
    await this.notificationsService.createForUsers(
      [req.initiatorUser?.id, req.targetUser?.id].filter(Boolean) as string[],
      {
        type: 'SWAP_REQUEST_REJECTED',
        title: 'Manager rejected request',
        message:
          req.type === 'DROP'
            ? 'A manager rejected the coverage request. The original shift assignment remains in place.'
            : 'A manager rejected the swap request. The original assignments remain in place.',
        metadata: { swapId: saved.id },
      },
    );
    return saved;
  }
}
