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
  SecondarySalesInvoiceRecord,
} from './interfaces/idempiere-response.interface';

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
    const allRecords: T[] = [];

    let skip = 0;
    let totalRecords = 0;

    while (true) {
      const response = await this.client.get<IdempiereListResponse<T>>(endpoint, {
        params: {
          ...this.defaultParams,
          ...extraParams,
          '$skip': skip,
          '$pageSize': pageSize,
        },
      });

      const {
        records,
        'row-count': rowCount,
        'skip-records': skipRecords,
      } = response.data;

      totalRecords = rowCount;

      allRecords.push(...records);

      this.logger.log(
        `Skip=${skipRecords} | Fetched=${records.length} | Total=${allRecords.length}/${totalRecords}`,
      );

      if (allRecords.length >= totalRecords) {
        break;
      }

      skip += pageSize;
    }

    return allRecords;
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

  async getAllRetailers(): Promise<IdempiereSalesmanRecord[]> {
    return this.fetchAllPages<IdempiereSalesmanRecord>(
      '/api/v1/models/c_bpartner',
      {
        '$filter': "IsCustomer eq true and IsActive eq true",
        '$expand': 'C_BPartner_Location',
        '$orderby': 'Value asc',
      },
    );
  }

  async getUpdatedRetailers(since: Date): Promise<IdempiereSalesmanRecord[]> {
    return this.fetchUpdatedSince<IdempiereSalesmanRecord>(
      '/api/v1/models/c_bpartner',
      since,
      {
        '$filter': "IsCustomer eq true",
        '$expand': 'C_BPartner_Location',
      },
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

  async getAllStorageOnHand(): Promise<IdempiereStorageOnHandRecord[]> {
    return this.fetchAllPages<IdempiereStorageOnHandRecord>(
      '/api/v1/models/m_storageonhand',
      {
        '$expand': 'M_Locator_ID',
        '$orderby': 'M_Locator_ID asc',
        '$filter': '(M_Product_ID eq 2200736 OR M_Product_ID eq 2200748 OR M_Product_ID eq 2200177)',
      },
    );
  }

  async getSecondarySalesInvoices(filter: {
  dateFrom?: string;
  dateTo?: string;
  salesman?: number;
  invoiceNo?: string;
}): Promise<any[]> {

  return this.fetchAllPages<any>(
    '/api/v1/models/c_invoice',
    {
      $expand: 'c_invoiceline',
      $filter: this.buildInvoiceFilter(filter),
      $orderby: 'DateInvoiced desc',
    },
  );

}

private readonly allowedOrgTrxIds = [
  1000006,
  1000008,
  2200020,
  1000010,
  2200021,
  2200022,
  2200037,
  2200038,
  2200034,
  2200035,
  2200036,
  2200033,
];

private buildInvoiceFilter(filter: {
  dateFrom?: string;
  dateTo?: string;
  salesman?: number;
  invoiceNo?: string;
}): string {

  const conditions: string[] = [
    "DocStatus eq 'CO'",
    "(C_BPartner_ID eq 2200296 or C_BPartner_ID eq 2204935)",
    "(DocumentNo eq 'ATR1-FKN-2510-2536' or DocumentNo eq 'CTR1-FKN-1902-0375')",
  ];

  const orgFilter = this.allowedOrgTrxIds
    .map(id => `AD_OrgTrx_ID eq ${id}`)
    .join(' or ');

  conditions.push(`(${orgFilter})`);


  if (filter.dateFrom) {
    conditions.push(`DateInvoiced ge '${filter.dateFrom}'`);
  }

  if (filter.dateTo) {
    conditions.push(`DateInvoiced le '${filter.dateTo}'`);
  }

  if (filter.invoiceNo) {
    conditions.push(`DocumentNo eq '${filter.invoiceNo}'`);
  }

  if (filter.salesman) {
    conditions.push(`SalesRep_ID eq ${filter.salesman}`);
  }

  return conditions.join(' and ');
}
}