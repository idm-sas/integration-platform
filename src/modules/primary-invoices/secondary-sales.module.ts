import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SecondarySalesController } from './secondary-sales.controller';
import { SecondarySalesService } from './secondary-sales.service';

import { InvoiceHeader } from '../../database/entities/invoice-header.entity';
import { InvoiceLine } from '../../database/entities/invoice-line.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([InvoiceHeader, InvoiceLine]),
  ],
  controllers: [SecondarySalesController],
  providers: [SecondarySalesService],
  exports: [SecondarySalesService],
})
export class SecondarySalesModule {}