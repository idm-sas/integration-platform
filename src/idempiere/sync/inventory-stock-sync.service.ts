import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { InventoryStock } from '../../database/entities/inventory-stock.entity';
import { Product } from '../../database/entities/product.entity';
import { Warehouse } from '../../database/entities/warehouse.entity';

import { IdempiereService } from '../idempiere.service';
import { SyncResult } from '../interfaces/sync-result.interface';
import { BaseSyncService } from './base-sync.service';
import {
  IdempiereStorageOnHandRecord
} from '../interfaces/idempiere-response.interface';

import {
  FULL_SYNC_DATE_FROM,
  FULL_SYNC_DATE_TO,
} from '../../common/constants/warehouse.constant';

interface GroupedStock {
  product: Product;
  warehouse: Warehouse;
  locatorIds: Set<number>;
  qtyOnHand: number;
  qtyOnHandInUOM: number;
  batchNo: string | null;
  dateMaterialPolicy: string | null;
}

@Injectable()
export class InventoryStockSyncService extends BaseSyncService {
  protected readonly logger = new Logger(
    InventoryStockSyncService.name,
  );

  constructor(
    @InjectRepository(InventoryStock)
    private readonly stockRepo: Repository<InventoryStock>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,

    private readonly idempiereService: IdempiereService,
  ) {
    super();
  }

  async syncInventoryStocks(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('InventoryStock', strategy);

    try {
      const records: IdempiereStorageOnHandRecord[] =
      strategy === 'full'
        ? await this.idempiereService.getAllStorageOnHand(
            FULL_SYNC_DATE_FROM,
            FULL_SYNC_DATE_TO,
          )
        : await this.idempiereService.getUpdatedStorageOnHand(since!);

      this.logger.log(
        `Fetched ${records.length} records ` +
          `| from=${FULL_SYNC_DATE_FROM} ` +
          `| to=${FULL_SYNC_DATE_TO}`,
      );

      if (records.length === 0) {
        this.logger.warn(
          'Tidak ada record sumber. Tidak ada perubahan stok lokal.',
        );

        return result;
      }

      const productCache = new Map<number, Product>();
      const warehouseCache = new Map<number, Warehouse>();
      const groups = new Map<string, GroupedStock>();

      // Validasi dan siapkan seluruh grup sebelum menulis ke DB.
      for (const record of records) {
        const productErpId = Number(record.M_Product_ID?.id);
        const locatorErpId = Number(record.M_Locator_ID?.id);

        // Penting: ID warehouse induk, bukan ID locator.
        const warehouseErpId = Number(
          record.M_Locator_ID?.M_Warehouse_ID?.id,
        );

        if (
          !Number.isSafeInteger(productErpId) ||
          productErpId <= 0
        ) {
          throw new Error('Record sumber tidak memiliki product ID valid.');
        }

        if (
          !Number.isSafeInteger(locatorErpId) ||
          locatorErpId <= 0
        ) {
          throw new Error(
            `Locator tidak valid untuk product ERP ${productErpId}`,
          );
        }

        if (
          !Number.isSafeInteger(warehouseErpId) ||
          warehouseErpId <= 0
        ) {
          throw new Error(
            `Locator ${locatorErpId} tidak memiliki ` +
              'M_Warehouse_ID.id pada response API. ' +
              'Perbaiki response/expand locator sebelum sync.',
          );
        }

        let product = productCache.get(productErpId);

        if (!product) {
          const found = await this.productRepo.findOne({
            where: { idempiereId: productErpId },
          });

          if (!found) {
            throw new Error(
              `Product ERP ${productErpId} belum ada di master lokal.`,
            );
          }

          product = found;
          productCache.set(productErpId, found);
        }

        let warehouse = warehouseCache.get(warehouseErpId);

        if (!warehouse) {
          const found = await this.warehouseRepo.findOne({
            where: { idempiereId: warehouseErpId },
          });

          if (!found) {
            throw new Error(
              `Warehouse ERP ${warehouseErpId} dari locator ` +
                `${locatorErpId} belum ada di master lokal.`,
            );
          }

          warehouse = found;
          warehouseCache.set(warehouseErpId, found);
        }

        const qtyOnHand = Number(record.QtyOnHand ?? 0);
        const qtyOnHandInUOM = Number(
          record.QtyOnHandInUOM ?? record.QtyOnHand ?? 0,
        );

        if (
          !Number.isFinite(qtyOnHand) ||
          !Number.isFinite(qtyOnHandInUOM)
        ) {
          throw new Error(
            `Qty tidak valid: product=${productErpId}, ` +
              `locator=${locatorErpId}`,
          );
        }

        const batchNo = record.M_AttributeSetInstance_ID?.id
          ? String(record.M_AttributeSetInstance_ID.id)
          : null;

        const dateMaterialPolicy = record.DateMaterialPolicy
          ? record.DateMaterialPolicy.substring(0, 10)
          : null;

        const key = JSON.stringify([
          warehouse.id,
          product.id,
          dateMaterialPolicy,
        ]);
        const existingGroup = groups.get(key);

        if (existingGroup) {
          existingGroup.qtyOnHand += qtyOnHand;
          existingGroup.qtyOnHandInUOM += qtyOnHandInUOM;
          existingGroup.locatorIds.add(locatorErpId);

          // Beberapa batch pada tanggal sama digabung.
          if (existingGroup.batchNo !== batchNo) {
            existingGroup.batchNo = null;
          }
        } else {
          groups.set(key, {
            product,
            warehouse,
            locatorIds: new Set([locatorErpId]),
            qtyOnHand,
            qtyOnHandInUOM,
            batchNo,
            dateMaterialPolicy,
          });
        }
      }

      result.total = groups.size;

      let created = 0;
      let updated = 0;
      const syncedAt = new Date();

      await this.stockRepo.manager.transaction(async (manager) => {
        const repository = manager.getRepository(InventoryStock);

        for (const group of groups.values()) {
          const matches = await repository.find({
            where: {
              productId: group.product.id,
              warehouseId: group.warehouse.id,
              dateMaterialPolicy:
                group.dateMaterialPolicy === null
                  ? IsNull()
                  : group.dateMaterialPolicy,
            },
            take: 2,
          });

          if (matches.length > 1) {
            throw new Error(
              `Stok lokal duplikat: product=${group.product.code}, ` +
                `warehouse=${group.warehouse.name}, ` +
                `date=${group.dateMaterialPolicy}`,
            );
          }

          const data: Partial<InventoryStock> = {
            productId: group.product.id,
            warehouseId: group.warehouse.id,
            qtyOnHand: group.qtyOnHand,
            qtyOnHandInUOM: group.qtyOnHandInUOM,
            batchNo: group.batchNo,
            dateMaterialPolicy: group.dateMaterialPolicy,
            syncedAt,
          };

          const existing = matches[0];

          if (existing) {
            // Replace total dari sumber; jangan tambahkan ke qty lama.
            await repository.update(existing.id, data);
            updated++;
          } else {
            await repository.save(data);
            created++;
          }
        }
      });

      // Counter hanya diisi setelah transaksi berhasil commit.
      result.created = created;
      result.updated = updated;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);

      result.error = message;

      this.logger.error(
        `Inventory sync gagal: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
    } finally {
      result.durationMs = Date.now() - startTime;
      this.logResult(result);
    }

    return result;
  }
}