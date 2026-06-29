import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategoryController } from './product-category.controller';
import { ProductCategoryService } from './product-category.service';
import { ProductCategory } from '../../database/entities/product-category.entity';
import { PrincipalCategoryAccess } from '../../database/entities/principal-category-access.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductCategory, PrincipalCategoryAccess])],
  controllers: [ProductCategoryController],
  providers: [ProductCategoryService],
})
export class ProductCategoryModule {}
