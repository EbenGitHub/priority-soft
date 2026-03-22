import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Skill } from '../users/entities/skill.entity';
import { Availability } from '../users/entities/availability.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { SwapRequest } from '../swaps/entities/swap.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Location,
      Skill,
      Availability,
      Notification,
      NotificationPreference,
      AuditLog,
      Shift,
      SwapRequest,
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
