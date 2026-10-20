import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockTransfersController } from './stock-transfers.controller';
import { StockTransfersService } from './stock-transfers.service';
import { StockTransfer } from 'src/database/entities/stock-transfer.entity';
import { StockTransferLine } from 'src/database/entities/stock-transfer-line.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockTransfer, StockTransferLine]),
  ],
  controllers: [StockTransfersController],
  providers: [StockTransfersService],
  exports: [StockTransfersService],
})
export class StockTransfersModule {}