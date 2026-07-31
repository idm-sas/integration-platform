import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { IdempiereModule } from '../../idempiere/idempiere.module';
import { Product } from '../../database/entities/product.entity';
import { Locator } from 'src/database/entities/locator.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Locator, Product]),
    IdempiereModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
