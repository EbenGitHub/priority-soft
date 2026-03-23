import { Controller, Post, Body, Get, Param, Put, Query } from '@nestjs/common';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  create(@Body() body: any) {
    return this.shiftsService.createShift(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.shiftsService.updateShift(id, body);
  }

  @Get()
  findAll(@Query('actorId') actorId?: string) {
    return this.shiftsService.findAll(actorId);
  }

  @Get('location/:id')
  findByLocation(@Param('id') locationId: string) {
    return this.shiftsService.findByLocation(locationId);
  }

  @Put(':id/assign')
  assignStaff(@Param('id') id: string, @Body() body: { userId: string | null; overrideReason?: string; cutoffOverrideReason?: string; actorId?: string; actorName?: string; actorRole?: string }) {
    return this.shiftsService.assignStaff(id, body.userId, body.overrideReason, body);
  }

  @Put(':id/publish')
  togglePublish(@Param('id') id: string, @Body() body: { cutoffOverrideReason?: string; actorId?: string; actorName?: string; actorRole?: string }) {
    return this.shiftsService.togglePublish(id, body);
  }

  @Put('publish-week')
  publishWeek(@Body() body: { locationId: string; weekStart: string; publish: boolean; cutoffOverrideReason?: string; actorId?: string; actorName?: string; actorRole?: string }) {
    return this.shiftsService.publishWeek(body.locationId, body.weekStart, body.publish, body);
  }
}
