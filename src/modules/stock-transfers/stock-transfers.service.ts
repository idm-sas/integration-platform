import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SUCCESS_MESSAGE } from '../../common/constants/http-status.constant';
import { EXCLUDED_PRODUCT_GROUPS } from '../../common/constants/product.constant';
import { TRANSFER_DOCTYPE_IDS } from '../../common/constants/doctype.constant';

import { JwtPayload } from '../../auth/token.service';

import { StockTransferLine } from '../../database/entities/stock-transfer-line.entity';

import { StockTransfersQueryDto } from './dto/stock-transfers-query.dto';
import {
  StockTransfersDto,
  StockTransfersLineDto,
  StockTransfersSnapshotResponseDto,
} from './dto/stock-transfers-snapshot.dto';

interface StockTransferRow {
  headerId: string;
  documentNo: string;
  sellerErpId: string;
  fromLocatorId: string;
  toLocatorId: string;
  fromWarehouseErpId: string;
  toWarehouseErpId: string;
  movementDate: string;
  productErpId: string;
  sapProductCode: string | null;
  productName: string;
  actualReceiveStockQty: string | number;
}

@Injectable()
export class StockTransfersService {
  private readonly logger = new Logger(StockTransfersService.name);

  constructor(
    @InjectRepository(StockTransferLine)
    private readonly lineRepo: Repository<StockTransferLine>,
  ) {}

  async getStockTransfers(
    query: StockTransfersQueryDto,
    principal: JwtPayload,
  ): Promise<StockTransfersSnapshotResponseDto> {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    const generatedAt = new Date().toISOString();

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

    this.validateDateRange(query.dateFrom, query.dateTo);

    const allowedCats = this.getAllowedCategories(
      principal.scopes ?? [],
    );

    this.logger.log(
      `Loading stock transfers | principal=${principal.sub} | ` +
        `dateFrom=${query.dateFrom} dateTo=${query.dateTo} | ` +
        `page=${page} limit=${limit}`,
    );

    if (
      TRANSFER_DOCTYPE_IDS.length === 0 ||
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
      .innerJoin('line.stockTransfer', 'header')
      .innerJoin('line.product', 'product')

      // Locator asal → warehouse asal.
      .innerJoin('line.locator', 'fromLocator')
      .innerJoin('fromLocator.warehouse', 'fromWarehouse')

      // Locator tujuan → warehouse tujuan.
      .innerJoin('line.locatorTo', 'toLocator')
      .innerJoin('toLocator.warehouse', 'toWarehouse')

      .select('header.id', 'headerId')
      .addSelect('header.documentNo', 'documentNo')
      .addSelect('header.sellerErpId', 'sellerErpId')

      // Tetap digunakan sebagai key snapshot.
      .addSelect('line.locatorErpId', 'fromLocatorId')
      .addSelect('line.locatorToErpId', 'toLocatorId')

      // Nilai yang ditampilkan pada respons.
      .addSelect('fromWarehouse.organization', 'fromWarehouseErpId')
      .addSelect('toWarehouse.organization', 'toWarehouseErpId')

      .addSelect(
        `TO_CHAR("header"."movementDate", 'YYYY-MM-DD')`,
        'movementDate',
      )

      .addSelect('product.code', 'productErpId')
      .addSelect('product.partner_code', 'sapProductCode')
      .addSelect('product.name', 'productName')
      .addSelect(
        'line.ActualReceiveStockQty',
        'actualReceiveStockQty',
      )

      .where('header.movementDate >= :dateFrom', {
        dateFrom: query.dateFrom,
      })
      .andWhere('header.movementDate <= :dateTo', {
        dateTo: query.dateTo,
      })
      .andWhere('header.c_doctype_id IN (:...docTypes)', {
        docTypes: TRANSFER_DOCTYPE_IDS,
      });

    if (EXCLUDED_PRODUCT_GROUPS.length > 0) {
      qb.andWhere(
        'product.group2 NOT IN (:...excludedGroups)',
        {
          excludedGroups: EXCLUDED_PRODUCT_GROUPS,
        },
      );
    }

    // Scope JWT membatasi kategori produk.
    if (allowedCats !== null) {
      qb.innerJoin('product.category', 'category')
        .andWhere('LOWER(category.name) IN (:...cats)', {
          cats: allowedCats,
        });
    }

    // Tidak ada SUM, DISTINCT, atau GROUP BY.
    const rows = await qb
      .orderBy('header.movementDate', 'ASC')
      .addOrderBy('header.documentNo', 'ASC')
      .addOrderBy('header.id', 'ASC')
      .addOrderBy('line.locatorErpId', 'ASC')
      .addOrderBy('line.locatorToErpId', 'ASC')
      .addOrderBy('line.id', 'ASC')
      .getRawMany<StockTransferRow>();

    // Menyusun detail ke snapshot dokumen + pasangan locator.
    // Setiap line tetap menjadi satu item.
    const snapshots = new Map<string, StockTransfersDto>();

    for (const row of rows) {
      const key = JSON.stringify([
        row.headerId,
        row.fromLocatorId,
        row.toLocatorId,
      ]);

      let snapshot = snapshots.get(key);

      if (!snapshot) {
        snapshot = new StockTransfersDto({
          ERPTransferDocId: row.documentNo,
          DistributorErpId: row.sellerErpId,
          FromWarehouseErpId: row.fromWarehouseErpId,
          ToWarehouseErpId: row.toWarehouseErpId,
          Time: row.movementDate,
          Items: [],
        });

        snapshots.set(key, snapshot);
      }

      snapshot.Items.push(
        new StockTransfersLineDto({
          ProductErpId: row.productErpId,
          sapProductCode: row.sapProductCode ?? "",
          ProductName: row.productName,
          ActualReceiveStockQty: Number(
            row.actualReceiveStockQty,
          ),
        }),
      );
    }

    // Pagination setelah snapshot terbentuk agar Items tidak terpotong.
    const allData = [...snapshots.values()];
    const total = allData.length;
    const data = allData.slice(offset, offset + limit);

    this.logger.log(
      `Stock transfers fetched | lines=${rows.length} | ` +
        `snapshots=${total} | returned=${data.length}`,
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
    data: StockTransfersDto[],
    total: number,
    page: number,
    limit: number,
    generatedAt: string,
  ): StockTransfersSnapshotResponseDto {
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