import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { IdempiereService } from '../idempiere.service';
import { Product } from '../../database/entities/product.entity';
import { ProductCategory } from '../../database/entities/product-category.entity';
import { ProductPrice } from '../../database/entities/product-price.entity';
import {
  IdempiereProductRecord,
  IdempiereCategoryRecord,
  IdempierePriceRecord,
} from '../interfaces/idempiere-response.interface';
import { SyncResult, SyncStatus } from '../interfaces/sync-result.interface';

@Injectable()
export class ProductSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProductSyncService.name);

  private syncStatus: SyncStatus = {
    lastFullSync: null,
    lastIncrementalSync: null,
    lastSyncResult: null,
    isRunning: false,
  };

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
    @InjectRepository(ProductPrice)
    private readonly priceRepo: Repository<ProductPrice>,
    private readonly idempiereService: IdempiereService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  // ─── Bootstrap ───────────────────────────────────────────────────────────────

  async onApplicationBootstrap() {
    const hasData = await this.hasExistingData();

    if (!hasData) {
      this.logger.log('🚀 No existing data — running initial FULL sync...');
      setTimeout(() => {
        this.runFullSync().catch((err) =>
          this.logger.error('Initial full sync failed', err),
        );
      }, 3000);
    } else {
      this.logger.log('✅ Existing data found — incremental sync will handle updates');
      this.syncStatus.lastFullSync = await this.getLastSyncedAt();
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async hasExistingData(): Promise<boolean> {
    const count = await this.categoryRepo.count();
    return count > 0;
  }

  private async getLastSyncedAt(): Promise<Date> {
    const latest = await this.productRepo
      .createQueryBuilder('p')
      .select('MAX(p.syncedAt)', 'lastSync')
      .getRawOne();

    return latest?.lastSync
      ? new Date(latest.lastSync)
      : new Date(Date.now() - 60 * 60 * 1000);
  }

  private toBoolean(value: any): boolean {
    return value === 'true' || value === true;
  }

  getStatus(): SyncStatus {
    return this.syncStatus;
  }

  // ─── Scheduled: Incremental tiap 30 menit ────────────────────────────────────

  @Cron('0 */30 * * * *', { name: 'incremental-sync' })
  async scheduledIncrementalSync() {
    if (!this.syncStatus.lastFullSync) {
      this.logger.warn('Incremental skipped — waiting for full sync first');
      return;
    }

    if (this.syncStatus.isRunning) {
      this.logger.warn('Incremental skipped — another sync is running');
      return;
    }

    this.logger.log('⏰ Scheduled INCREMENTAL sync triggered');
    await this.runIncrementalSync();
  }

  // ─── Full Sync ────────────────────────────────────────────────────────────────

  async runFullSync(): Promise<SyncResult[]> {
    if (this.syncStatus.isRunning) {
      this.logger.warn('Full sync skipped — another sync is running');
      return [];
    }

    this.syncStatus.isRunning = true;
    this.logger.log('🔄 Starting FULL sync...');
    const results: SyncResult[] = [];

    try {
      // Urutan wajib: category → product → price
      results.push(await this.syncCategories('full'));
      results.push(await this.syncProducts('full'));
      results.push(await this.syncPrices('full'));

      this.syncStatus.lastFullSync = new Date();

      const totalCreated = results.reduce((s, r) => s + r.created, 0);
      const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
      const totalFailed  = results.reduce((s, r) => s + r.failed, 0);

      this.logger.log(
        `✅ Full sync complete | +${totalCreated} created | ~${totalUpdated} updated | ✗${totalFailed} failed`,
      );
    } catch (err) {
      this.logger.error('Full sync failed', err);
    } finally {
      this.syncStatus.isRunning = false;
      this.syncStatus.lastSyncResult = results[results.length - 1] ?? null;
    }

    return results;
  }

  // ─── Incremental Sync ─────────────────────────────────────────────────────────

  async runIncrementalSync(): Promise<SyncResult[]> {
    if (this.syncStatus.isRunning) {
      this.logger.warn('Incremental sync skipped — another sync is running');
      return [];
    }

    const since =
      this.syncStatus.lastIncrementalSync ??
      this.syncStatus.lastFullSync ??
      new Date(Date.now() - 60 * 60 * 1000);

    this.syncStatus.isRunning = true;
    this.logger.log(`🔄 Starting INCREMENTAL sync since ${since.toISOString()}...`);
    const results: SyncResult[] = [];

    try {
      results.push(await this.syncCategories('incremental', since));
      results.push(await this.syncProducts('incremental', since));
      results.push(await this.syncPrices('incremental', since));

      this.syncStatus.lastIncrementalSync = new Date();

      const totalCreated = results.reduce((s, r) => s + r.created, 0);
      const totalUpdated = results.reduce((s, r) => s + r.updated, 0);

      this.logger.log(
        `✅ Incremental sync complete | +${totalCreated} created | ~${totalUpdated} updated`,
      );
    } catch (err) {
      this.logger.error('Incremental sync failed', err);
    } finally {
      this.syncStatus.isRunning = false;
      this.syncStatus.lastSyncResult = results[results.length - 1] ?? null;
    }

    return results;
  }

  // ─── Sync Categories ──────────────────────────────────────────────────────────

  private async syncCategories(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      entity: 'ProductCategory', strategy,
      total: 0, created: 0, updated: 0, skipped: 0, failed: 0,
      durationMs: 0, syncedAt: new Date(),
    };

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
    this.logger.log(
      `Categories | +${result.created} | ~${result.updated} | =${result.skipped} | ✗${result.failed} | ${result.durationMs}ms`,
    );
    return result;
  }

  // ─── Sync Products ────────────────────────────────────────────────────────────

  private async syncProducts(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      entity: 'Product', strategy,
      total: 0, created: 0, updated: 0, skipped: 0, failed: 0,
      durationMs: 0, syncedAt: new Date(),
    };

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

          // this.logger.log()

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
    this.logger.log(
      `Products | +${result.created} | ~${result.updated} | =${result.skipped} | ✗${result.failed} | ${result.durationMs}ms`,
    );
    return result;
  }

  // ─── Sync Prices ──────────────────────────────────────────────────────────────

  private async syncPrices(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      entity: 'ProductPrice', strategy,
      total: 0, created: 0, updated: 0, skipped: 0, failed: 0,
      durationMs: 0, syncedAt: new Date(),
    };

    try {
      const records: IdempierePriceRecord[] =
        strategy === 'full'
          ? await this.idempiereService.getAllPrices()
          : await this.idempiereService.getUpdatedPrices(since!);

      result.total = records.length;
      this.logger.log(`Syncing ${records.length} prices (${strategy})...`);

      for (const record of records) {
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
    } catch (err) {
      result.error = err.message;
      this.logger.error('Price sync error', err.message);
    }

    result.durationMs = Date.now() - startTime;
    this.logger.log(
      `Prices | +${result.created} | ~${result.updated} | =${result.skipped} | ✗${result.failed} | ${result.durationMs}ms`,
    );
    return result;
  }
}
