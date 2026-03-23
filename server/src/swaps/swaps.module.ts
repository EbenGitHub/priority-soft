import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwapsController } from './swaps.controller';
import { SwapsService } from './swaps.service';
import { SwapRequest } from './entities/swap.entity';
import { ShiftsModule } from '../shifts/shifts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { AuthzModule } from '../authz/authz.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SwapRequest, User]),
    ShiftsModule,
    NotificationsModule,
    AuthzModule,
  ],
  controllers: [SwapsController],
  providers: [SwapsService]
})
export class SwapsModule {}
