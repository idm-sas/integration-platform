import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  IdempiereListResponse,
  IdempiereProductRecord,
  IdempiereCategoryRecord,
  IdempierePriceRecord,
  IdempiereSalesmanRecord,
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
}