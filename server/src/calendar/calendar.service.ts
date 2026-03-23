import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../locations/entities/location.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { buildShiftUtcRange, formatPreview } from './calendar-time.util';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
  ) {}

  async listShifts(locationId?: string) {
    const where = locationId ? { location: { id: locationId } } : {};
    const shifts = await this.shiftRepository.find({
      where,
      relations: ['location', 'requiredSkill', 'assignedStaff'],
      order: { date: 'ASC', startTime: 'ASC' },
    });

    return shifts.map((shift) => {
      const timeZone = shift.location?.timezone || 'UTC';
      const derived = buildShiftUtcRange(shift.date, shift.startTime, shift.endTime, timeZone, shift.endDate);

      return {
        ...shift,
        startUtc: shift.startUtc?.toISOString() || derived.startUtc.toISOString(),
        endUtc: shift.endUtc?.toISOString() || derived.endUtc.toISOString(),
        isOvernight: typeof shift.isOvernight === 'boolean' ? shift.isOvernight : derived.isOvernight,
        endDate: shift.endDate || derived.endDate,
      };
    });
  }

  async previewShift(payload: {
    locationId: string;
    date: string;
    endDate?: string;
    startTime: string;
    endTime: string;
    viewerTimeZone?: string;
  }) {
    const location = await this.locationRepository.findOneBy({ id: payload.locationId });
    if (!location) throw new NotFoundException('Location not found');

    return formatPreview(
      {
        date: payload.date,
        endDate: payload.endDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        location,
      },
      payload.viewerTimeZone || location.timezone,
    );
  }
}
