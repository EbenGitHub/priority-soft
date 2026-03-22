import { Controller, Post, Body, Get, Param, Put } from '@nestjs/common';
import { ShiftsService } from './shifts.service';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  create(@Body() body: any) {
    return this.shiftsService.createShift(body);
  }

  @Get()
  findAll() {
    return this.shiftsService.findAll();
  }

  @Get('location/:id')
  findByLocation(@Param('id') locationId: string) {
    return this.shiftsService.findByLocation(locationId);
  }

  @Put(':id/assign')
  assignStaff(@Param('id') id: string, @Body() body: { userId: string | null; overrideReason?: string }) {
    return this.shiftsService.assignStaff(id, body.userId, body.overrideReason);
  }

  @Put(':id/publish')
  togglePublish(@Param('id') id: string) {
    return this.shiftsService.togglePublish(id);
  }
}
