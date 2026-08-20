import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PriceDto {
  @ApiProperty() priceListId: number;
  @ApiProperty() priceListName: string;
  @ApiProperty() listPrice: number;
  @ApiProperty() currency: string;
}

export class ProductResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() productId: string;
  @ApiProperty() productName: string;
  @ApiProperty() sapProductCode: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() uom: string;
  @ApiProperty() deactivated: boolean;
  @ApiProperty() category: string;
  @ApiProperty() categoryERPId: string;
  @ApiPropertyOptional() category2?: string;
  @ApiPropertyOptional() image: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() lastUpdateAt: Date;
  @ApiPropertyOptional({ type: [PriceDto] }) prices?: PriceDto[];
  @ApiProperty() syncedAt: Date;
}

export class PaginatedProductResponseDto {
  @ApiProperty({ type: [ProductResponseDto] }) data: ProductResponseDto[];
  @ApiProperty() meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
