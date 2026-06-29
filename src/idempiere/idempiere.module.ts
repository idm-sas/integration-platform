import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempiereService } from './idempiere.service';
import { ProductSyncService } from './sync/product-sync.service';
import { SyncController } from './sync/sync.controller';
import { Product } from '../database/entities/product.entity';
import { ProductCategory } from '../database/entities/product-category.entity';
import { ProductPrice } from '../database/entities/product-price.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductCategory, ProductPrice]),
  ],
  controllers: [SyncController],
  providers: [IdempiereService, ProductSyncService],
  exports: [IdempiereService, ProductSyncService],
})
export class IdempiereModule {}
