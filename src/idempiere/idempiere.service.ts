import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
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
  IdempiereStockAdjustmentRecord,
  IdempiereStockTransferRecord,
  IdempierePrimaryInvoicesRecord,
  IdempiereChangedBPLocationRecord,
} from './interfaces/idempiere-response.interface';
import { 
  ALLOWED_LOCATOR_IDS, 
  ALLOWED_WAREHOUSE_IDS, 
  TRANSFER_LOCATOR_IDS 
} from 'src/common/constants/warehouse.constant';
import { FULL_SYNC_DATE_FROM } from 'src/common/constants/date-sync.constant';
import { ALLOWED_ORGTRX_IDS } from 'src/common/constants/organization.constant';
import { 
  PRIMARY_DOCTYPE_IDS,
  SECONDARY_DOCTYPE_IDS, 
  ADJUSTMENT_DOCTYPE_IDS,
  TRANSFER_DOCTYPE_IDS
} from 'src/common/constants/doctype.constant';
import { ALLOWED_BPARTNER_IDS } from 'src/common/constants/primary-invoices.constant';
/**
 * Pagination bounded by the largest matching ID at the start of each fetch.
 * Live reads, NOT a point-in-time database snapshot. Returned order is ID ASC.
 * Caller must upsert by source identity and advance checkpoints only on success.
 * Capture checkpoint at sync START (not finish) to replay concurrent updates.
 * Deletions / records leaving filters require separate reconciliation.
 */
const CURSOR_COLUMNS: Readonly<Record<string, string>> = {
  // '/api/v1/models/m_storageonhand': 'M_StorageOnHand_ID',
  '/api/v1/models/c_invoice': 'C_Invoice_ID',
  '/api/v1/models/m_product_category': 'M_Product_Category_ID',
  '/api/v1/models/m_product': 'M_Product_ID',
  '/api/v1/models/c_bpartner': 'C_BPartner_ID',
  '/api/v1/models/c_bpartner_location': 'C_BPartner_Location_ID',
  '/api/v1/models/sas_bprule': 'SAS_BPRule_ID',
  '/api/v1/models/m_warehouse': 'M_Warehouse_ID',
  '/api/v1/models/m_locator': 'M_Locator_ID',
  '/api/v1/models/m_inventory': 'M_Inventory_ID',
  '/api/v1/models/m_movement': 'M_Movement_ID',
};

@Injectable()
export class IdempiereService {
  private readonly logger = new Logger(IdempiereService.name);
  private readonly client: AxiosInstance;
  private readonly defaultParams: Record<string, string | undefined>;
  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService
        .get<string>('idempiere.baseUrl')
        ?.trim();
    const token = this.configService
      .get<string>('idempiere.token')
      ?.trim();
    if (!baseURL || !token) {
      throw new Error(
        'Konfigurasi idempiere.baseUrl dan idempiere.token wajib diisi.',
      );
    }
    this.client = axios.create({
      baseURL,
      timeout: 120_000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
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
            `iDempiere error: ` +
              `${err.response?.status ?? err.code ?? 'UNKNOWN'} ` +
              `${err.config?.url} | ${err.message}`,
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
        params: { ...this.defaultParams, '$top': 1 },
      });
      return true;
    } catch {
      return false;
    }
  }

  private async getWithRetry<T>(
    endpoint: string,
    params: Record<string, any>,
  ): Promise<AxiosResponse<T>> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const startedAt = Date.now();
        const requestConfig = {
          url: endpoint,
          method: 'GET' as const,
          params,
        };
        const requestUrl = this.client.getUri(requestConfig);
        // Tidak mencetak header Authorization.
        this.logger.log(
          `iDempiere GET | attempt=${attempt}/${maxAttempts} | ` +
            `timeout=${this.client.defaults.timeout}ms | ` +
            `url=${requestUrl}`,
        );
        const response = await this.client.get<T>(endpoint, {
          params,
        });
        this.logger.log(
          `iDempiere GET selesai | endpoint=${endpoint} | ` +
            `status=${response.status} | ` +
            `durationMs=${Date.now() - startedAt}`,
        );
        return response;
      } catch (error: unknown) {
        if (!axios.isAxiosError(error)) {
          throw error;
        }
        const status = error.response?.status;
        const retryableStatus =
          status !== undefined &&
          [429, 502, 503, 504].includes(status);
        const retryableNetworkError =
          !error.response &&
          ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN']
            .includes(error.code ?? '');
        if (
          (!retryableStatus && !retryableNetworkError) ||
          attempt === maxAttempts
        ) {
          throw error;
        }
        // Default: tunggu 60 detik, lalu 120 detik.
        let waitMs = 60_000 * attempt;
        // Hormati Retry-After berupa detik atau HTTP date.
        const retryAfter = error.response?.headers?.['retry-after'];
        if (retryAfter !== undefined && retryAfter !== null) {
          const value = String(retryAfter).trim();
          const seconds = Number(value);
          if (value !== '' && Number.isFinite(seconds) && seconds >= 0) {
            waitMs = Math.max(waitMs, seconds * 1000);
          } else {
            const retryAt = Date.parse(value);
            if (Number.isFinite(retryAt)) {
              waitMs = Math.max(waitMs, retryAt - Date.now());
            }
          }
        }
        // Respons Cloudflare Anda juga memiliki retry_after pada body.
        const body = error.response?.data as
          | { retry_after?: unknown }
          | undefined;
        const bodyRetryAfter = body?.retry_after;
        if (
          typeof bodyRetryAfter === 'number' ||
          typeof bodyRetryAfter === 'string'
        ) {
          const seconds = Number(bodyRetryAfter);
          if (Number.isFinite(seconds) && seconds >= 0) {
            waitMs = Math.max(waitMs, seconds * 1000);
          }
        }
        this.logger.warn(
          `Retry GET ${endpoint} | ` +
          `status=${status ?? error.code ?? 'unknown'} | ` +
          `nextAttempt=${attempt + 1}/${maxAttempts} | ` +
          `wait=${Math.ceil(waitMs / 1000)}s | ` +
          `skip=${params['$skip'] ?? 0}`,
        );
        // Timer async; tidak memblokir event loop.
        await new Promise<void>((resolve) => {
          setTimeout(resolve, waitMs);
        });
      }
    }
    throw new Error(`Request ${endpoint} gagal setelah retry.`);
  }
  // ─── Generic Paginated Fetch ──────────────────────────────────────────────────
  // $orderby from callers is overridden for cursor endpoints.
  // Public entry point: all existing callers keep the same signature.

  async fetchAllPages<T>(
    endpoint: string,
    extraParams: Record<string, any> = {},
    pageSize = 100,
  ): Promise<T[]> {
    const idColumn = CURSOR_COLUMNS[endpoint];
    if (idColumn) {
      return this.fetchAllById<T>(endpoint, idColumn, extraParams, pageSize);
    }

    if (endpoint === '/api/v1/models/m_productprice') {
      // Product ID is unique only WITHIN one price-list version.
      // Accept only the known full/incremental filters, never an arbitrary OR.
      const filter = String(extraParams['$filter'] ?? '').trim();
      const match = filter.match(
        /^\(?M_PriceList_Version_ID eq ([1-9]\d*)\)?(?: and \(Updated ge '[^']+'\))?$/,
      );
      if (match) {
        const versionId = Number(match[1]);
        if (!Number.isSafeInteger(versionId)) {
          throw new Error('Price-list version ID tidak valid.');
        }
        return this.fetchAllById<T>(
          endpoint, 'M_Product_ID', extraParams, pageSize, versionId,
        );
      }
    }

    // Unknown/composite-key queries retain strict offset validation.
    this.logger.warn(`Strict offset pagination | endpoint=${endpoint}`);
    return this.fetchAllByOffset<T>(endpoint, extraParams, pageSize);
  }

  private async fetchAllByOffset<T>(
    endpoint: string,
    extraParams: Record<string, any> = {},
    pageSize = 100,
  ): Promise<T[]> {
    if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
      throw new Error('pageSize harus berupa bilangan bulat positif.');
    }
    const allRecords: T[] = [];
    const MAX_PAGES = 10_000;
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
        await this.getWithRetry<IdempiereListResponse<T>>(
          endpoint,
          {
            ...baseParams,
            '$skip': skip,
            '$top': pageSize,
          },
        );
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

  private async fetchAllById<T>(
    endpoint: string,
    idColumn: string,
    extraParams: Record<string, any> = {},
    pageSize = 100,
    priceListVersionId?: number,
  ): Promise<T[]> {
    if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
      throw new Error('pageSize harus berupa bilangan bulat positif.');
    }
    const isPrice = endpoint === '/api/v1/models/m_productprice';
    if (
      isPrice
        ? idColumn !== 'M_Product_ID' || priceListVersionId === undefined
        : CURSOR_COLUMNS[endpoint] !== idColumn
    ) {
      throw new Error(`Cursor endpoint/kolom tidak didukung: ${endpoint}/${idColumn}`);
    }

    const baseParams: Record<string, any> = {
      ...this.defaultParams,
      ...extraParams,
    };
    // Ensure the cursor column remains available when callers use $select.
    if (baseParams['$select']) {
      const columns = String(baseParams['$select']).split(',').map((v) => v.trim());
      columns.push(idColumn);
      if (isPrice) columns.push('M_PriceList_Version_ID');
      baseParams['$select'] = [...new Set(columns)].join(',');
    }

    const originalFilter = String(baseParams['$filter'] ?? '').trim();
    // Pagination dan urutan dikendalikan oleh fungsi ini.
    for (const key of [
      '$page',
      '$pageSize',
      '$skip',
      '$top',
      '$orderby',
      '$filter',
    ]) {
      delete baseParams[key];
    }
    const combineFilter = (condition: string): string =>
      originalFilter
        ? `(${originalFilter}) and (${condition})`
        : condition;
    const readRecords = (
      response: AxiosResponse<IdempiereListResponse<T>>,
    ): T[] => {
      if (!Array.isArray(response.data?.records)) {
        throw new Error(
          `Response ${endpoint} tidak valid: records bukan array.`,
        );
      }
      return response.data.records;
    };
    // iDempiere REST umumnya menampilkan primary key sebagai "id".
    // Fallback mengakomodasi respons dengan nama kolom primary key.
    const readId = (record: T): number => {
      if (!record || typeof record !== 'object') {
        throw new Error(`Record ${endpoint} bukan object.`);
      }
      const row = record as unknown as Record<string, unknown>;
      const scalar = (value: unknown): unknown =>
        value !== null && typeof value === 'object'
          ? (value as Record<string, unknown>).id
          : value;
      if (isPrice) {
        const version = Number(scalar(row.M_PriceList_Version_ID));
        if (version !== priceListVersionId) {
          throw new Error(`Price-list version tidak sesuai: ${version}`);
        }
      }
      // ProductPrice.id may be UUID/composite: NEVER use it as product cursor.
      const rawId = isPrice
        ? scalar(row[idColumn])
        : row.id ?? scalar(row[idColumn]);
      const id =
        typeof rawId === 'number'
          ? rawId
          : typeof rawId === 'string' && rawId.trim() !== ''
            ? Number(rawId)
            : NaN;
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error(
          `Record ${endpoint} tidak memiliki ID numerik valid (${idColumn}).`,
        );
      }
      return id;
    };
    // Tentukan batas ID dengan filter bisnis yang sama.
    // Tidak perlu mengambil detail/child untuk permintaan ini.
    const upperParams = { ...baseParams };
    delete upperParams['$expand'];
    delete upperParams['$select'];
    const upperResponse =
      await this.getWithRetry<IdempiereListResponse<T>>(endpoint, {
        ...upperParams,
        '$filter': combineFilter(`${idColumn} gt 0`),
        '$orderby': `${idColumn} desc`,
        '$skip': 0,
        '$top': 1,
      });
    const upperRecords = readRecords(upperResponse);
    if (upperRecords.length === 0) {
      return [];
    }
    if (upperRecords.length !== 1) {
      throw new Error(
        `${endpoint}: permintaan batas ID tidak menghormati $top=1.`,
      );
    }
    const upperId = readId(upperRecords[0]);
    const allRecords: T[] = [];
    const configuredMax = Number(
      this.configService.get<string | number>('IDEMPIERE_SYNC_MAX_PAGES') ?? 10000,
    );
    if (!Number.isSafeInteger(configuredMax) || configuredMax <= 0) {
      throw new Error('IDEMPIERE_SYNC_MAX_PAGES harus bilangan bulat positif.');
    }
    const maxPages = configuredMax;
    let lastId = 0;
    this.logger.log(
      `ID pagination started | endpoint=${endpoint} | upperId=${upperId}`,
    );
    for (let page = 1; page <= maxPages; page++) {
      const response =
        await this.getWithRetry<IdempiereListResponse<T>>(endpoint, {
          ...baseParams,
          '$filter': combineFilter(
            `${idColumn} gt ${lastId} and ${idColumn} le ${upperId}`,
          ),
          '$orderby': `${idColumn} asc`,
          '$skip': 0,
          '$top': pageSize,
        });
      const records = readRecords(response);
      if (records.length > pageSize) {
        throw new Error(`${endpoint}: response melebihi ukuran halaman.`);
      }
      if (records.length === 0 && Number(response.data['row-count']) > 0) {
        throw new Error(`${endpoint}: halaman kosong tetapi row-count masih positif.`);
      }
      if (records.length === 0) {
        this.logger.log(
          `ID pagination finished | endpoint=${endpoint} | ` +
            `records=${allRecords.length}`,
        );
        return allRecords;
      }
      // Pastikan server menerapkan filter dan pengurutan.
      // Jangan diam-diam menerima halaman berulang.
      let nextId = lastId;
      for (const record of records) {
        const id = readId(record);
        if (id <= nextId || id > upperId) {
          throw new Error(
            `Urutan/filter ID ${endpoint} tidak valid: ` +
              `id=${id}, previousId=${nextId}, upperId=${upperId}.`,
          );
        }
        nextId = id;
      }
      allRecords.push(...records);
      lastId = nextId;
      if (page === 1 || page % 100 === 0 || lastId === upperId) {
        this.logger.log(
          `ID pagination progress | endpoint=${endpoint} | ` +
            `page=${page} | records=${allRecords.length} | ` +
            `lastId=${lastId} | upperId=${upperId}`,
        );
      }
      if (lastId === upperId) {
        this.logger.log(
          `ID pagination finished | endpoint=${endpoint} | records=${allRecords.length}`,
        );
        return allRecords;
      }
      // Tidak berhenti hanya karena records.length < pageSize:
      // server mungkin membatasi ukuran halaman.
    }
    throw new Error(
      `Pagination ${endpoint} mencapai batas ${maxPages} halaman. ` +
        `${allRecords.length} records telah dibaca; hasil tidak dikembalikan.`,
    );
  }

  async fetchUpdatedSince<T>(
    endpoint: string,
    since: Date,
    extraParams: Record<string, any> = {},
    pageSize = 100,
  ): Promise<T[]> {
    if (!(since instanceof Date) || Number.isNaN(since.getTime())) {
      throw new Error('Checkpoint incremental tidak valid.');
    }
    // Mempertahankan format waktu WIB dari implementasi existing.
    // Pastikan API memang menafsirkan timestamp tanpa zona sebagai WIB.
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    const sinceStr = new Date(
      since.getTime() + WIB_OFFSET_MS,
    )
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);
    const existingFilter = String(
      extraParams['$filter'] ?? '',
    ).trim();
    // ge mengambil ulang batas detik checkpoint.
    // Penyimpanan berdasarkan ID harus tetap idempotent.
    const updatedFilter = `Updated ge '${sinceStr}'`;
    const filter = existingFilter
      ? `(${existingFilter}) and (${updatedFilter})`
      : updatedFilter;
    return this.fetchAllPages<T>(
      endpoint,
      {
        ...extraParams,
        '$filter': filter,
        '$orderby': extraParams['$orderby'] ?? 'Updated asc',
      },
      pageSize,
    );
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

  async getUpdatedPrices(
    since: Date,
  ): Promise<IdempierePriceRecord[]> {
    return this.fetchUpdatedSince<IdempierePriceRecord>(
      '/api/v1/models/m_productprice',
      since,
      {
        '$filter': 'M_PriceList_Version_ID eq 1000005',
        '$expand': 'M_Product_ID,M_PriceList_Version_ID',
      },
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
        '$filter': "IsEmployee eq false and IsActive eq true",
        '$expand': 'C_BPartner_Location($filter=IsActive eq true)',
        '$orderby': 'Value asc',
      },
    );
  }

  async getUpdatedRetailers(
    since: Date,
  ): Promise<IdempiereRetailerRecord[]> {
    return this.fetchUpdatedSince<IdempiereRetailerRecord>(
      '/api/v1/models/c_bpartner',
      since,
      {
        '$filter': [
          'IsEmployee eq false',
          '(IsActive eq true or IsActive eq false)',
        ].join(' and '),
        '$expand':
          'C_BPartner_Location($filter=(IsActive eq true or IsActive eq false))',
        '$orderby': 'Updated asc, C_BPartner_ID asc',
      },
      20,
    );
  }

  async getUpdatedRetailerLocations(
    since: Date,
  ): Promise<IdempiereChangedBPLocationRecord[]> {
    return this.fetchUpdatedSince<IdempiereChangedBPLocationRecord>(
      '/api/v1/models/c_bpartner_location',
      since,
      {
        '$filter': '(IsActive eq true or IsActive eq false)',
        '$orderby': 'Updated asc, C_BPartner_Location_ID asc',
      },
      100,
    );
  }

  async getRetailersByIds(
    ids: number[],
  ): Promise<IdempiereRetailerRecord[]> {
    const uniqueIds = [...new Set(ids)];
    if (
      uniqueIds.some(
        (id) => !Number.isSafeInteger(id) || id <= 0,
      )
    ) {
      throw new Error('ID business partner tidak valid.');
    }
    const records: IdempiereRetailerRecord[] = [];
    const batchSize = 10;
    for (let i = 0; i < uniqueIds.length; i += batchSize) {
      const batch = uniqueIds.slice(i, i + batchSize);
      const idFilter = batch
        .map((id) => `C_BPartner_ID eq ${id}`)
        .join(' or ');
      const rows = await this.fetchAllPages<IdempiereRetailerRecord>(
        '/api/v1/models/c_bpartner',
        {
          '$filter': [
            `(${idFilter})`,
            'IsEmployee eq false',
            '(IsActive eq true or IsActive eq false)',
          ].join(' and '),
          '$expand':
            'C_BPartner_Location($filter=(IsActive eq true or IsActive eq false))',
          '$orderby': 'C_BPartner_ID asc',
        },
      );
      records.push(...rows);
    }
    return records;
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

  async getUpdatedRetailerRules(
    since: Date,
  ): Promise<IdempiereRetailerRulesRecord[]> {
    return this.fetchUpdatedSince<IdempiereRetailerRulesRecord>(
      '/api/v1/models/sas_bprule',
      since,
      {
        '$filter': '(IsActive eq true or IsActive eq false)',
        '$expand': 'SalesRep_ID',
        '$orderby': 'Updated asc, SAS_BPRule_ID asc',
      },
      100,
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
    const from = new Date(`${dateFrom}T00:00:00Z`);
    const to = new Date(`${dateTo}T00:00:00Z`);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from > to
    ) {
      throw new Error('Rentang tanggal inventory tidak valid.');
    }
    if (ALLOWED_LOCATOR_IDS.length === 0) {
      return [];
    }
    const dateToExclusive = new Date(
      to.getTime() + 24 * 60 * 60 * 1000,
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
          // Sertakan tanggal lama untuk kebutuhan fallback.
          `DateMaterialPolicy lt '${dateToExclusive}'`,
        ].join(' and '),
        '$orderby': 'M_Locator_ID asc,M_Product_ID asc,M_AttributeSetInstance_ID asc,DateMaterialPolicy asc',
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
    if (ALLOWED_LOCATOR_IDS.length === 0) {
      return [];
    }
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    // Ambil perubahan sejak awal hari WIB dari checkpoint terakhir.
    const updatedFrom = new Date(
      since.getTime() + WIB_OFFSET_MS,
    )
      .toISOString()
      .slice(0, 10);
    const locatorFilter = ALLOWED_LOCATOR_IDS
      .map((id) => `M_Locator_ID eq ${id}`)
      .join(' or ');
    // 1. Cari baris yang berubah untuk mengetahui produk terdampak.
    const changedRecords =
      await this.fetchAllPages<IdempiereStorageOnHandRecord>(
        '/api/v1/models/m_storageonhand',
        {
          '$expand': 'M_Locator_ID',
          '$filter': [
            `(${locatorFilter})`,
            `Updated ge '${updatedFrom}'`,
          ].join(' and '),
          '$orderby': 'Updated asc,M_Locator_ID asc,M_Product_ID asc,M_AttributeSetInstance_ID asc,DateMaterialPolicy asc',
        },
        100,
      );
    if (changedRecords.length === 0) {
      return [];
    }
    const changedProductIds = new Set<number>();
    for (const record of changedRecords) {
      const productId = Number(record.M_Product_ID?.id);
      if (!Number.isSafeInteger(productId) || productId <= 0) {
        throw new Error(
          'Record stok yang berubah tidak memiliki product ID valid.',
        );
      }
      changedProductIds.add(productId);
    }
    // 2. Ambil seluruh baris stok produk terdampak,
    //    termasuk locator/batch/tanggal yang tidak berubah.
    const productIds = [...changedProductIds];
    const records: IdempiereStorageOnHandRecord[] = [];
    const PRODUCT_BATCH_SIZE = 50;
    for (
      let i = 0;
      i < productIds.length;
      i += PRODUCT_BATCH_SIZE
    ) {
      const chunk = productIds.slice(i, i + PRODUCT_BATCH_SIZE);
      const productFilter = chunk
        .map((id) => `M_Product_ID eq ${id}`)
        .join(' or ');
      const productRecords =
        await this.fetchAllPages<IdempiereStorageOnHandRecord>(
          '/api/v1/models/m_storageonhand',
          {
            '$expand': 'M_Locator_ID',
            '$filter': [
              `(${locatorFilter})`,
              `(${productFilter})`,
            ].join(' and '),
            '$orderby': 'M_Locator_ID asc,M_Product_ID asc,M_AttributeSetInstance_ID asc,DateMaterialPolicy asc',
          },
          100,
        );
      records.push(...productRecords);
    }
    return records;
  }

  async getAllSecondarySales(
    dateFrom: string,
    dateTo: string,
  ): Promise<IdempiereSecondarySalesRecord[]> {
    const orgTrxFilter = ALLOWED_ORGTRX_IDS
      .map((id) => `AD_OrgTrx_ID eq ${id}`)
      .join(' or ');
    const docTypeFilter = SECONDARY_DOCTYPE_IDS
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
    if (
      ALLOWED_ORGTRX_IDS.length === 0 ||
      SECONDARY_DOCTYPE_IDS.length === 0
    ) {
      return [];
    }
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    // Ambil ulang sejak awal hari WIB dari checkpoint.
    const updatedFrom = new Date(
      since.getTime() + WIB_OFFSET_MS,
    )
      .toISOString()
      .slice(0, 10);
    const orgTrxFilter = ALLOWED_ORGTRX_IDS
      .map((id) => `AD_OrgTrx_ID eq ${id}`)
      .join(' or ');
    const docTypeFilter = SECONDARY_DOCTYPE_IDS
      .map((id) => `C_DocType_ID eq ${id}`)
      .join(' or ');
    return this.fetchAllPages<IdempiereSecondarySalesRecord>(
      '/api/v1/models/c_invoice',
      {
        '$expand':
          'C_InvoiceLine($expand=C_OrderLine_ID),' +
          'C_Order_ID,C_BPartner_ID,SalesRep_ID',
        '$filter': [
          `(${orgTrxFilter})`,
          `(${docTypeFilter})`,
          `DateInvoiced ge '${FULL_SYNC_DATE_FROM}'`,
          `Updated ge '${updatedFrom}'`,
        ].join(' and '),
        '$orderby': 'Updated asc,C_Invoice_ID asc',
      },
      100,
    );
  }

  async getAllStockAdjustments(
    dateFrom: string,
    dateTo: string,
  ): Promise<IdempiereStockAdjustmentRecord[]> {
    const orgTrxFilter = ALLOWED_ORGTRX_IDS
      .map((id) => `AD_OrgTrx_ID eq ${id}`)
      .join(' or ');
    const docTypeFilter = ADJUSTMENT_DOCTYPE_IDS
      .map((id) => `C_DocType_ID eq ${id}`)
      .join(' or ');
    const warehouseFilter = ALLOWED_WAREHOUSE_IDS
      .map((id) => `M_Warehouse_ID eq ${id}`)
      .join(' or ');
    return this.fetchAllPages<IdempiereStockAdjustmentRecord>(
      '/api/v1/models/m_inventory',
      {
        '$expand': 'M_InventoryLine',
        '$filter': [
          `(${orgTrxFilter})`,
          `(${docTypeFilter})`,
          `(${warehouseFilter})`,
          `MovementDate ge '${dateFrom}'`,
          `MovementDate le '${dateTo}'`,
        ].join(' and '),
        '$orderby': 'MovementDate desc',
      },
      100,
    );
  }

  async getUpdatedStockAdjustments(
    since: Date,
  ): Promise<IdempiereStockAdjustmentRecord[]> {
    if (!(since instanceof Date) || Number.isNaN(since.getTime())) {
      throw new Error('Parameter since wajib berupa Date yang valid.');
    }
    if (
      ALLOWED_ORGTRX_IDS.length === 0 ||
      ADJUSTMENT_DOCTYPE_IDS.length === 0 ||
      ALLOWED_WAREHOUSE_IDS.length === 0
    ) {
      return [];
    }
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    const updatedFrom = new Date(
      since.getTime() + WIB_OFFSET_MS,
    )
      .toISOString()
      .slice(0, 10);
    const orgTrxFilter = ALLOWED_ORGTRX_IDS
      .map((id) => `AD_OrgTrx_ID eq ${id}`)
      .join(' or ');
    const docTypeFilter = ADJUSTMENT_DOCTYPE_IDS
      .map((id) => `C_DocType_ID eq ${id}`)
      .join(' or ');
    const warehouseFilter = ALLOWED_WAREHOUSE_IDS
      .map((id) => `M_Warehouse_ID eq ${id}`)
      .join(' or ');
    return this.fetchAllPages<IdempiereStockAdjustmentRecord>(
      '/api/v1/models/m_inventory',
      {
        '$expand': 'M_InventoryLine',
        '$filter': [
          `(${orgTrxFilter})`,
          `(${docTypeFilter})`,
          `(${warehouseFilter})`,
          `MovementDate ge '${FULL_SYNC_DATE_FROM}'`,
          `Updated ge '${updatedFrom}'`,
        ].join(' and '),
        '$orderby': 'Updated asc,M_Inventory_ID asc',
      },
      100,
    );
  }

  async getAllStockTransfers(
    dateFrom: string,
    dateTo: string,
  ): Promise<IdempiereStockTransferRecord[]> {
    if (
      !ALLOWED_ORGTRX_IDS.length ||
      !TRANSFER_DOCTYPE_IDS.length ||
      !TRANSFER_LOCATOR_IDS.length
    ) {
      throw new Error(
        'Filter organisasi, tipe dokumen, dan locator stock transfer tidak boleh kosong.',
      );
    }
    const orgTrxFilter = ALLOWED_ORGTRX_IDS
      .map((id) => `AD_OrgTrx_ID eq ${id}`)
      .join(' or ');
    const docTypeFilter = TRANSFER_DOCTYPE_IDS
      .map((id) => `C_DocType_ID eq ${id}`)
      .join(' or ');
    const locatorFilter = TRANSFER_LOCATOR_IDS
      .map((id) => `M_Locator_ID eq ${id}`)
      .join(' or ');
    return this.fetchAllPages<IdempiereStockTransferRecord>(
      '/api/v1/models/m_movement',
      {
        '$expand': `M_MovementLine($filter=(${locatorFilter}))`,
        '$filter': [
          `(${orgTrxFilter})`,
          `(${docTypeFilter})`,
          `MovementDate ge '${dateFrom}'`,
          `MovementDate le '${dateTo}'`,
        ].join(' and '),
        '$orderby': 'MovementDate desc, M_Movement_ID desc',
      },
      100,
    );
  }

  async getUpdatedStockTransfers(
    since: Date,
  ): Promise<IdempiereStockTransferRecord[]> {
    if (!(since instanceof Date) || Number.isNaN(since.getTime())) {
      throw new Error('Checkpoint incremental tidak valid.');
    }
    if (
      !ALLOWED_ORGTRX_IDS.length ||
      !TRANSFER_DOCTYPE_IDS.length ||
      !TRANSFER_LOCATOR_IDS.length
    ) {
      throw new Error(
        'Filter organisasi, tipe dokumen, dan locator stock transfer tidak boleh kosong.',
      );
    }
    const orgTrxFilter = ALLOWED_ORGTRX_IDS
      .map((id) => `AD_OrgTrx_ID eq ${id}`)
      .join(' or ');
    const docTypeFilter = TRANSFER_DOCTYPE_IDS
      .map((id) => `C_DocType_ID eq ${id}`)
      .join(' or ');
    const locatorFilter = TRANSFER_LOCATOR_IDS
      .map((id) => `M_Locator_ID eq ${id}`)
      .join(' or ');
    return this.fetchAllPages<IdempiereStockTransferRecord>(
      '/api/v1/models/m_movement',
      {
        '$expand': `M_MovementLine($filter=(${locatorFilter}))`,
        '$filter': [
          `(${orgTrxFilter})`,
          `(${docTypeFilter})`,
          `Updated ge '${since.toISOString()}'`,
        ].join(' and '),
        '$orderby': 'Updated asc, M_Movement_ID asc',
      },
      100,
    );
  }

  async getAllPrimaryInvoices(
    dateFrom: string,
    dateTo: string,
  ): Promise<IdempierePrimaryInvoicesRecord[]> {
    const orgTrxFilter = ALLOWED_ORGTRX_IDS
      .map((id) => `AD_OrgTrx_ID eq ${id}`)
      .join(' or ');
    const docTypeFilter = PRIMARY_DOCTYPE_IDS
      .map((id) => `C_DocType_ID eq ${id}`)
      .join(' or ');
    const bpartnerFilter = ALLOWED_BPARTNER_IDS
      .map((id) => `C_BPartner_ID eq ${id}`)
      .join(' or ');
    return this.fetchAllPages<IdempierePrimaryInvoicesRecord>(
      '/api/v1/models/c_invoice',
      {
        '$expand': 'C_InvoiceLine($expand=C_OrderLine_ID),C_Order_ID,C_BPartner_ID',
        '$filter': [
          `(${orgTrxFilter})`,
          `(${docTypeFilter})`,
          `(${bpartnerFilter})`,
          `DateInvoiced ge '${dateFrom}'`,
          `DateInvoiced le '${dateTo}'`,
        ].join(' and '),
        '$orderby': 'DateInvoiced desc',
      },
      100,
    );
  }

  async getUpdatedPrimaryInvoices(
    since: Date,
  ): Promise<IdempierePrimaryInvoicesRecord[]> {
    if (!(since instanceof Date) || Number.isNaN(since.getTime())) {
      throw new Error('Parameter since wajib berupa Date yang valid.');
    }
    if (
      ALLOWED_ORGTRX_IDS.length === 0 ||
      PRIMARY_DOCTYPE_IDS.length === 0
    ) {
      return [];
    }
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    // Ambil ulang sejak awal hari WIB dari checkpoint.
    const updatedFrom = new Date(
      since.getTime() + WIB_OFFSET_MS,
    )
      .toISOString()
      .slice(0, 10);
    const orgTrxFilter = ALLOWED_ORGTRX_IDS
      .map((id) => `AD_OrgTrx_ID eq ${id}`)
      .join(' or ');
    const docTypeFilter = PRIMARY_DOCTYPE_IDS
      .map((id) => `C_DocType_ID eq ${id}`)
      .join(' or ');
    const bpartnerFilter = ALLOWED_BPARTNER_IDS
      .map((id) => `C_BPartner_ID eq ${id}`)
      .join(' or ');
    return this.fetchAllPages<IdempierePrimaryInvoicesRecord>(
      '/api/v1/models/c_invoice',
      {
        '$expand':
          'C_InvoiceLine($expand=C_OrderLine_ID),' +
          'C_Order_ID,C_BPartner_ID',
        '$filter': [
          `(${orgTrxFilter})`,
          `(${docTypeFilter})`,
          `(${bpartnerFilter})`,
          `DateInvoiced ge '${FULL_SYNC_DATE_FROM}'`,
          `Updated ge '${updatedFrom}'`,
        ].join(' and '),
        '$orderby': 'Updated asc,C_Invoice_ID asc',
      },
      100,
    );
  }
}
