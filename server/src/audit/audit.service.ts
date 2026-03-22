import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Location } from '../locations/entities/location.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { AuditLog } from './entities/audit-log.entity';

type AuditActor = {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  private serialize(log: AuditLog) {
    return {
      id: log.id,
      shiftId: log.shift?.id,
      locationId: log.location?.id,
      locationName: log.location?.name,
      action: log.action,
      actorId: log.actorId,
      actorName: log.actorName,
      actorRole: log.actorRole,
      occurredAt: log.occurredAt,
      beforeState: log.beforeState,
      afterState: log.afterState,
      summary: log.summary,
    };
  }

  private actorDefaults(actor?: AuditActor) {
    return {
      actorId: actor?.actorId || null,
      actorName: actor?.actorName || 'System',
      actorRole: actor?.actorRole || 'SYSTEM',
    };
  }

  async logShiftChange(params: {
    shift: Shift;
    location: Location;
    action: string;
    summary: string;
    actor?: AuditActor;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
  }) {
    const actor = this.actorDefaults(params.actor);
    const entity = this.auditRepository.create({
      shift: params.shift,
      location: params.location,
      action: params.action,
      actorId: actor.actorId,
      actorName: actor.actorName,
      actorRole: actor.actorRole,
      beforeState: params.beforeState || null,
      afterState: params.afterState || null,
      summary: params.summary,
    });

    const saved = await this.auditRepository.save(entity);
    return this.serialize(saved);
  }

  async getShiftHistory(shiftId: string) {
    const logs = await this.auditRepository.find({
      where: { shift: { id: shiftId } },
      relations: ['shift', 'location'],
      order: { occurredAt: 'DESC' },
    });

    return logs.map((log) => this.serialize(log));
  }

  async getLogs(filters: { locationId?: string; startDate?: string; endDate?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.locationId) where.location = { id: filters.locationId };

    if (filters.startDate || filters.endDate) {
      const start = new Date(`${filters.startDate || '1970-01-01'}T00:00:00.000Z`);
      const end = new Date(`${filters.endDate || '2999-12-31'}T23:59:59.999Z`);
      where.occurredAt = Between(start, end);
    }

    const logs = await this.auditRepository.find({
      where,
      relations: ['shift', 'location'],
      order: { occurredAt: 'DESC' },
    });

    return logs.map((log) => this.serialize(log));
  }

  async exportCsv(filters: { locationId?: string; startDate?: string; endDate?: string }) {
    const logs = await this.getLogs(filters);
    const header = [
      'id',
      'occurredAt',
      'locationName',
      'shiftId',
      'action',
      'actorName',
      'actorRole',
      'summary',
    ];

    const rows = logs.map((log) =>
      [
        log.id,
        log.occurredAt,
        log.locationName,
        log.shiftId,
        log.action,
        log.actorName,
        log.actorRole,
        log.summary,
      ]
        .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
        .join(','),
    );

    return [header.join(','), ...rows].join('\n');
  }
}
