import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { IdempiereService } from '../idempiere.service';
import { SyncResult } from '../interfaces/sync-result.interface';
import { BaseSyncService } from './base-sync.service';
import { IdempiereStockAdjustmentRecord } from '../interfaces/idempiere-response.interface';
import { StockAdjustment } from '../../database/entities/stock-adjustment.entity';
import { StockAdjustmentLine } from '../../database/entities/stock-adjustment-line.entity';
import { Product } from '../../database/entities/product.entity';
import { Warehouse } from '../../database/entities/warehouse.entity';
import { Locator } from 'src/database/entities/locator.entity';
import { 
  FULL_SYNC_DATE_FROM, 
  FULL_SYNC_DATE_TO,
  BATCH_IN_SIZE,
  BATCH_SAVE,
} from 'src/common/constants/date-sync.constant';

@Injectable()
export class StockAdjustmentSyncService extends BaseSyncService {
  protected readonly logger = new Logger(StockAdjustmentSyncService.name);

  constructor(
    @InjectRepository(StockAdjustment)
    private readonly adjustmentRepo: Repository<StockAdjustment>,
    @InjectRepository(StockAdjustmentLine)
    private readonly adjustmentLineRepo: Repository<StockAdjustmentLine>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Locator)
    private readonly locatorRepo: Repository<Locator>,
    private readonly idempiereService: IdempiereService,
  ) {
    super();
  }

  // ─── Public Entry Point ───────────────────────────────────────────────────
  async syncStockAdjustments(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();

    // Sesuaikan nama kategori ini dengan tipe pada createResult().
    // Nama lama dipertahankan agar tidak mengasumsikan union type baru.
    const result = this.createResult('StockAdjustment', strategy);

    try {
      let records: IdempiereStockAdjustmentRecord[];

      if (strategy === 'full') {
        records = await this.idempiereService.getAllStockAdjustments(
          FULL_SYNC_DATE_FROM,
          FULL_SYNC_DATE_TO,
        );
      } else {
        if (!(since instanceof Date) || Number.isNaN(since.getTime())) {
          throw new Error('Checkpoint incremental tidak valid.');
        }

        records =
          await this.idempiereService.getUpdatedStockAdjustments(since);
      }

      result.total = records.length;

      if (records.length === 0) {
        return result;
      }

      // Jangan menganggap expand yang tidak tersedia sebagai array kosong.
      for (const raw of records) {
        if (!Array.isArray(raw.M_InventoryLine)) {
          throw new Error(
            `Detail M_InventoryLine belum tersedia: ${raw.DocumentNo}`,
          );
        }
      }

      const productIds = [
        ...new Set(
          records.flatMap((raw) =>
            raw.M_InventoryLine!.map(
              (line) => Number(line.M_Product_ID?.id),
            ),
          ),
        ),
      ].filter((id) => Number.isSafeInteger(id) && id > 0);

      const locatorIds = [
        ...new Set(
          records.flatMap((raw) =>
            raw.M_InventoryLine!.map(
              (line) => Number(line.M_Locator_ID?.id),
            ),
          ),
        ),
      ].filter((id) => Number.isSafeInteger(id) && id > 0);

      const warehouseIds = [
        ...new Set(
          records.map((raw) => Number(raw.M_Warehouse_ID?.id)),
        ),
      ].filter((id) => Number.isSafeInteger(id) && id > 0);

      const [productMap, warehouseMap, locatorMap] = await Promise.all([
        this.batchFindProducts(productIds),
        this.batchFindWarehouses(warehouseIds),
        this.batchFindLocators(locatorIds),
      ]);

      for (const raw of records) {
        try {
          if (!raw.DocumentNo) {
            throw new Error('DocumentNo tidak tersedia.');
          }

          const movementDate = raw.MovementDate?.substring(0, 10);

          if (!movementDate) {
            throw new Error('MovementDate tidak tersedia.');
          }

          const warehouse = warehouseMap.get(
            Number(raw.M_Warehouse_ID?.id),
          );

          if (!warehouse) {
            throw new Error(
              `Warehouse ERP ${raw.M_Warehouse_ID?.id} belum tersedia.`,
            );
          }

          // Validasi semua line sebelum melakukan perubahan database.
          // Tidak ada grouping atau SUM pada proses sync.
          const linePayloads: Partial<StockAdjustmentLine>[] =
            raw.M_InventoryLine!.map((line) => {
              const product = productMap.get(
                Number(line.M_Product_ID?.id),
              );

              const locator = locatorMap.get(
                Number(line.M_Locator_ID?.id),
              );

              if (!product) {
                throw new Error(
                  `Product ERP ${line.M_Product_ID?.id} belum tersedia.`,
                );
              }

              if (!locator) {
                throw new Error(
                  `Locator ERP ${line.M_Locator_ID?.id} belum tersedia.`,
                );
              }

              const qtyEntered = Number(line.QtyEntered ?? 0);
              const qtyBook = Number(line.QtyBook);
              const qtyCount = Number(line.QtyCount);

              if (
                line.QtyBook == null ||
                line.QtyCount == null ||
                !Number.isFinite(qtyEntered) ||
                !Number.isFinite(qtyBook) ||
                !Number.isFinite(qtyCount)
              ) {
                throw new Error(
                  `Quantity tidak valid untuk product ${product.code}.`,
                );
              }

              return {
                productId: product.id,
                locatorErpId: locator.id,

                // Mempertahankan sumber field standar pada kode Anda.
                stockQuantityInStdUnit: qtyEntered,

                // Old = saldo buku sebelum penyesuaian.
                // New = hasil hitung setelah penyesuaian.
                stockQuantityInUnitOld: qtyBook,
                stockQuantityInUnitNew: qtyCount,
              };
            });

          const headerData: Partial<StockAdjustment> = {
            organization: raw.AD_Org_ID?.identifier ?? '',
            sellerErpId: raw.AD_OrgTrx_ID?.identifier ?? '',
            movementDate,
            documentNo: raw.DocumentNo,
            warehouseErpId: warehouse.id,
            status: raw.DocStatus?.identifier ?? '',
            totalValue: Number(raw.GrandTotal ?? 0),
            remark: raw.Description ?? null,
            c_doctype_id: raw.C_DocType_ID?.id ?? 0,
          };

          if (!Number.isFinite(headerData.totalValue)) {
            throw new Error('TotalValue tidak valid.');
          }

          const wasCreated =
            await this.adjustmentRepo.manager.transaction(
              async (manager) => {
                const headerRepo =
                  manager.getRepository(StockAdjustment);

                const lineRepo =
                  manager.getRepository(StockAdjustmentLine);

                const existing = await headerRepo.findOne({
                  where: { documentNo: raw.DocumentNo },
                });

                let headerId: string;

                if (existing) {
                  await headerRepo.update(existing.id, headerData);
                  headerId = existing.id;
                } else {
                  const saved = await headerRepo.save(
                    headerRepo.create(headerData),
                  );

                  headerId = saved.id;
                }

                // Hapus hanya lines milik dokumen yang sedang disinkronkan.
                // Jika insert berikutnya gagal, transaksi akan rollback.
                await lineRepo.delete({
                  stockAdjustmentId: headerId,
                });

                for (
                  let i = 0;
                  i < linePayloads.length;
                  i += BATCH_SAVE
                ) {
                  const chunk = linePayloads
                    .slice(i, i + BATCH_SAVE)
                    .map((line) =>
                      lineRepo.create({
                        ...line,
                        stockAdjustmentId: headerId,
                      }),
                    );

                  await lineRepo.save(chunk);
                }

                return existing === null;
              },
            );

          // Counter hanya ditambah setelah transaksi berhasil.
          if (wasCreated) {
            result.created++;
          } else {
            result.updated++;
          }
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : String(err);

          result.failed++;

          this.logger.error(
            `Gagal sync adjustment ${raw.DocumentNo}: ${message}`,
            err instanceof Error ? err.stack : undefined,
          );
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);

      result.error = message;

      this.logger.error(
        `Stock adjustment sync gagal: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      result.durationMs = Date.now() - startTime;
      this.logResult(result);
    }

    return result;
  }

  // ─── Batch Load Helpers ───────────────────────────────────────────────────

  private async batchFindProducts(ids: number[]): Promise<Map<number, Product>> {
    const map = new Map<number, Product>();
    for (let i = 0; i < ids.length; i += BATCH_IN_SIZE) {
      const rows = await this.productRepo.find({
        where: { idempiereId: In(ids.slice(i, i + BATCH_IN_SIZE)) },
      });
      rows.forEach((p) => map.set(p.idempiereId, p));
    }
    return map;
  }

  private async batchFindWarehouses(ids: number[]): Promise<Map<number, Warehouse>> {
    const map = new Map<number, Warehouse>();
    for (let i = 0; i < ids.length; i += BATCH_IN_SIZE) {
      const rows = await this.warehouseRepo.find({
        where: { idempiereId: In(ids.slice(i, i + BATCH_IN_SIZE)) },
      });
      rows.forEach((w) => map.set(w.idempiereId, w));
    }
    return map;
  }

  private async batchFindLocators(ids: number[]): Promise<Map<number, Locator>> {
    const map = new Map<number, Locator>();
    for (let i = 0; i < ids.length; i += BATCH_IN_SIZE) {
      const rows = await this.locatorRepo.find({
        where: { idempiereId: In(ids.slice(i, i + BATCH_IN_SIZE)) },
      });
      rows.forEach((l) => map.set(l.idempiereId, l));
    }
    return map;
  }
}