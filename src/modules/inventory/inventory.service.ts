import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { Product } from '../../database/entities/product.entity';
import { Locator } from '../../database/entities/locator.entity';

import { JwtPayload } from '../../auth/token.service';
import { SUCCESS_MESSAGE } from '../../common/constants/http-status.constant';

import { IdempiereService } from '../../idempiere/idempiere.service';
import { IdempiereStorageOnHandRecord } from '../../idempiere/interfaces/idempiere-response.interface';

import { InventoryQueryDto } from './dto/inventory-query.dto';

import {
  InventorySnapshotItemDto,
  InventorySnapshotWarehouseDto,
} from './dto/inventory-snapshot.dto';

interface InventoryGroup {
  warehouseErpId: number;
  warehouseCode: string;
  warehouseName: string;

  productErpId: number;
  productCode: string;

  sapProductCode: string | null;

  stockQuantityInStdUnit: number;
  stockQuantityInUnit: number;

  batchNo: string | null;
  DateInventory: string | null;
}

interface GroupedInventory {
  warehouseErpId: number;
  warehouseCode: string;
  warehouseName: string;

  productErpId: number;
  productCode: string;

  sapProductCode: string | null;

  stockQuantityInStdUnit: number;
  stockQuantityInUnit: number;

  batchNo: string | null;
  DateInventory: string | null;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(Locator)
    private readonly locatorRepo: Repository<Locator>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly idempiereService: IdempiereService,

    private readonly configService: ConfigService,
  ) {}

  async getSnapshot(
    query: InventoryQueryDto,
    principal: JwtPayload,
  ) {

      const generatedAt = new Date().toISOString();

      this.logger.log('Loading inventory snapshot...');

      const stockRecords = await this.loadStorage(
    query.dateFrom,
    query.dateTo,
  );

      const locatorMap = await this.loadLocators();

      const productMap = await this.loadProducts();

      const grouped = this.groupStocks(
          stockRecords,
          locatorMap,
          productMap,
          query,
      );

      const warehouses = this.buildWarehouseSnapshot(
          grouped,
          generatedAt,
      );

      const paged = this.paginate(
          warehouses,
          query.page,
          query.limit,
      );

      return {
          message: SUCCESS_MESSAGE.FETCH_LIST,

          data: paged.data,

          meta: {
              total: paged.total,
              page: query.page,
              limit: query.limit,
              totalPages: paged.totalPages,
              generatedAt,
          },
      };
  }

  private async loadStorage(dateFrom: string, dateTo: string): Promise<IdempiereStorageOnHandRecord[]> {
    const stocks =
    await this.idempiereService.getAllStorageOnHand(
      dateFrom,
      dateTo,
    );

    this.logger.log(`Storage loaded : ${stocks.length}`);

    return stocks;
  }

  private async loadLocators(): Promise<Map<number, Locator>> {

  const locators = await this.locatorRepo.find({
      where: {
        isActive: true,
        locatorTypeId: 1000000,
        warehouse: {
          idempiereId: In([
            1000000,
            1000002,
            1000012,
            2200056,
            2200022,
          ]),
        },
      },
      relations: ['warehouse'],
    });

    this.logger.log(
      `Locator loaded : ${locators.length}`,
    );

    const map = new Map<number, Locator>();

    for (const locator of locators) {
      map.set(locator.idempiereId, locator);
    }

    return map;
  }

  private async loadProducts(): Promise<Map<number, Product>> {

    const products = await this.productRepo.find({
      where: {
        isActive: true,
        // idempiereId: In([
        //   2200736
        // ]),
      },
    });

    this.logger.log(
      `Product loaded : ${products.length}`,
    );

    const map = new Map<number, Product>();

    for (const product of products) {
      map.set(product.idempiereId, product);
    }

    return map;
  }


  private groupStocks(
    stocks: IdempiereStorageOnHandRecord[],
    locatorMap: Map<number, Locator>,
    productMap: Map<number, Product>,
    query: InventoryQueryDto,
  ): InventoryGroup[] {

    const grouped = new Map<string, InventoryGroup>();

    for (const stock of stocks) {

      const locatorId = stock.M_Locator_ID?.id;

      if (!locatorId) {
        continue;
      }

      const locator = locatorMap.get(locatorId);

      if (!locator) {
        continue;
      }

      const warehouse = locator.warehouse;

      const product = productMap.get(stock.M_Product_ID.id);

      if (!product) {
        continue;
      }

      const key =
        `${warehouse.idempiereId}_${product.idempiereId}`;

      if (!grouped.has(key)) {

        grouped.set(key, {

          warehouseErpId: warehouse.idempiereId,

          warehouseCode: warehouse.value,

          warehouseName: warehouse.name,

          productErpId: product.idempiereId,

          productCode: product.code,

          sapProductCode: product.partner_code ?? null,

          stockQuantityInStdUnit: 0,

          stockQuantityInUnit: 0,

          batchNo:
            stock.M_AttributeSetInstance_ID?.id > 0
              ? String(stock.M_AttributeSetInstance_ID.id)
              : null,

          DateInventory: stock.DateMaterialPolicy ?? null,
        });

      }

      const item = grouped.get(key)!;

      item.stockQuantityInStdUnit += Number(stock.QtyOnHand);

      item.stockQuantityInUnit += Number(stock.QtyOnHand);

    }

    this.logger.log(
      `Grouped inventory : ${grouped.size}`,
    );

    return [...grouped.values()];
  }


  private buildWarehouseSnapshot(
  grouped: GroupedInventory[],
  generatedAt: string,
): InventorySnapshotWarehouseDto[] {

  const distributorErpId =
    this.configService.get<string>('idempiere.clientId') ?? '';

  const warehouses = new Map<number, InventorySnapshotWarehouseDto>();

  for (const row of grouped) {

    if (!warehouses.has(row.warehouseErpId)) {

      warehouses.set(
        row.warehouseErpId,

        new InventorySnapshotWarehouseDto({

          distributorErpId,

          warehouseErpId: row.warehouseCode,

          warehouseName: row.warehouseName,

          createdAt: generatedAt,

          lastUpdatedAt: generatedAt,

          items: [],

        }),
      );

    }

    warehouses.get(row.warehouseErpId)!.items.push(

      new InventorySnapshotItemDto({

        productErpId: row.productCode,

        sapProductCode: row.sapProductCode,

        stockQuantityInStdUnit: row.stockQuantityInStdUnit,

        stockQuantityInUnit: row.stockQuantityInUnit,

        batchNo: row.batchNo,

        DateInventory:row.DateInventory,

      }),

    );

  }

  return [...warehouses.values()];

}

  private paginate<T>(
  data: T[],
  page: number,
  limit: number,
) {

  const total = data.length;

  const totalPages = Math.ceil(total / limit);

  return {

    data: data.slice(
      (page - 1) * limit,
      page * limit,
    ),

    total,

    totalPages,

  };

}
}