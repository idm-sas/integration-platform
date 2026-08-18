import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { In, Repository } from 'typeorm';

import { SUCCESS_MESSAGE } from '../../common/constants/http-status.constant';
import { JwtPayload } from '../../auth/token.service';
import { IdempiereService } from '../../idempiere/idempiere.service';

import { SecondarySalesQueryDto } from './dto/secondary-sales-query.dto';

import { Product } from 'src/database/entities/product.entity';
import { Salesman } from 'src/database/entities/salesman.entity';

@Injectable()
export class SecondarySalesService {

  private readonly logger =
    new Logger(SecondarySalesService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(Salesman)
    private readonly salesmanRepo: Repository<Salesman>,

    private readonly idempiereService: IdempiereService,

    private readonly configService: ConfigService,
  ) {}

  async getInvoices(
    query: SecondarySalesQueryDto,
    principal: JwtPayload,
  ) {

    const generatedAt =
      new Date().toISOString();

    this.logger.log(
      'Loading secondary sales invoice...',
    );

    const invoices =
      await this.loadInvoices(query);

    const paged =
      this.paginate(
        invoices,
        query.page,
        query.limit,
      );

    return {
      message:
        SUCCESS_MESSAGE.FETCH_LIST,

      data:
        paged.data,

      meta: {
        total:
          paged.total,

        page:
          query.page,

        limit:
          query.limit,

        totalPages:
          paged.totalPages,

        generatedAt,
      },
    };
  }

  private async loadInvoices(
    query: SecondarySalesQueryDto,
  ) {

    /**
     * ========================================================
     * LOAD INVOICE FROM IDEMPIERE
     * ========================================================
     */

    const invoices =
      await this.idempiereService.getSecondarySalesInvoices({
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        salesman: query.salesman,
      });

    this.logger.log(
      `Invoice loaded : ${invoices.length}`,
    );


    /**
     * ========================================================
     * PRODUCT MAPPING
     * ========================================================
     *
     * Ambil seluruh Product ID dari seluruh invoice.
     *
     * Tidak query product per invoice.
     */

    const productIds = [
      ...new Set(
        invoices
          .flatMap(
            invoice =>
              invoice.c_invoiceline ?? [],
          )
          .map(line =>
            line.M_Product_ID?.id != null
              ? Number(line.M_Product_ID.id)
              : null,
          )
          .filter(
            (id): id is number =>
              id !== null &&
              !Number.isNaN(id),
          ),
      ),
    ];

    this.logger.log(
      `Product IDs found : ${productIds.length}`,
    );


    /**
     * Query Product hanya 1x
     */

    const products =
      productIds.length > 0
        ? await this.productRepo.find({
            where: {
              idempiereId:
                In(productIds),
            },
          })
        : [];


    /**
     * Buat Map:
     *
     * iDempiere Product ID
     *        ↓
     * Product entity
     */

    const productMap =
      new Map(
        products.map(product => [
          Number(product.idempiereId),
          product,
        ]),
      );

    this.logger.log(
      `Products mapped : ${products.length}`,
    );


    /**
     * ========================================================
     * SALESMAN MAPPING
     * ========================================================
     *
     * Ambil seluruh SalesRep ID dari invoice.
     */

    const salesmanIds = [
      ...new Set(
        invoices
          .map(invoice =>
            invoice.SalesRep_ID.C_BPartner_ID?.id != null
              ? Number(
                  invoice.SalesRep_ID.C_BPartner_ID?.id
                )
              : null,
          )
          .filter(
            (id): id is number =>
              id !== null &&
              !Number.isNaN(id),
          ),
      ),
    ];

    this.logger.log(
      `Salesman IDs found : ${salesmanIds.length}`,
    );


    /**
     * Query Salesman hanya 1x
     */

    const salesmen =
      salesmanIds.length > 0
        ? await this.salesmanRepo.find({
            where: {
              idempiereId:
                In(salesmanIds),
            },
          })
        : [];


    /**
     * Buat Map:
     *
     * iDempiere SalesRep ID
     *        ↓
     * Salesman entity
     */

    const salesmanMap =
      new Map(
        salesmen.map(salesman => [
          Number(
            salesman.idempiereId,
          ),
          salesman,
        ]),
      );

    this.logger.log(
      `Salesmen mapped : ${salesmen.length}`,
    );


    /**
     * ========================================================
     * MAP INVOICE
     * ========================================================
     */

    return invoices.map(invoice => {

      const lines =
        invoice.c_invoiceline ?? [];


      /**
       * ------------------------------------------------------
       * SALESMAN
       * ------------------------------------------------------
       */

      const salesmanErpId =
        invoice.SalesRep_ID.C_BPartner_ID?.id != null
          ? Number(
              invoice.SalesRep_ID.C_BPartner_ID?.id,
            )
          : null;

      const salesman =
        salesmanErpId !== null
          ? salesmanMap.get(
              salesmanErpId,
            )
          : undefined;


      /**
       * ------------------------------------------------------
       * INVOICE
       * ------------------------------------------------------
       */

      return {

        sellerErpId:
          invoice.AD_OrgTrx_ID?.identifier ??
          null,

        sellerName:
          invoice.AD_OrgTrx_ID?.identifier ??
          null,

        orderNo:
          invoice.C_Order_ID?.DocumentNo ??
          null,

        warehouseErpId:
          invoice.C_Order_ID
            ?.M_Warehouse_ID
            ?.identifier ??
          null,

        invoiceDate:
          invoice.DateInvoiced ??
          null,

        invoiceNo:
          invoice.DocumentNo ??
          null,

        totalGrossValue:
          Number(
            invoice.GrandTotal,
          ),

        status:
          invoice.DocStatus?.id ??
          null,

        totalDiscount:
          lines.reduce(
            (sum, line) =>
              sum +
              (
                (
                  Number(
                    line.PriceList,
                  ) -
                  Number(
                    line.PriceActual,
                  )
                ) *
                Number(
                  line.QtyInvoiced,
                )
              ),
            0,
          ),

        totalNetValue:
          Number(
            invoice.TotalLines,
          ),

        taxPercent:
          0,

        taxValue:
          lines.reduce(
            (sum, line) =>
              sum +
              Number(
                line.TaxAmt ?? 0,
              ),
            0,
          ),

        totalValue:
          Number(
            invoice.GrandTotal,
          ),

        totalQuantity:
          lines.reduce(
            (sum, line) =>
              sum +
              Number(
                line.QtyInvoiced,
              ),
            0,
          ),

        remark:
          invoice.Description ??
          null,


        /**
         * ----------------------------------------------------
         * SALESMAN
         * ----------------------------------------------------
         *
         * ID internal database
         */

        esmErpId: 
          salesman?.id ??
          null,

        esmName: 
          salesman?.name ??
          null,


        /**
         * ----------------------------------------------------
         * RETAILER
         * ----------------------------------------------------
         */

        retailerErpId:
          invoice.C_BPartner_ID
            ?.Value ??
          null,

        retailerName:
          invoice.C_BPartner_ID
            ?.Name ??
          null,


        /**
         * ----------------------------------------------------
         * INVOICE LINES
         * ----------------------------------------------------
         *
         * Hanya tampilkan line apabila:
         *
         * 1. M_Product_ID tersedia
         * 2. Product ditemukan di database
         */

        lines:
          lines
            .filter(line => {

              const productErpId =
                line.M_Product_ID?.id !=
                null
                  ? Number(
                      line.M_Product_ID.id,
                    )
                  : null;

              return (
                productErpId !== null &&
                !Number.isNaN(
                  productErpId,
                ) &&
                productMap.has(
                  productErpId,
                )
              );
            })

            .map(line => {

              const productErpId =
                Number(
                  line.M_Product_ID!.id,
                );

              const product =
                productMap.get(
                  productErpId,
                )!;

              return {

                /**
                 * ID internal Product
                 */

                productId:
                  product.id,

                /**
                 * Nama Product dari database
                 */

                productName:
                  product.name ??
                  null,

                /**
                 * SAP Product Code
                 */

                SAPProductCode:
                  product.partner_code ??
                  null,


                /**
                 * Value
                 */

                grossValue:
                  Number(
                    line.PriceList,
                  ) *
                  Number(
                    line.QtyInvoiced,
                  ),

                netValue:
                  Number(
                    line.PriceActual,
                  ) *
                  Number(
                    line.QtyInvoiced,
                  ),

                price:
                  Number(
                    line.PriceActual,
                  ),

                totalValue:
                  Number(
                    line.LineNetAmt,
                  ),


                /**
                 * Discount
                 */

                discount1Code:
                  line.C_OrderLine_ID
                    ?.SAS_DiscountList_ID
                    ?.identifier ??
                  null,

                discount1Percent:
                  line.C_OrderLine_ID
                    ?.Discount ??
                  0,


                /**
                 * Free quantity
                 */

                freeQty:
                  Number(
                    line.PriceActual,
                  ) === 0
                    ? Number(
                        line.QtyInvoiced,
                      )
                    : 0,


                /**
                 * Quantity
                 */

                invoicedQuantity:
                  Number(
                    line.QtyInvoiced,
                  ),


                /**
                 * UOM
                 */

                uom:
                  line.C_UOM_ID
                    ?.identifier ??
                  null,
              };
            }),
      };
    });
  }


  /**
   * ==========================================================
   * PAGINATION
   * ==========================================================
   */

  private paginate<T>(
    data: T[],
    page: number,
    limit: number,
  ) {

    const total =
      data.length;

    const totalPages =
      Math.ceil(
        total / limit,
      );

    return {

      data:
        data.slice(
          (page - 1) * limit,
          page * limit,
        ),

      total,

      totalPages,
    };
  }
}