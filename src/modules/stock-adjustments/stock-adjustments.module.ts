import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockAdjustmentsController } from './stock-adjustments.controller';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { StockAdjustment } from 'src/database/entities/stock-adjustment.entity';
import { StockAdjustmentLine } from 'src/database/entities/stock-adjustment-line.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockAdjustment, StockAdjustmentLine]),
  ],
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService],
  exports: [StockAdjustmentsService],
})
export class StockAdjustmentsModule {}