import { ApiProperty } from '@nestjs/swagger';


export class SecondarySalesLineDto {

  @ApiProperty()
  productErpId: string;


  @ApiProperty()
  productName: string;


  @ApiProperty()
  grossValue: number;


  @ApiProperty()
  netValue: number;


  @ApiProperty()
  price: number;


  @ApiProperty()
  totalValue: number;


  @ApiProperty()
  freeQty: number;


  @ApiProperty()
  invoicedQuantity: number;


  @ApiProperty()
  uom: string;


  constructor(
    partial: Partial<SecondarySalesLineDto>,
  ) {
    Object.assign(this, partial);
  }

}



export class SecondarySalesInvoiceDto {


  @ApiProperty()
  orderNo: string;


  @ApiProperty()
  invoiceDate: string;


  @ApiProperty()
  invoiceNo: string;



  @ApiProperty()
  totalGrossValue: number;



  @ApiProperty()
  status: string;



  @ApiProperty()
  totalDiscount: number;



  @ApiProperty()
  totalNetValue: number;



  @ApiProperty()
  taxPercent: number;



  @ApiProperty()
  taxValue: number;



  @ApiProperty()
  totalValue: number;



  @ApiProperty()
  totalQuantity: number;



  @ApiProperty({
    nullable:true,
  })
  remark: string | null;



  @ApiProperty()
  esmErpId: string;



  @ApiProperty()
  esmName: string;



  @ApiProperty()
  retailerErpId: string;



  @ApiProperty()
  retailerName: string;



  @ApiProperty({
    type: () => [
      SecondarySalesLineDto,
    ],
  })
  lines: SecondarySalesLineDto[];



  constructor(
    partial: Partial<SecondarySalesInvoiceDto>,
  ) {
    Object.assign(this, partial);
  }

}





export class SecondarySalesMetaDto {


  @ApiProperty()
  total: number;



  @ApiProperty()
  page: number;



  @ApiProperty()
  limit: number;



  @ApiProperty()
  totalPages: number;



  @ApiProperty()
  generatedAt: string;


}




export class SecondarySalesResponseDto {


  @ApiProperty()
  message: string;



  @ApiProperty({
    type: () => [
      SecondarySalesInvoiceDto,
    ],
  })
  data: SecondarySalesInvoiceDto[];



  @ApiProperty({
    type: SecondarySalesMetaDto,
  })
  meta: SecondarySalesMetaDto;


}