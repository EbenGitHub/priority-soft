import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './entities/location.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location) private readonly locationRepo: Repository<Location>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async findAll(actorId?: string) {
    if (actorId) {
      const actor = await this.userRepo.findOne({
        where: { id: actorId },
        relations: ['locations'],
      });

      if (actor?.role === 'MANAGER') {
        return actor.locations || [];
      }
    }

    return this.locationRepo.find();
  }
}
