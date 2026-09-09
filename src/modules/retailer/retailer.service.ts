import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { JwtPayload } from '../../auth/token.service';
import { Salesman } from 'src/database/entities/salesman.entity';
import { Retailer } from 'src/database/entities/retailers.entity';
import { RetailerQueryDto } from './dto/retailer-query.dto';
import { SUCCESS_MESSAGE } from 'src/common/constants/http-status.constant';

@Injectable()
export class RetailerService {
  private readonly logger = new Logger(RetailerService.name);
  
  constructor(
    @InjectRepository(Retailer)
    private retailerRepo: Repository<Retailer>,
  ) {}

  private getAllowedCategories(scopes: string[]): string[] | null {
    if (scopes.includes('product:read:*')) return null;

    const allowed: string[] = [];
    for (const scope of scopes) {
      const match = scope.match(/^product:read:(.+)$/);
      if (match) allowed.push(match[1].toLowerCase());
    }
    return allowed;
  }

  private buildRetailerQuery(includeRules: boolean): SelectQueryBuilder<Retailer> {
    const qb = this.retailerRepo
      .createQueryBuilder('retailer')

    if (includeRules) {
      qb.innerJoinAndSelect('retailer.rules', 'rules', 'rules.isActive = true');
      qb.innerJoinAndSelect('rules.category', 'category');
      qb.innerJoinAndSelect('rules.salesman', 'salesman');
    }

    return qb;
  }

  private toDto(retailer: Retailer, includeRules: boolean) {
    return {
      id: retailer.id,
      retailerErpId: retailer.value,
      retailerName: retailer.name,
      outletErpId: retailer.location.replace(/\[.*?\] ?/, '').trim() ?? null,
      OutletName: retailer.location.replace(/\[.*?\] ?/, '').trim() ?? null,
      bpGroup: retailer.bpGroup ?? null,
      address: retailer.address ?? null,
      marketname: retailer.marketname ?? null,
      city: retailer.city ?? null,
      subcity: retailer.subcity ?? null,
      region: retailer.region ?? null,
      country: retailer.country ?? null,
      beat: retailer.postal ?? null,
      beatErpId: retailer.postal ?? null,
      latitude: null,
      longitude: null,
      deactivated: retailer.isActive,
      createdAt: retailer.createdAt,
      lastUpdateAt: retailer.syncedAt,
      ...(includeRules && {
        rules: (retailer.rules || []).map((rr) => ({
          distributorErpId: rr.orgTrx,
          userErpId: rr.salesman?.name ?? null,
        })),
      }),
    };
  }

  async findAll(query: RetailerQueryDto, principal: JwtPayload) {
    const allowedCats = this.getAllowedCategories(principal.scopes);
    const includeRules = true;
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.buildRetailerQuery(includeRules);

    // Exclude retailer Luar Area and arcode is not null
    qb.andWhere("retailer.name NOT LIKE '[LA]%'")
      .andWhere("retailer.location NOT LIKE '[LA]%'")
      .andWhere('salesman.bpGroup = :bpGroup', { bpGroup: 'SALES SIGNIFY' })
      .andWhere("retailer.arcode IS NOT NULL");

    // Filter by allowed categories dari scope token
    if (allowedCats !== null && allowedCats.length > 0) {
      qb.andWhere('LOWER(category.name) IN (:...cats)', { cats: allowedCats });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('retailer.isActive = :isActive', { isActive: query.isActive });
    }

    qb.orderBy('retailer.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [retailers, total] = await qb.getManyAndCount();

    this.logger.log(
      `findAll: ${retailers.length} retailers fetched | principal: ${principal.sub}`,
    );

    return {
      message: SUCCESS_MESSAGE.FETCH_LIST,
      data: retailers.map((r) => this.toDto(r, includeRules)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
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
