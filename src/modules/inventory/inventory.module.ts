import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryStock } from '../../database/entities/inventory-stock.entity'; // ← import entity
import { Product } from '../../database/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryStock, Product]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}