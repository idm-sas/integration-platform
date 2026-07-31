import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  IsDateString,
} from 'class-validator';


export class SecondarySalesQueryDto {


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



  @ApiPropertyOptional({
    description: 'Invoice date from',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;



  @ApiPropertyOptional({
    description: 'Invoice date to',
    example: '2026-07-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;



  @ApiPropertyOptional({
  description: 'Salesman iDempiere ID',
  example: 2200152,
})
@Type(() => Number)
@IsOptional()
@IsInt()
salesman?: number;



  @ApiPropertyOptional({
    description: 'Retailer ERP Code',
    example: 'RT001',
  })
  @IsOptional()
  @IsString()
  retailer?: string;



  @ApiPropertyOptional({
    description: 'Invoice number',
    example: 'INV-000123',
  })
  @IsOptional()
  @IsString()
  invoiceNo?: string;

}