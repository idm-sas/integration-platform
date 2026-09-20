import { IsString, IsInt, IsOptional, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InventoryQueryDto {
  @ApiProperty({ example: '2026-08-01', description: 'Tanggal awal (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateFrom must be format YYYY-MM-DD' })
  dateFrom: string;

  @ApiProperty({ example: '2026-08-18', description: 'Tanggal akhir (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateTo must be format YYYY-MM-DD' })
  dateTo: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 20;
}
