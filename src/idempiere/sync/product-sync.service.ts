import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempiereService } from '../idempiere.service';
import { Product } from '../../database/entities/product.entity';
import { ProductCategory } from '../../database/entities/product-category.entity';
import { ProductPrice } from '../../database/entities/product-price.entity';
import {
  IdempiereProductRecord,
  IdempiereCategoryRecord,
  IdempierePriceRecord,
} from '../interfaces/idempiere-response.interface';
import { SyncResult } from '../interfaces/sync-result.interface';
import { BaseSyncService } from './base-sync.service';

@Injectable()
export class ProductSyncService extends BaseSyncService {
  protected readonly logger = new Logger(ProductSyncService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
    @InjectRepository(ProductPrice)
    private readonly priceRepo: Repository<ProductPrice>,
    private readonly idempiereService: IdempiereService,
  ) {
    super();
  }

  // ─── Public: dipanggil dari SyncOrchestratorService ──────────────────────────

  async syncCategories(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('ProductCategory', strategy);

    try {
      const records: IdempiereCategoryRecord[] =
        strategy === 'full'
          ? await this.idempiereService.getAllCategories()
          : await this.idempiereService.getUpdatedCategories(since!);

      result.total = records.length;
      this.logger.log(`Syncing ${records.length} categories (${strategy})...`);

      for (const record of records) {
        try {
          const existing = await this.categoryRepo.findOne({
            where: { idempiereId: record.id },
          });

          const data: Partial<ProductCategory> = {
            idempiereId: record.id,
            code: record.Value || '',
            name: record.Name || '',
            description: record.Description || null,
            isActive: this.toBoolean(record.IsActive),
            syncedAt: new Date(),
          };

          if (existing) {
            const hasChange =
              existing.name     !== data.name     ||
              existing.code     !== data.code     ||
              existing.isActive !== data.isActive;

            if (hasChange) {
              await this.categoryRepo.update(existing.id, data);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            await this.categoryRepo.save(data);
            result.created++;
          }
        } catch (err) {
          this.logger.error(`Failed category id=${record.id}: ${err.message}`);
          result.failed++;
        }
      }
    } catch (err) {
      result.error = err.message;
      this.logger.error('Category sync error', err.message);
    }

    result.durationMs = Date.now() - startTime;
    this.logResult(result);
    return result;
  }

  async syncProducts(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('Product', strategy);

    try {
      const records: IdempiereProductRecord[] =
        strategy === 'full'
          ? await this.idempiereService.getAllProducts()
          : await this.idempiereService.getUpdatedProducts(since!);

      result.total = records.length;
      this.logger.log(`Syncing ${records.length} products (${strategy})...`);

      for (const record of records) {
        try {
          const categoryIdempiereId = record.M_Product_Category_ID?.id;
          if (!categoryIdempiereId) {
            this.logger.warn(`Product id=${record.id} has no category, skipping`);
            result.skipped++;
            continue;
          }

          const category = await this.categoryRepo.findOne({
            where: { idempiereId: categoryIdempiereId },
          });

          if (!category) {
            this.logger.warn(
              `Category idempiereId=${categoryIdempiereId} not in MiddleDB, skipping product id=${record.id}`,
            );
            result.skipped++;
            continue;
          }

          const existing = await this.productRepo.findOne({
            where: { idempiereId: record.id },
          });

          const data: Partial<Product> = {
            idempiereId: record.id,
            code: record.Value || '',
            name: record.Name || '',
            description: record.Description || null,
            uom: record.C_UOM_ID?.Name || null,
            uomId: record.C_UOM_ID?.id || null,
            isActive: this.toBoolean(record.IsActive),
            group2: record.Group2?.identifier || null,
            categoryId: category.id,
            syncedAt: new Date(),
          };

          if (existing) {
            const hasChange =
              existing.name       !== data.name       ||
              existing.code       !== data.code       ||
              existing.isActive   !== data.isActive   ||
              existing.categoryId !== data.categoryId;

            if (hasChange) {
              await this.productRepo.update(existing.id, data);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            await this.productRepo.save(data);
            result.created++;
          }
        } catch (err) {
          this.logger.error(`Failed product id=${record.id}: ${err.message}`);
          result.failed++;
        }
      }
    } catch (err) {
      result.error = err.message;
      this.logger.error('Product sync error', err.message);
    }

    result.durationMs = Date.now() - startTime;
    this.logResult(result);
    return result;
  }

  async syncPrices(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('ProductPrice', strategy);

    try {
      const records: IdempierePriceRecord[] =
        strategy === 'full'
          ? await this.idempiereService.getAllPrices()
          : await this.idempiereService.getUpdatedPrices(since!);

      result.total = records.length;
      this.logger.log(`Syncing ${records.length} prices (${strategy})...`);

      const batchSize = 500;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        this.logger.log(
          `Processing price batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}...`,
        );

        for (const record of batch) {
          try {
            const productIdempiereId = record.M_Product_ID?.id;
            if (!productIdempiereId) { result.skipped++; continue; }

            const product = await this.productRepo.findOne({
              where: { idempiereId: productIdempiereId },
            });
            if (!product) { result.skipped++; continue; }

            const existing = await this.priceRepo.findOne({
              where: { idempiereId: record.id },
            });

            const data: Partial<ProductPrice> = {
              idempiereId: record.id,
              productId: product.id,
              priceListId: record.M_PriceList_Version_ID?.id,
              priceListName: record.M_PriceList_Version_ID?.Name || '',
              listPrice: Number(record.PriceList || 0),
              standardPrice: Number(record.PriceStd || 0),
              limitPrice: Number(record.PriceLimit || 0),
              currency: 'IDR',
              isActive: this.toBoolean(record.IsActive),
              syncedAt: new Date(),
            };

            if (existing) {
              const hasChange =
                Number(existing.listPrice)     !== data.listPrice     ||
                Number(existing.standardPrice) !== data.standardPrice ||
                Number(existing.limitPrice)    !== data.limitPrice    ||
                existing.isActive              !== data.isActive;

              if (hasChange) {
                await this.priceRepo.update(existing.id, data);
                result.updated++;
              } else {
                result.skipped++;
              }
            } else {
              await this.priceRepo.save(data);
              result.created++;
            }
          } catch (err) {
            this.logger.error(`Failed price id=${record.id}: ${err.message}`);
            result.failed++;
          }
        }
      }
    } catch (err) {
      result.error = err.message;
      this.logger.error('Price sync error', err.message);
    }

    result.durationMs = Date.now() - startTime;
    this.logResult(result);
    return result;
  }

  // ─── Helper untuk Orchestrator ────────────────────────────────────────────────

  async hasExistingData(): Promise<boolean> {
    const count = await this.categoryRepo.count();
    return count > 0;
  }

  async getLastSyncedAt(): Promise<Date> {
    const latest = await this.productRepo
      .createQueryBuilder('p')
      .select('MAX(p.syncedAt)', 'lastSync')
      .getRawOne();

    return latest?.lastSync
      ? new Date(latest.lastSync)
      : new Date(Date.now() - 60 * 60 * 1000);
  }
}
