// Pastikan idempiere.module.ts isinya seperti ini
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempiereService } from './idempiere.service';
import { ProductSyncService } from './sync/product-sync.service';
import { SalesmanSyncService } from './sync/salesman-sync.service';
import { SyncOrchestratorService } from './sync/sync-orchestrator.service';
import { SyncController } from './sync/sync.controller';
import { Product } from '../database/entities/product.entity';
import { ProductCategory } from '../database/entities/product-category.entity';
import { ProductPrice } from '../database/entities/product-price.entity';
import { Salesman } from '../database/entities/salesman.entity';
import { RetailersSyncService } from './sync/retailers-sync.service';
import { Retailer } from 'src/database/entities/retailers.entity';
import { Warehouse } from '../database/entities/warehouse.entity';
import { Locator } from '../database/entities/locator.entity';
import { WarehouseSyncService } from './sync/warehouse-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductCategory,
      ProductPrice,
      Salesman,
      Retailer,
      Warehouse,
      Locator,
    ]),
  ],
  controllers: [SyncController],
  providers: [
    IdempiereService,
    ProductSyncService,
    SalesmanSyncService,
    RetailersSyncService,
    WarehouseSyncService,
    SyncOrchestratorService,
  ],
  exports: [
    IdempiereService,
    ProductSyncService,
    SalesmanSyncService,
    RetailersSyncService,
    WarehouseSyncService,
    SyncOrchestratorService,
  ],
})
export class IdempiereModule {}