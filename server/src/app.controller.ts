import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('ping')
  async ping() {
    try {
      await this.dataSource.query('SELECT 1');
      return { server: 'ok', database: 'ok' };
    } catch (e: any) {
      return { server: 'ok', database: 'error', details: e.message };
    }
  }
}
