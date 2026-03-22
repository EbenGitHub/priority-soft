import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Skill } from '../users/entities/skill.entity';
import { Availability } from '../users/entities/availability.entity';
import { Role } from '../users/enums/role.enum';
import { AvailabilityType } from '../users/enums/availability-type.enum';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Location) private readonly locationRepository: Repository<Location>,
    @InjectRepository(Skill) private readonly skillRepository: Repository<Skill>,
    @InjectRepository(Availability) private readonly availabilityRepository: Repository<Availability>,
  ) {}

  async onApplicationBootstrap() {
    const userCount = await this.userRepository.count();
    if (userCount > 0) {
      this.logger.log('Database already contains users. Skipping seed.');
      return;
    }

    this.logger.log('Seeding initial Coastal Eats data...');

    // 1. Locations
    const loc1 = await this.locationRepository.save({ name: 'Coastal Eats - NYC', timezone: 'America/New_York' });
    const loc2 = await this.locationRepository.save({ name: 'Coastal Eats - Miami', timezone: 'America/New_York' });
    const loc3 = await this.locationRepository.save({ name: 'Coastal Eats - LA', timezone: 'America/Los_Angeles' });
    const loc4 = await this.locationRepository.save({ name: 'Coastal Eats - Seattle', timezone: 'America/Los_Angeles' });
    const locations = [loc1, loc2, loc3, loc4];

    // 2. Skills
    const skillBartender = await this.skillRepository.save({ name: 'bartender' });
    const skillCook = await this.skillRepository.save({ name: 'line cook' });
    const skillServer = await this.skillRepository.save({ name: 'server' });
    const skillHost = await this.skillRepository.save({ name: 'host' });

    // 3. Admin User
    await this.userRepository.save({
      name: 'Corporate Admin',
      email: 'admin@coastaleats.com',
      role: Role.ADMIN,
      locations: locations, // Admins oversee everything
    });

    // 4. Managers
    await this.userRepository.save({
      name: 'East Coast Manager',
      email: 'eastmanager@coastaleats.com',
      role: Role.MANAGER,
      locations: [loc1, loc2],
    });

    await this.userRepository.save({
      name: 'West Coast Manager',
      email: 'westmanager@coastaleats.com',
      role: Role.MANAGER,
      locations: [loc3, loc4],
    });

    // 5. Staff
    const staff1 = await this.userRepository.save({
      name: 'Sarah Server',
      email: 'sarah@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 35,
      locations: [loc1],
      skills: [skillServer, skillHost],
    });

    const staff2 = await this.userRepository.save({
      name: 'John Cook',
      email: 'john@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 40,
      locations: [loc3, loc4],
      skills: [skillCook],
    });

    const staff3 = await this.userRepository.save({
      name: 'Maria Bartender',
      email: 'maria@coastaleats.com',
      role: Role.STAFF,
      desiredHours: 20,
      locations: [loc1, loc2],
      skills: [skillBartender, skillServer],
    });

    // 6. Availabilities
    // Sarah works weekdays, 9am to 5pm
    for (let day = 1; day <= 5; day++) {
      await this.availabilityRepository.save({
        user: staff1,
        type: AvailabilityType.RECURRING,
        dayOfWeek: day,
        startTime: '09:00:00',
        endTime: '17:00:00'
      });
    }

    // John works evenings weekends (Fri, Sat, Sun)
    for (const day of [5, 6, 0]) {
      await this.availabilityRepository.save({
        user: staff2,
        type: AvailabilityType.RECURRING,
        dayOfWeek: day,
        startTime: '16:00:00',
        endTime: '23:59:59' 
      });
    }

    // Maria is an exception test: available Dec 31st for a massive shift
    await this.availabilityRepository.save({
      user: staff3,
      type: AvailabilityType.EXCEPTION,
      date: '2026-12-31',
      startTime: '10:00:00',
      endTime: '22:00:00',
    });

    this.logger.log('Seed data successfully committed.');
  }
}
