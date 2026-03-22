import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Availability } from './entities/availability.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Availability) private readonly availabilityRepository: Repository<Availability>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.userRepository.findOne({ 
      where: { email },
      relations: ['locations', 'skills']
    });
    
    if (!user || user.password !== pass) {
      throw new UnauthorizedException('Invalid credentials');
    }
    
    // Strip password
    const { password, ...result } = user;
    return result;
  }

  findAll() {
    return this.userRepository.find({ relations: ['locations', 'skills'] });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ 
      where: { id }, 
      relations: ['locations', 'skills', 'availabilities'] 
    });
    if (!user) throw new NotFoundException('User not found');
    
    const { password, ...result } = user;
    return result;
  }

  findByLocation(locationId: string) {
    return this.userRepository.find({
      where: { locations: { id: locationId } },
      relations: ['locations', 'skills', 'availabilities']
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

  async addAvailability(userId: string, data: Partial<Availability>) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['locations'],
    });
    if (!user) throw new NotFoundException('User not found');

    const newAvail = this.availabilityRepository.create({
      ...data,
      timezone: data.timezone || user.locations[0]?.timezone || 'UTC',
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

    return saved;
  }

  async updateUser(userId: string, data: any) {
    await this.userRepository.update(userId, { desiredHours: data.desiredHours });
    return this.findOne(userId);
  }
}
