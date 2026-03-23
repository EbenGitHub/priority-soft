import { Module } from '@nestjs/common';
import { AdminOpsController } from './admin-ops.controller';
import { AdminOpsService } from './admin-ops.service';
import { AuthzModule } from '../authz/authz.module';
import { SeedModule } from '../seed/seed.module';

@Module({
  imports: [AuthzModule, SeedModule],
  controllers: [AdminOpsController],
  providers: [AdminOpsService],
})
export class AdminOpsModule {}
