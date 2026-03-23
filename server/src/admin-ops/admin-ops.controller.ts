import { Body, Controller, Delete, Post } from '@nestjs/common';
import { AdminOpsService } from './admin-ops.service';

@Controller('admin/ops')
export class AdminOpsController {
  constructor(private readonly adminOpsService: AdminOpsService) {}

  @Delete('reset')
  reset(@Body() body: { actorId?: string }) {
    return this.adminOpsService.resetDatabase(body.actorId);
  }

  @Post('seed')
  seed(@Body() body: { actorId?: string; target: 'all' | 'users' | 'shifts' | 'notifications' | 'audit' }) {
    return this.adminOpsService.runSeed(body.target, body.actorId);
  }
}
