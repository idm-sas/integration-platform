import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TokenRequestDto {
  @ApiProperty({ example: 'principal_abc123' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ example: 'secret_xyz789' })
  @IsString()
  @IsNotEmpty()
  clientSecret: string;

  /**
   * Scope format: "product:read product:price category:electronics"
   * Kosong = request semua akses yang diizinkan
   */
  @ApiProperty({
    example: ['product:read', 'price:read'],
    required: false,
    isArray: true,
  })
  @IsArray()
  @IsOptional()
  scopes?: string[];
}
