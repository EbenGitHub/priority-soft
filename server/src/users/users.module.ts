import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Skill } from './entities/skill.entity';
import { Availability } from './entities/availability.entity';
import { Location } from '../locations/entities/location.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthzModule } from '../authz/authz.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Skill, Availability, Location]), NotificationsModule, AuthzModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [TypeOrmModule, UsersService],
})
export class UsersModule {}
