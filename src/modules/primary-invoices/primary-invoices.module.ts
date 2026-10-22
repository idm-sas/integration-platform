import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrimaryInvoicesController } from './primary-invoices.controller';
import { PrimaryInvoicesService } from './primary-invoices.service';
import { InvoiceHeader } from '../../database/entities/invoice-header.entity';
import { InvoiceLine } from '../../database/entities/invoice-line.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([InvoiceHeader, InvoiceLine]),
  ],
  controllers: [PrimaryInvoicesController],
  providers: [PrimaryInvoicesService],
  exports: [PrimaryInvoicesService],
})
export class PrimaryInvoicesModule {}