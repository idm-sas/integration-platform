import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SecondarySalesController } from './secondary-sales.controller';
import { SecondarySalesService } from './secondary-sales.service';

import { IdempiereModule } from '../../idempiere/idempiere.module';

import { Product } from '../../database/entities/product.entity';
import { Retailer } from '../../database/entities/retailers.entity';
import { Salesman } from '../../database/entities/salesman.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Retailer,
      Salesman,
    ]),
    IdempiereModule,
  ],

  controllers: [
    SecondarySalesController,
  ],

  providers: [
    SecondarySalesService,
  ],

  exports: [
    SecondarySalesService,
  ],
})
export class SecondarySalesModule {}