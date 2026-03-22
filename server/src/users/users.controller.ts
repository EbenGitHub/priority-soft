import { Controller, Post, Body, Get, Param, Put } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  login(@Body() body: any) {
    return this.usersService.login(body.email, body.password);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get('location/:locationId')
  findByLocation(@Param('locationId') locationId: string) {
    return this.usersService.findByLocation(locationId);
  }

  @Post(':id/availability')
  addAvailability(@Param('id') id: string, @Body() data: any) {
    return this.usersService.addAvailability(id, data);
  }

  @Put(':id')
  updateUser(@Param('id') id: string, @Body() data: any) {
    return this.usersService.updateUser(id, data);
  }
}
