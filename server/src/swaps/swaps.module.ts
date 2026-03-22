import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwapsController } from './swaps.controller';
import { SwapsService } from './swaps.service';
import { SwapRequest } from './entities/swap.entity';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SwapRequest]),
    ShiftsModule
  ],
  controllers: [SwapsController],
  providers: [SwapsService]
})
export class SwapsModule {}
