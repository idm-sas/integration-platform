// src/modules/retailer/dto/retailer-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RetailerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  retailerErpId: string;

  @ApiProperty()
  retailerName: string;

  @ApiPropertyOptional({ nullable: true })
  retailerName2: string | null;

  @ApiPropertyOptional({ nullable: true })
  bpGroup: string | null;

  @ApiProperty()
  outletErpId: string;

  @ApiProperty()
  outletName: string;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  marketname: string | null;

  @ApiPropertyOptional({ nullable: true })
  city: string | null;

  @ApiPropertyOptional({ nullable: true })
  subcity: string | null;

  @ApiPropertyOptional({ nullable: true })
  region: string | null;

  @ApiPropertyOptional({ nullable: true })
  country: string | null;

  @ApiPropertyOptional({ nullable: true })
  beat: string | null;

  @ApiPropertyOptional({ nullable: true })
  beatErpId: string | null;

  @ApiPropertyOptional({ nullable: true })
  latitude: string | null;

  @ApiPropertyOptional({ nullable: true })
  longitude: string | null;

  @ApiProperty()
  deactivated: boolean;

  @ApiProperty() createdAt: Date;
  @ApiProperty() lastUpdateAt: Date;

  @ApiPropertyOptional({ nullable: true })
  syncedAt: Date | null;
}

export class PaginatedRetailerResponseDto {
  @ApiProperty({ type: [RetailerResponseDto] }) data: RetailerResponseDto[];
  @ApiProperty() meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}