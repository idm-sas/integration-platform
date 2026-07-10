// src/modules/retailer/dto/retailer-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RetailerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  value: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  name2: string | null;

  @ApiPropertyOptional({ nullable: true })
  bpGroup: string | null;

  @ApiProperty()
  location: string;

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
  postal: string | null;

  @ApiPropertyOptional({ nullable: true })
  arcode: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ nullable: true })
  syncedAt: Date | null;
}