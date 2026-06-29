import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PriceDto {
  @ApiProperty() priceListId: number;
  @ApiProperty() priceListName: string;
  @ApiProperty() listPrice: number;
  @ApiProperty() standardPrice: number;
  @ApiProperty() currency: string;
  @ApiPropertyOptional() validFrom?: Date;
  @ApiPropertyOptional() validTo?: Date;
}

export class ProductResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() uom: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty() categoryId: string;
  @ApiPropertyOptional() group2?: string;
  @ApiProperty() categoryCode: string;
  @ApiProperty() categoryName: string;
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
