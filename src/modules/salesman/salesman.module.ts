import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategory } from '../../database/entities/product-category.entity';
import { SalesmanService } from './salesman.service';
import { SalesmanController } from './salesman.controller';
import { PrincipalCategoryAccess } from 'src/database/entities/principal-category-access.entity';
import { Salesman } from 'src/database/entities/salesman.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Salesman, PrincipalCategoryAccess])],
  controllers: [SalesmanController],
  providers: [SalesmanService],
})
export class SalesmanModule {}
