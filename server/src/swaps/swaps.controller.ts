import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { SwapsService } from './swaps.service';

@Controller('swaps')
export class SwapsController {
  constructor(private swapsService: SwapsService) {}

  @Get()
  findAll() {
    return this.swapsService.findAll();
  }

  @Post()
  create(@Body() body: any) {
    return this.swapsService.create(body);
  }

  @Put(':id/accept')
  accept(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.swapsService.acceptRequest(id, body.userId);
  }

  @Put(':id/decline')
  decline(@Param('id') id: string) {
    return this.swapsService.declineRequest(id);
  }

  @Put(':id/approve')
  approve(@Param('id') id: string) {
    return this.swapsService.approveRequest(id);
  }

  @Put(':id/reject')
  reject(@Param('id') id: string) {
    return this.swapsService.rejectRequest(id);
  }
}
