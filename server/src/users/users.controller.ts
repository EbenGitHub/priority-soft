import { Controller, Post, Body, Get, Param, Put, Delete, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  login(@Body() body: any) {
    return this.usersService.login(body.email, body.password);
  }

  @Get()
  findAll(@Query('actorId') actorId?: string) {
    return this.usersService.findAll(actorId);
  }

  @Get('skills')
  findAllSkills() {
    return this.usersService.findAllSkills();
  }

  @Get('location/:locationId')
  findByLocation(@Param('locationId') locationId: string, @Query('actorId') actorId?: string) {
    return this.usersService.findByLocation(locationId, actorId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post(':id/availability')
  addAvailability(@Param('id') id: string, @Body() data: any) {
    return this.usersService.addAvailability(id, data);
  }

  @Put(':id/availability/:availabilityId')
  updateAvailability(
    @Param('id') id: string,
    @Param('availabilityId') availabilityId: string,
    @Body() data: any,
  ) {
    return this.usersService.updateAvailability(id, availabilityId, data);
  }

  @Delete(':id/availability/:availabilityId')
  deleteAvailability(
    @Param('id') id: string,
    @Param('availabilityId') availabilityId: string,
    @Body() data: { actorId?: string },
  ) {
    return this.usersService.deleteAvailability(id, availabilityId, data?.actorId);
  }

  @Put(':id')
  updateUser(@Param('id') id: string, @Body() data: any) {
    return this.usersService.updateUser(id, data);
  }

  @Put(':id/admin')
  adminUpdateUser(@Param('id') id: string, @Body() data: any) {
    return this.usersService.adminUpdateUser(id, data);
  }
}
