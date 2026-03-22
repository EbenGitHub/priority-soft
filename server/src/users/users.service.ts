import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Availability } from './entities/availability.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Availability) private readonly availabilityRepository: Repository<Availability>,
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

  async addAvailability(userId: string, data: Partial<Availability>) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    const newAvail = this.availabilityRepository.create({
      ...data,
      user,
    });
    return this.availabilityRepository.save(newAvail);
  }

  async updateUser(userId: string, data: any) {
    await this.userRepository.update(userId, { desiredHours: data.desiredHours });
    return this.findOne(userId);
  }
}
