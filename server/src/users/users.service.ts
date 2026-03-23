import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Availability } from './entities/availability.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthzService } from '../authz/authz.service';
import { Permission } from '../authz/permissions.enum';
import { Location } from '../locations/entities/location.entity';
import { EventsGateway } from '../events/events.gateway';
import { AvailabilityType } from './enums/availability-type.enum';
import { Skill } from './entities/skill.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Availability) private readonly availabilityRepository: Repository<Availability>,
    @InjectRepository(Location) private readonly locationRepository: Repository<Location>,
    @InjectRepository(Skill) private readonly skillRepository: Repository<Skill>,
    private readonly notificationsService: NotificationsService,
    private readonly authzService: AuthzService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.userRepository.findOne({ 
      where: { email },
      relations: ['locations', 'skills']
    });
    
    if (!user || user.password !== pass) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been disabled.');
    }
    
    // Strip password
    const { password, ...result } = user;
    return result;
  }

  async findAll(actorId?: string) {
    let users = await this.userRepository.find({ relations: ['locations', 'skills', 'availabilities', 'availabilities.location'] });
    if (actorId) {
      const actor = await this.userRepository.findOne({
        where: { id: actorId },
        relations: ['locations'],
      });
      if (actor?.role === 'MANAGER') {
        const allowedLocationIds = new Set(actor.locations.map((location) => location.id));
        users = users.filter((user) => user.locations?.some((location) => allowedLocationIds.has(location.id)));
      }
    }
    return users.map((user) => {
        const { password, ...result } = user;
        return result;
      });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ 
      where: { id }, 
      relations: ['locations', 'skills', 'availabilities', 'availabilities.location'] 
    });
    if (!user) throw new NotFoundException('User not found');
    
    const { password, ...result } = user;
    return result;
  }

  async findByLocation(locationId: string, actorId?: string) {
    if (actorId) {
      const actor = await this.userRepository.findOne({
        where: { id: actorId },
        relations: ['locations'],
      });
      if (actor?.role === 'MANAGER' && !actor.locations.some((location) => location.id === locationId)) {
        throw new ForbiddenException('You do not have access to this location.');
      }
    }

    return this.userRepository.find({
      where: { locations: { id: locationId } },
      relations: ['locations', 'skills', 'availabilities', 'availabilities.location']
    });
  }

  private async findManagersForLocationIds(locationIds: string[]) {
    if (locationIds.length === 0) return [];

    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.locations', 'location')
      .where('user.role = :role', { role: 'MANAGER' })
      .andWhere('location.id IN (:...locationIds)', { locationIds })
      .getMany();
  }

  private async assertAvailabilityNotDuplicated(params: {
    userId: string;
    type: AvailabilityType;
    dayOfWeek?: number | null;
    date?: string | null;
    startTime: string;
    endTime: string;
    timezone: string;
    locationId?: string | null;
    excludeAvailabilityId?: string;
  }) {
    const existing = await this.availabilityRepository.find({
      where: {
        user: { id: params.userId },
        type: params.type,
        startTime: params.startTime,
        endTime: params.endTime,
        timezone: params.timezone,
      },
      relations: ['user', 'location'],
    });

    const duplicate = existing.find((item) => {
      if (params.excludeAvailabilityId && item.id === params.excludeAvailabilityId) {
        return false;
      }

      if (params.type === AvailabilityType.RECURRING) {
        return (
          item.dayOfWeek === (params.dayOfWeek ?? null) &&
          (item.location?.id || null) === (params.locationId ?? null)
        );
      }

      return item.date === (params.date ?? null) && (item.location?.id || null) === (params.locationId ?? null);
    });

    if (duplicate) {
      throw new BadRequestException('This availability window already exists.');
    }
  }

  async addAvailability(userId: string, data: Partial<Availability> & { actorId?: string }) {
    await this.authzService.assertSelfPermission(data.actorId, userId, Permission.AVAILABILITY_MANAGE_SELF);
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['locations'],
    });
    if (!user) throw new NotFoundException('User not found');
    const selectedLocation =
      user.locations.find((location) => location.id === (data as any).locationId) || null;
    if (!selectedLocation) {
      throw new BadRequestException('Availability must be attached to one of the user locations.');
    }
    const timezone = data.timezone || selectedLocation.timezone || user.locations[0]?.timezone || 'UTC';

    await this.assertAvailabilityNotDuplicated({
      userId,
      type: (data.type as AvailabilityType) || AvailabilityType.RECURRING,
      dayOfWeek: data.dayOfWeek ?? null,
      date: data.date ?? null,
      startTime: data.startTime as string,
      endTime: data.endTime as string,
      timezone,
      locationId: selectedLocation.id,
    });

    const newAvail = this.availabilityRepository.create({
      ...data,
      location: selectedLocation,
      timezone,
      user,
    });
    const saved = await this.availabilityRepository.save(newAvail);

    const managers = await this.findManagersForLocationIds(
      user.locations.map((location) => location.id),
    );

    await this.notificationsService.createForUsers(
      managers.map((manager) => manager.id),
      {
        type: 'AVAILABILITY_CHANGED',
        title: 'Staff availability changed',
        message: `${user.name} updated availability for one of their assigned locations.`,
        metadata: { userId: user.id },
      },
    );

    this.eventsGateway.emitScheduleUpdate();

    return saved;
  }

  async updateAvailability(
    userId: string,
    availabilityId: string,
    data: Partial<Availability> & { actorId?: string },
  ) {
    await this.authzService.assertSelfPermission(
      data.actorId,
      userId,
      Permission.AVAILABILITY_MANAGE_SELF,
    );
    const availability = await this.availabilityRepository.findOne({
      where: { id: availabilityId, user: { id: userId } },
      relations: ['user', 'user.locations', 'location'],
    });
    if (!availability) throw new NotFoundException('Availability not found');
    const nextLocation =
      availability.user.locations.find((location) => location.id === (data as any).locationId) ||
      availability.location ||
      null;
    if (!nextLocation) {
      throw new BadRequestException('Availability must be attached to one of the user locations.');
    }

    availability.type = (data.type as any) || availability.type;
    if (availability.type === 'RECURRING') {
      availability.dayOfWeek = data.dayOfWeek ?? availability.dayOfWeek;
      (availability as any).date = null;
    } else {
      availability.date = data.date ?? availability.date;
      (availability as any).dayOfWeek = null;
    }
    availability.startTime = data.startTime || availability.startTime;
    availability.endTime = data.endTime || availability.endTime;
    availability.location = nextLocation;
    availability.timezone =
      data.timezone || nextLocation.timezone || availability.timezone || availability.user.locations[0]?.timezone || 'UTC';

    await this.assertAvailabilityNotDuplicated({
      userId,
      type: availability.type,
      dayOfWeek: availability.type === AvailabilityType.RECURRING ? availability.dayOfWeek : null,
      date: availability.type === AvailabilityType.EXCEPTION ? availability.date : null,
      startTime: availability.startTime,
      endTime: availability.endTime,
      timezone: availability.timezone,
      locationId: availability.location?.id || null,
      excludeAvailabilityId: availability.id,
    });

    const saved = await this.availabilityRepository.save(availability);
    const managers = await this.findManagersForLocationIds(
      availability.user.locations.map((location) => location.id),
    );

    await this.notificationsService.createForUsers(
      managers.map((manager) => manager.id),
      {
        type: 'AVAILABILITY_CHANGED',
        title: 'Staff availability changed',
        message: `${availability.user.name} updated an availability window.`,
        metadata: { userId: availability.user.id, availabilityId: saved.id },
      },
    );

    this.eventsGateway.emitScheduleUpdate();
    return saved;
  }

  async deleteAvailability(userId: string, availabilityId: string, actorId?: string) {
    await this.authzService.assertSelfPermission(
      actorId,
      userId,
      Permission.AVAILABILITY_MANAGE_SELF,
    );
    const availability = await this.availabilityRepository.findOne({
      where: { id: availabilityId, user: { id: userId } },
      relations: ['user', 'user.locations'],
    });
    if (!availability) throw new NotFoundException('Availability not found');

    await this.availabilityRepository.remove(availability);
    const managers = await this.findManagersForLocationIds(
      availability.user.locations.map((location) => location.id),
    );

    await this.notificationsService.createForUsers(
      managers.map((manager) => manager.id),
      {
        type: 'AVAILABILITY_CHANGED',
        title: 'Staff availability changed',
        message: `${availability.user.name} removed an availability window.`,
        metadata: { userId: availability.user.id, availabilityId },
      },
    );

    this.eventsGateway.emitScheduleUpdate();
    return { ok: true, availabilityId };
  }

  async updateUser(userId: string, data: any) {
    await this.authzService.assertSelfPermission(data.actorId, userId, Permission.AVAILABILITY_MANAGE_SELF);
    await this.userRepository.update(userId, { desiredHours: data.desiredHours });
    return this.findOne(userId);
  }

  async adminUpdateUser(
    userId: string,
    data: {
      actorId?: string;
      isActive?: boolean;
      locationIds?: string[];
      skillIds?: string[];
      desiredHours?: number;
    },
  ) {
    const actor = await this.authzService.assertPermission(data.actorId, Permission.USERS_MANAGE);
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['locations', 'skills', 'availabilities', 'availabilities.location'],
    });
    if (!user) throw new NotFoundException('User not found');
    if (actor.role === 'MANAGER') {
      if (user.role !== 'STAFF') {
        throw new ForbiddenException('Managers can only update staff members.');
      }
      if (typeof data.isActive === 'boolean') {
        throw new ForbiddenException('Managers cannot enable or disable accounts.');
      }
      const actorLocationIds = new Set(actor.locations.map((location) => location.id));
      const currentLocationIds = (user.locations || []).map((location) => location.id);
      if (currentLocationIds.some((locationId) => !actorLocationIds.has(locationId))) {
        throw new ForbiddenException('You can only manage staff assigned within your locations.');
      }
      if (Array.isArray(data.locationIds) && data.locationIds.some((locationId) => !actorLocationIds.has(locationId))) {
        throw new ForbiddenException('Managers can only certify staff for their own managed locations.');
      }
    }
    if (user.role === 'ADMIN' && data.isActive === false) {
      throw new ForbiddenException('Admin accounts cannot be disabled from this control.');
    }

    if (Array.isArray(data.locationIds)) {
      const locations = data.locationIds.length
        ? await this.locationRepository.findBy(data.locationIds.map((id) => ({ id })))
        : [];
      user.locations = locations;
    }

    if (Array.isArray(data.skillIds)) {
      const skills = data.skillIds.length
        ? await this.skillRepository.findBy(data.skillIds.map((id) => ({ id })))
        : [];
      user.skills = skills;
    }

    if (typeof data.isActive === 'boolean') {
      user.isActive = data.isActive;
    }

    if (typeof data.desiredHours === 'number') {
      user.desiredHours = data.desiredHours;
    }

    const saved = await this.userRepository.save(user);
    this.eventsGateway.emitScheduleUpdate();
    if (saved.isActive === false) {
      this.eventsGateway.emitUsersInvalidated([saved.id]);
    }

    const { password, ...result } = saved;
    return result;
  }
}
