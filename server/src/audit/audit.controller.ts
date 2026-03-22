import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('shifts/:shiftId')
  getShiftHistory(@Param('shiftId') shiftId: string) {
    return this.auditService.getShiftHistory(shiftId);
  }

  @Get('logs')
  getLogs(
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getLogs({ locationId, startDate, endDate });
  }

  @Get('logs/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportLogs(
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.exportCsv({ locationId, startDate, endDate });
  }
}
