import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempiereService } from '../idempiere.service';
import { Retailer } from '../../database/entities/retailers.entity';
import { IdempiereRetailerRecord } from '../interfaces/idempiere-response.interface';
import { SyncResult } from '../interfaces/sync-result.interface';
import { BaseSyncService } from './base-sync.service';

@Injectable()
export class RetailersSyncService extends BaseSyncService {
  protected readonly logger = new Logger(RetailersSyncService.name);

  constructor(
    @InjectRepository(Retailer)
    private readonly retailerRepo: Repository<Retailer>,
    private readonly idempiereService: IdempiereService,
  ) {
    super();
  }

  // ─── Public: dipanggil dari SyncOrchestratorService ──────────────────────────

  async syncRetailers(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('Retailer', strategy);

    try {
      const records: IdempiereRetailerRecord[] =
        strategy === 'full'
          ? await this.idempiereService.getAllRetailers()
          : await this.idempiereService.getUpdatedRetailers(since!);

      result.total = records.length;
       this.logger.log(`Fetched ${records.length} retailers from iDempiere`);
    if (records.length > 0) {
      this.logger.debug(`Sample record: ${JSON.stringify(records[0])}`);
    } else {
      this.logger.warn('No retailers returned from iDempiere — check filter');
    }
      this.logger.log(`Syncing ${records.length} retailers (${strategy})...`);

      for (const record of records) {
        try {
          const existing = await this.retailerRepo.findOne({
            where: { idempiereId: record.id },
          });

          const cBPLocation = record.C_BPartner_Location?.[0];

          const data: Partial<Retailer> = {
            idempiereId: record.id,
            value: record.Value || '',
            name: record.Name || '',
            name2: record.Name2 || null,
            bpGroup: record.C_BP_Group_ID?.identifier || null,
            location: cBPLocation?.Name || null,
            address: cBPLocation?.C_Location_ID?.Address2 || null,
            marketname: cBPLocation?.C_Location_ID?.Address3 || null,
            city: cBPLocation?.C_Location_ID?.City || null,
            subcity: cBPLocation?.C_Location_ID?.Address4 || null,
            country: cBPLocation?.C_Location_ID?.C_Country_ID?.identifier || null,
            postal: cBPLocation?.C_Location_ID?.Postal || null,
            arcode: cBPLocation?.Arcode || null,
            isCustomer: this.toBoolean(record.IsCustomer),
            isActive: this.toBoolean(record.IsActive),
            syncedAt: new Date(),
          };

          if (existing) {
            const hasChange =
              existing.value             !== data.value             ||
              existing.name              !== data.name              ||
              existing.bpGroup           !== data.bpGroup           ||
              existing.isActive          !== data.isActive;

            if (hasChange) {
              await this.retailerRepo.update(existing.id, data);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            await this.retailerRepo.save(data);
            result.created++;
          }
        } catch (err) {
          this.logger.error(`Failed retailer id=${record.id}: ${err.message}`);
          result.failed++;
        }
      }
    } catch (err) {
      result.error = err.message;
      this.logger.error('Retailer sync error', err.message);
    }

    result.durationMs = Date.now() - startTime;
    this.logResult(result);
    return result;
  }
}
