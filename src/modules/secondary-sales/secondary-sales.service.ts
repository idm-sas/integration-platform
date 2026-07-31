import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SUCCESS_MESSAGE } from '../../common/constants/http-status.constant';

import { JwtPayload } from '../../auth/token.service';

import { IdempiereService } from '../../idempiere/idempiere.service';

import { SecondarySalesQueryDto } from './dto/secondary-sales-query.dto';


@Injectable()
export class SecondarySalesService {

  private readonly logger =
    new Logger(SecondarySalesService.name);


  constructor(

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
     * Query langsung ke iDempiere
     *
     * C_Invoice
     * C_InvoiceLine
     *
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



    return invoices.map(invoice => {

  const lines = invoice.c_invoiceline ?? [];

  return {

    orderNo: null, // karena C_Order belum di-expand

    invoiceDate: invoice.DateInvoiced,

    invoiceNo: invoice.DocumentNo,

    totalGrossValue: Number(invoice.GrandTotal),

    status: invoice.DocStatus?.id,

    totalDiscount: lines.reduce(
      (sum, line) =>
        sum +
        (
          (Number(line.PriceList) - Number(line.PriceActual))
          * Number(line.QtyInvoiced)
        ),
      0,
    ),

    totalNetValue: Number(invoice.TotalLines),

    taxPercent: 0,

    taxValue: lines.reduce(
      (sum, line) => sum + Number(line.TaxAmt ?? 0),
      0,
    ),

    totalValue: Number(invoice.GrandTotal),

    totalQuantity: lines.reduce(
      (sum, line) => sum + Number(line.QtyInvoiced),
      0,
    ),

    remark: invoice.Description,

    esmErpId: invoice.SalesRep_ID?.id,

    esmName: invoice.SalesRep_ID?.identifier,

    retailerErpId: invoice.C_BPartner_ID?.id,

    retailerName: invoice.C_BPartner_ID?.identifier,

    lines: lines.map(line => ({

      productErpId: line.M_Product_ID?.id ?? null,

      productName: line.M_Product_ID?.identifier ?? null,

      grossValue:
        Number(line.PriceList) *
        Number(line.QtyInvoiced),

      netValue:
        Number(line.PriceActual) *
        Number(line.QtyInvoiced),

      price: Number(line.PriceActual),

      totalValue: Number(line.LineNetAmt),

      freeQty:
        Number(line.PriceActual) === 0
          ? Number(line.QtyInvoiced)
          : 0,

      invoicedQuantity: Number(line.QtyInvoiced),

      uom: line.C_UOM_ID?.identifier ?? null,

    })),

  };

});

  }



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