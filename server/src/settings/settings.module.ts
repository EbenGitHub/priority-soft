import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ScheduleSettings } from './entities/schedule-settings.entity';
import { AuthzModule } from '../authz/authz.module';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleSettings]), AuthzModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
