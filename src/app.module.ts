import {
  Module, MiddlewareConsumer, NestModule, RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  appConfig, dbConfig, jwtConfig, redisConfig, idempiereConfig, syncConfig,
} from './config/app.config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ProductModule } from './modules/product/product.module';
import { ProductCategoryModule } from './modules/product-category/product-category.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { AuditLogMiddleware } from './middleware/audit-log.middleware';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { ApiAuditLog } from './database/entities/api-audit-log.entity';
import { Principal } from './database/entities/principal.entity';
import { IdempiereModule } from './idempiere/idempiere.module';
import { SalesmanModule } from './modules/salesman/salesman.module';
import { RetailerModule } from './modules/retailer/retailer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, jwtConfig, redisConfig, idempiereConfig, syncConfig],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,

    // Register entities needed by middleware
    TypeOrmModule.forFeature([ApiAuditLog, Principal]),

    AuthModule,
    ProductModule,
    ProductCategoryModule,
    MonitoringModule,
    IdempiereModule,
    SalesmanModule,
    RetailerModule,
  ],
  providers: [AuditLogMiddleware, RateLimitMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuditLogMiddleware)
      .forRoutes({ path: 'api/*', method: RequestMethod.ALL });
  }
}
