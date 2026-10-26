import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportingService } from './reporting.service';

@ApiTags('reporting')
@Controller('reporting')
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('summary')
  async summary() {
    return this.reporting.getSummary();
  }

  @Get('daily')
  async daily(@Query('from') from: string, @Query('to') to: string) {
    const f = from ? new Date(from) : new Date(Date.now() - 30 * 86400_000);
    const t = to ? new Date(to) : new Date();
    return this.reporting.getDailyMetrics(f, t);
  }

  @Get('tokens')
  async tokens(@Query('days') days?: string) {
    return this.reporting.getTokenUsage(days ? parseInt(days, 10) : 7);
  }
}
