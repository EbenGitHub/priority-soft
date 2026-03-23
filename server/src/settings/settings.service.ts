import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleSettings } from './entities/schedule-settings.entity';
import { AuthzService } from '../authz/authz.service';
import { Permission } from '../authz/permissions.enum';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(ScheduleSettings)
    private readonly settingsRepository: Repository<ScheduleSettings>,
    private readonly authzService: AuthzService,
  ) {}

  private async ensureSettings() {
    let settings = await this.settingsRepository.find({
      take: 1,
      order: { updatedAt: 'DESC' },
    }).then((rows) => rows[0] || null);
    if (!settings) {
      settings = await this.settingsRepository.save(
        this.settingsRepository.create({
          cutoffHours: 48,
        }),
      );
    }
    return settings;
  }

  async getSchedulingSettings() {
    return this.ensureSettings();
  }

  async getCutoffHours() {
    const settings = await this.ensureSettings();
    return settings.cutoffHours;
  }

  async updateSchedulingSettings(actorId: string | undefined, payload: { cutoffHours?: number }) {
    await this.authzService.assertPermission(actorId, Permission.SETTINGS_MANAGE);
    const settings = await this.ensureSettings();

    if (typeof payload.cutoffHours === 'number') {
      settings.cutoffHours = Math.max(0, Math.min(336, Math.round(payload.cutoffHours)));
    }

    return this.settingsRepository.save(settings);
  }
}
