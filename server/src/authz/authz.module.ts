import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AuthzService } from './authz.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [AuthzService],
  exports: [AuthzService],
})
export class AuthzModule {}
