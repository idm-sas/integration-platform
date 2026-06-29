import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { Product } from '../../database/entities/product.entity';
import { ProductCategory } from '../../database/entities/product-category.entity';
import { PrincipalCategoryAccess } from '../../database/entities/principal-category-access.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductCategory, PrincipalCategoryAccess]),
  ],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
