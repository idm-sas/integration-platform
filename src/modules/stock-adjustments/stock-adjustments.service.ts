import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SUCCESS_MESSAGE } from '../../common/constants/http-status.constant';
import { EXCLUDED_PRODUCT_GROUPS } from '../../common/constants/product.constant';
import { ADJUSTMENT_DOCTYPE_IDS } from '../../common/constants/doctype.constant';

import { JwtPayload } from '../../auth/token.service';

import { StockAdjustmentLine } from '../../database/entities/stock-adjustment-line.entity';

import { StockAdjustmentsQueryDto } from './dto/stock-adjustments-query.dto';
import {
  StockAdjustmentsDto,
  StockAdjustmentsLineDto,
  StockAdjustmentsSnapshotResponseDto,
} from './dto/stock-adjustments-snapshot.dto';

interface AggregatedStockAdjustmentRow {
  distributorErpId: string;
  warehouseErpId: string;
  productErpId: string;
  sapProductCode: string | null;
  stockQuantityInUnitOld: string | number;
  stockQuantityInUnitNew: string | number;
  time: string;
}

@Injectable()
export class StockAdjustmentsService {
  private readonly logger = new Logger(
    StockAdjustmentsService.name,
  );

  constructor(
    @InjectRepository(StockAdjustmentLine)
    private readonly lineRepo: Repository<StockAdjustmentLine>,
  ) {}

  async getStockAdjustments(
    query: StockAdjustmentsQueryDto,
    principal: JwtPayload,
  ): Promise<StockAdjustmentsSnapshotResponseDto> {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const generatedAt = new Date().toISOString();

    // Validasi pagination.
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1
    ) {
      throw new BadRequestException(
        'page dan limit harus berupa bilangan bulat positif.',
      );
    }

    const offset = (page - 1) * limit;

    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(offset + limit)
    ) {
      throw new BadRequestException(
        'Nilai pagination terlalu besar.',
      );
    }

    // movementDate pada entity bertipe date.
    this.validateDateRange(query.dateFrom, query.dateTo);

    const allowedCats = this.getAllowedCategories(
      principal.scopes ?? [],
    );

    this.logger.log(
      `Loading stock adjustments | principal=${principal.sub} | ` +
      `dateFrom=${query.dateFrom} dateTo=${query.dateTo} | ` +
      `page=${page} limit=${limit}`,
    );

    // Tidak ada document type atau kategori yang boleh diakses.
    if (
      ADJUSTMENT_DOCTYPE_IDS.length === 0 ||
      (allowedCats !== null && allowedCats.length === 0)
    ) {
      return this.createResponse(
        [],
        0,
        page,
        limit,
        generatedAt,
      );
    }

    const qb = this.lineRepo
      .createQueryBuilder('line')
      .innerJoin('line.stockAdjustment', 'header')
      .innerJoin('header.warehouse', 'warehouse')
      .innerJoin('line.product', 'product')

      .select(
        'header.sellerErpId',
        'distributorErpId',
      )
      .addSelect(
        'warehouse.organization',
        'warehouseErpId',
      )
      .addSelect(
        'product.code',
        'productErpId',
      )
      .addSelect(
        'product.partner_code',
        'sapProductCode',
      )
      .addSelect(
        'SUM(line.stockQuantityInUnitOld)',
        'stockQuantityInUnitOld',
      )
      .addSelect(
        'SUM(line.stockQuantityInUnitNew)',
        'stockQuantityInUnitNew',
      )
      .addSelect(
        `TO_CHAR("header"."movementDate", 'YYYY-MM-DD')`,
        'time',
      )

      .where('header.movementDate >= :dateFrom', {
        dateFrom: query.dateFrom,
      })
      .andWhere('header.movementDate <= :dateTo', {
        dateTo: query.dateTo,
      })
      .andWhere('header.c_doctype_id IN (:...docTypes)', {
        docTypes: ADJUSTMENT_DOCTYPE_IDS,
      });

    // Pertahankan filter pengecualian product group.
    if (EXCLUDED_PRODUCT_GROUPS.length > 0) {
      qb.andWhere(
        'product.group2 NOT IN (:...excludedGroups)',
        {
          excludedGroups: EXCLUDED_PRODUCT_GROUPS,
        },
      );
    }

    // null = akses semua kategori.
    if (allowedCats !== null) {
      qb.innerJoin('product.category', 'category')
        .andWhere('LOWER(category.name) IN (:...cats)', {
          cats: allowedCats,
        });
    }

    // SUM hanya dilakukan ketika endpoint dibaca.
    const rows = await qb
      .groupBy('header.sellerErpId')
      .addGroupBy('warehouse.organization')
      .addGroupBy('product.code')
      .addGroupBy('product.partner_code')
      .addGroupBy('header.movementDate')

      .orderBy('header.sellerErpId', 'ASC')
      .addOrderBy('warehouse.organization', 'ASC')
      .addOrderBy('header.movementDate', 'ASC')
      .addOrderBy('product.code', 'ASC')
      .addOrderBy('product.partner_code', 'ASC')

      .getRawMany<AggregatedStockAdjustmentRow>();

    // Bentuk respons per distributor + organisasi warehouse.
    const grouped = new Map<string, StockAdjustmentsDto>();

    for (const row of rows) {
      const key = JSON.stringify([
        row.distributorErpId,
        row.warehouseErpId,
      ]);

      let group = grouped.get(key);

      if (!group) {
        group = new StockAdjustmentsDto({
          distributorErpId: row.distributorErpId,
          warehouseErpId: row.warehouseErpId,
          product: [],
        });

        grouped.set(key, group);
      }

      group.product.push(
        new StockAdjustmentsLineDto({
          productErpId: row.productErpId,
          sapProductCode: row.sapProductCode ?? '',
          stockQuantityInUnitOld: Number(
            row.stockQuantityInUnitOld,
          ),
          stockQuantityInUnitNew: Number(
            row.stockQuantityInUnitNew,
          ),
          time: row.time,
        }),
      );
    }

    const groups = [...grouped.values()];
    const total = groups.length;
    const data = groups.slice(offset, offset + limit);

    this.logger.log(
      `Stock adjustments aggregated | rows=${rows.length} | ` +
      `groups=${total} | returned=${data.length}`,
    );

    return this.createResponse(
      data,
      total,
      page,
      limit,
      generatedAt,
    );
  }

  private createResponse(
    data: StockAdjustmentsDto[],
    total: number,
    page: number,
    limit: number,
    generatedAt: string,
  ): StockAdjustmentsSnapshotResponseDto {
    return {
      message: SUCCESS_MESSAGE.FETCH_LIST,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        generatedAt,
      },
    };
  }

  private validateDateRange(
    dateFrom: string,
    dateTo: string,
  ): void {
    const isValidDate = (value: string): boolean => {
      if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return false;
      }

      const date = new Date(`${value}T00:00:00Z`);

      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    };

    if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
      throw new BadRequestException(
        'dateFrom dan dateTo harus berupa tanggal valid YYYY-MM-DD.',
      );
    }

    if (dateFrom > dateTo) {
      throw new BadRequestException(
        'dateFrom tidak boleh lebih besar dari dateTo.',
      );
    }
  }

  private getAllowedCategories(
    scopes: string[],
  ): string[] | null {
    if (scopes.includes('product:read:*')) {
      return null;
    }

    const allowed = new Set<string>();

    for (const scope of scopes) {
      const match = scope.match(/^product:read:(.+)$/);

      if (match) {
        allowed.add(match[1].toLowerCase());
      }
    }

    return [...allowed];
  }
}