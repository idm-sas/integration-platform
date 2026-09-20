import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InventoryStock } from '../../database/entities/inventory-stock.entity';
import { Product } from '../../database/entities/product.entity';
import { JwtPayload } from '../../auth/token.service';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { SUCCESS_MESSAGE } from '../../common/constants/http-status.constant';
import { InventorySnapshotResponseDto } from './dto/inventory-snapshot.dto';
import { EXCLUDED_PRODUCT_GROUPS } from 'src/common/constants/product.constant';

type ProductWithStocks = Product & {
  stocks: InventoryStock[];
};

export interface SnapshotItem {
  productErpId: string;
  sapProductCode: string | null;
  stockQuantityInStdUnit: number;
  stockQuantityInUnit: number;
  batchNo: string | null;
  dateInventory: string | null;
}
interface WarehouseRow {
  warehouseId: string | number;
  warehouseName: string;
  organization: string | null;
}

interface WarehouseGroup {
  warehouseName: string;
  syncedAt: Date | null;
  items: Map<string, SnapshotItem>;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(InventoryStock)
    private readonly stockRepo: Repository<InventoryStock>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly configService: ConfigService,
  ) {}

  async getSnapshot(
    query: InventoryQueryDto,
    principal: JwtPayload,
  ): Promise<InventorySnapshotResponseDto> {
    const {
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = query;

  const allowedCats = this.getAllowedCategories(principal.scopes);

    const generatedAt = new Date().toISOString();

    this.logger.log(
      `Inventory snapshot | dateFrom: ${dateFrom} | dateTo: ${dateTo} | page: ${page} | principal: ${principal.sub}`,
    );

    // 1. Ambil warehouse yang memiliki stok dan produk
    // dalam rentang tanggal. Urutkan sebelum pagination.
    const warehouseQb = this.stockRepo
      .createQueryBuilder('stock')
      .innerJoin('stock.warehouse', 'warehouse')
      .innerJoin('stock.product', 'product')
      .leftJoin('product.category', 'category')
      .select('warehouse.id', 'warehouseId')
      .addSelect('warehouse.name', 'warehouseName')
      .addSelect('warehouse.organization', 'organization')
      .distinct(true)
      .where('stock.dateMaterialPolicy >= :dateFrom', {
        dateFrom,
      })
      .andWhere('stock.dateMaterialPolicy <= :dateTo', {
        dateTo,
      });

    this.applyProductAccess(warehouseQb, allowedCats);

    const warehouseRows = await warehouseQb
      .orderBy('warehouse.name', 'ASC')
      .addOrderBy('warehouse.id', 'ASC')
      .getRawMany<WarehouseRow>();

      // Organization kosong tetap dipisah per warehouse.
      const getOrganizationKey = (warehouse: WarehouseRow): string => {
        const organization = String(warehouse.organization ?? '').trim();

        return organization
          ? `org:${organization}`
          : `warehouse:${warehouse.warehouseId}`;
      };

      const organizationMap = new Map<
        string,
        {
          key: string;
          name: string;
          warehouses: WarehouseRow[];
        }
      >();

      for (const warehouse of warehouseRows) {
        const key = getOrganizationKey(warehouse);

        let organization = organizationMap.get(key);

        if (!organization) {
          organization = {
            key,
            name:
              String(warehouse.organization ?? '').trim() ||
              warehouse.warehouseName ||
              String(warehouse.warehouseId),
            warehouses: [],
          };

          organizationMap.set(key, organization);
        }

        organization.warehouses.push(warehouse);
      }

      // Urutkan dan lakukan pagination per organization.
      const organizations = Array.from(organizationMap.values()).sort(
        (a, b) =>
          a.name.localeCompare(b.name) || a.key.localeCompare(b.key),
      );

      // Nama variabel dipertahankan agar bagian meta tetap bisa digunakan.
      // Nilainya sekarang adalah jumlah grup organization.
      const totalWarehouses = organizations.length;

      const pagedOrganizations = organizations.slice(
        (page - 1) * limit,
        page * limit,
      );

      const warehouseIds = pagedOrganizations.flatMap((organization) =>
        organization.warehouses.map((warehouse) => warehouse.warehouseId),
      );

    // 3. Total baris stok seluruh warehouse, bukan hanya
    // warehouse pada halaman ini.
    const totalItemsQb = this.stockRepo
      .createQueryBuilder('stock')
      .innerJoin('stock.warehouse', 'warehouse')
      .innerJoin('stock.product', 'product')
      .leftJoin('product.category', 'category')
      .where('stock.dateMaterialPolicy >= :dateFrom', {
        dateFrom,
      })
      .andWhere('stock.dateMaterialPolicy <= :dateTo', {
        dateTo,
      });

    this.applyProductAccess(totalItemsQb, allowedCats);

    const totalItems = await totalItemsQb.getCount();

    const meta = {
      total: totalWarehouses,
      page,
      limit,
      totalPages: Math.ceil(totalWarehouses / limit),
      totalItems,
    };

    if (warehouseIds.length === 0) {
      return {
        message: SUCCESS_MESSAGE.FETCH,
        data: [],
        meta,
      };
    }

    // 4. Product sebagai tabel utama.
    // Map stok ke product.stocks tanpa memerlukan
    // deklarasi relasi stocks pada entity Product.
    const productsQb = this.productRepo
        .createQueryBuilder('product')
        .leftJoin('product.category', 'category')
        .leftJoinAndMapMany(
          'product.stocks',
          InventoryStock,
          'stock',
          `stock.productId = product.id
          AND stock.dateMaterialPolicy >= :dateFrom
          AND stock.dateMaterialPolicy <= :dateTo
          AND stock.warehouseId IN (:...warehouseIds)`,
          {
            dateFrom,
            dateTo,
            warehouseIds,
          },
        )
        .leftJoinAndSelect('stock.warehouse', 'warehouse')
        .where('1 = 1');

      this.applyProductAccess(productsQb, allowedCats);

      const products = (await productsQb
        .orderBy('product.code', 'ASC')
        .addOrderBy('product.id', 'ASC')
        .getMany()) as ProductWithStocks[];

    // 5. Siapkan group mengikuti urutan pagination warehouse.
    const warehouseMap = new Map<string, WarehouseGroup>();
    const warehouseToOrganization = new Map<string, string>();

    for (const organization of pagedOrganizations) {
      warehouseMap.set(organization.key, {
        // organization.name berasal dari string warehouse.organization.
        warehouseName: organization.name,
        syncedAt: null,
        items: new Map<string, SnapshotItem>(),
      });

      for (const warehouse of organization.warehouses) {
        warehouseToOrganization.set(
          String(warehouse.warehouseId),
          organization.key,
        );
      }
    }

    // 6. Masukkan stok produk ke warehouse terkait.
    for (const product of products) {
      for (const stock of product.stocks ?? []) {
        if (!stock.warehouse) continue;

        const organizationKey = warehouseToOrganization.get(
          String(stock.warehouse.id),
        );

        if (!organizationKey) continue;

        const group = warehouseMap.get(organizationKey);

        if (!group) continue;

        const productCode = product.code?.trim();

        if (!productCode) continue;

        const qty = Number(stock.qtyOnHand ?? 0);
        const qtyStd = Number(stock.qtyOnHandInUOM ?? 0);

        let item = group.items.get(productCode);

        if (!item) {
          item = {
            productErpId: productCode,
            sapProductCode: product.partner_code ?? null,
            stockQuantityInStdUnit: 0,
            stockQuantityInUnit: 0,
            // Hasil agregasi lintas batch dan tanggal.
            batchNo: null,
            dateInventory: stock.dateMaterialPolicy ?? null,
          };

          group.items.set(productCode, item);
        }

        item.stockQuantityInUnit += qty;
        item.stockQuantityInStdUnit += qtyStd;

        const syncedAt = stock.syncedAt
          ? new Date(stock.syncedAt)
          : null;

        if (
          syncedAt &&
          (!group.syncedAt || syncedAt > group.syncedAt)
        ) {
          group.syncedAt = syncedAt;
        }
      }
    }

    // 7. Bentuk response.
    const data = Array.from(warehouseMap.values()).map((group) => ({
      distributorErpId: null,
      warehouseErpId: group.warehouseName,
      warehouseName: group.warehouseName,
      createdAt: group.syncedAt?.toISOString() ?? generatedAt,
      lastUpdatedAt: group.syncedAt?.toISOString() ?? generatedAt,
      items: Array.from(group.items.values()),
    }));

    const returnedItems = data.reduce(
      (total, warehouse) => total + warehouse.items.length,
      0,
    );

    this.logger.log(
      `Snapshot | warehouses: ${data.length}/${totalWarehouses} | returnedItems: ${returnedItems} | totalItems: ${totalItems}`,
    );

    return {
      message: SUCCESS_MESSAGE.FETCH,
      data,
      meta,
    };
  }

  private applyProductAccess<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    allowedCats: string[] | null,
  ): SelectQueryBuilder<T> {
    qb.andWhere('product.group2 NOT IN (:...excludedGroups)', {
      excludedGroups: EXCLUDED_PRODUCT_GROUPS,
    });

    // null = akses seluruh kategori.
    if (allowedCats === null) {
      return qb;
    }

    const categories = allowedCats
      .map((category) => category.trim().toLowerCase())
      .filter(Boolean);

    // Tidak memiliki kategori yang diizinkan = tidak ada akses.
    if (categories.length === 0) {
      qb.andWhere('1 = 0');
      return qb;
    }

    qb.andWhere('LOWER(category.name) IN (:...allowedCats)', {
      allowedCats: categories,
    });

    return qb;
  }

  private getAllowedCategories(scopes: string[]): string[] | null {
    if (scopes.includes('product:read:*')) return null;

    const allowed: string[] = [];
    for (const scope of scopes) {
      const match = scope.match(/^product:read:(.+)$/);
      if (match) allowed.push(match[1].toLowerCase());
    }
    return allowed;
  }
}