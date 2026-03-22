import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}
  
  @Get('fairness')
  getFairness(@Query('locationId') locationId?: string) {
    return this.analyticsService.getFairnessMetrics(locationId);
  }
}
