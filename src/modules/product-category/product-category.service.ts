import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory } from '../../database/entities/product-category.entity';
import { PrincipalCategoryAccess } from '../../database/entities/principal-category-access.entity';
import { JwtPayload } from '../../auth/token.service';

@Injectable()
export class ProductCategoryService {
  constructor(
    @InjectRepository(ProductCategory)
    private categoryRepo: Repository<ProductCategory>,
    @InjectRepository(PrincipalCategoryAccess)
    private accessRepo: Repository<PrincipalCategoryAccess>,
  ) {}

  /** Tampilkan hanya category yang diizinkan sesuai scope token */
  async findAccessible(principal: JwtPayload) {
    const allowedCodes = this.extractCategoryCodesFromScopes(principal.scopes);

    const qb = this.categoryRepo
      .createQueryBuilder('cat')
      .where('cat.isActive = true')
      .orderBy('cat.name', 'ASC');

    if (allowedCodes !== null && allowedCodes.length > 0) {
      qb.andWhere('LOWER(cat.code) IN (:...codes)', {
        codes: allowedCodes.map((c) => c.toLowerCase()),
      });
    }

    const categories = await qb.getMany();

    return categories.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      description: c.description,
      isActive: c.isActive,
    }));
  }

  private extractCategoryCodesFromScopes(scopes: string[]): string[] | null {
    const codes: string[] = [];
    for (const scope of scopes) {
      if (scope.includes(':*')) return null;
      const match = scope.match(/^(?:product|price):(?:read|sync):(.+)$/);
      if (match && !codes.includes(match[1])) codes.push(match[1]);
    }
    return codes;
  }
}
