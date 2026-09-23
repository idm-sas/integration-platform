import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  IdempiereListResponse,
  IdempiereProductRecord,
  IdempiereCategoryRecord,
  IdempierePriceRecord,
  IdempiereSalesmanRecord,
  IdempiereWarehouseRecord,
  IdempiereLocatorRecord,
  IdempiereStorageOnHandRecord,
  IdempiereSecondarySalesRecord,
  IdempiereRetailerRecord,
  IdempiereRetailerRulesRecord,
} from './interfaces/idempiere-response.interface';
import { ALLOWED_LOCATOR_IDS } from 'src/common/constants/warehouse.constant';
import { ALLOWED_ORGTRX_IDS, ALLOWED_DOCTYPE_IDS } from 'src/common/constants/organization.constant';

@Injectable()
export class IdempiereService {
  private readonly logger = new Logger(IdempiereService.name);
  private readonly client: AxiosInstance;
  private readonly defaultParams: Record<string, string>;

  constructor(private readonly configService: ConfigService) {
    const token = this.configService.get<string>('idempiere.token');

    this.client = axios.create({
      baseURL: this.configService.get<string>('idempiere.baseUrl'),
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    this.defaultParams = {
      '$tenant': this.configService.get<string>('idempiere.clientId'),
      '$org': this.configService.get<string>('idempiere.orgId'),
      '$role': this.configService.get<string>('idempiere.roleId'),
      '$warehouse': this.configService.get<string>('idempiere.warehouseId'),
    };

    // Log error dari iDempiere
    this.client.interceptors.response.use(
      (res) => res,
      (err: AxiosError) => {
        // Kalau 401 berarti token expired → perlu update IDEMPIERE_TOKEN di .env
        if (err.response?.status === 401) {
          this.logger.error(
            '❌ iDempiere token expired or invalid — update IDEMPIERE_TOKEN in .env and restart',
          );
        } else {
          this.logger.error(
            `iDempiere error: ${err.response?.status} ${err.config?.url}`,
            err.response?.data,
          );
        }
        throw err;
      },
    );
  }

  // ─── Health Check ─────────────────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      await this.client.get('/api/v1/models/ad_client', {
        params: { ...this.defaultParams, '$pageSize': 1 },
      });
      return true;
    } catch {
      return false;
    }
  }

  // ─── Generic Paginated Fetch ──────────────────────────────────────────────────

 async fetchAllPages<T>(
  endpoint: string,
  extraParams: Record<string, any> = {},
  pageSize = 100,
  ): Promise<T[]> {
    if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
      throw new Error('pageSize harus berupa bilangan bulat positif.');
    }

    const allRecords: T[] = [];
    const MAX_PAGES = 500;

    let skip = 0;
    let expectedTotal: number | undefined;

    const baseParams: Record<string, any> = {
      ...this.defaultParams,
      ...extraParams,
    };

    // Hapus parameter pagination lama agar tidak saling bertentangan.
    delete baseParams['$page'];
    delete baseParams['$pageSize'];
    delete baseParams['$skip'];
    delete baseParams['$top'];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const response =
        await this.client.get<IdempiereListResponse<T>>(endpoint, {
          params: {
            ...baseParams,
            '$skip': skip,
            '$top': pageSize,
          },
        });

      const records = response.data.records;
      const rawRowCount = response.data['row-count'];

      if (!Array.isArray(records)) {
        throw new Error(
          `Response ${endpoint} tidak valid: records bukan array.`,
        );
      }

      if (
        rawRowCount === undefined ||
        rawRowCount === null ||
        String(rawRowCount).trim() === ''
      ) {
        throw new Error(
          `Response ${endpoint} tidak memiliki row-count.`,
        );
      }

      const rowCount = Number(rawRowCount);

      if (!Number.isSafeInteger(rowCount) || rowCount < 0) {
        throw new Error(
          `Response ${endpoint} memiliki row-count tidak valid: ${rawRowCount}`,
        );
      }

      if (expectedTotal === undefined) {
        expectedTotal = rowCount;
      } else if (rowCount !== expectedTotal) {
        // Jangan mengembalikan hasil parsial ketika total berubah.
        throw new Error(
          `Jumlah data ${endpoint} berubah saat pagination: ` +
            `${expectedTotal} menjadi ${rowCount}. Jalankan sync ulang.`,
        );
      }

      allRecords.push(...records);

      if (allRecords.length > expectedTotal) {
        throw new Error(
          `Pagination ${endpoint} melebihi row-count: ` +
            `${allRecords.length}/${expectedTotal}.`,
        );
      }

      if (allRecords.length === expectedTotal) {
        return allRecords;
      }

      if (records.length === 0) {
        throw new Error(
          `Pagination ${endpoint} berhenti sebelum lengkap: ` +
            `${allRecords.length}/${expectedTotal}.`,
        );
      }

      // API bisa membatasi hasil menjadi 100 meskipun diminta 500.
      skip += records.length;
    }

    // Jangan mengembalikan data parsial sebagai hasil sukses.
    throw new Error(
      `Pagination ${endpoint} mencapai MAX_PAGES=${MAX_PAGES}: ` +
        `${allRecords.length}/${expectedTotal ?? '?'}.`,
    );
  }

  async fetchUpdatedSince<T>(
    endpoint: string,
    since: Date,
    extraParams: Record<string, any> = {},
  ): Promise<T[]> {
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    const sinceWIB = new Date(since.getTime() + WIB_OFFSET_MS);
    const sinceStr = sinceWIB.toISOString().replace('T', ' ').substring(0, 19);
    return this.fetchAllPages<T>(endpoint, {
      ...extraParams,
      '$filter': `Updated gt '${sinceStr}'`,
      '$orderby': 'Updated asc',
    });
  }

  // ─── Product Categories ───────────────────────────────────────────────────────

  async getAllCategories(): Promise<IdempiereCategoryRecord[]> {
    return this.fetchAllPages<IdempiereCategoryRecord>(
      '/api/v1/models/m_product_category',
      { '$orderby': 'Value asc' },
    );
  }

  async getUpdatedCategories(since: Date): Promise<IdempiereCategoryRecord[]> {
    return this.fetchUpdatedSince<IdempiereCategoryRecord>(
      '/api/v1/models/m_product_category',
      since,
    );
  }

  // ─── Products ─────────────────────────────────────────────────────────────────

  async getAllProducts(): Promise<IdempiereProductRecord[]> {
    return this.fetchAllPages<IdempiereProductRecord>(
      '/api/v1/models/m_product',
      {
        '$orderby': 'Value asc',
        '$expand': 'M_Product_Category_ID,C_UOM_ID',
      },
    );
  }

  async getUpdatedProducts(since: Date): Promise<IdempiereProductRecord[]> {
    return this.fetchUpdatedSince<IdempiereProductRecord>(
      '/api/v1/models/m_product',
      since,
      { '$expand': 'M_Product_Category_ID,C_UOM_ID' },
    );
  }

  // ─── Product Prices ───────────────────────────────────────────────────────────

  async getAllPrices(): Promise<IdempierePriceRecord[]> {
    return this.fetchAllPages<IdempierePriceRecord>(
      '/api/v1/models/m_productprice',
      {
        '$expand': 'M_Product_ID,M_PriceList_Version_ID',
        '$filter': 'M_PriceList_Version_ID eq 1000005', // SALES-IDR
        '$orderby': 'M_Product_ID asc',
      },
    );
  }

  async getUpdatedPrices(since: Date): Promise<IdempierePriceRecord[]> {
    return this.fetchUpdatedSince<IdempierePriceRecord>(
      '/api/v1/models/m_productprice',
      since,
      { '$expand': 'M_Product_ID,M_PriceList_Version_ID' },
    );
  }

  async getAllSalesmen(): Promise<IdempiereSalesmanRecord[]> {
    return this.fetchAllPages<IdempiereSalesmanRecord>(
      '/api/v1/models/c_bpartner',
      {
        '$filter': "IsSalesRep eq true and IsActive eq true",
        '$expand': 'AD_User',
        '$orderby': 'Value asc',
      },
    );
  }

  async getUpdatedSalesmen(since: Date): Promise<IdempiereSalesmanRecord[]> {
    return this.fetchUpdatedSince<IdempiereSalesmanRecord>(
      '/api/v1/models/c_bpartner',
      since,
      {
        '$filter': "IsSalesRep eq true",
        '$expand': 'AD_User',
      },
    );
  }

  async getAllRetailers(): Promise<IdempiereRetailerRecord[]> {
    return this.fetchAllPages<IdempiereRetailerRecord>(
      '/api/v1/models/c_bpartner',
      {
        '$filter': "IsCustomer eq true and IsActive eq true and IsVendor eq false",
        '$expand': 'C_BPartner_Location',
        '$orderby': 'Value asc',
      },
    );
  }

  async getUpdatedRetailers(since: Date): Promise<IdempiereRetailerRecord[]> {
    return this.fetchUpdatedSince<IdempiereRetailerRecord>(
      '/api/v1/models/c_bpartner',
      since,
      {
        '$filter': "IsCustomer eq true and IsVendor eq false",
        '$expand': 'C_BPartner_Location',
      },
    );
  }

  async getAllRetailerRules(): Promise<IdempiereRetailerRulesRecord[]> {
    return this.fetchAllPages<IdempiereRetailerRulesRecord>(
      '/api/v1/models/sas_bprule',
      {
        '$expand': 'SalesRep_ID',
        '$filter': "IsActive eq true",
        '$orderby': 'C_BPartner_ID asc',
      },
    );
  }

  async getUpdatedRetailerRules(since: Date): Promise<IdempiereRetailerRulesRecord[]> {
    return this.fetchUpdatedSince<IdempiereRetailerRulesRecord>(
      '/api/v1/models/sas_bprule',
      since,
      { '$expand': 'SalesRep_ID' },
    );
  }

  async getAllWarehouses(): Promise<IdempiereWarehouseRecord[]> {
    return this.fetchAllPages<IdempiereWarehouseRecord>(
      '/api/v1/models/m_warehouse',
      {
        '$filter': 'IsActive eq true',
        '$orderby': 'Value asc',
      },
    );
  }

  async getUpdatedWarehouses(since: Date): Promise<IdempiereWarehouseRecord[]> {
    return this.fetchUpdatedSince<IdempiereWarehouseRecord>(
      '/api/v1/models/m_warehouse',
      since,
    );
  }

  // ─── Locators ─────────────────────────────────────────────────────────────────

  async getAllLocators(): Promise<IdempiereLocatorRecord[]> {
    return this.fetchAllPages<IdempiereLocatorRecord>(
      '/api/v1/models/m_locator',
      {
        '$expand': 'M_Warehouse_ID',
        '$filter': 'IsActive eq true',
        '$orderby': 'M_Warehouse_ID asc',
      },
    );
  }

  async getUpdatedLocators(since: Date): Promise<IdempiereLocatorRecord[]> {
    return this.fetchUpdatedSince<IdempiereLocatorRecord>(
      '/api/v1/models/m_locator',
      since,
      { '$expand': 'M_Warehouse_ID' },
    );
  }

  async getAllStorageOnHand(
    dateFrom: string,
    dateTo: string,
  ): Promise<IdempiereStorageOnHandRecord[]> {
    const locatorFilter = ALLOWED_LOCATOR_IDS
      .map((id) => `M_Locator_ID eq ${id}`)
      .join(' or ');

    return this.fetchAllPages<IdempiereStorageOnHandRecord>(
      '/api/v1/models/m_storageonhand',
      {
        '$expand': 'M_Locator_ID',
        '$filter': [
          `(${locatorFilter})`,
          `DateMaterialPolicy ge '${dateFrom}'`,
          `DateMaterialPolicy le '${dateTo}'`,
        ].join(' and '),

        // Urutan stabil ketika mengambil beberapa halaman.
        '$orderby': 'M_Locator_ID asc, M_StorageOnHand_ID asc',
      },
      100,
    );
  }

  async getUpdatedStorageOnHand(
    since: Date,
  ): Promise<IdempiereStorageOnHandRecord[]> {
    if (!(since instanceof Date) || Number.isNaN(since.getTime())) {
      throw new Error('Parameter since wajib berupa Date yang valid.');
    }

    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const sinceWib = new Date(since.getTime() + WIB_OFFSET_MS);

    const dateFrom = sinceWib.toISOString().slice(0, 10);

    const dateToExclusive = new Date(
      sinceWib.getTime() + ONE_DAY_MS,
    )
      .toISOString()
      .slice(0, 10);

    const locatorFilter = ALLOWED_LOCATOR_IDS
      .map((id) => `M_Locator_ID eq ${id}`)
      .join(' or ');

    return this.fetchAllPages<IdempiereStorageOnHandRecord>(
      '/api/v1/models/m_storageonhand',
      {
        '$expand': 'M_Locator_ID',
        '$filter': [
          `(${locatorFilter})`,
          `DateMaterialPolicy ge '${dateFrom}'`,
          `DateMaterialPolicy lt '${dateToExclusive}'`,
        ].join(' and '),
        '$orderby': 'M_Locator_ID asc, M_StorageOnHand_ID asc',
      },
      100,
    );
  }

  async getAllSecondarySales(
    dateFrom: string,
    dateTo: string,
  ): Promise<IdempiereSecondarySalesRecord[]> {
    const orgTrxFilter = ALLOWED_ORGTRX_IDS
      .map((id) => `AD_OrgTrx_ID eq ${id}`)
      .join(' or ');
    const docTypeFilter = ALLOWED_DOCTYPE_IDS
      .map((id) => `C_DocType_ID eq ${id}`)
      .join(' or ');

    return this.fetchAllPages<IdempiereSecondarySalesRecord>(
      '/api/v1/models/c_invoice',
      {
        '$expand': 'C_InvoiceLine($expand=C_OrderLine_ID),C_Order_ID,C_BPartner_ID,SalesRep_ID',
        '$filter': [
          `(${orgTrxFilter})`,
          `(${docTypeFilter})`,
          `DateInvoiced ge '${dateFrom}'`,
          `DateInvoiced le '${dateTo}'`,
        ].join(' and '),
        '$orderby': 'DateInvoiced desc',
      },
      100,
    );
  }

  async getUpdatedSecondarySales(
     since: Date,
  ): Promise<IdempiereSecondarySalesRecord[]> {
    if (!(since instanceof Date) || Number.isNaN(since.getTime())) {
      throw new Error('Parameter since wajib berupa Date yang valid.');
    }

    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const sinceWib = new Date(since.getTime() + WIB_OFFSET_MS);

    const dateFrom = sinceWib.toISOString().slice(0, 10);

    const dateToExclusive = new Date(
      sinceWib.getTime() + ONE_DAY_MS,
    )
      .toISOString()
      .slice(0, 10);

    const orgTrxFilter = ALLOWED_ORGTRX_IDS
      .map((id) => `AD_OrgTrx_ID eq ${id}`)
      .join(' or ');
    
    const docTypeFilter = ALLOWED_DOCTYPE_IDS
      .map((id) => `C_DocType_ID eq ${id}`)
      .join(' or ');

    return this.fetchAllPages<IdempiereSecondarySalesRecord>(
      '/api/v1/models/c_invoice',
      {
        '$expand': 'C_InvoiceLine($expand=C_OrderLine_ID),C_Order_ID,C_BPartner_ID,SalesRep_ID',
        '$filter': [
          `(${orgTrxFilter})`,
          `(${docTypeFilter})`,
          `DateInvoiced ge '${dateFrom}'`,
          `DateInvoiced lt '${dateToExclusive}'`,
        ].join(' and '),
        '$orderby': 'DateInvoiced desc',
      },
      100,
    );
  }
}