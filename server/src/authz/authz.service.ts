import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Permission } from './permissions.enum';
import { ROLE_PERMISSIONS } from './role-permissions';

@Injectable()
export class AuthzService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findActor(actorId: string) {
    const user = await this.userRepository.findOne({
      where: { id: actorId },
      relations: ['locations'],
    });

    if (!user) {
      throw new NotFoundException('Acting user not found.');
    }

    return user;
  }

  hasPermission(role: User['role'], permission: Permission) {
    return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
  }

  async assertPermission(actorId: string | undefined, permission: Permission) {
    if (!actorId) {
      throw new ForbiddenException('Authenticated actor is required.');
    }

    const actor = await this.findActor(actorId);
    if (!this.hasPermission(actor.role, permission)) {
      throw new ForbiddenException(`Role ${actor.role} does not have permission ${permission}.`);
    }

    return actor;
  }

  async assertLocationPermission(actorId: string | undefined, permission: Permission, locationId: string) {
    const actor = await this.assertPermission(actorId, permission);

    if (actor.role === 'ADMIN') {
      return actor;
    }

    if (actor.locations.some((location) => location.id === locationId)) {
      return actor;
    }

    throw new ForbiddenException('You do not have access to manage this location.');
  }

  async assertSelfPermission(actorId: string | undefined, targetUserId: string, permission: Permission) {
    const actor = await this.assertPermission(actorId, permission);
    if (actor.id !== targetUserId) {
      throw new ForbiddenException('You can only perform this action for your own account.');
    }
    return actor;
  }
}
