import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempiereService } from '../idempiere.service';
import { Warehouse } from '../../database/entities/warehouse.entity';
import { Locator } from '../../database/entities/locator.entity';
import {
  IdempiereWarehouseRecord,
  IdempiereLocatorRecord,
} from '../interfaces/idempiere-response.interface';
import { SyncResult } from '../interfaces/sync-result.interface';
import { BaseSyncService } from './base-sync.service';

@Injectable()
export class WarehouseSyncService extends BaseSyncService {
  protected readonly logger = new Logger(WarehouseSyncService.name);

  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Locator)
    private readonly locatorRepo: Repository<Locator>,
    private readonly idempiereService: IdempiereService,
  ) {
    super();
  }

  // ─── Public: dipanggil dari SyncOrchestratorService ──────────────────────────

  async syncWarehouses(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('Warehouse', strategy);

    try {
      const records: IdempiereWarehouseRecord[] =
        strategy === 'full'
          ? await this.idempiereService.getAllWarehouses()
          : await this.idempiereService.getUpdatedWarehouses(since!);

      result.total = records.length;
      this.logger.log(`Syncing ${records.length} warehouses (${strategy})...`);

      for (const record of records) {
        try {
          const existing = await this.warehouseRepo.findOne({
            where: { idempiereId: record.id },
          });

          const data: Partial<Warehouse> = {
            idempiereId: record.id,
            value: record.Value || '',
            name: record.Name || '',
            description: record.Description || null,
            isActive: this.toBoolean(record.IsActive),
            syncedAt: new Date(),
          };

          if (existing) {
            const hasChange =
              existing.value       !== data.value       ||
              existing.name        !== data.name        ||
              existing.description !== data.description ||
              existing.isActive    !== data.isActive;

            if (hasChange) {
              await this.warehouseRepo.update(existing.id, data);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            await this.warehouseRepo.save(data);
            result.created++;
          }
        } catch (err) {
          this.logger.error(`Failed warehouse id=${record.id}: ${err.message}`);
          result.failed++;
        }
      }
    } catch (err) {
      result.error = err.message;
      this.logger.error('Warehouse sync error', err.message);
    }

    result.durationMs = Date.now() - startTime;
    this.logResult(result);
    return result;
  }

  async syncLocators(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('Locator', strategy);

    try {
      const records: IdempiereLocatorRecord[] =
        strategy === 'full'
          ? await this.idempiereService.getAllLocators()
          : await this.idempiereService.getUpdatedLocators(since!);

      result.total = records.length;
      this.logger.log(`Syncing ${records.length} locators (${strategy})...`);

      for (const record of records) {
        try {
          const warehouseIdempiereId = record.M_Warehouse_ID?.id;
          if (!warehouseIdempiereId) {
            this.logger.warn(`Locator id=${record.id} has no warehouse, skipping`);
            result.skipped++;
            continue;
          }

          // Cari warehouse di MiddleDB
          const warehouse = await this.warehouseRepo.findOne({
            where: { idempiereId: warehouseIdempiereId },
          });

          if (!warehouse) {
            this.logger.warn(
              `Warehouse idempiereId=${warehouseIdempiereId} not in MiddleDB, skipping locator id=${record.id}`,
            );
            result.skipped++;
            continue;
          }

          const existing = await this.locatorRepo.findOne({
            where: { idempiereId: record.id },
          });

          const data: Partial<Locator> = {
            idempiereId: record.id,
            warehouseId: warehouse.id,
            value: record.Value || '',
            aisle: record.X || null,
            bin: record.Y || null,
            level: record.Z || null,
            priorityNo: record.PriorityNo || 0,
            locatorTypeId: record.M_LocatorType_ID?.id,
            isDefault: this.toBoolean(record.IsDefault),
            isActive: this.toBoolean(record.IsActive),
            syncedAt: new Date(),
          };

          if (existing) {
            const hasChange =
              existing.value     !== data.value     ||
              existing.aisle     !== data.aisle     ||
              existing.bin       !== data.bin       ||
              existing.level     !== data.level     ||
              existing.isDefault !== data.isDefault ||
              existing.isActive  !== data.isActive  ||
              existing.priorityNo !== data.priorityNo;

            if (hasChange) {
              await this.locatorRepo.update(existing.id, data);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            await this.locatorRepo.save(data);
            result.created++;
          }
        } catch (err) {
          this.logger.error(`Failed locator id=${record.id}: ${err.message}`);
          result.failed++;
        }
      }
    } catch (err) {
      result.error = err.message;
      this.logger.error('Locator sync error', err.message);
    }

    result.durationMs = Date.now() - startTime;
    this.logResult(result);
    return result;
  }
}
