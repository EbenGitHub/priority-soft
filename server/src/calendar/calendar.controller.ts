import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('shifts')
  listShifts(@Query('locationId') locationId?: string, @Query('viewerTimeZone') _viewerTimeZone?: string) {
    return this.calendarService.listShifts(locationId);
  }

  @Post('preview')
  previewShift(@Body() body: any) {
    return this.calendarService.previewShift(body);
  }
}
