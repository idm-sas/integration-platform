
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { IdempiereService } from '../idempiere.service';
import { SyncResult } from '../interfaces/sync-result.interface';
import { BaseSyncService } from './base-sync.service';

import { IdempiereSecondarySalesRecord } from '../interfaces/idempiere-response.interface';

import { InvoiceHeader } from '../../database/entities/invoice-header.entity';
import { InvoiceLine } from '../../database/entities/invoice-line.entity';
import { Product } from '../../database/entities/product.entity';
import { Retailer } from '../../database/entities/retailers.entity';
import { Salesman } from '../../database/entities/salesman.entity';
import { Warehouse } from '../../database/entities/warehouse.entity';

import {
  getDivisor,
  getTaxRate,
  round2,
} from 'src/common/constants/calculation.constant';

import {
  FULL_SYNC_DATE_FROM,
  FULL_SYNC_DATE_TO,
  BATCH_IN_SIZE,
  BATCH_SAVE,
} from 'src/common/constants/date-sync.constant';

@Injectable()
export class SecondarySalesSyncService extends BaseSyncService {
  protected readonly logger = new Logger(SecondarySalesSyncService.name);

  constructor(
    @InjectRepository(InvoiceHeader)
    private readonly headerRepo: Repository<InvoiceHeader>,

    @InjectRepository(InvoiceLine)
    private readonly lineRepo: Repository<InvoiceLine>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Retailer)
    private readonly retailerRepo: Repository<Retailer>,

    @InjectRepository(Salesman)
    private readonly salesmanRepo: Repository<Salesman>,

    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,

    private readonly idempiereService: IdempiereService,
  ) {
    super();
  }

  // ============================================================
  // PUBLIC ENTRY POINT
  // ============================================================

  async syncSecondarySales(
    strategy: 'full' | 'incremental',
    since?: Date,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result = this.createResult('SecondarySales', strategy);

    try {
      // STEP 1: FETCH DATA

      const fetchedRecords: IdempiereSecondarySalesRecord[] =
        strategy === 'full'
          ? await this.idempiereService.getAllSecondarySales(
              FULL_SYNC_DATE_FROM,
              FULL_SYNC_DATE_TO,
            )
          : await this.idempiereService.getUpdatedSecondarySales(since!);

      // DocumentNo adalah identitas unik invoice.
      const recordMap = new Map<string, IdempiereSecondarySalesRecord>();

      for (const record of fetchedRecords) {
        const invoiceNo = record.DocumentNo?.trim();

        if (!invoiceNo) {
          result.failed++;

          this.logger.warn(
            `Invoice diabaikan: DocumentNo kosong | C_Invoice_ID=${record.C_Invoice_ID}`,
          );

          continue;
        }

        if (recordMap.has(invoiceNo)) {
          result.failed++;

          this.logger.error(
            `Duplicate DocumentNo dari API: ${invoiceNo}`,
          );

          continue;
        }

        recordMap.set(invoiceNo, record);
      }

      const records = [...recordMap.values()];

      result.total = fetchedRecords.length;

      this.logger.log(
        `Fetched=${fetchedRecords.length} | ` +
        `Unique=${records.length} | Strategy=${strategy}`,
      );

      if (records.length === 0) {
        result.durationMs = Date.now() - startTime;
        this.logResult(result);
        return result;
      }

      // STEP 2: COLLECT LOOKUP IDS

      const allProductIdempiereIds = [
        ...new Set(
          records
            .flatMap((inv) => inv.C_InvoiceLine ?? [])
            .filter(
              (line) =>
                !line.IsDescription && line.M_Product_ID?.id != null,
            )
            .map((line) => Number(line.M_Product_ID!.id)),
        ),
      ];

      const allRetailerLocationIds = [
        ...new Set(
          records
            .map((inv) => inv.C_BPartner_Location_ID?.id)
            .filter((id): id is number => id != null)
            .map(Number),
        ),
      ];

      const allSalesmanIdempiereIds = [
        ...new Set(
          records
            .map((inv) => inv.SalesRep_ID?.C_BPartner_ID?.id)
            .filter((id): id is number => id != null)
            .map(Number),
        ),
      ];

      const allWarehouseIdempiereIds = [
        ...new Set(
          records
            .map((inv) => inv.C_Order_ID?.M_Warehouse_ID?.id)
            .filter((id): id is number => id != null)
            .map(Number),
        ),
      ];

      this.logger.log(
        `Lookup IDs — products=${allProductIdempiereIds.length} | ` +
        `retailers=${allRetailerLocationIds.length} | ` +
        `salesmen=${allSalesmanIdempiereIds.length} | ` +
        `warehouses=${allWarehouseIdempiereIds.length}`,
      );

      // STEP 3: LOAD LOOKUPS

      const [productMap, retailerMap, salesmanMap, warehouseMap] =
        await Promise.all([
          this.batchFindProducts(allProductIdempiereIds),
          this.batchFindRetailers(allRetailerLocationIds),
          this.batchFindSalesmen(allSalesmanIdempiereIds),
          this.batchFindWarehouses(allWarehouseIdempiereIds),
        ]);

      this.logger.log(
        `Lookup loaded — products=${productMap.size} | ` +
        `retailers=${retailerMap.size} | ` +
        `salesmen=${salesmanMap.size} | ` +
        `warehouses=${warehouseMap.size}`,
      );

      // STEP 4: LOAD EXISTING HEADERS

      const invoiceNos = records.map((inv) => inv.DocumentNo);

      const existingHeaders = await this.loadExistingHeaders(invoiceNos);

      const existingHeaderMap = new Map(
        existingHeaders.map((header) => [header.invoiceNo, header]),
      );

      this.logger.log(
        `Existing headers=${existingHeaders.length}`,
      );

      // STEP 5: PREPARE HEADERS

      const toInsertHeaders: Partial<InvoiceHeader>[] = [];

      const toUpdateHeaders: {
        id: string;
        invoiceNo: string;
        data: Partial<InvoiceHeader>;
      }[] = [];

      const validInvoiceNos = new Set<string>();

      for (const raw of records) {
        try {
          const invoiceNo = raw.DocumentNo;

          const lines = (raw.C_InvoiceLine ?? []).filter(
            (line) =>
              !line.IsDescription && line.M_Product_ID?.id != null,
          );

          const invoiceDate = raw.DateInvoiced?.substring(0, 10) ?? '';

          const divisor = getDivisor(invoiceDate);
          const taxRate = getTaxRate(invoiceDate);

          // CALCULATE TOTALS

          const totalGrossValue = round2(
            lines.reduce(
              (sum, line) =>
                sum +
                round2(
                  Number(line.PriceList || 0) *
                  Number(line.QtyInvoiced || 0),
                ),
              0,
            ),
          );

          const totalDiscount = round2(
            lines.reduce(
              (sum, line) =>
                sum +
                (
                  round2(
                    Number(line.PriceList || 0) *
                    Number(line.QtyInvoiced || 0),
                  ) -
                  round2(Number(line.LineNetAmt || 0))
                ),
              0,
            ),
          );

          const totalCashDiscountValue = 0;

          const totalNetValue = round2(
            lines.reduce(
              (sum, line) =>
                sum + round2(Number(line.LineNetAmt || 0)),
              0,
            ),
          );

          let taxValue: number;

          if (raw.IsTaxIncluded) {
            const dpp = totalGrossValue / divisor;
            taxValue = round2(totalGrossValue - dpp);
          } else {
            taxValue = round2(
              (totalNetValue * taxRate) / 100,
            );
          }

          // Pertahankan formula existing.
          const totalValue = round2(totalNetValue);

          const taxPercent = taxRate;

          // RESOLVE MAPPINGS

          const retailerLocationId = raw.C_BPartner_Location_ID?.id != null
            ? Number(raw.C_BPartner_Location_ID.id)
            : null;

          const salesmanEId = raw.SalesRep_ID?.C_BPartner_ID?.id != null
            ? Number(raw.SalesRep_ID.C_BPartner_ID.id)
            : null;

          const warehouseEId = raw.C_Order_ID?.M_Warehouse_ID?.id != null
            ? Number(raw.C_Order_ID.M_Warehouse_ID.id)
            : null;

          const retailer = retailerLocationId != null
            ? retailerMap.get(retailerLocationId)
            : undefined;

          const salesman = salesmanEId != null
            ? salesmanMap.get(salesmanEId)
            : undefined;

          const warehouse = warehouseEId != null
            ? warehouseMap.get(warehouseEId)
            : undefined;

          // VALIDATE MAPPINGS

          const missingMappings: string[] = [];

          if (!retailer) {
            missingMappings.push(
              `Retailer locationId=${retailerLocationId ?? 'NULL'}`,
            );
          }

          if (!salesman) {
            missingMappings.push(
              `Salesman idempiereId=${salesmanEId ?? 'NULL'}`,
            );
          }

          if (!warehouse) {
            missingMappings.push(
              `Warehouse idempiereId=${warehouseEId ?? 'NULL'}`,
            );
          }

          if (missingMappings.length > 0) {
            result.failed++;

            this.logger.warn(
              `Invoice mapping failed: ${invoiceNo} | ` +
              missingMappings.join(' | '),
            );

            continue;
          }

          // BUILD HEADER DATA

          const headerData: Partial<InvoiceHeader> = {
            organization: raw.AD_Org_ID?.identifier ?? '',
            sellerErpId: raw.AD_OrgTrx_ID?.identifier ?? '',
            orderNo: raw.C_Order_ID?.DocumentNo ?? null,
            invoiceDate,
            invoiceNo,
            warehouseErpId: warehouse!.id,
            totalGrossValue,
            status: raw.DocStatus?.identifier ?? '',
            totalDiscount,
            totalCashDiscountValue,
            totalNetValue,
            taxPercent,
            taxValue,
            totalValue,
            remark: raw.Description ?? null,
            retailerErpId: retailer!.id,
            esmId: salesman!.id,
            issotrx: this.toBoolean(raw.IsSOTrx),
            c_doctype_id: raw.C_DocType_ID?.id ?? 0,
          };

          const existing = existingHeaderMap.get(invoiceNo);

          if (existing) {
            if (this.hasChanges(existing, headerData)) {
              toUpdateHeaders.push({
                id: existing.id,
                invoiceNo,
                data: headerData,
              });
            } else {
              result.skipped++;
            }
          } else {
            toInsertHeaders.push(headerData);
          }

          // Header valid, boleh diproses untuk sync detail.
          validInvoiceNos.add(invoiceNo);

        } catch (err) {
          result.failed++;

          this.logger.error(
            `Failed processing invoice ${raw.DocumentNo}: ${err.message}`,
            err.stack,
          );
        }
      }

      // STEP 6: INSERT HEADERS

      const savedHeaders: InvoiceHeader[] = [];

      for (let i = 0; i < toInsertHeaders.length; i += BATCH_SAVE) {
        const chunk = toInsertHeaders.slice(i, i + BATCH_SAVE);

        const saved = await this.headerRepo.save(chunk);

        savedHeaders.push(...saved);

        this.logger.log(
          `Inserted headers ${saved.length}/${chunk.length}`,
        );
      }

      result.created = savedHeaders.length;

      // STEP 7: UPDATE HEADERS

      for (let i = 0; i < toUpdateHeaders.length; i += BATCH_SAVE) {
        const chunk = toUpdateHeaders.slice(i, i + BATCH_SAVE);

        await Promise.all(
          chunk.map(({ id, data }) =>
            this.headerRepo.update(id, data),
          ),
        );

        this.logger.log(
          `Updated headers ${chunk.length}`,
        );
      }

      result.updated = toUpdateHeaders.length;

      // STEP 8: BUILD HEADER UUID MAP

      const headerIdMap = new Map<string, string>();

      for (const header of existingHeaders) {
        if (validInvoiceNos.has(header.invoiceNo)) {
          headerIdMap.set(header.invoiceNo, header.id);
        }
      }

      for (const header of savedHeaders) {
        headerIdMap.set(header.invoiceNo, header.id);
      }

      for (const item of toUpdateHeaders) {
        headerIdMap.set(item.invoiceNo, item.id);
      }

      this.logger.log(
        `Valid header UUID map=${headerIdMap.size}`,
      );

      // STEP 9: SYNC LINES

      await this.syncLines(
        records.filter((record) =>
          validInvoiceNos.has(record.DocumentNo),
        ),
        headerIdMap,
        productMap,
      );

    } catch (err) {
      result.error = err.message;

      this.logger.error(
        'Secondary sales sync error',
        err.stack,
      );
    }

    result.durationMs = Date.now() - startTime;

    this.logResult(result);

    return result;
  }

  // ============================================================
  // LOAD EXISTING HEADERS
  // ============================================================

  private async loadExistingHeaders(
    invoiceNos: string[],
  ): Promise<InvoiceHeader[]> {
    const result: InvoiceHeader[] = [];

    for (let i = 0; i < invoiceNos.length; i += BATCH_IN_SIZE) {
      const chunk = invoiceNos.slice(i, i + BATCH_IN_SIZE);

      const rows = await this.headerRepo.find({
        where: {
          invoiceNo: In(chunk),
        },
      });

      result.push(...rows);
    }

    return result;
  }

  // ============================================================
  // SYNC INVOICE LINES
  // ============================================================

  private async syncLines(
    records: IdempiereSecondarySalesRecord[],
    headerIdMap: Map<string, string>,
    productMap: Map<number, Product>,
  ): Promise<void> {
    const allRawLines = records.flatMap((invoice) =>
      (invoice.C_InvoiceLine ?? [])
        .filter(
          (line) =>
            !line.IsDescription && line.M_Product_ID?.id != null,
        )
        .map((line) => ({
          ...line,
          _invoiceNo: invoice.DocumentNo,
        })),
    );

    if (allRawLines.length === 0) {
      this.logger.log('No invoice lines to sync');
      return;
    }

    this.logger.log(
      `Syncing ${allRawLines.length} invoice lines`,
    );

    // LOAD EXISTING LINES

    const headerUuids = [
      ...new Set([...headerIdMap.values()]),
    ];

    const existingLines: InvoiceLine[] = [];

    for (let i = 0; i < headerUuids.length; i += BATCH_IN_SIZE) {
      const chunk = headerUuids.slice(i, i + BATCH_IN_SIZE);

      const rows = await this.lineRepo
        .createQueryBuilder('line')
        .where('line.invoiceHeaderId IN (:...ids)', {
          ids: chunk,
        })
        .getMany();

      existingLines.push(...rows);
    }

    const existingLineMap = new Map<string, InvoiceLine[]>();

    for (const line of existingLines) {
      const key = `${line.invoiceHeaderId}::${line.productId}`;

      const bucket = existingLineMap.get(key) ?? [];

      bucket.push(line);

      existingLineMap.set(key, bucket);
    }

    const occurrenceMap = new Map<string, number>();

    const toInsertLines: Partial<InvoiceLine>[] = [];

    const toUpdateLines: {
      id: string;
      data: Partial<InvoiceLine>;
    }[] = [];

    let missingProductCount = 0;
    let missingHeaderCount = 0;

    // PROCESS LINES

    for (const line of allRawLines) {
      const headerUuid = headerIdMap.get(line._invoiceNo);

      if (!headerUuid) {
        missingHeaderCount++;

        this.logger.warn(
          `Header not found for line: ${line._invoiceNo}`,
        );

        continue;
      }

      const productEId = Number(line.M_Product_ID!.id);

      const product = productMap.get(productEId);

      if (!product) {
        missingProductCount++;

        this.logger.error(
          `Product mapping missing | ` +
          `invoice=${line._invoiceNo} | productId=${productEId}`,
        );

        continue;
      }

      const qtyInvoiced = Number(line.QtyInvoiced || 0);
      const priceList = Number(line.PriceList || 0);
      const priceActual = Number(line.PriceActual || 0);
      const lineNetAmt = Number(line.LineNetAmt || 0);

      const grossValue = round2(
        priceList * qtyInvoiced,
      );

      const netValue = round2(lineNetAmt);

      const freeQty = priceActual === 0
        ? qtyInvoiced
        : 0;

      const discount1Percent = Number(
        line.C_OrderLine_ID?.Discount ?? 0,
      );

      const lineData: Partial<InvoiceLine> = {
        invoiceHeaderId: headerUuid,
        productId: product.id,

        grossValue,
        netValue,
        price: priceActual,

        discount1Code:
          line.SAS_DiscountList_ID?.identifier ??
          line.C_OrderLine_ID?.SAS_DiscountList_ID?.identifier ??
          null,

        discount1Percent,
        freeQty,
        invoicedQuantity: qtyInvoiced,

        uom: line.C_UOM_ID?.identifier ?? '',
        description: line.Description ?? null,
      };

      // MATCH HEADER + PRODUCT + OCCURRENCE

      const existingKey = `${headerUuid}::${product.id}`;

      const occurrence = occurrenceMap.get(existingKey) ?? 0;

      occurrenceMap.set(existingKey, occurrence + 1);

      const existingBucket =
        existingLineMap.get(existingKey) ?? [];

      const existing = existingBucket[occurrence];

      if (existing) {
        if (this.hasChanges(existing, lineData)) {
          toUpdateLines.push({
            id: existing.id,
            data: lineData,
          });
        }
      } else {
        toInsertLines.push(lineData);
      }
    }

    // INSERT LINES

    let insertedCount = 0;

    for (let i = 0; i < toInsertLines.length; i += BATCH_SAVE) {
      const chunk = toInsertLines.slice(i, i + BATCH_SAVE);

      const saved = await this.lineRepo.save(chunk);

      insertedCount += saved.length;

      this.logger.log(
        `Inserted lines ${saved.length}/${chunk.length}`,
      );
    }

    // UPDATE LINES

    for (let i = 0; i < toUpdateLines.length; i += BATCH_SAVE) {
      const chunk = toUpdateLines.slice(i, i + BATCH_SAVE);

      await Promise.all(
        chunk.map(({ id, data }) =>
          this.lineRepo.update(id, data),
        ),
      );
    }

    this.logger.log(
      `Lines summary — existing=${existingLines.length} | ` +
      `inserted=${insertedCount} | ` +
      `updated=${toUpdateLines.length} | ` +
      `missingProducts=${missingProductCount} | ` +
      `missingHeaders=${missingHeaderCount}`,
    );
  }

  // ============================================================
  // CHANGE DETECTION
  // ============================================================

  private hasChanges<T extends object>(
    current: T,
    incoming: Partial<T>,
  ): boolean {
    for (const key of Object.keys(incoming) as (keyof T)[]) {
      const oldValue = current[key];
      const newValue = incoming[key];

      if (
        this.normalizeValue(oldValue) !==
        this.normalizeValue(newValue)
      ) {
        return true;
      }
    }

    return false;
  }

  private normalizeValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return String(value.getTime());
    }

    if (typeof value === 'number') {
      return String(Number.isFinite(value) ? value : 0);
    }

    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      Number.isFinite(Number(value))
    ) {
      return String(Number(value));
    }

    return String(value);
  }

  // ============================================================
  // BATCH LOOKUP HELPERS
  // ============================================================

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

      rows.forEach((product) => {
        map.set(product.idempiereId, product);
      });
    }

    return map;
  }

  private async batchFindRetailers(
    ids: number[],
  ): Promise<Map<number, Retailer>> {
    const map = new Map<number, Retailer>();

    for (let i = 0; i < ids.length; i += BATCH_IN_SIZE) {
      const rows = await this.retailerRepo.find({
        where: {
          locationIdempiereId: In(
            ids.slice(i, i + BATCH_IN_SIZE),
          ),
        },
      });

      rows.forEach((retailer) => {
        map.set(retailer.locationIdempiereId, retailer);
      });
    }

    return map;
  }

  private async batchFindSalesmen(
    ids: number[],
  ): Promise<Map<number, Salesman>> {
    const map = new Map<number, Salesman>();

    for (let i = 0; i < ids.length; i += BATCH_IN_SIZE) {
      const rows = await this.salesmanRepo.find({
        where: {
          idempiereId: In(ids.slice(i, i + BATCH_IN_SIZE)),
        },
      });

      rows.forEach((salesman) => {
        map.set(salesman.idempiereId, salesman);
      });
    }

    return map;
  }

  private async batchFindWarehouses(
    ids: number[],
  ): Promise<Map<number, Warehouse>> {
    const map = new Map<number, Warehouse>();

    for (let i = 0; i < ids.length; i += BATCH_IN_SIZE) {
      const rows = await this.warehouseRepo.find({
        where: {
          idempiereId: In(ids.slice(i, i + BATCH_IN_SIZE)),
        },
      });

      rows.forEach((warehouse) => {
        map.set(warehouse.idempiereId, warehouse);
      });
    }

    return map;
  }
}
