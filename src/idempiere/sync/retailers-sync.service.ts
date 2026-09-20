import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempiereService } from '../idempiere.service';
import { Retailer } from '../../database/entities/retailers.entity';
import { RetailerRules } from '../../database/entities/retailer-rules.entity';
import { IdempiereRetailerRecord, IdempiereRetailerRulesRecord } from '../interfaces/idempiere-response.interface';
import { SyncResult } from '../interfaces/sync-result.interface';
import { BaseSyncService } from './base-sync.service';
import { ProductCategory } from 'src/database/entities/product-category.entity';
import { Salesman } from 'src/database/entities/salesman.entity';

@Injectable()
export class RetailersSyncService extends BaseSyncService {
  protected readonly logger = new Logger(RetailersSyncService.name);

  constructor(
    @InjectRepository(Retailer)
    private readonly retailerRepo: Repository<Retailer>,
    @InjectRepository(RetailerRules)
    private readonly retailerRuleRepo: Repository<RetailerRules>,
    @InjectRepository(Salesman)
    private readonly salesmanRepo: Repository<Salesman>,
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
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
            arcode: cBPLocation?.ExternalReference || null,
            isCustomer: this.toBoolean(record.IsCustomer),
            isActive: this.toBoolean(record.IsActive),
            createdAt: new Date(record.Created) || new Date(),
            updatedAt: new Date(record.Updated) || new Date(),
            syncedAt: new Date(),
            isSyncToIntegration: this.toBoolean(record.IsSyncToIntegration),
            isShipTo: this.toBoolean(cBPLocation?.IsShipTo),
            isBillTo: this.toBoolean(cBPLocation?.IsBillTo),
            isMainArcode: this.toBoolean(cBPLocation?.IsMainArcode),
          };

          if (existing) {
            const hasChange =
              existing.value                !== data.value                ||
              existing.name                 !== data.name                 ||
              existing.name2                !== data.name2                ||
              existing.bpGroup              !== data.bpGroup              ||
              existing.location             !== data.location             ||
              existing.address              !== data.address              ||
              existing.marketname           !== data.marketname           ||
              existing.city                 !== data.city                 ||
              existing.subcity              !== data.subcity              ||
              existing.country              !== data.country              ||
              existing.postal               !== data.postal               ||
              existing.arcode               !== data.arcode               ||
              existing.isCustomer           !== data.isCustomer           ||
              existing.isActive             !== data.isActive             ||
              existing.isSyncToIntegration  !== data.isSyncToIntegration  ||
              existing.isShipTo             !== data.isShipTo             ||
              existing.isBillTo             !== data.isBillTo             ||
              existing.isMainArcode         !== data.isMainArcode;

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

  async syncRetailerRules(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('RetailerRules', strategy);

    try {
      const records: IdempiereRetailerRulesRecord[] =
        strategy === 'full'
          ? await this.idempiereService.getAllRetailerRules()
          : await this.idempiereService.getUpdatedRetailerRules(since!);

      result.total = records.length;
      this.logger.log(`Syncing ${records.length} retailer rules (${strategy})...`);

      for (const record of records) {
        try {
          this.logger.debug(
            `Processing RetailerRule iDempiereId=${record.id}`,
          );

          const retailerIdempiereId = record.C_BPartner_ID?.id;
          const salesmanIdempiereId = record.SalesRep_ID?.C_BPartner_ID?.id;
          const categoryIdempiereId = record.M_Product_Category_ID?.id;

          this.logger.debug(
            `IDs: retailer=${retailerIdempiereId}, salesman=${salesmanIdempiereId}, category=${categoryIdempiereId}`,
          );

          if (!retailerIdempiereId) {
            this.logger.warn(`Skip ${record.id}: retailer ID kosong`);
            result.skipped++;
            continue;
          }

          if (!salesmanIdempiereId) {
            this.logger.warn(`Skip ${record.id}: salesman ID kosong`);
            result.skipped++;
            continue;
          }

          if (!categoryIdempiereId) {
            this.logger.warn(`Skip ${record.id}: category ID kosong`);
            result.skipped++;
            continue;
          }

          const retailer = await this.retailerRepo.findOne({
            where: {
              idempiereId: retailerIdempiereId,
            },
          });

          if (!retailer) {
            this.logger.warn(
              `Skip ${record.id}: retailer idempiereId=${retailerIdempiereId} tidak ditemukan`,
            );
            result.skipped++;
            continue;
          }

          const salesman = await this.salesmanRepo.findOne({
            where: {
              idempiereId: salesmanIdempiereId,
            },
          });

          if (!salesman) {
            this.logger.warn(
              `Skip ${record.id}: salesman idempiereId=${salesmanIdempiereId} tidak ditemukan`,
            );
            result.skipped++;
            continue;
          }

          const category = await this.categoryRepo.findOne({
            where: {
              idempiereId: categoryIdempiereId,
            },
          });

          if (!category) {
            this.logger.warn(
              `Skip ${record.id}: category idempiereId=${categoryIdempiereId} tidak ditemukan`,
            );
            result.skipped++;
            continue;
          }

          const existing = await this.retailerRuleRepo.findOne({
            where: {
              idempiereId: record.id,
            },
          });

          const data: Partial<RetailerRules> = {
            idempiereId: record.id,
            orgTrx: record.AD_OrgTrx_ID?.identifier || '',
            retailerId: retailer.id,
            salesmanId: salesman.id,
            creditLimit: record.SO_CreditLimit || 0,
            categoryId: category.id,
            paymentTerm: record.C_PaymentTerm_ID?.identifier || '',
            isActive: this.toBoolean(record.IsActive),
            createdAt: record.Created
              ? new Date(record.Created)
              : new Date(),
            updatedAt: record.Updated
              ? new Date(record.Updated)
              : new Date(),
            syncedAt: new Date(),
          };

          this.logger.debug(
            `Saving RetailerRule ${record.id}: ${JSON.stringify(data)}`,
          );

          if (existing) {
            const updatedAt = data.updatedAt!;

            if (existing.updatedAt < updatedAt) {
              await this.retailerRuleRepo.update(existing.id, data);
              result.updated++;
            } else {
              result.skipped++;
            }
          } else {
            await this.retailerRuleRepo.save(data);
            result.created++;
          }
        } catch (err) {
          this.logger.error(`Failed retailer rule id=${record.id}: ${err.message}`);
          result.failed++;
        }
      }
    } catch (err) {
      result.error = err.message;
      this.logger.error('RetailerRules sync error', err.message);
    }

    result.durationMs = Date.now() - startTime;
    this.logResult(result);
    return result;
  }
}
