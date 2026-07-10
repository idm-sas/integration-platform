import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SalesmanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  value: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  name2?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  position?: string;

  @ApiProperty()
  positionCodeLevel: number;

  @ApiPropertyOptional()
  bpGroup?: string;

  @ApiProperty()
  isActive: boolean;
}