import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class InventoryQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    default: 20,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  // @ApiPropertyOptional({
  //   description: 'Warehouse ERP Code',
  //   example: 'WH-MAIN-01',
  // })
  @IsOptional()
  @IsString()
  warehouse?: string;

  // @ApiPropertyOptional({
  //   description: 'Product Code',
  //   example: 'AB0101000',
  // })
  @IsOptional()
  @IsString()
  product?: string;


  @IsDateString()
  dateFrom: string;

  @IsDateString()
  dateTo: string;
}