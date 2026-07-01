import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Product } from '../../database/entities/product.entity';
import { ProductCategory } from '../../database/entities/product-category.entity';
import { PrincipalCategoryAccess } from '../../database/entities/principal-category-access.entity';
import { ProductQueryDto } from './dto/product-query.dto';
import { JwtPayload } from '../../auth/token.service';
import { SUCCESS_MESSAGE } from '../../common/constants/http-status.constant';
import { EXCLUDED_PRODUCT_GROUPS } from '../../common/constants/product.constant';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
    @InjectRepository(PrincipalCategoryAccess)
    private readonly accessRepo: Repository<PrincipalCategoryAccess>,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Ekstrak category codes yang diizinkan dari scopes token.
   * Return null berarti semua category boleh diakses.
   * Format scope: "product:read:electronics" atau "product:read:*"
   */
  private getAllowedCategories(scopes: string[]): string[] | null {
    if (scopes.includes('product:read:*')) return null;

    const allowed: string[] = [];
    for (const scope of scopes) {
      const match = scope.match(/^product:read:(.+)$/);
      if (match) allowed.push(match[1].toLowerCase());
    }
    return allowed;
  }

  private hasPriceScope(scopes: string[]): boolean {
    if (scopes.includes('price:read:*')) return true;
    return scopes.some((s) => s.startsWith('price:read:'));
  }

  private validateCategoryAccess(
    categoryCode: string,
    allowedCats: string[] | null,
  ): void {
    if (allowedCats === null) return;
    if (!allowedCats.includes(categoryCode.toLowerCase())) {
      throw new ForbiddenException(
        `Access to category '${categoryCode}' is not permitted`,
      );
    }
  }

  private buildProductQuery(includePrices: boolean): SelectQueryBuilder<Product> {
    const qb = this.productRepo
      .createQueryBuilder('product')
      .innerJoinAndSelect('product.category', 'category');

    if (includePrices) {
      qb.leftJoinAndSelect('product.prices', 'prices', 'prices.isActive = true');
    }

    return qb;
  }

  private toDto(product: Product, includePrices: boolean) {
    return {
      id: product.id,
      code: product.code,
      name: product.name,
      description: product.description ?? null,
      uom: product.uom,
      isActive: product.isActive,
      categoryId: product.category?.id,
      categoryName: product.category?.name,
      group2: product.group2,
      imageUrl: product.imageUrl,
      partner_code: product.partner_code,
      syncedAt: product.syncedAt,
      ...(includePrices && {
        prices: (product.prices || []).map((pp) => ({
          priceListId: pp.priceListId,
          priceListName: pp.priceListName,
          listPrice: Number(pp.listPrice),
          currency: pp.currency,
        })),
      }),
    };
  }

  // ─── Public Methods ──────────────────────────────────────────────────────────

  async findAll(query: ProductQueryDto, principal: JwtPayload) {
    const allowedCats = this.getAllowedCategories(principal.scopes);
    const includePrices = this.hasPriceScope(principal.scopes);
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.buildProductQuery(includePrices);

    qb.where('product.group2 NOT IN (:...excludedGroups)', {
      excludedGroups: EXCLUDED_PRODUCT_GROUPS,
    });

    // Filter by allowed categories dari scope token
    if (allowedCats !== null && allowedCats.length > 0) {
      qb.andWhere('LOWER(category.name) IN (:...cats)', { cats: allowedCats });
    }

    // Filter by query params
    if (query.category) {
      qb.andWhere('LOWER(category.name) = :cat', {
        cat: query.category.toLowerCase(),
      });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(product.name) LIKE :search OR LOWER(product.code) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    if (query.isActive !== undefined) {
      qb.andWhere('product.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy('product.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [products, total] = await qb.getManyAndCount();

    this.logger.log(
      `findAll: ${products.length} products fetched | principal: ${principal.sub}`,
    );

    return {
      message: SUCCESS_MESSAGE.FETCH_LIST,
      data: products.map((p) => this.toDto(p, includePrices)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, principal: JwtPayload) {
    const allowedCats = this.getAllowedCategories(principal.scopes);
    const includePrices = this.hasPriceScope(principal.scopes);

    const product = await this.buildProductQuery(includePrices)
      .where('product.id = :id', { id })
      .andWhere('product.group2 NOT IN (:...excludedGroups)', {
        excludedGroups: EXCLUDED_PRODUCT_GROUPS,
      })
      .getOne();

    if (!product) {
      throw new NotFoundException(`Product with id '${id}' not found`);
    }

    this.validateCategoryAccess(product.category.name, allowedCats);

    this.logger.log(`findOne: ${product.name} | principal: ${principal.sub}`);

    return {
      message: SUCCESS_MESSAGE.FETCH,
      data: this.toDto(product, includePrices),
    };
  }

  async findByCode(code: string, principal: JwtPayload) {
    const allowedCats = this.getAllowedCategories(principal.scopes);
    const includePrices = this.hasPriceScope(principal.scopes);

    const product = await this.buildProductQuery(includePrices)
      .where('UPPER(product.code) = :code', { code: code.toUpperCase() })
      .andWhere('product.group2 NOT IN (:...excludedGroups)', {
        excludedGroups: EXCLUDED_PRODUCT_GROUPS,
      })
      .getOne();

    if (!product) {
      throw new NotFoundException(`Product with code '${code}' not found`);
    }

    this.validateCategoryAccess(product.category.name, allowedCats);

    this.logger.log(`findByCode: ${product.code} | principal: ${principal.sub}`);

    return {
      message: SUCCESS_MESSAGE.FETCH,
      data: this.toDto(product, includePrices),
    };
  }
}