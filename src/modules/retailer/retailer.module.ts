import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategory } from '../../database/entities/product-category.entity';
import { RetailerService } from './retailer.service';
import { RetailerController } from './retailer.controller';
import { PrincipalCategoryAccess } from 'src/database/entities/principal-category-access.entity';
import { Retailer } from 'src/database/entities/retailers.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Retailer, PrincipalCategoryAccess])],
  controllers: [RetailerController],
  providers: [RetailerService],
})
export class RetailerModule {}
