import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ProductSyncService } from './product-sync.service';
import { SalesmanSyncService } from './salesman-sync.service';
import { SyncResult, SyncStatus } from '../interfaces/sync-result.interface';

@Injectable()
export class SyncOrchestratorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncOrchestratorService.name);

  private syncStatus: SyncStatus = {
    lastFullSync: null,
    lastIncrementalSync: null,
    lastSyncResult: null,
    isRunning: false,
  };

  constructor(
    private readonly productSyncService: ProductSyncService,
    private readonly salesmanSyncService: SalesmanSyncService,
  ) {}

  // ─── Bootstrap ───────────────────────────────────────────────────────────────

  async onApplicationBootstrap() {
    const hasData = await this.productSyncService.hasExistingData();

    if (!hasData) {
      this.logger.log('🚀 No existing data — running initial FULL sync...');
      setTimeout(() => {
        this.runFullSync().catch((err) =>
          this.logger.error('Initial full sync failed', err),
        );
      }, 3000);
    } else {
      this.logger.log('✅ Existing data found — incremental sync will handle updates');
      this.syncStatus.lastFullSync = await this.productSyncService.getLastSyncedAt();
    }
  }

  // ─── Status ──────────────────────────────────────────────────────────────────

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
      // Urutan: category → salesman → product → price
      // results.push(await this.productSyncService.syncCategories('full'));
      results.push(await this.salesmanSyncService.syncSalesmen('full'));
      // results.push(await this.productSyncService.syncProducts('full'));
      // results.push(await this.productSyncService.syncPrices('full'));

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
      results.push(await this.productSyncService.syncCategories('incremental', since));
      results.push(await this.salesmanSyncService.syncSalesmen('incremental', since));
      results.push(await this.productSyncService.syncProducts('incremental', since));
      results.push(await this.productSyncService.syncPrices('incremental', since));

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
}
