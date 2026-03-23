import { Body, Controller, Get, Put } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('scheduling')
  getSchedulingSettings() {
    return this.settingsService.getSchedulingSettings();
  }

  @Put('scheduling')
  updateSchedulingSettings(
    @Body() body: { cutoffHours?: number; actorId?: string },
  ) {
    return this.settingsService.updateSchedulingSettings(body.actorId, body);
  }
}
