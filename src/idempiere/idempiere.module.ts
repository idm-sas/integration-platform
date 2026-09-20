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
import { RetailerRules } from 'src/database/entities/retailer-rules.entity';
import { Warehouse } from '../database/entities/warehouse.entity';
import { Locator } from '../database/entities/locator.entity';
import { WarehouseSyncService } from './sync/warehouse-sync.service';
import { InventoryStock } from 'src/database/entities/inventory-stock.entity';
import { InventoryStockSyncService } from './sync/inventory-stock-sync.service';
import { InvoiceLine } from 'src/database/entities/invoice-line.entity';
import { InvoiceHeader } from 'src/database/entities/invoice-header.entity';
import { SecondarySalesSyncService } from './sync/secondary-sales-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductCategory,
      ProductPrice,
      Salesman,
      Retailer,
      RetailerRules,
      Warehouse,
      Locator,
      InventoryStock,
      InvoiceHeader,
      InvoiceLine,
    ]),
  ],
  controllers: [SyncController],
  providers: [
    IdempiereService,
    ProductSyncService,
    SalesmanSyncService,
    RetailersSyncService,
    WarehouseSyncService,
    InventoryStockSyncService,
    SecondarySalesSyncService,
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