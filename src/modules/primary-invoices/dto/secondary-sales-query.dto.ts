import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SecondarySalesQueryDto {
  // ── Mandatory ──────────────────────────────────────────────────────────────
  @IsDateString()
  @IsNotEmpty()
  dateFrom!: string;

  @IsDateString()
  @IsNotEmpty()
  dateTo!: string;

  // ── Opsional ───────────────────────────────────────────────────────────────
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}