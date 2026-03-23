import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import { User } from '../users/entities/user.entity';
import { Location } from '../locations/entities/location.entity';
import { Skill } from '../users/entities/skill.entity';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { SwapRequest } from '../swaps/entities/swap.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { AuthzModule } from '../authz/authz.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([Shift, User, Location, Skill, SwapRequest]), NotificationsModule, AuditModule, AuthzModule, SettingsModule],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
