import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { IdempiereService } from '../idempiere.service';
import { SyncResult } from '../interfaces/sync-result.interface';
import { IdempiereStockTransferRecord } from '../interfaces/idempiere-response.interface';
import { BaseSyncService } from './base-sync.service';

import { StockTransfer } from '../../database/entities/stock-transfer.entity';
import { StockTransferLine } from '../../database/entities/stock-transfer-line.entity';
import { Product } from '../../database/entities/product.entity';
import { Locator } from '../../database/entities/locator.entity';

import {
  FULL_SYNC_DATE_FROM,
  FULL_SYNC_DATE_TO,
  BATCH_IN_SIZE,
  BATCH_SAVE,
} from 'src/common/constants/date-sync.constant';

@Injectable()
export class StockTransferSyncService extends BaseSyncService {
  protected readonly logger = new Logger(StockTransferSyncService.name);

  constructor(
    @InjectRepository(StockTransfer)
    private readonly transferRepo: Repository<StockTransfer>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Locator)
    private readonly locatorRepo: Repository<Locator>,

    private readonly idempiereService: IdempiereService,
  ) {
    super();
  }

  async syncStockTransfers(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();

    // Tambahkan 'StockTransfer' pada union kategori sync jika diperlukan.
    const result = this.createResult('StockTransfer', strategy);

    try {
      this.validateBatchSize(BATCH_IN_SIZE, 'BATCH_IN_SIZE');
      this.validateBatchSize(BATCH_SAVE, 'BATCH_SAVE');

      let records: IdempiereStockTransferRecord[];

      if (strategy === 'full') {
        records = await this.idempiereService.getAllStockTransfers(
          FULL_SYNC_DATE_FROM,
          FULL_SYNC_DATE_TO,
        );
      } else {
        if (!(since instanceof Date) || Number.isNaN(since.getTime())) {
          throw new Error('Checkpoint incremental tidak valid.');
        }

        records =
          await this.idempiereService.getUpdatedStockTransfers(since);
      }

      result.total = records.length;

      if (records.length === 0) {
        return result;
      }

      const productIds = new Set<number>();
      const locatorIds = new Set<number>();

      for (const raw of records) {
        // Dokumen tanpa expand akan dicatat gagal pada loop penyimpanan.
        if (!Array.isArray(raw.M_MovementLine)) {
          continue;
        }

        for (const line of raw.M_MovementLine) {
          this.collectId(productIds, line.M_Product_ID?.id);
          this.collectId(locatorIds, line.M_Locator_ID?.id);
          this.collectId(locatorIds, line.M_LocatorTo_ID?.id);
        }
      }

      const [productMap, locatorMap] = await Promise.all([
        this.batchFindProducts([...productIds]),
        this.batchFindLocators([...locatorIds]),
      ]);

      for (const raw of records) {
        try {
          const documentNo = this.requiredText(
            raw.DocumentNo,
            'DocumentNo',
            60,
          );

          // Jangan mengganti expand yang hilang dengan []:
          // hal tersebut bisa menghapus detail lokal tanpa sengaja.
          if (!Array.isArray(raw.M_MovementLine)) {
            throw new Error(
              `Detail M_MovementLine belum tersedia: ${documentNo}.`,
            );
          }

          const movementDate = this.parseMovementDate(raw.MovementDate);

          const organization = this.requiredText(
            raw.AD_Org_ID?.identifier,
            'AD_Org_ID.identifier',
            60,
          );

          const sellerErpId = this.requiredText(
            raw.AD_OrgTrx_ID?.identifier,
            'AD_OrgTrx_ID.identifier',
            60,
          );

          const status = this.requiredText(
            raw.DocStatus?.identifier,
            'DocStatus.id',
            10,
          );

          const documentTypeId = this.requiredId(
            raw.C_DocType_ID?.id,
            'C_DocType_ID',
          );

          // Entity menggunakan string untuk kolom numeric.
          const totalValue = this.decimalText(
            raw.GrandTotal ?? 0,
            'GrandTotal',
          );

          // Validasi semua detail sebelum mengubah database.
          // Tidak ada grouping atau penjumlahan quantity.
          const linePayloads: Partial<StockTransferLine>[] =
            raw.M_MovementLine.map((line) => {
              const productErpId = this.requiredId(
                line.M_Product_ID?.id,
                `M_Product_ID pada line ${line.id}`,
              );

              const locatorErpId = this.requiredId(
                line.M_Locator_ID?.id,
                `M_Locator_ID pada line ${line.id}`,
              );

              const locatorToErpId = this.requiredId(
                line.M_LocatorTo_ID?.id,
                `M_LocatorTo_ID pada line ${line.id}`,
              );

              const product = productMap.get(productErpId);
              const locator = locatorMap.get(locatorErpId);
              const locatorTo = locatorMap.get(locatorToErpId);

              if (!product) {
                throw new Error(
                  `Product ERP ${productErpId} belum tersedia.`,
                );
              }

              if (!locator) {
                throw new Error(
                  `Locator asal ERP ${locatorErpId} belum tersedia.`,
                );
              }

              if (!locatorTo) {
                throw new Error(
                  `Locator tujuan ERP ${locatorToErpId} belum tersedia.`,
                );
              }

              const actualReceiveStockQty = this.decimalText(
                line.MovementQty,
                `MovementQty pada line ${line.id}`,
              );

              return {
                productId: product.id,
                locatorErpId: locator.id,
                locatorToErpId: locatorTo.id,
                ActualReceiveStockQty: actualReceiveStockQty,
              };
            });

          const headerData: Partial<StockTransfer> = {
            organization,
            sellerErpId,
            movementDate,
            documentNo,
            totalValue,
            remark: raw.Description ?? null,
            c_doctype_id: documentTypeId,
            status,
          };

          const wasCreated = await this.transferRepo.manager.transaction(
            async (manager) => {
              const headerRepo = manager.getRepository(StockTransfer);
              const lineRepo = manager.getRepository(StockTransferLine);

              const existing = await headerRepo.findOne({
                where: { documentNo },
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

              // Ganti hanya detail milik dokumen ini.
              // Kegagalan penyimpanan akan me-rollback header dan detail.
              await lineRepo.delete({
                stockTransferId: headerId,
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
                      stockTransferId: headerId,
                    }),
                  );

                await lineRepo.save(chunk);
              }

              return existing === null;
            },
          );

          // Hitung sukses hanya setelah transaksi commit.
          if (wasCreated) {
            result.created++;
          } else {
            result.updated++;
          }
        } catch (err: unknown) {
          const message = this.errorMessage(err);

          result.failed++;

          this.logger.error(
            `Gagal sync stock transfer ${raw.DocumentNo}: ${message}`,
            err instanceof Error ? err.stack : undefined,
          );
        }
      }

      if (result.failed > 0) {
        result.error =
          `${result.failed} dari ${result.total} dokumen stock transfer ` +
          'gagal disinkronkan. Periksa log untuk detail.';
      }
    } catch (err: unknown) {
      const message = this.errorMessage(err);

      result.error = message;

      this.logger.error(
        `Stock transfer sync gagal: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      result.durationMs = Date.now() - startTime;
      this.logResult(result);
    }

    return result;
  }

  private async batchFindProducts(
    ids: number[],
  ): Promise<Map<number, Product>> {
    const map = new Map<number, Product>();

    for (let i = 0; i < ids.length; i += BATCH_IN_SIZE) {
      const rows = await this.productRepo.find({
        where: {
          idempiereId: In(ids.slice(i, i + BATCH_IN_SIZE)),
        },
      });

      for (const product of rows) {
        map.set(Number(product.idempiereId), product);
      }
    }

    return map;
  }

  private async batchFindLocators(
    ids: number[],
  ): Promise<Map<number, Locator>> {
    const map = new Map<number, Locator>();

    for (let i = 0; i < ids.length; i += BATCH_IN_SIZE) {
      const rows = await this.locatorRepo.find({
        where: {
          idempiereId: In(ids.slice(i, i + BATCH_IN_SIZE)),
        },
      });

      for (const locator of rows) {
        map.set(Number(locator.idempiereId), locator);
      }
    }

    return map;
  }

  private collectId(target: Set<number>, value: unknown): void {
    const id = Number(value);

    if (Number.isSafeInteger(id) && id > 0) {
      target.add(id);
    }
  }

  private requiredId(value: unknown, field: string): number {
    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error(`${field} tidak valid.`);
    }

    return id;
  }

  private requiredText(
    value: unknown,
    field: string,
    maxLength: number,
  ): string {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`${field} tidak tersedia atau bukan string.`);
    }

    const text = value.trim();

    if (text.length > maxLength) {
      throw new Error(`${field} melebihi ${maxLength} karakter.`);
    }

    return text;
  }

  private decimalText(value: unknown, field: string): string {
    if (
      (typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'number' && !Number.isFinite(value))
    ) {
      throw new Error(`${field} tidak tersedia atau tidak valid.`);
    }

    const text = String(value).trim();

    // Mendukung angka desimal dan notasi ilmiah.
    // String dipertahankan tanpa konversi ke Number.
    if (
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)
    ) {
      throw new Error(`${field} bukan angka desimal yang valid.`);
    }

    return text;
  }

  private parseMovementDate(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error('MovementDate tidak tersedia.');
    }

    const date = value.substring(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`MovementDate tidak valid: ${value}.`);
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().substring(0, 10) !== date
    ) {
      throw new Error(`MovementDate tidak valid: ${value}.`);
    }

    return date;
  }

  private validateBatchSize(value: number, name: string): void {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`${name} harus berupa integer lebih dari 0.`);
    }
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}