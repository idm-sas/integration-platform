import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck, HealthCheckService, TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  @Get('ping')
  @ApiOperation({ summary: 'Simple ping' })
  ping() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
